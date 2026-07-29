/**
 * Procedural target motion for the glyph field.
 *
 * Two systems share this module:
 *
 * - `organic-flow` coherently displaces the source's immutable base targets
 *   using normalized position, stable per-target phase metadata, and layered
 *   waves. Amount 0 reproduces the base targets exactly, so disabling motion
 *   always returns the field to its sampled silhouette.
 * - `parametric-creature` replaces target positions with a generated creature
 *   while the glyph population and proportionally inherited source colors are
 *   retained (the caller rebuilds the color map alongside the topology).
 *
 * Creatures are registered in CREATURE_DEFINITIONS: one entry = topology
 * builder + frame compute + label, so an authored variant is a single
 * additive edit. The `custom` variant is the bounded visitor lab — its shape
 * comes from clamped numeric knobs (CustomCreatureParams), never code eval.
 *
 * Performance contract: topology/phase data is precomputed at build time, and
 * the compute functions write into caller-owned typed arrays. Nothing in the
 * frame-loop path allocates objects or arrays, and every variant is a pure,
 * deterministic function of its inputs — a fixed time always yields the same
 * finite output, which is what scripts/verify-motion.js asserts.
 */

import { CustomCreatureForm, CustomCreatureParams, ParametricVariant } from './motionConfig'

const TAU = Math.PI * 2

/** Per-frame wave parameters, already resolved from the UI-facing config. */
export type MotionWaveParams = {
  /** Procedural time in seconds (frozen while painting; fixed when reduced motion). */
  time: number
  /** Displacement intensity normalized to [0, 1]. */
  amount: number
  /** Procedural time multiplier. */
  speed: number
  /** Spatial frequency multiplier. */
  waveScale: number
  /** Number of layered wave terms, 1–4. */
  complexity: number
  /** Viewport size in CSS pixels. */
  width: number
  height: number
  /** Bounded custom-lab knobs (only read by the custom variant). */
  custom?: CustomCreatureParams
}

/**
 * Immutable base field: the sampled source targets plus their normalized
 * spatial metadata and a stable per-target phase. Rebuilt on source/resize
 * changes only, never per frame.
 */
export type MotionBaseField = {
  count: number
  baseX: Float32Array
  baseY: Float32Array
  normX: Float32Array
  normY: Float32Array
  phase: Float32Array
}

/** Deterministic per-index phase in [0, TAU) — stable across rebuilds. */
function indexPhase(index: number): number {
  return (((Math.imul(index + 1, 2654435761) >>> 0) / 4294967296) * TAU) % TAU
}

/** Deterministic per-index hash in [0, 1). */
function hash01(index: number, salt: number): number {
  return (Math.imul(index + 1 + salt * 7919, 2246822519) >>> 0) / 4294967296
}

/** Attach stable phase metadata to a sampled base field. */
export function buildMotionBaseField(
  baseX: Float32Array,
  baseY: Float32Array,
  normX: Float32Array,
  normY: Float32Array,
): MotionBaseField {
  const count = Math.min(baseX.length, baseY.length)
  const phase = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    phase[i] = indexPhase(i)
  }
  return { count, baseX, baseY, normX, normY, phase }
}

/**
 * Organic flow: layered, position-coherent waves displacing the base targets.
 * The displacement amplitude is a small fraction of the viewport so the
 * silhouette stays recognizable at normal amounts, and amount 0 copies the
 * base targets verbatim (exact return when motion is disabled).
 */
