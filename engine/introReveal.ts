/**
 * Field reveal: the directed render-in for the glyph field — a whole-field
 * rise plus a per-glyph staggered fade — replacing the original
 * snap-to-centroid spring-out reveal (whose distance-dependent arrival times
 * read as random).
 *
 * One model, two poses: the landing intro snaps particles to the risen pose
 * and streams progress from the intro sequence; mode entries (work / vibe /
 * collaborate) keep the live field and simply multiply the fade + rise over
 * the springs' morph. Each mode has its own stagger order
 * (FIELD_REVEAL_DEFAULTS).
 *
 * Stagger delays are keyed by TARGET index (the draw loop knows each glyph's
 * target index) and derived from the sampled field's normalized coordinates,
 * so every order is deterministic per viewport. `shuffle` uses the same
 * integer-hash idiom as engine/motion.ts.
 *
 * Pure and DOM-free — verified by scripts/verify-intro-reveal.js.
 */

export type RevealStaggerOrder = 'uniform' | 'left-right' | 'center-out' | 'edges-in' | 'shuffle'

export type FieldRevealConfig = {
  /** Vertical offset (px) the field rises from at progress 0. */
  riseOffsetPx: number
  staggerOrder: RevealStaggerOrder
  /** Fraction of the reveal spent staggering; (1 - staggerPortion) is each
   *  glyph's fade window, so the last glyph completes exactly at progress 1. */
  staggerPortion: number
  /** Mode-entry reveal length (ms). The landing reveal is timed by the intro
   *  sequence's logo-scale phase instead. */
  durationMs: number
}

export type FieldRevealMode = 'landing' | 'work' | 'vibe' | 'collaborate'

export const REVEAL_STAGGER_ORDERS: RevealStaggerOrder[] = [
  'uniform',
  'left-right',
  'center-out',
  'edges-in',
  'shuffle',
]

export function isRevealStaggerOrder(value: unknown): value is RevealStaggerOrder {
  return typeof value === 'string' && REVEAL_STAGGER_ORDERS.includes(value as RevealStaggerOrder)
}

/** Shipped default: the vibe reveal everywhere — a shuffle-staggered fade
 *  over the whole-field rise. Kept per-mode so the tuning panel can still
 *  differentiate modes while dialing in. */
export const FIELD_REVEAL_DEFAULTS: Record<FieldRevealMode, FieldRevealConfig> = {
  landing: { riseOffsetPx: 48, staggerOrder: 'shuffle', staggerPortion: 0.55, durationMs: 900 },
  work: { riseOffsetPx: 48, staggerOrder: 'shuffle', staggerPortion: 0.55, durationMs: 900 },
  vibe: { riseOffsetPx: 48, staggerOrder: 'shuffle', staggerPortion: 0.55, durationMs: 900 },
  collaborate: { riseOffsetPx: 48, staggerOrder: 'shuffle', staggerPortion: 0.55, durationMs: 900 },
}

/** Same ease-out idiom as the CTA entrance (opacity + small translate). */
export function revealEase(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - clamped, 3)
}

/** Deterministic per-index hash in [0, 1) — same idiom as engine/motion.ts. */
function hash01(index: number, salt: number): number {
  return (Math.imul(index + 1 + salt * 7919, 2246822519) >>> 0) / 4294967296
}

/**
 * Per-target stagger delays in [0, 1], keyed by target index.
 * - uniform: all zero (the whole field fades together)
 * - left-right: normX (the logotype reads in like text)
 * - center-out: normalized distance from the field centroid
 * - edges-in: the inverse of center-out
 * - shuffle: deterministic per-index hash (same every visit per viewport)
 */
export function buildStaggerDelays(
  order: RevealStaggerOrder,
  normX: Float32Array,
  normY: Float32Array,
): Float32Array {
  const count = Math.min(normX.length, normY.length)
  const delays = new Float32Array(count)
  if (count === 0 || order === 'uniform') return delays
  switch (order) {
    case 'left-right':
      for (let i = 0; i < count; i += 1) delays[i] = normX[i]
      break
    case 'center-out':
    case 'edges-in': {
      let cx = 0
      let cy = 0
      for (let i = 0; i < count; i += 1) {
        cx += normX[i]
        cy += normY[i]
      }
      cx /= count
      cy /= count
      let maxDist = 0
      const dists = new Float32Array(count)
      for (let i = 0; i < count; i += 1) {
        const dx = normX[i] - cx
        const dy = normY[i] - cy
        dists[i] = Math.sqrt(dx * dx + dy * dy)
        if (dists[i] > maxDist) maxDist = dists[i]
      }
      for (let i = 0; i < count; i += 1) {
        const normalized = maxDist > 0 ? dists[i] / maxDist : 0
        delays[i] = order === 'center-out' ? normalized : 1 - normalized
      }
      break
    }
    case 'shuffle':
      for (let i = 0; i < count; i += 1) delays[i] = hash01(i, 41)
      break
  }
  return delays
}

/**
 * One glyph's eased fade factor in [0, 1] for the given reveal progress and
 * the glyph's stagger delay. Each glyph's fade window is
 * (1 - staggerPortion) wide, so delay-0 glyphs start first and delay-1 glyphs
 * finish exactly at progress = 1.
 */
export function revealGlyphFade(progress: number, delay: number, staggerPortion: number): number {
  const spread = Math.min(0.9, Math.max(0, staggerPortion))
  const window = 1 - spread
  if (window <= 0) return 1
  return revealEase((progress - delay * spread) / window)
}
