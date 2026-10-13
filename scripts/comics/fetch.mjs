// Kept in a child process so even a stalled native request can be terminated.
import comicgeeks from 'comicgeeks'
import { COMICS_USERNAME, normalizeComics } from '../../lib/comics.mjs'

const { fetchUser, fetchPulls, SortTypes } = comicgeeks
const date = process.argv[2]
try {
  const user = await fetchUser(COMICS_USERNAME)
  if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Error('Public profile unavailable')
  const pulls = await fetchPulls(user.id, date, { sort: SortTypes.AlphaAsc })
  const comics = normalizeComics(pulls)
  process.stdout.write(JSON.stringify(comics))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Comic fetch failed')
  process.exitCode = 1
}
