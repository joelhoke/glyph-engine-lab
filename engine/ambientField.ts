/**
 * Ambient agent pool (Stage 2): the weather and matrix effects, refactored
 * from the legacy whole-scene modes into a separate typed-array population
 * that renders as an overlay between the background paint channel and the
 * spring-tethered glyph field. The image glyphs are untouched — this pool is
 * created/destroyed when `ambient.mode` changes and is the only consumer of
 * the ambient budget; weather and matrix never run at the same time (the
 * single mode selector in engine/ambientConfig.ts guarantees that).
 *
 * Everything here is pure and DOM-free so scripts/verify-ambient-physics.js
 * can run the exact same physics in Node. Rendering lives in
 * components/SceneCanvas.tsx.
 */

import {
  AmbientConfig,
  WeatherPreset,
} from './ambientConfig'
import { RandomSource } from './random'

/**
 * Maximum collision responses a single ambient agent processes per physics
 * tick. Bounds the worst-case cost of a dense cell so the collision pass has
 * a hard per-agent ceiling.
 */
export const AMBIENT_MAX_COLLISION_RESPONSES = 8

/**
 * Clamp on the velocity delta (px/tick) a single collision response may
 * transfer to either party. Keeps stacked agents from exploding apart when a
 * cell goes dense.
 */
export const AMBIENT_COLLISION_IMPULSE_CLAMP = 0.6

/** Velocity retained after an agent bounces off a scene edge. */
export const AMBIENT_BOUNDS_DAMPING = 0.6

/** Center distance below which two agents collide, in px. */
export const AMBIENT_COLLISION_RADIUS = 10

/** Pointer-drag force scale: pointer velocity (px/s) → agent acceleration. */
export const AMBIENT_DRAG_FORCE_SCALE = 0.9

/** Line height the matrix streams space their rows on, in px. */
export const MATRIX_LINE_HEIGHT = 17

/** Base glyph width used for matrix column spacing, in px. */
export const MATRIX_GLYPH_WIDTH = 8

/**
 * Offscreen gutter (px) weather agents wrap through horizontally. Agents
 * crossing one edge re-enter just past the other, so sustained wind never
 * accumulates a persistent row at the viewport edge.
 */
export const AMBIENT_WRAP_GUTTER = 24

/**
 * Matrix displacement bounds: pointer/collision offsets may push a stream
 * glyph at most this far from its home position, so streams always remain
 * associated with their original columns.
 */
export const MATRIX_MAX_DISPLACEMENT_X = MATRIX_GLYPH_WIDTH * 3
export const MATRIX_MAX_DISPLACEMENT_Y = MATRIX_LINE_HEIGHT * 2

/** Rows of head-glow falloff: an agent within this distance of the stream
 *  head renders with the glow flag set. */
export const MATRIX_HEAD_GLOW_RANGE = 0.9

/** Matrix column fall-speed range (line heights per 1/60s frame at speed 100),
 *  mirroring the legacy FALL_SPEED_MIN/MAX constants. */
export const MATRIX_FALL_SPEED_MIN = 0.35
export const MATRIX_FALL_SPEED_MAX = 1.45

/**
 * Static per-preset parameter table. Every preset must be visually distinct,
 * so no two profiles share a row — scripts/verify-ambient-physics.js asserts
 * pairwise distinctness on the numeric fields.
 */
export type WeatherProfile = {
  /** Base fall speed in px/s at intensity 100, and its per-agent spread. */
  fallSpeed: number
  fallSpread: number
  /** Horizontal drift in px/s at wind 50. */
  windScale: number
  /** Wander amplitude multiplier for the turbulence knob. */
  turbulenceScale: number
  /** Share of the ambient budget filled at intensity 100, 0–1. */
  density: number
  /** Agent alpha range. */
  alphaMin: number
  alphaMax: number
  /** Agent glyph scale range (multiplier of the scene font size). */
  sizeMin: number
  sizeMax: number
  /** Base hue for the preset's agents. */
  hue: number
  /** Precipitation recycles to the top after passing the bottom edge instead
   *  of bouncing; all other agents bounce off every edge. */
  recycleBottom: boolean
  /** Storm-only lightning bookkeeping (flash timer + brightness decay). */
  lightning: boolean
}

