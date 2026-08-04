// =============================================================================
// Collaborate AI guide — transcript sharing (pure, Node-testable).
//
// Conversations are client-side and ephemeral by default. A transcript reaches
// the server ONLY after the visitor explicitly checks “Share this conversation
// with Joel” and submits. Shares land in a separate COLLABORATE_DB D1 database
// with a 180-day retention: a daily scheduled cleanup Worker deletes expired
// rows, and writes also delete expired rows opportunistically. The visitor
// gets a random receipt ID they can quote for early deletion.
//
// The optional reply email is stored for Joel's follow-up only — it is never
// sent to any model.
// =============================================================================

export const SHARE_RETENTION_DAYS = 180
export const SHARE_RETENTION_SECONDS = SHARE_RETENTION_DAYS * 24 * 60 * 60
export const SHARE_EMAIL_MAX = 254
export const SHARE_MAX_MESSAGES = 26 // 12 visitor turns + answers + headroom
export const SHARE_MESSAGE_MAX_CHARS = 4000 // answers are server-generated; visitor messages already bounded client-side
export const SHARE_CONSENT_VERSIONS = ['v1'] as const

export const SHARE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ShareMessage = { role: 'user' | 'assistant'; content: string }

export type SharePayload = {
  messages: ShareMessage[]
  consentVersion: string
  replyEmail?: string
  modelRoute?: { modelClass?: string; profileVersion?: string }
}

export function validateSharePayload(raw: unknown): { ok: true; payload: SharePayload } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Expected a JSON object.' }
  const body = raw as Record<string, unknown>

  if (!Array.isArray(body.messages) || body.messages.length === 0)
    return { ok: false, error: 'messages must be a non-empty array.' }
  if (body.messages.length > SHARE_MAX_MESSAGES) return { ok: false, error: 'Transcript too long.' }
  const messages: ShareMessage[] = []
  for (const m of body.messages) {
    if (typeof m !== 'object' || m === null) return { ok: false, error: 'Malformed message.' }
    const msg = m as Record<string, unknown>
    if (msg.role !== 'user' && msg.role !== 'assistant') return { ok: false, error: 'Unknown message role.' }
    if (typeof msg.content !== 'string' || !msg.content.trim() || msg.content.length > SHARE_MESSAGE_MAX_CHARS)
      return { ok: false, error: 'Invalid message content.' }
    messages.push({ role: msg.role, content: msg.content })
  }

  if (typeof body.consentVersion !== 'string' || !SHARE_CONSENT_VERSIONS.includes(body.consentVersion as any))
    return { ok: false, error: 'Unknown consent version.' }

  let replyEmail: string | undefined
  if (body.replyEmail !== undefined) {
    if (typeof body.replyEmail !== 'string' || body.replyEmail.length > SHARE_EMAIL_MAX)
      return { ok: false, error: 'Invalid reply email.' }
    const trimmed = body.replyEmail.trim()
    if (trimmed && !SHARE_EMAIL_PATTERN.test(trimmed)) return { ok: false, error: 'Invalid reply email.' }
    replyEmail = trimmed || undefined
  }

  let modelRoute: SharePayload['modelRoute']
  if (body.modelRoute !== undefined) {
    if (typeof body.modelRoute !== 'object' || body.modelRoute === null)
      return { ok: false, error: 'Invalid modelRoute.' }
    const mr = body.modelRoute as Record<string, unknown>
    modelRoute = {
      modelClass: typeof mr.modelClass === 'string' ? mr.modelClass.slice(0, 128) : undefined,
      profileVersion: typeof mr.profileVersion === 'string' ? mr.profileVersion.slice(0, 64) : undefined,
    }
  }

  return {
    ok: true,
    payload: { messages, consentVersion: body.consentVersion, ...(replyEmail ? { replyEmail } : {}), ...(modelRoute ? { modelRoute } : {}) },
  }
}

export const SHARE_INSERT_SQL =
  'INSERT INTO collaborate_shares (id, transcript, email, consent_version, model_route, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'

export const SHARE_DELETE_EXPIRED_SQL = 'DELETE FROM collaborate_shares WHERE expires_at < ?'

export type ShareHandlerDeps = {
  nowSeconds: () => number
  randomId: () => string
}

export async function handleShareRequest(
  request: Request,
  db: D1Database | undefined,
  deps: ShareHandlerDeps,
): Promise<Response> {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    })

  if (!db) return json(503, { ok: false, error: 'Sharing is unavailable.' })

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json'))
    return json(415, { ok: false, error: 'Expected application/json.' })

  let raw: unknown
  try {
    const text = await request.text()
    if (text.length > 64 * 1024) return json(400, { ok: false, error: 'Payload too large.' })
    raw = JSON.parse(text)
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON.' })
  }

  const validated = validateSharePayload(raw)
  if (validated.ok === false) return json(400, { ok: false, error: validated.error })

  const now = deps.nowSeconds()
  const receiptId = deps.randomId()
  const { payload } = validated

  try {
    await db
      .prepare(SHARE_INSERT_SQL)
      .bind(
        receiptId,
        JSON.stringify(payload.messages),
        payload.replyEmail ?? null,
        payload.consentVersion,
        payload.modelRoute ? JSON.stringify(payload.modelRoute) : null,
        now,
        now + SHARE_RETENTION_SECONDS,
      )
      .run()
    // Opportunistic retention sweep on writes (the daily cleanup Worker is the
    // authoritative sweep — see workers/collaborate-cleanup).
    await db.prepare(SHARE_DELETE_EXPIRED_SQL).bind(now).run()
  } catch {
    return json(503, { ok: false, error: 'Sharing is unavailable.' })
  }

  return json(201, { ok: true, receiptId, expiresInDays: SHARE_RETENTION_DAYS })
}
