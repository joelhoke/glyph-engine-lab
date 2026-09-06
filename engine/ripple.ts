/**
 * Water-droplet ripples for click/tap: each pointerdown spawns an expanding
 * ring whose wavefront travels outward at a fixed speed, kicking particles as
 * it passes them. A damped cosine along the radial axis gives an outward
 * crest followed by an inward trough — the droplet signature — inside a
 * Gaussian band centered on the front, so the effect is band-limited: glyphs
 * well ahead of or behind the ring are untouched.
 *
 * The wavefront is directional rather than a uniform circle. Each ripple
 * carries the pointer's smoothed velocity at spawn (px/s) and derives an
 * eccentricity from its speed, so a mid-drag press leaves a wake: the front
 * radius is angle-dependent, R(θ, t) = speed · age · (1 − ecc · cos(θ − φ)),
 * compressed ahead of the motion direction φ and stretched behind it. Ring
 * width and wavelength scale by the same angular factor so trailing rings
 * stay proportional to the stretched front. Idle clicks get a small baseline
 * eccentricity with φ from a deterministic hash of (x, y, born), so plain
 * clicks read slightly organic instead of perfectly circular.
 *
 * The store is a fixed-capacity set of preallocated parallel arrays —
 * allocation-free per frame and per spawn; expired ripples are pruned in
 * place and the oldest ripple is evicted when a spawn arrives at capacity.
 * Pure and DOM-free (no RNG, wall-clock time arrives as an argument), so the
 * exact same physics run under scripts/verify-ripple.js in Node. The ambient
 * typed-array mirror lives in engine/ambientField.ts (applyAmbientRipples).
 *
 * Force units match engine/impulse.ts (velocity kick per frame), so `force`
 * tunes against the same feel as clickImpulseForce.
 */

export type RippleParticle = {
  x: number
  y: number
  vx: number
  vy: number
}

export type RippleConfig = {
  /** Wavefront expansion rate, px/s. */
  speed: number
  /** Gaussian ring thickness (σ), px. */
  width: number
  /** Crest-to-crest spacing of the trailing rings, px. */
  wavelength: number
  /** Peak radial kick at the band center, same units as clickImpulseForce. */
  force: number
  /** Amplitude envelope time constant, ms (exp(−age/decay)). */
  decay: number
  /** Base front radius past which a ripple is pruned, px (lifetime cutoff). */
  maxRadius: number
  /** Live ripple ceiling; spawning past it evicts the oldest ripple. */
  maxConcurrent: number
  /** Eccentricity floor for idle clicks (slightly organic, near-circular). */
  eccBase: number
  /** Eccentricity cap for fast drags (wake stretch). */
  eccMax: number
  /** Eccentricity gained per px/s of pointer speed at spawn. */
  eccPerSpeed: number
}

export const RIPPLE_SPEED_MIN = 40
export const RIPPLE_SPEED_MAX = 2000
export const RIPPLE_WIDTH_MIN = 4
export const RIPPLE_WIDTH_MAX = 200
export const RIPPLE_WAVELENGTH_MIN = 20
export const RIPPLE_WAVELENGTH_MAX = 600
export const RIPPLE_FORCE_MIN = 0
export const RIPPLE_FORCE_MAX = 60
export const RIPPLE_DECAY_MIN = 50
export const RIPPLE_DECAY_MAX = 5000
export const RIPPLE_MAX_RADIUS_MIN = 100
export const RIPPLE_MAX_RADIUS_MAX = 4000
export const RIPPLE_MAX_CONCURRENT_MIN = 1
export const RIPPLE_MAX_CONCURRENT_MAX = 32
export const RIPPLE_ECC_BASE_MIN = 0
export const RIPPLE_ECC_BASE_MAX = 0.4
export const RIPPLE_ECC_MAX_MIN = 0
export const RIPPLE_ECC_MAX_MAX = 0.8
export const RIPPLE_ECC_PER_SPEED_MIN = 0
export const RIPPLE_ECC_PER_SPEED_MAX = 0.01

export const RIPPLE_DEFAULTS: RippleConfig = {
  speed: 420,
  width: 46,
  wavelength: 120,
  force: 9,
  decay: 700,
  maxRadius: 640,
  maxConcurrent: 6,
  eccBase: 0.08,
  eccMax: 0.45,
  eccPerSpeed: 0.0005,
}

/**
 * Radial spread term of the amplitude envelope: the ring's energy is shared
 * over a circumference that grows with the front radius, so the kick fades
 * as 1/(1 + R/this) on top of the exponential age decay.
 */
