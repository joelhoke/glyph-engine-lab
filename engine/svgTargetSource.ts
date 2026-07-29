import { VisualSourceKind } from './visualSource'
import { sampleTargetField } from './targetSampling'

export type SvgTarget = {
  tx: number
  ty: number
}

export type SvgFitMode = 'contain' | 'cover'

export type SourceLayoutConfig = {
  samplingStep: number
  alphaThreshold: number
  margin: number
  fit: SvgFitMode
  scale: number
  offsetX: number
  offsetY: number
}

export type SvgTargetSourceOptions = {
  /** Same-origin URL or path to a static source image (SVG or raster). */
  url: string
  /** Source format. Only used to make the load-failure message accurate. */
  kind?: VisualSourceKind
  /** Destination bounds in CSS pixels. */
  bounds: { width: number; height: number }
  /** Pixel spacing between sample points. Smaller values produce denser targets. */
  samplingStep?: number
  /** Alpha value a sampled pixel must exceed to be considered visible. */
  alphaThreshold?: number
  /** Fraction of the smaller bound dimension to reserve as a margin. */
  margin?: number
  /** How the SVG should fit into the destination bounds. */
  fit?: SvgFitMode
  /** Explicit uniform scale override. Ignored when <= 0. */
  scale?: number
  /** Explicit draw offset overrides. Applied after fit/centering. */
  offsetX?: number
  offsetY?: number
}

export type SvgTargetSourceResult = {
  ok: boolean
  targets: SvgTarget[]
  /** Target X positions in CSS pixels (typed-array twin of `targets`). */
  x: Float32Array
  /** Target Y positions in CSS pixels. */
  y: Float32Array
  /** Packed source RGBA per target (engine/targetSampling), aligned with `targets`. */
  colors: Uint32Array
  /** Normalized X in [0, 1] across the sampled canvas, aligned with `targets`. */
  normX: Float32Array
  /** Normalized Y in [0, 1] across the sampled canvas, aligned with `targets`. */
  normY: Float32Array
  error?: string
}

const EMPTY_FIELD = {
  targets: [] as SvgTarget[],
  x: new Float32Array(0),
  y: new Float32Array(0),
  colors: new Uint32Array(0),
  normX: new Float32Array(0),
  normY: new Float32Array(0),
}

/**
 * Rasterizes a static source image (SVG or raster) into an offscreen canvas
 * and samples visible pixels to produce target points in CSS-pixel coordinates.
 *
 * The source is drawn at its intrinsic aspect ratio, scaled to fit inside the
 * destination bounds and centered. Sampling uses CSS-pixel coordinates so the
 * resulting targets align with the main canvas simulation space.
 *
 * This is the one-time rasterization: each kept pixel's source RGBA is packed
 * alongside its normalized position (engine/targetSampling), so neither the
 * color resolver nor the motion/paint systems ever read canvas pixels or parse
 * colors per frame.
 */
export async function loadSvgTargets(
  options: SvgTargetSourceOptions,
): Promise<SvgTargetSourceResult> {
  const {
    url,
    kind = 'svg',
    bounds,
    samplingStep = 10,
    alphaThreshold = 64,
    margin = 0.08,
    fit = 'contain',
    scale: explicitScale,
    offsetX: explicitOffsetX,
    offsetY: explicitOffsetY,
  } = options

  if (!url || !url.trim()) {
    return { ok: false, ...EMPTY_FIELD, error: 'SVG URL is empty' }
  }

  if (bounds.width <= 0 || bounds.height <= 0) {
    return { ok: false, ...EMPTY_FIELD, error: 'Invalid bounds dimensions' }
  }

  let image: HTMLImageElement
  try {
    image = await loadImage(url)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, ...EMPTY_FIELD, error: `Failed to load ${kind === 'raster' ? 'image' : 'SVG'}: ${message}` }
  }

  const intrinsicWidth = image.naturalWidth || 1
  const intrinsicHeight = image.naturalHeight || 1
  const intrinsicAspect = intrinsicWidth / intrinsicHeight

  const marginPixels = Math.min(bounds.width, bounds.height) * margin
  const availableWidth = bounds.width - marginPixels * 2
  const availableHeight = bounds.height - marginPixels * 2

  const fitScale = fit === 'cover'
    ? Math.max(availableWidth / intrinsicWidth, availableHeight / intrinsicHeight)
    : Math.min(availableWidth / intrinsicWidth, availableHeight / intrinsicHeight)
  const scale = explicitScale && explicitScale > 0 ? explicitScale : fitScale

  const drawWidth = intrinsicWidth * scale
  const drawHeight = intrinsicHeight * scale
  const centerOffsetX = (bounds.width - drawWidth) / 2
  const centerOffsetY = (bounds.height - drawHeight) / 2
  const offsetX = centerOffsetX + (explicitOffsetX ?? 0)
  const offsetY = centerOffsetY + (explicitOffsetY ?? 0)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(bounds.width))
  canvas.height = Math.max(1, Math.floor(bounds.height))

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { ok: false, ...EMPTY_FIELD, error: 'Could not create 2D context' }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, ...EMPTY_FIELD, error: `Could not read pixel data: ${message}` }
  }

  const field = sampleTargetField(imageData, Math.max(1, Math.round(samplingStep)), alphaThreshold)

  const targets: SvgTarget[] = new Array(field.x.length)
  for (let i = 0; i < field.x.length; i += 1) {
    targets[i] = { tx: field.x[i], ty: field.y[i] }
  }

  return {
    ok: true,
    targets,
    x: field.x,
    y: field.y,
    colors: field.colors,
    normX: field.normX,
    normY: field.normY,
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load image at ${url}`))
    image.src = url
  })
}
