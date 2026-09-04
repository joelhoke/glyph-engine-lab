/**
 * `POST /api/creations` — store a visitor's playground composition, held for
 * review (`listed = 0`). Metadata + memento state land in CREATIONS_DB
 * (jh-creations), binary media in CREATIONS_BUCKET under thumb/, media/, and
 * source/ prefixes. A duplicate config hash short-circuits with 200; a global
 * FIFO cap of 100 rows is enforced on writes and the evicted rows' R2 objects
 * are deleted. Fails closed with 503 when either binding is missing.
 *
 * `GET /api/creations` — the public gallery index: listed rows only, with
 * media URLs pointing at /api/creations/media/<key>.
 */

import {
  buildCreationHeaders,
  insertCreation,
  CREATIONS_LIST_SQL,
  MAX_MEDIA_BYTES,
  MAX_SOURCE_BYTES,
  MAX_THUMB_BYTES,
  MEDIA_MIME_TO_EXT,
  SOURCE_MIME_TO_EXT,
  THUMB_MIME_TO_EXT,
  validateCreationPayload,
  validateUploadMeta,
  type CreationKind,
} from '../../lib/creations'

type CreationsEnv = {
  CREATIONS_DB?: D1Database
  CREATIONS_BUCKET?: R2Bucket
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildCreationHeaders({ 'content-type': 'application/json; charset=utf-8' }),
  })
}

const UNAVAILABLE = { ok: false, error: 'Creations are unavailable.' }

type UploadField = 'thumb' | 'media' | 'source'

export const onRequestPost: PagesFunction<CreationsEnv> = async (context) => {
  const db = context.env.CREATIONS_DB
  const bucket = context.env.CREATIONS_BUCKET
  if (!db || !bucket) return json(503, UNAVAILABLE)

  const contentType = context.request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data'))
    return json(415, { ok: false, error: 'Expected multipart/form-data.' })

  let form: FormData
  try {
    form = await context.request.formData()
  } catch {
    return json(400, { ok: false, error: 'Invalid multipart body.' })
  }

  const state = form.get('state')
  const configHash = form.get('configHash')
  const kind = form.get('kind')
  const media = form.get('media')
  // Accept Blob, not just File: older runtime compatibility dates parse
  // multipart file parts as Blob, so a strict File check rejects valid
  // uploads (everything below only uses Blob members: size/type/stream).
  const mediaFile = media instanceof Blob ? media : null

  const validated = validateCreationPayload({ state, configHash, kind, hasMedia: mediaFile !== null })
  if (validated.ok === false) return json(400, { ok: false, error: validated.error })

  const uploads: { field: UploadField; file: Blob; ext: string }[] = []
  const specs: [UploadField, FormDataEntryValue | null, Record<string, string>, number][] = [
    ['thumb', form.get('thumb'), THUMB_MIME_TO_EXT, MAX_THUMB_BYTES],
    ['media', media, MEDIA_MIME_TO_EXT, MAX_MEDIA_BYTES],
    ['source', form.get('source'), SOURCE_MIME_TO_EXT, MAX_SOURCE_BYTES],
  ]
  for (const [field, value, allowlist, maxBytes] of specs) {
    if (value === null) continue
    if (!(value instanceof Blob)) return json(400, { ok: false, error: `Invalid ${field} upload.` })
    const check = validateUploadMeta({ size: value.size, type: value.type }, allowlist, maxBytes, field)
    if (check.ok === false) return json(400, { ok: false, error: check.error })
    uploads.push({ field, file: value, ext: check.ext })
  }

  const id = crypto.randomUUID()
  const keys: Record<UploadField, string | null> = { thumb: null, media: null, source: null }
  const uploadedKeys: string[] = []

  try {
    for (const upload of uploads) {
      const key = `${upload.field}/${id}.${upload.ext}`
      await bucket.put(key, upload.file.stream(), { httpMetadata: { contentType: upload.file.type } })
      keys[upload.field] = key
      uploadedKeys.push(key)
    }
  } catch {
    if (uploadedKeys.length > 0) await bucket.delete(uploadedKeys).catch(() => {})
    return json(503, UNAVAILABLE)
  }

  // A client-sent upload source carries mediaKey 'pending' (the id — and so
  // the final key — doesn't exist until now). Rewrite it to the stored key so
  // open-in-playground can fetch the source back. The config hash is computed
  // with the key normalized out, so dedupe is unaffected.
  let storedState = state as string
  if (keys.source) {
    try {
      const parsed = JSON.parse(storedState) as { source?: { kind?: string; mediaKey?: string } }
      if (parsed && typeof parsed === 'object' && parsed.source?.kind === 'upload') {
        parsed.source.mediaKey = keys.source
        storedState = JSON.stringify(parsed)
      }
    } catch {
      /* validation already proved the state parses — keep it verbatim */
    }
  }

  const result = await insertCreation(
    db,
    {
      id,
      kind: kind as CreationKind,
      state: storedState,
      configHash: configHash as string,
      thumbKey: keys.thumb,
      mediaKey: keys.media,
      sourceKey: keys.source,
    },
    Math.floor(Date.now() / 1000),
  )

  if (result.ok === false) {
    if (uploadedKeys.length > 0) await bucket.delete(uploadedKeys).catch(() => {})
    return json(503, UNAVAILABLE)
  }

  if (result.duplicate) {
    // Nothing new was stored — drop the just-uploaded objects.
    if (uploadedKeys.length > 0) await bucket.delete(uploadedKeys).catch(() => {})
    return json(200, { ok: true, duplicate: true })
  }

  if (result.evictedKeys.length > 0) await bucket.delete(result.evictedKeys).catch(() => {})
  return json(201, { ok: true, id })
}

type ListedRow = {
  id: string
  kind: string
  thumb_key: string | null
  media_key: string | null
  created_at: number
}

export const onRequestGet: PagesFunction<CreationsEnv> = async (context) => {
  const db = context.env.CREATIONS_DB
  if (!db) return json(503, UNAVAILABLE)

  let rows: ListedRow[]
  try {
    const result = await db.prepare(CREATIONS_LIST_SQL).all<ListedRow>()
    rows = result.results ?? []
  } catch {
    return json(503, UNAVAILABLE)
  }

  const creations = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    thumbUrl: row.thumb_key ? `/api/creations/media/${encodeURIComponent(row.thumb_key)}` : null,
    mediaUrl: row.media_key ? `/api/creations/media/${encodeURIComponent(row.media_key)}` : null,
    capturedAt: row.created_at,
  }))

  return json(200, { creations })
}
