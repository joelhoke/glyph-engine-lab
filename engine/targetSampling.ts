/**
 * Pure target-field sampler shared by the SVG/raster target pipeline
 * (engine/svgTargetSource.ts) and the built-in logo fallback in
 * components/SceneCanvas.tsx.
 *
 * Extracted as a DOM-free module so the sampling rules — packed source RGBA,
 * normalized spatial metadata — are deterministic and unit-verifiable
 * (scripts/verify-target-sampling.js). Everything here runs once per source
 * rasterization; nothing in this module is per-frame work.
 */

/** Packed pixel format: (a << 24) | (b << 16) | (g << 8) | r, unsigned. */
export function packSourceRgba(r: number, g: number, b: number, a: number): number {
  return (
    (((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0
  )
}

export function unpackSourceR(packed: number): number {
  return packed & 0xff
}

export function unpackSourceG(packed: number): number {
  return (packed >>> 8) & 0xff
}

export function unpackSourceB(packed: number): number {
  return (packed >>> 16) & 0xff
}

/** Translucent source alpha is preserved; 255 is fully opaque. */
export function unpackSourceA(packed: number): number {
  return (packed >>> 24) & 0xff
}

/** Minimal ImageData-shaped view the sampler needs (DOM-free). */
export type SamplePixels = {
  data: Uint8ClampedArray
  width: number
  height: number
}

export type SampledTargetField = {
  /** Target X positions in CSS pixels, aligned with `colors`/`normX`. */
  x: Float32Array
  /** Target Y positions in CSS pixels. */
  y: Float32Array
  /** Packed source RGBA per target (packSourceRgba); translucent alpha kept. */
  colors: Uint32Array
  /** Normalized X in [0, 1] across the sampled canvas. */
  normX: Float32Array
  /** Normalized Y in [0, 1] across the sampled canvas. */
  normY: Float32Array
}

/**
 * Walk the raster on a fixed grid and keep every pixel whose alpha exceeds
 * `alphaThreshold`. Positions are CSS pixels; `normX`/`normY` are normalized
 * against the sampled canvas size so downstream systems (organic motion,
 * paint replay) can work in resolution-independent space.
 */
export function sampleTargetField(
  pixels: SamplePixels,
  step: number,
  alphaThreshold: number,
): SampledTargetField {
  const { data, width, height } = pixels
  const safeStep = Math.max(1, Math.round(step))

  // Capacity upper bound: one target per visited grid cell.
  const capacity =
    Math.max(1, Math.ceil(width / safeStep)) * Math.max(1, Math.ceil(height / safeStep))
  const x = new Float32Array(capacity)
  const y = new Float32Array(capacity)
  const colors = new Uint32Array(capacity)
  const normX = new Float32Array(capacity)
  const normY = new Float32Array(capacity)

  const invW = width > 1 ? 1 / (width - 1) : 0
  const invH = height > 1 ? 1 / (height - 1) : 0

  let count = 0
  for (let py = 0; py < height; py += safeStep) {
    for (let px = 0; px < width; px += safeStep) {
      const offset = (py * width + px) * 4
      const alpha = data[offset + 3]
      if (alpha > alphaThreshold) {
        x[count] = px
        y[count] = py
        colors[count] = packSourceRgba(
          data[offset],
          data[offset + 1],
          data[offset + 2],
          alpha,
        )
        normX[count] = px * invW
        normY[count] = py * invH
        count += 1
      }
    }
  }

  return {
    x: x.subarray(0, count),
    y: y.subarray(0, count),
    colors: colors.subarray(0, count),
    normX: normX.subarray(0, count),
    normY: normY.subarray(0, count),
  }
}
