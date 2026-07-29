/**
 * Launch diagnostics (M7): one typed snapshot of scene health, written by the
 * canvas engine and read by React at a throttled rate. Everything in this
 * module is pure and unit-testable; the DOM/RAF wiring lives in
 * components/SceneCanvas.tsx.
 */

type SourceStatus = 'idle' | 'loading' | 'ready' | 'error'
type SourceKind = 'builtin' | 'svg' | 'raster' | 'animated' | 'fallback'
type PointerKind = 'mouse' | 'touch' | 'none'

type SimulationParams = {
  spring: number
  damp: number
  mouseR: number
  particleRepel: number
  weatherRepelMult: number
}

type SceneDiagnosticsSnapshot = {
  // Experience and active scene identity (passed down from the shell).
  experience: string
  sceneId: string
  // Render mode of the canvas scene itself.
  mode: string
  // Active target source.
  sourceId: string
  sourceKind: SourceKind
  sourceStatus: SourceStatus
  sourceError: string | null
  sourceDecodeMs: number | null
  targetRebuildCount: number
  // Field composition.
  targetCount: number
  glyphCount: number
  assignedCount: number
  unassignedCount: number
  visibleCount: number
  hiddenCount: number
  // Frame timing over the rolling window.
  fps: number
  avgFrameMs: number
  worstFrameMs: number
  framesInWindow: number
  // Environment.
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number
  reducedMotion: boolean
  // Pointer.
  pointerType: PointerKind
  pointerActive: boolean
  pointerX: number
  pointerY: number
  // Click/tap radial impulses (patched on pointerdown only).
  impulseCount: number
  lastImpulseAffected: number
  // Motion system (off / organic-flow / parametric-creature) and its variant.
  motionMode: string
  motionVariant: string
  // Requested values stay visible in the UI; effective values are the
  // device-aware clamps the engine actually runs at.
  motionRequestedDensity: number
  motionEffectiveDensity: number
  motionRequestedUpdateRate: number
  motionEffectiveUpdateRate: number
  // Non-destructive paint overlay: targets with an active paint override.
  paintedTargetCount: number
  // Paint strokes that modify the background channel (marks or erases).
  paintedBackgroundStrokeCount: number
  // Adaptive quality (engine/qualityTiers): current tier, what forced it,
  // and the effective budgets the engine actually runs at.
  qualityTier: number
  qualityTierOverride: boolean
  qualityLastTransition: string
  qualityGlyphCap: number
  qualityCreatureCap: number
  qualityCreatureRate: number
  qualityAmbientCap: number
  qualityAmbientTickHz: number
  // Ambient layer (engine/ambientField): mode, live agent count, and the
  // smoothed collision-pass cost per physics tick.
  ambientMode: string
  ambientAgentCount: number
  ambientCollisionMs: number
  // Determinism and core simulation parameters.
  seed: number
  simParams: SimulationParams
}

type FrameTimingSummary = {
  fps: number
  avgFrameMs: number
  worstFrameMs: number
  framesInWindow: number
}

// Seed for initial glyph placement; reported so a misbehaving field can be
// reproduced exactly. SceneCanvas imports this instead of defining its own.
const GLYPH_INIT_SEED = 0x9e3779b9

// React-facing snapshot pushes are throttled to 5Hz — frequent enough to feel
// live in the tuning panel, far below frame rate.
const DIAGNOSTICS_PUSH_INTERVAL_MS = 200

// Rolling frame-timing window: ~2 seconds of samples at 60fps.
const FRAME_TIMING_WINDOW_SIZE = 120

