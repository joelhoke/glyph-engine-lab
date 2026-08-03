/**
 * Shared, side-effect-free logic for the feedback Pages Function
 * (`functions/api/feedback/index.ts`): payload validation, retention math,
 * and the request-handling core against an injected D1 database.
 *
 * Everything injectable (clock, id generator, database) so the module runs
 * identically in the Workers runtime and under Node for
 * scripts/verify-feedback.js.
 *
 * Privacy contract: only the message and an optional reply email are stored.
 * Never the IP, user agent, glyph text, analytics IDs, or page content.
 * Timestamps are Unix SECONDS (documented in migrations/ and
 * docs/deployment.md).
 */

export const FEEDBACK_MESSAGE_MIN = 10
export const FEEDBACK_MESSAGE_MAX = 2000
export const FEEDBACK_EMAIL_MAX = 254

/** Retention: 180 days, expressed in seconds. */
export const FEEDBACK_RETENTION_DAYS = 180
export const FEEDBACK_RETENTION_SECONDS = FEEDBACK_RETENTION_DAYS * 24 * 60 * 60

/**
 * Pragmatic email check — not RFC-complete, just enough to catch typos:
 * a non-empty local part, one `@`, a dotted domain, no whitespace.
 */
export const FEEDBACK_EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/

export type FeedbackValidation =
  | { kind: 'ok'; message: string; email: string | null }
  | { kind: 'honeypot' }
  | { kind: 'invalid'; reason: string }

/**
 * Validate a decoded JSON body (`{ message, email?, company? }`).
 * A non-empty `company` honeypot means a bot — the caller reports success
 * WITHOUT storing. Never echo submitted text in the failure reason.
 */
export function validateFeedbackPayload(body: unknown): FeedbackValidation {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { kind: 'invalid', reason: 'body must be a JSON object' }
  }
  const payload = body as { message?: unknown; email?: unknown; company?: unknown }

  if (typeof payload.company === 'string' && payload.company.trim() !== '') {
    return { kind: 'honeypot' }
  }

  if (typeof payload.message !== 'string') {
    return { kind: 'invalid', reason: 'message must be a string' }
  }
  const message = payload.message.trim()
  if (message.length < FEEDBACK_MESSAGE_MIN || message.length > FEEDBACK_MESSAGE_MAX) {
    return { kind: 'invalid', reason: 'message length out of range' }
  }

  let email: string | null = null
  if (typeof payload.email === 'string') {
    const trimmed = payload.email.trim()
    if (trimmed !== '') {
      if (trimmed.length > FEEDBACK_EMAIL_MAX || !FEEDBACK_EMAIL_PATTERN.test(trimmed)) {
        return { kind: 'invalid', reason: 'email format invalid' }
      }
      email = trimmed
    }
  }

  return { kind: 'ok', message, email }
}

/** Retention window for a new row, in Unix seconds: exactly 180 days apart. */
export function retentionWindow(nowSeconds: number): { createdAt: number; expiresAt: number } {
  const createdAt = Math.floor(nowSeconds)
  return { createdAt, expiresAt: createdAt + FEEDBACK_RETENTION_SECONDS }
}

export const FEEDBACK_INSERT_SQL =
  'INSERT INTO feedback (id, message, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
export const FEEDBACK_DELETE_EXPIRED_SQL = 'DELETE FROM feedback WHERE expires_at < ?'

function feedbackJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export type FeedbackHandlerDeps = {
  nowSeconds?: number
  randomId?: () => string
}

/**
 * `POST /api/feedback` core. Statuses:
 * - 201 `{ "ok": true }` on store, and on honeypot hits (without storing)
 * - 400 invalid JSON or invalid fields
 * - 415 non-JSON content type
 * - 503 storage binding missing or D1 failure (fail closed, never fake success)
 * No error response echoes submitted text.
 */
export async function handleFeedbackRequest(
  request: Request,
  db: D1Database | undefined,
  deps: FeedbackHandlerDeps = {},
): Promise<Response> {
  const contentType = request.headers.get('Content-Type') ?? ''
  if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return feedbackJson({ ok: false, error: 'unsupported media type' }, 415)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return feedbackJson({ ok: false, error: 'invalid JSON body' }, 400)
  }

  const validation = validateFeedbackPayload(body)
  if (validation.kind === 'honeypot') {
    // Bot trap: pretend it worked, store nothing.
    return feedbackJson({ ok: true }, 201)
  }
  if (validation.kind === 'invalid') {
    return feedbackJson({ ok: false, error: validation.reason }, 400)
  }

  if (!db) {
    return feedbackJson({ ok: false, error: 'storage unavailable' }, 503)
  }

  const nowSeconds = deps.nowSeconds ?? Math.floor(Date.now() / 1000)
  const randomId = deps.randomId ?? (() => crypto.randomUUID())
  const { createdAt, expiresAt } = retentionWindow(nowSeconds)

  try {
    await db
      .prepare(FEEDBACK_INSERT_SQL)
      .bind(randomId(), validation.message, validation.email, createdAt, expiresAt)
      .run()
    // Opportunistic cleanup of expired rows; a cleanup failure must not
    // fail an otherwise-successful submission.
    try {
      await db.prepare(FEEDBACK_DELETE_EXPIRED_SQL).bind(nowSeconds).run()
    } catch {
      /* best effort */
    }
  } catch {
    return feedbackJson({ ok: false, error: 'storage unavailable' }, 503)
  }

  return feedbackJson({ ok: true }, 201)
}
