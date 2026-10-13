/** Refresh covers for the saved movie list without reading an account or operating TV. */
import { readFile, writeFile } from 'node:fs/promises'
import { importAppleCovers } from './lib/apple-cover.mjs'
import { importXboxCovers } from './lib/xbox-cover.mjs'
const root = new URL('../', import.meta.url)
for (const [name, refresh] of [['apple-tv', importAppleCovers], ['xbox', importXboxCovers]]) {
  if (process.argv.includes('--xbox-only') && name !== 'xbox') continue
  const file = new URL(`content/${name}-collection.json`, root)
  const picks = JSON.parse(await readFile(file, 'utf8'))
  await refresh(picks, root)
  await writeFile(file, `${JSON.stringify(picks, null, 2)}\n`)
}
