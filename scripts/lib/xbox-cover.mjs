/** Public Microsoft Store catalog artwork, resolved by Xbox title ID (no account tokens).
 * Catalog contract: https://github.com/OpenXbox/xbox-webapi-python/tree/master/xbox/webapi/api/provider/catalog
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { downloadArtwork, isPortraitCover, savePhysicalCover } from './physical-cover.mjs'
import { safeArtwork } from '../xbox/client.mjs'

export function storeCoverCandidates(catalog, titleId) {
  return (catalog.Products ?? []).filter(product => product.AlternateIds?.some(id =>
    id.IdType === 'XboxTitleId' && String(id.Value) === titleId)).flatMap(product =>
    (product.LocalizedProperties ?? []).flatMap(locale => (locale.Images ?? [])
      .filter(image => ['Poster', 'BoxArt', 'BrandedKeyArt'].includes(image.ImagePurpose)
        && isPortraitCover({ width: image.Width, height: image.Height }))
      .sort((a, b) => ['Poster', 'BoxArt', 'BrandedKeyArt'].indexOf(a.ImagePurpose)
        - ['Poster', 'BoxArt', 'BrandedKeyArt'].indexOf(b.ImagePurpose))
      .map(image => ({ productId: product.ProductId, artwork: safeArtwork(image.Uri?.startsWith('//') ? `https:${image.Uri}` : image.Uri) }))
      .filter(image => image.artwork)))
}

export async function importXboxCovers(picks, root) {
  const manifest = new URL('source-assets/about/media/xbox-catalog.json', root)
  const sources = JSON.parse(await readFile(manifest, 'utf8').catch(() => '{}'))
  for (const pick of picks) {
    const titleId = /^xbox-(\d+)$/.exec(pick.id)?.[1]
    if (!titleId) continue
    try {
      const endpoint = new URL('https://displaycatalog.mp.microsoft.com/v7.0/products/lookup')
      endpoint.search = new URLSearchParams({ alternateId: 'XboxTitleID', Value: titleId, market: 'US', languages: 'en-US', fieldsTemplate: 'Details' })
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(20000), redirect: 'error' })
      if (!response.ok) throw new Error('Catalog unavailable')
      for (const candidate of storeCoverCandidates(await response.json(), titleId)) {
        try {
          const bytes = await downloadArtwork(candidate.artwork, host => Boolean(safeArtwork(`https://${host}/`)))
          pick.image = await savePhysicalCover({ bytes, id: pick.id, title: pick.title, root })
          pick.url = `https://www.xbox.com/en-US/games/store/-/${candidate.productId}`
          sources[pick.id] = { ...candidate, provider: 'Microsoft Store' }
          break
        } catch { /* Try another portrait; never stretch a dashboard tile. */ }
      }
    } catch { /* Keep a previously imported cover when the public catalog is unavailable. */ }
    console.log(`${pick.title}: ${pick.image ? 'portrait cover ready' : 'portrait unavailable'}`)
  }
  await mkdir(new URL('source-assets/about/media/', root), { recursive: true })
  await writeFile(manifest, `${JSON.stringify(sources, null, 2)}\n`)
}
