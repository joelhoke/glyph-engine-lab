/**
 * Unified Vibe undo/redo history (launch item 6): one chronological stack of
 * transactions covering every Vibe mutation — config tweaks, glyph-text
 * commits, presets, uploads, paint-tool changes, paint strokes, and clear
 * paint. Undo/redo applies whole before/after snapshots (config + paint tool
 * + paint overlay + upload reference), so compound actions like presets and
 * uploads restore the paint and source they replaced.
 *
 * Coalescing: consecutive `config`/`paint-tool` transactions carrying the
 * SAME caller-supplied key (e.g. `motion.amount`, `glyphPalette.2`,
 * `brushDiameter`) merge into a single transaction — the first `before` is
 * kept and the newest `after` wins. The merge window ends as soon as a
 * different key, a different kind, or any keyless transaction (text, preset,
 * source, paint-stroke, clear-paint) lands, and it never crosses an
 * undo/redo cursor position (merging only happens at the tip).
 *
 * Object-URL lifecycle: transactions reference upload object URLs in their
 * before/after snapshots. An URL is released (via the injected `releaseUrl`)
 * only when the entries referencing it are dropped — redo truncation on a
 * new transaction, trimming past the entry bound, or an explicit history
 * clear — AND no retained entry (or the caller, which guards its live
 * source) still references it.
 *
 * Pure and DOM-free — verified by scripts/verify-vibe-history.js.
 */

import {
  clonePaintSnapshot,
  createEmptyPaintSnapshot,
  PaintSnapshot,
} from './paint'
import type { PaintToolConfig } from './paint'
import { PlaygroundConfig } from './playgroundConfig'
import { VisualSourceKind } from './visualSource'

/** Reference to the visitor-supplied source (uploaded file or preset SVG). */
export type VibeUploadRef = {
  kind: VisualSourceKind
  url: string
  filename: string
} | null

/** Everything one transaction needs to restore in either direction. */
export type VibeStateSnapshot = {
  config: PlaygroundConfig
  paintTool: PaintToolConfig
  paint: PaintSnapshot
  upload: VibeUploadRef
}

export type VibeTransactionKind =
  | 'config'
  | 'text'
  | 'preset'
  | 'source'
  | 'paint-tool'
  | 'paint-stroke'
  | 'clear-paint'

export type VibeTransaction = {
  kind: VibeTransactionKind
  /** Coalesce key for config/paint-tool transactions; null for the rest. */
  key: string | null
  before: VibeStateSnapshot
  after: VibeStateSnapshot
}

/** History bound: the oldest transactions are dropped beyond this many. */
export const VIBE_HISTORY_LIMIT = 50

export type VibeHistory = {
  entries: VibeTransaction[]
  /** Number of currently-applied entries: entries[cursor - 1] is undoable,
   *  entries[cursor] is redoable. */
  cursor: number
}

export function createVibeHistory(): VibeHistory {
  return { entries: [], cursor: 0 }
}

/** Deep-enough copy: palette, motion (incl. custom), and ambient (incl.
 *  weather/matrix) must never be shared with live React state. */
export function cloneVibeConfig(config: PlaygroundConfig): PlaygroundConfig {
  return {
    ...config,
    glyphPalette: [...config.glyphPalette],
    motion: { ...config.motion, custom: { ...config.motion.custom } },
    ambient: {
      ...config.ambient,
      weather: { ...config.ambient.weather },
      matrix: { ...config.ambient.matrix },
    },
  }
}

export function cloneVibeSnapshot(snapshot: VibeStateSnapshot): VibeStateSnapshot {
  return {
    config: cloneVibeConfig(snapshot.config),
    paintTool: { ...snapshot.paintTool },
    paint: clonePaintSnapshot(snapshot.paint),
    upload: snapshot.upload ? { ...snapshot.upload } : null,
  }
}

export function createEmptyVibeSnapshot(
  config: PlaygroundConfig,
  paintTool: PaintToolConfig,
): VibeStateSnapshot {
  return {
    config: cloneVibeConfig(config),
    paintTool: { ...paintTool },
    paint: createEmptyPaintSnapshot(),
    upload: null,
  }
}

