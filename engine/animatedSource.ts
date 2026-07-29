/**
 * Animated target sources (Stage 3): the seam between a living, per-frame
 * source and the shared target-field sampler.
 *
 * A SceneSourceSelection is the discriminated replacement for the old
 * url/kind pair: the built-in JH mark, a static image (SVG or raster), or an
 * animated provider. Only one animated provider ships — the Black hole — and
 * its lifecycle (`start` / `resize` / `renderFrame` / `setPaused` / `stop`)
 * is an internal engine contract, not a public animation API.
 *
 * The provider draws into an OWNED offscreen canvas. The renderer downscales
 * that canvas into a tier-sized staging surface and only ever calls
 * getImageData on the staging surface (components/SceneCanvas.tsx). All frame
 * math is deterministic and DOM-free — the same seed and time always produce
 * the same frame, which is what scripts/verify-animated-source.js asserts.
 * The DOM canvas factory is injected, so the whole lifecycle runs in Node.
 */

import { createSeededRandom } from './random'
import { VisualSourceKind } from './visualSource'
import { QualityTier } from './qualityTiers'

/** What the scene samples its target field from. */
export type SceneSourceSelection =
  | { kind: 'builtin' }
  | { kind: 'static'; url: string; sourceKind: VisualSourceKind }
  | { kind: 'animated'; provider: 'black-hole' }

/** The only animated provider that ships. */
export type AnimatedProviderName = 'black-hole'

/** Minimal gradient the black-hole frame needs (DOM-free). */
export type AnimatedGradientLike = {
  addColorStop: (offset: number, color: string) => void
}

/** Minimal 2D-context subset the frame renderer uses. CanvasRenderingContext2D
 *  satisfies this structurally; the verify script injects a recording stub. */
export type AnimatedDrawContext = {
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: number
  globalAlpha: number
  globalCompositeOperation: string
  clearRect: (x: number, y: number, w: number, h: number) => void
  beginPath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  stroke: () => void
  arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number) => void
  ellipse: (
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ) => void
  fill: () => void
  createRadialGradient: (
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ) => AnimatedGradientLike
}

/** Minimal offscreen-canvas surface owned by a provider. */
export type AnimatedCanvasLike = {
  width: number
  height: number
  getContext: (kind: '2d') => AnimatedDrawContext | null
}

/** Injected so the provider stays DOM-free (document.createElement in the
 *  browser, a stub in Node). */
export type AnimatedCanvasFactory = (
  width: number,
  height: number,
) => AnimatedCanvasLike | null

/**
 * Internal animated-provider lifecycle. Call order contract:
 * - `start` allocates the owned canvas; it is idempotent while running and
 *   may be called again after `stop`. Returns false when no 2D context could
 *   be created (a genuine provider failure — no valid frame can ever exist).
 * - `resize` before `start` is a no-op; after `start` it re-sizes the owned
 *   canvas. Same-size resizes are no-ops.
 * - `renderFrame` draws one frame at the given time. It returns false —
 *   without throwing — before `start`, after `stop`, while paused, or when
 *   the draw itself fails. A false return never destroys previously drawn
 *   content: the caller keeps its last valid sampled field.
 * - `setPaused(true)` suspends rendering (hidden tab); `setPaused(false)`
 *   resumes it.
 * - `stop` releases the owned canvas and is idempotent.
 */
export type AnimatedSourceProvider = {
  start: (size: { width: number; height: number }) => boolean
  resize: (width: number, height: number) => void
  renderFrame: (timeSeconds: number) => boolean
  setPaused: (paused: boolean) => void
  stop: () => void
  isRunning: () => boolean
  /** Detail of the most recent failure, for diagnostics. */
  getLastError: () => string | null
}

/** Deterministic pose time (seconds) for the reduced-motion single frame. */
export const BLACK_HOLE_REDUCED_POSE_TIME = 12

const BLACK_HOLE_SEED = 0xb1ac4015
const STAR_COUNT = 220
const TAU = Math.PI * 2

/**
 * Static per-star metadata for the accretion disk. Built once from a seeded
 * generator; every frame is then a pure function of time.
 */
export type BlackHoleModel = {
  /** Orbital radius per star, normalized: 0 = inner disk edge, 1 = outer. */
  orbitT: Float32Array
  /** Initial orbital angle per star, radians. */
  angle0: Float32Array
  /** Trail line width per star, px at unit disk scale. */
  size: Float32Array
  count: number
}

export function buildBlackHoleModel(seed: number = BLACK_HOLE_SEED): BlackHoleModel {
  const random = createSeededRandom(seed)
  const orbitT = new Float32Array(STAR_COUNT)
  const angle0 = new Float32Array(STAR_COUNT)
  const size = new Float32Array(STAR_COUNT)
  for (let i = 0; i < STAR_COUNT; i += 1) {
    // Bias toward the inner edge: the disk reads densest near the horizon.
    orbitT[i] = Math.pow(random(), 1.6)
    angle0[i] = random() * TAU
    size[i] = 0.8 + random() * 1.8
  }
  return { orbitT, angle0, size, count: STAR_COUNT }
}

/**
 * Draw one black-hole frame: a spiraling accretion disk of orbiting star
 * trails (Keplerian — inner orbits faster), a bright photon ring, and an
 * event horizon punched transparent so the glyph field keeps a true hole.
 * Pure function of (model, width, height, timeSeconds): same inputs, same
 * draw calls.
 */
