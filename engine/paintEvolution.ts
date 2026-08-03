/**
 * Background paint evolution: after a COMPLETED background-channel paint
 * stroke is released, its bloom seeps from its release form to its settled
 * form and then bakes into the background-paint layer:
 *
 *   State 1 (release, 0 ms)   — compact, dense, grainy: brush radius ×1.0,
 *                               full alpha, strong per-point grain.
 *   State 2 (7000 ms, settle) — broad, rounded, diffuse stain: radius ×1.6,
 *                               alpha 0.5, no grain. The stroke bakes into
 *                               the settled layer in exactly this form and
 *                               the record is dropped — zero per-frame cost
 *                               after.
 *
 * Two states only: no intermediate elongation phase — the stretch-and-
 * retract motion read as a glitch, so the bloom now simply seeps outward
 * and settles.
 *
 * Invariants:
 * - The stroke centroid stays fixed: points never move (grain modulates
 *   per-point radius/alpha only) and there is no anisotropic transform.
 * - Interpolation between the keyframes is smootherstep (6t⁵ − 15t⁴ + 10t³) —
 *   symmetric ease-in-out, zero first/second derivative at both ends. The
 *   grain decays slightly AHEAD of the other params (curve evaluated at
 *   min(1, t × 1.25)), so the texture dissolves before the shape stops
 *   growing — a dye-seep feel rather than a linear morph.
 * - Seeds are a deterministic hash of the stroke's own points/radius/color,
 *   so replaying the same normalized stroke (resize, restore) reproduces
 *   the same evolution and the same settled art. State 3 is seed-independent
 *   (grain = 0), so bakes are reproducible regardless of timing.
 * - At most EVOLUTION_MAX_ACTIVE strokes evolve concurrently; pushing a 9th
 *   force-bakes the oldest (the caller renders its State-3 form into the
 *   settled layer). Records are appended in time order and settle oldest
 *   first, so a fixed-size ring with head/count covers both eviction paths
 *   without per-frame allocation.
 *
 * Undo removes an evolving stroke together with the ring; redo, snapshot
 * restores, resizes, and erases replay history directly in settled State-3
 * form (restores skip evolution — the settled layer is rebuilt from
 * history). Both behaviors live in components/SceneCanvas; this module is
 * the pure math and the ring, verified by scripts/verify-paint-evolution.js.
 *
 * Pure and DOM-free.
 */

import { PaintStroke } from './paint'

/** Keyframe times (ms after stroke release). */
export const EVOLUTION_SETTLE_MS = 7000
/** Concurrent evolving-stroke cap; the 9th push force-bakes the oldest. */
export const EVOLUTION_MAX_ACTIVE = 8

/** Interpolated bloom appearance at one age. */
export type EvolutionParams = {
  /** Multiplier on the stroke's brush radius. */
  radiusScale: number
  /** Global alpha multiplier (0..1) applied over the brush sprite. */
  alpha: number
  /** Grain amplitude 0..1: per-point deterministic radius/alpha jitter. */
  grain: number
}

// The two keyframes. State 1 matches the live soft-brush preview (radius
// ×1, full alpha) plus grain; State 2 is the settled/baked form.
const KEYFRAME_1: EvolutionParams = { radiusScale: 1, alpha: 1, grain: 1 }
const KEYFRAME_2: EvolutionParams = { radiusScale: 1.6, alpha: 0.5, grain: 0 }

/** Grain depth: per-point radius/alpha variation at full grain amplitude. */
const GRAIN_RADIUS_DEPTH = 0.3
const GRAIN_ALPHA_DEPTH = 0.25

/** Grain leads the other params by this factor, so texture dissolves first. */
const GRAIN_DECAY_LEAD = 1.25

export function createEvolutionParams(): EvolutionParams {
  return { ...KEYFRAME_1 }
}

/** Smootherstep easing: symmetric ease-in-out, zero 1st/2nd derivative at the ends. */
export function smootherstep01(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * c * (c * (c * 6 - 15) + 10)
}

/**
 * Write the bloom params at `ageMs` after release. Pure function of age:
 * exact keyframes at 0 and EVOLUTION_SETTLE_MS, smootherstep (ease-in-out)
 * interpolation between them, grain decaying slightly ahead of the shape,
 * and constant State 2 at/after settle (baking is idempotent — params never
 * change once settled).
 */
export function evolutionParamsAt(ageMs: number, out: EvolutionParams): void {
  if (ageMs <= 0) {
    out.radiusScale = KEYFRAME_1.radiusScale
    out.alpha = KEYFRAME_1.alpha
    out.grain = KEYFRAME_1.grain
    return
  }
  const t = Math.min(1, ageMs / EVOLUTION_SETTLE_MS)
  const e = smootherstep01(t)
  const eGrain = smootherstep01(Math.min(1, t * GRAIN_DECAY_LEAD))
  out.radiusScale = KEYFRAME_1.radiusScale + (KEYFRAME_2.radiusScale - KEYFRAME_1.radiusScale) * e
  out.alpha = KEYFRAME_1.alpha + (KEYFRAME_2.alpha - KEYFRAME_1.alpha) * e
  out.grain = KEYFRAME_1.grain + (KEYFRAME_2.grain - KEYFRAME_1.grain) * eGrain
}

/** True once the stroke must bake into the settled layer. */
export function isEvolutionSettled(ageMs: number): boolean {
  return ageMs >= EVOLUTION_SETTLE_MS
}

/**
 * Deterministic per-stroke seed: FNV-1a over the stroke's own data (points,
 * radius, channel colors, tool). Same stroke → same seed → same grain and
 * the same settled art across resize/replay.
 */
