/** Shared, atomic per-IP limits for public writes and password attempts.
 * Cloudflare supplies CF-Connecting-IP; never trust X-Forwarded-For here.
 * HMAC keys change each window and do not store the IP itself.
 */
export type ProtectionEnv = {
  CREATIONS_DB?: D1Database
  PROTOTYPES_AUTH_SECRET?: string
}

type Rule = { name: string; limit: number; bytes: number }
const KIB = 1024
const WINDOW_SECONDS = 600

export function mutationRule(path: string): Rule | null {
  const normalized = path.replace(/\/+$/, '')
  if (normalized === '/api/feedback') return { name: 'feedback', limit: 5, bytes: 16 * KIB }
  if (normalized === '/api/collaborate') return { name: 'chat', limit: 30, bytes: 16 * KIB }
  if (normalized === '/api/collaborate/share') return { name: 'share', limit: 5, bytes: 128 * KIB }
  // Allow the existing two-second autosave cadence, while bounding abusive writes.
  if (normalized === '/api/creations') return { name: 'creations', limit: 300, bytes: 33 * KIB * KIB }
  if (normalized === '/api/creations/moderate') return { name: 'moderate', limit: 10, bytes: 4 * KIB }
  if (/^\/p\/[^/]+\/_unlock$/.test(normalized)) return { name: 'unlock', limit: 5, bytes: 4 * KIB }
  return null
}

export const TAKE_REQUEST_SQL = `
  INSERT INTO request_limits (key, requests, expires_at) VALUES (?1, 1, ?2)
  ON CONFLICT(key) DO UPDATE SET requests = requests + 1
  WHERE requests < ?3
  RETURNING requests
`
export const CLEAN_LIMITS_SQL = `DELETE FROM request_limits WHERE key IN
  (SELECT key FROM request_limits WHERE expires_at < ?1 ORDER BY expires_at LIMIT 500)`

function reject(status: number, message: string, retry?: number) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(retry ? { 'Retry-After': String(retry) } : {}),
    },
  })
}

async function requestKey(secret: string, identity: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const hash = await crypto.subtle.sign('HMAC', key, encoder.encode(identity))
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Reads the actual bytes too: Content-Length is only an early rejection. */
async function boundedBody(request: Request, max: number): Promise<Uint8Array | null> {
  if (Number(request.headers.get('Content-Length')) > max) return null
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > max) { await reader.cancel(); return null }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
  return body
}

export async function protectMutation(
  context: PagesEventContext<ProtectionEnv>,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<Response> {
  const request = context.request
  const url = new URL(request.url)
  const rule = request.method === 'POST' ? mutationRule(url.pathname) : null
  if (!rule) return context.next()
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  const origin = request.headers.get('Origin')
  const devProxyOrigin = local && origin && ['http://localhost:3000', 'http://127.0.0.1:3000'].includes(origin)
  if ((origin && origin !== url.origin && !devProxyOrigin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return reject(403, 'Submit this request from the site.')
  }
  const ip = request.headers.get('CF-Connecting-IP') || (local ? 'local-preview' : '')
  const secret = context.env.PROTOTYPES_AUTH_SECRET || (local ? 'local-preview-only' : '')
  const db = context.env.CREATIONS_DB
  if (!ip || !secret || !db) return reject(503, 'Please try again later.')
  const window = Math.floor(nowSeconds / WINDOW_SECONDS)
  const expires = (window + 1) * WINDOW_SECONDS
  try {
    const key = await requestKey(secret, `${rule.name}:${window}:${ip}`)
    const accepted = await db.prepare(TAKE_REQUEST_SQL).bind(key, expires, rule.limit).first<{ requests: number }>()
    if (!accepted) return reject(429, 'Too many requests. Please try again shortly.', expires - nowSeconds)
    // Indexed bounded cleanup on writes, including low-traffic deployments.
    context.waitUntil(db.prepare(CLEAN_LIMITS_SQL).bind(nowSeconds).run().catch(() => undefined))
    const body = await boundedBody(request, rule.bytes)
    if (!body) return reject(413, 'This submission is too large.')
    return context.next(new Request(request, { body }))
  } catch {
    // Missing schema, storage outages and malformed bodies never bypass limits.
    return reject(503, 'Please try again later.')
  }
}
