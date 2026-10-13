/** Local-only Xbox connection. Tokens remain in memory; never return raw account payloads.
 * Microsoft device flow: https://learn.microsoft.com/entra/identity-platform/v2-oauth2-device-code
 * Title history contract: https://github.com/OpenXbox/xbox-webapi-python/tree/master/xbox/webapi/api/provider/titlehub
 * TitleHub is not a supported public Microsoft API; access must be verified with the owner's app.
 */
const authority = 'https://login.microsoftonline.com/consumers/oauth2/v2.0'
export async function recentXboxGames({ clientId, expectedGamertag, notify = console.log,
  fetcher = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now }) {
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(clientId ?? ''))
    throw new Error('Set MICROSOFT_CLIENT_ID to your registered public-client application ID. See docs/xbox-connection.md.')
  async function request(url, options = {}, allowError = false) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(25000), redirect: 'error' })
    const data = await response.json()
    // Deliberately exclude service error bodies: they can contain account identifiers.
    if (!response.ok && !allowError) throw new Error(`Xbox connection failed at ${new URL(url).hostname} (HTTP ${response.status}). Existing collection preserved.`)
    return { ok: response.ok, data }
  }
  const form = data => ({ method: 'POST', body: new URLSearchParams(data) })
  const json = data => ({ method: 'POST', headers: { 'Content-Type': 'application/json', 'x-xbl-contract-version': '1' }, body: JSON.stringify(data) })
  const { data: device } = await request(`${authority}/devicecode`, form({ client_id: clientId, scope: 'XboxLive.signin' }))
  if (!device.device_code || !device.user_code || !Number.isFinite(device.expires_in)) throw new Error('Microsoft returned an invalid sign-in session.')
  const verification = new URL(device.verification_uri)
  if (verification.protocol !== 'https:' || !['microsoft.com', 'www.microsoft.com', 'login.live.com', 'login.microsoftonline.com'].includes(verification.hostname)) throw new Error('Unexpected Microsoft verification URL.')
  notify(`Open ${verification.href} and enter ${device.user_code}. Sign in with the Microsoft account for ${expectedGamertag}.`)
  const deadline = now() + Math.min(device.expires_in, 900) * 1000
  let interval = Math.max(5, Number(device.interval) || 5), accessToken
  while (now() < deadline) {
    await sleep(interval * 1000)
    if (now() >= deadline) break
    const result = await request(`${authority}/token`, form({ client_id: clientId, device_code: device.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }), true)
    if (result.ok && result.data.access_token) { accessToken = result.data.access_token; break }
    if (result.data.error === 'authorization_pending') continue
    if (result.data.error === 'slow_down') { interval += 5; continue }
    throw new Error('Microsoft sign-in was declined, expired, or unavailable for this app. Existing collection preserved.')
  }
  if (!accessToken) throw new Error('Microsoft sign-in expired. Run the importer again when ready.')
  const { data: user } = await request('https://user.auth.xboxlive.com/user/authenticate', json({
    RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT',
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${accessToken}` },
  }))
  if (!user.Token) throw new Error('Xbox did not issue a user token.')
  const { data: xsts } = await request('https://xsts.auth.xboxlive.com/xsts/authorize', json({
    RelyingParty: 'http://xboxlive.com', TokenType: 'JWT', Properties: { SandboxId: 'RETAIL', UserTokens: [user.Token] },
  }))
  const identity = xsts.DisplayClaims?.xui?.[0]
  if (!xsts.Token || !identity?.uhs || !/^\d+$/.test(identity?.xid ?? '')) throw new Error('Xbox did not return a usable profile identity.')
  const headers = { Authorization: `XBL3.0 x=${identity.uhs};${xsts.Token}`, 'x-xbl-contract-version': '2', 'Accept-Language': 'en-US' }
  const { data: profile } = await request(`https://profile.xboxlive.com/users/xuid(${identity.xid})/profile/settings?settings=Gamertag`, { headers })
  const gamertag = profile.profileUsers?.[0]?.settings?.find(setting => setting.id === 'Gamertag')?.value
  if (gamertag?.toLowerCase() !== expectedGamertag.toLowerCase()) throw new Error('This Microsoft account does not match the configured Xbox gamertag. Nothing was imported.')
  const { data: history } = await request(`https://titlehub.xboxlive.com/users/xuid(${identity.xid})/titles/titlehistory/decoration/image?maxItems=50`, { headers })
  return selectRecentGames(history)
}

/** Filter hidden entries and apps; exact play times/account IDs never leave this function. */
export function selectRecentGames(history) {
  if (!Array.isArray(history?.titles)) throw new Error('Xbox returned no readable title history. Existing collection preserved.')
  const seen = new Set()
  return history.titles.filter(item => item.type === 'Game' && item.titleHistory?.visible !== false
    && /^\d+$/.test(String(item.titleId)) && typeof item.name === 'string' && item.name.trim()
    && Number.isFinite(Date.parse(item.titleHistory?.lastTimePlayed)))
    .sort((a, b) => Date.parse(b.titleHistory.lastTimePlayed) - Date.parse(a.titleHistory.lastTimePlayed))
    .filter(item => !seen.has(String(item.titleId)) && seen.add(String(item.titleId)))
    .slice(0, 12).map(item => ({ id: `xbox-${item.titleId}`, title: item.name.trim(), source: 'Xbox', artwork: safeArtwork(item.displayImage), artworks: xboxCoverCandidates(item) }))
}
export function safeArtwork(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ['images-eds-ssl.xboxlive.com', 'store-images.s-microsoft.com', 'store-images.microsoft.com'].includes(url.hostname) ? url.href : null
  } catch { return null }
}

/** Prefer portrait store art over square dashboard tiles and landscape screenshots. */
export function xboxCoverCandidates(item) {
  const types = ['poster', 'boxart', 'titledheroart']
  const images = (item.images ?? []).filter(image => types.includes(String(image.type).toLowerCase()))
    .sort((a, b) => types.indexOf(a.type.toLowerCase()) - types.indexOf(b.type.toLowerCase()))
  return [...new Set([...images.map(image => safeArtwork(image.url)), safeArtwork(item.displayImage)].filter(Boolean))]
}
