export const COMICS_USERNAME = 'Idiosarcasm'
export const COMICS_KEY = 'comics/latest.json'
export const MAX_SNAPSHOT_BYTES = 256 * 1024

export function upcomingWednesday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = type => parts.find(p => p.type === type).value
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + (3 - date.getUTCDay() + 7) % 7)
  return date.toISOString().slice(0, 10)
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function safeUrl(value, cover = false) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
    if (!cover) return url.hostname === 'leagueofcomicgeeks.com' && /^\/comic\/\d+(?:\/|$)/.test(url.pathname)
    return url.hostname === 'leagueofcomicgeeks.com' || url.hostname.endsWith('.leagueofcomicgeeks.com') ||
      (url.hostname === 's3.amazonaws.com' && url.pathname.startsWith('/comicgeeks/'))
  } catch { return false }
}

export function isComicSnapshot(value) {
  return value !== null && typeof value === 'object' && value.username === COMICS_USERNAME &&
    validDate(value.releaseDate) && (value.fetchedAt === null ||
      (typeof value.fetchedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value.fetchedAt) && Number.isFinite(Date.parse(value.fetchedAt)))) &&
    Array.isArray(value.comics) && value.comics.length <= 200 && value.comics.every(comic =>
      comic && typeof comic.name === 'string' && comic.name.trim().length > 0 && comic.name.length <= 500 &&
      typeof comic.publisher === 'string' && comic.publisher.length <= 200 && safeUrl(comic.url) &&
      (comic.cover === null || (typeof comic.cover === 'string' && safeUrl(comic.cover, true))))
}

export function normalizeComics(pulls) {
  if (!Array.isArray(pulls)) throw new Error('Expected an array of comics')
  const comics = pulls.map(item => ({ name: item?.name, publisher: item?.publisher ?? '', url: item?.url, cover: item?.cover || null }))
  if (!isComicSnapshot({ username: COMICS_USERNAME, releaseDate: '2026-01-07', fetchedAt: null, comics })) throw new Error('Invalid comic data; previous snapshot retained')
  return [...new Map(comics.map(comic => [comic.url, comic])).values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Both DOM covers and WebGL textures must use the same CORS-enabled URL.
 * The stable version bypasses images older pages cached without CORS headers.
 * Never timestamp per render: consumers should share the browser cache. */
export function comicCoverUrl(cover) {
  if (!cover || !safeUrl(cover, true)) return null
  const url = new URL(cover)
  url.searchParams.set('jh-cover', '1')
  return url.href
}
