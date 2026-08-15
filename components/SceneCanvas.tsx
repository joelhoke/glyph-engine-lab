'use client'

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext'
import { createPointerListeners } from '../engine/Pointer'
import {
  MeshBgs,
  ParagraphTarget,
  Particle,
  UnassignedGlyphBehavior,
} from '../engine/types'
import {
  DAMP,
  LOGO_PATHS,
  LOGO_TARGET_STEP,
  SPRING,
  TYPEWRITER_CPS,
  defaultSceneState,
} from '../engine/constants'
import { loadSvgTargets, SourceLayoutConfig } from '../engine/svgTargetSource'
import { resolveSourceFieldDecision } from '../engine/sourceOutcome'
import { packSourceRgba, sampleTargetField } from '../engine/targetSampling'
import {
  AnimatedSourceProvider,
  BLACK_HOLE_REDUCED_POSE_TIME,
  createBlackHoleProvider,
  resolveAnimatedStagingSize,
  SceneSourceSelection,
} from '../engine/animatedSource'
import {
  applyHorizontalGlyphGradient,
  LANDING_GLYPH_GRADIENT_THEMES,
} from '../engine/backgroundLuminance'
import { ThemeName } from '../engine/theme'
import { LANDING_SOURCE_URL } from '../engine/sceneConfig'
import { createSeededRandom, RandomSource } from '../engine/random'
import {
  isMobileViewport,
  resolveGlyphBudget,
  resolveRenderPixelRatio,
  resolveSamplingStep,
} from '../engine/displayBudget'
import { assignGlyphsToTargets } from '../engine/glyphAssignment'
import {
  clampGlyphPointSize,
  resolveEffectiveGlyphSize,
  resolveGlyphLineHeight,
  resolveGlyphSamplingScale,
} from '../engine/glyphSize'
import { applyRadialImpulse } from '../engine/impulse'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  PlaygroundConfig,
} from '../engine/playgroundConfig'
import {
  AMBIENT_DEFAULTS,
  AmbientConfig,
  BACKDROP_OPACITY_DEFAULT,
  clampAmbientConfig,
} from '../engine/ambientConfig'
import {
  AmbientField,
  AmbientCollisionGrid,
  applyAmbientRadialImpulse,
  createAmbientCollisionGrid,
  createAmbientField,
  MATRIX_GLYPH_WIDTH,
  MATRIX_LINE_HEIGHT,
  normalizeAmbientField,
  rebuildAmbientCollisionGrid,
  resolveAmbientCollisions,
  resolveAmbientCount,
  stepAmbientField,
  WEATHER_PROFILES,
} from '../engine/ambientField'
import {
  createQualityController,
  EffectiveQualityBudget,
  QualityController,
  QualityTier,
  resolveEffectiveQualityBudget,
  subsampleStrided,
} from '../engine/qualityTiers'
import {
  clampMotionConfig,
  MOTION_DEFAULTS,
  MotionConfig,
  MotionQuality,
  resolveMotionQuality,
} from '../engine/motionConfig'
import {
  buildCreatureTopology,
  buildMotionBaseField,
  computeCreatureTargets,
  computeOrganicTargets,
  CreatureTopology,
  MotionBaseField,
  MotionWaveParams,
} from '../engine/motion'
import {
  appendInterpolatedPoints,
  buildTargetSpatialIndex,
  clearPaintHistory,
  clonePaintSnapshot,
  countBackgroundStrokes,
  createPaintHistory,
  PAINT_BRUSH_DIAMETER_DEFAULT,
  PAINT_BRUSH_DIAMETER_MAX,
  PAINT_BRUSH_DIAMETER_MIN,
  PAINT_MAX_POINTS,
  PaintHistory,
  PaintSnapshot,
  PaintStatus,
  PaintStroke,
  PaintToolConfig,
  paintHistoryFromStrokes,
  popStroke,
  pushStroke,
  replayPaintHistory,
  stampPoint,
  TargetSpatialIndex,
} from '../engine/paint'
import {
  createEvolutionRing,
  createEvolvingRecord,
  createEvolutionParams,
  clearEvolutionRing,
  dropOldestEvolving,
  evolutionParamsAt,
  evolvingRecordAt,
  EVOLUTION_SETTLE_MS,
  EvolutionParams,
  EvolutionRing,
  EvolvingStrokeRecord,
  grainAlphaFactor,
  grainDarkVariant,
  grainRadiusFactor,
  isEvolutionSettled,
  isStrokeEvolving,
  peekOldestEvolving,
  pushEvolvingStroke,
} from '../engine/paintEvolution'
import {
  buildTargetSpatialDataFromArrays,
  buildWordColorIndices,
  formatRgba,
  GlyphColorMode,
  parseHexColor,
  resolveGlyphAlphaScale,
  resolveGlyphColor,
  Rgb,
} from '../engine/colorDistribution'
import {
  createDefaultDiagnosticsSnapshot,
  createFrameTimingAccumulator,
  DIAGNOSTICS_PUSH_INTERVAL_MS,
  GLYPH_INIT_SEED,
  PointerKind,
  SceneDiagnosticsSnapshot,
} from '../engine/diagnostics'
import { ExperienceMode } from '../engine/types'
type SequenceDiagnostics = {
  phase: string
  elapsedMs: number
  phaseProgress: number
  speed: number
  documentHidden: boolean
}

type SceneDiagnostics = SceneDiagnosticsSnapshot

type SceneMode = 'svg' | 'paragraph'

/** Viewport-relative rect (CSS px) that bounds the source target field — the
 *  mobile Work glyph stage. Null = the field fits the full viewport. */
export type SceneTargetRegion = {
  x: number
  y: number
  width: number
  height: number
}

const QUOTE = "Voilà! In view, a humble vaudevillian veteran cast vicariously as both victim and villain by the vicissitudes of Fate... you may call me 'V'."
const FULL_TEXT = Array(25).fill(QUOTE).join(' ')

const RESIZE_DEBOUNCE_MS = 150

/** Deterministic representative pose time (seconds) for reduced-motion users. */
const MOTION_REDUCED_POSE_TIME = 0.8

/** Fixed tick count advanced from initialization to reach the reduced-motion
 *  static ambient pose (deterministic — same seed, same frame). */
const AMBIENT_REDUCED_POSE_TICKS = 90

/** Pointer repel strength on ambient agents scales the scene's weather repel
 *  multiplier into the pool's velocity-impulse integration. */
const AMBIENT_POINTER_REPEL_SCALE = 0.15

/** EMA smoothing for the collision-pass cost diagnostic. */
const AMBIENT_COLLISION_COST_SMOOTHING = 0.2

/** Matrix trail fade per frame, mapped from trailStrength 0–100: short trails
 *  fade fast, long trails persist. */
const matrixTrailFade = (trailStrength: number) =>
  lerp(0.35, 0.05, clamp(trailStrength, 0, 100) / 100)

const DISABLED_PAINT_TOOL: PaintToolConfig = {
  enabled: false,
  tool: 'paint',
  glyphColor: 'none',
  backgroundColor: 'none',
  brushDiameter: PAINT_BRUSH_DIAMETER_DEFAULT,
}

/** Landing logo scale at or below this counts as a scale-in (re)start: the
 *  glyph population snaps to the logo center so the animation grows from it. */
const LANDING_SCALE_RESTART_EPSILON = 0.001

/** Theme cross-fade (feature/light-dark): on a live system-theme change the
 *  last completed frame is retained as a snapshot and faded out over the
 *  re-themed scene — 1 → 0 over exactly this long, ease-in-out. */
const THEME_FADE_DURATION_MS = 500

/** Built-in monogram fill per theme: white on dark; on light the mark is
 *  rasterized in the light theme's ink color so `source-colors` paints it
 *  visibly (the landing recolors the field with its own gradient anyway). */
