import { createHash, createPrivateKey, sign } from 'node:crypto'

export function musicDeveloperToken({ teamId, keyId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  if (!/^[A-Z0-9]{10}$/.test(teamId ?? '') || !/^[A-Z0-9]{10}$/.test(keyId ?? '')) throw new Error('Set the Apple Team ID and MusicKit Key ID (10 characters each).')
  const key = createPrivateKey(privateKey)
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('MusicKit requires an ES256 .p8 key.')
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const message = `${encode({ alg: 'ES256', kid: keyId })}.${encode({ iss: teamId, iat: now, exp: now + 3600 })}`
  return `${message}.${sign('sha256', Buffer.from(message), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}

/** Publish library albums only: never tokens, library IDs, dates, or raw responses. */
export function musicPicks(resources) {
  const picks = [], seen = new Set()
  for (const item of resources ?? []) {
    if (item.type !== 'library-albums') continue
    const a = item.attributes
    if (!a?.name || !a.artistName) continue
    const title = a.name
    const identity = `${a.artistName}\0${title}`
    if (seen.has(identity)) continue
    seen.add(identity)
    const pick = { id: `apple-music-${createHash('sha256').update(identity).digest('hex').slice(0, 16)}`, title, source: a.artistName, note: 'Apple Music' }
    try {
      const url = new URL(a.url)
      if (url.protocol === 'https:' && url.hostname === 'music.apple.com') pick.url = url.href
    } catch {}
    try {
      const src = a.artwork.url.replaceAll('{w}', '600').replaceAll('{h}', '600').replaceAll('{f}', 'jpg')
      const url = new URL(src)
      if (url.protocol === 'https:' && url.hostname.endsWith('.mzstatic.com')) pick.image = { src: url.href, alt: `${title} album cover`, width: 600, height: 600 }
    } catch {}
    picks.push(pick)
    if (picks.length === 12) break
  }
  return picks
}

/** Fill library artwork/link gaps only with an exact album + artist catalog match. */
export async function completeMusicArtwork(picks, developerToken, fetcher = fetch) {
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
  const completed = []
  for (const pick of picks) {
    if (pick.image && pick.url) { completed.push(pick); continue }
    try {
      const query = new URLSearchParams({ term: `${pick.title} ${pick.source}`, types: 'albums', limit: '25' })
      const response = await fetcher(`https://api.music.apple.com/v1/catalog/us/search?${query}`, {
        headers: { Authorization: `Bearer ${developerToken}` }, signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) { completed.push(pick); continue }
      const data = await response.json()
      const match = data.results?.albums?.data?.find(item => item.attributes && normalize(item.attributes.name) === normalize(pick.title) && normalize(item.attributes.artistName) === normalize(pick.source))
      const catalog = match && musicPicks([{ ...match, type: 'library-albums' }])[0]
      completed.push({ ...pick, ...(catalog?.url ? { url: catalog.url } : {}), ...(!pick.image && catalog?.image ? { image: catalog.image } : {}) })
    } catch { completed.push(pick) }
  }
  return completed
}

export async function recentlyAddedMusic(developerToken, userToken, fetcher = fetch) {
  if (!userToken || /[\r\n]/.test(userToken)) throw new Error('Authorize Apple Music first.')
  const endpoint = 'https://api.music.apple.com/v1/me/library/recently-added'
  const resources = [], visited = new Set()
  let next = endpoint, picks = []
  // This mixed feed also includes playlists. Follow Apple's pagination until
  // there are twelve albums, while bounding work and keeping tokens on Apple.
  for (let page = 0; next && page < 10 && picks.length < 12; page++) {
    const url = new URL(next, endpoint)
    if (url.origin !== 'https://api.music.apple.com' || url.pathname !== '/v1/me/library/recently-added' || url.username || url.password || visited.has(url.href)) throw new Error('Invalid Apple Music pagination. Existing public picks were preserved.')
    visited.add(url.href)
    const response = await fetcher(url.href, {
      headers: { Authorization: `Bearer ${developerToken}`, 'Music-User-Token': userToken }, signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) throw new Error(`Apple Music returned HTTP ${response.status}. Existing public picks were preserved.`)
    const body = await response.json()
    resources.push(...(body.data ?? []))
    picks = musicPicks(resources)
    next = body.next
  }
  if (!picks.length) throw new Error('No recently added albums were returned. Existing public picks were preserved.')
  return picks
}
