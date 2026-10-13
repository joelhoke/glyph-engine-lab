/** Local-only snapshot from the macOS TV library. No account tokens or receipt data.
 * Preview: node scripts/import-apple-tv-collection.mjs
 * Write:   node scripts/import-apple-tv-collection.mjs --write
 * Library date-added determines order; it is not guaranteed to be purchase date.
 */
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { importAppleCovers } from './lib/apple-cover.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const write = process.argv.includes('--write')
if (process.platform !== 'darwin') throw new Error('Run on the Mac with your TV library.')
const inventory = JSON.parse(execFileSync('osascript', ['-l', 'JavaScript', '-e', `
  const tracks = Application('TV').libraryPlaylists[0].tracks;
  const names = tracks.name(), media = tracks.mediaKind(), kinds = tracks.kind();
  const dates = tracks.dateAdded(), years = tracks.year(), ids = tracks.databaseID();
  JSON.stringify(names.map((title, i) => ({ title, year: years[i], databaseId: ids[i],
    media: media[i], kind: kinds[i], added: dates[i] instanceof Date && !isNaN(dates[i]) ? dates[i].toISOString() : null
  })).filter(item => item.media === 'movie' && item.kind.startsWith('Purchased') && item.added)
    .sort((a,b) => b.added.localeCompare(a.added)).slice(0,12));
`], { encoding: 'utf8', timeout: 30000 }))
if (!inventory.length) throw new Error('No purchased movies exposed by this local TV library. Existing snapshot preserved.')
if (!write) {
  console.log(JSON.stringify(inventory.map(({ title, year }) => ({ title, year })), null, 2))
  console.log('Preview only. Add --write to refresh the public title/artwork snapshot.')
  process.exit(0)
}

const picks = inventory.map(item => ({
  id: `${item.title}-${item.year}`.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  title: item.title, source: 'Apple TV', note: String(item.year),
}))
await importAppleCovers(picks, new URL('../', import.meta.url))
await writeFile(path.join(root, 'content/apple-tv-collection.json'), JSON.stringify(picks, null, 2) + '\n')
console.log(`Saved ${picks.length} movies; ${picks.filter(pick => pick.image).length} portrait covers.`)