export const WEATHER_PROFILES: Record<WeatherPreset, WeatherProfile> = {
  // Clear: a few slow-drifting motes, barely there.
  clear: {
    fallSpeed: 4,
    fallSpread: 6,
    windScale: 8,
    turbulenceScale: 0.5,
    density: 0.25,
    alphaMin: 0.08,
    alphaMax: 0.2,
    sizeMin: 0.7,
    sizeMax: 1,
    hue: 210,
    recycleBottom: false,
    lightning: false,
  },
  // Rain: fast vertical streaks with a slight slant.
  rain: {
    fallSpeed: 420,
    fallSpread: 240,
    windScale: 30,
    turbulenceScale: 0.4,
    density: 0.55,
    alphaMin: 0.25,
    alphaMax: 0.7,
    sizeMin: 0.8,
    sizeMax: 1,
    hue: 200,
    recycleBottom: true,
    lightning: false,
  },
  // Storm: heavier, faster rain with strong gusts and lightning flashes.
  storm: {
    fallSpeed: 560,
    fallSpread: 320,
    windScale: 90,
    turbulenceScale: 1.2,
    density: 0.7,
    alphaMin: 0.3,
    alphaMax: 0.8,
    sizeMin: 0.8,
    sizeMax: 1.1,
    hue: 205,
    recycleBottom: true,
    lightning: true,
  },
  // Snow: slow fluffy fall with a wide gentle wander.
  snow: {
    fallSpeed: 55,
    fallSpread: 45,
    windScale: 20,
    turbulenceScale: 1,
    density: 0.5,
    alphaMin: 0.5,
    alphaMax: 0.95,
    sizeMin: 0.9,
    sizeMax: 1.6,
    hue: 210,
    recycleBottom: true,
    lightning: false,
  },
  // Blizzard: dense, fast, strongly angled snow.
  blizzard: {
    fallSpeed: 260,
    fallSpread: 160,
    windScale: 140,
    turbulenceScale: 1.6,
    density: 0.9,
    alphaMin: 0.5,
    alphaMax: 1,
    sizeMin: 0.9,
    sizeMax: 1.8,
    hue: 205,
    recycleBottom: true,
    lightning: false,
  },
  // Fog: large, very low-alpha agents drifting slowly; the blur knob does the
  // rest at render time.
  fog: {
    fallSpeed: 6,
    fallSpread: 8,
    windScale: 14,
    turbulenceScale: 0.6,
    density: 0.4,
    alphaMin: 0.05,
    alphaMax: 0.16,
    sizeMin: 2.5,
    sizeMax: 5,
    hue: 220,
    recycleBottom: false,
    lightning: false,
  },
  // Wind: light agents racing horizontally, gusting with turbulence.
  wind: {
    fallSpeed: 30,
    fallSpread: 40,
    windScale: 220,
    turbulenceScale: 2,
    density: 0.45,
    alphaMin: 0.15,
    alphaMax: 0.45,
    sizeMin: 0.8,
    sizeMax: 1.2,
    hue: 160,
    recycleBottom: false,
    lightning: false,
  },
}

/**
 * Heavy weather scenes: the presets whose agent density and fall speed make
 * the per-frame render the expensive path. In SceneCanvas these render into a
 * reduced-resolution offscreen layer (composited scaled up with smoothing)
 * and run their physics at an extra-capped cadence; clear/wind stay direct
 * (few slow agents — no measurable benefit) and matrix keeps its own trail
 * layer at full resolution.
 */
export const HEAVY_WEATHER_PRESETS: readonly WeatherPreset[] = [
  'rain',
  'storm',
  'snow',
  'blizzard',
  'fog',
]

export function isHeavyWeatherPreset(preset: WeatherPreset): boolean {
  return HEAVY_WEATHER_PRESETS.indexOf(preset) >= 0
}

/** Reduced-resolution layer scale for heavy scenes: T0/T1 render at half
 *  resolution, T2/T3 at 0.4 — soft weather reads fine scaled up, and the
 *  composite is a single drawImage. */
export function resolveHeavyAmbientLayerScale(tier: number): number {
  return tier <= 1 ? 0.5 : 0.4
}

/** Extra physics cadence cap for heavy scenes on top of the tier's
 *  ambientTickHz budget: 20 Hz on T0/T1, 15 Hz on T2/T3. */
export function resolveHeavyAmbientTickCap(tier: number): number {
  return tier <= 1 ? 20 : 15
}

/** Typed-array ambient pool. `count` agents are live; buffers are sized to
 *  `capacity` (the effective ambient budget). */
