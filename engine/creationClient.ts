/**
 * Browser-side client for the vibe-creations API: saving a memento (with
 * optional thumbnail / media / source uploads) as multipart/form-data, and
 * listing / re-loading saved creations. Framework-free (fetch, FormData,
 * Blob only) and never throws — every failure collapses to an `{ ok: false }`
 * / `[]` / `null` result so the UI can stay silent on network trouble.
 */

import { parseVibeMemento, VibeMementoV1 } from './vibeMemento'

export type CreationKind = 'auto' | 'image' | 'clip'

export type SaveCreationResult = { ok: boolean; duplicate?: boolean; id?: string }

/** Derive a reasonable upload filename from the blob's MIME type. */
function uploadFilename(base: string, blob: Blob): string {
  const subtype = typeof blob.type === 'string' ? blob.type.split('/')[1] : ''
  const ext = subtype ? subtype.split(';')[0].replace('jpeg', 'jpg') : ''
  return ext ? `${base}.${ext}` : base
}

/**
 * POST the memento to /api/creations as multipart/form-data: `state` (the
 * memento JSON string), `configHash`, `kind`, plus `thumb` / `media` /
 * `source` file parts when present. Never throws.
 */
export async function saveCreation(args: {
  kind: CreationKind
  memento: VibeMementoV1
  configHash: string
  thumb?: Blob
  media?: Blob
  source?: Blob
}): Promise<SaveCreationResult> {
  try {
    const form = new FormData()
    form.append('state', JSON.stringify(args.memento))
    form.append('configHash', args.configHash)
    form.append('kind', args.kind)
    if (args.thumb) form.append('thumb', args.thumb, uploadFilename('thumb', args.thumb))
    if (args.media) form.append('media', args.media, uploadFilename('media', args.media))
    if (args.source) form.append('source', args.source, uploadFilename('source', args.source))

    const res = await fetch('/api/creations', { method: 'POST', body: form })
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      // Non-JSON response body; the status code still decides the outcome.
    }
    const record =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
    if (!res.ok) {
      return { ok: false, duplicate: record?.duplicate === true || undefined }
    }
    return {
      ok: record?.ok !== false,
      duplicate: record?.duplicate === true || undefined,
      id: typeof record?.id === 'string' ? record.id : undefined,
    }
  } catch {
    return { ok: false }
  }
}

export type ListedCreation = {
  id: string
  kind: CreationKind
  thumbUrl: string | null
  mediaUrl: string | null
  capturedAt: number
}

function isCreationKind(value: unknown): value is CreationKind {
  return value === 'auto' || value === 'image' || value === 'clip'
}

function toListedCreation(value: unknown): ListedCreation | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !isCreationKind(record.kind)) return null
  if (typeof record.capturedAt !== 'number') return null
  return {
    id: record.id,
    kind: record.kind,
    thumbUrl: typeof record.thumbUrl === 'string' ? record.thumbUrl : null,
    mediaUrl: typeof record.mediaUrl === 'string' ? record.mediaUrl : null,
    capturedAt: record.capturedAt,
  }
}

/** GET the visitor's saved creations. Returns [] on any error. */
export async function fetchListedCreations(): Promise<ListedCreation[]> {
  try {
    const res = await fetch('/api/creations')
    if (!res.ok) return []
    const data: unknown = await res.json()
    // Accept either a bare array or a { creations: [...] } envelope.
    const list = Array.isArray(data)
      ? data
      : typeof data === 'object' && data !== null && Array.isArray((data as { creations?: unknown }).creations)
        ? ((data as { creations: unknown[] }).creations)
        : null
    if (!list) return []
    return list
      .map(toListedCreation)
      .filter((entry): entry is ListedCreation => entry !== null)
  } catch {
    return []
  }
}

/** GET one saved creation's memento state. Returns null on any error. */
export async function fetchCreationState(id: string): Promise<VibeMementoV1 | null> {
  try {
    const res = await fetch(`/api/creations/${encodeURIComponent(id)}`)
    if (!res.ok) return null
    const data: unknown = await res.json()
    // Accept the memento at the top level or nested under `state` (which may
    // itself be a JSON string, mirroring how it was posted).
    const direct = parseVibeMemento(data)
    if (direct) return direct
    if (typeof data === 'object' && data !== null && 'state' in data) {
      const nested = (data as { state: unknown }).state
      if (typeof nested === 'string') {
        try {
          return parseVibeMemento(JSON.parse(nested))
        } catch {
          return null
        }
      }
      return parseVibeMemento(nested)
    }
    return null
  } catch {
    return null
  }
}

// --- Admin moderation (cookie session from /api/creations/moderate) -----------

export type ModerationAction = 'list' | 'unlist' | 'delete'

/** Exchange the admin password for the signed moderation cookie. */
export async function moderateLogin(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/creations/moderate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** GET the pending review queue. null = not authorized (or any error). */
export async function fetchPendingCreations(): Promise<ListedCreation[] | null> {
  try {
    const res = await fetch('/api/creations/moderate')
    if (!res.ok) return null
    const data: unknown = await res.json()
    const list =
      typeof data === 'object' && data !== null && Array.isArray((data as { creations?: unknown }).creations)
        ? (data as { creations: unknown[] }).creations
        : null
    if (!list) return null
    return list.map(toListedCreation).filter((entry): entry is ListedCreation => entry !== null)
  } catch {
    return null
  }
}

/** Apply a moderation action to one creation (requires the cookie). */
export async function moderateCreation(id: string, action: ModerationAction): Promise<boolean> {
  try {
    const res = await fetch('/api/creations/moderate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    return res.ok
  } catch {
    return false
  }
}
