/**
 * Vibe mementos ("vibe creations"): a compact, JSON-safe capture of a visitor's
 * Vibe composition — the playground config, paint tool, paint strokes (with
 * Float32Array points flattened to rounded number arrays), and the source the
 * field is pointed at — plus a pure engagement tracker that decides when a
 * session has done enough to be worth saving.
 *
 * The tracker counts RAW recorded transactions (the same calls the unified
 * undo history receives, before its same-key coalescing merges them), so a
 * visitor nudging one slider ten times still accrues ten steps of engagement;
 * the undo history may hold a single coalesced entry for the same gesture.
 *
 * Hashing uses `globalThis.crypto.subtle` (browsers and Node >= 19) over a
 * recursive key-sorted stringify, so a memento's config hash is deterministic
 * regardless of property insertion order, capture time, or the server-assigned
 * upload media key.
 *
 * Pure and DOM-free — verified by scripts/verify-vibe-memento.js.
 */

import { PaintStroke, PaintTool, PaintToolConfig } from './paint'
import { PlaygroundConfig } from './playgroundConfig'
import { PondCharacter } from './pondConfig'
import {
  cloneVibeConfig,
  cloneVibeSnapshot,
  VibeStateSnapshot,
  VibeTransaction,
  VibeUploadRef,
} from './vibeHistory'
import { VisualSourceKind } from './visualSource'

/** Minimum recorded transactions before the 'steps' qualifier is earned. */
export const VIBE_MEMENTO_MIN_STEPS = 5
/** Minimum distinct toolbar tool categories before 'tools' is earned. */
export const VIBE_MEMENTO_MIN_TOOLS = 3

export type VibeMementoElement = 'toolbar' | 'carousel' | 'music' | 'pond'
export type VibeMementoQualifier = 'steps' | 'tools' | 'elements'

export type VibeMementoSource =
  | { kind: 'builtin' }
  | { kind: 'preset'; url: string }
  | { kind: 'upload'; mediaKey: string }

/** Pond participation in a saved piece. The pond stays session-only for LIVE
 *  play (no history entries, no analytics) — this field exists so an archived
 *  piece can reopen with the pond on, the state its maker saved it in. */
export type VibeMementoPond = { enabled: boolean; character?: PondCharacter }

/** JSON-safe paint stroke: Float32Array points flattened to number[] and
 *  rounded to 4 decimal places (normalized coords, so ~1e-4 precision). */
export type SerializedPaintStroke = {
  tool: PaintTool
  glyphColor: number | null
  backgroundColor: number | null
  radiusNorm: number
  points: number[]
}

export type VibeMementoV1 = {
  version: 1
  config: PlaygroundConfig
  paintTool: PaintToolConfig
  paint: { strokes: SerializedPaintStroke[] }
  source: VibeMementoSource
  /** Present only when the piece was saved with the pond enabled. */
  pond?: VibeMementoPond
  /** Unix seconds at capture time (excluded from the config hash). */
  capturedAt: number
}

/** Toolbar categories the tracker credits. Mirrors the production
 *  VibeToolCategory values (components/vibe/toolbarConfig.ts); the debug-only
 *  motion/ambient panels accrue steps but no tool credit. Re-declared here so
 *  the engine never imports from components/. */
export type VibeMementoToolCredit = 'upload' | 'text' | 'colorStyles' | 'paint'

const ALL_ELEMENTS: VibeMementoElement[] = ['toolbar', 'carousel', 'music', 'pond']

export type VibeMementoTracker = {
  recordTransaction(tx: VibeTransaction): void
  touchElement(el: VibeMementoElement): void
  getStepCount(): number
  getToolCount(): number
  getElementsTouched(): ReadonlySet<VibeMementoElement>
  qualifiers(): VibeMementoQualifier[]
  isQualified(): boolean
}

/** Map a transaction to its toolbar tool category, or null when the
 *  transaction carries no production-tool credit (motion/ambient config keys). */
function toolCreditFor(tx: VibeTransaction): VibeMementoToolCredit | null {
  switch (tx.kind) {
    case 'source':
    case 'preset':
      return 'upload'
    case 'text':
      return 'text'
    case 'paint-tool':
    case 'paint-stroke':
    case 'clear-paint':
      return 'paint'
    case 'config': {
      const key = tx.key ?? ''
      if (
        key.startsWith('glyphPalette') ||
        key.startsWith('backgroundColor') ||
        key === 'glyphColorMode'
      ) {
        return 'colorStyles'
      }
      if (key === 'glyphText' || key === 'glyphFont' || key === 'glyphSizePt') {
        return 'text'
      }
      // motion.*, ambient.*, and unknown keys: a step, but no tool credit.
      return null
    }
  }
}