const MONOGRAM_FILL: Record<ThemeName, string> = {
  dark: '#fff',
  light: '#101826',
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function buildMeshBg(colorA: string, colorB: string, base: string, W: number, H: number) {
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.fillStyle = base
  c.fillRect(0, 0, W, H)
  const blobs = [
    { x: W * 0.15, y: H * 0.2, r: Math.max(W, H) * 0.7, color: colorA },
    { x: W * 0.85, y: H * 0.1, r: Math.max(W, H) * 0.6, color: colorB },
    { x: W * 0.75, y: H * 0.85, r: Math.max(W, H) * 0.8, color: colorB },
    { x: W * 0.1, y: H * 0.95, r: Math.max(W, H) * 0.55, color: colorA },
    { x: W * 0.5, y: H * 0.5, r: Math.max(W, H) * 0.45, color: base },
  ]
  for (const b of blobs) {
    const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
    g.addColorStop(0, b.color)
    g.addColorStop(1, b.color + '00')
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
  }
  return cv
}


type SceneCanvasProps = {
  className?: string
  tuningMode?: boolean
  sequenceDiagnostics?: SequenceDiagnostics
  mouseR?: number
  particleRepel?: number
  weatherRepelMult?: number
  clickImpulseRadius?: number
  clickImpulseForce?: number
  sourceLayout?: SourceLayoutConfig
  /** What the field samples its targets from (built-in mark, static image,
   *  or an animated provider). Defaults to the built-in mark. */
  source?: SceneSourceSelection
  /** Optional rect (CSS px, viewport-relative) the source target field is
   *  fitted into — the mobile Work glyph stage. Null/undefined fits the full
   *  viewport. Only the source target field is region-bound; the ambient
   *  layer and pointer physics span the whole canvas. */
  targetRegion?: SceneTargetRegion | null
  playgroundConfig?: PlaygroundConfig
  /** Active system theme (feature/light-dark): drives the landing glyph
   *  gradient, the built-in monogram fill, and the cross-fade on change.
   *  Defaults to 'dark'. */
  theme?: ThemeName
  /** Vibe-only paint tool state; undefined disables painting entirely. */
  paintTool?: PaintToolConfig
  onPaintStatusChange?: (status: PaintStatus) => void
  /** Fired when a completed stroke is committed to the paint history, so the
   *  parent can record a unified-history transaction around it. */
  onPaintStrokeEnd?: () => void
  experience?: ExperienceMode
  sceneId?: string
  onDiagnosticsUpdate?: (snapshot: SceneDiagnostics) => void
  /** Dev tuning override for the adaptive quality tier; null/undefined = Auto. */
  qualityTierOverride?: QualityTier | null
  /** Fired when the adaptive controller actually changes tier (auto or override). */
  onQualityTierChange?: (from: QualityTier, to: QualityTier) => void
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const r = parseInt(normalized.substring(0, 2), 16)
  const g = parseInt(normalized.substring(2, 4), 16)
  const b = parseInt(normalized.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export type SceneCanvasHandle = {
  getCanvas: () => HTMLCanvasElement | null
  undoPaint: () => void
  redoPaint: () => void
  clearPaint: () => void
  getPaintStatus: () => PaintStatus
  /** Deep-copied snapshot of the whole paint overlay (stroke history + paint
   *  redo stack) for the unified Vibe undo history. */
  capturePaintState: () => PaintSnapshot
  /** Restore a snapshot taken by capturePaintState: replaces the stroke
   *  history and redo stack, replays the overlay, and re-renders. */
  restorePaintState: (snapshot: PaintSnapshot) => void
  /** Landing scale-in driver: writes the current logo scale (0–1) into a ref
   *  the frame loop reads. Allocation-free, no React state — safe to call at
   *  full requestAnimationFrame cadence. A (re)start at ~0 snaps every glyph
   *  to the logo center so the scale-in originates there. */
  setLandingLogoScale: (scale: number) => void
}

function SceneCanvasInternal(
  {
    className,
    tuningMode,
    sequenceDiagnostics,
    mouseR = defaultSceneState.mouseR,
    particleRepel = 0.48,
    weatherRepelMult = 6,
    clickImpulseRadius = 200,
    clickImpulseForce = 10,
    sourceLayout,
    source,
    targetRegion = null,
    playgroundConfig,
    theme = 'dark',
    paintTool,
    onPaintStatusChange,
    onPaintStrokeEnd,
    experience = 'intro',
    sceneId = 'intro',
    onDiagnosticsUpdate,
    qualityTierOverride = null,
    onQualityTierChange,
  }: SceneCanvasProps,
  ref: React.ForwardedRef<SceneCanvasHandle>,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    undoPaint,
    redoPaint,
    clearPaint,
    getPaintStatus,
    capturePaintState,
    restorePaintState,
    setLandingLogoScale,
  }))
  const meshBgsRef = useRef<MeshBgs | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const paragraphTargetsRef = useRef<ParagraphTarget[]>([])
  const sourceCharsRef = useRef<string[]>([])
  const logoTargetsRef = useRef<{ tx: number; ty: number }[]>([])
  const preparedTextRef = useRef<any>(null)
  const totalCharsRef = useRef(0)
  const typewriterStartRef = useRef<number>(0)
  const animationRef = useRef<number | null>(null)
  // Re-arms a single frame when the render loop is stopped (reduced-motion
  // static path, hidden tab). The loop effect below installs the real
  // implementation; calling it while the loop runs is a no-op.
  const renderOnceRef = useRef<() => void>(() => {})
  const mouseRRef = useRef(defaultSceneState.mouseR)
  const sceneModeRef = useRef<SceneMode>('svg')
  // Immutable base target field (typed arrays from the one-time rasterization)
  // plus the effective field the draw loop reads. Motion Off points the active
  // arrays straight at the base; organic/creature modes point them at the
  // reusable motion buffers.
  const baseTargetsXRef = useRef<Float32Array>(new Float32Array(0))
  const baseTargetsYRef = useRef<Float32Array>(new Float32Array(0))
  const baseColorsRef = useRef<Uint32Array>(new Uint32Array(0))
  const baseCountRef = useRef(0)
  // Full-resolution source field, kept unsampled so quality-tier transitions
  // can re-derive the tier-capped base field without reloading the source.
  const fullFieldXRef = useRef<Float32Array>(new Float32Array(0))
  const fullFieldYRef = useRef<Float32Array>(new Float32Array(0))
  const fullFieldColorsRef = useRef<Uint32Array>(new Uint32Array(0))
  const fullFieldNormXRef = useRef<Float32Array>(new Float32Array(0))
  const fullFieldNormYRef = useRef<Float32Array>(new Float32Array(0))
  const motionFieldRef = useRef<MotionBaseField>(buildMotionBaseField(
    new Float32Array(0),
    new Float32Array(0),
    new Float32Array(0),
    new Float32Array(0),
  ))
  const activeTargetsXRef = useRef<Float32Array>(new Float32Array(0))
  const activeTargetsYRef = useRef<Float32Array>(new Float32Array(0))
  const activeSourceColorsRef = useRef<Uint32Array>(new Uint32Array(0))
  const activeCountRef = useRef(0)
  const motionBuffersXRef = useRef<Float32Array>(new Float32Array(0))
  const motionBuffersYRef = useRef<Float32Array>(new Float32Array(0))
  const creatureTopologyRef = useRef<CreatureTopology | null>(null)
  const svgTargetMapRef = useRef<Int32Array>(new Int32Array(0))
  const sceneStartRef = useRef<number>(0)
  const reducedMotionRef = useRef(false)
  // Theme (feature/light-dark): the active theme mirror read by the target
  // builders, plus the cross-fade state — a single reusable snapshot canvas
  // holding the last completed frame while the re-themed scene fades in.
  const themeRef = useRef<ThemeName>(theme)
  const themeFadeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const themeFadeStartRef = useRef(0)
  const unassignedBehaviorRef = useRef<UnassignedGlyphBehavior>('hidden')
  const tuningModeRef = useRef<boolean>(false)
  // Stable prop mirrors: every source rebuild reads the latest selection and
  // layout from these refs, so the mount-time ResizeObserver (and any
  // in-flight async load) can never retain a stale initial-props closure.
  const sourceLayoutRef = useRef<SourceLayoutConfig | undefined>(sourceLayout)
  const sourceSelectionRef = useRef<SceneSourceSelection | undefined>(source)
  // Stable mirror of the glyph-stage region: buildSvgTargets reads it at
  // rebuild time, so region recalcs re-fit the ACTIVE source (never a stale
  // closure, never the fallback on a mere recalc).
  const targetRegionRef = useRef<SceneTargetRegion | null>(targetRegion)
  const rebuildSvgTimeoutRef = useRef<number | null>(null)
  const resizeTimeoutRef = useRef<number | null>(null)
  const svgLoadRequestRef = useRef(0)
  // Animated source (Stage 3): the provider owns its offscreen canvas; the
  // staging canvas is the only surface getImageData ever touches. The last
  // sampled field survives provider errors; the JH fallback only appears
  // when no valid frame exists at all.
  const animatedProviderRef = useRef<AnimatedSourceProvider | null>(null)
  const animatedProviderCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const animatedStagingRef = useRef<HTMLCanvasElement | null>(null)
  const animatedTimeRef = useRef(0)
  const animatedLastNowRef = useRef(0)
  const animatedLastSampleRef = useRef(0)
  const animatedHasValidFieldRef = useRef(false)
  const viewportSizeRef = useRef({ width: 0, height: 0 })
  // Capped render pixel ratio (see engine/displayBudget); refreshed on resize
  // and read by the draw functions instead of the raw global.
  const pixelRatioRef = useRef(1)
  const glyphRandomRef = useRef<RandomSource>(createSeededRandom(GLYPH_INIT_SEED))
  const prevTargetCountRef = useRef<number>(0)
  const playgroundConfigRef = useRef<PlaygroundConfig>(
    playgroundConfig ?? APPROVED_PLAYGROUND_DEFAULTS,
  )
  const colorModeRef = useRef<GlyphColorMode>(
    playgroundConfig?.glyphColorMode ?? APPROVED_PLAYGROUND_DEFAULTS.glyphColorMode,
  )
  const paletteRgbRef = useRef<Rgb[]>([])
  const wordColorRef = useRef<number[]>([])
  const targetGradientRef = useRef<Float32Array>(new Float32Array(0))
  const targetRowRef = useRef<Float32Array>(new Float32Array(0))
  // Motion system: clamped config mirror, device-aware quality, procedural
  // clock (frozen while painting), and rate-limited compute bookkeeping.
  const motionConfigRef = useRef<MotionConfig>(
    clampMotionConfig(playgroundConfig?.motion ?? MOTION_DEFAULTS),
  )
  const motionQualityRef = useRef<MotionQuality>({ effectiveDensity: 0, effectiveUpdateRate: 0 })
  const motionTimeRef = useRef(0)
  const motionLastNowRef = useRef(0)
  const lastMotionComputeRef = useRef(0)
  const motionDirtyRef = useRef(true)
  // Ambient layer (Stage 2): a separate typed-array agent pool for the
  // weather/matrix overlay, created/destroyed when ambient.mode changes. The
  // offscreen canvas gives matrix its trail fade without dimming the scene;
  // the collision grid and main-glyph impulse buffers are rebuilt per tick.
  const ambientConfigRef = useRef<AmbientConfig>(
    clampAmbientConfig(playgroundConfig?.ambient ?? AMBIENT_DEFAULTS),
  )
  const ambientFieldRef = useRef<AmbientField | null>(null)
  const ambientRandomRef = useRef<RandomSource>(createSeededRandom(GLYPH_INIT_SEED ^ 0x51f15e))
  const ambientGridRef = useRef<AmbientCollisionGrid | null>(null)
  const ambientMainXRef = useRef<Float32Array>(new Float32Array(0))
  const ambientMainYRef = useRef<Float32Array>(new Float32Array(0))
  const ambientMainImpulseXRef = useRef<Float32Array>(new Float32Array(0))
  const ambientMainImpulseYRef = useRef<Float32Array>(new Float32Array(0))
  const ambientCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const ambientLastTickRef = useRef(0)
  const ambientTickAccumRef = useRef(0)
  const ambientCollisionMsRef = useRef(0)
  const ambientStaticPoseDirtyRef = useRef(true)
  const matrixFontCacheRef = useRef<Map<number, string>>(new Map())
  // Pointer velocity (px/s) for the ambient drag force: smoothed per-frame
  // deltas of the repel pointer.
  const pointerVelocityRef = useRef({ vx: 0, vy: 0, lastX: -9999, lastY: -9999, lastNow: 0 })
  // Adaptive quality (Stage 2): the hysteresis controller and the effective
  // budgets it currently imposes. Created lazily on mount so the mobile start
  // tier and warm-up clock anchor to the real viewport and timestamp.
  const qualityControllerRef = useRef<QualityController | null>(null)
  const qualityBudgetRef = useRef<EffectiveQualityBudget>(
    resolveEffectiveQualityBudget(0, 0),
  )
  const qualityTierOverrideRef = useRef<QualityTier | null>(qualityTierOverride)
  const onQualityTierChangeRef = useRef(onQualityTierChange)
  const qualityResizePendingRef = useRef(false)
  const qualityRebuildPendingRef = useRef(false)
  // Paint overlay: per-target packed-RGBA overrides (0 = unpainted), bounded
  // normalized stroke history, redo stack, and the gesture in progress.
  const paintedColorsRef = useRef<Uint32Array>(new Uint32Array(0))
  const paintedCountRef = useRef(0)
  const paintHistoryRef = useRef<PaintHistory>(createPaintHistory())
  const redoStrokesRef = useRef<PaintStroke[]>([])
  const spatialIndexRef = useRef<TargetSpatialIndex | null>(null)
  const paintToolRef = useRef<PaintToolConfig>(paintTool ?? DISABLED_PAINT_TOOL)
  const onPaintStatusChangeRef = useRef(onPaintStatusChange)
  const onPaintStrokeEndRef = useRef(onPaintStrokeEnd)
  const activeStrokeRef = useRef<{
    pointerId: number
    tool: 'paint' | 'erase'
    glyphColor: number | null
    backgroundColor: number | null
    radiusNorm: number
    points: number[]
    lastX: number
    lastY: number
    stepPx: number
  } | null>(null)
  const pendingPaintPointsRef = useRef<number[]>([])
  const strokeSegmentRef = useRef<number[]>([])
  // Background paint channel: an offscreen layer composited between the bg
  // gradient and the glyphs. Soft-brush sprites are cached by color+size;
  // the layer is re-rendered from stroke history on replay/resize.
  const bgPaintCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const bgPaintCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const bgBrushCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map())
  // Background paint evolution: completed background-channel strokes animate
  // compact/grainy → elongated → settled over 7s (engine/paintEvolution),
  // rendered per frame on a sibling low-res layer composited above the
  // settled layer, then baked into the settled layer and dropped. The ring
  // is fixed-size (max 8); scratch params/transform keep frames alloc-free.
  const evolveRingRef = useRef<EvolutionRing>(createEvolutionRing())
  const bgEvolveCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const bgEvolveCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const bgEvolveHasContentRef = useRef(false)
  const evolveParamsScratchRef = useRef(createEvolutionParams())
  // Photoshop-style brush ring: a DOM overlay (not drawn to canvas, so PNG
  // exports stay clean) positioned imperatively from the pointer handlers.
  const brushRingRef = useRef<HTMLDivElement | null>(null)
  const [diagnostics, setDiagnostics] = useState<SceneDiagnostics>(() =>
    createDefaultDiagnosticsSnapshot(),
  )
  // Mutable mirror of the diagnostics state: the frame loop reads/writes it
  // without React state updates and hands a copy to React at a throttled rate.
  const diagnosticsRef = useRef<SceneDiagnostics>(createDefaultDiagnosticsSnapshot())
  const frameTimingRef = useRef(createFrameTimingAccumulator())
  const lastDiagnosticsPushRef = useRef(0)
  const visibleCountRef = useRef(0)
  const hiddenCountRef = useRef(0)
  const experienceRef = useRef<ExperienceMode>(experience)
  const sceneIdRef = useRef(sceneId)
  const onDiagnosticsUpdateRef = useRef(onDiagnosticsUpdate)
  // Landing scale-in (intro): the current logo scale written imperatively via
  // setLandingLogoScale, and the centroid of the active target field the
  // scale transform pulls every glyph target toward. Both read per frame;
  // the centroid object is mutated in place (allocation-free).
  const landingLogoScaleRef = useRef(1)
  const landingCentroidRef = useRef({ x: 0, y: 0 })

  // Event-driven diagnostic updates (source loads, mode switches, rebuilds)
  // are rare, so they patch both the mirror and React state directly.
  const patchDiagnostics = (patch: Partial<SceneDiagnostics>) => {
    Object.assign(diagnosticsRef.current, patch)
    // Debug-mode browser hook (dev ?debug=true only): automated interaction
    // tests read the live mirror (pointer state, impulse count, painted
    // counts) from here. Never populated in production builds.
    if (tuningModeRef.current && typeof window !== 'undefined') {
      ;(
        window as unknown as { __JH_SCENE_DIAGNOSTICS__?: SceneDiagnostics }
      ).__JH_SCENE_DIAGNOSTICS__ = diagnosticsRef.current
    }
    setDiagnostics((prev) => ({ ...prev, ...patch }))
  }

  const particleRepelRef = useRef(particleRepel)
  const weatherRepelRef = useRef(weatherRepelMult)
  const clickImpulseRadiusRef = useRef(clickImpulseRadius)
  const clickImpulseForceRef = useRef(clickImpulseForce)

  const [fontSize, setFontSize] = useState(defaultSceneState.fontSize)
  const [textAmount, setTextAmount] = useState(defaultSceneState.textAmount)

  const glyphSizePt = clampGlyphPointSize(
    playgroundConfig?.glyphSizePt ?? APPROVED_PLAYGROUND_DEFAULTS.glyphSizePt,
  )
  const glyphFont = playgroundConfig?.glyphFont ?? APPROVED_PLAYGROUND_DEFAULTS.glyphFont

  // The effective size honors the mobile 8pt cap for non-Vibe scenes; it is
  // resolved from the live viewport at read time (applyEffectiveGlyphSize,
  // called by resizeScene and the config effect), so breakpoint crossings
  // stay correct. fontSize above remains the fixed 12pt base for ambient
  // typography and the paragraph fallback.
  const fontRef = useRef(`400 ${glyphSizePt}px ${glyphFont}`)
  const lineHeightRef = useRef(resolveGlyphLineHeight(glyphSizePt))
  const glyphSizeRef = useRef(glyphSizePt)
  const effectiveGlyphSizeRef = useRef(glyphSizePt)

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateReducedMotion = () => {
      reducedMotionRef.current = reducedMotionQuery.matches
      // Animated sources re-sample their single deterministic pose frame.
      scheduleSvgTargetRebuild()
      // Turning reduced motion on renders one last settled frame before the
      // loop stops; turning it off restarts the continuous loop.
      renderOnceRef.current()
    }

    updateReducedMotion()
    reducedMotionQuery.addEventListener('change', updateReducedMotion)
    return () => reducedMotionQuery.removeEventListener('change', updateReducedMotion)
  }, [])

  // Capture the current canvas into the reusable cross-fade snapshot. The
  // allocation happens once per fade window (never per frame) and the canvas
  // is released — the ref nulled — when the fade completes in the frame loop.
  const beginThemeFade = () => {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0 || canvas.height === 0) return
    let snapshot = themeFadeCanvasRef.current
    if (!snapshot) {
      snapshot = document.createElement('canvas')
      themeFadeCanvasRef.current = snapshot
    }
    snapshot.width = canvas.width
    snapshot.height = canvas.height
    const snapshotCtx = snapshot.getContext('2d')
    if (!snapshotCtx) {
      themeFadeCanvasRef.current = null
      return
    }
    snapshotCtx.drawImage(canvas, 0, 0)
    themeFadeStartRef.current = performance.now()
  }

  // Live theme change (feature/light-dark): retain the last completed frame
  // as a snapshot, rebuild the source field so theme-dependent colors (the
  // landing gradient, the built-in monogram fill) resolve against the new
  // theme, and fade the snapshot out over THEME_FADE_DURATION_MS in the frame
  // loop. Reduced motion skips the fade entirely — the re-themed static
  // canvas simply repaints via the rebuild's renderOnce re-arm.
  useEffect(() => {
    if (themeRef.current === theme) return
    themeRef.current = theme
    if (!reducedMotionRef.current) beginThemeFade()
    scheduleSvgTargetRebuild()
    renderOnceRef.current()
  }, [theme])

  // Point size is structural: when the effective size changes, the source
  // field re-samples through the standard rebuild path (targets rebuilt,
  // normalized paint replayed inside applyMotionField). The font/line-height
  // refs update immediately, so the frame loop's ctx.font follows next frame.
  useEffect(() => {
    glyphSizeRef.current = glyphSizePt
    const prevSize = effectiveGlyphSizeRef.current
    applyEffectiveGlyphSize()
    // playgroundConfigRef syncs in the config-watch effect after this one, so
    // apply the render-time family directly to never lag a font change.
    fontRef.current = `400 ${effectiveGlyphSizeRef.current}px ${glyphFont}`
    if (effectiveGlyphSizeRef.current !== prevSize) scheduleSvgTargetRebuild()
  }, [glyphSizePt, glyphFont, experience])
  useEffect(() => { qualityTierOverrideRef.current = qualityTierOverride }, [qualityTierOverride])
  useEffect(() => { onQualityTierChangeRef.current = onQualityTierChange }, [onQualityTierChange])
  // Debug tier override (dev tuning UI): force a tier or return to Auto.
  useEffect(() => {
    const controller = qualityControllerRef.current
    if (!controller) return
    const transition = controller.setOverride(qualityTierOverride ?? null, performance.now())
    if (transition) applyQualityTier()
    patchAmbientDiagnostics()
  }, [qualityTierOverride])
  useEffect(() => { mouseRRef.current = mouseR }, [mouseR])
  useEffect(() => { particleRepelRef.current = particleRepel }, [particleRepel])
  useEffect(() => { weatherRepelRef.current = weatherRepelMult }, [weatherRepelMult])
  useEffect(() => { clickImpulseRadiusRef.current = clickImpulseRadius }, [clickImpulseRadius])
  useEffect(() => { clickImpulseForceRef.current = clickImpulseForce }, [clickImpulseForce])
  useEffect(() => { tuningModeRef.current = tuningMode ?? false }, [tuningMode])
  useEffect(() => { experienceRef.current = experience }, [experience])
  useEffect(() => { sceneIdRef.current = sceneId }, [sceneId])
  useEffect(() => { onDiagnosticsUpdateRef.current = onDiagnosticsUpdate }, [onDiagnosticsUpdate])
  useEffect(() => { onPaintStatusChangeRef.current = onPaintStatusChange }, [onPaintStatusChange])
  useEffect(() => { onPaintStrokeEndRef.current = onPaintStrokeEnd }, [onPaintStrokeEnd])
  useEffect(() => {
    paintToolRef.current = paintTool ?? DISABLED_PAINT_TOOL
    // Toggling paint mode off mid-gesture settles the stroke gracefully.
    if (!paintToolRef.current.enabled && activeStrokeRef.current) {
      endPaintStroke()
    }
    // Keep the brush ring in sync with the tool: diameter and erase style.
    const ring = brushRingRef.current
    if (ring) {
      const tool = paintToolRef.current
      const diameter = clamp(
        tool.brushDiameter,
        PAINT_BRUSH_DIAMETER_MIN,
        PAINT_BRUSH_DIAMETER_MAX,
      )
      ring.style.width = `${diameter}px`
      ring.style.height = `${diameter}px`
      ring.classList.toggle('paint-brush-ring-erase', tool.tool === 'erase')
      if (!tool.enabled) ring.style.opacity = '0'
    }
  }, [paintTool])

  // Move/show the brush ring at a canvas-space point (touch gets the same
  // finger-offset the repel pointer uses). DOM-only — no React state.
  const updateBrushRing = (x: number, y: number, visible: boolean) => {
    const ring = brushRingRef.current
    if (!ring) return
    ring.style.opacity = visible ? '1' : '0'
    if (visible) {
      ring.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    }
  }
  const updateColorMetadata = (config: PlaygroundConfig) => {
    const palette =
      config.glyphPalette.length > 0 ? config.glyphPalette : APPROVED_PLAYGROUND_DEFAULTS.glyphPalette
    paletteRgbRef.current = palette.map(parseHexColor)
    colorModeRef.current = config.glyphColorMode ?? APPROVED_PLAYGROUND_DEFAULTS.glyphColorMode
    const { indices } = buildWordColorIndices(
      config.glyphText.trim().length > 0
        ? config.glyphText
        : APPROVED_PLAYGROUND_DEFAULTS.glyphText,
      palette.length,
    )
    wordColorRef.current = indices
  }

  useEffect(() => {
    playgroundConfigRef.current = playgroundConfig ?? APPROVED_PLAYGROUND_DEFAULTS
    sourceCharsRef.current = Array.from(
      playgroundConfigRef.current.glyphText.trim().length > 0
        ? playgroundConfigRef.current.glyphText
        : APPROVED_PLAYGROUND_DEFAULTS.glyphText,
    )
    updateColorMetadata(playgroundConfigRef.current)

    // Motion configuration: clamp the requested values, resolve device-aware
    // quality, and only rebuild the target field for structural changes
    // (mode/variant/effective density). Ordinary parameter changes just mark
    // the next compute dirty, so paint and the population are preserved.
    const nextMotion = clampMotionConfig(
      playgroundConfigRef.current.motion ?? MOTION_DEFAULTS,
    )
    const prevMotion = motionConfigRef.current
    const prevQuality = motionQualityRef.current
    motionConfigRef.current = nextMotion
    motionQualityRef.current = resolveEffectiveMotionQuality(nextMotion)
    patchMotionDiagnostics()
    const structuralChange =
      prevMotion.mode !== nextMotion.mode ||
      (nextMotion.mode === 'parametric-creature' &&
        (prevMotion.variant !== nextMotion.variant ||
          prevQuality.effectiveDensity !== motionQualityRef.current.effectiveDensity ||
          // Custom-lab structural knobs (form/symmetry) rebuild the topology;
          // travel/pulse/waves are compute-time and stay non-destructive.
          (nextMotion.variant === 'custom' &&
            (prevMotion.custom.form !== nextMotion.custom.form ||
              prevMotion.custom.symmetry !== nextMotion.custom.symmetry))))
    if (structuralChange) {
      applyMotionField()
    } else if (nextMotion.mode !== 'off') {
      motionDirtyRef.current = true
      renderOnceRef.current()
    }

    // Ambient configuration: clamp, then rebuild the agent pool only for
    // structural changes (mode, weather preset, matrix spread) — every other
    // knob is read per physics tick, so the pool and its agents survive.
    const nextAmbient = clampAmbientConfig(
      playgroundConfigRef.current.ambient ?? AMBIENT_DEFAULTS,
    )
    const prevAmbient = ambientConfigRef.current
    ambientConfigRef.current = nextAmbient
    if (
      prevAmbient.mode !== nextAmbient.mode ||
      prevAmbient.weather.preset !== nextAmbient.weather.preset ||
      prevAmbient.matrix.spread !== nextAmbient.matrix.spread
    ) {
      rebuildAmbientField()
    } else {
      // Non-structural knob edits still refresh the reduced-motion pose.
      ambientStaticPoseDirtyRef.current = true
      renderOnceRef.current()
    }
    patchAmbientDiagnostics()
  }, [playgroundConfig])
  useEffect(() => {
    if (onDiagnosticsUpdate && diagnostics.targetCount !== prevTargetCountRef.current) {
      prevTargetCountRef.current = diagnostics.targetCount
      onDiagnosticsUpdate({ ...diagnosticsRef.current })
    }
  }, [diagnostics.targetCount, onDiagnosticsUpdate])
  useEffect(() => {
    sourceLayoutRef.current = sourceLayout
    scheduleSvgTargetRebuild()
  }, [sourceLayout])

  useEffect(() => {
    sourceSelectionRef.current = source
    scheduleSvgTargetRebuild()
  }, [source])

  // Glyph-stage region: re-fit the active source into the measured rect (or
  // back to the full viewport when the region clears). Routed through
  // resizeScene so the rebuild takes the same path as a viewport resize —
  // never per frame; the parent rounds region values to whole CSS px.
  useEffect(() => {
    const prev = targetRegionRef.current
    targetRegionRef.current = targetRegion
    const changed =
      (prev === null) !== (targetRegion === null) ||
      (prev !== null &&
        targetRegion !== null &&
        (prev.x !== targetRegion.x ||
          prev.y !== targetRegion.y ||
          prev.width !== targetRegion.width ||
          prev.height !== targetRegion.height))
    if (changed) resizeScene()
  }, [targetRegion])

  const scheduleSvgTargetRebuild = () => {
    if (rebuildSvgTimeoutRef.current !== null) {
      window.clearTimeout(rebuildSvgTimeoutRef.current)
    }
    rebuildSvgTimeoutRef.current = window.setTimeout(() => {
      rebuildSvgTimeoutRef.current = null
      if (sceneModeRef.current === 'svg') {
        buildSvgTargets()
      } else {
        buildSvgTargets().then(() => {
          // Keep targets warm for the next time the mode switches back.
        })
      }
    }, 150)
  }

  useEffect(() => {
    mouseRRef.current = mouseR
    particleRepelRef.current = particleRepel
    weatherRepelRef.current = weatherRepelMult
    sourceLayoutRef.current = sourceLayout
  }, [])

  const getActiveText = () => {
    const len = Math.max(1, Math.round(FULL_TEXT.length * textAmount))
    return FULL_TEXT.substring(0, len)
  }

  // The observed canvas-container size is the source of truth; the window
  // dimensions are only a fallback until the ResizeObserver has reported.
  const getViewportSize = () => {
    const observed = viewportSizeRef.current
    if (observed.width > 0 && observed.height > 0) return observed
    return { width: window.innerWidth, height: window.innerHeight }
  }

  // Resolve the effective point size (mobile 8pt cap for non-Vibe scenes)
  // into the refs the frame loop and target builders read. Called on config
  // changes and inside resizeScene, so viewport reads stay resize-safe.
  const applyEffectiveGlyphSize = () => {
    const size = resolveEffectiveGlyphSize(
      glyphSizeRef.current,
      experienceRef.current,
      getViewportSize().width,
    )
    effectiveGlyphSizeRef.current = size
    lineHeightRef.current = resolveGlyphLineHeight(size)
    fontRef.current = `400 ${size}px ${playgroundConfigRef.current.glyphFont}`
  }

  // Larger glyphs get proportionate spacing: the resolved sampling step
  // scales with the effective size relative to the 12pt baseline (this is not
  // just visual scaling — the source field re-samples at the wider step).
  const resolveSceneSamplingStep = (baseStep: number, width: number) =>
    Math.max(
      1,
      resolveSamplingStep(baseStep, width) *
        resolveGlyphSamplingScale(effectiveGlyphSizeRef.current),
    )

  const ensureParticleCount = (count: number) => {
    const particles = particlesRef.current
    const fallback = paragraphTargetsRef.current[0]
    const random = glyphRandomRef.current
    const viewport = getViewportSize()
    // Mobile budget: cap the live population on small viewports (unassigned
    // targets simply stay dark, per the existing assignment behavior). The
    // adaptive quality tier composes its own glyph cap through min().
    const tierCap = qualityBudgetRef.current.glyphCap
    const budgeted = Math.min(
      resolveGlyphBudget(count, viewport.width),
      tierCap > 0 ? tierCap : Number.MAX_SAFE_INTEGER,
    )
    while (particles.length < budgeted) {
      const i = particles.length
      const tx = fallback ? fallback.tx : viewport.width * 0.5
      const ty = fallback ? fallback.ty : viewport.height * 0.5
      particles.push({
        char: sourceCharsRef.current[i % Math.max(1, sourceCharsRef.current.length)] || ' ',
        tx,
        ty,
        x: tx + (random() - 0.5) * 20,
        y: ty + (random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        hue: 120,
        row: 0,
        head: false,
      })
    }
    if (particles.length > budgeted) particles.length = budgeted
  }

  const buildParagraphTargets = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    const text = getActiveText()
    // Never touch sourceCharsRef here: it is owned by the playground-config
    // effect (the scene's glyph text). This builder runs inside resizeScene,
    // and clobbering the chars with the paragraph default made source scenes
    // render the fallback quote after any region/resize rebuild. Paragraph
    // mode draws its own per-target chars, so it does not need the write.
    preparedTextRef.current = prepareWithSegments(text, fontRef.current)
    paragraphTargetsRef.current = []
    ctx.font = fontRef.current
    const W = getViewportSize().width
    const baseWidth = W * 0.78
    const marginLeft = W * 0.11
    const startY = 40
    let cursor = { segmentIndex: 0, graphemeIndex: 0 }
    let lineIndex = 0
    while (true) {
      const line = layoutNextLine(preparedTextRef.current, cursor, baseWidth)
      if (!line) break
      const y = startY + lineIndex * lineHeightRef.current
      let xOffset = 0
      for (let ci = 0; ci < line.text.length; ci += 1) {
        const ch = line.text[ci]
        const charW = ctx.measureText(ch).width
        const tx = marginLeft + xOffset + charW * 0.5
        const ty = y + lineHeightRef.current * 0.5
        paragraphTargetsRef.current.push({
          char: ch,
          tx,
          ty,
          row: lineIndex,
          hue: (lineIndex * 18 + ci * 0.75) % 360,
        })
        xOffset += charW
      }
      cursor = line.end
      lineIndex += 1
      if (lineIndex > 600) break
    }
  }

  // --- Ambient layer (weather/matrix overlay) --------------------------------

  // Create/destroy the typed-array ambient pool. Runs on mode/preset/spread
  // changes, tier-capacity changes, and resize; parameter knobs (intensity,
  // wind, speed, volume, …) are read per tick instead, so they never rebuild.
  const rebuildAmbientField = () => {
    const config = ambientConfigRef.current
    ambientStaticPoseDirtyRef.current = true
    ambientTickAccumRef.current = 0
    ambientLastTickRef.current = 0
    if (config.mode === 'off') {
      ambientFieldRef.current = null
      ambientGridRef.current = null
      ambientCanvasRef.current = null
      ambientCollisionMsRef.current = 0
      renderOnceRef.current()
      return
    }
    const { width, height } = getViewportSize()
    const budget = qualityBudgetRef.current
    const field = createAmbientField(
      config.mode,
      budget.ambientCap,
      width,
      height,
      config,
      ambientRandomRef.current,
    )
    ambientFieldRef.current = field
    ambientGridRef.current = createAmbientCollisionGrid(
      width,
      height,
      field.capacity + particlesRef.current.length,
    )
    renderOnceRef.current()
  }

  const patchAmbientDiagnostics = () => {
    const field = ambientFieldRef.current
    const controller = qualityControllerRef.current
    const budget = qualityBudgetRef.current
    patchDiagnostics({
      ambientMode: ambientConfigRef.current.mode,
      ambientAgentCount: field ? field.count : 0,
      ambientCollisionMs: ambientCollisionMsRef.current,
      qualityTier: budget.tier,
      qualityTierOverride: controller ? controller.isOverrideActive() : false,
      qualityLastTransition: controller ? controller.getLastTransitionReason() : 'initial',
      qualityGlyphCap: budget.glyphCap,
      qualityCreatureCap: budget.creatureCap,
      qualityCreatureRate: budget.creatureRate,
      qualityAmbientCap: budget.ambientCap,
      qualityAmbientTickHz: budget.ambientTickHz,
    })
  }

  const buildAllMeshBgs = () => {
    const { width: W, height: H } = getViewportSize()
    meshBgsRef.current = {
      clear: buildMeshBg('#DAD29C', '#B4EEFF', '#DAD29C', W, H),
      rain: buildMeshBg('#012840', '#364F59', '#1A3A4A', W, H),
      storm: buildMeshBg('#070926', '#281259', '#170E40', W, H),
      wind: buildMeshBg('#6D808C', '#BDAC89', '#94968C', W, H),
      fog: buildMeshBg('#6E6E6E', '#222222', '#454545', W, H),
      snow: buildMeshBg('#0D0D0D', '#1C2B3E', '#141C2A', W, H),
    }
  }

  // Rasterizes the bundled logo paths into a point field. Doubles as the
  // fallback target field when the configured SVG source is unusable; only a
  // genuine load failure may switch the scene to this JH fallback.
  const buildLogoTargets = () => {
    const { width: W, height: H } = getViewportSize()
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')
    if (!ctx) {
      return {
        x: new Float32Array([W * 0.5]),
        y: new Float32Array([H * 0.5]),
        colors: new Uint32Array([packSourceRgba(255, 255, 255, 255)]),
        normX: new Float32Array([0.5]),
        normY: new Float32Array([0.5]),
      }
    }
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    const scale = Math.min(W, H) / 320
    ctx.translate(W * 0.5, H * 0.42)
    ctx.scale(scale, scale)
    ctx.fillStyle = MONOGRAM_FILL[themeRef.current]
    const path = new Path2D(LOGO_PATHS.join(' '))
    ctx.fill(path)
    ctx.restore()

    const imageData = ctx.getImageData(0, 0, W, H)
    const field = sampleTargetField(imageData, resolveSceneSamplingStep(LOGO_TARGET_STEP, W), 64)
    if (field.x.length === 0) {
      return {
        x: new Float32Array([W * 0.5]),
        y: new Float32Array([H * 0.5]),
        colors: new Uint32Array([packSourceRgba(255, 255, 255, 255)]),
        normX: new Float32Array([0.5]),
        normY: new Float32Array([0.5]),
      }
    }
    // Keep the legacy object-array ref warm for matrix/weather sizing.
    const targets: { tx: number; ty: number }[] = new Array(field.x.length)
    for (let i = 0; i < field.x.length; i += 1) {
      targets[i] = { tx: field.x[i], ty: field.y[i] }
    }
    logoTargetsRef.current = targets
    return field
  }

  // Update target metadata from a freshly sampled source field. The full
  // field is kept unsampled so tier transitions can re-derive the capped
  // field; the required order then runs through applyTierSubsample →
  // applyMotionField (population ensured against the new count, assignment
  // rebuilt, paint replayed).
  const setBaseField = (
    x: Float32Array,
    y: Float32Array,
    colors: Uint32Array,
    normX: Float32Array,
    normY: Float32Array,
  ) => {
    fullFieldXRef.current = x
    fullFieldYRef.current = y
    fullFieldColorsRef.current = colors
    fullFieldNormXRef.current = normX
    fullFieldNormYRef.current = normY
    applyTierSubsample()
  }

  // Derive the tier-capped base field from the full source field via
  // deterministic stride subsampling (engine/qualityTiers). The previous
  // field stays live until the new arrays are fully assembled — the canvas
  // is never blanked mid-transition.
  const applyTierSubsample = () => {
    const full = fullFieldXRef.current
    const cap = qualityBudgetRef.current.glyphCap
    const indices = cap > 0 ? subsampleStrided(full.length, cap) : null
    const count = indices ? indices.length : full.length
    let x: Float32Array
    let y: Float32Array
    let colors: Uint32Array
    let normX: Float32Array
    let normY: Float32Array
    if (!indices || count === full.length) {
      x = fullFieldXRef.current
      y = fullFieldYRef.current
      colors = fullFieldColorsRef.current
      normX = fullFieldNormXRef.current
      normY = fullFieldNormYRef.current
    } else {
      x = new Float32Array(count)
      y = new Float32Array(count)
      colors = new Uint32Array(count)
      normX = new Float32Array(count)
      normY = new Float32Array(count)
      for (let i = 0; i < count; i += 1) {
        const j = indices[i]
        x[i] = fullFieldXRef.current[j]
        y[i] = fullFieldYRef.current[j]
        colors[i] = fullFieldColorsRef.current[j]
        normX[i] = fullFieldNormXRef.current[j]
        normY[i] = fullFieldNormYRef.current[j]
      }
    }
    baseTargetsXRef.current = x
    baseTargetsYRef.current = y
    baseColorsRef.current = colors
    baseCountRef.current = x.length
    // Landing scale-in pivot: the centroid of the active target field. The
    // ref object is mutated in place so the frame loop stays allocation-free.
    const centroid = landingCentroidRef.current
    if (x.length > 0) {
      let sumX = 0
      let sumY = 0
      for (let i = 0; i < x.length; i += 1) {
        sumX += x[i]
        sumY += y[i]
      }
      centroid.x = sumX / x.length
      centroid.y = sumY / x.length
    } else {
      const center = viewportCenter()
      centroid.x = center.x
      centroid.y = center.y
    }
    // A fresh field landing mid scale-in (first source load, replay before
    // the load finished) re-seeds the population from the real center.
    if (
      experienceRef.current === 'intro' &&
      landingLogoScaleRef.current <= LANDING_SCALE_RESTART_EPSILON
    ) {
      snapParticlesToLandingCenter()
    }
    motionFieldRef.current = buildMotionBaseField(x, y, normX, normY)
    const { gradientT, rowT } = buildTargetSpatialDataFromArrays(x, y)
    targetGradientRef.current = gradientT
    targetRowRef.current = rowT
  }

  const ensureMotionBuffers = (size: number) => {
    if (motionBuffersXRef.current.length < size) {
      motionBuffersXRef.current = new Float32Array(size)
      motionBuffersYRef.current = new Float32Array(size)
    }
  }

  // Device-aware motion quality composed with the active quality tier through
  // min(): the tier caps creature density and compute rate on top of the
  // existing desktop/mobile ceilings (engine/qualityTiers).
  const resolveEffectiveMotionQuality = (config: MotionConfig): MotionQuality => {
    const quality = resolveMotionQuality(config, getViewportSize().width)
    const budget = qualityBudgetRef.current
    return {
      effectiveDensity: Math.min(quality.effectiveDensity, budget.creatureCap),
      effectiveUpdateRate: Math.min(quality.effectiveUpdateRate, budget.creatureRate),
    }
  }

  // Parametric creature: replace target positions with a generated creature of
  // the effective density while retaining the glyph population and inheriting
  // source colors proportionally from the base field.
  const rebuildCreatureField = () => {
    const config = motionConfigRef.current
    const quality = resolveEffectiveMotionQuality(config)
    motionQualityRef.current = quality
    const needed = quality.effectiveDensity
    if (
      !creatureTopologyRef.current ||
      creatureTopologyRef.current.count !== needed ||
      creatureTopologyRef.current.variant !== config.variant ||
      (config.variant === 'custom' &&
        (creatureTopologyRef.current.customForm !== config.custom.form ||
          creatureTopologyRef.current.customSymmetry !== config.custom.symmetry))
    ) {
      creatureTopologyRef.current = buildCreatureTopology(needed, config.variant, config.custom)
    }
    const base = baseColorsRef.current
    const colors = new Uint32Array(needed)
    if (base.length > 0 && needed > 0) {
      for (let i = 0; i < needed; i += 1) {
        colors[i] = base[Math.min(base.length - 1, Math.floor((i * base.length) / needed))]
      }
    }
    activeSourceColorsRef.current = colors
    ensureMotionBuffers(needed)
    // Seed the buffers with the base centroid so the first frame before the
    // next compute is finite even when the base field is empty.
    motionBuffersXRef.current.fill(viewportCenter().x, 0, needed)
    motionBuffersYRef.current.fill(viewportCenter().y, 0, needed)
    activeTargetsXRef.current = motionBuffersXRef.current
    activeTargetsYRef.current = motionBuffersYRef.current
    activeCountRef.current = needed
    motionDirtyRef.current = true
  }

  const viewportCenter = () => {
    const { width, height } = getViewportSize()
    return { x: width * 0.5, y: height * 0.5 }
  }

  // Snap the whole glyph population onto the landing centroid: the origin
  // pose of the logo scale-in. Allocation-free; positions and velocities only.
  const snapParticlesToLandingCenter = () => {
    const center = landingCentroidRef.current
    const particles = particlesRef.current
    for (let i = 0; i < particles.length; i += 1) {
      particles[i].x = center.x
      particles[i].y = center.y
      particles[i].vx = 0
      particles[i].vy = 0
    }
  }

  // Imperative landing scale driver (PortfolioExperience's RAF loop pushes
  // the sequence's logoScale every tick). A transition back to ~0 means a
  // scale-in is (re)starting, so the population re-seeds from the center.
  const setLandingLogoScale = (scale: number) => {
    const clamped = clamp(scale, 0, 1)
    if (
      clamped <= LANDING_SCALE_RESTART_EPSILON &&
      landingLogoScaleRef.current > LANDING_SCALE_RESTART_EPSILON
    ) {
      snapParticlesToLandingCenter()
    }
    landingLogoScaleRef.current = clamped
  }

  // Point the draw loop at the right target arrays for the active motion
  // mode, ensure the particle population against the effective target count,
  // rebuild assignment, then replay the paint overlay over the fresh field.
  const applyMotionField = () => {
    const mode = motionConfigRef.current.mode
    if (mode === 'parametric-creature') {
      rebuildCreatureField()
    } else if (mode === 'organic-flow') {
      const count = baseCountRef.current
      ensureMotionBuffers(count)
      motionBuffersXRef.current.set(baseTargetsXRef.current.subarray(0, count))
      motionBuffersYRef.current.set(baseTargetsYRef.current.subarray(0, count))
      activeTargetsXRef.current = motionBuffersXRef.current
      activeTargetsYRef.current = motionBuffersYRef.current
      activeSourceColorsRef.current = baseColorsRef.current
      activeCountRef.current = count
      motionDirtyRef.current = true
    } else {
      // Motion Off: the active arrays alias the base field directly — no
      // per-frame procedural work of any kind.
      activeTargetsXRef.current = baseTargetsXRef.current
      activeTargetsYRef.current = baseTargetsYRef.current
      activeSourceColorsRef.current = baseColorsRef.current
      activeCountRef.current = baseCountRef.current
    }
    ensureParticleCount(
      Math.max(
        paragraphTargetsRef.current.length,
        activeCountRef.current,
        120,
      ),
    )
    buildSvgTargetAssignment()
    rebuildPaintIndexAndReplay()
    const assignedCount = countAssignedTargets()
    patchDiagnostics({
      targetCount: activeCountRef.current,
      glyphCount: particlesRef.current.length,
      assignedCount,
      unassignedCount: particlesRef.current.length - assignedCount,
      hiddenCount:
        unassignedBehaviorRef.current === 'hidden'
          ? particlesRef.current.length - assignedCount
          : 0,
    })
    // Quality may have been re-resolved against a new viewport (resize); keep
    // the reported requested/effective values in sync.
    patchMotionDiagnostics()
    renderOnceRef.current()
  }

  // Apply the current controller tier: re-resolve the composed budgets, then
  // rebuild only what the new budgets actually change. The last good field
  // stays live until its replacement is fully assembled (synchronous), so the
  // canvas never blanks; the existing resize paint-replay path re-projects
  // the normalized stroke history onto the re-derived field.
  const applyQualityTier = () => {
    const controller = qualityControllerRef.current
    if (!controller) return
    const viewport = getViewportSize()
    const previous = qualityBudgetRef.current
    const budget = resolveEffectiveQualityBudget(controller.getTier(), viewport.width)
    qualityBudgetRef.current = budget
    if (budget.tier !== previous.tier) {
      onQualityTierChangeRef.current?.(previous.tier, budget.tier)
    }

    // Render budget: cap the backing-store pixel ratio and resize the canvas
    // if it changed (same transform idiom as resizeScene).
    const pixelRatio = Math.min(
      resolveRenderPixelRatio(window.devicePixelRatio || 1),
      budget.renderPixelRatioCap,
    )
    if (pixelRatio !== pixelRatioRef.current) {
      pixelRatioRef.current = pixelRatio
      const canvas = canvasRef.current
      const ctx = ctxRef.current
      if (canvas && ctx) {
        canvas.width = viewport.width * pixelRatio
        canvas.height = viewport.height * pixelRatio
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
        ctx.font = fontRef.current
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
      }
      // The background paint layer renders at its own tier-dependent ratio;
      // re-project it so the new backing store keeps the strokes.
      rebuildBackgroundPaintLayer()
    } else if (budget.backgroundPaintPixelRatio !== previous.backgroundPaintPixelRatio) {
      rebuildBackgroundPaintLayer()
    }

    if (budget.glyphCap !== previous.glyphCap) {
      applyTierSubsample()
      applyMotionField()
    }
    // Creature budgets may tighten even when the glyph cap is unchanged.
    const nextQuality = resolveEffectiveMotionQuality(motionConfigRef.current)
    if (
      nextQuality.effectiveDensity !== motionQualityRef.current.effectiveDensity ||
      nextQuality.effectiveUpdateRate !== motionQualityRef.current.effectiveUpdateRate
    ) {
      motionQualityRef.current = nextQuality
      if (motionConfigRef.current.mode === 'parametric-creature') {
        applyMotionField()
      } else {
        motionDirtyRef.current = true
      }
      patchMotionDiagnostics()
    }
    if (budget.ambientCap !== previous.ambientCap && ambientFieldRef.current) {
      rebuildAmbientField()
    }
    patchAmbientDiagnostics()
    renderOnceRef.current()
  }

  const patchMotionDiagnostics = () => {
    const config = motionConfigRef.current
    const quality = motionQualityRef.current
    patchDiagnostics({
      motionMode: config.mode,
      motionVariant: config.variant,
      motionRequestedDensity: config.density,
      motionEffectiveDensity: quality.effectiveDensity,
      motionRequestedUpdateRate: config.updateRate,
      motionEffectiveUpdateRate: config.mode === 'off' ? 0 : quality.effectiveUpdateRate,
      paintedTargetCount: paintedCountRef.current,
      paintedBackgroundStrokeCount: countBackgroundStrokes(paintHistoryRef.current),
    })
  }

  // Rebuild the target spatial index for the current field and replay the
  // normalized stroke history onto it. Paint survives resizes, density
  // changes, and ordinary motion parameter changes this way; clearing the
  // history (upload/preset/parametric transitions/leaving vibe) makes this a
  // no-op wipe.
  const rebuildPaintIndexAndReplay = () => {
    const count = activeCountRef.current
    if (paintedColorsRef.current.length !== count) {
      paintedColorsRef.current = new Uint32Array(count)
    }
    const { width, height } = getViewportSize()
    spatialIndexRef.current = buildTargetSpatialIndex(
      activeTargetsXRef.current.subarray(0, count),
      activeTargetsYRef.current.subarray(0, count),
      width,
      height,
    )
    paintedCountRef.current = replayPaintHistory(
      paintHistoryRef.current,
      spatialIndexRef.current,
      paintedColorsRef.current,
    )
    // Resize/normalized-history replay covers the background channel too.
    rebuildBackgroundPaintLayer()
    pushPaintStatus()
  }

  const replayPaint = () => {
    const index = spatialIndexRef.current
    if (!index) {
      paintedColorsRef.current.fill(0)
      paintedCountRef.current = 0
    } else {
      paintedCountRef.current = replayPaintHistory(
        paintHistoryRef.current,
        index,
        paintedColorsRef.current,
      )
    }
    rebuildBackgroundPaintLayer()
    patchPaintDiagnostics()
    pushPaintStatus()
    renderOnceRef.current()
  }

  const getPaintStatus = (): PaintStatus => ({
    paintedTargetCount: paintedCountRef.current,
    strokeCount: paintHistoryRef.current.strokes.length,
    backgroundStrokeCount: countBackgroundStrokes(paintHistoryRef.current),
    canUndo: paintHistoryRef.current.strokes.length > 0,
    canRedo: redoStrokesRef.current.length > 0,
    active: activeStrokeRef.current !== null,
  })

  const pushPaintStatus = () => {
    const status = getPaintStatus()
    // Debug-mode browser hook (dev ?debug=true only): lets automated
    // interaction tests observe committed paint strokes without poking React
    // internals. Never populated in production builds.
    if (tuningModeRef.current && typeof window !== 'undefined') {
      ;(window as unknown as { __JH_PAINT_STATUS__?: PaintStatus }).__JH_PAINT_STATUS__ = status
    }
    onPaintStatusChangeRef.current?.(status)
  }

  const patchPaintDiagnostics = () => {
    patchDiagnostics({
      paintedTargetCount: paintedCountRef.current,
      paintedBackgroundStrokeCount: countBackgroundStrokes(paintHistoryRef.current),
    })
  }

  // --- Background paint channel (soft-brush offscreen layer) ---------------

  const ensureBackgroundPaintLayer = () => {
    const { width, height } = getViewportSize()
    // The background channel renders at its own (cheaper) ratio on the lower
    // quality tiers — the soft-brush layer is blurred regardless.
    const pixelRatio = Math.min(
      pixelRatioRef.current,
      qualityBudgetRef.current.backgroundPaintPixelRatio,
    )
    const layer = bgPaintCanvasRef.current
    if (
      !layer ||
      layer.width !== Math.max(1, Math.round(width * pixelRatio)) ||
      layer.height !== Math.max(1, Math.round(height * pixelRatio))
    ) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * pixelRatio))
      canvas.height = Math.max(1, Math.round(height * pixelRatio))
      bgPaintCanvasRef.current = canvas
      bgPaintCtxRef.current = canvas.getContext('2d')
      // The evolving-stroke layer shares the settled layer's size and ratio;
      // it is cleared and redrawn per frame while any stroke is evolving.
      const evolveCanvas = document.createElement('canvas')
      evolveCanvas.width = canvas.width
      evolveCanvas.height = canvas.height
      bgEvolveCanvasRef.current = evolveCanvas
      bgEvolveCtxRef.current = evolveCanvas.getContext('2d')
      bgEvolveHasContentRef.current = false
      return true
    }
    return false
  }

  // Soft radial brush sprite, tinted and cached by color+size. Erase uses the
  // same sprite shape with destination-out compositing (color irrelevant).
  const getBackgroundBrush = (color: number | null, radiusPx: number) => {
    const key = `${color ?? 'erase'}:${Math.round(radiusPx)}`
    const cache = bgBrushCacheRef.current
    const cached = cache.get(key)
    if (cached) return cached
    if (cache.size > 24) cache.clear()
    const size = Math.max(2, Math.ceil(radiusPx * 2))
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const r = color === null ? 255 : color & 0xff
    const g = color === null ? 255 : (color >>> 8) & 0xff
    const b = color === null ? 255 : (color >>> 16) & 0xff
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`)
    gradient.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, 0.5)`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    cache.set(key, canvas)
    return canvas
  }

  // Watercolor dye sprites for the evolution (background blooms only — the
  // live brush above is unchanged). Two passes per point: a soft core drawn
  // additively ('lighter') so overlapping blooms seep into each other on the
  // dark background, and a darker wet-edge rim drawn on top (source-over).
  // The `dark` variant is the blotch channel (engine/paintEvolution).
  const getDyeCoreBrush = (color: number, radiusPx: number, dark: boolean) => {
    const key = `core:${color}:${Math.round(radiusPx)}:${dark ? 1 : 0}`
    const cache = bgBrushCacheRef.current
    const cached = cache.get(key)
    if (cached) return cached
    if (cache.size > 32) cache.clear()
    const size = Math.max(2, Math.ceil(radiusPx * 2))
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const dim = dark ? 0.8 : 1
    const r = Math.round((color & 0xff) * dim)
    const g = Math.round(((color >>> 8) & 0xff) * dim)
    const b = Math.round(((color >>> 16) & 0xff) * dim)
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${dark ? 0.62 : 0.55})`)
    gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.35)`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    cache.set(key, canvas)
    return canvas
  }

  // Wet-edge rim: a darker band at 0.8–0.95 radius, fading both ways, so the
  // bloom reads as dye settling into the surface.
  const getDyeRimBrush = (color: number, radiusPx: number) => {
    const key = `rim:${color}:${Math.round(radiusPx)}`
    const cache = bgBrushCacheRef.current
    const cached = cache.get(key)
    if (cached) return cached
    if (cache.size > 32) cache.clear()
    const size = Math.max(2, Math.ceil(radiusPx * 2))
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const r = Math.round((color & 0xff) * 0.72)
    const g = Math.round(((color >>> 8) & 0xff) * 0.72)
    const b = Math.round(((color >>> 16) & 0xff) * 0.72)
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
    gradient.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, 0)`)
    gradient.addColorStop(0.88, `rgba(${r}, ${g}, ${b}, 0.5)`)
    gradient.addColorStop(0.95, `rgba(${r}, ${g}, ${b}, 0.35)`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    cache.set(key, canvas)
    return canvas
  }

  const stampBackgroundPoint = (
    tool: 'paint' | 'erase',
    color: number | null,
    px: number,
    py: number,
    radiusPx: number,
  ) => {
    if (tool === 'paint' && color === null) return
    ensureBackgroundPaintLayer()
    const ctx = bgPaintCtxRef.current
    if (!ctx) return
    const pixelRatio = Math.min(
      pixelRatioRef.current,
      qualityBudgetRef.current.backgroundPaintPixelRatio,
    )
    const brushRadius = Math.max(1, radiusPx * pixelRatio)
    const brush = getBackgroundBrush(tool === 'erase' ? null : color, brushRadius)
    ctx.save()
    if (tool === 'erase') ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(brush, px * pixelRatio - brushRadius, py * pixelRatio - brushRadius)
    ctx.restore()
  }

  const stampBackgroundStroke = (stroke: PaintStroke) => {
    const { width, height } = getViewportSize()
    const radiusPx = stroke.radiusNorm * Math.min(width, height)
    const points = stroke.points
    for (let p = 0; p + 1 < points.length; p += 2) {
      stampBackgroundPoint(
        stroke.tool,
        stroke.backgroundColor,
        points[p] * width,
        points[p + 1] * height,
        radiusPx,
      )
    }
  }

  // Draw one stroke's bloom at the given evolution params onto a background
  // layer context. Points are drawn at their original positions (the stroke
  // centroid never moves); grain jitters per-point radius/alpha only — there
  // is no anisotropic phase (two-state seep, see engine/paintEvolution).
  const drawEvolvedBackgroundStroke = (
    targetCtx: CanvasRenderingContext2D,
    record: EvolvingStrokeRecord,
    params: EvolutionParams,
  ) => {
    const { width, height } = getViewportSize()
    const pixelRatio = Math.min(
      pixelRatioRef.current,
      qualityBudgetRef.current.backgroundPaintPixelRatio,
    )
    const stroke = record.stroke
    const color = stroke.backgroundColor ?? 0
    const radiusPx = stroke.radiusNorm * Math.min(width, height) * params.radiusScale
    const points = stroke.points
    targetCtx.save()
    targetCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

    // Pass 1: dye cores, additive — overlapping blooms seep into each other.
    targetCtx.globalCompositeOperation = 'lighter'
    let pointIndex = 0
    for (let p = 0; p + 1 < points.length; p += 2, pointIndex += 1) {
      const rCss = Math.max(1, radiusPx * grainRadiusFactor(record.seed, pointIndex, params.grain))
      // Sprite radius quantized (layer px) so the brush cache survives frames.
      const rLayer = Math.max(2, Math.round((rCss * pixelRatio) / 4) * 4)
      const brush = getDyeCoreBrush(color, rLayer, grainDarkVariant(record.seed, pointIndex, params.grain))
      targetCtx.globalAlpha = Math.min(
        1,
        Math.max(0, params.alpha * grainAlphaFactor(record.seed, pointIndex, params.grain)),
      )
      const size = rCss * 2
      targetCtx.drawImage(brush, points[p] * width - rCss, points[p + 1] * height - rCss, size, size)
    }

    // Pass 2: wet-edge rims, source-over at half strength.
    targetCtx.globalCompositeOperation = 'source-over'
    pointIndex = 0
    for (let p = 0; p + 1 < points.length; p += 2, pointIndex += 1) {
      const rCss = Math.max(1, radiusPx * grainRadiusFactor(record.seed, pointIndex, params.grain))
      const rLayer = Math.max(2, Math.round((rCss * pixelRatio) / 4) * 4)
      const rim = getDyeRimBrush(color, rLayer)
      targetCtx.globalAlpha = Math.min(
        1,
        Math.max(0, params.alpha * grainAlphaFactor(record.seed, pointIndex, params.grain) * 0.5),
      )
      const size = rCss * 2
      targetCtx.drawImage(rim, points[p] * width - rCss, points[p + 1] * height - rCss, size, size)
    }
    targetCtx.restore()
  }

  // Rebuild the settled background layer from stroke history, skipping
  // strokes that are currently evolving (they render on the evolve layer).
  // Settled strokes draw in their settled (baked) form; erases keep the
  // original soft-brush destination-out shape.
  const rebuildSettledPaintLayer = () => {
    ensureBackgroundPaintLayer()
    const layer = bgPaintCanvasRef.current
    const ctx = bgPaintCtxRef.current
    if (!layer || !ctx) return
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, layer.width, layer.height)
    ctx.restore()
    const ring = evolveRingRef.current
    const strokes = paintHistoryRef.current.strokes
    const params = evolveParamsScratchRef.current
    evolutionParamsAt(EVOLUTION_SETTLE_MS, params)
    for (let i = 0; i < strokes.length; i += 1) {
      const stroke = strokes[i]
      if (ring.count > 0 && isStrokeEvolving(ring, stroke)) continue
      if (stroke.tool === 'erase') {
        stampBackgroundStroke(stroke)
      } else if (stroke.backgroundColor !== null) {
        drawEvolvedBackgroundStroke(ctx, createEvolvingRecord(stroke, 0), params)
      }
    }
  }

  // Bake one evolving record: render its settled form into the settled
  // layer. The settled state has grain 0, so the bake is seed-independent
  // and identical to the form replays draw.
  const bakeEvolvingStroke = (record: EvolvingStrokeRecord) => {
    ensureBackgroundPaintLayer()
    const ctx = bgPaintCtxRef.current
    if (!ctx) return
    const params = evolveParamsScratchRef.current
    evolutionParamsAt(EVOLUTION_SETTLE_MS, params)
    drawEvolvedBackgroundStroke(ctx, record, params)
  }

  // Per-frame evolution step (RAF only): bake strokes past 7s oldest-first,
  // then redraw the survivors onto the evolve layer. Returns early with zero
  // work once every stroke has settled — only the settled layer remains.
  const updatePaintEvolution = (now: number) => {
    const ring = evolveRingRef.current
    if (ring.count === 0) {
      if (bgEvolveHasContentRef.current) {
        const layer = bgEvolveCanvasRef.current
        const ctx = bgEvolveCtxRef.current
        if (layer && ctx) {
          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.clearRect(0, 0, layer.width, layer.height)
          ctx.restore()
        }
        bgEvolveHasContentRef.current = false
      }
      return
    }
    // Settle bakes consume from the head: records are in release-time order.
    // Reduced motion never animates: anything still in the ring (the
    // preference was toggled mid-evolution) bakes settled immediately.
    const settleAll = reducedMotionRef.current
    let oldest = peekOldestEvolving(ring)
    while (oldest && (settleAll || isEvolutionSettled(now - oldest.startMs))) {
      bakeEvolvingStroke(oldest)
      dropOldestEvolving(ring)
      oldest = peekOldestEvolving(ring)
    }
    ensureBackgroundPaintLayer()
    const layer = bgEvolveCanvasRef.current
    const ctx = bgEvolveCtxRef.current
    if (!layer || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, layer.width, layer.height)
    ctx.restore()
    if (ring.count === 0) {
      bgEvolveHasContentRef.current = false
      return
    }
    const params = evolveParamsScratchRef.current
    for (let i = 0; i < ring.count; i += 1) {
      const record = evolvingRecordAt(ring, i)
      if (!record) continue
      evolutionParamsAt(now - record.startMs, params)
      drawEvolvedBackgroundStroke(ctx, record, params)
    }
    bgEvolveHasContentRef.current = true
  }

  // Full background-channel replay (resize/undo/redo/restore/clear/tier
  // change): evolution restarts from history — every stroke bakes straight
  // into the settled layer in settled form (replays skip evolution), the
  // ring empties, and the evolve layer clears. Deterministic: normalized
  // strokes replay with the same seeds and the same settled art.
  const rebuildBackgroundPaintLayer = () => {
    clearEvolutionRing(evolveRingRef.current)
    rebuildSettledPaintLayer()
    bgEvolveHasContentRef.current = false
    const evolveLayer = bgEvolveCanvasRef.current
    const evolveCtx = bgEvolveCtxRef.current
    if (evolveLayer && evolveCtx) {
      evolveCtx.save()
      evolveCtx.setTransform(1, 0, 0, 1, 0, 0)
      evolveCtx.clearRect(0, 0, evolveLayer.width, evolveLayer.height)
      evolveCtx.restore()
    }
  }

  const undoPaint = () => {
    const stroke = popStroke(paintHistoryRef.current)
    if (!stroke) return
    redoStrokesRef.current.push(stroke)
    replayPaint()
  }

  const redoPaint = () => {
    const stroke = redoStrokesRef.current.pop()
    if (!stroke) return
    pushStroke(paintHistoryRef.current, stroke)
    replayPaint()
  }

  // Immediate wipe used by Full Reset and by the confirmed destructive flows
  // (upload, preset, parametric transitions, leaving vibe).
  const clearPaint = () => {
    activeStrokeRef.current = null
    pendingPaintPointsRef.current.length = 0
    clearPaintHistory(paintHistoryRef.current)
    redoStrokesRef.current = []
    paintedColorsRef.current.fill(0)
    paintedCountRef.current = 0
    rebuildBackgroundPaintLayer()
    patchPaintDiagnostics()
    pushPaintStatus()
    renderOnceRef.current()
  }

  // Unified-history snapshot capture/restore (Vibe undo/redo): deep copies in
  // both directions so live buffers are never shared with stored snapshots.
  const capturePaintState = (): PaintSnapshot =>
    clonePaintSnapshot({
      strokes: paintHistoryRef.current.strokes,
      redoStrokes: redoStrokesRef.current,
    })

  const restorePaintState = (snapshot: PaintSnapshot) => {
    const restored = clonePaintSnapshot(snapshot)
    activeStrokeRef.current = null
    pendingPaintPointsRef.current.length = 0
    paintHistoryRef.current = paintHistoryFromStrokes(restored.strokes)
    redoStrokesRef.current = restored.redoStrokes
    // Rebuild the spatial index against the live field and replay so the
    // visible overlay (glyph channel + background layer) matches exactly.
    rebuildPaintIndexAndReplay()
    renderOnceRef.current()
  }

  // Stamp newly sampled pointer positions into the overlay. Runs at most once
  // per animation frame (from the RAF loop and from reduced-motion re-arms);
  // pointer positions are interpolated so fast gestures leave no gaps.
  const processPaintQueue = () => {
    const stroke = activeStrokeRef.current
    const pending = pendingPaintPointsRef.current
    if (!stroke) {
      pending.length = 0
      return
    }
    if (pending.length === 0) return
    const index = spatialIndexRef.current
    const { width, height } = getViewportSize()
    const radiusPx = stroke.radiusNorm * Math.min(width, height)
    const segment = strokeSegmentRef.current
    let delta = 0
    for (let i = 0; i + 1 < pending.length; i += 2) {
      const x = pending[i]
      const y = pending[i + 1]
      const remaining =
        PAINT_MAX_POINTS - paintHistoryRef.current.totalPoints - stroke.points.length / 2
      if (remaining <= 0) break
      segment.length = 0
      appendInterpolatedPoints(
        segment,
        stroke.lastX,
        stroke.lastY,
        x,
        y,
        stroke.stepPx,
        width,
        height,
      )
      const usable = Math.min(segment.length / 2, remaining)
      for (let p = 0; p + 1 < usable * 2; p += 2) {
        stroke.points.push(segment[p], segment[p + 1])
        const px = segment[p] * width
        const py = segment[p + 1] * height
        if (index && (stroke.tool === 'erase' || stroke.glyphColor !== null)) {
          delta += stampPoint(
            index,
            stroke.tool,
            stroke.glyphColor ?? 0,
            px,
            py,
            radiusPx,
            paintedColorsRef.current,
          )
        }
        stampBackgroundPoint(stroke.tool, stroke.backgroundColor, px, py, radiusPx)
      }
      stroke.lastX = x
      stroke.lastY = y
    }
    pending.length = 0
    if (delta !== 0) {
      paintedCountRef.current += delta
      patchPaintDiagnostics()
      pushPaintStatus()
    }
  }

  const beginPaintStroke = (event: PointerEvent, point: { x: number; y: number }) => {
    const tool = paintToolRef.current
    const { width, height } = getViewportSize()
    const diameter = clamp(
      tool.brushDiameter,
      PAINT_BRUSH_DIAMETER_MIN,
      PAINT_BRUSH_DIAMETER_MAX,
    )
    const radiusPx = diameter / 2
    const glyphRgb =
      tool.glyphColor === 'none' ? null : parseHexColor(tool.glyphColor)
    const backgroundRgb =
      tool.backgroundColor === 'none' ? null : parseHexColor(tool.backgroundColor)
    // Both channels set to 'none': a paint stroke would touch nothing.
    if (tool.tool === 'paint' && !glyphRgb && !backgroundRgb) return
    // Refresh the spatial index against the targets' current (possibly
    // motion-displaced, now frozen) positions so the brush hits what is
    // actually under the pointer.
    const count = activeCountRef.current
    spatialIndexRef.current = buildTargetSpatialIndex(
      activeTargetsXRef.current.subarray(0, count),
      activeTargetsYRef.current.subarray(0, count),
      width,
      height,
    )
    activeStrokeRef.current = {
      pointerId: event.pointerId,
      tool: tool.tool,
      glyphColor: glyphRgb ? packSourceRgba(glyphRgb.r, glyphRgb.g, glyphRgb.b, 255) : null,
      backgroundColor: backgroundRgb
        ? packSourceRgba(backgroundRgb.r, backgroundRgb.g, backgroundRgb.b, 255)
        : null,
      radiusNorm: radiusPx / Math.max(1, Math.min(width, height)),
      points: [],
      lastX: point.x,
      lastY: point.y,
      stepPx: Math.max(2, radiusPx * 0.4),
    }
    pendingPaintPointsRef.current.push(point.x, point.y)
    // While painting, the pointer repel fades out and click impulses are
    // suppressed; procedural target time freezes in the motion update.
    startFade()
    try {
      canvasRef.current?.setPointerCapture(event.pointerId)
    } catch {}
    updateBrushRing(point.x, point.y, true)
    processPaintQueue()
    pushPaintStatus()
    renderOnceRef.current()
  }

  const endPaintStroke = () => {
    const stroke = activeStrokeRef.current
    if (!stroke) return
    processPaintQueue()
    activeStrokeRef.current = null
    try {
      canvasRef.current?.releasePointerCapture(stroke.pointerId)
    } catch {}
    if (stroke.points.length >= 2) {
      const committed: PaintStroke = {
        tool: stroke.tool,
        glyphColor: stroke.glyphColor,
        backgroundColor: stroke.backgroundColor,
        radiusNorm: stroke.radiusNorm,
        points: Float32Array.from(stroke.points),
      }
      const evicted = pushStroke(paintHistoryRef.current, committed)
      // A new gesture invalidates the redo stack.
      redoStrokesRef.current = []
      // The stroke is committed: let the parent record a unified-history
      // transaction (it captures the after snapshot from the handle).
      onPaintStrokeEndRef.current?.()
      if (evicted) {
        // History bounds dropped the oldest gesture(s); the visible overlay
        // must be rebuilt from the remaining history.
        replayPaint()
        return
      }
      if (committed.tool === 'erase') {
        // An erase must also cut in-flight blooms: settle them (bake-all
        // replay) so the history-ordered erase composites over their baked
        // forms. The glyph channel is untouched by the background rebuild.
        if (evolveRingRef.current.count > 0) rebuildBackgroundPaintLayer()
      } else if (committed.backgroundColor !== null) {
        // Background-channel paint: animate the bloom through its evolution
        // (reduced motion settles it immediately at State 3). The gesture's
        // live stamps are replaced by the settled-layer rebuild below, which
        // skips evolving strokes; pushing into a full ring force-bakes the
        // oldest, and the same rebuild draws its settled form right away.
        if (!reducedMotionRef.current) {
          pushEvolvingStroke(
            evolveRingRef.current,
            createEvolvingRecord(committed, performance.now()),
          )
        }
        rebuildSettledPaintLayer()
      }
    }
    patchPaintDiagnostics()
    pushPaintStatus()
    renderOnceRef.current()
  }

  const buildSvgTargetAssignment = () => {
    const assignment = assignGlyphsToTargets(particlesRef.current.length, activeCountRef.current)
    svgTargetMapRef.current = assignment.glyphToTarget
  }

  const countAssignedTargets = () => {
    const map = svgTargetMapRef.current
    let count = 0
    for (let i = 0; i < map.length; i += 1) {
      if (map[i] >= 0) count += 1
    }
    return count
  }

  // Lazily create (and start) the Black hole provider. The owned canvas is
  // captured in the factory closure so the staging downscale can draw from it.
  const ensureAnimatedProvider = () => {
    if (!animatedProviderRef.current) {
      animatedProviderRef.current = createBlackHoleProvider({
        createCanvas: (w, h) => {
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          animatedProviderCanvasRef.current = canvas
          return canvas
        },
      })
    }
    const provider = animatedProviderRef.current
    if (!provider.isRunning()) {
      const { width, height } = getViewportSize()
      provider.start({ width, height })
    }
    return provider
  }

  // Leaving an animated selection releases the provider and its canvas.
  const stopAnimatedProvider = () => {
    animatedProviderRef.current?.stop()
    animatedProviderCanvasRef.current = null
    animatedHasValidFieldRef.current = false
  }

  // Render one provider frame, downscale it into the tier-sized staging
  // canvas, and sample the staging pixels into a fresh base field. Returns
  // false when the provider could not produce a frame or the frame sampled
  // empty — the caller then keeps the last valid field (or falls back to the
  // JH mark when none exists).
  const sampleAnimatedProviderFrame = (timeSeconds: number): boolean => {
    const provider = animatedProviderRef.current
    const providerCanvas = animatedProviderCanvasRef.current
    if (!provider || !providerCanvas) return false
    if (!provider.renderFrame(timeSeconds)) return false
    const { width: W, height: H } = getViewportSize()
    const stagingSize = resolveAnimatedStagingSize(W, H, qualityBudgetRef.current.tier)
    let staging = animatedStagingRef.current
    if (!staging) {
      staging = document.createElement('canvas')
      animatedStagingRef.current = staging
    }
    if (staging.width !== stagingSize.width || staging.height !== stagingSize.height) {
      staging.width = stagingSize.width
      staging.height = stagingSize.height
    }
    const stagingCtx = staging.getContext('2d')
    if (!stagingCtx) return false
    stagingCtx.clearRect(0, 0, staging.width, staging.height)
    stagingCtx.drawImage(providerCanvas, 0, 0, staging.width, staging.height)
    let imageData: ImageData
    try {
      imageData = stagingCtx.getImageData(0, 0, staging.width, staging.height)
    } catch {
      return false
    }
    const layout = sourceLayoutRef.current
    const field = sampleTargetField(
      imageData,
      resolveSceneSamplingStep(layout?.samplingStep ?? LOGO_TARGET_STEP, staging.width),
      layout?.alphaThreshold ?? 64,
    )
    if (field.x.length === 0) return false
    // Staging pixels are a downscale of the viewport: project the sampled
    // positions back into CSS-pixel scene space (normX/normY are scale-free).
    const scaleX = W / staging.width
    const scaleY = H / staging.height
    for (let i = 0; i < field.x.length; i += 1) {
      field.x[i] *= scaleX
      field.y[i] *= scaleY
    }
    setBaseField(field.x, field.y, field.colors, field.normX, field.normY)
    return true
  }

  const buildSvgTargets = async () => {
    const { width: W, height: H } = getViewportSize()
    const requestId = ++svgLoadRequestRef.current
    // Read the latest source identity from stable refs — never from a render
    // closure — so resize-triggered rebuilds keep the active story/upload.
    const selection = sourceSelectionRef.current ?? { kind: 'builtin' as const }
    const layout = sourceLayoutRef.current

    if (selection.kind === 'animated') {
      const provider = ensureAnimatedProvider()
      provider.setPaused(document.hidden)
      provider.resize(W, H)
      patchDiagnostics({
        sourceStatus: 'loading',
        sourceError: null,
        sourceId: selection.provider,
        sourceKind: 'animated',
      })
      const sampleStart = performance.now()
      // Reduced motion samples the one deterministic pose frame and never
      // animates; the live clock drives all other tiers (T3 freezes it).
      const time = reducedMotionRef.current
        ? BLACK_HOLE_REDUCED_POSE_TIME
        : animatedTimeRef.current
      const sampled = sampleAnimatedProviderFrame(time)
      const sourceDecodeMs = performance.now() - sampleStart
      if (requestId !== svgLoadRequestRef.current) return
      if (sampled) {
        animatedHasValidFieldRef.current = true
        patchDiagnostics({
          sourceStatus: 'ready',
          sourceError: null,
          sourceDecodeMs,
          targetRebuildCount: diagnosticsRef.current.targetRebuildCount + 1,
        })
      } else if (animatedHasValidFieldRef.current) {
        // Provider error with a valid field in hand: keep the last sampled
        // frame; the JH fallback is reserved for "no valid frame at all".
        patchDiagnostics({
          sourceStatus: 'error',
          sourceError: provider.getLastError() ?? 'animated frame unavailable',
          sourceDecodeMs,
        })
        return
      } else {
        const fallback = buildLogoTargets()
        setBaseField(fallback.x, fallback.y, fallback.colors, fallback.normX, fallback.normY)
        patchDiagnostics({
          sourceStatus: 'error',
          sourceError: provider.getLastError() ?? 'animated frame unavailable',
          sourceKind: 'fallback',
          sourceDecodeMs,
          targetRebuildCount: diagnosticsRef.current.targetRebuildCount + 1,
        })
      }
      qualityRebuildPendingRef.current = true
      applyMotionField()
      return
    }

    // Static selections never keep the animated provider alive.
    stopAnimatedProvider()
    // Responsive landing: resolve logotype vs monogram HERE, from the canvas
    // width measured by the resize path (never from a parent's not-yet-set
    // viewport state) — cold mobile loads build the monogram directly, and
    // every resize-triggered rebuild re-resolves against current geometry.
    const activeUrl =
      selection.kind === 'static'
        ? selection.url
        : selection.kind === 'responsive-landing' && !isMobileViewport(W)
          ? LANDING_SOURCE_URL
          : '/assets/test-source.svg'
    const activeKind = selection.kind === 'static' ? selection.sourceKind : 'svg'
    const sourceId =
      selection.kind === 'static'
        ? selection.url
        : selection.kind === 'responsive-landing'
          ? activeUrl
          : 'default'
    patchDiagnostics({
      sourceStatus: 'loading',
      sourceError: null,
      sourceId,
      sourceKind: selection.kind === 'static' ? selection.sourceKind : 'builtin',
    })
    const decodeStart = performance.now()
    // Glyph-stage region (mobile Work): fit the source inside the measured
    // stage rect instead of the full viewport. The rasterization stays
    // region-sized; the region's scene-space offset is applied to the
    // sampled coordinates below.
    const region = targetRegionRef.current
    const result = await loadSvgTargets({
      url: activeUrl,
      kind: activeKind,
      bounds: region ? { width: region.width, height: region.height } : { width: W, height: H },
      samplingStep: resolveSceneSamplingStep(layout?.samplingStep ?? LOGO_TARGET_STEP, W),
      alphaThreshold: layout?.alphaThreshold,
      margin: layout?.margin,
      fit: layout?.fit,
      scale: layout?.scale,
      offsetX: layout?.offsetX,
      offsetY: layout?.offsetY,
    })
    const sourceDecodeMs = performance.now() - decodeStart
    if (requestId !== svgLoadRequestRef.current) {
      // A newer load was requested while this one was in flight; let it win.
      return
    }
    const decision = resolveSourceFieldDecision({ ok: result.ok, targetCount: result.x.length, error: result.error })
    if (decision.use === 'source') {
      // Region-bound: shift the region-local sample coordinates by the
      // stage's viewport-relative offset so the targets land on the stage on
      // the full-viewport canvas.
      if (region) {
        for (let i = 0; i < result.x.length; i += 1) {
          result.x[i] += region.x
          result.y[i] += region.y
        }
      }
      // Landing completed-intro: recolor the hero mark (built-in monogram or
      // the JH logotype) with the fixed left-to-right landing gradient for the
      // active theme (engine/backgroundLuminance) — independent of the
      // background behind it, so the mark reads the same on every landing.
      const isLandingField =
        experienceRef.current === 'intro' &&
        (selection.kind === 'builtin' ||
          selection.kind === 'responsive-landing' ||
          (selection.kind === 'static' && selection.url === LANDING_SOURCE_URL))
      if (isLandingField) {
        const landingGradient = LANDING_GLYPH_GRADIENT_THEMES[themeRef.current]
        applyHorizontalGlyphGradient(
          result.colors,
          result.normX,
          landingGradient.from,
          landingGradient.to,
        )
      }
      setBaseField(result.x, result.y, result.colors, result.normX, result.normY)
      patchDiagnostics({
        sourceStatus: 'ready',
        sourceError: null,
        sourceDecodeMs,
        targetRebuildCount: diagnosticsRef.current.targetRebuildCount + 1,
      })
    } else {
      // Missing, invalid, or zero-alpha source: fall back to the logo field
      // so the scene stays readable instead of going blank. On the landing
      // the fallback gets the same gradient recolor as a decoded hero — a
      // fallback must never render as unprocessed white glyphs.
      const fallback = buildLogoTargets()
      if (experienceRef.current === 'intro') {
        const landingGradient = LANDING_GLYPH_GRADIENT_THEMES[themeRef.current]
        applyHorizontalGlyphGradient(
          fallback.colors,
          fallback.normX,
          landingGradient.from,
          landingGradient.to,
        )
      }
      setBaseField(fallback.x, fallback.y, fallback.colors, fallback.normX, fallback.normY)
      patchDiagnostics({
        sourceStatus: 'error',
        sourceError: decision.reason,
        sourceKind: 'fallback',
        sourceDecodeMs,
        targetRebuildCount: diagnosticsRef.current.targetRebuildCount + 1,
      })
    }
    // Population, assignment, paint replay, counts, and renderOnce all run in
    // the required order inside applyMotionField. The quality controller
    // ignores the evaluation window this rebuild lands in.
    qualityRebuildPendingRef.current = true
    applyMotionField()
  }

  const activateSceneMode = (mode: SceneMode) => {
    sceneModeRef.current = mode
    if (mode === 'svg') {
      sceneStartRef.current = performance.now()
    }
    patchDiagnostics({
      mode,
      glyphCount: particlesRef.current.length,
      assignedCount: countAssignedTargets(),
    })
    renderOnceRef.current()
  }

  const getLogoTarget = (index: number) => {
    const targets = logoTargetsRef.current
    if (targets.length === 0) {
      const viewport = getViewportSize()
      return { tx: viewport.width * 0.5, ty: viewport.height * 0.5 }
    }
    return targets[index % targets.length]
  }

  const getAmbientTarget = (p: Particle, index: number, now: number) => {
    if (paragraphTargetsRef.current[index]) {
      return {
        tx: paragraphTargetsRef.current[index].tx,
        ty: paragraphTargetsRef.current[index].ty,
      }
    }
    const jitter = Math.sin(now * 0.001 + index) * 18
    const drift = Math.cos(now * 0.0013 + index) * 18
    return {
      tx: p.x + jitter,
      ty: p.y + drift,
    }
  }

  const resizeScene = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    // Settle any in-progress paint stroke before the field is rebuilt.
    if (activeStrokeRef.current) endPaintStroke()
    // The adaptive quality controller ignores the window this resize lands in.
    qualityResizePendingRef.current = true
    const { width: W, height: H } = getViewportSize()
    // Breakpoint crossings change the effective size (mobile cap); refresh
    // the font/line-height/sampling refs before the field rebuilds below.
    applyEffectiveGlyphSize()
    const pixelRatio = Math.min(
      resolveRenderPixelRatio(window.devicePixelRatio || 1),
      qualityBudgetRef.current.renderPixelRatioCap,
    )
    pixelRatioRef.current = pixelRatio
    let contentH = H
    if (sceneModeRef.current === 'paragraph' && paragraphTargetsRef.current.length > 0) {
      const lastTarget = paragraphTargetsRef.current[paragraphTargetsRef.current.length - 1]
      contentH = Math.max(H, lastTarget.ty + lineHeightRef.current * 2)
    }
    canvas.width = W * pixelRatio
    canvas.height = contentH * pixelRatio
    canvas.style.width = `${W}px`
    canvas.style.height = `${contentH}px`
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    buildAllMeshBgs()
    buildParagraphTargets()
    buildSvgTargets()
    ensureParticleCount(Math.max(paragraphTargetsRef.current.length, activeCountRef.current, 120))
    rebuildAmbientField()
    if (sceneModeRef.current === 'svg') {
      buildSvgTargetAssignment()
      patchDiagnostics({
        glyphCount: particlesRef.current.length,
        assignedCount: countAssignedTargets(),
      })
    }
    renderOnceRef.current()
  }


  // Assembles the per-frame portion of the snapshot (frame timing, viewport,
  // pointer, live counts) and hands the full snapshot to React. Called at most
  // once per DIAGNOSTICS_PUSH_INTERVAL_MS and only while the debug UI is
  // active, so there is no React work per frame in production.
  const pushDiagnostics = () => {
    const timing = frameTimingRef.current.summary()
    const viewport = getViewportSize()
    const pointer = pointerRef.current
    const glyphCount = particlesRef.current.length
    const assignedCount = countAssignedTargets()
    patchDiagnostics({
      experience: experienceRef.current,
      sceneId: sceneIdRef.current,
      fps: timing.fps,
      avgFrameMs: timing.avgFrameMs,
      worstFrameMs: timing.worstFrameMs,
      framesInWindow: timing.framesInWindow,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      reducedMotion: reducedMotionRef.current,
      pointerType: pointer.kind,
      pointerActive: pointer.active,
      pointerX: pointer.x,
      pointerY: pointer.y,
      seed: GLYPH_INIT_SEED,
      simParams: {
        spring: SPRING,
        damp: DAMP,
        mouseR: mouseRRef.current,
        particleRepel: particleRepelRef.current,
        weatherRepelMult: weatherRepelRef.current,
      },
      glyphCount,
      assignedCount,
      unassignedCount: glyphCount - assignedCount,
      visibleCount: visibleCountRef.current,
      hiddenCount: hiddenCountRef.current,
      motionMode: motionConfigRef.current.mode,
      motionVariant: motionConfigRef.current.variant,
      motionRequestedDensity: motionConfigRef.current.density,
      motionEffectiveDensity: motionQualityRef.current.effectiveDensity,
      motionRequestedUpdateRate: motionConfigRef.current.updateRate,
      motionEffectiveUpdateRate:
        motionConfigRef.current.mode === 'off'
          ? 0
          : motionQualityRef.current.effectiveUpdateRate,
      paintedTargetCount: paintedCountRef.current,
      paintedBackgroundStrokeCount: countBackgroundStrokes(paintHistoryRef.current),
      ambientMode: ambientConfigRef.current.mode,
      ambientAgentCount: ambientFieldRef.current ? ambientFieldRef.current.count : 0,
      ambientCollisionMs: ambientCollisionMsRef.current,
      qualityTier: qualityBudgetRef.current.tier,
      qualityTierOverride: qualityControllerRef.current
        ? qualityControllerRef.current.isOverrideActive()
        : false,
      qualityLastTransition: qualityControllerRef.current
        ? qualityControllerRef.current.getLastTransitionReason()
        : 'initial',
      qualityGlyphCap: qualityBudgetRef.current.glyphCap,
      qualityCreatureCap: qualityBudgetRef.current.creatureCap,
      qualityCreatureRate: qualityBudgetRef.current.creatureRate,
      qualityAmbientCap: qualityBudgetRef.current.ambientCap,
      qualityAmbientTickHz: qualityBudgetRef.current.ambientTickHz,
    })
    onDiagnosticsUpdateRef.current?.({ ...diagnosticsRef.current })
  }

  const getPointerForFrame = () => {
    const state = pointerRef.current
    const now = performance.now()
    if (state.active) {
      return { x: state.x, y: state.y, active: true, influence: 1 }
    }
    if (state.fadeEndTime <= now) {
      return { x: state.x, y: state.y, active: false, influence: 0 }
    }
    const remaining = state.fadeEndTime - now
    const influence = Math.max(0, Math.min(1, remaining / FADE_DURATION_MS))
    if (influence <= 0) {
      return { x: state.x, y: state.y, active: false, influence: 0 }
    }
    return { x: state.fadeStartX, y: state.fadeStartY, active: true, influence }
  }

  const simulateParticle = (p: Particle) => {
    // Apply mouse repel force if pointer is nearby (suppressed while painting).
    const pointer = getPointerForFrame()
    if (!activeStrokeRef.current && pointer.active && pointer.influence > 0) {
      const dx = p.x - pointer.x
      const dy = p.y - pointer.y
      const distSq = dx * dx + dy * dy
      const radius = mouseRRef.current || 0
      if (distSq > 0 && distSq < radius * radius) {
        const dist = Math.sqrt(distSq)
        const repelStrength = (1 - dist / radius) * (particleRepelRef.current || 0.48) * pointer.influence
        p.vx += (dx / dist) * repelStrength
        p.vy += (dy / dist) * repelStrength
      }
    }

    p.vx += (p.tx - p.x) * SPRING
    p.vy += (p.ty - p.y) * SPRING
    p.vx *= DAMP
    p.vy *= DAMP
    p.x += p.vx
    p.y += p.vy
  }

  // Reusable per-frame color context: mutated per glyph, never reallocated.
  const colorContextRef = useRef({
    mode: 'image-gradient' as GlyphColorMode,
    palette: [] as Rgb[],
    particleIndex: 0,
    targetIndex: -1,
    targetCount: 0,
    gradientT: undefined as Float32Array | undefined,
    rowT: undefined as Float32Array | undefined,
    wordColorIndices: undefined as number[] | undefined,
    sourceColors: undefined as Uint32Array | undefined,
    paintedColors: undefined as Uint32Array | undefined,
  })

  // Advance procedural motion time (frozen during paint gestures) and
  // recompute target positions at the effective update rate while rendering
  // continues at full requestAnimationFrame cadence. Reduced-motion users get
  // a deterministic static pose, recomputed only when parameters change.
  const updateMotionTargets = (now: number) => {
    const mode = motionConfigRef.current.mode
    if (mode === 'off') return
    if (reducedMotionRef.current) {
      if (motionDirtyRef.current) {
        computeMotionFrame(MOTION_REDUCED_POSE_TIME)
        motionDirtyRef.current = false
        lastMotionComputeRef.current = now
      }
      return
    }
    // T3 freezes the animated source sampling: creature/organic target math
    // stops updating and the last computed targets remain (parameter edits
    // still recompute one frame via the dirty flag).
    if (qualityBudgetRef.current.samplingHz === 0) {
      if (motionDirtyRef.current) {
        computeMotionFrame(motionTimeRef.current)
        motionDirtyRef.current = false
        lastMotionComputeRef.current = now
      }
      return
    }
    const last = motionLastNowRef.current
    motionLastNowRef.current = now
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
    if (!activeStrokeRef.current) {
      motionTimeRef.current += dt
    }
    const rate = motionQualityRef.current.effectiveUpdateRate || 30
    if (motionDirtyRef.current || now - lastMotionComputeRef.current >= 1000 / rate) {
      computeMotionFrame(motionTimeRef.current)
      lastMotionComputeRef.current = now
      motionDirtyRef.current = false
    }
  }

  const computeMotionFrame = (time: number) => {
    const config = motionConfigRef.current
    const { width, height } = getViewportSize()
    const params: MotionWaveParams = {
      time,
      amount: config.amount / 100,
      speed: config.speed,
      waveScale: config.waveScale,
      complexity: config.complexity,
      width,
      height,
      custom: config.custom,
    }
    if (config.mode === 'organic-flow') {
      computeOrganicTargets(
        motionFieldRef.current,
        params,
        motionBuffersXRef.current,
        motionBuffersYRef.current,
      )
    } else if (config.mode === 'parametric-creature' && creatureTopologyRef.current) {
      computeCreatureTargets(
        creatureTopologyRef.current,
        params,
        motionBuffersXRef.current,
        motionBuffersYRef.current,
      )
    }
  }

  // Per-frame animated-source sampling, rate-limited by the quality tier's
  // samplingHz budget. T3 (0 Hz) freezes the last sampled frame; reduced
  // motion never samples here (its single deterministic pose came from the
  // rebuild path). The full-field refresh reuses the same tail as a source
  // rebuild — tier subsample, population, assignment, paint replay.
  const sampleAnimatedSourceFrame = (now: number) => {
    const selection = sourceSelectionRef.current
    if (selection?.kind !== 'animated') return
    if (reducedMotionRef.current) return
    const samplingHz = qualityBudgetRef.current.samplingHz
    if (samplingHz <= 0) return
    // A paint gesture freezes the field under the brush; sampling resumes
    // when the stroke ends.
    if (activeStrokeRef.current) return
    if (now - animatedLastSampleRef.current < 1000 / samplingHz) return
    animatedLastSampleRef.current = now
    const dt = Math.min(0.5, Math.max(0, (now - (animatedLastNowRef.current || now)) / 1000))
    animatedLastNowRef.current = now
    animatedTimeRef.current += dt
    if (sampleAnimatedProviderFrame(animatedTimeRef.current)) {
      animatedHasValidFieldRef.current = true
      applyMotionField()
    }
    // On failure the last valid sampled field simply stays live.
  }

  const drawSvgGlyphScene = (now: number) => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    const W = canvas.width / pixelRatioRef.current
    const H = canvas.height / pixelRatioRef.current

    const config = playgroundConfigRef.current ?? APPROVED_PLAYGROUND_DEFAULTS

    const bgGradient = ctx.createRadialGradient(
      W * 0.5,
      H * 0.5,
      0,
      W * 0.5,
      H * 0.5,
      Math.max(W, H) * 0.8,
    )
    bgGradient.addColorStop(0, config.backgroundColor1)
    bgGradient.addColorStop(1, config.backgroundColor2)
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, W, H)

    // Weather mood backdrop (legacy mesh gradients at the ambient
    // backdropOpacity; skipped entirely at 0).
    drawAmbientBackdrop(ctx, W, H)

    // Background paint channel: the soft-brush layer sits over the base
    // gradient and under the glyphs; erase has already cut it back out.
    const bgPaintLayer = bgPaintCanvasRef.current
    if (bgPaintLayer) {
      ctx.drawImage(bgPaintLayer, 0, 0, W, H)
    }
    // Evolving blooms composite above the settled layer (same low-res ratio)
    // while their 7s animation runs; the flag skips the draw entirely once
    // every stroke has baked.
    const bgEvolveLayer = bgEvolveCanvasRef.current
    if (bgEvolveLayer && bgEvolveHasContentRef.current) {
      ctx.drawImage(bgEvolveLayer, 0, 0, W, H)
    }

    // Ambient layer: weather/matrix agents render above the background
    // channels and below the spring-tethered glyph field.
    updateAmbient(now)
    drawAmbient(ctx, W, H)

    const particles = particlesRef.current
    const map = svgTargetMapRef.current
    if (particles.length === 0) return

    updateMotionTargets(now)

    const targetsX = activeTargetsXRef.current
    const targetsY = activeTargetsYRef.current
    const targetCount = activeCountRef.current
    if (targetCount === 0) return

    const colorContext = colorContextRef.current
    colorContext.mode = colorModeRef.current
    colorContext.palette = paletteRgbRef.current
    colorContext.targetCount = targetCount
    colorContext.gradientT = targetGradientRef.current
    colorContext.rowT = targetRowRef.current
    colorContext.wordColorIndices = wordColorRef.current
    colorContext.sourceColors = activeSourceColorsRef.current
    colorContext.paintedColors = paintedColorsRef.current

    const behavior = unassignedBehaviorRef.current
    const reducedMotion = reducedMotionRef.current
    const sceneTime = reducedMotion ? sceneStartRef.current : now
    let visibleCount = 0
    let hiddenCount = 0

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i]
      const targetIndex = map[i]
      const assigned = targetIndex >= 0 && targetIndex < targetCount
      if (!assigned) {
        if (behavior === 'hidden') {
          hiddenCount += 1
          continue
        }
        const ambient = getAmbientTarget(p, i, sceneTime)
        p.tx = ambient.tx
        p.ty = ambient.ty
      } else {
        p.tx = targetsX[targetIndex]
        p.ty = targetsY[targetIndex]
      }
      // Landing scale-in (intro only): pull every glyph target toward the
      // field centroid by the sequence's logo scale — t' = c + (t − c)·s —
      // so the completed mark reads as scaling out from its own center.
      // Only the glyph field transforms; the canvas, background, and
      // atmosphere are untouched. Scalar math, allocation-free.
      const landingScale = landingLogoScaleRef.current
      if (landingScale < 1 && experienceRef.current === 'intro') {
        const center = landingCentroidRef.current
        p.tx = center.x + (p.tx - center.x) * landingScale
        p.ty = center.y + (p.ty - center.y) * landingScale
      }
      p.char = sourceCharsRef.current[i % Math.max(1, sourceCharsRef.current.length)] || p.char
      p.row = 0
      p.head = false
      if (reducedMotion) {
        p.x = p.tx
        p.y = p.ty
        p.vx = 0
        p.vy = 0
      } else {
        simulateParticle(p)
      }
      const homeDist = Math.sqrt((p.x - p.tx) ** 2 + (p.y - p.ty) ** 2)
      colorContext.particleIndex = i
      colorContext.targetIndex = targetIndex
      const color = resolveGlyphColor(colorContext)
      const alpha = Math.max(0.35, 1 - homeDist / 280) * resolveGlyphAlphaScale(colorContext)
      ctx.fillStyle = formatRgba(color, alpha)
      ctx.fillText(p.char, p.x, p.y)
      visibleCount += 1
    }

    // Per-frame counts live in refs; React sees them via the throttled push.
    visibleCountRef.current = visibleCount
    hiddenCountRef.current = hiddenCount
  }

  const drawParagraph = (now: number, revealedChars: number) => {
    const canvas = canvasRef.current
    if (!canvas || !ctxRef.current) return
    const ctx = ctxRef.current
    const cW = canvas.width / pixelRatioRef.current
    const cH = canvas.height / pixelRatioRef.current
    ctx.fillStyle = 'rgba(10, 10, 10, 1)'
    ctx.fillRect(0, 0, cW, cH)
    const visible = Math.min(revealedChars, paragraphTargetsRef.current.length, particlesRef.current.length)
    for (let i = 0; i < visible; i += 1) {
      const t = paragraphTargetsRef.current[i]
      const p = particlesRef.current[i]
      p.char = t.char
      p.tx = t.tx
      p.ty = t.ty
      p.row = t.row
      p.hue = t.hue
      p.head = false
      simulateParticle(p)
      const homeDist = Math.sqrt((p.x - p.tx) ** 2 + (p.y - p.ty) ** 2)
      const alpha = Math.max(0.35, 1 - homeDist / 280)
      const hue = (p.hue + now * 0.015) % 360
      ctx.fillStyle = `hsla(${hue}, 70%, 75%, ${alpha})`
      ctx.fillText(p.char, p.x, p.y)
    }
    if (Math.floor((now - typewriterStartRef.current) / 500) % 2 === 0 && revealedChars < paragraphTargetsRef.current.length) {
      const last = paragraphTargetsRef.current[revealedChars - 1]
      ctx.fillStyle = 'hsla(0, 0%, 85%, 0.85)'
      ctx.fillRect(last.tx + fontSize * 0.25, last.ty - lineHeightRef.current * 0.5 + 2, 2, lineHeightRef.current - 4)
    }
    visibleCountRef.current = visible
    hiddenCountRef.current = particlesRef.current.length - visible
  }

  // --- Ambient layer frame integration ---------------------------------------

  // Collision pass for one physics tick: copy main-glyph positions into the
  // reusable buffers, rebuild the hash grid, resolve, and apply the clamped
  // counter-impulses back to the spring-tethered particles. Main glyphs are
  // never checked against each other.
  const resolveAmbientCollisionsTick = (field: AmbientField) => {
    const particles = particlesRef.current
    const mainCount = particles.length
    const { width, height } = getViewportSize()
    const start = performance.now()
    let grid = ambientGridRef.current
    if (!grid || grid.next.length < field.count + mainCount) {
      grid = createAmbientCollisionGrid(width, height, field.capacity + mainCount)
      ambientGridRef.current = grid
    }
    if (ambientMainXRef.current.length < mainCount) {
      ambientMainXRef.current = new Float32Array(mainCount)
      ambientMainYRef.current = new Float32Array(mainCount)
      ambientMainImpulseXRef.current = new Float32Array(mainCount)
      ambientMainImpulseYRef.current = new Float32Array(mainCount)
    }
    const mainX = ambientMainXRef.current
    const mainY = ambientMainYRef.current
    const impulseX = ambientMainImpulseXRef.current
    const impulseY = ambientMainImpulseYRef.current
    for (let i = 0; i < mainCount; i += 1) {
      mainX[i] = particles[i].x
      mainY[i] = particles[i].y
      impulseX[i] = 0
      impulseY[i] = 0
    }
    rebuildAmbientCollisionGrid(grid, field, mainX, mainY, mainCount)
    resolveAmbientCollisions(field, grid, mainX, mainY, mainCount, impulseX, impulseY)
    for (let i = 0; i < mainCount; i += 1) {
      if (impulseX[i] !== 0 || impulseY[i] !== 0) {
        particles[i].vx += impulseX[i]
        particles[i].vy += impulseY[i]
      }
    }
    const cost = performance.now() - start
    ambientCollisionMsRef.current = lerp(
      ambientCollisionMsRef.current,
      cost,
      AMBIENT_COLLISION_COST_SMOOTHING,
    )
  }

  // Advance the ambient pool at the tier's physics tick rate. Reduced motion
  // gets one deterministic static pose per rebuild (fixed ticks from the
  // seeded initialization) and no animation — mirroring the main field.
  const updateAmbient = (now: number) => {
    const field = ambientFieldRef.current
    if (!field) return
    const { width, height } = getViewportSize()
    const config = ambientConfigRef.current

    // Normalize transient positions whenever the measured region no longer
    // matches the pool's (resize, orientation change, dynamic browser chrome,
    // visibility resume) — preserves accumulated state, allocation-free.
    if (field.width !== width || field.height !== height) {
      normalizeAmbientField(field, width, height)
    }

    if (reducedMotionRef.current) {
      // Param edits re-resolve the live count even while the pose is frozen.
      field.count = resolveAmbientCount(field, config)
      if (ambientStaticPoseDirtyRef.current) {
        ambientStaticPoseDirtyRef.current = false
        for (let t = 0; t < AMBIENT_REDUCED_POSE_TICKS; t += 1) {
          stepAmbientField(field, {
            dt: 1 / 60,
            time: t / 60,
            config,
            pointer: {
              x: 0,
              y: 0,
              active: false,
              influence: 0,
              vx: 0,
              vy: 0,
            },
            repelRadius: 0,
            repelStrength: 0,
            width,
            height,
          })
        }
      }
      return
    }

    const tickHz = Math.max(1, qualityBudgetRef.current.ambientTickHz)
    if (ambientLastTickRef.current === 0) ambientLastTickRef.current = now
    ambientTickAccumRef.current += Math.min(100, Math.max(0, now - ambientLastTickRef.current))
    ambientLastTickRef.current = now
    const tickMs = 1000 / tickHz
    let steps = 0
    while (ambientTickAccumRef.current >= tickMs && steps < 4) {
      ambientTickAccumRef.current -= tickMs
      steps += 1
      const pointer = getPointerForFrame()
      const velocity = pointerVelocityRef.current
      stepAmbientField(field, {
        dt: tickMs / 1000,
        time: now / 1000,
        config,
        pointer: {
          x: pointer.x,
          y: pointer.y,
          active: !activeStrokeRef.current && pointer.active,
          influence: pointer.influence,
          vx: velocity.vx,
          vy: velocity.vy,
        },
        repelRadius: mouseRRef.current || 0,
        repelStrength: (weatherRepelRef.current || 6) * AMBIENT_POINTER_REPEL_SCALE,
        width,
        height,
      })
      resolveAmbientCollisionsTick(field)
    }
    // Drop the backlog if the tab was throttled so agents never lurch.
    if (steps === 4) ambientTickAccumRef.current = 0
  }

  // Quantized scaled font strings for weather agents (font changes are
  // expensive; sizes are rounded to halves and cached). Ambient typography
  // anchors to the fixed 12pt base font size — it is independently
  // controlled, never scaled by the scene glyph size.
  const getScaledAmbientFont = (sizeScale: number) => {
    const key = Math.max(0.5, Math.round(sizeScale * 2) / 2)
    const cache = matrixFontCacheRef.current
    const cached = cache.get(key)
    if (cached) return cached
    if (cache.size > 16) cache.clear()
    const base = fontSize * key
    const scaled = fontRef.current.replace(/^(\d+(?:\.\d+)?)px/, `${Math.round(base)}px`)
    cache.set(key, scaled)
    return scaled
  }

  // Render the live ambient agents between the background paint channel and
  // the main glyphs (render order: background → bg paint → ambient → glyphs).
  const drawAmbient = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const field = ambientFieldRef.current
    if (!field || field.count === 0) return
    const config = ambientConfigRef.current
    const chars = sourceCharsRef.current
    const charCount = Math.max(1, chars.length)

    if (field.mode === 'matrix') {
      // The streams render into an offscreen layer whose previous frame is
      // faded with destination-out, so the trail glow never dims the scene.
      const pixelRatio = pixelRatioRef.current
      let layer = ambientCanvasRef.current
      if (
        !layer ||
        layer.width !== Math.max(1, Math.round(W * pixelRatio)) ||
        layer.height !== Math.max(1, Math.round(H * pixelRatio))
      ) {
        layer = document.createElement('canvas')
        layer.width = Math.max(1, Math.round(W * pixelRatio))
        layer.height = Math.max(1, Math.round(H * pixelRatio))
        ambientCanvasRef.current = layer
      }
      const actx = layer.getContext('2d')
      if (!actx) return
      actx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      actx.globalCompositeOperation = 'destination-out'
      actx.fillStyle = `rgba(0, 0, 0, ${matrixTrailFade(config.matrix.trailStrength)})`
      actx.fillRect(0, 0, W, H)
      actx.globalCompositeOperation = 'source-over'
      actx.font = fontRef.current
      actx.textAlign = 'center'
      actx.textBaseline = 'middle'
      for (let i = 0; i < field.count; i += 1) {
        // Skip glyphs that are genuinely offscreen (columns extend a few rows
        // past the viewport for the wrap cycle); the canvas would clip them
        // anyway, and skipping avoids both the wasted draw and any clipped
        // edge seam. A margin of 3 line heights covers the bounded
        // displacement plus sway, so partially visible glyphs render fully.
        const ax = field.x[i]
        const ay = field.y[i]
        if (
          ay < -MATRIX_LINE_HEIGHT * 3 ||
          ay > H + MATRIX_LINE_HEIGHT * 3 ||
          ax < -MATRIX_GLYPH_WIDTH * 3 ||
          ax > W + MATRIX_GLYPH_WIDTH * 3
        ) {
          continue
        }
        const head = field.head[i] === 1
        const hue = field.hue[i]
        const lightness = head ? 86 : 54
        actx.shadowBlur = head ? fontSize * 0.9 : 0
        actx.shadowColor = `hsla(${hue}, 90%, 70%, 0.85)`
        actx.fillStyle = `hsla(${hue}, 88%, ${lightness}%, ${head ? 0.95 : 0.6})`
        actx.fillText(chars[i % charCount] || ' ', field.x[i], field.y[i])
      }
      actx.shadowBlur = 0
      ctx.drawImage(layer, 0, 0, W, H)
      return
    }

    // Weather: preset-driven agents, optionally softened by the blur knob.
    const preset = config.weather.preset
    const profile = WEATHER_PROFILES[preset]
    const blurPx = (config.weather.blur / 100) * 3
    ctx.save()
    if (blurPx > 0.05 && preset === 'fog') {
      try {
        ctx.filter = `blur(${blurPx.toFixed(2)}px)`
      } catch {}
    }
    const precipitation = profile.recycleBottom
    for (let i = 0; i < field.count; i += 1) {
      const x = field.x[i]
      const y = field.y[i]
      const hue = field.hue[i]
      const alpha = field.alpha[i]
      if (preset === 'fog') {
        // Large, very low-alpha soft discs; the blur knob finishes the haze.
        const radius = fontSize * field.size[i] * 2
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `hsla(${hue}, 12%, 88%, ${alpha})`)
        gradient.addColorStop(1, `hsla(${hue}, 12%, 88%, 0)`)
        ctx.fillStyle = gradient
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
        continue
      }
      if (precipitation && (preset === 'rain' || preset === 'storm')) {
        const streakLen = Math.min(48, field.vy[i] * 0.04)
        const streakX = -field.vx[i] * 0.04
        ctx.strokeStyle = `hsla(${hue}, 60%, 70%, ${alpha * 0.35})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + streakX, y - streakLen)
        ctx.stroke()
        ctx.fillStyle = `hsla(${hue}, 55%, 72%, ${alpha})`
        ctx.fillText(chars[i % charCount] || '|', x, y)
        continue
      }
      // Snow, blizzard, clear, wind: sized glyph flakes/motes.
      ctx.font = getScaledAmbientFont(field.size[i])
      ctx.fillStyle = `hsla(${hue}, 35%, 90%, ${alpha})`
      ctx.fillText(chars[i % charCount] || '.', x, y)
      ctx.font = fontRef.current
    }
    ctx.restore()
    // Storm lightning: a brief full-scene flash on top of the agents.
    if (field.lightningFlash > 0) {
      ctx.fillStyle = `rgba(235, 240, 255, ${(field.lightningFlash * 0.35).toFixed(3)})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  // Weather mood backdrop: the legacy mesh gradients, reused at the ambient
  // config's backdropOpacity over the configured background. 0 skips the
  // mesh entirely (the landing) while weather particles still render.
  const drawAmbientBackdrop = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const config = ambientConfigRef.current
    if (config.mode !== 'weather') return
    const opacity = config.backdropOpacity ?? BACKDROP_OPACITY_DEFAULT
    if (opacity <= 0) return
    const preset = config.weather.preset
    const meshes = meshBgsRef.current
    if (!meshes) return
    const mesh = preset === 'blizzard' ? meshes.snow : meshes[preset]
    if (!mesh) return
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.drawImage(mesh, 0, 0, W, H)
    ctx.restore()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctxRef.current = ctx

    // Observe the canvas container instead of the window so the scene tracks
    // its actual layout box; resize handling is debounced. Orientation
    // changes and mobile browser-chrome expansion/contraction ALSO trigger a
    // rebuild from current canvas dimensions — the container observer alone
    // can miss the momentary viewport states iOS Safari produces.
    const container = canvas.parentElement
    let resizeObserver: ResizeObserver | null = null
    const scheduleResizeScene = () => {
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current)
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        resizeTimeoutRef.current = null
        resizeScene()
      }, RESIZE_DEBOUNCE_MS)
    }
    const handleViewportChange = () => {
      if (!container) return
      viewportSizeRef.current = {
        width: Math.round(container.clientWidth),
        height: Math.round(container.clientHeight),
      }
      scheduleResizeScene()
    }
    if (container && typeof ResizeObserver !== 'undefined') {
      viewportSizeRef.current = {
        width: Math.round(container.clientWidth),
        height: Math.round(container.clientHeight),
      }
      resizeObserver = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect
        if (!rect) return
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)
        const prev = viewportSizeRef.current
        if (prev.width === width && prev.height === height) return
        viewportSizeRef.current = { width, height }
        scheduleResizeScene()
      })
      resizeObserver.observe(container)
    }
    window.addEventListener('orientationchange', handleViewportChange)
    window.visualViewport?.addEventListener('resize', handleViewportChange)

    resizeScene()

    setFontSize(12)
    activateSceneMode('svg')

    // Adaptive quality: anchor the warm-up clock and the mobile start tier to
    // the real viewport, then adopt the initial budgets.
    qualityControllerRef.current = createQualityController({
      mobile: isMobileViewport(viewportSizeRef.current.width),
      mountMs: performance.now(),
    })
    qualityBudgetRef.current = resolveEffectiveQualityBudget(
      qualityControllerRef.current.getTier(),
      viewportSizeRef.current.width,
    )
    if (qualityTierOverrideRef.current !== null) {
      qualityControllerRef.current.setOverride(qualityTierOverrideRef.current, performance.now())
    }
    applyQualityTier()

    const { addListeners, removeListeners } = createPointerListeners()
    addListeners()

    // Animated sources pause while the tab is hidden (provider contract);
    // the frame loop's own hidden-guard stops the sampling driver too.
    const handleProviderVisibility = () => {
      animatedProviderRef.current?.setPaused(document.hidden)
    }
    document.addEventListener('visibilitychange', handleProviderVisibility)

    canvas.style.touchAction = 'none'
    addCanvasPointerListeners(canvas)

    return () => {
      if (resizeObserver) resizeObserver.disconnect()
      window.removeEventListener('orientationchange', handleViewportChange)
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current)
        resizeTimeoutRef.current = null
      }
      // Invalidate pending source loads and scheduled rebuilds so nothing
      // resolves into an unmounted scene.
      svgLoadRequestRef.current += 1
      if (rebuildSvgTimeoutRef.current !== null) {
        window.clearTimeout(rebuildSvgTimeoutRef.current)
        rebuildSvgTimeoutRef.current = null
      }
      document.removeEventListener('visibilitychange', handleProviderVisibility)
      stopAnimatedProvider()
      animatedStagingRef.current = null
      removeListeners()
      removeCanvasPointerListeners(canvas)
    }
  }, [])

  useEffect(() => {
    const frame = (now: number) => {
      const ctx = ctxRef.current
      if (!ctx) return
      // Cheap early-return while the tab is hidden: no sim, no draw, no
      // diagnostics. The sim is per-frame (springs accumulate no time delta)
      // and ambient targets derive from the frame clock, so resuming never
      // flings glyphs.
      if (document.hidden) {
        animationRef.current = requestAnimationFrame(frame)
        return
      }
      const frameStart = performance.now()
      const revealedChars = Math.min(totalCharsRef.current, Math.floor((now - typewriterStartRef.current) / 1000 * TYPEWRITER_CPS))
      ctx.font = fontRef.current
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Pointer velocity for the ambient drag force: smoothed per-frame delta
      // of the repel pointer, decaying toward zero when the pointer rests.
      const pointerState = pointerRef.current
      const velocity = pointerVelocityRef.current
      if (velocity.lastNow > 0) {
        const dtMs = Math.max(1, now - velocity.lastNow)
        if (pointerState.active) {
          const instVx = ((pointerState.x - velocity.lastX) / dtMs) * 1000
          const instVy = ((pointerState.y - velocity.lastY) / dtMs) * 1000
          velocity.vx = lerp(velocity.vx, instVx, 0.35)
          velocity.vy = lerp(velocity.vy, instVy, 0.35)
        } else {
          velocity.vx *= 0.8
          velocity.vy *= 0.8
        }
      }
      velocity.lastX = pointerState.x
      velocity.lastY = pointerState.y
      velocity.lastNow = now
      // Paint stamping is processed at most once per animation frame.
      processPaintQueue()
      // Background paint evolution: bake settled strokes, redraw in-flight
      // blooms on the evolve layer. Zero work once all strokes settle.
      updatePaintEvolution(now)
      // Animated sources re-sample at the tier's sampling budget.
      sampleAnimatedSourceFrame(now)
      const mode = sceneModeRef.current
      if (mode === 'svg') drawSvgGlyphScene(now)
      else drawParagraph(now, revealedChars)
      // Theme cross-fade (feature/light-dark): the pre-change frame fades out
      // over the freshly drawn re-themed scene, then the snapshot is released
      // (ref nulled, canvas dropped). Skipped entirely under reduced motion —
      // beginThemeFade never captured one.
      const fadeSnapshot = themeFadeCanvasRef.current
      if (fadeSnapshot) {
        const fadeT = (now - themeFadeStartRef.current) / THEME_FADE_DURATION_MS
        if (fadeT >= 1) {
          themeFadeCanvasRef.current = null
        } else {
          const clampedT = Math.min(1, Math.max(0, fadeT))
          // ease-in-out (quadratic): slow at both ends of the 500ms fade.
          const eased =
            clampedT < 0.5
              ? 2 * clampedT * clampedT
              : 1 - Math.pow(-2 * clampedT + 2, 2) / 2
          const fadeCanvas = canvasRef.current
          if (fadeCanvas) {
            ctx.save()
            ctx.globalAlpha = 1 - eased
            ctx.drawImage(
              fadeSnapshot,
              0,
              0,
              fadeCanvas.width / pixelRatioRef.current,
              fadeCanvas.height / pixelRatioRef.current,
            )
            ctx.restore()
          }
        }
      }
      const frameCost = performance.now() - frameStart
      frameTimingRef.current.record(frameCost, frameStart)
      // Adaptive quality: feed the frame cost into the hysteresis controller
      // and apply the new budgets when a transition fires. Windows containing
      // a resize or a source rebuild are ignored by the controller.
      const controller = qualityControllerRef.current
      if (controller) {
        const transition = controller.recordFrame({
          timestampMs: frameStart,
          renderMs: frameCost,
          resized: qualityResizePendingRef.current,
          rebuilt: qualityRebuildPendingRef.current,
        })
        qualityResizePendingRef.current = false
        qualityRebuildPendingRef.current = false
        if (transition) applyQualityTier()
      }
      if (
        tuningModeRef.current &&
        frameStart - lastDiagnosticsPushRef.current >= DIAGNOSTICS_PUSH_INTERVAL_MS
      ) {
        lastDiagnosticsPushRef.current = frameStart
        pushDiagnostics()
      }
      // Reduced motion: one settled frame, then the loop stops. Rebuilds
      // re-arm a single frame via renderOnceRef; disabling reduced motion
      // restarts the continuous loop the same way.
      if (reducedMotionRef.current) {
        animationRef.current = null
        return
      }
      animationRef.current = requestAnimationFrame(frame)
    }

    renderOnceRef.current = () => {
      if (animationRef.current === null) {
        animationRef.current = requestAnimationFrame(frame)
      }
    }

    animationRef.current = requestAnimationFrame(frame)
    return () => {
      renderOnceRef.current = () => {}
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  // Pointer interaction state evaluated inside the single RAF.
  const pointerRef = useRef({
    x: -9999,
    y: -9999,
    active: false,
    kind: 'none' as PointerKind,
    touchPointerId: -1,
    fadeEndTime: 0,
    fadeStartX: -9999,
    fadeStartY: -9999,
    fadeStartActive: false,
  })

  const TOUCH_Y_OFFSET = -30
  const FADE_DURATION_MS = 350

  const getCanvasCssPoint = (event: PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: event.clientX, y: event.clientY }
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const updatePointerFromEvent = (event: PointerEvent, isTouch: boolean) => {
    const point = getCanvasCssPoint(event)
    pointerRef.current.x = point.x
    pointerRef.current.y = point.y + (isTouch ? TOUCH_Y_OFFSET : 0)
    pointerRef.current.active = true
    pointerRef.current.kind = isTouch ? 'touch' : 'mouse'
  }

  const startFade = () => {
    const state = pointerRef.current
    state.fadeStartX = state.x
    state.fadeStartY = state.y
    state.fadeStartActive = state.active
    state.fadeEndTime = performance.now() + FADE_DURATION_MS
    state.active = false
    state.touchPointerId = -1
  }

  const clearPointer = () => {
    const state = pointerRef.current
    state.active = false
    state.touchPointerId = -1
    state.fadeEndTime = 0
  }

  const onCanvasPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    updatePointerFromEvent(event, false)
    if (paintToolRef.current.enabled) {
      const point = getCanvasCssPoint(event)
      updateBrushRing(point.x, point.y, true)
    }
  }

  const onCanvasPointerMove = (event: PointerEvent) => {
    const stroke = activeStrokeRef.current
    if (stroke) {
      // Mid-gesture: queue paint points instead of driving the repel pointer.
      if (event.pointerId !== stroke.pointerId) return
      const point = getCanvasCssPoint(event)
      const y = point.y + (event.pointerType === 'touch' ? TOUCH_Y_OFFSET : 0)
      pendingPaintPointsRef.current.push(point.x, y)
      updateBrushRing(point.x, y, true)
      renderOnceRef.current()
      return
    }
    const state = pointerRef.current
    const isTouch = event.pointerType === 'touch'
    if (isTouch) {
      if (state.touchPointerId !== event.pointerId) return
      updatePointerFromEvent(event, true)
      if (canvasRef.current) {
        try {
          canvasRef.current.setPointerCapture(event.pointerId)
        } catch {}
      }
    } else {
      updatePointerFromEvent(event, false)
      if (paintToolRef.current.enabled) {
        const point = getCanvasCssPoint(event)
        updateBrushRing(point.x, point.y, true)
      }
    }
  }

  const onCanvasPointerDown = (event: PointerEvent) => {
    const isTouch = event.pointerType === 'touch'
    const state = pointerRef.current
    // Paint mode: a pointer press starts a stroke (mouse, pen, or the first
    // touch) and never fires a click impulse.
    if (paintToolRef.current.enabled) {
      if (activeStrokeRef.current) return
      if (isTouch && state.touchPointerId !== -1) return
      if (isTouch) state.touchPointerId = event.pointerId
      const point = getCanvasCssPoint(event)
      beginPaintStroke(event, {
        x: point.x,
        y: point.y + (isTouch ? TOUCH_Y_OFFSET : 0),
      })
      return
    }
    if (isTouch) {
      if (state.touchPointerId !== -1) return
      state.touchPointerId = event.pointerId
      updatePointerFromEvent(event, true)
      if (canvasRef.current) {
        try {
          canvasRef.current.setPointerCapture(event.pointerId)
        } catch {}
      }
    } else {
      updatePointerFromEvent(event, false)
    }
    // Click/tap blast: a one-shot radial velocity kick that the spring+damp
    // integration settles on its own. Fully skipped under reduced motion —
    // no impulse and no renderOnce re-arm, so the static frame stays settled.
    if (reducedMotionRef.current) return
    const affected = applyRadialImpulse(
      particlesRef.current,
      state.x,
      state.y,
      clickImpulseRadiusRef.current,
      clickImpulseForceRef.current,
    )
    // The ambient pool gets the same radial kick (typed-array mirror of
    // engine/impulse.ts), scaled by the shared interaction strength.
    const ambientField = ambientFieldRef.current
    if (ambientField) {
      applyAmbientRadialImpulse(
        ambientField,
        state.x,
        state.y,
        clickImpulseRadiusRef.current,
        clickImpulseForceRef.current * ambientConfigRef.current.interactionStrength,
      )
    }
    patchDiagnostics({
      impulseCount: diagnosticsRef.current.impulseCount + 1,
      lastImpulseAffected: affected,
    })
  }

  const onCanvasPointerUp = (event: PointerEvent) => {
    const stroke = activeStrokeRef.current
    if (stroke && event.pointerId === stroke.pointerId) {
      endPaintStroke()
      startFade()
      if (event.pointerType === 'touch') updateBrushRing(0, 0, false)
      return
    }
    const state = pointerRef.current
    if (event.pointerType === 'touch' && state.touchPointerId === event.pointerId) {
      startFade()
    }
  }

  const onCanvasPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    if (activeStrokeRef.current) return
    clearPointer()
    updateBrushRing(0, 0, false)
  }

  const onCanvasPointerCancel = (event: PointerEvent) => {
    const stroke = activeStrokeRef.current
    if (stroke && event.pointerId === stroke.pointerId) {
      endPaintStroke()
      startFade()
      updateBrushRing(0, 0, false)
      return
    }
    const state = pointerRef.current
    if (event.pointerType === 'touch' && state.touchPointerId === event.pointerId) {
      startFade()
    } else if (event.pointerType !== 'touch') {
      clearPointer()
      updateBrushRing(0, 0, false)
    }
  }

  const onLostPointerCapture = (event: PointerEvent) => {
    const stroke = activeStrokeRef.current
    if (stroke && event.pointerId === stroke.pointerId) {
      endPaintStroke()
      startFade()
      if (event.pointerType === 'touch') updateBrushRing(0, 0, false)
      return
    }
    const state = pointerRef.current
    if (event.pointerType === 'touch' && state.touchPointerId === event.pointerId) {
      startFade()
    }
  }

  const addCanvasPointerListeners = (canvas: HTMLCanvasElement) => {
    canvas.addEventListener('pointerenter', onCanvasPointerEnter)
    canvas.addEventListener('pointermove', onCanvasPointerMove)
    canvas.addEventListener('pointerdown', onCanvasPointerDown)
    canvas.addEventListener('pointerup', onCanvasPointerUp)
    canvas.addEventListener('pointerleave', onCanvasPointerLeave)
    canvas.addEventListener('pointercancel', onCanvasPointerCancel)
    canvas.addEventListener('lostpointercapture', onLostPointerCapture)
  }

  const removeCanvasPointerListeners = (canvas: HTMLCanvasElement) => {
    canvas.removeEventListener('pointerenter', onCanvasPointerEnter)
    canvas.removeEventListener('pointermove', onCanvasPointerMove)
    canvas.removeEventListener('pointerdown', onCanvasPointerDown)
    canvas.removeEventListener('pointerup', onCanvasPointerUp)
    canvas.removeEventListener('pointerleave', onCanvasPointerLeave)
    canvas.removeEventListener('pointercancel', onCanvasPointerCancel)
    canvas.removeEventListener('lostpointercapture', onLostPointerCapture)
  }

  const showTuningUi = tuningMode

  return (
    <div
      className={[
        'scene-root',
        paintTool?.enabled && 'scene-root-painting',
        className,
      ].filter(Boolean).join(' ')}
    >
      <canvas ref={canvasRef} />
      {paintTool?.enabled && (
        <div ref={brushRingRef} className="paint-brush-ring" aria-hidden="true" />
      )}
      {showTuningUi && (
        <div className="dev-diagnostics" aria-hidden="true">
          <div>mode: {diagnostics.mode}</div>
          <div>phase: {sequenceDiagnostics?.phase ?? '—'}</div>
          <div>elapsed: {Math.round(sequenceDiagnostics?.elapsedMs ?? 0)}ms</div>
          <div>progress: {(sequenceDiagnostics?.phaseProgress ?? 0).toFixed(2)}</div>
          <div>speed: {(sequenceDiagnostics?.speed ?? 1).toFixed(2)}x</div>
          <div>hidden: {sequenceDiagnostics?.documentHidden ? 'yes' : 'no'}</div>
          <div>source: {diagnostics.sourceStatus}{diagnostics.sourceError ? `: ${diagnostics.sourceError}` : ''}</div>
          <div>targets: {diagnostics.targetCount}</div>
          <div>glyphs: {diagnostics.glyphCount}</div>
          <div>visible: {diagnostics.visibleCount}</div>
          <div>assigned: {diagnostics.assignedCount}</div>
          <div>unassigned: {diagnostics.unassignedCount}</div>
          <div>hidden: {diagnostics.hiddenCount}</div>
          <div>
            motion: {diagnostics.motionMode}
            {diagnostics.motionMode === 'parametric-creature' ? `/${diagnostics.motionVariant}` : ''}
          </div>
          <div>
            density: {diagnostics.motionRequestedDensity} → {diagnostics.motionEffectiveDensity}
          </div>
          <div>
            rate: {diagnostics.motionRequestedUpdateRate} → {diagnostics.motionEffectiveUpdateRate} Hz
          </div>
          <div>painted: {diagnostics.paintedTargetCount}</div>
          <div>bg strokes: {diagnostics.paintedBackgroundStrokeCount}</div>
          <div>
            ambient: {diagnostics.ambientMode} ({diagnostics.ambientAgentCount} agents)
          </div>
          <div>collision: {diagnostics.ambientCollisionMs.toFixed(2)} ms/tick</div>
          <div>
            tier: T{diagnostics.qualityTier}
            {diagnostics.qualityTierOverride ? ' (override)' : ''} — {diagnostics.qualityLastTransition}
          </div>
          <div>
            budgets: glyphs ≤{diagnostics.qualityGlyphCap || '∞'}, creature ≤
            {diagnostics.qualityCreatureCap}@{diagnostics.qualityCreatureRate}Hz, ambient ≤
            {diagnostics.qualityAmbientCap}@{diagnostics.qualityAmbientTickHz}Hz
          </div>
        </div>
      )}
    </div>
  )
}

const SceneCanvas = forwardRef(SceneCanvasInternal)
export default SceneCanvas
