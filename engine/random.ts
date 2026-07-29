/**
 * Deterministic pseudo-random number generation for scene initialization.
 *
 * Glyph and target initialization must be reproducible: the same seed,
 * viewport, source, and config should always produce the same initial
 * layout. `Math.random()` cannot provide that, so initialization paths
 * draw from a seeded generator instead. Ambient churn (weather, matrix
 * flicker) intentionally stays on `Math.random()`.
 */

/** A function that returns the next pseudo-random value in [0, 1). */
export type RandomSource = () => number

/**
 * Creates a seeded mulberry32 generator. Small, fast, and stable across
 * engines; two generators created with the same seed produce identical
 * sequences. The seed is coerced to an unsigned 32-bit integer.
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
