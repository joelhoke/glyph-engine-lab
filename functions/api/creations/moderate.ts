/**
 * `POST /api/creations/moderate` — creations-gallery admin (feature/vibe-creations).
 *
 * Three shapes, all JSON:
 *   { password }            → login: verifies CREATIONS_ADMIN_PASSWORD (PBKDF2
 *                             record), sets the jh_creations_admin cookie.
 *   { id, action } + cookie → 'list' | 'unlist' flips the row's listed flag;
 *                             'delete' removes the row AND its R2 objects.
 * GET + cookie              → the pending (listed = 0) review queue, same card
 *                             shape as the public index.
 *
 * Auth env: CREATIONS_ADMIN_PASSWORD + PROTOTYPES_AUTH_SECRET (cookie signing,
 * shared with the prototypes gate). Missing either fails closed with 503.
 * Everything unauthorized gets the same flat 401 — no oracle on which part
 * failed. Rate-limited at the WAF alongside POST /api/creations.
 */

import {
  buildCreationHeaders,
  CREATION_DELETE_SQL,
  CREATION_KEYS_SQL,
  CREATION_SET_LISTED_SQL,
  CREATIONS_PENDING_SQL,
  isValidCreationId,
  isValidModerationAction,
} from '../../lib/creations'
import {
  hasCreationsAdminAccess,
  issueCreationsAdminCookie,
  verifyCreationsAdminPassword,
} from '../../lib/creationsAdmin'

type ModerateEnv = {
  CREATIONS_DB?: D1Database
  CREATIONS_BUCKET?: R2Bucket
  CREATIONS_ADMIN_PASSWORD?: string
  PROTOTYPES_AUTH_SECRET?: string
}

const MAX_BODY_BYTES = 4 * 1024

function json(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildCreationHeaders({ 'content-type': 'application/json; charset=utf-8', ...extraHeaders }),
  })
}

const UNAVAILABLE = { ok: false, error: 'Moderation is unavailable.' }
const UNAUTHORIZED = { ok: false, error: 'Unauthorized.' }

type PendingRow = {
  id: string
  kind: string
  thumb_key: string | null
  media_key: string | null
  created_at: number
}

function toCard(row: PendingRow) {
  return {
    id: row.id,
    kind: row.kind,
    thumbUrl: row.thumb_key ? `/api/creations/media/${encodeURIComponent(row.thumb_key)}` : null,
    mediaUrl: row.media_key ? `/api/creations/media/${encodeURIComponent(row.media_key)}` : null,
    capturedAt: row.created_at,
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) return null
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > MAX_BODY_BYTES) return null
  try {
    const body = await request.json()
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
    return body as Record<string, unknown>
  } catch {
    return null
  }
}

export const onRequestPost: PagesFunction<ModerateEnv> = async (context) => {
  const db = context.env.CREATIONS_DB
  const bucket = context.env.CREATIONS_BUCKET
  const passwordRecord = context.env.CREATIONS_ADMIN_PASSWORD
  const secret = context.env.PROTOTYPES_AUTH_SECRET
  if (!db || !bucket || !passwordRecord || !secret) return json(503, UNAVAILABLE)

  const body = await readJson(context.request)
  if (!body) return json(400, { ok: false, error: 'Expected a JSON body.' })

  // Login: password → signed cookie.
  if (typeof body.password === 'string') {
    const ok = await verifyCreationsAdminPassword(body.password, passwordRecord)
    if (!ok) return json(401, UNAUTHORIZED)
    const cookie = await issueCreationsAdminCookie(secret, Date.now())
    return json(200, { ok: true }, { 'set-cookie': cookie })
  }

  // Everything else requires the cookie.
  const authed = await hasCreationsAdminAccess(context.request, secret, Date.now())
  if (!authed) return json(401, UNAUTHORIZED)

  const { id, action } = body
  if (!isValidCreationId(id) || !isValidModerationAction(action)) {
    return json(400, { ok: false, error: 'Invalid moderation request.' })
  }

  try {
    if (action === 'delete') {
      const row = await db
        .prepare(CREATION_KEYS_SQL)
        .bind(id)
        .first<{ thumb_key: string | null; media_key: string | null; source_key: string | null }>()
      await db.prepare(CREATION_DELETE_SQL).bind(id).run()
      if (row) {
        const keys = [row.thumb_key, row.media_key, row.source_key].filter(
          (key): key is string => typeof key === 'string' && key.length > 0,
        )
        if (keys.length > 0) await bucket.delete(keys).catch(() => {})
      }
      return json(200, { ok: true })
    }
    await db
      .prepare(CREATION_SET_LISTED_SQL)
      .bind(action === 'list' ? 1 : 0, id)
      .run()
    return json(200, { ok: true })
  } catch {
    return json(503, UNAVAILABLE)
  }
}

export const onRequestGet: PagesFunction<ModerateEnv> = async (context) => {
  const db = context.env.CREATIONS_DB
  const secret = context.env.PROTOTYPES_AUTH_SECRET
  if (!db || !secret) return json(503, UNAVAILABLE)

  const authed = await hasCreationsAdminAccess(context.request, secret, Date.now())
  if (!authed) return json(401, UNAUTHORIZED)

  try {
    const result = await db.prepare(CREATIONS_PENDING_SQL).all<PendingRow>()
    return json(200, { creations: (result.results ?? []).map(toCard) })
  } catch {
    return json(503, UNAVAILABLE)
  }
}