export type AmbientField = {
  mode: 'weather' | 'matrix'
  capacity: number
  count: number
  x: Float32Array
  y: Float32Array
  /** Weather: velocity in px/s. Matrix: decaying pointer-displacement offset. */
  vx: Float32Array
  vy: Float32Array
  /** Weather: base fall speed in px/s. */
  speed: Float32Array
  /** Per-agent wander phase. */
  phase: Float32Array
  alpha: Float32Array
  size: Float32Array
  hue: Float32Array
  /** Matrix: 1 while the agent is the stream head (renders with glow). */
  head: Uint8Array
  /** Matrix: stream index per agent. */
  column: Int32Array
  /** Matrix: row offset within the stream. */
  row: Float32Array
  /** Matrix: per-column x position, fall speed (px/s), and scroll offset. */
  columnX: Float32Array
  columnSpeed: Float32Array
  columnScroll: Float32Array
  columnCount: number
  rowsPerColumn: number
  /** Storm lightning: seconds until the next flash, current brightness 0–1. */
  lightningTimer: number
  lightningFlash: number
  width: number
  height: number
}

/** Allocate and initialize the pool for the given mode. Weather agents get
 *  uniform random placement and per-agent parameter draws from the seeded
 *  random source; matrix agents are laid out as falling columns. */
export function createAmbientField(
  mode: 'weather' | 'matrix',
  capacity: number,
  width: number,
  height: number,
  config: AmbientConfig,
  random: RandomSource,
): AmbientField {
  const cap = Math.max(0, Math.floor(capacity))
  const field: AmbientField = {
    mode,
    capacity: cap,
    count: 0,
    x: new Float32Array(cap),
    y: new Float32Array(cap),
    vx: new Float32Array(cap),
    vy: new Float32Array(cap),
    speed: new Float32Array(cap),
    phase: new Float32Array(cap),
    alpha: new Float32Array(cap),
    size: new Float32Array(cap),
    hue: new Float32Array(cap),
    head: new Uint8Array(cap),
    column: new Int32Array(cap),
    row: new Float32Array(cap),
    columnX: new Float32Array(0),
    columnSpeed: new Float32Array(0),
    columnScroll: new Float32Array(0),
    columnCount: 0,
    rowsPerColumn: 0,
    lightningTimer: 1.5,
    lightningFlash: 0,
    width,
    height,
  }
  if (mode === 'weather') {
    const profile = WEATHER_PROFILES[config.weather.preset]
    for (let i = 0; i < cap; i += 1) {
      field.x[i] = random() * width
      field.y[i] = random() * height
      field.speed[i] = profile.fallSpeed + random() * profile.fallSpread
      field.phase[i] = random() * Math.PI * 2
      field.alpha[i] = profile.alphaMin + random() * (profile.alphaMax - profile.alphaMin)
      field.size[i] = profile.sizeMin + random() * (profile.sizeMax - profile.sizeMin)
      field.hue[i] = profile.hue + (random() - 0.5) * 12
    }
  } else {
    const spreadFactor = config.matrix.spread / 100
    const colStep = Math.max(
      MATRIX_GLYPH_WIDTH * 1.05 * spreadFactor,
      MATRIX_GLYPH_WIDTH * 0.7,
    )
    const columnCount = Math.max(6, Math.floor((width * 0.9) / colStep))
    const startX = (width - (columnCount - 1) * colStep) / 2
    const rowsPerColumn = Math.max(14, Math.ceil(height / MATRIX_LINE_HEIGHT) + 8)
    field.columnCount = columnCount
    field.rowsPerColumn = rowsPerColumn
    field.columnX = new Float32Array(columnCount)
    field.columnSpeed = new Float32Array(columnCount)
    field.columnScroll = new Float32Array(columnCount)
    for (let c = 0; c < columnCount; c += 1) {
      field.columnX[c] = startX + c * colStep
      // Line heights per 1/60s frame → px/s at the current speed multiplier.
      field.columnSpeed[c] =
        (MATRIX_FALL_SPEED_MIN + random() * (MATRIX_FALL_SPEED_MAX - MATRIX_FALL_SPEED_MIN)) *
        MATRIX_LINE_HEIGHT * 60
      field.columnScroll[c] = random() * rowsPerColumn * MATRIX_LINE_HEIGHT
    }
    for (let i = 0; i < cap; i += 1) {
      field.column[i] = i % columnCount
      field.row[i] = Math.floor(i / columnCount)
      field.phase[i] = random() * Math.PI * 2
      field.hue[i] = 115 + (i % 24)
    }
  }
  field.count = resolveAmbientCount(field, config)
  return field
}