export function computeOrganicTargets(
  field: MotionBaseField,
  params: MotionWaveParams,
  outX: Float32Array,
  outY: Float32Array,
): void {
  const { count, baseX, baseY, normX, normY, phase } = field
  const amount = params.amount

  if (amount <= 0) {
    for (let i = 0; i < count; i += 1) {
      outX[i] = baseX[i]
      outY[i] = baseY[i]
    }
    return
  }

  const tw = params.time * params.speed
  const ws = params.waveScale
  const complexity = Math.max(1, Math.min(4, Math.round(params.complexity)))
  const amplitude = Math.min(params.width, params.height) * 0.09 * amount

  for (let i = 0; i < count; i += 1) {
    const nx = normX[i]
    const ny = normY[i]
    const ph = phase[i]

    let dx = Math.sin(ny * TAU * 1.2 * ws + tw + ph)
    let dy = Math.cos(nx * TAU * 1.2 * ws + tw * 0.9 + ph)
    let weight = 1

    if (complexity >= 2) {
      dx += 0.5 * Math.sin(ny * TAU * 2.6 * ws - tw * 1.3 + ph * 2)
      dy += 0.5 * Math.cos(nx * TAU * 2.1 * ws + tw * 1.15 + ph * 1.5)
      weight += 0.5
    }
    if (complexity >= 3) {
      dx += 0.25 * Math.sin((nx + ny) * TAU * 3.8 * ws + tw * 1.7 + ph * 3)
      dy += 0.25 * Math.cos((nx - ny) * TAU * 3.4 * ws - tw * 1.45 + ph * 2.5)
      weight += 0.25
    }
    if (complexity >= 4) {
      dx += 0.125 * Math.sin(nx * TAU * 5.2 * ws + tw * 2.1 + ph * 4)
      dy += 0.125 * Math.cos(ny * TAU * 4.7 * ws - tw * 1.9 + ph * 3.5)
      weight += 0.125
    }

    outX[i] = baseX[i] + (dx / weight) * amplitude
    outY[i] = baseY[i] + (dy / weight) * amplitude
  }
}

/**
 * Precomputed per-target creature parameters. `u`/`v` are the primary
 * parametric coordinates; `aux` is variant-specific (tendril index for jelly,
 * wing side for ray, body/tail/head part for the fish, form index for
 * custom); `phase` decorrelates fine detail.
 */
export type CreatureTopology = {
  count: number
  variant: ParametricVariant
  u: Float32Array
  v: Float32Array
  aux: Float32Array
  phase: Float32Array
  /** Custom-lab build inputs, kept so the caller can detect structural knob
   *  changes (form/symmetry) that require a topology rebuild. */
  customForm?: CustomCreatureForm
  customSymmetry?: number
}

/** One creature = topology builder + frame compute + label. Additive edits only. */
export type CreatureDefinition = {
  variant: ParametricVariant
  label: string
  buildTopology: (count: number, custom?: CustomCreatureParams) => CreatureTopology
  compute: (
    topology: CreatureTopology,
    params: MotionWaveParams,
    outX: Float32Array,
    outY: Float32Array,
  ) => void
}

// ---------------------------------------------------------------------------
// Shared topology/compute helpers
// ---------------------------------------------------------------------------

function makeTopologyArrays(count: number) {
  return {
    u: new Float32Array(count),
    v: new Float32Array(count),
    aux: new Float32Array(count),
    phase: new Float32Array(count),
  }
}

const FISH_BODY_FRACTION = 0.75
const FISH_TAIL_FRACTION = 0.2
const FISH_TAIL_START = 0.82

/**
 * Assign fish coordinates: spine parameter s ∈ [0, 1] in `u`, a lateral slot
 * in [-1, 1] in `v`, and the body part in `aux` (0 body, 1 tail fin, 2 head).
 * Points are spread across `schoolSize` fish (1 for the original variant);
 * the fish index is returned via `schoolIndex` when provided.
 */
function assignFishCoordinates(
  start: number,
  end: number,
  schoolIndex: number,
  u: Float32Array,
  v: Float32Array,
  aux: Float32Array,
): void {
  const count = Math.max(0, end - start)
  const bodyCount = Math.max(1, Math.round(count * FISH_BODY_FRACTION))
  const tailCount = Math.max(1, Math.round(count * FISH_TAIL_FRACTION))
  for (let i = start; i < end; i += 1) {
    const local = i - start
    if (local < bodyCount) {
      u[i] = bodyCount > 1 ? local / (bodyCount - 1) : 0.5
      v[i] = hash01(local, 3 + schoolIndex) * 2 - 1
      aux[i] = 0
    } else if (local < bodyCount + tailCount) {
      const t = tailCount > 1 ? (local - bodyCount) / (tailCount - 1) : 0
      u[i] = FISH_TAIL_START + t * (1 - FISH_TAIL_START)
      v[i] = hash01(local, 7 + schoolIndex) * 2 - 1
      aux[i] = 1
    } else {
      u[i] = hash01(local, 11 + schoolIndex) * 0.1
      v[i] = (hash01(local, 13 + schoolIndex) * 2 - 1) * 0.6
      aux[i] = 2
    }
  }
}

