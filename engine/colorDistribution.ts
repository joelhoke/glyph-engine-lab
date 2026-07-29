/**
 * Color-distribution helpers for the glyph field.
 *
 * All heavy parsing and metadata construction happens when the palette,
 * glyph text, or SVG targets change. The hot draw loop only performs
 * lightweight numeric interpolation/indexing.
 */

export type GlyphColorMode =
  | 'image-gradient'
  | 'glyph-cycle'
  | 'word-cycle'
  | 'rows'
  | 'source-colors'

export type Rgb = { r: number; g: number; b: number }

const DEFAULT_HEX = '#ffffff'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function parseHexColor(hex: string): Rgb {
  const normalized = hex.replace('#', '').trim().toLowerCase()
  if (/^[0-9a-f]{6}$/.test(normalized)) {
    return {
      r: parseInt(normalized.substring(0, 2), 16),
      g: parseInt(normalized.substring(2, 4), 16),
      b: parseInt(normalized.substring(4, 6), 16),
    }
  }
  if (/^[0-9a-f]{3}$/.test(normalized)) {
    const r = parseInt(normalized[0] + normalized[0], 16)
    const g = parseInt(normalized[1] + normalized[1], 16)
    const b = parseInt(normalized[2] + normalized[2], 16)
    return { r, g, b }
  }
  return parseHexColor(DEFAULT_HEX)
}