export function hashStrokeSeed(stroke: PaintStroke): number {
  let h = 0x811c9dc5
  const mix = (n: number) => {
    h ^= n | 0
    h = Math.imul(h, 0x01000193)
  }
  const points = stroke.points
  for (let i = 0; i < points.length; i += 1) {
    mix(Math.round(points[i] * 1e6))
  }
  mix(Math.round(stroke.radiusNorm * 1e6))
  mix(stroke.backgroundColor ?? 0)
  mix(stroke.glyphColor ?? 0)
  mix(stroke.tool === 'erase' ? 1 : 0)
  return h >>> 0
}

/** Well-mixed deterministic hash → [0, 1) for one (seed, index, channel). */
function hash01(seed: number, index: number, channel: number): number {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca6b)) | 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/**
 * Per-point grain: deterministic radius multiplier centered on 1. Positions
 * never move, so the stroke centroid is exactly preserved in every state.
 */
export function grainRadiusFactor(seed: number, pointIndex: number, grain: number): number {
  if (grain <= 0) return 1
  return 1 + grain * GRAIN_RADIUS_DEPTH * (hash01(seed, pointIndex, 0) * 2 - 1)
}

/** Per-point grain: deterministic alpha multiplier centered on 1. */
export function grainAlphaFactor(seed: number, pointIndex: number, grain: number): number {
  if (grain <= 0) return 1
  return 1 + grain * GRAIN_ALPHA_DEPTH * (hash01(seed, pointIndex, 1) * 2 - 1)
}

/**
 * Per-point blotch: deterministic selection of the darker dye-sprite variant
 * (value channel), producing low-frequency blotching instead of uniform
 * speckle. Probability scales with grain, so settled art (grain 0) never
 * blotch-selects and bakes stay timing-independent.
 */
export function grainDarkVariant(seed: number, pointIndex: number, grain: number): boolean {
  if (grain <= 0) return false
  return hash01(seed, pointIndex, 2) < grain * 0.5
}

/**
 * One in-flight stroke: the committed stroke plus its precomputed seed. The
 * bloom renders from the stroke's own points — with no anisotropic phase,
 * there is nothing else to precompute.
 */
export type EvolvingStrokeRecord = {
  stroke: PaintStroke
  seed: number
  /** performance.now()/RAF-timestamp timebase, ms at stroke release. */
  startMs: number
}

export function createEvolvingRecord(stroke: PaintStroke, startMs: number): EvolvingStrokeRecord {
  return {
    stroke,
    seed: hashStrokeSeed(stroke),
    startMs,
  }
}

/**
 * Fixed-size ring of evolving records (max EVOLUTION_MAX_ACTIVE), preallocated
 * once — no per-frame or per-stroke array churn. Records are appended in
 * release-time order and consumed oldest-first (settle bakes and force-bakes
 * both evict the oldest), so head/count bookkeeping is enough.
 */
export type EvolutionRing = {
  records: (EvolvingStrokeRecord | null)[]
  head: number
  count: number
}

export function createEvolutionRing(): EvolutionRing {
  const records: (EvolvingStrokeRecord | null)[] = new Array(EVOLUTION_MAX_ACTIVE)
  for (let i = 0; i < EVOLUTION_MAX_ACTIVE; i += 1) records[i] = null
  return { records, head: 0, count: 0 }
}

/**
 * Append a record. When the ring is full, the oldest record is evicted and
 * returned — the caller must force-bake it (render its State-3 form into the
 * settled layer). Returns null when nothing was evicted.
 */
export function pushEvolvingStroke(
  ring: EvolutionRing,
  record: EvolvingStrokeRecord,
): EvolvingStrokeRecord | null {
  let evicted: EvolvingStrokeRecord | null = null
  if (ring.count === EVOLUTION_MAX_ACTIVE) {
    evicted = ring.records[ring.head]
    ring.records[ring.head] = null
    ring.head = (ring.head + 1) % EVOLUTION_MAX_ACTIVE
    ring.count -= 1
  }
  ring.records[(ring.head + ring.count) % EVOLUTION_MAX_ACTIVE] = record
  ring.count += 1
  return evicted
}

/** Oldest record (next bake candidate), or null when empty. */
export function peekOldestEvolving(ring: EvolutionRing): EvolvingStrokeRecord | null {
  return ring.count > 0 ? ring.records[ring.head] : null
}

/** Drop the oldest record (after baking it). Returns it, or null when empty. */
export function dropOldestEvolving(ring: EvolutionRing): EvolvingStrokeRecord | null {
  if (ring.count === 0) return null
  const record = ring.records[ring.head]
  ring.records[ring.head] = null
  ring.head = (ring.head + 1) % EVOLUTION_MAX_ACTIVE
  ring.count -= 1
  return record
}

/** Record at age order `i` (0 = oldest), or null when out of range. */
export function evolvingRecordAt(ring: EvolutionRing, i: number): EvolvingStrokeRecord | null {
  if (i < 0 || i >= ring.count) return null
  return ring.records[(ring.head + i) % EVOLUTION_MAX_ACTIVE]
}

/** True when `stroke` is currently evolving (reference identity, ≤ 8 checks). */
export function isStrokeEvolving(ring: EvolutionRing, stroke: PaintStroke): boolean {
  for (let i = 0; i < ring.count; i += 1) {
    if (ring.records[(ring.head + i) % EVOLUTION_MAX_ACTIVE]?.stroke === stroke) return true
  }
  return false
}

export function clearEvolutionRing(ring: EvolutionRing): void {
  for (let i = 0; i < EVOLUTION_MAX_ACTIVE; i += 1) ring.records[i] = null
  ring.head = 0
  ring.count = 0
}
