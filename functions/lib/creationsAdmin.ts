/**
 * Creations-gallery admin access (feature/vibe-creations).
 *
 * Reuses the prototype auth primitives (functions/lib/prototypeAuth.ts):
 * the PBKDF2 password record lives in the CREATIONS_ADMIN_PASSWORD env var
 * (dashboard-managed; .dev.vars locally — generate with
 * scripts/prototype-password.mjs), and a successful login issues an
 * HMAC-SHA256 signed cookie carrying only an expiry. The signing secret is
 * the shared PROTOTYPES_AUTH_SECRET; the "creations-admin" domain prefix
 * keeps these cookies non-interchangeable with any prototype grant.
 *
 * Cookie format: jh_creations_admin = base64url("v1.<expMs>").<sig>
 * where sig = base64url(HMAC-SHA256(secret, "creations-admin.<payload>")).
 */

import { verifyPrototypePassword } from './prototypeAuth'

const COOKIE_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days
const DOMAIN = 'creations-admin'

export const CREATIONS_ADMIN_COOKIE = 'jh_creations_admin'

// --- base64url helpers (self-contained, same codec as prototypeAuth) ---------

function bytesToB64u(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64uToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

async function signPayload(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return bytesToB64u(signature)
}

/** Verify a plaintext password against the CREATIONS_ADMIN_PASSWORD record. */
export async function verifyCreationsAdminPassword(
  password: string,
  record: string,
): Promise<boolean> {
  return verifyPrototypePassword(password, record)
}

/** Build the Set-Cookie value granting creations-admin access (post-login). */
export async function issueCreationsAdminCookie(
  secret: string,
  nowMs: number,
): Promise<string> {
  const payload = `v1.${nowMs + COOKIE_TTL_MS}`
  const signature = await signPayload(secret, `${DOMAIN}.${payload}`)
  return (
    `${CREATIONS_ADMIN_COOKIE}=${bytesToB64u(new TextEncoder().encode(payload))}.${signature}; ` +
    `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(COOKIE_TTL_MS / 1000)}`
  )
}

/**
 * Check a request's Cookie header for a valid admin grant: well-formed
 * payload, valid signature, unexpired. Any anomaly fails closed.
 */
export async function hasCreationsAdminAccess(
  request: Request,
  secret: string,
  nowMs: number,
): Promise<boolean> {
  const header = request.headers.get('Cookie') ?? ''
  const prefix = `${CREATIONS_ADMIN_COOKIE}=`
  const raw = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  if (!raw) return false
  const value = raw.slice(prefix.length)
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return false
  const payloadB64 = value.slice(0, dot)
  const signature = value.slice(dot + 1)
  let payload: string
  try {
    payload = new TextDecoder().decode(b64uToBytes(payloadB64))
  } catch {
    return false
  }
  const match = payload.match(/^v1\.(\d+)$/)
  if (!match) return false
  if (Number(match[1]) <= nowMs) return false
  const expected = await signPayload(secret, `${DOMAIN}.${payload}`)
  return timingSafeEqual(
    new TextEncoder().encode(signature),
    new TextEncoder().encode(expected),
  )
}