/** Live agent count for the current knobs: intensity (weather) and volume
 *  (matrix) scale into the budget without rebuilding the pool. */
export function resolveAmbientCount(field: AmbientField, config: AmbientConfig): number {
  if (field.capacity === 0) return 0
  if (field.mode === 'weather') {
    const profile = WEATHER_PROFILES[config.weather.preset]
    return Math.min(
      field.capacity,
      Math.round(field.capacity * profile.density * (config.weather.intensity / 100)),
    )
  }
  const totalSlots = field.columnCount * field.rowsPerColumn
  return Math.min(
    field.capacity,
    Math.round(totalSlots * (config.matrix.volume / 100)),
  )
}

export type AmbientPointer = {
  x: number
  y: number
  active: boolean
  /** Fade envelope 0–1, same idiom as the main-field repel pointer. */
  influence: number
  /** Pointer velocity in px/s; drives the drag force. */
  vx: number
  vy: number
}

export type AmbientStepParams = {
  /** Seconds since the previous physics tick. */
  dt: number
  /** Absolute scene clock in seconds (wander phases). */
  time: number
  /** Clamped ambient config (engine/ambientConfig). */
  config: AmbientConfig
  pointer: AmbientPointer
  /** Pointer repel radius in px (the scene's mouseR). */
  repelRadius: number
  /** Pointer repel strength, pre-multiplied by the caller (weatherRepelMult
   *  idiom); interactionStrength is applied inside. */
  repelStrength: number
  width: number
  height: number
}

const INACTIVE_POINTER: AmbientPointer = {
  x: 0,
  y: 0,
  active: false,
  influence: 0,
  vx: 0,
  vy: 0,
}

/** Pointer forces shared by both effects: radial repel while hovering plus a
 *  directional drag force (pointer velocity scaled by interactionStrength). */
function applyPointerForces(
  field: AmbientField,
  i: number,
  pointer: AmbientPointer,
  repelRadius: number,
  repelStrength: number,
  interactionStrength: number,
  dt: number,
) {
  if (!pointer.active || pointer.influence <= 0 || repelRadius <= 0) return
  const dx = field.x[i] - pointer.x
  const dy = field.y[i] - pointer.y
  const distSq = dx * dx + dy * dy
  if (distSq <= 0 || distSq >= repelRadius * repelRadius) return
  const dist = Math.sqrt(distSq)
  const falloff = (1 - dist / repelRadius) * pointer.influence * interactionStrength
  field.vx[i] += (dx / dist) * falloff * repelStrength
  field.vy[i] += (dy / dist) * falloff * repelStrength
  field.vx[i] += pointer.vx * falloff * AMBIENT_DRAG_FORCE_SCALE * dt
  field.vy[i] += pointer.vy * falloff * AMBIENT_DRAG_FORCE_SCALE * dt
}

/**
 * Edge handling: horizontal movement WRAPS through a small offscreen gutter
 * (AMBIENT_WRAP_GUTTER) — agents exiting one side re-enter just past the
 * other, so sustained wind distributes instead of piling up at an edge.
 * Vertical behavior is unchanged: the bottom edge recycles precipitation
 * profiles back to the top and bounces for everything else; the top edge
 * bounces. Matrix streams are viewport-bound by construction (positions
 * derive from wrapped column scrolls), so only their pointer-displacement
 * offsets are decayed (and clamped, below).
 */
function applyBounds(field: AmbientField, i: number, width: number, height: number, recycleBottom: boolean) {
  const wrapWidth = width + AMBIENT_WRAP_GUTTER * 2
  if (field.x[i] < -AMBIENT_WRAP_GUTTER) {
    field.x[i] += wrapWidth
  } else if (field.x[i] > width + AMBIENT_WRAP_GUTTER) {
    field.x[i] -= wrapWidth
  }
  if (field.y[i] < 0) {
    field.y[i] = 0
    field.vy[i] = -field.vy[i] * AMBIENT_BOUNDS_DAMPING
  } else if (field.y[i] > height) {
    if (recycleBottom) {
      field.y[i] = 0
      field.vy[i] = field.speed[i]
    } else {
      field.y[i] = height
      field.vy[i] = -field.vy[i] * AMBIENT_BOUNDS_DAMPING
    }
  }
}