/** Teardrop body-thickness profile: blunt head, peak near 40%, narrow peduncle. */
function fishProfile(s: number): number {
  const clamped = Math.min(1, Math.max(0, s))
  const dome = Math.max(0, Math.sin(Math.PI * Math.min(1, clamped * 1.2))) ** 0.9
  return (0.25 + 0.75 * dome) * (1 - clamped ** 3 * 0.8)
}

/**
 * One undulating fish at (cx, cy) with body length `length`. The spine runs a
 * head→tail traveling wave whose amplitude grows tailward; `waves` stacks
 * harmonics, `travel` scales the wave speed, `pulse` breathes the body scale.
 * Amount 0 collapses every wave term to a static fish silhouette.
 */
function computeFishPoints(
  topology: CreatureTopology,
  start: number,
  end: number,
  params: MotionWaveParams,
  cx: number,
  cy: number,
  length: number,
  phaseOffset: number,
  outX: Float32Array,
  outY: Float32Array,
): void {
  const custom = params.custom
  const waves = Math.max(1, Math.round(custom?.waves ?? 1))
  const travel = custom?.travel ?? 1
  const pulse = custom?.pulse ?? 0
  const a = params.amount
  const tw = params.time * params.speed
  const k = TAU * 1.1 * params.waveScale
  const omega = 2.4 * travel
  const ampBase = length * 0.055 * a
  const breathe = 1 + 0.05 * pulse * a * Math.sin(tw * 2 + phaseOffset)
  const bob = length * 0.012 * a * Math.sin(tw * 0.8 + phaseOffset)
  const half = length * 0.5

  const spineYAt = (s: number): number => {
    const envelope = 0.15 + 0.85 * s ** 1.6
    let wave = 0
    let weight = 0
    for (let n = 1; n <= waves; n += 1) {
      wave += Math.sin(k * n * s - tw * omega * n + phaseOffset) / n
      weight += 1 / n
    }
    return cy + ampBase * envelope * (wave / weight) + bob
  }

  for (let i = start; i < end; i += 1) {
    const s = topology.u[i]
    const slot = topology.v[i]
    const spineX = cx - half + s * length
    const spineY = spineYAt(s)
    // Perpendicular from a numeric spine derivative.
    const ds = 0.02
    const slope = ((spineYAt(Math.min(1, s + ds)) - spineYAt(Math.max(0, s - ds))) /
      ((Math.min(1, s + ds) - Math.max(0, s - ds)) * length || 1))
    const invNorm = 1 / Math.sqrt(1 + slope * slope)
    const perpX = -slope * invNorm
    const perpY = invNorm

    if (topology.aux[i] === 1) {
      // Tail fin: flares perpendicular from the peduncle and sweeps back.
      // finT is clamped: Float32 rounding can push s just below the start.
      const finT = Math.min(1, Math.max(0, (s - FISH_TAIL_START) / (1 - FISH_TAIL_START)))
      const flare = length * 0.13 * finT ** 1.1 * breathe
      outX[i] = spineX + perpX * slot * flare - Math.abs(slot) * length * 0.05
      outY[i] = spineY + perpY * slot * flare * 1.15
    } else {
      const part = topology.aux[i]
      const w = length * 0.11 * fishProfile(s) * breathe * (part === 2 ? 0.9 : 1)
      outX[i] = spineX + perpX * slot * w
      outY[i] = spineY + perpY * slot * w
    }
  }
}