function snapshotUrls(snapshot: VibeStateSnapshot, out: string[]): void {
  if (snapshot.upload) out.push(snapshot.upload.url)
}

/** Every upload URL referenced by any retained history entry. */
export function collectRetainedUrls(history: VibeHistory): Set<string> {
  const urls = new Set<string>()
  for (let i = 0; i < history.entries.length; i += 1) {
    const entry = history.entries[i]
    if (entry.before.upload) urls.add(entry.before.upload.url)
    if (entry.after.upload) urls.add(entry.after.upload.url)
  }
  return urls
}

/** Release URLs referenced only by the dropped entries (never URLs still
 *  referenced by retained entries; duplicates released once). */
function releaseDroppedUrls(
  dropped: VibeTransaction[],
  history: VibeHistory,
  releaseUrl?: (url: string) => void,
): void {
  if (!releaseUrl || dropped.length === 0) return
  const retained = collectRetainedUrls(history)
  const freed = new Set<string>()
  const urls: string[] = []
  for (let i = 0; i < dropped.length; i += 1) {
    snapshotUrls(dropped[i].before, urls)
    snapshotUrls(dropped[i].after, urls)
  }
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i]
    if (!retained.has(url) && !freed.has(url)) {
      freed.add(url)
      releaseUrl(url)
    }
  }
}

/**
 * Push a transaction at the cursor: pending redo entries are truncated (and
 * their orphaned URLs released), same-kind/same-key config and paint-tool
 * transactions at the tip coalesce (first before kept, newest after wins),
 * and the oldest entries are trimmed beyond VIBE_HISTORY_LIMIT.
 */
export function pushTransaction(
  history: VibeHistory,
  transaction: VibeTransaction,
  releaseUrl?: (url: string) => void,
): void {
  // A new transaction invalidates the redo tail (standard undo semantics).
  if (history.cursor < history.entries.length) {
    const dropped = history.entries.splice(history.cursor)
    releaseDroppedUrls(dropped, history, releaseUrl)
  }

  const tip = history.entries[history.entries.length - 1]
  const coalescible =
    (transaction.kind === 'config' || transaction.kind === 'paint-tool') &&
    transaction.key !== null
  if (
    coalescible &&
    tip &&
    tip.kind === transaction.kind &&
    tip.key === transaction.key
  ) {
    tip.after = transaction.after
    return
  }

  history.entries.push(transaction)
  if (history.entries.length > VIBE_HISTORY_LIMIT) {
    const overflow = history.entries.splice(0, history.entries.length - VIBE_HISTORY_LIMIT)
    releaseDroppedUrls(overflow, history, releaseUrl)
  }
  history.cursor = history.entries.length
}

/** Move the cursor back one entry and return it (apply its `before`). */
export function undoTransaction(history: VibeHistory): VibeTransaction | null {
  if (history.cursor <= 0) return null
  history.cursor -= 1
  return history.entries[history.cursor]
}

/** Move the cursor forward one entry and return it (apply its `after`). */
export function redoTransaction(history: VibeHistory): VibeTransaction | null {
  if (history.cursor >= history.entries.length) return null
  const entry = history.entries[history.cursor]
  history.cursor += 1
  return entry
}

/** Drop every entry (reset / non-recoverable paint discard), releasing all
 *  URLs that become orphaned. */
export function clearVibeHistory(
  history: VibeHistory,
  releaseUrl?: (url: string) => void,
): void {
  const dropped = history.entries.splice(0)
  history.cursor = 0
  releaseDroppedUrls(dropped, history, releaseUrl)
}

export function canUndoTransactions(history: VibeHistory): boolean {
  return history.cursor > 0
}

export function canRedoTransactions(history: VibeHistory): boolean {
  return history.cursor < history.entries.length
}

/** Toolbar-facing flags: undo/redo is also suspended while an upload is in
 *  flight (the in-flight result would race a restored source). */
export function canUndoVibe(history: VibeHistory, uploadPending: boolean): boolean {
  return !uploadPending && canUndoTransactions(history)
}

export function canRedoVibe(history: VibeHistory, uploadPending: boolean): boolean {
  return !uploadPending && canRedoTransactions(history)
}