export function renderBlackHoleFrame(
  ctx: AnimatedDrawContext,
  model: BlackHoleModel,
  width: number,
  height: number,
  timeSeconds: number,
): void {
  const cx = width * 0.5
  const cy = height * 0.5
  const diskR = Math.min(width, height) * 0.36
  const horizonR = diskR * 0.17
  const tilt = 0.38

  ctx.clearRect(0, 0, width, height)

  // Accretion bands: continuous annular strokes from the inner disk edge to
  // the rim — hot blue-white near the horizon, ember orange at the rim.
  // These give the sampler a solid field to read; the star trails add the
  // swirl on top.
  const innerR = horizonR * 1.35
  const bandCount = 26
  const bandSpacing = (diskR - innerR) / bandCount
  for (let b = 0; b < bandCount; b += 1) {
    const t = b / (bandCount - 1)
    const r = innerR + t * (diskR - innerR)
    const hue = 205 - t * 181
    const lightness = 85 - t * 24
    const alpha = 0.78 - t * 0.3
    ctx.strokeStyle = `hsla(${hue.toFixed(1)}, 85%, ${lightness.toFixed(1)}%, ${alpha.toFixed(2)})`
    ctx.lineWidth = bandSpacing * 1.55
    ctx.beginPath()
    ctx.ellipse(cx, cy, r, r * tilt, 0, 0, TAU)
    ctx.stroke()
  }

  // Star trails: short line segments along each star's elliptical orbit.
  for (let i = 0; i < model.count; i += 1) {
    const t = model.orbitT[i]
    const r = innerR + t * (diskR - innerR)
    // Keplerian angular speed: inner orbits sweep noticeably faster.
    const speed = 2.6 / Math.pow(r / diskR + 0.08, 1.5) / 10
    const angle = model.angle0[i] + timeSeconds * speed
    const trail = Math.min(0.45, Math.max(0.05, speed * 0.09))
    const x1 = cx + Math.cos(angle - trail) * r
    const y1 = cy + Math.sin(angle - trail) * r * tilt
    const x2 = cx + Math.cos(angle) * r
    const y2 = cy + Math.sin(angle) * r * tilt
    // Hot blue-white near the horizon, ember orange at the rim.
    const hue = 205 - t * 181
    const lightness = 88 - t * 26
    ctx.strokeStyle = `hsla(${hue.toFixed(1)}, 88%, ${lightness.toFixed(1)}%, 0.9)`
    ctx.lineWidth = model.size[i] * Math.max(0.75, diskR / 320)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // Photon ring: a thin bright ellipse hugging the horizon.
  ctx.strokeStyle = 'rgba(223, 243, 255, 0.95)'
  ctx.lineWidth = Math.max(2, diskR * 0.014)
  ctx.beginPath()
  ctx.ellipse(cx, cy, horizonR * 1.18, horizonR * 1.18 * tilt, 0, 0, TAU)
  ctx.stroke()

  // Event horizon: erase to full transparency so no glyph targets sample
  // inside the hole — the field keeps a genuine void at the center.
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = 'rgba(0, 0, 0, 1)'
  ctx.beginPath()
  ctx.arc(cx, cy, horizonR, 0, TAU)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
}

/**
 * Tier-sized staging surface for animated-source sampling: the owned provider
 * canvas (viewport-sized) is downscaled into this before getImageData runs,
 * bounding the per-sample pixel work on every tier.
 */
export function resolveAnimatedStagingSize(
  width: number,
  height: number,
  tier: QualityTier,
): { width: number; height: number } {
  const maxDim = [720, 600, 480, 384][tier] ?? 720
  const scale = Math.min(1, maxDim / Math.max(1, width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Create the Black hole provider. The owned canvas comes from the injected
 * factory; all frame math lives in the pure functions above.
 */
export function createBlackHoleProvider(deps: {
  createCanvas: AnimatedCanvasFactory
}): AnimatedSourceProvider {
  const model = buildBlackHoleModel()
  let canvas: AnimatedCanvasLike | null = null
  let ctx: AnimatedDrawContext | null = null
  let running = false
  let paused = false
  let lastError: string | null = null

  const start = (size: { width: number; height: number }): boolean => {
    if (running) return true
    const surface = deps.createCanvas(
      Math.max(1, Math.round(size.width)),
      Math.max(1, Math.round(size.height)),
    )
    const context = surface ? surface.getContext('2d') : null
    if (!surface || !context) {
      lastError = 'Could not create 2D context'
      canvas = null
      ctx = null
      running = false
      return false
    }
    canvas = surface
    ctx = context
    running = true
    paused = false
    lastError = null
    return true
  }

  const resize = (width: number, height: number): void => {
    if (!running || !canvas) return
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    if (canvas.width === w && canvas.height === h) return
    canvas.width = w
    canvas.height = h
  }

  const renderFrame = (timeSeconds: number): boolean => {
    if (!running || paused || !canvas || !ctx) return false
    try {
      renderBlackHoleFrame(ctx, model, canvas.width, canvas.height, timeSeconds)
      lastError = null
      return true
    } catch (error) {
      // The previously drawn frame stays on the owned canvas; the caller
      // keeps its last valid sampled field and only falls back to the JH
      // mark when no valid frame exists at all.
      lastError = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  const setPaused = (next: boolean): void => {
    paused = next
  }

  const stop = (): void => {
    running = false
    paused = false
    canvas = null
    ctx = null
  }

  return {
    start,
    resize,
    renderFrame,
    setPaused,
    stop,
    isRunning: () => running,
    getLastError: () => lastError,
  }
}