// ---------------------------------------------------------------------------
// original — fish, after yuruyurau's fish-inspired 10,000-point sketch
// ---------------------------------------------------------------------------

function buildOriginalTopology(count: number): CreatureTopology {
  const safeCount = Math.max(0, Math.floor(count))
  const arrays = makeTopologyArrays(safeCount)
  assignFishCoordinates(0, safeCount, 0, arrays.u, arrays.v, arrays.aux)
  for (let i = 0; i < safeCount; i += 1) arrays.phase[i] = indexPhase(i)
  return { count: safeCount, variant: 'original', ...arrays }
}

/**
 * Original variant: a readable, normalized visual adaptation of yuruyurau's
 * fish-inspired 10,000-point Processing sketch
 * (https://x.com/yuruyurau/status/2080977918914969636) — a point-built fish
 * whose spine runs a head-to-tail traveling wave. Rewritten for this engine
 * (typed arrays, normalized coordinates); the minified source is not
 * reproduced.
 */
function computeOriginal(
  topology: CreatureTopology,
  params: MotionWaveParams,
  outX: Float32Array,
  outY: Float32Array,
): void {
  const length = Math.min(params.width, params.height) * 0.62
  computeFishPoints(
    topology,
    0,
    topology.count,
    params,
    params.width * 0.5,
    params.height * 0.5,
    length,
    0,
    outX,
    outY,
  )
}

// ---------------------------------------------------------------------------
// jelly — pulsing bell with coherent trailing tendrils
// ---------------------------------------------------------------------------

const JELLY_BELL_FRACTION = 0.45
const JELLY_TENDRIL_COUNT = 6

function buildJellyTopology(count: number): CreatureTopology {
  const safeCount = Math.max(0, Math.floor(count))
  const arrays = makeTopologyArrays(safeCount)
  const bellCount = Math.max(1, Math.round(safeCount * JELLY_BELL_FRACTION))
  const tendrilCount = safeCount - bellCount
  for (let i = 0; i < safeCount; i += 1) {
    if (i < bellCount) {
      arrays.u[i] = bellCount > 1 ? i / (bellCount - 1) : 0.5
      arrays.v[i] = 0
      arrays.aux[i] = -1
    } else {
      const j = i - bellCount
      const strand = tendrilCount > 0 ? j % JELLY_TENDRIL_COUNT : 0
      const along = tendrilCount > 0 ? Math.floor(j / JELLY_TENDRIL_COUNT) : 0
      const perStrand = tendrilCount > 0 ? Math.ceil(tendrilCount / JELLY_TENDRIL_COUNT) : 1
      arrays.u[i] = (strand + 0.5) / JELLY_TENDRIL_COUNT
      arrays.v[i] = perStrand > 1 ? along / (perStrand - 1) : 0
      arrays.aux[i] = strand
    }
    arrays.phase[i] = indexPhase(i)
  }
  return { count: safeCount, variant: 'jelly', ...arrays }
}

function computeJelly(
  topology: CreatureTopology,
  params: MotionWaveParams,
  outX: Float32Array,
  outY: Float32Array,
): void {
  const { count, u, v, aux } = topology
  const tw = params.time * params.speed
  const ws = params.waveScale
  const a = params.amount

  const cx = params.width * 0.5
  const rimY = params.height * 0.42
  const baseR = Math.min(params.width, params.height) * 0.26
  const pulse = 1 + 0.1 * a * Math.sin(tw * 2)
  const squash = 1 + 0.16 * a * Math.sin(tw * 2 + Math.PI / 2)
  const radius = baseR * pulse
  const tendrilLength = params.height * 0.4
  const sway = Math.min(params.width, params.height) * 0.05 * a

  for (let i = 0; i < count; i += 1) {
    if (aux[i] < 0) {
      // Bell dome: angle sweeps rim → apex → rim.
      const s = u[i] * Math.PI
      outX[i] = cx + Math.cos(s) * radius
      outY[i] = rimY - Math.sin(s) * radius * squash
    } else {
      // Tendril: anchored on the rim, trailing down with a phase-delayed wave
      // so the motion propagates coherently along the strand.
      const anchorS = u[i] * Math.PI
      const anchorX = cx + Math.cos(anchorS) * radius * 0.92
      const t = v[i]
      const strandPhase = aux[i] * 1.7
      const wave = Math.sin(tw * 1.6 - t * 3 * ws + strandPhase)
      outX[i] = anchorX + wave * sway * (0.25 + 0.75 * t)
      outY[i] = rimY + t * tendrilLength
    }
  }
}

