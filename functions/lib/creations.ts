// =============================================================================
// Vibe creations gallery — storage core (pure, Node-testable).
//
// Visitors can save a playground composition: the serialized memento state and
// a config hash land in the CREATIONS_DB D1 database (jh-creations), binary
// media (thumbnail, clip video, user-uploaded source image) lands in the
// CREATIONS_BUCKET R2 bucket under thumb/, media/, and source/ prefixes. Rows
// are inserted listed = 0 (held for review) and promoted manually. A global
// FIFO cap of CREATIONS_CAP rows is enforced on writes — the route deletes the
// evicted rows' R2 objects from the key list returned here.
//
// Everything below is side-effect-free and injectable (clock), so the module
// runs identically in the Workers runtime and under Node for
// scripts/verify-creations-api.js.
// =============================================================================

export const CREATIONS_CAP = 100
export const MAX_STATE_BYTES = 512 * 1024
export const MAX_THUMB_BYTES = 1 * 1024 * 1024
export const MAX_MEDIA_BYTES = 25 * 1024 * 1024
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024

export const CREATION_KINDS = ['auto', 'image', 'clip'] as const
export type CreationKind = (typeof CREATION_KINDS)[number]

// --- MIME allowlists (upload type → R2 key extension) -------------------------

export const THUMB_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const MEDIA_MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

export const SOURCE_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
}

/** Reverse map used by the media route: key extension → Content-Type. */
export const MEDIA_KEY_EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

// --- ID and key validation -----------------------------------------------------

/** Creation IDs are random UUIDs (crypto.randomUUID). */
export const CREATION_ID_PATTERN = /^[a-f0-9-]{36}$/

export function isValidCreationId(id: unknown): id is string {
  return typeof id === 'string' && CREATION_ID_PATTERN.test(id)
}

/**
 * Media keys look like `thumb/<id>.<ext>` (also media/, source/). Validated
 * segment by segment — `..` and dotfile segments are rejected outright and the
 * lowercase pattern excludes uppercase — so a crafted key can never escape the
 * bucket's key prefixes (mirrors prototypesManifest.ts).
 */
export const MEDIA_KEY_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/
export const MEDIA_KEY_PREFIXES = ['thumb', 'media', 'source'] as const

export function isValidMediaKey(key: unknown): key is string {
  if (typeof key !== 'string') return false
  const segments = key.split('/')
  if (segments.length !== 2) return false
  if (!MEDIA_KEY_PREFIXES.includes(segments[0] as (typeof MEDIA_KEY_PREFIXES)[number])) return false
  return segments.every((segment) => !segment.includes('..') && MEDIA_KEY_SEGMENT_PATTERN.test(segment))
}

// --- Payload validation ---------------------------------------------------------

export const CONFIG_HASH_PATTERN = /^[a-f0-9]{64}$/

export type CreationPayloadInput = {
  state: unknown
  configHash: unknown
  kind: unknown
  /** Whether a clip media file accompanied the payload (multipart field `media`). */
  hasMedia?: boolean
}

