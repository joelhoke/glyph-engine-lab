/**
 * Direct glyph painting: a non-destructive color overlay on the active base
 * distribution. Painting never mutates the base targets or the palette
 * distribution — it records bounded, normalized stroke history and stamps a
 * per-target packed-RGBA override array, so erasing simply reveals the base
 * color and the whole overlay can be replayed after a resize re-rasterizes
 * the targets (indices are viewport-specific; normalized strokes are not).
 *
 * Pure and DOM-free — verified by scripts/verify-paint.js.
 */

export type PaintTool = 'paint' | 'erase'

/** Brush diameter bounds in CSS px (UI-facing). */
export const PAINT_BRUSH_DIAMETER_MIN = 8
export const PAINT_BRUSH_DIAMETER_MAX = 160
export const PAINT_BRUSH_DIAMETER_DEFAULT = 48

/** A paint channel is either a hex color or explicitly 'none' (untouched). */
export type PaintChannelColor = string | 'none'

/** UI-facing paint tool configuration (Vibe-only, session-only). */
export type PaintToolConfig = {
  /** Paint mode on/off. Off restores normal pointer repel/impulses. */
  enabled: boolean
  tool: PaintTool
  /** Glyph channel color, or 'none' to leave glyph colors untouched. */
  glyphColor: PaintChannelColor
  /** Background channel color, or 'none' to leave the background untouched. */
  backgroundColor: PaintChannelColor
  /** Brush diameter in CSS px, clamped to the bounds above. */
  brushDiameter: number
}

/** Live overlay status reported to the controls (undo/redo affordances). */
export type PaintStatus = {
  paintedTargetCount: number
  strokeCount: number
  /** Strokes that modify the background channel (paint marks or erases). */
  backgroundStrokeCount: number
  canUndo: boolean
  canRedo: boolean
  /** True while a stroke gesture is in progress. */
  active: boolean
}

export type PaintStroke = {
  tool: PaintTool
  /** Packed glyph override color (engine/targetSampling format), or null when
   *  the stroke leaves the glyph channel untouched. Ignored for erase. */
  glyphColor: number | null
  /** Packed background mark color, or null when the stroke leaves the
   *  background channel untouched. Ignored for erase. */
  backgroundColor: number | null
  /** Brush radius as a fraction of min(viewportW, viewportH) at record time. */
  radiusNorm: number
  /** Interleaved normalized x/y stamp points (already gap-interpolated). */
  points: Float32Array
}

/** History bounds: at most 100 gestures and 20,000 sampled points total. */
export const PAINT_MAX_STROKES = 100
export const PAINT_MAX_POINTS = 20000

export type PaintHistory = {
  strokes: PaintStroke[]
  totalPoints: number
}

export function createPaintHistory(): PaintHistory {
  return { strokes: [], totalPoints: 0 }
}

/**
 * Append a stroke, evicting the oldest gestures to stay inside the history
 * bounds. Returns true when eviction happened — the caller must replay, since
 * the visible overlay may no longer match the remaining history.
 */
export function pushStroke(history: PaintHistory, stroke: PaintStroke): boolean {
  history.strokes.push(stroke)
  history.totalPoints += stroke.points.length / 2
  let evicted = false
  while (
    history.strokes.length > PAINT_MAX_STROKES ||
    history.totalPoints > PAINT_MAX_POINTS
  ) {
    const dropped = history.strokes.shift()
    if (!dropped) break
    history.totalPoints -= dropped.points.length / 2
    evicted = true
  }
  return evicted
}

/** Remove the newest stroke (for undo). Returns it, or null when empty. */
export function popStroke(history: PaintHistory): PaintStroke | null {
  const stroke = history.strokes.pop() ?? null
  if (stroke) history.totalPoints -= stroke.points.length / 2
  return stroke
}

export function clearPaintHistory(history: PaintHistory): void {
  history.strokes.length = 0
  history.totalPoints = 0
}

/**
 * Uniform-grid spatial index over the current target positions. Rebuilt
 * whenever the target field is (re)sampled; strokes are replayed against it.
 * Linked-list storage keeps the build allocation-count low and lookups fast.
 */
export type TargetSpatialIndex = {
  width: number
  height: number
  cellSize: number
  cols: number
  rows: number
  x: Float32Array
  y: Float32Array
  /** First target index per cell, -1 when empty. */
  heads: Int32Array
  /** Next target index in the same cell, -1 terminates. */
  next: Int32Array
}

