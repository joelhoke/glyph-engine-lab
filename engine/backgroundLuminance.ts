/**
 * Background-luminance glyph gradient (Stage 3): the completed-intro landing
 * recolors the JH glyph field with a vertical gradient chosen by the
 * background's computed luminance — a light pair on dark backgrounds, a deep
 * pair on light ones, so the mark stays legible either way.
 *
 * Pure functions only — verified by scripts/verify-background-luminance.js.
 */

import { packSourceRgba } from './targetSampling'

/** Gradient pair over a dark background (light, airy cyans). */
export const LANDING_GRADIENT_DARK = { from: '#8FE3F5', to: '#2F9BC4' }

/** Gradient pair over a light background (deep, grounded cyans). */
export const LANDING_GRADIENT_LIGHT = { from: '#0C5E7D', to: '#3B9EC8' }

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

/**
 * Pick the landing gradient pair from the mean luminance of the two
 * background stops: dark backgrounds get the light pair, light backgrounds
 * the deep pair.
 */
export function resolveLandingGlyphGradient(
  backgroundColor1: string,
  backgroundColor2: string,
): LandingGlyphGradient {
  const mean =
    (computeRelativeLuminance(backgroundColor1) + computeRelativeLuminance(backgroundColor2)) / 2
  return mean >= LANDING_LUMINANCE_THRESHOLD ? LANDING_GRADIENT_LIGHT : LANDING_GRADIENT_DARK
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
