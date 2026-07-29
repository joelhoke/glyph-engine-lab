/**
 * Access gate for every /api/protected/* request (Stage 4b).
 *
 * Cloudflare Access sits in front of these routes and enforces the email
 * allowlist with one-time PIN authentication; this middleware is the second
 * validation layer: the request must carry a valid Access JWT (RS256 against
 * the team's JWKS, unexpired, correct audience) before any R2 object is
 * touched. Missing configuration fails closed with 503 — never silent allow.
 */

import {
  AccessJwks,
  extractAccessToken,
  fetchAccessJwks,
  protectedJson,
  verifyAccessJwt,
} from '../../lib/protectedShared'

type ProtectedEnv = {
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  PROTECTED_BUCKET: R2Bucket
}

// Per-isolate JWKS cache: certs rotate rarely; a refresh on unknown-kid keeps
// verification correct across rotations without per-request fetches.
let cachedJwks: { teamDomain: string; jwks: AccessJwks } | null = null

async function resolveJwks(teamDomain: string, refresh: boolean): Promise<AccessJwks> {
  if (!cachedJwks || cachedJwks.teamDomain !== teamDomain || refresh) {
    cachedJwks = { teamDomain, jwks: await fetchAccessJwks(teamDomain) }
  }
  return cachedJwks.jwks
}

export const onRequest: PagesFunction<ProtectedEnv> = async (context) => {
  const { ACCESS_TEAM_DOMAIN, ACCESS_AUD } = context.env
  if (!ACCESS_TEAM_DOMAIN || !ACCESS_AUD) {
    return protectedJson({ error: 'protected access is not configured' }, 503)
  }

  const token = extractAccessToken(context.request)
  if (!token) {
    return protectedJson({ error: 'authentication required' }, 401)
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  for (const refresh of [false, true]) {
    let jwks: AccessJwks
    try {
      jwks = await resolveJwks(ACCESS_TEAM_DOMAIN, refresh)
    } catch {
      return protectedJson({ error: 'could not validate the session' }, 503)
    }
    const result = await verifyAccessJwt(token, { jwks, aud: ACCESS_AUD, nowSeconds })
    if (result.ok) return context.next()
    // A stale cache is the only recoverable failure — retry once with a
    // fresh JWKS; everything else is a hard 401.
    if (result.reason !== 'unknown signing key' || refresh) {
      return protectedJson({ error: 'authentication required' }, 401)
    }
  }
  return protectedJson({ error: 'authentication required' }, 401)
}