export function validateCreationPayload(
  input: CreationPayloadInput,
): { ok: true } | { ok: false; error: string } {
  const { state, configHash, kind } = input

  if (typeof kind !== 'string' || !CREATION_KINDS.includes(kind as CreationKind))
    return { ok: false, error: 'Unknown creation kind.' }

  if (typeof state !== 'string' || state.length === 0) return { ok: false, error: 'Missing state.' }
  if (new TextEncoder().encode(state).length > MAX_STATE_BYTES) return { ok: false, error: 'State too large.' }
  let parsed: unknown
  try {
    parsed = JSON.parse(state)
  } catch {
    return { ok: false, error: 'State is not valid JSON.' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return { ok: false, error: 'State must be a JSON object.' }
  if ((parsed as Record<string, unknown>).version !== 1) return { ok: false, error: 'Unsupported state version.' }

  if (typeof configHash !== 'string' || !CONFIG_HASH_PATTERN.test(configHash))
    return { ok: false, error: 'Invalid config hash.' }

  const hasMedia = input.hasMedia === true
  if (kind === 'clip' && !hasMedia) return { ok: false, error: 'Clip creations require a media file.' }
  if (kind !== 'clip' && hasMedia) return { ok: false, error: 'A media file is only allowed for clip creations.' }

  return { ok: true }
}

/** Validate one uploaded file's declared size and MIME against an allowlist. */
export function validateUploadMeta(
  meta: { size: number; type: string },
  allowlist: Record<string, string>,
  maxBytes: number,
  label: string,
): { ok: true; ext: string } | { ok: false; error: string } {
  const mime = meta.type.toLowerCase().split(';')[0].trim()
  const ext = allowlist[mime]
  if (!ext) return { ok: false, error: `Unsupported ${label} type.` }
  if (!Number.isFinite(meta.size) || meta.size <= 0 || meta.size > maxBytes)
    return { ok: false, error: `${label} is too large.` }
  return { ok: true, ext }
}

// --- SQL ------------------------------------------------------------------------

export const CREATION_SELECT_BY_HASH_SQL = 'SELECT id FROM creations WHERE config_hash = ? LIMIT 1'

export const CREATION_INSERT_SQL =
  'INSERT INTO creations (id, kind, state, config_hash, thumb_key, media_key, source_key, listed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)'

export const CREATION_EVICT_SELECT_SQL = `SELECT thumb_key, media_key, source_key FROM creations WHERE id NOT IN (SELECT id FROM creations ORDER BY created_at DESC LIMIT ${CREATIONS_CAP})`

export const CREATION_EVICT_DELETE_SQL = `DELETE FROM creations WHERE id NOT IN (SELECT id FROM creations ORDER BY created_at DESC LIMIT ${CREATIONS_CAP})`

export const CREATIONS_LIST_SQL =
  'SELECT id, kind, thumb_key, media_key, created_at FROM creations WHERE listed = 1 ORDER BY created_at DESC LIMIT 100'

export const CREATION_STATE_SQL = 'SELECT state FROM creations WHERE id = ? AND listed = 1'

// --- Moderation (admin-only, see functions/api/creations/moderate.ts) ----------

export const MODERATION_ACTIONS = ['list', 'unlist', 'delete'] as const
export type ModerationAction = (typeof MODERATION_ACTIONS)[number]

export function isValidModerationAction(action: unknown): action is ModerationAction {
  return typeof action === 'string' && MODERATION_ACTIONS.includes(action as ModerationAction)
}

export const CREATIONS_PENDING_SQL =
  'SELECT id, kind, thumb_key, media_key, created_at FROM creations WHERE listed = 0 ORDER BY created_at DESC LIMIT 100'

export const CREATION_SET_LISTED_SQL = 'UPDATE creations SET listed = ? WHERE id = ?'

export const CREATION_KEYS_SQL =
  'SELECT thumb_key, media_key, source_key FROM creations WHERE id = ?'

export const CREATION_DELETE_SQL = 'DELETE FROM creations WHERE id = ?'

// --- D1 flow ----------------------------------------------------------------------

export type CreationInsert = {
  id: string
  kind: CreationKind
  state: string
  configHash: string
  thumbKey: string | null
  mediaKey: string | null
  sourceKey: string | null
}

export type CreationInsertResult =
  | { ok: true; duplicate: true }
  | { ok: true; duplicate: false; evictedKeys: string[] }
  | { ok: false; error: string }

type EvictionRow = { thumb_key: string | null; media_key: string | null; source_key: string | null }

/**
 * Dedup → insert (listed = 0) → FIFO eviction. Returns the evicted rows' media
 * keys so the caller can delete the orphaned R2 objects. The R2 upload itself
 * stays in the route — this function touches only D1.
 */
export async function insertCreation(
  db: D1Database,
  creation: CreationInsert,
  nowSeconds: number,
): Promise<CreationInsertResult> {
  try {
    const existing = await db
      .prepare(CREATION_SELECT_BY_HASH_SQL)
      .bind(creation.configHash)
      .first<{ id: string }>()
    if (existing) return { ok: true, duplicate: true }

    await db
      .prepare(CREATION_INSERT_SQL)
      .bind(
        creation.id,
        creation.kind,
        creation.state,
        creation.configHash,
        creation.thumbKey,
        creation.mediaKey,
        creation.sourceKey,
        nowSeconds,
      )
      .run()

    const evicted = await db.prepare(CREATION_EVICT_SELECT_SQL).all<EvictionRow>()
    const evictedKeys: string[] = []
    for (const row of evicted.results ?? []) {
      for (const key of [row.thumb_key, row.media_key, row.source_key]) {
        if (typeof key === 'string' && key) evictedKeys.push(key)
      }
    }
    if (evicted.results && evicted.results.length > 0) {
      await db.prepare(CREATION_EVICT_DELETE_SQL).run()
    }
    return { ok: true, duplicate: false, evictedKeys }
  } catch {
    return { ok: false, error: 'Creations storage is unavailable.' }
  }
}

// --- Headers -----------------------------------------------------------------------

/** Every JSON response from the creations API is uncached and locked down. */
export function buildCreationHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra,
  }
}