/**
 * Engagement tracker for the "save this creation" affordance: counts raw
 * recorded transactions as steps, credits the toolbar tool categories they
 * belong to, and tracks which page elements the visitor touched. Pure and
 * synchronous; no React.
 */
export function createVibeMementoTracker(): VibeMementoTracker {
  let steps = 0
  const tools = new Set<VibeMementoToolCredit>()
  const elements = new Set<VibeMementoElement>()

  return {
    recordTransaction(tx) {
      steps += 1
      elements.add('toolbar')
      const credit = toolCreditFor(tx)
      if (credit) tools.add(credit)
    },
    touchElement(el) {
      elements.add(el)
    },
    getStepCount() {
      return steps
    },
    getToolCount() {
      return tools.size
    },
    getElementsTouched() {
      return elements
    },
    qualifiers() {
      const out: VibeMementoQualifier[] = []
      if (steps >= VIBE_MEMENTO_MIN_STEPS) out.push('steps')
      if (tools.size >= VIBE_MEMENTO_MIN_TOOLS) out.push('tools')
      if (ALL_ELEMENTS.every((el) => elements.has(el))) out.push('elements')
      return out
    },
    isQualified() {
      return this.qualifiers().length > 0
    },
  }
}

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

function serializeStroke(stroke: PaintStroke): SerializedPaintStroke {
  const points: number[] = new Array(stroke.points.length)
  for (let i = 0; i < stroke.points.length; i += 1) {
    points[i] = round4(stroke.points[i])
  }
  return {
    tool: stroke.tool,
    glyphColor: stroke.glyphColor,
    backgroundColor: stroke.backgroundColor,
    radiusNorm: round4(stroke.radiusNorm),
    points,
  }
}

/** Map the live upload reference onto the memento source union. Anything that
 *  is not a preset asset or an in-session object/data URL is treated as the
 *  built-in source. */
function sourceFromUpload(upload: VibeUploadRef): VibeMementoSource {
  if (!upload) return { kind: 'builtin' }
  if (upload.url.startsWith('/assets/')) return { kind: 'preset', url: upload.url }
  if (upload.url.startsWith('blob:') || upload.url.startsWith('data:')) {
    // The server assigns the real media id on save; the client sends 'pending'.
    return { kind: 'upload', mediaKey: 'pending' }
  }
  return { kind: 'builtin' }
}

/** Infer the engine source kind from a URL/media key's file extension. */
function inferSourceKind(url: string): VisualSourceKind {
  return url.toLowerCase().split('?')[0].endsWith('.svg') ? 'svg' : 'raster'
}

/**
 * Capture a JSON-safe memento from a live Vibe state snapshot. Config and
 * paint tool are deep-copied via the vibeHistory clone helpers; paint strokes
 * are serialized (redoStrokes dropped — a memento captures what is visible).
 */
export function buildVibeMemento(
  snapshot: VibeStateSnapshot,
  opts?: { capturedAt?: number; pond?: VibeMementoPond },
): VibeMementoV1 {
  // cloneVibeSnapshot does the deep-copy work; the paint half is then
  // re-serialized into its JSON-safe form below.
  const cloned = cloneVibeSnapshot(snapshot)
  return {
    version: 1,
    config: cloneVibeConfig(cloned.config),
    paintTool: { ...cloned.paintTool },
    paint: { strokes: snapshot.paint.strokes.map(serializeStroke) },
    source: sourceFromUpload(snapshot.upload),
    ...(opts?.pond ? { pond: { ...opts.pond } } : {}),
    capturedAt: opts?.capturedAt ?? Math.floor(Date.now() / 1000),
  }
}

/**
 * Deterministic stringify: object keys are emitted in sorted order at every
 * depth, so structurally equal values stringify identically regardless of
 * property insertion order. Only JSON-safe values are supported.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')
  return `{${body}}`
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * SHA-256 hex digest of the memento's content, stable across capture time and
 * server-assigned upload ids: `capturedAt` is excluded and the upload mediaKey
 * is normalized to 'pending' before hashing.
 */
export async function mementoConfigHash(memento: VibeMementoV1): Promise<string> {
  const normalized = {
    version: memento.version,
    config: memento.config,
    paintTool: memento.paintTool,
    paint: memento.paint,
    source: { ...memento.source, mediaKey: 'pending' },
    // Pond participation distinguishes pieces (a pond piece and its pondless
    // twin are different creations); omitted entirely when absent.
    ...(memento.pond ? { pond: memento.pond } : {}),
  }
  const bytes = new TextEncoder().encode(stableStringify(normalized))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return toHex(digest)
}