export function formatRgb(rgb: Rgb): string {
  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`
}

export function formatRgba(rgb: Rgb, alpha: number): string {
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  }
}

/**
 * Sample a palette across the full normalized [0, 1] range.
 * 0 maps to the first color, 1 maps to the last color, and intermediate
 * values are linearly interpolated between adjacent palette stops.
 */
export function sampleImageGradient(palette: Rgb[], t: number): Rgb {
  const n = palette.length
  if (n === 0) return parseHexColor(DEFAULT_HEX)
  if (n === 1) return palette[0]
  const scaled = clamp(t, 0, 1) * (n - 1)
  const index = Math.floor(scaled)
  const localT = scaled - index
  const start = palette[clamp(index, 0, n - 1)]
  const end = palette[clamp(index + 1, 0, n - 1)]
  return lerpRgb(start, end, localT)
}

/**
 * Return a palette color index for a normalized vertical position,
 * distributing bands top-to-bottom across the palette length.
 */
export function sampleRowBand(paletteLength: number, normalizedY: number): number {
  if (paletteLength <= 1) return 0
  const t = clamp(normalizedY, 0, 1)
  return Math.min(paletteLength - 1, Math.floor(t * paletteLength))
}

/**
 * Build a stable word-to-color mapping for the given source text.
 *
 * Whitespace separates words. Each word advances to the next palette color.
 * The returned array is aligned with the source characters so a glyph at
 * source index `i` can look up `wordColorIndices[i % length]`.
 *
 * If the text is empty or whitespace-only, a fallback default text is used
 * so the field still has a deterministic color pattern.
 */
export const DEFAULT_WORD_CYCLE_TEXT =
  "Voilà! In view, a humble vaudevillian veteran cast vicariously as both victim and villain by the vicissitudes of Fate... you may call me 'V'."

export function buildWordColorIndices(
  sourceText: string,
  paletteLength: number,
): { indices: number[]; effectiveText: string } {
  const effectiveText =
    sourceText.trim().length === 0 ? DEFAULT_WORD_CYCLE_TEXT : sourceText
  const chars = Array.from(effectiveText)
  const indices: number[] = []
  let wordIndex = 0
  let inWord = false

  for (const ch of chars) {
    const whitespace = /\s/.test(ch)
    if (whitespace) {
      inWord = false
      indices.push(-1)
    } else {
      if (!inWord) {
        wordIndex += 1
        inWord = true
      }
      const colorIndex = paletteLength > 0 ? (wordIndex - 1) % paletteLength : 0
      indices.push(colorIndex)
    }
  }

  return { indices, effectiveText }
}

/**
 * Compute per-target normalized X and Y values for image-gradient and rows.
 *
 * Values are derived from target-space bounds and are stable across
 * particle reassignment.
 */
export function buildTargetSpatialData(targets: { tx: number; ty: number }[]): {
  gradientT: Float32Array
  rowT: Float32Array
} {
  const count = targets.length
  const gradientT = new Float32Array(count)
  const rowT = new Float32Array(count)

  if (count === 0) {
    return { gradientT, rowT }
  }

  let minX = targets[0].tx
  let maxX = targets[0].tx
  let minY = targets[0].ty
  let maxY = targets[0].ty

  for (let i = 1; i < count; i += 1) {
    const t = targets[i]
    if (t.tx < minX) minX = t.tx
    if (t.tx > maxX) maxX = t.tx
    if (t.ty < minY) minY = t.ty
    if (t.ty > maxY) maxY = t.ty
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  for (let i = 0; i < count; i += 1) {
    const t = targets[i]
    gradientT[i] = (t.tx - minX) / rangeX
    rowT[i] = (t.ty - minY) / rangeY
  }

  return { gradientT, rowT }
}

/**
 * Typed-array variant of buildTargetSpatialData for the hot scene path: the
 * sampled target field already arrives as Float32Arrays (engine/targetSampling),
 * so spatial metadata is rebuilt without an intermediate object array.
 */
export function buildTargetSpatialDataFromArrays(
  xs: Float32Array,
  ys: Float32Array,
): { gradientT: Float32Array; rowT: Float32Array } {
  const count = Math.min(xs.length, ys.length)
  const gradientT = new Float32Array(count)
  const rowT = new Float32Array(count)

  if (count === 0) {
    return { gradientT, rowT }
  }

  let minX = xs[0]
  let maxX = xs[0]
  let minY = ys[0]
  let maxY = ys[0]

  for (let i = 1; i < count; i += 1) {
    if (xs[i] < minX) minX = xs[i]
    if (xs[i] > maxX) maxX = xs[i]
    if (ys[i] < minY) minY = ys[i]
    if (ys[i] > maxY) maxY = ys[i]
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  for (let i = 0; i < count; i += 1) {
    gradientT[i] = (xs[i] - minX) / rangeX
    rowT[i] = (ys[i] - minY) / rangeY
  }

  return { gradientT, rowT }
}

/**
 * Everything the per-glyph color decision needs, gathered once per frame by
 * the renderer. Packed color arrays use the engine/targetSampling RGBA format;
 * a painted entry of 0 means "no paint override" (painted colors are opaque,
 * so a zero alpha channel never collides with real paint).
 */
export type GlyphColorContext = {
  mode: GlyphColorMode
  palette: Rgb[]
  particleIndex: number
  /** Assigned target index, or -1 when the glyph has no target. */
  targetIndex: number
  targetCount: number
  gradientT?: Float32Array
  rowT?: Float32Array
  wordColorIndices?: number[]
  /** Packed source RGBA per target (source-colors mode). */
  sourceColors?: Uint32Array
  /** Packed paint override per target; 0 = unpainted. */
  paintedColors?: Uint32Array
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }

function unpackPacked(packed: number): Rgb {
  return {
    r: packed & 0xff,
    g: (packed >>> 8) & 0xff,
    b: (packed >>> 16) & 0xff,
  }
}

/**
 * Resolve one glyph's color. Precedence is fixed:
 *   1. painted override on the assigned target (non-destructive overlay),
 *   2. the selected base distribution (palette modes or source colors),
 *   3. the safe palette-modulo fallback, then pure white.
 */
export function resolveGlyphColor(context: GlyphColorContext): Rgb {
  const { palette, particleIndex, targetIndex, targetCount, mode } = context
  const assigned = targetIndex >= 0 && targetIndex < targetCount

  if (assigned && context.paintedColors && targetIndex < context.paintedColors.length) {
    const painted = context.paintedColors[targetIndex]
    if (painted !== 0) return unpackPacked(painted)
  }

  if (palette.length === 0) return WHITE

  if (
    mode === 'source-colors' &&
    assigned &&
    context.sourceColors &&
    targetIndex < context.sourceColors.length
  ) {
    return unpackPacked(context.sourceColors[targetIndex])
  }

  if (
    mode === 'image-gradient' &&
    assigned &&
    context.gradientT &&
    targetIndex < context.gradientT.length
  ) {
    return sampleImageGradient(palette, context.gradientT[targetIndex])
  }

  if (mode === 'rows' && assigned && context.rowT && targetIndex < context.rowT.length) {
    const band = sampleRowBand(palette.length, context.rowT[targetIndex])
    return palette[band]
  }

  if (
    mode === 'word-cycle' &&
    context.wordColorIndices &&
    context.wordColorIndices.length > 0
  ) {
    const colorIndex =
      context.wordColorIndices[particleIndex % context.wordColorIndices.length]
    return palette[colorIndex >= 0 ? colorIndex : 0]
  }

  return palette[particleIndex % palette.length]
}

/**
 * Alpha multiplier for the resolved color: source-colors preserves the sampled
 * pixel's translucency; paint and palette modes are fully opaque.
 */
export function resolveGlyphAlphaScale(context: GlyphColorContext): number {
  const { mode, targetIndex, targetCount } = context
  const assigned = targetIndex >= 0 && targetIndex < targetCount
  if (!assigned) return 1
  if (context.paintedColors && targetIndex < context.paintedColors.length) {
    if (context.paintedColors[targetIndex] !== 0) return 1
  }
  if (
    mode === 'source-colors' &&
    context.sourceColors &&
    targetIndex < context.sourceColors.length
  ) {
    return ((context.sourceColors[targetIndex] >>> 24) & 0xff) / 255
  }
  return 1
}