export const RIPPLE_SPREAD_PX = 180

/** Pointer speed (px/s) below which a spawn counts as an idle click: baseline
 *  eccentricity with a hashed direction instead of a motion-derived wake. */
export const RIPPLE_WAKE_MIN_SPEED = 60

/** Gaussian band half-width in σ beyond which a particle is skipped outright
 *  (exp(−3²) ≈ 1% of peak — cheaper to reject than to evaluate). */
const RIPPLE_BAND_SIGMAS = 3

const TWO_PI = Math.PI * 2

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Clamp every numeric field of a ripple config into its documented range. */
export function clampRippleConfig(config: RippleConfig): RippleConfig {
  return {
    speed: clampNumber(config.speed, RIPPLE_SPEED_MIN, RIPPLE_SPEED_MAX),
    width: clampNumber(config.width, RIPPLE_WIDTH_MIN, RIPPLE_WIDTH_MAX),
    wavelength: clampNumber(
      config.wavelength,
      RIPPLE_WAVELENGTH_MIN,
      RIPPLE_WAVELENGTH_MAX,
    ),
    force: clampNumber(config.force, RIPPLE_FORCE_MIN, RIPPLE_FORCE_MAX),
    decay: clampNumber(config.decay, RIPPLE_DECAY_MIN, RIPPLE_DECAY_MAX),
    maxRadius: clampNumber(
      config.maxRadius,
      RIPPLE_MAX_RADIUS_MIN,
      RIPPLE_MAX_RADIUS_MAX,
    ),
    maxConcurrent: Math.round(
      clampNumber(
        config.maxConcurrent,
        RIPPLE_MAX_CONCURRENT_MIN,
        RIPPLE_MAX_CONCURRENT_MAX,
      ),
    ),
    eccBase: clampNumber(config.eccBase, RIPPLE_ECC_BASE_MIN, RIPPLE_ECC_BASE_MAX),
    eccMax: clampNumber(config.eccMax, RIPPLE_ECC_MAX_MIN, RIPPLE_ECC_MAX_MAX),
    eccPerSpeed: clampNumber(
      config.eccPerSpeed,
      RIPPLE_ECC_PER_SPEED_MIN,
      RIPPLE_ECC_PER_SPEED_MAX,
    ),
  }
}

/**
 * Fixed-capacity ripple pool: preallocated parallel arrays plus the live
 * count. Slots [0, count) are active; everything past count is stale scratch.
 */
export type RippleStore = {
  capacity: number
  count: number
  x: Float64Array
  y: Float64Array
  /** Spawn timestamp in ms (same clock the frame loop passes to apply). */
  born: Float64Array
  /** Per-ripple amplitude multiplier (per-mode rippleStrength). */
  strength: Float64Array
  /** Pointer's smoothed velocity at spawn, px/s. */
  vx: Float64Array
  vy: Float64Array
  /** Wake direction: angle of the pointer's motion at spawn. */
  phi: Float64Array
  /** Wavefront eccentricity, 0 = perfect circle. */
  ecc: Float64Array
}

export function createRippleStore(capacity: number): RippleStore {
  const size = Math.max(1, Math.round(Number.isFinite(capacity) ? capacity : 1))
  return {
    capacity: size,
    count: 0,
    x: new Float64Array(size),
    y: new Float64Array(size),
    born: new Float64Array(size),
    strength: new Float64Array(size),
    vx: new Float64Array(size),
    vy: new Float64Array(size),
    phi: new Float64Array(size),
    ecc: new Float64Array(size),
  }
}

/** Deterministic wake direction for idle clicks: a cheap hash of the spawn
 *  point and timestamp folded into [0, 2π). No RNG, same inputs → same φ. */
function hashWakePhi(x: number, y: number, born: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233 + born * 0.037) * 43758.5453
  return (h - Math.floor(h)) * TWO_PI
}

/**
 * Adds a ripple at (x, y), seeded with the pointer's smoothed spawn velocity
 * (px/s). A moving pointer produces a directional wake (eccentricity from
 * pointer speed, φ along the motion); a resting pointer produces a
 * near-circular ring at the baseline eccentricity with a hashed φ. At
 * capacity the oldest ripple is evicted in place.
 */