// ---------------------------------------------------------------------------
// ray — mirrored wing-like sheet with traveling waves
// ---------------------------------------------------------------------------

function buildRayTopology(count: number): CreatureTopology {
  const safeCount = Math.max(0, Math.floor(count))
  const arrays = makeTopologyArrays(safeCount)
  const half = Math.ceil(safeCount / 2)
  const gridN = Math.max(1, Math.ceil(Math.sqrt(half)))
  for (let i = 0; i < safeCount; i += 1) {
    const side = i < half ? -1 : 1
    const local = i < half ? i : i - half
    const localCount = i < half ? half : safeCount - half
    arrays.u[i] = localCount > 1 ? (local % gridN) / (gridN - 1 || 1) : 0
    arrays.v[i] = localCount > 1 ? Math.floor(local / gridN) / (gridN - 1 || 1) : 0
    arrays.aux[i] = side
    arrays.phase[i] = indexPhase(i)
  }
  return { count: safeCount, variant: 'ray', ...arrays }
}

function computeRay(
  topology: CreatureTopology,
  params: MotionWaveParams,
  outX: Float32Array,
  outY: Float32Array,
): void {
  const { count, u, v, aux, phase } = topology
  const tw = params.time * params.speed
  const ws = params.waveScale
  const a = params.amount

  const cx = params.width * 0.5
  const cy = params.height * 0.5
  const spanX = params.width * 0.38
  const chordBase = params.height * 0.16
  const waveAmp = Math.min(params.width, params.height) * 0.07 * a
  const flapAmp = params.height * 0.05 * a

  for (let i = 0; i < count; i += 1) {
    const side = aux[i]
    const span = u[i]
    const chord = v[i] - 0.5
    // Traveling wave: phase advances with span so the ripple runs wingtip-ward.
    const traveling = Math.sin(span * TAU * 1.5 * ws - tw * 2)
    const flap = Math.sin(tw * 0.8 + phase[i] * 0.15) * span * flapAmp
    outX[i] = cx + side * span * spanX
    outY[i] =
      cy +
      chord * chordBase * (1 - span * 0.4) +
      traveling * waveAmp * (0.3 + 0.7 * span) +
      flap
  }
}

// ---------------------------------------------------------------------------
// custom — the bounded visitor lab
// ---------------------------------------------------------------------------

