/**
 * Visual Sonification experiment (debug-only): canvas analysis.
 *
 * Reads the visible scene canvas (downscaled into a small private staging
 * surface by the caller — the same offscreen-staging precedent as
 * SceneCanvas' animatedStagingRef) into a logical 24×12 feature grid. The
 * grid orientation is CANONICAL: for horizontal sweeps steps run left→right
 * and bands top→bottom; for vertical sweeps the strip is transposed so steps
 * run top→bottom and bands left→right. Band 0 is therefore always the
 * "top/left" (highest pitch) side, and reverse directions are just the
 * canonical phrase played backwards (engine/sonificationMapper).
 *
 * Only the strip under the scan line is re-read at each scan step, so live
 * paint, glyph motion, fish, source imagery, and ambient agents shape the
 * next notes. Everything here is pure — the DOM canvas glue lives in
 * components/vibe/useSonification.ts. Verified by scripts/verify-sonification.js.
 */

import type { QualityTier } from './qualityTiers'
import {
  SONIFICATION_BANDS,
  SONIFICATION_STEPS,
} from './sonificationConfig'

/** Minimal structural view of an ImageData — keeps this module DOM-free. */
export type SonificationRaster = {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Per-cell scene features, all normalized to 0..1 except hue (0..360, or
 *  -1 for an achromatic cell). */
export type SonificationGrid = {
  luminance: Float32Array
  /** Share of pixels deviating from the cell mean — how "full" the cell is. */
  density: Float32Array
  /** Luminance spread inside the cell. */
  contrast: Float32Array
  /** Saturation-weighted circular mean hue in degrees; -1 when achromatic. */
  hue: Float32Array
  saturation: Float32Array
}

export type SonificationRasterSize = {
  width: number
  height: number
  /** How many consecutive scan steps one read covers (T3 halves the read rate). */
  reuseSteps: number
}

/** Max analysis raster per quality tier. T0/T1 read 96×48 every step, T2
 *  reads 64×32 every step, and T3 reads 48×24 once per two steps. */
export function resolveSonificationRasterSize(tier: QualityTier): SonificationRasterSize {
  if (tier <= 1) return { width: 96, height: 48, reuseSteps: 1 }
  if (tier === 2) return { width: 64, height: 32, reuseSteps: 1 }
  return { width: 48, height: 24, reuseSteps: 2 }
}

/** Allocate the reusable 24×12 feature grid (once per session). */
export function createSonificationGrid(): SonificationGrid {
  const cells = SONIFICATION_STEPS * SONIFICATION_BANDS
  return {
    luminance: new Float32Array(cells),
    density: new Float32Array(cells),
    contrast: new Float32Array(cells),
    hue: new Float32Array(cells),
    saturation: new Float32Array(cells),
  }
}

export type HslColor = { h: number; s: number; l: number }

/** #rrggbb → HSL (h 0..360, s/l 0..1). Invalid input returns black. */
export function hexToHsl(hex: string): HslColor {
  const normalized = /^#?[0-9a-fA-F]{6}$/.test(hex) ? hex.replace('#', '') : '000000'
  const r = parseInt(normalized.substring(0, 2), 16) / 255
  const g = parseInt(normalized.substring(2, 4), 16) / 255
  const b = parseInt(normalized.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return { h, s, l }
}

/** Pixels whose luminance deviates from the cell mean by more than this are
 *  counted as "marked" for the density feature. */
const DENSITY_DEVIATION = 0.1

/**
 * Re-read one strip of the analysis raster into the grid. `raster` must be
 * the strip region only: for a horizontal sweep it's `stripWidth ×
 * rasterHeight` with the 12 bands running DOWN its height; for a vertical
 * sweep it's `rasterWidth × stripHeight` with the bands running ACROSS its
 * width (left→right, so band 0 is always the top/left = highest-pitch side
 * without a transposing copy). Writes are in place: no allocation.
 */
export function extractStripFeatures(
  raster: SonificationRaster,
  axis: 'horizontal' | 'vertical',
  stepIndex: number,
  grid: SonificationGrid,
): void {
  const { data, width, height } = raster
  if (width * height <= 0 || stepIndex < 0 || stepIndex >= SONIFICATION_STEPS) return
  const base = stepIndex * SONIFICATION_BANDS
  const bandSpan = axis === 'horizontal' ? height : width
  const crossSpan = axis === 'horizontal' ? width : height
  const bandLength = bandSpan / SONIFICATION_BANDS

  for (let band = 0; band < SONIFICATION_BANDS; band += 1) {
    const u0 = Math.floor(band * bandLength)
    const u1 = Math.max(u0 + 1, Math.floor((band + 1) * bandLength))
    // Pass 1: mean luminance.
    let lumSum = 0
    let count = 0
    for (let u = u0; u < u1; u += 1) {
      for (let v = 0; v < crossSpan; v += 1) {
        const x = axis === 'horizontal' ? v : u
        const y = axis === 'horizontal' ? u : v
        const i = (y * width + x) * 4
        const r = data[i] / 255
        const g = data[i + 1] / 255
        const b = data[i + 2] / 255
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        lumSum += (max + min) / 2
        count += 1
      }
    }
    const meanLum = count > 0 ? lumSum / count : 0
    // Pass 2: contrast, density, hue/saturation.
    let varSum = 0
    let marked = 0
    let satSum = 0
    let hueX = 0
    let hueY = 0
    for (let u = u0; u < u1; u += 1) {
      for (let v = 0; v < crossSpan; v += 1) {
        const x = axis === 'horizontal' ? v : u
        const y = axis === 'horizontal' ? u : v
        const i = (y * width + x) * 4
        const r = data[i] / 255
        const g = data[i + 1] / 255
        const b = data[i + 2] / 255
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const l = (max + min) / 2
        const dev = l - meanLum
        varSum += dev * dev
        if (Math.abs(dev) > DENSITY_DEVIATION) marked += 1
        if (max !== min) {
          const d = max - min
          const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
          let h: number
          if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
          else if (max === g) h = ((b - r) / d + 2) * 60
          else h = ((r - g) / d + 4) * 60
          satSum += s
          const rad = (h * Math.PI) / 180
          hueX += s * Math.cos(rad)
          hueY += s * Math.sin(rad)
        }
      }
    }
    const cell = base + band
    grid.luminance[cell] = meanLum
    grid.contrast[cell] = Math.min(1, Math.sqrt(count > 0 ? varSum / count : 0) * 2)
    grid.density[cell] = count > 0 ? marked / count : 0
    grid.saturation[cell] = count > 0 ? satSum / count : 0
    const hueWeight = Math.sqrt(hueX * hueX + hueY * hueY)
    grid.hue[cell] =
      hueWeight > 1e-4
        ? (Math.atan2(hueY, hueX) * 180) / Math.PI + (hueY < 0 ? 360 : 0)
        : -1
  }
}

/** T3 read-rate halving: copy the previous strip's features into this step
 *  instead of re-reading the canvas. */
export function copyStripFeatures(
  grid: SonificationGrid,
  fromStep: number,
  toStep: number,
): void {
  if (
    fromStep < 0 ||
    fromStep >= SONIFICATION_STEPS ||
    toStep < 0 ||
    toStep >= SONIFICATION_STEPS
  ) {
    return
  }
  const from = fromStep * SONIFICATION_BANDS
  const to = toStep * SONIFICATION_BANDS
  for (let band = 0; band < SONIFICATION_BANDS; band += 1) {
    grid.luminance[to + band] = grid.luminance[from + band]
    grid.density[to + band] = grid.density[from + band]
    grid.contrast[to + band] = grid.contrast[from + band]
    grid.hue[to + band] = grid.hue[from + band]
    grid.saturation[to + band] = grid.saturation[from + band]
  }
}