// --- defensive parsing --------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'number')
}

/** Light shape check: every required PlaygroundConfig key present with the
 *  right primitive kind (nested motion/ambient only checked as objects). */
function isPlaygroundConfig(value: unknown): value is PlaygroundConfig {
  if (!isRecord(value)) return false
  return (
    typeof value.glyphText === 'string' &&
    isStringArray(value.glyphPalette) &&
    typeof value.backgroundColor1 === 'string' &&
    typeof value.backgroundColor2 === 'string' &&
    typeof value.glyphFont === 'string' &&
    typeof value.glyphColorMode === 'string' &&
    typeof value.glyphSizePt === 'number' &&
    isRecord(value.motion) &&
    isRecord(value.ambient)
  )
}

function isPaintToolConfig(value: unknown): value is PaintToolConfig {
  if (!isRecord(value)) return false
  return (
    typeof value.enabled === 'boolean' &&
    (value.tool === 'paint' || value.tool === 'erase') &&
    typeof value.glyphColor === 'string' &&
    typeof value.backgroundColor === 'string' &&
    typeof value.brushDiameter === 'number'
  )
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function isSerializedStroke(value: unknown): value is SerializedPaintStroke {
  if (!isRecord(value)) return false
  return (
    (value.tool === 'paint' || value.tool === 'erase') &&
    isNullableNumber(value.glyphColor) &&
    isNullableNumber(value.backgroundColor) &&
    typeof value.radiusNorm === 'number' &&
    isNumberArray(value.points) &&
    value.points.length % 2 === 0
  )
}

function isMementoSource(value: unknown): value is VibeMementoSource {
  if (!isRecord(value)) return false
  if (value.kind === 'builtin') return true
  if (value.kind === 'preset') return typeof value.url === 'string'
  if (value.kind === 'upload') return typeof value.mediaKey === 'string'
  return false
}

const POND_CHARACTERS = new Set(['source', 'original', 'jelly', 'ray'])

function isMementoPond(value: unknown): value is VibeMementoPond {
  if (!isRecord(value)) return false
  if (typeof value.enabled !== 'boolean') return false
  if (value.character !== undefined) {
    if (typeof value.character !== 'string' || !POND_CHARACTERS.has(value.character)) return false
  }
  return true
}

/**
 * Defensive parse of an untrusted memento payload (server response, stored
 * JSON). Returns null on anything that does not match the V1 shape exactly.
 */
export function parseVibeMemento(raw: unknown): VibeMementoV1 | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 1) return null
  if (!isPlaygroundConfig(raw.config)) return null
  if (!isPaintToolConfig(raw.paintTool)) return null
  if (!isRecord(raw.paint) || !Array.isArray(raw.paint.strokes)) return null
  if (!raw.paint.strokes.every(isSerializedStroke)) return null
  if (!isMementoSource(raw.source)) return null
  if (raw.pond !== undefined && !isMementoPond(raw.pond)) return null
  if (typeof raw.capturedAt !== 'number') return null
  return raw as unknown as VibeMementoV1
}

/**
 * Rebuild a live Vibe state snapshot from a memento: stroke points become
 * Float32Array again, the redo stack starts empty, and the source union maps
 * back onto an upload reference (preset URLs and server media URLs are
 * raster unless the name ends in .svg, matching how presets/uploads carry
 * VisualSourceKind in PortfolioExperience).
 */
export function mementoToVibeSnapshot(memento: VibeMementoV1): VibeStateSnapshot {
  const strokes: PaintStroke[] = memento.paint.strokes.map((stroke) => ({
    tool: stroke.tool,
    glyphColor: stroke.glyphColor,
    backgroundColor: stroke.backgroundColor,
    radiusNorm: stroke.radiusNorm,
    points: Float32Array.from(stroke.points),
  }))

  let upload: VibeUploadRef = null
  if (memento.source.kind === 'preset') {
    const url = memento.source.url
    upload = {
      kind: inferSourceKind(url),
      url,
      filename: url.split('/').pop() ?? url,
    }
  } else if (memento.source.kind === 'upload') {
    upload = {
      kind: inferSourceKind(memento.source.mediaKey),
      // Media keys contain a '/' (source/<id>.svg) — percent-encoded so the
      // single-segment /api/creations/media/[key] route matches (the route
      // decodes it, same as the gallery index's thumb/media URLs).
      url: `/api/creations/media/${encodeURIComponent(memento.source.mediaKey)}`,
      filename: 'creation-source',
    }
  }

  return {
    config: cloneVibeConfig(memento.config),
    paintTool: { ...memento.paintTool },
    paint: { strokes, redoStrokes: [] },
    upload,
  }
}
