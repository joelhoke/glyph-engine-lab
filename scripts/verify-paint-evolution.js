#!/usr/bin/env node
/**
 * Deterministic verification for engine/paintEvolution.ts.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'paintEvolution.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-paint-evolution')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${sourceFile}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  EVOLUTION_STATE2_MS,
  EVOLUTION_SETTLE_MS,
  EVOLUTION_MAX_ACTIVE,
  createEvolutionParams,
  smootherstep01,
  evolutionParamsAt,
  isEvolutionSettled,
  hashStrokeSeed,
  grainRadiusFactor,
  grainAlphaFactor,
  grainDarkVariant,
  createEvolvingRecord,
  createEvolutionRing,
  pushEvolvingStroke,
  peekOldestEvolving,
  dropOldestEvolving,
  evolvingRecordAt,
  isStrokeEvolving,
  clearEvolutionRing,
} = require(path.join(tmpDir, 'paintEvolution.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function makeStroke(points, radiusNorm = 0.05, backgroundColor = 0xffc86400) {
  return {
    tool: 'paint',
    glyphColor: null,
    backgroundColor,
    radiusNorm,
    points: Float32Array.from(points),
  }
}

function paramsAt(ageMs) {
  const out = createEvolutionParams()
  evolutionParamsAt(ageMs, out)
  return out
}

// timing constants
assert(EVOLUTION_STATE2_MS === undefined, 'the three-state middle keyframe is gone (two states only)')
assert(EVOLUTION_SETTLE_MS === 7000, 'settle keyframe is at 7000 ms')
assert(EVOLUTION_MAX_ACTIVE === 8, 'at most 8 strokes evolve concurrently')

// (1) exact keyframes: 0s compact/grainy, 7s settled — two states, no elongation
{
  const p0 = paramsAt(0)
  assert(p0.radiusScale === 1 && p0.alpha === 1, 'State 1 at release: compact (radius x1), dense (alpha 1)')
  assert(p0.grain === 1, 'State 1 at release: full grain')
  assert(!('elongation' in p0), 'evolution params carry no elongation (retraction removed)')

  const p2 = paramsAt(7000)
  assert(p2.radiusScale === 1.6 && p2.alpha === 0.5, 'State 2 at 7s: settled radius, settled alpha')
  assert(p2.grain === 0, 'State 2 at 7s: no grain')

  assert(!isEvolutionSettled(6999), 'not settled just before 7s')
  assert(isEvolutionSettled(7000), 'settled (bake due) at exactly 7s')
}

// (2) ease-in-out interpolation between the two keyframes (smootherstep)
{
  assert(smootherstep01(0) === 0 && smootherstep01(1) === 1, 'smootherstep hits exact endpoints')
  assert(smootherstep01(0.5) === 0.5, 'smootherstep is symmetric through the midpoint')
  assert(
    Math.abs(smootherstep01(0.25) - (1 - smootherstep01(0.75))) < 1e-12,
    'smootherstep is a symmetric ease-in-out (e(t) = 1 - e(1-t))',
  )
  // Ease-in-out: progress near the segment start is slower than mid-segment.
  assert(
    smootherstep01(0.1) < 0.1 * smootherstep01(0.5) + 1e-12 &&
      smootherstep01(0.5) - smootherstep01(0.4) > smootherstep01(0.1) - smootherstep01(0),
    'smootherstep eases in (slow start, faster middle)',
  )

  let prevRadius = -Infinity
  let prevAlpha = Infinity
  let monotonicRadius = true
  let monotonicAlpha = true
  for (let age = 0; age <= 7000; age += 100) {
    const p = paramsAt(age)
    if (p.radiusScale < prevRadius) monotonicRadius = false
    if (p.alpha > prevAlpha) monotonicAlpha = false
    prevRadius = p.radiusScale
    prevAlpha = p.alpha
  }
  assert(monotonicRadius, 'radiusScale is monotonically non-decreasing across the evolution')
  assert(monotonicAlpha, 'alpha is monotonically non-increasing across the evolution')

  // Smootherstep midpoint of the single segment: t = 0.5 -> e = 0.5 -> exact
  // lerp midpoint between the two keyframes.
  const mid = paramsAt(3500)
  assert(Math.abs(mid.radiusScale - (1 + 1.6) / 2) < 1e-12, 'mid-segment radius is the smootherstep midpoint')
  assert(Math.abs(mid.alpha - (1 + 0.5) / 2) < 1e-12, 'mid-segment alpha is the smootherstep midpoint')

  // Grain decays ahead of the shape (curve at min(1, t*1.25)): at t=0.8 the
  // grain is fully through its curve while shape params are not.
  const lead = paramsAt(5600) // t = 0.8
  const shapeE = smootherstep01(0.8)
  assert(
    Math.abs(lead.radiusScale - (1 + (1.6 - 1) * shapeE)) < 1e-12,
    'shape params follow the un-accelerated curve',
  )
  assert(
    Math.abs(lead.grain - (1 + (0 - 1) * smootherstep01(1))) < 1e-12,
    'grain decay runs ahead of the shape curve',
  )
}

// (3) centroid invariance: no transforms at all — grain never moves points
{
  const stroke = makeStroke([0.1, 0.2, 0.4, 0.6, 0.9, 0.3])
  const seed = hashStrokeSeed(stroke)
  let grainCentered = true
  for (let i = 0; i < 32; i += 1) {
    const rf = grainRadiusFactor(seed, i, 1)
    const af = grainAlphaFactor(seed, i, 1)
    if (Math.abs(rf - 1) > 0.3 + 1e-12 || Math.abs(af - 1) > 0.25 + 1e-12) grainCentered = false
  }
  assert(grainCentered, 'grain factors stay within their depths around 1 (positions untouched)')
  assert(grainRadiusFactor(seed, 3, 0) === 1 && grainAlphaFactor(seed, 3, 0) === 1, 'zero grain disables jitter (settled state)')

  // Blotch channel: deterministic darker-variant selection, off at zero grain.
  let blotchSeen = false
  for (let i = 0; i < 64; i += 1) {
    if (grainDarkVariant(seed, i, 1)) blotchSeen = true
    assert(grainDarkVariant(seed, i, 0) === false, `blotch disabled at zero grain (point ${i})`)
  }
  assert(blotchSeen, 'blotch selects some darker-variant points at full grain')
  assert(
    grainDarkVariant(seed, 7, 0.8) === grainDarkVariant(seed, 7, 0.8),
    'blotch selection is deterministic',
  )
}

// (4) deterministic seeds -> identical params/grain across calls
{
  const strokeA1 = makeStroke([0.2, 0.2, 0.5, 0.5, 0.8, 0.2])
  const strokeA2 = makeStroke([0.2, 0.2, 0.5, 0.5, 0.8, 0.2])
  const strokeB = makeStroke([0.2, 0.2, 0.5, 0.5, 0.8, 0.2001])
  const seedA1 = hashStrokeSeed(strokeA1)
  const seedA2 = hashStrokeSeed(strokeA2)
  const seedB = hashStrokeSeed(strokeB)
  assert(seedA1 === seedA2, 'same stroke content hashes to the same seed')
  assert(seedA1 !== seedB, 'different stroke content hashes to a different seed')
  assert(grainRadiusFactor(seedA1, 7, 0.8) === grainRadiusFactor(seedA2, 7, 0.8), 'same seed reproduces identical grain')

  const p1 = paramsAt(1234)
  const p2 = paramsAt(1234)
  assert(
    p1.radiusScale === p2.radiusScale && p1.alpha === p2.alpha && p1.elongation === p2.elongation && p1.grain === p2.grain,
    'params at a given age are identical across calls',
  )
}

// (5) ring: max-8 cap with oldest force-baked, oldest-first consumption
{
  const ring = createEvolutionRing()
  assert(ring.count === 0 && ring.records.length === EVOLUTION_MAX_ACTIVE, 'ring starts empty with 8 preallocated slots')

  const records = []
  let evictedTotal = []
  for (let i = 0; i < 9; i += 1) {
    const rec = createEvolvingRecord(makeStroke([0.1 * (i + 1), 0.5, 0.1 * (i + 1) + 0.05, 0.5]), i * 1000)
    records.push(rec)
    const evicted = pushEvolvingStroke(ring, rec)
    if (evicted) evictedTotal.push(evicted)
    if (i < 8) assert(evicted === null, `push ${i + 1}: no eviction below the cap`)
  }
  assert(ring.count === 8, 'the 9th push keeps the ring at 8 records')
  assert(evictedTotal.length === 1 && evictedTotal[0] === records[0], 'the 9th push force-bakes the oldest record')
  assert(peekOldestEvolving(ring) === records[1], 'after eviction the 2nd-oldest record is the head')
  assert(evolvingRecordAt(ring, 7) === records[8], 'ring order is release order (oldest first)')
  assert(isStrokeEvolving(ring, records[5].stroke) && !isStrokeEvolving(ring, records[0].stroke), 'isStrokeEvolving tracks membership by stroke reference')

  // Settle bakes consume from the head in order.
  const dropped = dropOldestEvolving(ring)
  assert(dropped === records[1] && ring.count === 7, 'dropOldestEvolving bakes the oldest next')
  clearEvolutionRing(ring)
  assert(ring.count === 0 && peekOldestEvolving(ring) === null, 'clearEvolutionRing empties the ring')
  assert(dropOldestEvolving(ring) === null, 'dropping from an empty ring is a no-op')
}

// (6) State 3 idempotence: settled params never change, no re-bake drift
{
  const base = paramsAt(7000)
  let idempotent = true
  for (const age of [7000, 7001, 10000, 60000]) {
    const p = paramsAt(age)
    if (p.radiusScale !== base.radiusScale || p.alpha !== base.alpha || p.elongation !== base.elongation || p.grain !== base.grain) {
      idempotent = false
    }
  }
  assert(idempotent, 'params at/after 7s are constant (bake is idempotent, no per-frame work)')
  // Reduced motion settles immediately: the component skips the ring and
  // replays the stroke in exactly these settled params at release.
  const release = paramsAt(0)
  assert(release.radiusScale !== base.radiusScale, 'immediate-settle params differ from State 1 (settled look at release)')
}

// (7) record geometry: seed/centroid/direction precomputed once
{
  const stroke = makeStroke([0, 0, 0.5, 0.5, 1, 1])
  const rec = createEvolvingRecord(stroke, 1234)
  assert(rec.startMs === 1234, 'record keeps the release timestamp')
  assert(rec.seed === hashStrokeSeed(stroke), 'record seed is the stroke hash')
  assert(rec.stroke === stroke, 'record keeps the committed stroke reference')
  assert(!('angle' in rec) && !('centroidX' in rec), 'record carries no elongation geometry (two-state seep)')
  const degenerate = createEvolvingRecord(makeStroke([0.5, 0.5]), 0)
  assert(degenerate.seed === hashStrokeSeed(degenerate.stroke), 'degenerate (single-point) stroke still seeds deterministically')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll paint-evolution verifications passed.')