function buildCustomTopology(
  count: number,
  custom?: CustomCreatureParams,
): CreatureTopology {
  const safeCount = Math.max(0, Math.floor(count))
  const arrays = makeTopologyArrays(safeCount)
  const form = custom?.form ?? 'school'
  const symmetry = Math.max(1, Math.round(custom?.symmetry ?? 1))

  if (form === 'school') {
    // `symmetry` fish stacked vertically; each gets an even share of points.
    const per = Math.max(1, Math.floor(safeCount / symmetry))
    for (let f = 0; f < symmetry; f += 1) {
      const start = f * per
      const end = f === symmetry - 1 ? safeCount : start + per
      assignFishCoordinates(start, end, f, arrays.u, arrays.v, arrays.aux)
    }
  } else if (form === 'bell') {
    // Jelly layout with `symmetry` tendrils.
    const bellCount = Math.max(1, Math.round(safeCount * JELLY_BELL_FRACTION))
    const tendrilCount = safeCount - bellCount
    for (let i = 0; i < safeCount; i += 1) {
      if (i < bellCount) {
        arrays.u[i] = bellCount > 1 ? i / (bellCount - 1) : 0.5
        arrays.aux[i] = -1
      } else {
        const j = i - bellCount
        const strand = tendrilCount > 0 ? j % symmetry : 0
        const along = tendrilCount > 0 ? Math.floor(j / symmetry) : 0
        const perStrand = tendrilCount > 0 ? Math.ceil(tendrilCount / symmetry) : 1
        arrays.u[i] = (strand + 0.5) / symmetry
        arrays.v[i] = perStrand > 1 ? along / (perStrand - 1) : 0
        arrays.aux[i] = strand
      }
    }
  } else if (form === 'wing') {
    // `symmetry` mirrored wing pairs; aux encodes side * (pairIndex + 1).
    const pairs = symmetry
    const per = Math.max(1, Math.floor(safeCount / (pairs * 2)))
    for (let i = 0; i < safeCount; i += 1) {
      const block = Math.min(pairs * 2 - 1, Math.floor(i / per))
      const pairIndex = Math.floor(block / 2)
      const side = block % 2 === 0 ? -1 : 1
      const local = i - block * per
      const blockCount = block === pairs * 2 - 1 ? safeCount - block * per : per
      const gridN = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, blockCount))))
      arrays.u[i] = blockCount > 1 ? (local % gridN) / (gridN - 1 || 1) : 0
      arrays.v[i] = blockCount > 1 ? Math.floor(local / gridN) / (gridN - 1 || 1) : 0
      arrays.aux[i] = side * (pairIndex + 1)
    }
  } else {
    // grid: normalized sheet coordinates.
    const gridN = Math.max(1, Math.ceil(Math.sqrt(safeCount)))
    for (let i = 0; i < safeCount; i += 1) {
      arrays.u[i] = gridN > 1 ? (i % gridN) / (gridN - 1) : 0.5
      arrays.v[i] = gridN > 1 ? Math.floor(i / gridN) / (gridN - 1) : 0.5
      arrays.aux[i] = 0
    }
  }

  for (let i = 0; i < safeCount; i += 1) arrays.phase[i] = indexPhase(i)
  return {
    count: safeCount,
    variant: 'custom',
    ...arrays,
    customForm: form,
    customSymmetry: symmetry,
  }
}

