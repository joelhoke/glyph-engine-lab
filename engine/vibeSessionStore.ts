/**
 * Vibe session store: mirrors the visitor's in-progress playground composition
 * into Web Storage (sessionStorage in the browser) so their work survives SPA
 * navigation and component remounts for the whole tab session. The stored
 * payload IS a vibe memento (engine/vibeMemento.ts) — already JSON-safe and
 * covering config, paint tool, paint strokes, and the field source — so no
 * second serialization format exists.
 *
 * The caller decides WHEN to clear (manual refresh, reset); this module only
 * reads/writes one key and never throws. Pure and DOM-free beyond the minimal
 * Storage interface — verified by scripts/verify-vibe-session-store.js.
 */

import { parseVibeMemento, VibeMementoV1 } from './vibeMemento'
import { VisualSourceKind } from './visualSource'

export const VIBE_SESSION_STORAGE_KEY = 'jh-vibe-session-v1'

/** The subset of the Web Storage API the session store needs. */
export type VibeSessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** JSON-safe live upload reference persisted beside the memento: blob: URLs
 *  stay valid for the whole tab session (the exact window sessionStorage
 *  covers) but carry no extension, so kind/filename ride along. */
export type VibeSessionUpload = {
  kind: VisualSourceKind
  url: string
  filename: string
}

export type VibeSessionRecord = {
  memento: VibeMementoV1
  upload: VibeSessionUpload | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSessionUpload(value: unknown): value is VibeSessionUpload {
  return (
    isRecord(value) &&
    typeof value.url === 'string' &&
    typeof value.filename === 'string' &&
    typeof value.kind === 'string'
  )
}

/** Persist the session snapshot. Quota/security failures are swallowed — the
 *  in-memory playground is never disturbed by persistence trouble. */
export function writeVibeSession(
  storage: VibeSessionStorage,
  memento: VibeMementoV1,
  upload: VibeSessionUpload | null,
): void {
  try {
    const record: VibeSessionRecord = { memento, upload }
    storage.setItem(VIBE_SESSION_STORAGE_KEY, JSON.stringify(record))
  } catch {
    /* storage full or blocked — persistence is best-effort */
  }
}

/** Read and validate the stored snapshot. Corrupt or foreign data is removed
 *  and reported as absent. */
export function readVibeSession(storage: VibeSessionStorage): VibeSessionRecord | null {
  let raw: string | null
  try {
    raw = storage.getItem(VIBE_SESSION_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isRecord(parsed)) {
      const memento = parseVibeMemento(parsed.memento)
      const rawUpload: unknown = parsed.upload
      const upload = isSessionUpload(rawUpload) ? rawUpload : null
      if (memento) return { memento, upload }
    }
  } catch {
    /* fall through to removal */
  }
  try {
    storage.removeItem(VIBE_SESSION_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  return null
}

export function clearVibeSession(storage: VibeSessionStorage): void {
  try {
    storage.removeItem(VIBE_SESSION_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
