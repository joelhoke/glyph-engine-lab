/**
 * Landing glyph gradient (pre-release): the completed-intro landing recolors
 * the JH glyph field with a FIXED left-to-right gradient — always the same
 * deep-to-bright cyan pair, independent of the background behind it, so the
 * mark reads identically on every visitor's landing. (The earlier
 * luminance-conditional dark/light pair selection was retired with the fixed
 * landing background gradient.)
 *
 * Pure functions only — verified by scripts/verify-background-luminance.js.
 */

import { packSourceRgba } from './targetSampling'

/** The fixed landing glyph gradient: left stop → right stop. */
export const LANDING_GLYPH_GRADIENT = { from: '#0C5E7D', to: '#3B9EC8' }

function parseHexChannels(hex: string): { r: number; g: number; b: number } {
  const value = parseInt(hex.replace('#', ''), 16)
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
}

/**
 * Recolor a sampled target field in place as a horizontal (left-to-right)
 * gradient: targets at the left edge of the field take `from`, targets at
 * the right edge take `to`, linearly interpolated in sRGB space. Per-target
 * alpha is preserved.
 */
export function applyHorizontalGlyphGradient(
  colors: Uint32Array,
  normX: Float32Array,
  fromHex: string,
  toHex: string,
): void {
  const from = parseHexChannels(fromHex)
  const to = parseHexChannels(toHex)
  const count = Math.min(colors.length, normX.length)
  for (let i = 0; i < count; i += 1) {
    const t = Math.min(1, Math.max(0, normX[i]))
    const r = Math.round(from.r + (to.r - from.r) * t)
    const g = Math.round(from.g + (to.g - from.g) * t)
    const b = Math.round(from.b + (to.b - from.b) * t)
    const a = (colors[i] >>> 24) & 0xff
    colors[i] = packSourceRgba(r, g, b, a)
  }
}
