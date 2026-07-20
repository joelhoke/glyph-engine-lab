export type SvgTarget = {
  tx: number
  ty: number
}

export type SvgTargetSourceOptions = {
  /** Same-origin URL or path to a static SVG file. */
  url: string
  /** Destination bounds in CSS pixels. */
  bounds: { width: number; height: number }
  /** Pixel spacing between sample points. Smaller values produce denser targets. */
  samplingStep?: number
  /** Alpha value a sampled pixel must exceed to be considered visible. */
  alphaThreshold?: number
  /** Fraction of the smaller bound dimension to reserve as a margin. */
  margin?: number
}

export type SvgTargetSourceResult = {
  ok: boolean
  targets: SvgTarget[]
  error?: string
}

/**
 * Rasterizes a static SVG into an offscreen canvas and samples visible pixels
 * to produce target points in CSS-pixel coordinates.
 *
 * The SVG is drawn at its intrinsic aspect ratio, scaled to fit inside the
 * destination bounds and centered. Sampling uses CSS-pixel coordinates so the
 * resulting targets align with the main canvas simulation space.
 */
export async function loadSvgTargets(
  options: SvgTargetSourceOptions,
): Promise<SvgTargetSourceResult> {
  const {
    url,
    bounds,
    samplingStep = 10,
    alphaThreshold = 64,
    margin = 0.08,
  } = options

  if (!url || !url.trim()) {
    return { ok: false, targets: [], error: 'SVG URL is empty' }
  }

  if (bounds.width <= 0 || bounds.height <= 0) {
    return { ok: false, targets: [], error: 'Invalid bounds dimensions' }
  }

  let image: HTMLImageElement
  try {
    image = await loadImage(url)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, targets: [], error: `Failed to load SVG: ${message}` }
  }

  const intrinsicWidth = image.naturalWidth || 1
  const intrinsicHeight = image.naturalHeight || 1
  const intrinsicAspect = intrinsicWidth / intrinsicHeight

  const marginPixels = Math.min(bounds.width, bounds.height) * margin
  const availableWidth = bounds.width - marginPixels * 2
  const availableHeight = bounds.height - marginPixels * 2

  const scale = Math.min(
    availableWidth / intrinsicWidth,
    availableHeight / intrinsicHeight,
  )

  const drawWidth = intrinsicWidth * scale
  const drawHeight = intrinsicHeight * scale
  const offsetX = (bounds.width - drawWidth) / 2
  const offsetY = (bounds.height - drawHeight) / 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(bounds.width))
  canvas.height = Math.max(1, Math.floor(bounds.height))

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { ok: false, targets: [], error: 'Could not create 2D context' }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)

  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, targets: [], error: `Could not read pixel data: ${message}` }
  }

  const targets: SvgTarget[] = []
  const step = Math.max(1, Math.round(samplingStep))
  const data = imageData.data
  const width = canvas.width
  const height = canvas.height

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > alphaThreshold) {
        targets.push({ tx: x, ty: y })
      }
    }
  }

  return { ok: true, targets }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load image at ${url}`))
    image.src = url
  })
}