const createDefaultDiagnosticsSnapshot = (): SceneDiagnosticsSnapshot => ({
  experience: 'intro',
  sceneId: 'intro',
  mode: 'svg',
  sourceId: 'none',
  sourceKind: 'builtin',
  sourceStatus: 'idle',
  sourceError: null,
  sourceDecodeMs: null,
  targetRebuildCount: 0,
  targetCount: 0,
  glyphCount: 0,
  assignedCount: 0,
  unassignedCount: 0,
  visibleCount: 0,
  hiddenCount: 0,
  fps: 0,
  avgFrameMs: 0,
  worstFrameMs: 0,
  framesInWindow: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  devicePixelRatio: 1,
  reducedMotion: false,
  pointerType: 'none',
  pointerActive: false,
  pointerX: 0,
  pointerY: 0,
  impulseCount: 0,
  lastImpulseAffected: 0,
  motionMode: 'off',
  motionVariant: 'original',
  motionRequestedDensity: 0,
  motionEffectiveDensity: 0,
  motionRequestedUpdateRate: 0,
  motionEffectiveUpdateRate: 0,
  paintedTargetCount: 0,
  paintedBackgroundStrokeCount: 0,
  qualityTier: 0,
  qualityTierOverride: false,
  qualityLastTransition: 'initial',
  qualityGlyphCap: 0,
  qualityCreatureCap: 0,
  qualityCreatureRate: 0,
  qualityAmbientCap: 0,
  qualityAmbientTickHz: 0,
  ambientMode: 'off',
  ambientAgentCount: 0,
  ambientCollisionMs: 0,
  seed: GLYPH_INIT_SEED,
  simParams: {
    spring: 0,
    damp: 0,
    mouseR: 0,
    particleRepel: 0,
    weatherRepelMult: 0,
  },
})

// Fixed-capacity ring buffer of frame durations plus their timestamps. Kept
// allocation-free after creation so it can be recorded into once per frame.
const createFrameTimingAccumulator = (windowSize: number = FRAME_TIMING_WINDOW_SIZE) => {
  const durations: number[] = new Array(windowSize)
  const timestamps: number[] = new Array(windowSize)
  let head = 0
  let count = 0
  let total = 0
  let worst = 0

  const rescanWorst = () => {
    worst = count > 0 ? durations[head] : 0
    for (let i = 1; i < count; i += 1) {
      const value = durations[(head + i) % windowSize]
      if (value > worst) worst = value
    }
  }

  const record = (durationMs: number, timestampMs: number) => {
    if (count === windowSize) {
      const evicted = durations[head]
      total -= evicted
      durations[head] = durationMs
      timestamps[head] = timestampMs
      head = (head + 1) % windowSize
      total += durationMs
      if (durationMs >= worst) {
        worst = durationMs
      } else if (evicted === worst) {
        // The sample that held the worst time just left the window.
        rescanWorst()
      }
    } else {
      const tail = (head + count) % windowSize
      durations[tail] = durationMs
      timestamps[tail] = timestampMs
      count += 1
      total += durationMs
      if (durationMs > worst) worst = durationMs
    }
  }

  const summary = (): FrameTimingSummary => {
    if (count === 0) {
      return { fps: 0, avgFrameMs: 0, worstFrameMs: 0, framesInWindow: 0 }
    }
    const oldest = timestamps[head]
    const newest = timestamps[(head + count - 1) % windowSize]
    const spanMs = newest - oldest
    const fps = count > 1 && spanMs > 0 ? ((count - 1) / spanMs) * 1000 : 0
    return {
      fps,
      avgFrameMs: total / count,
      worstFrameMs: worst,
      framesInWindow: count,
    }
  }

  const reset = () => {
    head = 0
    count = 0
    total = 0
    worst = 0
  }

  return { record, summary, reset }
}

export type {
  FrameTimingSummary,
  PointerKind,
  SceneDiagnosticsSnapshot,
  SimulationParams,
  SourceKind,
  SourceStatus,
}
export {
  createDefaultDiagnosticsSnapshot,
  createFrameTimingAccumulator,
  DIAGNOSTICS_PUSH_INTERVAL_MS,
  FRAME_TIMING_WINDOW_SIZE,
  GLYPH_INIT_SEED,
}