export function spawnRipple(
  store: RippleStore,
  x: number,
  y: number,
  now: number,
  strength: number,
  vx: number,
  vy: number,
  config: RippleConfig,
): void {
  let slot = store.count
  if (slot < store.capacity) {
    store.count += 1
  } else {
    // Evict the oldest ripple (minimum born).
    slot = 0
    for (let i = 1; i < store.capacity; i += 1) {
      if (store.born[i] < store.born[slot]) slot = i
    }
  }
  const pointerSpeed = Math.hypot(vx, vy)
  let phi: number
  let ecc: number
  if (pointerSpeed >= RIPPLE_WAKE_MIN_SPEED) {
    phi = Math.atan2(vy, vx)
    ecc = Math.max(
      config.eccBase,
      Math.min(config.eccMax, pointerSpeed * config.eccPerSpeed),
    )
  } else {
    phi = hashWakePhi(x, y, now)
    ecc = config.eccBase
  }
  store.x[slot] = x
  store.y[slot] = y
  store.born[slot] = now
  store.strength[slot] = strength
  store.vx[slot] = vx
  store.vy[slot] = vy
  store.phi[slot] = phi
  store.ecc[slot] = ecc
}

/**
 * Drops ripples whose base front radius passed the lifetime cutoff. Compacts
 * the live slots forward in place — order is preserved and nothing is
 * allocated.
 */
export function pruneRipples(
  store: RippleStore,
  now: number,
  config: RippleConfig,
): void {
  let write = 0
  for (let read = 0; read < store.count; read += 1) {
    const ageMs = now - store.born[read]
    const baseRadius = (config.speed * ageMs) / 1000
    if (baseRadius > config.maxRadius) continue
    if (write !== read) {
      store.x[write] = store.x[read]
      store.y[write] = store.y[read]
      store.born[write] = store.born[read]
      store.strength[write] = store.strength[read]
      store.vx[write] = store.vx[read]
      store.vy[write] = store.vy[read]
      store.phi[write] = store.phi[read]
      store.ecc[write] = store.ecc[read]
    }
    write += 1
  }
  store.count = write
}

/**
 * Per-frame force pass: every live ripple kicks the particles inside its
 * traveling band. Per particle the band is rejected on distSq before any
 * sqrt/atan2, and again on the normalized band distance before exp/cos, so
 * idle cost is one branch (empty store) and a ripple's cost tracks its ring
 * area, not the field size. Returns the number of particle kicks applied.
 */
export function applyRippleForces(
  store: RippleStore,
  particles: RippleParticle[],
  now: number,
  config: RippleConfig,
): number {
  if (store.count === 0) return 0
  pruneRipples(store, now, config)
  let affected = 0
  for (let r = 0; r < store.count; r += 1) {
    const strength = store.strength[r]
    if (strength === 0 || config.force === 0) continue
    const ageMs = now - store.born[r]
    if (ageMs <= 0) continue
    const baseRadius = (config.speed * ageMs) / 1000
    const ecc = store.ecc[r]
    const phi = store.phi[r]
    const rx = store.x[r]
    const ry = store.y[r]
    const envelope =
      Math.exp(-ageMs / config.decay) / (1 + baseRadius / RIPPLE_SPREAD_PX)
    // Angle-independent band bounds: the front sits within R0·(1 ± ecc) and
    // the Gaussian is dead beyond ±3σ, so anything outside [inner, reach]
    // skips the sqrt entirely.
    const band = RIPPLE_BAND_SIGMAS * config.width * (1 + ecc)
    const reach = baseRadius * (1 + ecc) + band
    const inner = baseRadius * (1 - ecc) - band
    const reachSq = reach * reach
    const innerSq = inner > 0 ? inner * inner : 0
    const kickScale = envelope * config.force * strength
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i]
      const dx = p.x - rx
      const dy = p.y - ry
      const distSq = dx * dx + dy * dy
      if (distSq <= 0 || distSq > reachSq || distSq < innerSq) continue
      const dist = Math.sqrt(distSq)
      const theta = Math.atan2(dy, dx)
      const angular = 1 - ecc * Math.cos(theta - phi)
      const radius = baseRadius * angular
      const widthTheta = config.width * angular
      const z = (dist - radius) / widthTheta
      if (z > RIPPLE_BAND_SIGMAS || z < -RIPPLE_BAND_SIGMAS) continue
      const weight = Math.exp(-z * z)
      const phase = Math.cos(((dist - radius) * TWO_PI) / (config.wavelength * angular))
      const kick = weight * phase * kickScale
      if (kick === 0) continue
      p.vx += (dx / dist) * kick
      p.vy += (dy / dist) * kick
      affected += 1
    }
  }
  return affected
}