/** Advance the pool by one physics tick. */
export function stepAmbientField(field: AmbientField, params: AmbientStepParams): void {
  const dt = Math.min(0.1, Math.max(0, params.dt))
  if (dt === 0) return
  const { config } = params
  const interaction = config.interactionStrength
  const pointer = params.pointer ?? INACTIVE_POINTER
  field.count = resolveAmbientCount(field, config)

  if (field.mode === 'weather') {
    const weather = config.weather
    const profile = WEATHER_PROFILES[weather.preset]
    const intensityMul = weather.intensity / 100
    // Signed wind: the 0–100 knob centers on 50 (calm); below 50 blows
    // leftward, above 50 rightward. The interface is unchanged.
    const wind = ((weather.wind - 50) / 50) * profile.windScale
    const turbAmp = (weather.turbulence / 60) * profile.turbulenceScale * 40
    const velBlend = Math.min(1, dt * 2.5)
    if (profile.lightning) {
      field.lightningTimer -= dt
      if (field.lightningTimer <= 0) {
        field.lightningFlash = 1
        // Ambient churn intentionally stays on Math.random (engine/random.ts).
        field.lightningTimer = 2 + Math.random() * 6
      }
      field.lightningFlash = Math.max(0, field.lightningFlash - dt * 3)
    }
    for (let i = 0; i < field.count; i += 1) {
      const targetVy = field.speed[i] * intensityMul
      const targetVx =
        wind + Math.sin(params.time * 1.3 + field.phase[i]) * turbAmp
      field.vx[i] += (targetVx - field.vx[i]) * velBlend
      field.vy[i] += (targetVy - field.vy[i]) * velBlend
      applyPointerForces(
        field,
        i,
        pointer,
        params.repelRadius,
        params.repelStrength,
        interaction,
        dt,
      )
      field.x[i] += field.vx[i] * dt
      field.y[i] += field.vy[i] * dt
      applyBounds(field, i, params.width, params.height, profile.recycleBottom)
    }
    return
  }

  // Matrix: columns scroll downward and wrap; agent positions derive from the
  // column scroll, with decaying pointer offsets on top.
  const speedFactor = config.matrix.speed / 100
  const wrapHeight = (field.rowsPerColumn + 4) * MATRIX_LINE_HEIGHT
  const decay = Math.pow(0.9, dt * 60)
  for (let c = 0; c < field.columnCount; c += 1) {
    let scroll = field.columnScroll[c] + field.columnSpeed[c] * speedFactor * dt
    if (scroll >= wrapHeight) scroll -= wrapHeight
    field.columnScroll[c] = scroll
  }
  for (let i = 0; i < field.count; i += 1) {
    const c = field.column[i]
    const scroll = field.columnScroll[c]
    const headRow = scroll / MATRIX_LINE_HEIGHT
    const rowDelta = Math.abs(field.row[i] - (headRow % field.rowsPerColumn))
    field.head[i] = rowDelta < MATRIX_HEAD_GLOW_RANGE ? 1 : 0
    applyPointerForces(
      field,
      i,
      pointer,
      params.repelRadius,
      params.repelStrength,
      interaction,
      dt,
    )
    field.vx[i] *= decay
    field.vy[i] *= decay
    // Bound pointer/collision displacement so the stream glyph always stays
    // within reach of its home column (never pushed into a neighbor's lane
    // or off the scene).
    if (field.vx[i] > MATRIX_MAX_DISPLACEMENT_X) field.vx[i] = MATRIX_MAX_DISPLACEMENT_X
    else if (field.vx[i] < -MATRIX_MAX_DISPLACEMENT_X) field.vx[i] = -MATRIX_MAX_DISPLACEMENT_X
    if (field.vy[i] > MATRIX_MAX_DISPLACEMENT_Y) field.vy[i] = MATRIX_MAX_DISPLACEMENT_Y
    else if (field.vy[i] < -MATRIX_MAX_DISPLACEMENT_Y) field.vy[i] = -MATRIX_MAX_DISPLACEMENT_Y
    const baseY =
      ((field.row[i] * MATRIX_LINE_HEIGHT + scroll) % wrapHeight) - MATRIX_LINE_HEIGHT * 2
    field.x[i] =
      field.columnX[c] +
      Math.sin(params.time * 1.5 + field.row[i] * 0.35) * 1.5 +
      field.vx[i]
    field.y[i] = baseY + field.vy[i]
  }
}

