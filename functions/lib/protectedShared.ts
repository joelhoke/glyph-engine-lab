/**
 * Shared, side-effect-free logic for the protected Pages Functions
 * (Stage 4b): ID validation, HTTP Range parsing, MIME allowlisting, security
 * headers, and the Cloudflare Access JWT verification core.
 *
 * Everything here is injectable (clock, crypto, JWKS) so the module runs
 * identically in the Workers runtime and under Node for
 * scripts/verify-protected-api.js. WebCrypto (`crypto.subtle`) exists in
 * both, so no dependency is needed.
 */

// --- Protected IDs -----------------------------------------------------------

/**
 * Opaque protected IDs: lowercase slug, no separators that could traverse a
 * key space. Applied to story IDs and media IDs BEFORE any R2 access.
 */
export const PROTECTED_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

export function isValidProtectedId(id: unknown): id is string {
  return typeof id === 'string' && PROTECTED_ID_PATTERN.test(id)
}

// --- HTTP Range --------------------------------------------------------------

export type RangeResult =
  | { kind: 'none' }
  | { kind: 'range'; start: number; end: number }
  | { kind: 'unsatisfiable' }

/**
 * Parse a single `Range: bytes=…` header against an object size. Multiple
 * ranges, malformed syntax, and out-of-bounds starts are unsatisfiable
 * (answer 416). Suffix ranges (`bytes=-500`) resolve against the size.
 */
export function parseRangeHeader(header: string | null, size: number): RangeResult {
  if (header === null || header.trim() === '') return { kind: 'none' }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return { kind: 'unsatisfiable' }
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return { kind: 'unsatisfiable' }

  if (rawStart === '') {
    // Suffix range: last N bytes.
    const suffix = Number(rawEnd)
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { kind: 'unsatisfiable' }
    const start = Math.max(0, size - suffix)
    return size === 0 ? { kind: 'unsatisfiable' } : { kind: 'range', start, end: size - 1 }
  }

  const start = Number(rawStart)
  if (!Number.isSafeInteger(start) || start >= size) return { kind: 'unsatisfiable' }
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  if (!Number.isSafeInteger(end) || end < start) return { kind: 'unsatisfiable' }
  return { kind: 'range', start, end }
}

// --- MIME allowlist ----------------------------------------------------------

/** Only these types may leave the confidential bucket. */
export const ALLOWED_PROTECTED_MIME = new Set([
  'image/avif',
  'image/webp',
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'text/vtt',
])

export function isAllowedProtectedMime(mime: unknown): mime is string {
  return typeof mime === 'string' && ALLOWED_PROTECTED_MIME.has(mime.toLowerCase().split(';')[0].trim())
}

// --- Security headers --------------------------------------------------------

/**
 * Every protected response is private, uncached, and locked down. JSON
 * responses additionally carry a deny-all CSP; binary media needs no CSP.
 */
export function buildProtectedHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extra,
  }
}

export function protectedJson(
  body: unknown,
  status: number,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildProtectedHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'",
      ...extra,
    }),
  })
}

// --- Cloudflare Access JWT ---------------------------------------------------

export type AccessJwks = {
  keys: { kid: string; kty: string; alg?: string; use?: string; n: string; e: string }[]
}

export type AccessJwtPayload = {
  aud?: string | string[]
  exp?: number
  email?: string
  sub?: string
  [key: string]: unknown
}

export type VerifyAccessJwtResult =
  | { ok: true; payload: AccessJwtPayload }
  | { ok: false; reason: string }

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlToText(input: string): string {
  return new TextDecoder().decode(base64UrlToBytes(input))
}

/**
 * Verify a Cloudflare Access JWT: RS256 signature against the team's JWKS,
 * then `exp` and `aud`. Fail closed on every anomaly. `nowSeconds` and the
 * JWKS are injected so this is deterministic under test.
 */
export async function verifyAccessJwt(
  token: string,
  options: { jwks: AccessJwks; aud: string; nowSeconds: number },
): Promise<VerifyAccessJwtResult> {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' }
  const [headerB64, payloadB64, signatureB64] = parts

  let header: { alg?: string; kid?: string }
  let payload: AccessJwtPayload
  try {
    header = JSON.parse(base64UrlToText(headerB64))
    payload = JSON.parse(base64UrlToText(payloadB64))
  } catch {
    return { ok: false, reason: 'undecodable token' }
  }

  if (header.alg !== 'RS256') return { ok: false, reason: 'unexpected algorithm' }
  const jwk = options.jwks.keys.find((key) => key.kid === header.kid)
  if (!jwk) return { ok: false, reason: 'unknown signing key' }

  let valid: boolean
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(signatureB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    )
  } catch {
    return { ok: false, reason: 'signature check failed' }
  }
  if (!valid) return { ok: false, reason: 'bad signature' }

  if (typeof payload.exp !== 'number' || payload.exp <= options.nowSeconds) {
    return { ok: false, reason: 'token expired' }
  }
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!aud.includes(options.aud)) return { ok: false, reason: 'wrong audience' }

  return { ok: true, payload }
}

/** Extract the Access assertion: cookie first, header second. */
export function extractAccessToken(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? ''
  for (const entry of cookie.split(';')) {
    const [name, ...rest] = entry.trim().split('=')
    if (name === 'CF_Authorization') {
      const value = rest.join('=').trim()
      return value.length > 0 ? value : null
    }
  }
  return request.headers.get('Cf-Access-Jwt-Assertion')
}

/** Fetch the team's Access JWKS (cached per isolate by the caller). */
export async function fetchAccessJwks(teamDomain: string): Promise<AccessJwks> {
  const response = await fetch(
    `https://${teamDomain}/cdn-cgi/access/certs`,
    { cf: { cacheTtl: 300, cacheEverything: true } } as RequestInit,
  )
  if (!response.ok) throw new Error(`certs fetch failed: ${response.status}`)
  const body = (await response.json()) as { keys?: AccessJwks['keys'] }
  return { keys: Array.isArray(body.keys) ? body.keys : [] }
}