export function buildTargetSpatialIndex(
  x: Float32Array,
  y: Float32Array,
  width: number,
  height: number,
  cellSize = 64,
): TargetSpatialIndex {
  const safeCell = Math.max(1, cellSize)
  const cols = Math.max(1, Math.ceil(width / safeCell))
  const rows = Math.max(1, Math.ceil(height / safeCell))
  const heads = new Int32Array(cols * rows)
  heads.fill(-1)
  const next = new Int32Array(x.length)
  for (let i = 0; i < x.length; i += 1) {
    const col = Math.min(cols - 1, Math.max(0, Math.floor(x[i] / safeCell)))
    const row = Math.min(rows - 1, Math.max(0, Math.floor(y[i] / safeCell)))
    const cell = row * cols + col
    next[i] = heads[cell]
    heads[cell] = i
  }
  return { width, height, cellSize: safeCell, cols, rows, x, y, heads, next }
}

/**
 * Stamp one point of a stroke's glyph channel: every target within the brush
 * radius gets the stroke's glyph color (paint) or is cleared back to the base
 * (erase). `painted` uses 0 as the unpainted sentinel; painted colors are
 * opaque. Returns the change in painted-target count.
 */
export function stampPoint(
  index: TargetSpatialIndex,
  tool: PaintTool,
  color: number,
  px: number,
  py: number,
  radiusPx: number,
  painted: Uint32Array,
): number {
  const radius = Math.max(0, radiusPx)
  const radiusSq = radius * radius
  const minCol = Math.max(0, Math.floor((px - radius) / index.cellSize))
  const maxCol = Math.min(index.cols - 1, Math.floor((px + radius) / index.cellSize))
  const minRow = Math.max(0, Math.floor((py - radius) / index.cellSize))
  const maxRow = Math.min(index.rows - 1, Math.floor((py + radius) / index.cellSize))
  let delta = 0
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      let i = index.heads[row * index.cols + col]
      while (i !== -1) {
        const dx = index.x[i] - px
        const dy = index.y[i] - py
        if (dx * dx + dy * dy <= radiusSq && i < painted.length) {
          if (tool === 'erase') {
            if (painted[i] !== 0) {
              painted[i] = 0
              delta -= 1
            }
          } else if (painted[i] === 0) {
            painted[i] = color
            delta += 1
          } else {
            painted[i] = color
          }
        }
        i = index.next[i]
      }
    }
  }
  return delta
}

/** Stamp every point of a stroke's glyph channel. Returns the painted-count delta. */
export function stampStroke(
  index: TargetSpatialIndex,
  stroke: PaintStroke,
  painted: Uint32Array,
): number {
  // A paint stroke with the glyph channel set to 'none' leaves targets alone;
  // erase always clears glyph overrides regardless of channel colors.
  if (stroke.tool === 'paint' && stroke.glyphColor === null) return 0
  const radiusPx = stroke.radiusNorm * Math.min(index.width, index.height)
  const color = stroke.glyphColor ?? 0
  let delta = 0
  const points = stroke.points
  for (let p = 0; p + 1 < points.length; p += 2) {
    delta += stampPoint(
      index,
      stroke.tool,
      color,
      points[p] * index.width,
      points[p + 1] * index.height,
      radiusPx,
      painted,
    )
  }
  return delta
}

/** Strokes that modify the background channel (paint marks or erases). */
export function countBackgroundStrokes(history: PaintHistory): number {
  let count = 0
  for (let i = 0; i < history.strokes.length; i += 1) {
    const stroke = history.strokes[i]
    if (stroke.tool === 'erase' || stroke.backgroundColor !== null) count += 1
  }
  return count
}

/**
 * Rebuild the overlay from scratch: clear `painted`, then re-stamp every
 * stroke in order. Returns the resulting painted-target count.
 */
export function replayPaintHistory(
  history: PaintHistory,
  index: TargetSpatialIndex,
  painted: Uint32Array,
): number {
  painted.fill(0)
  let count = 0
  for (let s = 0; s < history.strokes.length; s += 1) {
    count += stampStroke(index, history.strokes[s], painted)
  }
  return count
}

export function countPaintedTargets(painted: Uint32Array): number {
  let count = 0
  for (let i = 0; i < painted.length; i += 1) {
    if (painted[i] !== 0) count += 1
  }
  return count
}

/**
 * Append gap-free normalized stamp points for the segment (x0, y0) → (x1, y1)
 * (CSS px) to `out` as x/y pairs in [0, 1]. The start point is excluded (the
 * caller records it when the stroke begins); the end point is included.
 * Points are spaced at most `stepPx` apart so fast pointers leave no gaps.
 */
export function appendInterpolatedPoints(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stepPx: number,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const w = viewportWidth > 0 ? viewportWidth : 1
  const h = viewportHeight > 0 ? viewportHeight : 1
  const dx = x1 - x0
  const dy = y1 - y0
  const dist = Math.sqrt(dx * dx + dy * dy)
  const step = Math.max(0.5, stepPx)
  const segments = Math.max(1, Math.ceil(dist / step))
  for (let s = 1; s <= segments; s += 1) {
    const t = s / segments
    out.push((x0 + dx * t) / w, (y0 + dy * t) / h)
  }
}
