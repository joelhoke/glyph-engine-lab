#!/usr/bin/env node
/**
 * Deterministic verification for engine/ripple.ts: traveling-wavefront
 * expansion, band-limited reach, lifetime decay/pruning, crest/trough sign
 * alternation, drag-seeded wake asymmetry vs near-circular idle clicks,
 * capacity eviction, config clamping, determinism, and degenerate guards.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-ripple')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'ripple.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  RIPPLE_DEFAULTS,
  createRippleStore,
  spawnRipple,
  applyRippleForces,
  pruneRipples,
  clampRippleConfig,
} = require(path.join(tmpDir, 'ripple.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const makeParticle = (x, y) => ({ x, y, vx: 0, vy: 0 })

// Perfectly circular rings for the geometry tests (no eccentricity).
const CIRCLE = { ...RIPPLE_DEFAULTS, eccBase: 0, eccMax: 0, eccPerSpeed: 0, force: 10 }
const BORN = 1000
// Age (ms) at which the circular front radius is exactly `radius`.
const ageForRadius = (radius, config = CIRCLE) => (radius / config.speed) * 1000

// --- Wavefront expands with age: the kick arrives when the front passes ---
{
  const store = createRippleStore(4)
  spawnRipple(store, 0, 0, BORN, 1, 0, 0, CIRCLE)
  const target = 210
  // age 100ms → front at 42px, band reach 42+3*46=180 < 210: untouched.
  const early = [makeParticle(target, 0)]
  applyRippleForces(store, early, BORN + 100, CIRCLE)
  assert(early[0].vx === 0 && early[0].vy === 0, 'particle ahead of the young front is untouched')
  // age 500ms → front at 210px: band center lands exactly on the particle.
  const onFront = [makeParticle(target, 0)]
  applyRippleForces(store, onFront, BORN + ageForRadius(target), CIRCLE)
  assert(onFront[0].vx > 0 && onFront[0].vy === 0, 'particle on the arriving front is kicked radially outward')
  // Well past the pass: the band has moved on, the particle rests again.
  const late = [makeParticle(target, 0)]
  applyRippleForces(store, late, BORN + ageForRadius(target + 400), CIRCLE)
  assert(late[0].vx === 0, 'particle is untouched once the band has traveled past')
}

// --- Band-limited: distant particles are never affected ---
{
  const store = createRippleStore(4)
  spawnRipple(store, 0, 0, BORN, 1, 0, 0, CIRCLE)
  const far = [makeParticle(2000, 0)]
  let kicked = false
  for (let age = 0; age <= 2000; age += 100) {
    applyRippleForces(store, far, BORN + age, CIRCLE)
    if (far[0].vx !== 0 || far[0].vy !== 0) kicked = true
  }
  assert(!kicked, 'particle far outside the ring path is never kicked (band-limited)')
}

// --- Amplitude envelope decays as the front travels ---
{
  const kickAtRadius = (radius) => {
    const store = createRippleStore(4)
    spawnRipple(store, 0, 0, BORN, 1, 0, 0, CIRCLE)
    const particles = [makeParticle(radius, 0)]
    applyRippleForces(store, particles, BORN + ageForRadius(radius), CIRCLE)
    return particles[0].vx
  }
  const near = kickAtRadius(210)
  const far = kickAtRadius(420)
  assert(near > 0 && far > 0, 'front-band kick stays positive at both sampled ages')
  assert(far < near * 0.6, `amplitude decays with age and spread (${near.toFixed(3)} → ${far.toFixed(3)})`)
}

// --- Alternating crest/trough: opposite signs half a wavelength apart ---
{
  const store = createRippleStore(4)
  spawnRipple(store, 0, 0, BORN, 1, 0, 0, CIRCLE)
  const R = 300
  const now = BORN + ageForRadius(R)
  const crest = [makeParticle(R, 0)] // on the front: cos(0) = +1
  const trough = [makeParticle(R + CIRCLE.wavelength / 2, 0)] // cos(π) = −1
  applyRippleForces(store, crest, now, CIRCLE)
  applyRippleForces(store, trough, now, CIRCLE)
  assert(crest[0].vx > 0, 'crest kicks outward (away from the impact point)')
  assert(trough[0].vx < 0, 'trough pulls inward (toward the impact point)')
}

// --- Lifetime cutoff: ripples prune to zero past maxRadius ---
{
  const store = createRippleStore(4)
  spawnRipple(store, 0, 0, BORN, 1, 0, 0, CIRCLE)
  const pastLifetime = BORN + ageForRadius(CIRCLE.maxRadius) + 50
  const particles = [makeParticle(100, 0)]
  const affected = applyRippleForces(store, particles, pastLifetime, CIRCLE)
  assert(store.count === 0, 'expired ripple is pruned once the front passes maxRadius')
  assert(affected === 0 && particles[0].vx === 0, 'a pruned ripple applies no force')
  // pruneRipples is idempotent and keeps live ripples.
  spawnRipple(store, 5, 5, BORN, 1, 0, 0, CIRCLE)
  pruneRipples(store, BORN + 10, CIRCLE)
  assert(store.count === 1, 'live ripple survives pruning')
}

// --- Wake asymmetry: drag-seeded ripples stretch behind the motion ---
{
  const store = createRippleStore(4)
  spawnRipple(store, 0, 0, BORN, 1, 2000, 0, RIPPLE_DEFAULTS) // fast +x drag
  assert(store.ecc[0] === RIPPLE_DEFAULTS.eccMax, 'fast drag saturates eccentricity at eccMax')
  assert(store.phi[0] === 0, 'wake direction follows the pointer motion (+x)')
  const R0 = 300
  const now = BORN + ageForRadius(R0, RIPPLE_DEFAULTS)
  // The stretched front reaches R0·(1+ecc) = 435 behind the motion…
  const behind = [makeParticle(-R0 * (1 + RIPPLE_DEFAULTS.eccMax), 0)]
  // …while ahead of it the front is only at R0·(1−ecc) = 165, far from 435.
  const ahead = [makeParticle(R0 * (1 + RIPPLE_DEFAULTS.eccMax), 0)]
  applyRippleForces(store, behind, now, RIPPLE_DEFAULTS)
  applyRippleForces(store, ahead, now, RIPPLE_DEFAULTS)
  assert(behind[0].vx < 0, 'wake front reaches far behind the motion direction (kicked outward, −x)')
  assert(ahead[0].vx === 0 && ahead[0].vy === 0, 'the same distance ahead of the motion is still untouched')
}

// --- Idle clicks: baseline eccentricity, deterministic hashed direction ---
{
  const a = createRippleStore(4)
  const b = createRippleStore(4)
  spawnRipple(a, 120, 240, BORN, 1, 0, 0, RIPPLE_DEFAULTS)
  spawnRipple(b, 120, 240, BORN, 1, 0, 0, RIPPLE_DEFAULTS)
  assert(a.ecc[0] === RIPPLE_DEFAULTS.eccBase, 'idle click uses the baseline eccentricity')
  assert(a.ecc[0] <= 0.1, 'idle click stays near-circular (ecc ≤ 0.1)')
  assert(a.phi[0] === b.phi[0], 'idle wake direction is a deterministic hash of (x, y, born)')
  const c = createRippleStore(4)
  spawnRipple(c, 121, 240, BORN, 1, 0, 0, RIPPLE_DEFAULTS)
  assert(c.phi[0] !== a.phi[0], 'a different spawn point hashes to a different direction')
  // Slow pointer drift counts as idle (below the wake threshold).
  const d = createRippleStore(4)
  spawnRipple(d, 0, 0, BORN, 1, 10, 0, RIPPLE_DEFAULTS)
  assert(d.ecc[0] === RIPPLE_DEFAULTS.eccBase, 'sub-threshold pointer speed keeps the idle baseline')
}

// --- Capacity: the oldest ripple is evicted in place ---
{
  const store = createRippleStore(3)
  spawnRipple(store, 0, 0, 1000, 1, 0, 0, CIRCLE)
  spawnRipple(store, 10, 0, 2000, 1, 0, 0, CIRCLE)
  spawnRipple(store, 20, 0, 3000, 1, 0, 0, CIRCLE)
  spawnRipple(store, 30, 0, 4000, 1, 0, 0, CIRCLE)
  assert(store.count === 3, 'store never exceeds its capacity')
  const borns = Array.from(store.born.slice(0, store.count)).sort()
  assert(borns.join(',') === '2000,3000,4000', 'the oldest ripple is the one evicted')
}

// --- Degenerate parameters are no-ops; center particle never NaNs ---
{
  const store = createRippleStore(4)
  spawnRipple(store, 0, 0, BORN, 1, 0, 0, CIRCLE)
  const zeroForce = { ...CIRCLE, force: 0 }
  const particles = [makeParticle(200, 0), makeParticle(0, 0)]
  const now = BORN + ageForRadius(200)
  assert(applyRippleForces(store, particles, now, zeroForce) === 0, 'zero force affects nothing')
  const zeroStrength = createRippleStore(4)
  spawnRipple(zeroStrength, 0, 0, BORN, 0, 0, 0, CIRCLE)
  assert(applyRippleForces(zeroStrength, particles, now, CIRCLE) === 0, 'zero strength affects nothing')
  const center = particles[1]
  assert(
    Number.isFinite(center.vx) && Number.isFinite(center.vy) && center.vx === 0 && center.vy === 0,
    'particle exactly at the impact point keeps finite zero velocity (no NaN)',
  )
  const empty = createRippleStore(4)
  assert(applyRippleForces(empty, [makeParticle(10, 0)], BORN + 500, CIRCLE) === 0, 'empty store is a no-op')
  assert(createRippleStore(0).capacity >= 1, 'zero-capacity store clamped to a valid size')
}

// --- Config clamping ---
{
  const clamped = clampRippleConfig({
    ...RIPPLE_DEFAULTS,
    speed: 99999,
    width: -5,
    force: Number.NaN,
    maxConcurrent: 0,
    eccMax: 4,
  })
  assert(clamped.speed === 2000, 'speed clamps to its max')
  assert(clamped.width === 4, 'width clamps to its min')
  assert(clamped.force === 0, 'non-finite force falls back to its min')
  assert(clamped.maxConcurrent === 1, 'maxConcurrent clamps to at least 1')
  assert(clamped.eccMax === 0.8, 'eccMax clamps to its max')
  assert(
    JSON.stringify(clampRippleConfig(RIPPLE_DEFAULTS)) === JSON.stringify(RIPPLE_DEFAULTS),
    'defaults pass through the clamp unchanged',
  )
}

// --- Determinism: identical inputs produce identical particle states ---
{
  const run = () => {
    const store = createRippleStore(6)
    spawnRipple(store, 100, 50, 1000, 1, 800, -300, RIPPLE_DEFAULTS)
    spawnRipple(store, -40, 90, 1300, 0.7, 0, 0, RIPPLE_DEFAULTS)
    const particles = [
      makeParticle(10, 5),
      makeParticle(-140, 130),
      makeParticle(0, 0),
      makeParticle(500, 220),
      makeParticle(260, -90),
    ]
    for (let frame = 0; frame < 30; frame += 1) {
      applyRippleForces(store, particles, 1000 + frame * 16.667, RIPPLE_DEFAULTS)
    }
    return { store, particles }
  }
  const a = run()
  const b = run()
  assert(a.store.count === b.store.count, 'live ripple count is deterministic')
  assert(
    JSON.stringify(a.particles) === JSON.stringify(b.particles),
    'same spawn sequence produces identical particle states',
  )
}

// --- Kicks accumulate on top of existing velocity ---
{
  const store = createRippleStore(4)
  spawnRipple(store, 0, 0, BORN, 1, 0, 0, CIRCLE)
  const now = BORN + ageForRadius(200)
  const particles = [makeParticle(200, 0)]
  applyRippleForces(store, particles, now, CIRCLE)
  const first = particles[0].vx
  applyRippleForces(store, particles, now, CIRCLE)
  assert(first > 0 && particles[0].vx === 2 * first, 'repeated applications accumulate on vx')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll ripple verifications passed.')