function computeCustom(
  topology: CreatureTopology,
  params: MotionWaveParams,
  outX: Float32Array,
  outY: Float32Array,
): void {
  const custom = params.custom
  const form = topology.customForm ?? custom?.form ?? 'school'
  const symmetry = Math.max(1, Math.round(topology.customSymmetry ?? custom?.symmetry ?? 1))
  const travel = custom?.travel ?? 1
  const pulse = custom?.pulse ?? 1

  if (form === 'school') {
    const { count } = topology
    const per = Math.max(1, Math.floor(count / symmetry))
    const length = Math.min(params.width, params.height) * (symmetry > 1 ? 0.42 : 0.62)
    const spacing = params.height / (symmetry + 1)
    for (let f = 0; f < symmetry; f += 1) {
      const start = f * per
      const end = f === symmetry - 1 ? count : start + per
      computeFishPoints(
        topology,
        start,
        end,
        params,
        params.width * 0.5,
        spacing * (f + 1),
        length,
        f * 1.3,
        outX,
        outY,
      )
    }
    return
  }

  if (form === 'bell') {
    computeJelly(
      // The jelly compute reads tendril anchors from u/v/aux, which the custom
      // bell topology already encodes with `symmetry` strands.
      topology,
      params,
      outX,
      outY,
    )
    return
  }

  if (form === 'wing') {
    const { count, u, v, aux, phase } = topology
    const tw = params.time * params.speed
    const ws = params.waveScale
    const a = params.amount
    const cx = params.width * 0.5
    const spanX = params.width * 0.34
    const chordBase = (params.height * 0.14) / Math.max(1, symmetry * 0.6)
    const waveAmp = Math.min(params.width, params.height) * 0.06 * a
    const flapAmp = (params.height * 0.04) * pulse * a
    const rowGap = params.height / (symmetry + 1)
    for (let i = 0; i < count; i += 1) {
      const side = aux[i] < 0 ? -1 : 1
      const pairIndex = Math.abs(aux[i]) - 1
      const cy = rowGap * (pairIndex + 1)
      const span = u[i]
      const chord = v[i] - 0.5
      let traveling = 0
      let weight = 0
      const waves = Math.max(1, Math.round(params.custom?.waves ?? 1))
      for (let n = 1; n <= waves; n += 1) {
        traveling += Math.sin(span * TAU * 1.5 * ws * n - tw * 2 * travel * n) / n
        weight += 1 / n
      }
      const flap = Math.sin(tw * 0.8 * travel + phase[i] * 0.15) * span * flapAmp
      outX[i] = cx + side * span * spanX
      outY[i] =
        cy + chord * chordBase * (1 - span * 0.4) + (traveling / weight) * waveAmp * (0.3 + 0.7 * span) + flap
    }
    return
  }

  // grid: a layered warped sheet (the pre-fish "original" field, kept as a
  // lab form). `waves` stacks terms, `travel` scales phase speed, `pulse`
  // breathes the warp amplitude.
  {
    const { count, u, v, phase } = topology
    const tw = params.time * params.speed * Math.max(0.05, travel)
    const ws = params.waveScale
    const a = params.amount
    const waves = Math.max(1, Math.round(params.custom?.waves ?? 3))
    const breathe = 1 + 0.12 * pulse * a * Math.sin(tw * 1.4)
    const spanX = params.width * 0.64
    const spanY = params.height * 0.64
    const cx = params.width * 0.5
    const cy = params.height * 0.5
    const warp = Math.min(params.width, params.height) * 0.16 * a * breathe
    for (let i = 0; i < count; i += 1) {
      const gu = u[i]
      const gv = v[i]
      const ph = phase[i]
      let dx = 0
      let dy = 0
      let weight = 0
      for (let n = 1; n <= waves; n += 1) {
        const wn = 1 / n
        dx += wn * Math.sin(gv * TAU * n * ws + tw * n + ph * 0.3 * (n - 1))
        dy += wn * Math.cos(gu * TAU * n * ws + tw * 0.9 * n + ph * 0.3 * (n - 1))
        weight += wn
      }
      outX[i] = cx + (gu - 0.5) * spanX + (dx / weight) * warp
      outY[i] = cy + (gv - 0.5) * spanY + (dy / weight) * warp
    }
  }
}

// ---------------------------------------------------------------------------
// Registry + thin dispatchers (stable API for SceneCanvas and verify scripts)
// ---------------------------------------------------------------------------

export const CREATURE_DEFINITIONS: Record<ParametricVariant, CreatureDefinition> = {
  original: { variant: 'original', label: 'Original', buildTopology: buildOriginalTopology, compute: computeOriginal },
  jelly: { variant: 'jelly', label: 'Jelly', buildTopology: buildJellyTopology, compute: computeJelly },
  ray: { variant: 'ray', label: 'Ray', buildTopology: buildRayTopology, compute: computeRay },
  custom: { variant: 'custom', label: 'Custom', buildTopology: buildCustomTopology, compute: computeCustom },
}

/** Build the parametric topology for a creature of `count` targets. */
export function buildCreatureTopology(
  count: number,
  variant: ParametricVariant,
  custom?: CustomCreatureParams,
): CreatureTopology {
  return CREATURE_DEFINITIONS[variant].buildTopology(count, custom)
}

/**
 * Compute creature target positions for the current frame into `outX`/`outY`.
 * `topology.count` may differ from the base field's count — the creature
 * replaces positions, the caller retains the glyph population and remap.
 */
export function computeCreatureTargets(
  topology: CreatureTopology,
  params: MotionWaveParams,
  outX: Float32Array,
  outY: Float32Array,
): void {
  CREATURE_DEFINITIONS[topology.variant].compute(topology, params, outX, outY)
}