/**
 * Normalize transient positions after the measured region changed (resize,
 * orientation change, dynamic browser chrome, ambient-field rebuild,
 * visibility resume) without discarding the pool's accumulated state.
 * Weather agents wrap into the gutter-extended horizontal range and clamp
 * into the vertical range; matrix streams clamp their displacement offsets
 * and wrap column scrolls. Structural viewport changes still rebuild the
 * matrix column layout (resizeScene), so this never re-derives columns.
 * Allocation-free.
 */
export function normalizeAmbientField(
  field: AmbientField,
  width: number,
  height: number,
): void {
  const wrapWidth = width + AMBIENT_WRAP_GUTTER * 2
  if (field.mode === 'weather') {
    for (let i = 0; i < field.capacity; i += 1) {
      let x = field.x[i]
      // Modulo-wrap into [-GUTTER, width + GUTTER] regardless of how stale
      // the position is (e.g. a much narrower viewport after rotation).
      x = ((x + AMBIENT_WRAP_GUTTER) % wrapWidth + wrapWidth) % wrapWidth - AMBIENT_WRAP_GUTTER
      field.x[i] = x
      if (field.y[i] < 0) field.y[i] = 0
      else if (field.y[i] > height) field.y[i] = height
    }
  } else {
    const wrapHeight = (field.rowsPerColumn + 4) * MATRIX_LINE_HEIGHT
    for (let c = 0; c < field.columnCount; c += 1) {
      let scroll = field.columnScroll[c]
      scroll = ((scroll % wrapHeight) + wrapHeight) % wrapHeight
      field.columnScroll[c] = scroll
    }
    for (let i = 0; i < field.capacity; i += 1) {
      if (field.vx[i] > MATRIX_MAX_DISPLACEMENT_X) field.vx[i] = MATRIX_MAX_DISPLACEMENT_X
      else if (field.vx[i] < -MATRIX_MAX_DISPLACEMENT_X) field.vx[i] = -MATRIX_MAX_DISPLACEMENT_X
      if (field.vy[i] > MATRIX_MAX_DISPLACEMENT_Y) field.vy[i] = MATRIX_MAX_DISPLACEMENT_Y
      else if (field.vy[i] < -MATRIX_MAX_DISPLACEMENT_Y) field.vy[i] = -MATRIX_MAX_DISPLACEMENT_Y
      const c = field.column[i]
      const baseY =
        ((field.row[i] * MATRIX_LINE_HEIGHT + field.columnScroll[c]) % wrapHeight) -
        MATRIX_LINE_HEIGHT * 2
      field.x[i] = field.columnX[c] + field.vx[i]
      field.y[i] = baseY + field.vy[i]
    }
  }
  field.width = width
  field.height = height
}

/**
 * One-shot radial velocity kick for tap/click blasts — the typed-array mirror
 * of engine/impulse.ts (same linear falloff), so taps feel identical on the
 * ambient pool and the main glyph population.
 */
export function applyAmbientRadialImpulse(
  field: AmbientField,
  cx: number,
  cy: number,
  radius: number,
  force: number,
): number {
  if (radius <= 0 || force === 0) return 0
  let affected = 0
  for (let i = 0; i < field.count; i += 1) {
    const dx = field.x[i] - cx
    const dy = field.y[i] - cy
    const distSq = dx * dx + dy * dy
    if (distSq <= 0 || distSq >= radius * radius) continue
    const dist = Math.sqrt(distSq)
    const kick = (1 - dist / radius) * force
    field.vx[i] += (dx / dist) * kick
    field.vy[i] += (dy / dist) * kick
    affected += 1
  }
  return affected
}

/**
 * Uniform hash grid over the combined ambient + main-glyph population,
 * rebuilt from scratch every physics tick. Linked-list buckets keep the build
 * allocation-free after creation. Combined indexing: [0, ambientCount) are
 * ambient agents, [ambientCount, ambientCount + mainCount) are main glyphs.
 */
export type AmbientCollisionGrid = {
  cellSize: number
  cols: number
  rows: number
  head: Int32Array
  next: Int32Array
}

