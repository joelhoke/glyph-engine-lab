/** Preview titles by default. --write publishes a minimal local snapshot, never tokens. */
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { downloadArtwork, savePhysicalCover } from './lib/physical-cover.mjs'
import { safeArtwork } from './xbox/client.mjs'
import { recentXboxGames } from './xbox/client.mjs'
import { importXboxCovers } from './lib/xbox-cover.mjs'
const root = new URL('../', import.meta.url)
const app = JSON.parse(await readFile(new URL('scripts/xbox/app.json', root), 'utf8'))
const profiles = JSON.parse(await readFile(new URL('content/media-profiles.json', root), 'utf8'))
try {
  const games = await recentXboxGames({ clientId: process.env.MICROSOFT_CLIENT_ID ?? app.clientId, expectedGamertag: profiles.xbox.handle })
  if (!games.length) throw new Error('No visible recent games were returned. Existing collection preserved.')
  console.log(games.map(game => game.title).join('\n'))
  if (!process.argv.includes('--write')) {
    console.log('Preview only. Run again with --write to update the public collection.')
  } else {
    const folder = new URL('public/assets/about/media/', root)
    await mkdir(folder, { recursive: true })
    const collection = []
    const sources = {}
    for (const { artwork, artworks = [artwork].filter(Boolean), ...game } of games) {
      for (const url of artworks) {
        try {
          const bytes = await downloadArtwork(url, host => Boolean(safeArtwork(`https://${host}/`)))
          game.image = await savePhysicalCover({ bytes, id: game.id, title: game.title, root })
          sources[game.id] = { artwork: url, provider: 'Xbox' }
          break
        } catch { /* Try the next supplied cover; never crop a dashboard tile. */ }
      }
      if (!game.image) console.warn(`Portrait cover unavailable for ${game.title}; keeping a title-only case.`)
      collection.push(game)
    }
    await writeFile(new URL('source-assets/about/media/xbox-catalog.json', root), `${JSON.stringify(sources, null, 2)}\n`)
    await importXboxCovers(collection, root)
    const target = new URL('content/xbox-collection.json', root)
    const temporary = `${fileURLToPath(target)}.tmp`
    await writeFile(temporary, `${JSON.stringify(collection, null, 2)}\n`)
    await rename(temporary, target)
    console.log(`Saved ${collection.length} games. Rebuild the site to publish the snapshot.`)
  }
} catch (error) { console.error(error.message); process.exitCode = 1 }
