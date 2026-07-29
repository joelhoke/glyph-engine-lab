/**
 * Landing glyph gradient (Stage 3): the completed-intro landing recolors the
 * JH glyph field with the approved fixed vertical cyan gradient.
 *
 * The older luminance helpers remain exported for compatibility, but landing
 * presentation no longer changes its brand colors with the background.
 *
 * Pure functions only — verified by scripts/verify-background-luminance.js.
 */

import { packSourceRgba } from './targetSampling'

/** Approved landing mark colors, top to bottom. */
export const LANDING_GLYPH_GRADIENT = { from: '#0C5E7D', to: '#3B9EC8' }

/** Backward-compatible aliases for callers that imported the old pair names. */
export const LANDING_GRADIENT_DARK = LANDING_GLYPH_GRADIENT
export const LANDING_GRADIENT_LIGHT = LANDING_GLYPH_GRADIENT

/** Mean relative luminance at or above this counts as a light background. */
export const LANDING_LUMINANCE_THRESHOLD = 0.35

/**
 * sRGB relative luminance in [0, 1] (Rec. 709 primaries, linearized).
 * Accepts '#rrggbb'; malformed input resolves to 0 (treated as dark).
 */
export function computeRelativeLuminance(hex: string): number {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!match) return 0
  const value = parseInt(match[1], 16)
  const r = (value >> 16) & 0xff
  const g = (value >> 8) & 0xff
  const b = value & 0xff
  const linearize = (channel: number) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

export type LandingGlyphGradient = { from: string; to: string }

/** Return the fixed approved landing gradient regardless of background. */
export function resolveLandingGlyphGradient(
  _backgroundColor1: string,
  _backgroundColor2: string,
): LandingGlyphGradient {
  return LANDING_GLYPH_GRADIENT
}

function parseHexChannels(hex: string): { r: number; g: number; b: number } {
  const value = parseInt(hex.replace('#', ''), 16)
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
}

/**
 * Recolor a sampled target field in place as a vertical gradient: targets at
 * the top of the field take `from`, targets at the bottom take `to`, linearly
 * interpolated in sRGB space. Per-target alpha is preserved.
 */
export function applyVerticalGlyphGradient(
  colors: Uint32Array,
  normY: Float32Array,
  fromHex: string,
  toHex: string,
): void {
  const from = parseHexChannels(fromHex)
  const to = parseHexChannels(toHex)
  const count = Math.min(colors.length, normY.length)
  for (let i = 0; i < count; i += 1) {
    const t = Math.min(1, Math.max(0, normY[i]))
    const r = Math.round(from.r + (to.r - from.r) * t)
    const g = Math.round(from.g + (to.g - from.g) * t)
    const b = Math.round(from.b + (to.b - from.b) * t)
    const a = (colors[i] >>> 24) & 0xff
    colors[i] = packSourceRgba(r, g, b, a)
  }
}