export function createAmbientCollisionGrid(
  width: number,
  height: number,
  totalCapacity: number,
): AmbientCollisionGrid {
  const cellSize = AMBIENT_COLLISION_RADIUS * 2
  const cols = Math.max(1, Math.ceil(width / cellSize))
  const rows = Math.max(1, Math.ceil(height / cellSize))
  return {
    cellSize,
    cols,
    rows,
    head: new Int32Array(cols * rows),
    next: new Int32Array(totalCapacity),
  }
}

export function rebuildAmbientCollisionGrid(
  grid: AmbientCollisionGrid,
  field: AmbientField,
  mainX: Float32Array,
  mainY: Float32Array,
  mainCount: number,
): void {
  grid.head.fill(-1)
  const total = field.count + mainCount
  for (let i = 0; i < total; i += 1) {
    const x = i < field.count ? field.x[i] : mainX[i - field.count]
    const y = i < field.count ? field.y[i] : mainY[i - field.count]
    const cx = Math.min(grid.cols - 1, Math.max(0, Math.floor(x / grid.cellSize)))
    const cy = Math.min(grid.rows - 1, Math.max(0, Math.floor(y / grid.cellSize)))
    const cell = cy * grid.cols + cx
    grid.next[i] = grid.head[cell]
    grid.head[cell] = i
  }
}

/**
 * Resolve collisions against the grid. Ambient agents respond to nearby
 * ambient agents and main glyphs; main glyphs are never checked against each
 * other. Each ambient agent processes at most AMBIENT_MAX_COLLISION_RESPONSES
 * responses per tick, and every transferred impulse is clamped to
 * AMBIENT_COLLISION_IMPULSE_CLAMP. Responses against main glyphs accumulate a
 * counter-impulse into mainImpulseX/Y for the caller to apply.
 *
 * Returns the number of responses processed (for cost diagnostics).
 */
export function resolveAmbientCollisions(
  field: AmbientField,
  grid: AmbientCollisionGrid,
  mainX: Float32Array,
  mainY: Float32Array,
  mainCount: number,
  mainImpulseX: Float32Array,
  mainImpulseY: Float32Array,
): number {
  let responses = 0
  const radius = AMBIENT_COLLISION_RADIUS
  const radiusSq = radius * radius
  for (let i = 0; i < field.count; i += 1) {
    const cx = Math.min(grid.cols - 1, Math.max(0, Math.floor(field.x[i] / grid.cellSize)))
    const cy = Math.min(grid.rows - 1, Math.max(0, Math.floor(field.y[i] / grid.cellSize)))
    let processed = 0
    for (let oy = -1; oy <= 1 && processed < AMBIENT_MAX_COLLISION_RESPONSES; oy += 1) {
      const row = cy + oy
      if (row < 0 || row >= grid.rows) continue
      for (let ox = -1; ox <= 1 && processed < AMBIENT_MAX_COLLISION_RESPONSES; ox += 1) {
        const col = cx + ox
        if (col < 0 || col >= grid.cols) continue
        let j = grid.head[row * grid.cols + col]
        while (j !== -1 && processed < AMBIENT_MAX_COLLISION_RESPONSES) {
          const next = grid.next[j]
          if (j !== i) {
            const isMain = j >= field.count
            // Ambient agents only respond to main glyphs and to higher-indexed
            // ambient agents, so each ambient pair resolves exactly once.
            if (isMain || j > i) {
              const jx = isMain ? mainX[j - field.count] : field.x[j]
              const jy = isMain ? mainY[j - field.count] : field.y[j]
              const dx = field.x[i] - jx
              const dy = field.y[i] - jy
              const distSq = dx * dx + dy * dy
              if (distSq > 0 && distSq < radiusSq) {
                const dist = Math.sqrt(distSq)
                // Center-overlap responses would transfer up to 1.2 px/tick;
                // the clamp caps every response at 0.6 (documented above).
                const raw = (1 - dist / radius) * 1.2
                const impulse = Math.min(AMBIENT_COLLISION_IMPULSE_CLAMP, raw)
                const ix = (dx / dist) * impulse
                const iy = (dy / dist) * impulse
                field.vx[i] += ix
                field.vy[i] += iy
                if (isMain) {
                  mainImpulseX[j - field.count] -= ix
                  mainImpulseY[j - field.count] -= iy
                } else {
                  field.vx[j] -= ix
                  field.vy[j] -= iy
                }
                processed += 1
                responses += 1
              }
            }
          }
          j = next
        }
      }
    }
  }
  return responses
}
