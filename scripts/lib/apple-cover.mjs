import { readFile, writeFile } from 'node:fs/promises'
import { downloadArtwork, savePhysicalCover } from './physical-cover.mjs'
const manifestUrl = new URL('../../source-assets/about/media/apple-catalog.json', import.meta.url)
const normalize = title => title.replace(/\(\d{4}\)/g, '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
export function matchAppleMovie(results, pick) {
  return results.filter(item => item.kind === 'feature-movie' && normalize(item.trackName) === normalize(pick.title)
    && String(item.releaseDate).slice(0,4) === String(pick.note))
}
export async function importAppleCovers(picks, root) {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'))
  const previous = JSON.parse(await readFile(new URL('content/apple-tv-collection.json', root), 'utf8').catch(() => '[]'))
  for (const pick of picks) {
    const prior = previous.find(item => item.id === pick.id)
    if (!pick.image && prior?.image?.width === 420 && prior.image.height === 630) { pick.image = prior.image; pick.url = prior.url }
    try {
      let entry = manifest[pick.id]
      const endpoint = new URL(entry ? 'https://itunes.apple.com/lookup' : 'https://itunes.apple.com/search')
      endpoint.search = new URLSearchParams(entry ? { id: String(entry.appleId), country: entry.country ?? 'us' }
        : { term: pick.title, entity: 'movie', media: 'movie', country: 'us', limit: '20' })
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error('Apple catalog unavailable')
      const { results } = await response.json()
      const matches = entry ? results.filter(item => item.kind === 'feature-movie' && item.trackId === entry.appleId && normalize(item.trackName) === normalize(pick.title)) : matchAppleMovie(results, pick)
      if (matches.length !== 1) throw new Error('No unambiguous movie match; add a reviewed Apple ID to apple-catalog.json')
      const movie = matches[0]
      const artwork = movie.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/600x900bb.')
      if (!artwork) throw new Error('No catalog cover')
      const bytes = await downloadArtwork(artwork, host => host.endsWith('.mzstatic.com'))
      pick.image = await savePhysicalCover({ bytes, id: pick.id, title: pick.title, root })
      pick.url = movie.trackViewUrl
      manifest[pick.id] = { ...entry, appleId: movie.trackId, country: entry?.country ?? 'us', source: movie.trackViewUrl, artwork }
      console.log(`Portrait cover: ${pick.title}`)
    } catch (error) {
      // Preserve a prior valid portrait. Landscape thumbnails never become fake box art.
      if (pick.image && pick.image.width / pick.image.height > .8) delete pick.image
      console.warn(`${pick.title}: ${error.message}`)
    }
    // Apple's documented Search API limit is approximately 20 calls/minute.
    await new Promise(resolve => setTimeout(resolve, 3100))
  }
  await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`)
  return picks
}
