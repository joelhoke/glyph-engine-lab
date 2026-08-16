#!/usr/bin/env node
/**
 * Deterministic verification for the Private Pond experiment:
 * engine/pondBody.ts (steering physics: seeded determinism, finiteness,
 * cruise-speed clamping, boundary containment, pointer current, ripples,
 * resize normalization, paint freeze, reduced-motion pose),
 * engine/pondConfig.ts (clamping), engine/pondTransform.ts (drift-for-all
 * target transform: translation-only vs rigid, identity pose, motion-off
 * buffer copy), engine/pondBoundaries.ts (hard viewport boundaries for
 * visible main glyphs: per-axis clamp, inward rebound scaled by wall-normal
 * impact speed, tangential preservation, reduced-motion containment, outward
 * impact edge masks), engine/pondFormation.ts (formation-level bounce:
 * per-wall unique-contact windows, deterministic opposing-wall resolution,
 * body rebound with restitution/min-kick/heading alignment, cooldown), and
 * the fixed-orientation creature geometry in engine/motion.ts (resting-
 * orientation evidence; no facing metadata — creatures never flip).
 * SceneCanvas routing invariants are asserted as source text.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFiles = [
  path.join(projectRoot, 'engine', 'pondBody.ts'),
  path.join(projectRoot, 'engine', 'pondConfig.ts'),
  path.join(projectRoot, 'engine', 'pondTransform.ts'),
  path.join(projectRoot, 'engine', 'pondBoundaries.ts'),
  path.join(projectRoot, 'engine', 'pondFormation.ts'),
  path.join(projectRoot, 'engine', 'motion.ts'),
  path.join(projectRoot, 'engine', 'motionConfig.ts'),
]
const tmpDir = path.join(projectRoot, 'tmp-verify-pond')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc ${sourceFiles.map((file) => `"${file}"`).join(' ')} --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  applyRipple,
  createPondBody,
  normalizeAfterResize,
  pondStaticPose,
  resolvePondMaxSpeed,
  stepPondBody,
  POND_ABSOLUTE_MAX_SPEED,
  POND_CURRENT_RADIUS,
} = require(path.join(tmpDir, 'pondBody.js'))
const { clampPondConfig, POND_DEFAULTS } = require(path.join(tmpDir, 'pondConfig.js'))
const {
  applyPondTransform,
  copyBaseIntoPondBuffers,
  isIdentityPondTransform,
  resolvePondTransform,
} = require(path.join(tmpDir, 'pondTransform.js'))
const {
  applyPondBoundary,
  resolvePondBoundaryRebound,
  POND_EDGE_BOTTOM,
  POND_EDGE_LEFT,
  POND_EDGE_RIGHT,
  POND_EDGE_TOP,
} = require(path.join(tmpDir, 'pondBoundaries.js'))
const {
  bouncePondBodyOffWalls,
  createPondFormationTracker,
  pondFormationContactThreshold,
  recordPondWallImpacts,
  resetPondFormationTracker,
  resolvePondFormationBounce,
  resolvePondFormationTorque,
} = require(path.join(tmpDir, 'pondFormation.js'))
const { CREATURE_DEFINITIONS } = require(path.join(tmpDir, 'motion.js'))

const EPS = 1e-6

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function pondWith(overrides) {
  return clampPondConfig({ ...POND_DEFAULTS, ...(overrides || {}), enabled: true })
}

function stepParams(config, width, height, pointer, frozen) {
  return { config, width, height, pointer: pointer || null, frozen: frozen === true }
}

function speed(body) {
  return Math.sqrt(body.vx * body.vx + body.vy * body.vy)
}

const W = 1280
const H = 720
const RESTING = Math.PI // original fish rests facing -X

// (1) determinism: same seed + same input sequence → identical trajectory
{
  const config = pondWith({})
  const a = createPondBody(W, H, RESTING, 42)
  const b = createPondBody(W, H, RESTING, 42)
  const pointer = { x: 400, y: 300, active: true, vx: 500, vy: -200 }
  for (let s = 0; s < 2000; s += 1) {
    const dt = 1 / 30
    stepPondBody(a, stepParams(config, W, H, s % 3 === 0 ? pointer : null), dt)
    stepPondBody(b, stepParams(config, W, H, s % 3 === 0 ? pointer : null), dt)
    if (s % 500 === 0) {
      applyRipple(a, 200, 200, 1.5)
      applyRipple(b, 200, 200, 1.5)
    }
  }
  assert(
    a.x === b.x && a.y === b.y && a.vx === b.vx && a.vy === b.vy &&
      a.heading === b.heading && a.spinAngle === b.spinAngle &&
      a.angularVelocity === b.angularVelocity && a.wanderPhase === b.wanderPhase,
    'same seed and inputs produce an identical trajectory',
  )

  const c = createPondBody(W, H, RESTING, 43)
  for (let s = 0; s < 600; s += 1) {
    stepPondBody(c, stepParams(config, W, H), 1 / 30)
  }
  const diverges = c.x !== a.x || c.y !== a.y || c.wanderPhase !== a.wanderPhase
  assert(diverges, 'a different seed produces a different trajectory')
}

// (2) long run: finite values, bounded speed, containment (with currents and
// ripples hammering the body the whole time)
{
  const config = pondWith({ cruiseSpeed: 120, wanderStrength: 1, pointerCurrentStrength: 2, rippleStrength: 2 })
  const body = createPondBody(W, H, RESTING, 7)
  body.angularVelocity = 3 // exercise the spin integration over the long run
  const maxSpeed = resolvePondMaxSpeed(config)
  const pointer = { x: W * 0.5, y: H * 0.5, active: true, vx: 4000, vy: 4000 }
  let finite = true
  let speedOk = true
  let contained = true
  for (let s = 0; s < 20000; s += 1) {
    if (s % 120 === 0) applyRipple(body, W * 0.25, H * 0.75, 2)
    stepPondBody(body, stepParams(config, W, H, s % 2 === 0 ? pointer : null), 1 / 60)
    if (!Number.isFinite(body.x) || !Number.isFinite(body.y) ||
        !Number.isFinite(body.vx) || !Number.isFinite(body.vy) ||
        !Number.isFinite(body.heading) || !Number.isFinite(body.spinAngle) ||
        !Number.isFinite(body.angularVelocity)) finite = false
    if (speed(body) > maxSpeed + EPS) speedOk = false
    if (body.x < 0 || body.x > W || body.y < 0 || body.y > H) contained = false
  }
  assert(finite, 'all body values stay finite over 20000 steps')
  assert(speedOk, `speed never exceeds the clamp ${maxSpeed} px/s after a step`)
  assert(contained, 'body stays inside the viewport over the long run')
  assert(
    Math.abs(body.heading) <= Math.PI + EPS,
    'heading stays wrapped into [-PI, PI]',
  )
  assert(
    Math.abs(body.spinAngle) <= Math.PI + EPS,
    'spin angle stays wrapped into [-PI, PI] over the long run',
  )
}

// (3) cruise behavior: from rest the body accelerates toward cruise speed,
// and the terminal speed hovers around it (never beyond the clamp)
{
  const config = pondWith({ cruiseSpeed: 60, wanderStrength: 0 })
  const body = createPondBody(W, H, RESTING, 1)
  for (let s = 0; s < 600; s += 1) {
    stepPondBody(body, stepParams(config, W, H), 1 / 60)
  }
  const v = speed(body)
  assert(
    v > 60 * 0.7 && v <= resolvePondMaxSpeed(config) + EPS,
    `terminal speed hovers near cruise (got ${v.toFixed(1)} px/s)`,
  )
  // Zero wander keeps the heading aligned with travel: it moves where it faces.
  const travel = Math.atan2(body.vy, body.vx)
  let diff = Math.abs(travel - body.heading) % (Math.PI * 2)
  if (diff > Math.PI) diff = Math.PI * 2 - diff
  assert(diff < 0.2, 'with zero wander the body travels along its heading')
}

// (4) boundary containment: soft steering keeps a cruising body inside, and
// the hard fallback pins a teleported body back into bounds
{
  const config = pondWith({ cruiseSpeed: 150, wanderStrength: 1 })
  const body = createPondBody(W, H, RESTING, 9)
  let contained = true
  for (let s = 0; s < 20000; s += 1) {
    stepPondBody(body, stepParams(config, W, H), 1 / 30)
    if (body.x < 0 || body.x > W || body.y < 0 || body.y > H) contained = false
  }
  assert(contained, 'a wandering cruising body never leaves the viewport')

  const escaped = createPondBody(W, H, RESTING, 9)
  escaped.x = -500
  escaped.y = H + 800
  escaped.vx = -300
  escaped.vy = 300
  stepPondBody(escaped, stepParams(config, W, H), 1 / 60)
  assert(
    escaped.x >= 0 && escaped.x <= W && escaped.y >= 0 && escaped.y <= H,
    'hard containment pins an out-of-bounds body back inside',
  )
  assert(escaped.vx >= 0 && escaped.vy <= 0, 'containment kills the outward velocity component')
}

// (5) pointer current: a moving pointer drags the body along its own velocity
// inside the falloff radius and has no effect beyond it
{
  const config = pondWith({ cruiseSpeed: 0, wanderStrength: 0, pointerCurrentStrength: 1 })
  const near = createPondBody(W, H, RESTING, 5)
  const pointer = { x: W * 0.5 + 40, y: H * 0.5, active: true, vx: 1000, vy: 0 }
  for (let s = 0; s < 60; s += 1) {
    stepPondBody(near, stepParams(config, W, H, pointer), 1 / 60)
  }
  assert(near.vx > 5, 'nearby moving pointer drags the body along its motion')

  const far = createPondBody(W, H, RESTING, 5)
  const farPointer = {
    x: W * 0.5 + POND_CURRENT_RADIUS + 100,
    y: H * 0.5,
    active: true,
    vx: 1000,
    vy: 0,
  }
  for (let s = 0; s < 60; s += 1) {
    stepPondBody(far, stepParams(config, W, H, farPointer), 1 / 60)
  }
  assert(Math.abs(far.vx) < EPS && far.x === W * 0.5, 'pointer beyond the falloff radius has no effect')

  const inactive = createPondBody(W, H, RESTING, 5)
  const inactivePointer = { x: W * 0.5 + 40, y: H * 0.5, active: false, vx: 1000, vy: 0 }
  for (let s = 0; s < 60; s += 1) {
    stepPondBody(inactive, stepParams(config, W, H, inactivePointer), 1 / 60)
  }
  assert(Math.abs(inactive.vx) < EPS, 'an inactive pointer applies no current')

  const zeroStrength = pondWith({ cruiseSpeed: 0, wanderStrength: 0, pointerCurrentStrength: 0 })
  const zeroed = createPondBody(W, H, RESTING, 5)
  for (let s = 0; s < 60; s += 1) {
    stepPondBody(zeroed, stepParams(zeroStrength, W, H, pointer), 1 / 60)
  }
  assert(Math.abs(zeroed.vx) < EPS, 'pointerCurrentStrength 0 disables the current')
}

// (6) ripple: outward from the click point, strength-scaled, absolutely capped
{
  const body = createPondBody(W, H, RESTING, 3)
  body.x = 100
  body.y = 100
  body.vx = 0
  body.vy = 0
  applyRipple(body, 300, 100, 1) // click to the right of the body
  assert(body.vx < 0 && Math.abs(body.vy) < EPS, 'ripple pushes the body outward from the click')

  const weak = createPondBody(W, H, RESTING, 3)
  weak.x = 100
  weak.y = 100
  applyRipple(weak, 300, 100, 0.5)
  const strong = createPondBody(W, H, RESTING, 3)
  strong.x = 100
  strong.y = 100
  applyRipple(strong, 300, 100, 2)
  assert(
    Math.abs(speed(strong) - speed(weak) * 4) < EPS,
    'ripple impulse scales linearly with strength',
  )

  const blast = createPondBody(W, H, RESTING, 3)
  for (let i = 0; i < 50; i += 1) applyRipple(blast, 0, 0, 2)
  assert(
    speed(blast) <= POND_ABSOLUTE_MAX_SPEED + EPS,
    'repeated ripples never exceed the absolute safety ceiling',
  )

  const centered = createPondBody(W, H, RESTING, 3)
  centered.vx = 0
  centered.vy = 0
  applyRipple(centered, centered.x, centered.y, 1) // exact hit: no direction
  assert(
    Math.abs(centered.vx - Math.cos(RESTING) * speed(centered)) < EPS &&
      Math.abs(centered.vy - Math.sin(RESTING) * speed(centered)) < EPS,
    'a zero-distance ripple pushes along the current heading',
  )
}

// (7) resize normalization: position scales with the bounds and stays inside
{
  const body = createPondBody(W, H, RESTING, 11)
  body.x = 640
  body.y = 360
  normalizeAfterResize(body, W, H, 640, 360)
  assert(body.x === 320 && body.y === 180, 'resize scales the body position proportionally')

  body.x = 5000
  body.y = -200
  normalizeAfterResize(body, 640, 360, 640, 360)
  assert(
    body.x >= 0 && body.x <= 640 && body.y >= 0 && body.y <= 360,
    'normalization clamps an out-of-bounds body into the new bounds',
  )

  const fresh = createPondBody(W, H, RESTING, 11)
  fresh.x = 100
  fresh.y = 100
  normalizeAfterResize(fresh, 0, 0, 640, 360) // unknown old bounds: clamp only
  assert(fresh.x === 100 && fresh.y === 100, 'unknown old bounds leave a valid position untouched')
}

// (8) paint freeze: a frozen step holds the pose exactly
{
  const config = pondWith({ cruiseSpeed: 100, wanderStrength: 1 })
  const body = createPondBody(W, H, RESTING, 13)
  for (let s = 0; s < 120; s += 1) {
    stepPondBody(body, stepParams(config, W, H), 1 / 60)
  }
  const snapshot = { ...body }
  const pointer = { x: body.x + 20, y: body.y, active: true, vx: 2000, vy: 2000 }
  for (let s = 0; s < 60; s += 1) {
    stepPondBody(body, stepParams(config, W, H, pointer, true), 1 / 60)
  }
  assert(
    body.x === snapshot.x && body.y === snapshot.y &&
      body.vx === snapshot.vx && body.vy === snapshot.vy &&
      body.heading === snapshot.heading && body.wanderPhase === snapshot.wanderPhase,
    'a frozen step changes nothing (paint freeze)',
  )
}

// (9) reduced-motion pose: centered, deterministic, resting heading, no spin
{
  const a = pondStaticPose(W, H, RESTING)
  const b = pondStaticPose(W, H, RESTING)
  assert(
    a.x === W * 0.5 && a.y === H * 0.5 && a.heading === RESTING && a.spinAngle === 0,
    'static pose is centered with the resting heading and zero spin',
  )
  assert(
    a.x === b.x && a.y === b.y && a.heading === b.heading && a.spinAngle === b.spinAngle,
    'static pose is deterministic',
  )
}

// (10) config clamping + inert defaults
{
  assert(POND_DEFAULTS.enabled === false, 'pond defaults to disabled (inert)')
  assert(
    POND_DEFAULTS.boundaryMinBounceSpeed === 0.5 &&
      POND_DEFAULTS.boundaryMaxBounceSpeed === 8 &&
      POND_DEFAULTS.boundaryFullBounceImpactSpeed === 8,
    'boundary defaults: min 0.5, max 8, full-bounce impact 8 (px/frame)',
  )
  const clamped = clampPondConfig({
    enabled: true,
    cruiseSpeed: 9999,
    wanderStrength: -3,
    pointerCurrentStrength: NaN,
    rippleStrength: Infinity,
    boundaryMinBounceSpeed: -2,
    boundaryMaxBounceSpeed: 999,
    boundaryFullBounceImpactSpeed: 0,
  })
  assert(clamped.cruiseSpeed === 300, 'cruise speed clamps to 300')
  assert(clamped.wanderStrength === 0, 'wander clamps to 0')
  assert(clamped.pointerCurrentStrength === 0, 'non-finite pointer current falls to the minimum')
  assert(clamped.rippleStrength === 0, 'non-finite ripple falls to the minimum')
  assert(clamped.boundaryMinBounceSpeed === 0, 'min bounce clamps to its 0–10 range')
  assert(clamped.boundaryMaxBounceSpeed === 30, 'max bounce clamps to its 0–30 range')
  assert(
    clamped.boundaryFullBounceImpactSpeed === 0.5,
    'full-bounce impact clamps to its 0.5–30 range',
  )

  // Invariant: max ≥ min — the max clamps upward when the min exceeds it.
  const inverted = clampPondConfig({
    ...POND_DEFAULTS,
    boundaryMinBounceSpeed: 9,
    boundaryMaxBounceSpeed: 1,
  })
  assert(
    inverted.boundaryMinBounceSpeed === 9 && inverted.boundaryMaxBounceSpeed === 9,
    'max bounce clamps upward to keep max ≥ min',
  )
  const alreadyOrdered = clampPondConfig({
    ...POND_DEFAULTS,
    boundaryMinBounceSpeed: 2,
    boundaryMaxBounceSpeed: 12,
  })
  assert(
    alreadyOrdered.boundaryMinBounceSpeed === 2 && alreadyOrdered.boundaryMaxBounceSpeed === 12,
    'an ordered min/max pair passes through unchanged',
  )

  assert(
    POND_DEFAULTS.formationContactThresholdPercent === 5 &&
      POND_DEFAULTS.formationImpactWindowMs === 350 &&
      POND_DEFAULTS.formationBounceRestitution === 1 &&
      POND_DEFAULTS.formationMinInwardSpeedRatio === 0.5 &&
      POND_DEFAULTS.formationBounceCooldownMs === 600,
    'formation defaults: 5%, 350ms window, restitution 1, inward kick 0.5×, cooldown 600ms',
  )
  const formationClamped = clampPondConfig({
    ...POND_DEFAULTS,
    formationContactThresholdPercent: 0,
    formationImpactWindowMs: 99999,
    formationBounceRestitution: -1,
    formationMinInwardSpeedRatio: 99,
    formationBounceCooldownMs: -50,
  })
  assert(
    formationClamped.formationContactThresholdPercent === 1,
    'contact threshold clamps to its 1–50 range',
  )
  assert(
    formationClamped.formationImpactWindowMs === 1500,
    'impact window clamps to its 100–1500 range',
  )
  assert(formationClamped.formationBounceRestitution === 0, 'restitution clamps to its 0–2 range')
  assert(formationClamped.formationMinInwardSpeedRatio === 2, 'inward kick clamps to its 0–2 range')
  assert(formationClamped.formationBounceCooldownMs === 0, 'bounce cooldown clamps to its 0–2000 range')

  assert(
    POND_DEFAULTS.formationAngularImpulseStrength === 3.5 &&
      POND_DEFAULTS.formationSpinHalfLifeMs === 1800 &&
      POND_DEFAULTS.formationMaxAngularSpeed === 5,
    'spin defaults: impulse 3.5 rad/s, half-life 1800ms, max 5 rad/s',
  )
  const spinClamped = clampPondConfig({
    ...POND_DEFAULTS,
    formationAngularImpulseStrength: -1,
    formationSpinHalfLifeMs: 99999,
    formationMaxAngularSpeed: 99,
  })
  assert(spinClamped.formationAngularImpulseStrength === 0, 'impact torque clamps to its 0–8 range')
  assert(spinClamped.formationSpinHalfLifeMs === 5000, 'spin half-life clamps to its 100–5000 range')
  assert(spinClamped.formationMaxAngularSpeed === 10, 'max spin speed clamps to its 0–10 range')
}

// (11) fixed-orientation creatures: no facing metadata remains — every
// source rotates by impact spin only (no flip). The resting-orientation
// geometry is still asserted as documentation of what "upright" means.
{
  const restingParams = {
    time: 0,
    amount: 0,
    speed: 1,
    waveScale: 1,
    complexity: 1,
    width: W,
    height: H,
  }
  const computeResting = (variant, count) => {
    const def = CREATURE_DEFINITIONS[variant]
    const topology = def.buildTopology(count)
    const outX = new Float32Array(count)
    const outY = new Float32Array(count)
    def.compute(topology, restingParams, outX, outY)
    return { topology, outX, outY }
  }

  {
    // Fish resting orientation: head-marked points (aux 2) sit at the left
    // end, tail-fin points (aux 1) at the right end.
    const { topology, outX } = computeResting('original', 4000)
    let headX = 0
    let headN = 0
    let tailX = 0
    let tailN = 0
    for (let i = 0; i < topology.count; i += 1) {
      if (topology.aux[i] === 2) {
        headX += outX[i]
        headN += 1
      } else if (topology.aux[i] === 1) {
        tailX += outX[i]
        tailN += 1
      }
    }
    assert(
      headN > 0 && tailN > 0 && headX / headN < tailX / tailN,
      'original rests upright: head points sit left of the tail fin',
    )
  }

  {
    // Jelly resting orientation: the bell dome apex is the topmost point and
    // sits above the rim (0.42 * height); tendrils trail below it.
    const { topology, outY } = computeResting('jelly', 4000)
    const rimY = H * 0.42
    let topY = Infinity
    let topIsBell = false
    let tendrilBottom = -Infinity
    for (let i = 0; i < topology.count; i += 1) {
      if (outY[i] < topY) {
        topY = outY[i]
        topIsBell = topology.aux[i] < 0
      }
      if (topology.aux[i] >= 0 && outY[i] > tendrilBottom) tendrilBottom = outY[i]
    }
    assert(
      topIsBell && topY < rimY,
      'jelly rests upright: the bell dome apex is the topmost point',
    )
    assert(tendrilBottom > rimY, 'jelly appendages trail below the rim')
  }

  {
    // Ray resting orientation: a wide span mirrored about the vertical axis.
    const { topology, outX } = computeResting('ray', 4000)
    let minX = Infinity
    let maxX = -Infinity
    let sumX = 0
    for (let i = 0; i < topology.count; i += 1) {
      minX = Math.min(minX, outX[i])
      maxX = Math.max(maxX, outX[i])
      sumX += outX[i]
    }
    const meanX = sumX / topology.count
    assert(
      Math.abs(meanX - W * 0.5) < 1 && maxX - minX > W * 0.5,
      'ray rests upright: a wide span mirrored about the viewport center X',
    )
  }

  assert(
    CREATURE_DEFINITIONS.original.locomotion == null &&
      CREATURE_DEFINITIONS.jelly.locomotion == null &&
      CREATURE_DEFINITIONS.ray.locomotion == null &&
      CREATURE_DEFINITIONS.custom.locomotion == null,
    'no creature declares facing metadata (creatures keep a fixed upright orientation)',
  )
}

// (12) translation-only drift: the whole field glides with the body — the
// relative angles and spread of the field are preserved (no rotation)
{
  const count = 4000
  const topology = CREATURE_DEFINITIONS.jelly.buildTopology(count)
  const fieldX = new Float32Array(count)
  const fieldY = new Float32Array(count)
  CREATURE_DEFINITIONS.jelly.compute(
    topology,
    { time: 0, amount: 1, speed: 1, waveScale: 1, complexity: 2, width: W, height: H },
    fieldX,
    fieldY,
  )
  const beforeX = Float64Array.from(fieldX)
  const beforeY = Float64Array.from(fieldY)
  const drift = {
    angle: 0,
    anchorPx: W * 0.5,
    anchorPy: H * 0.5,
    translateX: 123.25,
    translateY: -45.5,
  }
  applyPondTransform(fieldX, fieldY, count, drift)
  let movedOk = true
  for (let i = 0; i < count; i += 1) {
    if (
      Math.abs(fieldX[i] - beforeX[i] - drift.translateX) > 0.01 ||
      Math.abs(fieldY[i] - beforeY[i] - drift.translateY) > 0.01
    ) {
      movedOk = false
    }
  }
  assert(movedOk, 'drift moves every target by exactly the body offset')

  let geometryOk = true
  for (let i = 0; i < 500; i += 1) {
    const j = (i * 7 + 3) % count
    const bdx = beforeX[j] - beforeX[i]
    const bdy = beforeY[j] - beforeY[i]
    const bLen = Math.hypot(bdx, bdy)
    if (bLen < 1) continue
    const aLen = Math.hypot(fieldX[j] - fieldX[i], fieldY[j] - fieldY[i])
    if (Math.abs(aLen - bLen) / bLen > 1e-3) geometryOk = false
    let diff = Math.abs(
      Math.atan2(fieldY[j] - fieldY[i], fieldX[j] - fieldX[i]) - Math.atan2(bdy, bdx),
    ) % (Math.PI * 2)
    if (diff > Math.PI) diff = Math.PI * 2 - diff
    if (diff > 1e-3) geometryOk = false
  }
  assert(geometryOk, 'drift preserves pairwise distances and relative angles (no rotation)')
}

// (13) rigid transform: pairwise distances preserved, rotation by exactly the
// resolved angle around the anchor
{
  const count = 512
  const fieldX = new Float32Array(count)
  const fieldY = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    fieldX[i] = W * 0.5 + ((i * 37) % 200) - 100
    fieldY[i] = H * 0.5 + ((i * 53) % 160) - 80
  }
  const beforeX = Float64Array.from(fieldX)
  const beforeY = Float64Array.from(fieldY)
  const angle = 0.7
  const transform = {
    angle,
    anchorPx: W * 0.5,
    anchorPy: H * 0.5,
    translateX: 40,
    translateY: -25,
  }
  applyPondTransform(fieldX, fieldY, count, transform)
  let rigidOk = true
  for (let i = 0; i < 200; i += 1) {
    const j = (i * 5 + 1) % count
    const bLen = Math.hypot(beforeX[j] - beforeX[i], beforeY[j] - beforeY[i])
    if (bLen < 1) continue
    const aLen = Math.hypot(fieldX[j] - fieldX[i], fieldY[j] - fieldY[i])
    if (Math.abs(aLen - bLen) / bLen > 1e-3) rigidOk = false
  }
  assert(rigidOk, 'rigid transform preserves pairwise distances')

  const px = new Float32Array([W * 0.5 + 50])
  const py = new Float32Array([H * 0.5])
  applyPondTransform(px, py, 1, transform)
  const expectX = W * 0.5 + 40 + 50 * Math.cos(angle)
  const expectY = H * 0.5 - 25 + 50 * Math.sin(angle)
  assert(
    Math.abs(px[0] - expectX) < 0.01 && Math.abs(py[0] - expectY) < 0.01,
    'rigid transform rotates by the angle and lands the anchor on the pose',
  )
}

// (14) transform resolution: one rule for every source — impact spin around
// the viewport center plus drift; the static pose is the identity
{
  const pose = { x: W * 0.5 + 90, y: H * 0.5 - 30, heading: 1.1, spinAngle: 0 }
  const driftT = resolvePondTransform(pose, W, H)
  assert(driftT.angle === 0, 'zero spin → no rotation, whatever the heading')
  assert(
    driftT.anchorPx === W * 0.5 && driftT.anchorPy === H * 0.5,
    'the transform pivots around the viewport center',
  )
  assert(
    Math.abs(driftT.translateX - 90) < EPS && Math.abs(driftT.translateY + 30) < EPS,
    'drift translation is the pose minus the viewport center',
  )

  const spun = resolvePondTransform({ ...pose, heading: 2.4, spinAngle: 0.35 }, W, H)
  assert(
    spun.angle === 0.35,
    'angle is the impact spin alone — heading never composes (no creature flip)',
  )

  const staticDrift = resolvePondTransform(pondStaticPose(W, H, 0), W, H)
  assert(isIdentityPondTransform(staticDrift), 'centered static pose → identity drift transform')
}

// (15) motion-off routing: the base field is copied into the drift buffers
// and never mutated, however many pond frames run
{
  const count = 128
  const baseX = new Float32Array(count)
  const baseY = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    baseX[i] = (i * 61) % W
    baseY[i] = (i * 97) % H
  }
  const baseSnapshotX = Float64Array.from(baseX)
  const baseSnapshotY = Float64Array.from(baseY)
  const bufX = new Float32Array(count)
  const bufY = new Float32Array(count)
  const config = pondWith({ cruiseSpeed: 90 })
  const body = createPondBody(W, H, 0, 21)
  let baseOk = true
  for (let frame = 0; frame < 120; frame += 1) {
    stepPondBody(body, stepParams(config, W, H), 1 / 60)
    copyBaseIntoPondBuffers(baseX, baseY, bufX, bufY, count)
    applyPondTransform(bufX, bufY, count, resolvePondTransform(body, W, H))
    for (let i = 0; i < count; i += 1) {
      if (baseX[i] !== baseSnapshotX[i] || baseY[i] !== baseSnapshotY[i]) baseOk = false
    }
  }
  assert(baseOk, 'base arrays stay byte-identical across 120 drifted pond frames')

  const pose = resolvePondTransform(body, W, H)
  let driftOk = true
  for (let i = 0; i < count; i += 1) {
    if (
      Math.abs(bufX[i] - baseSnapshotX[i] - pose.translateX) > 0.01 ||
      Math.abs(bufY[i] - baseSnapshotY[i] - pose.translateY) > 0.01
    ) {
      driftOk = false
    }
  }
  assert(driftOk, 'drift buffers equal the base field plus the body offset')
}

// (16) mode switching while the pond is active: the same body trajectory
// drives every source with one rule — impact spin only, never heading
{
  const config = pondWith({ cruiseSpeed: 80 })
  const body = createPondBody(W, H, 0, 33)
  body.angularVelocity = 1.2
  const sources = [
    'text/upload',
    'original',
    'organic-flow',
    'jelly',
    'ray',
    'custom',
    'motion-off',
  ]
  const fx = new Float32Array([W * 0.5 + 10, W * 0.5 - 20])
  const fy = new Float32Array([H * 0.5 + 5, H * 0.5 - 15])
  let angleOk = true
  let finite = true
  for (let s = 0; s < sources.length; s += 1) {
    stepPondBody(body, stepParams(config, W, H), 1 / 30)
    const t = resolvePondTransform(body, W, H)
    if (t.angle !== body.spinAngle) angleOk = false
    applyPondTransform(fx, fy, fx.length, t)
    if (!Number.isFinite(fx[0]) || !Number.isFinite(fy[0])) finite = false
  }
  assert(angleOk, 'every source rotates by the spin angle alone as the source switches')
  assert(finite, 'targets stay finite across source switches with the pond active')
}

// (17) SceneCanvas routing + retired debug panel (source-text invariants)
{
  const sceneSrc = fs.readFileSync(path.join(projectRoot, 'components', 'SceneCanvas.tsx'), 'utf8')
  assert(
    sceneSrc.includes("if (mode === 'off' && !pond) return"),
    'motion-off only idles when the pond is inactive',
  )
  assert(
    /else if \(getPondConfig\(\)\) \{[\s\S]*?activeTargetsXRef\.current = motionBuffersXRef\.current/.test(sceneSrc),
    'motion-off + pond routes the active targets through the motion buffers',
  )
  assert(
    !/baseTargets[XY]Ref\.current\[/.test(sceneSrc),
    'the base target arrays are never mutated in place',
  )
  assert(
    /enabled === pondEnabledRef\.current\) return[\s\S]*?applyMotionField\(\)/.test(sceneSrc),
    'a pond enable/disable transition re-routes the motion field',
  )
  assert(
    /const pondBoundaries = getPondConfig\(\)/.test(sceneSrc) &&
      sceneSrc.includes('pondBoundaries ? applyPondBoundary(p, W, H, pondBoundaries) : 0'),
    'the glyph boundary pass is gated per frame on the enabled pond config (pond-disabled = untouched)',
  )
  assert(
    sceneSrc.includes(
      'recordPondWallImpacts(pondFormation, i, impactMask, p.x, p.y, incomingVx, incomingVy, now)',
    ) && sceneSrc.includes('resolvePondFormationBounce('),
    'the boundary edge mask feeds the formation tracker and per-frame resolution',
  )
  assert(
    sceneSrc.includes('const incomingVx = p.vx') &&
      sceneSrc.includes('p.x, p.y, incomingVx, incomingVy, now'),
    'incoming velocity is captured before the boundary rebound for the torque accumulators',
  )
  assert(
    sceneSrc.includes('reducedMotion || activeStrokeRef.current !== null'),
    'formation accumulation is suppressed under reduced motion and paint gestures',
  )
  assert(
    (sceneSrc.match(/resetPondFormationTracker\(pondFormationRef\.current\)/g) || []).length >= 6,
    'formation tracker resets on pond transitions, settings, field rebuilds, and resize',
  )
  assert(
    (sceneSrc.match(/applyPondBoundary\(p, W, H/g) || []).length === 1,
    'only the main glyph loop runs the boundary pass (ambient pool untouched)',
  )

  assert(
    !fs.existsSync(path.join(projectRoot, 'components', 'vibe', 'PondPanel.tsx')),
    'the debug PondPanel is retired (pond physics stay at hidden POND_DEFAULTS)',
  )
}

// (18) hard viewport boundaries: per-axis clamp + inward rebound scaled by
// the wall-normal impact speed; tangential preserved; reduced-motion
// containment keeps velocity zero
{
  const config = pondWith({
    boundaryMinBounceSpeed: 1,
    boundaryMaxBounceSpeed: 9,
    boundaryFullBounceImpactSpeed: 8,
  })
  const reboundFor = (impact) => 1 + (9 - 1) * Math.min(1, Math.max(0, impact / 8))

  // Each edge: clamp the escaped center, rebound inward, tangential kept.
  const left = { x: -5, y: 100, vx: -4, vy: 3 }
  applyPondBoundary(left, W, H, config)
  assert(
    left.x === 0 && Math.abs(left.vx - reboundFor(4)) < EPS && left.vy === 3,
    'left edge clamps and rebounds inward, tangential vy unchanged',
  )

  const right = { x: W + 10, y: 100, vx: 12, vy: -2 }
  applyPondBoundary(right, W, H, config)
  assert(
    right.x === W && Math.abs(right.vx + reboundFor(12)) < EPS && right.vy === -2,
    'right edge clamps and rebounds inward (above threshold), tangential unchanged',
  )

  const top = { x: 100, y: -8, vx: 2.5, vy: -8 }
  applyPondBoundary(top, W, H, config)
  assert(
    top.y === 0 && Math.abs(top.vy - reboundFor(8)) < EPS && top.vx === 2.5,
    'top edge clamps and rebounds inward at the threshold, tangential unchanged',
  )

  const bottom = { x: 100, y: H + 3, vx: -1.5, vy: 2 }
  applyPondBoundary(bottom, W, H, config)
  assert(
    bottom.y === H && Math.abs(bottom.vy + reboundFor(2)) < EPS && bottom.vx === -1.5,
    'bottom edge clamps and rebounds inward, tangential unchanged',
  )

  // Impact → rebound mapping: slow, half, threshold, above-threshold.
  assert(
    Math.abs(resolvePondBoundaryRebound(0.25, 1, 9, 8) - 1.25) < EPS,
    'slow impact maps near the min rebound',
  )
  assert(
    Math.abs(resolvePondBoundaryRebound(4, 1, 9, 8) - 5) < EPS,
    'half-threshold impact maps to the midpoint rebound',
  )
  assert(
    Math.abs(resolvePondBoundaryRebound(8, 1, 9, 8) - 9) < EPS,
    'threshold impact maps to the max rebound',
  )
  assert(
    Math.abs(resolvePondBoundaryRebound(80, 1, 9, 8) - 9) < EPS,
    'above-threshold impact saturates at the max rebound',
  )

  // Corner: both axes resolve independently in one call.
  const corner = { x: -4, y: H + 6, vx: -2, vy: 8 }
  applyPondBoundary(corner, W, H, config)
  assert(
    corner.x === 0 &&
      corner.y === H &&
      Math.abs(corner.vx - reboundFor(2)) < EPS &&
      Math.abs(corner.vy + reboundFor(8)) < EPS,
    'a corner escape resolves both axes independently',
  )

  // Inward-moving at the edge: clamp only, never reflect.
  const inward = { x: -3, y: 50, vx: 6, vy: -1 }
  applyPondBoundary(inward, W, H, config)
  assert(
    inward.x === 0 && inward.vx === 6 && inward.vy === -1,
    'an inward-moving particle at the edge is clamped but never reflected',
  )

  // Large overshoot cannot escape.
  const missile = { x: -10000, y: H + 9000, vx: -900, vy: 900 }
  applyPondBoundary(missile, W, H, config)
  assert(
    missile.x === 0 &&
      missile.y === H &&
      Math.abs(missile.vx - 9) < EPS &&
      Math.abs(missile.vy + 9) < EPS,
    'a huge overshoot clamps inside with a saturated rebound',
  )

  // Glyph centers may rest on the exact edge.
  const resting = { x: 0, y: H, vx: 0, vy: 0 }
  applyPondBoundary(resting, W, H, config)
  assert(
    resting.x === 0 && resting.y === H && resting.vx === 0 && resting.vy === 0,
    'a glyph resting exactly on the edge is untouched',
  )

  // Reduced motion: contain the center, velocity stays zero, no rebound.
  const reduced = { x: W + 50, y: -20, vx: 0, vy: 0 }
  applyPondBoundary(reduced, W, H, config)
  assert(
    reduced.x === W && reduced.y === 0 && reduced.vx === 0 && reduced.vy === 0,
    'reduced-motion containment clamps the center and keeps velocity zero',
  )

  // In-bounds particles are untouched entirely.
  const inside = { x: 100, y: 100, vx: 2, vy: -3 }
  applyPondBoundary(inside, W, H, config)
  assert(
    inside.x === 100 && inside.y === 100 && inside.vx === 2 && inside.vy === -3,
    'an in-bounds particle is unchanged',
  )
}

// (19) edge masks: only ACTUAL outward impacts report an edge
{
  const config = pondWith({})

  const left = { x: -5, y: 100, vx: -4, vy: 3 }
  const leftMask = applyPondBoundary(left, W, H, config)
  assert(leftMask === POND_EDGE_LEFT, 'left outward impact reports POND_EDGE_LEFT only')

  const right = { x: W + 5, y: 100, vx: 4, vy: 0 }
  const rightMask = applyPondBoundary(right, W, H, config)
  assert(rightMask === POND_EDGE_RIGHT, 'right outward impact reports POND_EDGE_RIGHT only')

  const top = { x: 100, y: -5, vx: 0, vy: -4 }
  const topMask = applyPondBoundary(top, W, H, config)
  assert(topMask === POND_EDGE_TOP, 'top outward impact reports POND_EDGE_TOP only')

  const bottom = { x: 100, y: H + 5, vx: 0, vy: 4 }
  const bottomMask = applyPondBoundary(bottom, W, H, config)
  assert(bottomMask === POND_EDGE_BOTTOM, 'bottom outward impact reports POND_EDGE_BOTTOM only')

  const corner = { x: -4, y: H + 6, vx: -2, vy: 8 }
  const cornerMask = applyPondBoundary(corner, W, H, config)
  assert(
    cornerMask === (POND_EDGE_LEFT | POND_EDGE_BOTTOM),
    'a corner impact reports both edges',
  )

  const inward = { x: -3, y: 50, vx: 6, vy: -1 }
  const inwardMask = applyPondBoundary(inward, W, H, config)
  assert(inwardMask === 0 && inward.x === 0, 'clamping an inward-moving glyph reports no impact')

  const still = { x: W + 50, y: -20, vx: 0, vy: 0 }
  const stillMask = applyPondBoundary(still, W, H, config)
  assert(
    stillMask === 0 && still.x === W && still.y === 0,
    'reduced-motion containment (zero velocity) reports no impact',
  )

  const inside = { x: 100, y: 100, vx: 2, vy: -3 }
  assert(applyPondBoundary(inside, W, H, config) === 0, 'an in-bounds glyph reports no impact')

  const resting = { x: 0, y: H, vx: 0, vy: 0 }
  assert(
    applyPondBoundary(resting, W, H, config) === 0,
    'a glyph resting exactly on the edge reports no impact',
  )
}

// (20) formation tracker: per-wall unique-contact windows, thresholds,
// expiry, cooldown, reset, torque accumulators — all driven by injected time
{
  const config = pondWith({
    cruiseSpeed: 60,
    formationContactThresholdPercent: 5,
    formationImpactWindowMs: 350,
    formationBounceRestitution: 1,
    formationMinInwardSpeedRatio: 0.5,
    formationBounceCooldownMs: 600,
  })

  // Threshold: max(1, ceil(visible × percent / 100)) — incl. sparse fields.
  assert(pondFormationContactThreshold(120, config) === 6, 'threshold: ceil(120 × 5%) = 6')
  assert(pondFormationContactThreshold(100, config) === 5, 'threshold: ceil(100 × 5%) = 5')
  assert(pondFormationContactThreshold(10, config) === 1, 'threshold floors at 1 (sparse field)')
  assert(pondFormationContactThreshold(37, config) === 2, 'threshold: ceil(37 × 5%) = 2')

  // Unique counting: a particle counts at most once per wall per window;
  // walls and particles accumulate independently.
  {
    const tracker = createPondFormationTracker(16)
    recordPondWallImpacts(tracker, 3, POND_EDGE_LEFT, 0, 200, -4, 3, 1000)
    recordPondWallImpacts(tracker, 3, POND_EDGE_LEFT, 0, 200, -4, 3, 1000)
    recordPondWallImpacts(tracker, 3, POND_EDGE_LEFT, 0, 200, -4, 3, 1010)
    assert(tracker.counts[0] === 1, 'one glyph counts once per wall per window')
    recordPondWallImpacts(tracker, 4, POND_EDGE_LEFT, 0, 200, -4, 3, 1020)
    assert(tracker.counts[0] === 2, 'distinct glyphs accumulate independently')
    recordPondWallImpacts(tracker, 3, POND_EDGE_TOP, 200, 0, 0, -4, 1020)
    assert(
      tracker.counts[0] === 2 && tracker.counts[2] === 1,
      'the same glyph counts independently per wall',
    )
    recordPondWallImpacts(tracker, 99, POND_EDGE_LEFT, 0, 200, -4, 3, 1020)
    assert(tracker.counts[0] === 2, 'a particle index beyond capacity is ignored')
  }

  // Torque accumulators: speed-weight sums, tangent-position sums, and
  // normal-speed sums — duplicates add nothing.
  {
    const tracker = createPondFormationTracker(16)
    recordPondWallImpacts(tracker, 1, POND_EDGE_LEFT, 0, 200, -4, 3, 1000)
    // weight = hypot(-4, 3) = 5, tangent = 200 × 5, normal = 4
    assert(
      tracker.speedWeightSums[0] === 5 &&
        tracker.tangentSums[0] === 1000 &&
        tracker.normalSpeedSums[0] === 4,
      'impact accumulates speed weight, tangent position × weight, and normal speed',
    )
    recordPondWallImpacts(tracker, 1, POND_EDGE_LEFT, 0, 200, -4, 3, 1001)
    assert(
      tracker.speedWeightSums[0] === 5 && tracker.tangentSums[0] === 1000,
      'a duplicate impact adds nothing to the torque accumulators',
    )
    recordPondWallImpacts(tracker, 2, POND_EDGE_LEFT, 0, 400, -2, 0, 1002)
    assert(
      tracker.speedWeightSums[0] === 7 &&
        tracker.tangentSums[0] === 1800 &&
        tracker.normalSpeedSums[0] === 6,
      'a second glyph adds its own weighted contribution',
    )
  }

  // Window expiry: an unsuccessful window clears after formationImpactWindowMs.
  {
    const tracker = createPondFormationTracker(16)
    recordPondWallImpacts(tracker, 1, POND_EDGE_LEFT, 0, 200, -4, 3, 1000)
    recordPondWallImpacts(tracker, 2, POND_EDGE_LEFT, 0, 400, -2, 0, 1100)
    const body = createPondBody(W, H, 0, 5)
    const bounced = resolvePondFormationBounce(tracker, body, 100, config, 1000 + 351, W, H)
    assert(
      bounced === 0 &&
        tracker.windowStartMs[0] === -1 &&
        tracker.counts[0] === 0 &&
        tracker.speedWeightSums[0] === 0 &&
        tracker.tangentSums[0] === 0 &&
        tracker.normalSpeedSums[0] === 0,
      'an unsuccessful window expires and clears contacts and torque sums',
    )
    recordPondWallImpacts(tracker, 3, POND_EDGE_LEFT, 0, 100, -4, 0, 1400)
    assert(
      tracker.windowStartMs[0] === 1400 && tracker.counts[0] === 1,
      'a later impact opens a fresh window',
    )
  }

  // Trigger: reaching the threshold bounces the body, resets all windows,
  // and starts the cooldown.
  {
    const tracker = createPondFormationTracker(16)
    for (let i = 0; i < 5; i += 1) {
      recordPondWallImpacts(tracker, i, POND_EDGE_LEFT, 0, 360, -4, 3, 1000 + i)
    }
    const body = createPondBody(W, H, 0, 5)
    body.vx = -100
    body.vy = 20
    const bounced = resolvePondFormationBounce(tracker, body, 100, config, 1010, W, H)
    assert(bounced === POND_EDGE_LEFT, 'reaching the unique-contact threshold triggers the wall')
    assert(body.vx > 0, 'the body reflects inward off the triggered wall')
    assert(
      tracker.windowStartMs[0] === -1 &&
        tracker.counts[0] === 0 &&
        tracker.speedWeightSums[0] === 0 &&
        tracker.tangentSums[0] === 0,
      'all contact windows and torque sums reset after a formation bounce',
    )
    assert(
      tracker.cooldownUntilMs === 1010 + 600,
      'the global cooldown starts at the trigger time',
    )
    // Cooldown blocks accumulation and retriggering.
    for (let i = 0; i < 8; i += 1) {
      recordPondWallImpacts(tracker, i, POND_EDGE_LEFT, 0, 100, -8, 0, 1200)
    }
    assert(
      tracker.counts[0] === 0 &&
        tracker.windowStartMs[0] === -1 &&
        tracker.speedWeightSums[0] === 0 &&
        tracker.tangentSums[0] === 0,
      'impacts during the cooldown do not accumulate (no torque either)',
    )
    assert(
      resolvePondFormationBounce(tracker, body, 100, config, 1500, W, H) === 0,
      'the cooldown blocks retriggering',
    )
    // After the cooldown, accumulation works again.
    for (let i = 0; i < 5; i += 1) {
      recordPondWallImpacts(tracker, i, POND_EDGE_LEFT, 0, 360, -4, 3, 1700)
    }
    assert(tracker.counts[0] === 5, 'accumulation resumes after the cooldown')
  }

  // Lifecycle reset clears windows, torque accumulators, and the cooldown.
  {
    const tracker = createPondFormationTracker(16)
    recordPondWallImpacts(tracker, 1, POND_EDGE_LEFT, 0, 200, -4, 3, 1000)
    tracker.cooldownUntilMs = 5000
    resetPondFormationTracker(tracker)
    assert(
      tracker.windowStartMs[0] === -1 &&
        tracker.counts[0] === 0 &&
        tracker.cooldownUntilMs < 0 &&
        tracker.speedWeightSums[0] === 0 &&
        tracker.tangentSums[0] === 0 &&
        tracker.normalSpeedSums[0] === 0,
      'reset clears every window, the torque sums, and the cooldown',
    )
  }
}

// (21) formation body bounce: per-wall rebound physics, corner, and
// deterministic opposing-wall resolution
{
  const base = {
    cruiseSpeed: 60,
    formationBounceRestitution: 1,
    formationMinInwardSpeedRatio: 0.5,
  }
  const config = pondWith(base)

  // Per-wall inward sign, tangential retention, heading alignment, wander kept.
  {
    const body = createPondBody(W, H, 0, 5)
    body.vx = -100
    body.vy = 20
    body.wanderPhase = 1.23
    bouncePondBodyOffWalls(body, POND_EDGE_LEFT, config)
    assert(body.vx === 100 && body.vy === 20, 'left bounce: inward sign, tangential preserved')
    assert(
      body.heading === Math.atan2(20, 100),
      'the heading aligns with the resulting travel vector',
    )
    assert(body.wanderPhase === 1.23, 'the wander phase survives the bounce')
  }
  {
    const body = createPondBody(W, H, 0, 5)
    body.vx = 80
    bouncePondBodyOffWalls(body, POND_EDGE_RIGHT, config)
    assert(body.vx === -80, 'right bounce reflects vx inward')
  }
  {
    const body = createPondBody(W, H, 0, 5)
    body.vy = -50
    bouncePondBodyOffWalls(body, POND_EDGE_TOP, config)
    assert(body.vy === 50, 'top bounce reflects vy inward')
  }
  {
    const body = createPondBody(W, H, 0, 5)
    body.vy = 40
    bouncePondBodyOffWalls(body, POND_EDGE_BOTTOM, config)
    assert(body.vy === -40, 'bottom bounce reflects vy inward')
  }

  // Restitution and the min inward kick: max(|incoming| × restitution,
  // cruiseSpeed × ratio).
  {
    const halfConfig = pondWith({ ...base, formationBounceRestitution: 0.5 })
    const body = createPondBody(W, H, 0, 5)
    body.vx = -100
    bouncePondBodyOffWalls(body, POND_EDGE_LEFT, halfConfig)
    assert(body.vx === 50, 'restitution scales the incoming normal speed')
  }
  {
    const body = createPondBody(W, H, 0, 5)
    body.vx = -10
    bouncePondBodyOffWalls(body, POND_EDGE_LEFT, config)
    assert(body.vx === 30, 'the min inward kick floors a slow bounce at cruise × ratio')
  }

  // The max-speed safety clamp still applies.
  {
    const hotConfig = pondWith({ ...base, formationBounceRestitution: 2 })
    const body = createPondBody(W, H, 0, 5)
    body.vx = -5000
    body.vy = 0
    bouncePondBodyOffWalls(body, POND_EDGE_LEFT, hotConfig)
    const maxSpeed = resolvePondMaxSpeed(hotConfig)
    assert(
      Math.abs(Math.sqrt(body.vx * body.vx + body.vy * body.vy) - maxSpeed) < EPS &&
        body.vx > 0,
      'the bounce respects the body max-speed clamp',
    )
  }

  // A wall never reflects an already-inward body on that axis.
  {
    const body = createPondBody(W, H, 0, 5)
    body.vx = 50
    body.vy = 10
    bouncePondBodyOffWalls(body, POND_EDGE_LEFT, config)
    assert(body.vx === 50 && body.vy === 10, 'no reflection when the body already moves inward')
  }

  // Corner: adjacent walls reflect both axes in one bounce.
  {
    const tracker = createPondFormationTracker(32)
    for (let i = 0; i < 3; i += 1) {
      recordPondWallImpacts(tracker, i, POND_EDGE_LEFT, 0, 360, -90, 0, 1000)
    }
    for (let i = 3; i < 6; i += 1) {
      recordPondWallImpacts(tracker, i, POND_EDGE_TOP, 640, 0, 0, -70, 1000)
    }
    const cornerConfig = pondWith({ ...base, formationContactThresholdPercent: 3 })
    const body = createPondBody(W, H, 0, 5)
    body.vx = -90
    body.vy = -70
    const bounced = resolvePondFormationBounce(tracker, body, 100, cornerConfig, 1010, W, H)
    assert(
      bounced === (POND_EDGE_LEFT | POND_EDGE_TOP) && body.vx > 0 && body.vy > 0,
      'adjacent walls triggering together bounce as a corner (both axes)',
    )
  }

  // Opposing walls: more contacts wins.
  {
    const tracker = createPondFormationTracker(32)
    for (let i = 0; i < 3; i += 1) {
      recordPondWallImpacts(tracker, i, POND_EDGE_LEFT, 0, 360, -10, 0, 1000)
    }
    for (let i = 3; i < 8; i += 1) {
      recordPondWallImpacts(tracker, i, POND_EDGE_RIGHT, W, 360, 10, 0, 1000)
    }
    const oppConfig = pondWith({ ...base, formationContactThresholdPercent: 1 })
    const body = createPondBody(W, H, 0, 5)
    body.vx = 10
    const bounced = resolvePondFormationBounce(tracker, body, 100, oppConfig, 1010, W, H)
    assert(
      bounced === POND_EDGE_RIGHT && body.vx < 0,
      'opposing walls: the wall with more contacts wins',
    )
  }
  // Opposing walls tie: body velocity direction breaks it.
  {
    const tie = (vx, heading) => {
      const tracker = createPondFormationTracker(32)
      for (let i = 0; i < 3; i += 1) {
        recordPondWallImpacts(tracker, i, POND_EDGE_LEFT, 0, 360, -10, 0, 1000)
      }
      for (let i = 3; i < 6; i += 1) {
        recordPondWallImpacts(tracker, i, POND_EDGE_RIGHT, W, 360, 10, 0, 1000)
      }
      const tieConfig = pondWith({ ...base, formationContactThresholdPercent: 1 })
      const body = createPondBody(W, H, heading, 5)
      body.vx = vx
      body.vy = 0
      return resolvePondFormationBounce(tracker, body, 100, tieConfig, 1010, W, H)
    }
    assert(tie(-10, 0) === POND_EDGE_LEFT, 'opposing tie: velocity direction picks the wall')
    assert(tie(10, Math.PI) === POND_EDGE_RIGHT, 'opposing tie: velocity direction picks the wall')
    assert(tie(0, Math.PI) === POND_EDGE_LEFT, 'opposing tie at zero velocity: heading decides')
    assert(tie(0, 0) === POND_EDGE_RIGHT, 'opposing tie at zero velocity: heading decides')
  }
}

// (22) impact torque geometry: lever arm around the body, per-wall signs,
// impact-strength scaling, corner combination, final clamp
{
  const config = pondWith({ boundaryFullBounceImpactSpeed: 8 })
  // The body rests at the viewport center for these geometry checks.
  const torqueOf = (wallMask, records) => {
    const tracker = createPondFormationTracker(16)
    records.forEach((r, i) => {
      recordPondWallImpacts(tracker, i, r.mask, r.x, r.y, r.vx, r.vy, 1000)
    })
    const body = createPondBody(W, H, 0, 5)
    return resolvePondFormationTorque(tracker, wallMask, body, W, H, config)
  }

  // Vertical walls: contact above vs below the body → opposite spin.
  const leftAbove = torqueOf(POND_EDGE_LEFT, [{ mask: POND_EDGE_LEFT, x: 0, y: H * 0.25, vx: -8, vy: 0 }])
  const leftBelow = torqueOf(POND_EDGE_LEFT, [{ mask: POND_EDGE_LEFT, x: 0, y: H * 0.75, vx: -8, vy: 0 }])
  assert(
    Math.abs(leftAbove - 0.5) < EPS && Math.abs(leftBelow + 0.5) < EPS,
    'left wall: above-center spins one way, below-center the opposite',
  )
  const rightAbove = torqueOf(POND_EDGE_RIGHT, [{ mask: POND_EDGE_RIGHT, x: W, y: H * 0.25, vx: 8, vy: 0 }])
  assert(
    Math.abs(rightAbove + 0.5) < EPS && Math.abs(rightAbove + leftAbove) < EPS,
    'right wall mirrors the left wall sign',
  )

  // Horizontal walls: contact left vs right of the body → opposite spin.
  const topLeft = torqueOf(POND_EDGE_TOP, [{ mask: POND_EDGE_TOP, x: W * 0.25, y: 0, vx: 0, vy: -8 }])
  const topRight = torqueOf(POND_EDGE_TOP, [{ mask: POND_EDGE_TOP, x: W * 0.75, y: 0, vx: 0, vy: -8 }])
  assert(
    Math.abs(topLeft + 0.5) < EPS && Math.abs(topRight - 0.5) < EPS,
    'top wall: left-of-center spins one way, right-of-center the opposite',
  )
  const bottomRight = torqueOf(POND_EDGE_BOTTOM, [{ mask: POND_EDGE_BOTTOM, x: W * 0.75, y: H, vx: 0, vy: 8 }])
  assert(
    Math.abs(bottomRight + 0.5) < EPS && Math.abs(bottomRight + topRight) < EPS,
    'bottom wall mirrors the top wall sign',
  )

  // Centered / symmetric contacts → ~zero torque.
  const centered = torqueOf(POND_EDGE_LEFT, [{ mask: POND_EDGE_LEFT, x: 0, y: H * 0.5, vx: -8, vy: 0 }])
  const symmetric = torqueOf(POND_EDGE_LEFT, [
    { mask: POND_EDGE_LEFT, x: 0, y: H * 0.25, vx: -8, vy: 0 },
    { mask: POND_EDGE_LEFT, x: 0, y: H * 0.75, vx: -8, vy: 0 },
  ])
  assert(
    Math.abs(centered) < EPS && Math.abs(symmetric) < EPS,
    'centered and symmetric impacts produce zero torque',
  )

  // Impact strength scales with the average incoming normal speed and
  // saturates at the full-bounce impact speed.
  const halfImpact = torqueOf(POND_EDGE_LEFT, [{ mask: POND_EDGE_LEFT, x: 0, y: H * 0.25, vx: -4, vy: 0 }])
  const overImpact = torqueOf(POND_EDGE_LEFT, [{ mask: POND_EDGE_LEFT, x: 0, y: H * 0.25, vx: -16, vy: 0 }])
  assert(
    Math.abs(halfImpact - 0.25) < EPS,
    'half the full-impact speed halves the torque',
  )
  assert(
    Math.abs(overImpact - 0.5) < EPS && Math.abs(overImpact - leftAbove) < EPS,
    'beyond the full-impact speed the torque saturates',
  )

  // Corner combination sums contributions; the final torque clamps to ±1.
  const corner = torqueOf(POND_EDGE_LEFT | POND_EDGE_TOP, [
    { mask: POND_EDGE_LEFT, x: 0, y: H * 0.25, vx: -8, vy: 0 },
    { mask: POND_EDGE_TOP, x: W * 0.75, y: 0, vx: 0, vy: -8 },
  ])
  assert(Math.abs(corner - 1) < EPS, 'corner contributions sum (+0.5 + +0.5)')
  const clamped = torqueOf(POND_EDGE_LEFT | POND_EDGE_TOP, [
    { mask: POND_EDGE_LEFT, x: 0, y: 0, vx: -8, vy: 0 },
    { mask: POND_EDGE_TOP, x: W, y: 0, vx: 0, vy: -8 },
  ])
  assert(clamped === 1, 'the combined torque clamps to +1')
}

// (23) torque impulses: accumulate, reverse, respect the max, and honor the
// zero-strength / zero-max disables and the below-threshold/cooldown gates
{
  const config = pondWith({
    cruiseSpeed: 60,
    formationContactThresholdPercent: 1,
    formationBounceCooldownMs: 0,
    formationAngularImpulseStrength: 3.5,
    formationMaxAngularSpeed: 5,
  })
  const triggerLeft = (body, contactY, cfg) => {
    const tracker = createPondFormationTracker(16)
    recordPondWallImpacts(tracker, 0, POND_EDGE_LEFT, 0, contactY, -8, 0, 1000)
    return resolvePondFormationBounce(tracker, body, 100, cfg || config, 1010, W, H)
  }

  const body = createPondBody(W, H, 0, 5)
  body.vx = -50
  assert(
    triggerLeft(body, H * 0.25) === POND_EDGE_LEFT &&
      Math.abs(body.angularVelocity - 1.75) < EPS,
    'an off-center trigger applies torque × impulse strength (0.5 × 3.5)',
  )
  triggerLeft(body, H * 0.25)
  assert(Math.abs(body.angularVelocity - 3.5) < EPS, 'torque impulses accumulate')
  triggerLeft(body, H * 0.75)
  assert(
    Math.abs(body.angularVelocity - 1.75) < EPS,
    'an opposed impact subtracts from (reverses) the spin',
  )
  body.angularVelocity = 4.9
  triggerLeft(body, H * 0.25)
  assert(body.angularVelocity === 5, 'impulses respect the max spin speed')

  const zeroStrength = pondWith({ ...config, formationAngularImpulseStrength: 0 })
  const bodyZero = createPondBody(W, H, 0, 5)
  bodyZero.vx = -50
  triggerLeft(bodyZero, H * 0.25, zeroStrength)
  assert(bodyZero.angularVelocity === 0, 'zero impulse strength disables new rotational impulses')

  const zeroMax = pondWith({ ...config, formationMaxAngularSpeed: 0 })
  const bodyZeroMax = createPondBody(W, H, 0, 5)
  bodyZeroMax.vx = -50
  triggerLeft(bodyZeroMax, H * 0.25, zeroMax)
  assert(bodyZeroMax.angularVelocity === 0, 'zero max spin speed disables new rotational impulses')

  // Below-threshold accumulation (individual rebounds only) adds no torque.
  const highThreshold = pondWith({ ...config, formationContactThresholdPercent: 50 })
  const trackerLow = createPondFormationTracker(16)
  for (let i = 0; i < 3; i += 1) {
    recordPondWallImpacts(trackerLow, i, POND_EDGE_LEFT, 0, H * 0.25, -8, 0, 1000)
  }
  const bodyLow = createPondBody(W, H, 0, 5)
  bodyLow.vx = -50
  assert(
    resolvePondFormationBounce(trackerLow, bodyLow, 100, highThreshold, 1010, W, H) === 0 &&
      bodyLow.angularVelocity === 0,
    'below-threshold contacts never apply torque',
  )

  // During the cooldown, fresh impacts add no torque.
  const cooldownConfig = pondWith({ ...config, formationBounceCooldownMs: 600 })
  const trackerCd = createPondFormationTracker(16)
  recordPondWallImpacts(trackerCd, 0, POND_EDGE_LEFT, 0, H * 0.25, -8, 0, 1000)
  const bodyCd = createPondBody(W, H, 0, 5)
  bodyCd.vx = -50
  resolvePondFormationBounce(trackerCd, bodyCd, 100, cooldownConfig, 1010, W, H)
  const afterFirst = bodyCd.angularVelocity
  for (let i = 0; i < 6; i += 1) {
    recordPondWallImpacts(trackerCd, i, POND_EDGE_LEFT, 0, H * 0.75, -8, 0, 1200)
  }
  assert(
    resolvePondFormationBounce(trackerCd, bodyCd, 100, cooldownConfig, 1300, W, H) === 0 &&
      bodyCd.angularVelocity === afterFirst,
    'cooldown impacts add no torque',
  )
}

// (24) spin integration: half-life drag, wrap, snap, cap, freeze, and the
// field keeping its spun orientation
{
  const spinConfig = pondWith({
    cruiseSpeed: 0,
    wanderStrength: 0,
    formationSpinHalfLifeMs: 1000,
    formationMaxAngularSpeed: 10,
  })

  // Half-life halving + wrapped integration.
  const body = createPondBody(W, H, 0, 5)
  body.angularVelocity = 4
  for (let s = 0; s < 60; s += 1) stepPondBody(body, stepParams(spinConfig, W, H), 1 / 60)
  assert(
    Math.abs(body.angularVelocity - 2) < 1e-6,
    'angular velocity halves after one half-life',
  )
  assert(
    Math.abs(body.spinAngle) <= Math.PI + EPS,
    'the spin angle stays wrapped into [-PI, PI]',
  )

  // Drag settles the velocity to zero but never springs the angle back.
  for (let s = 0; s < 60 * 30; s += 1) stepPondBody(body, stepParams(spinConfig, W, H), 1 / 60)
  assert(body.angularVelocity === 0, 'drag snaps negligible angular velocity to zero')
  assert(
    Math.abs(body.spinAngle) > 0.3,
    'the field keeps the orientation it spun into (drag is not a spring)',
  )

  // A frozen step (paint gesture) holds the spin exactly.
  const frozen = createPondBody(W, H, 0, 5)
  frozen.angularVelocity = 3
  frozen.spinAngle = 1
  for (let s = 0; s < 60; s += 1) {
    stepPondBody(frozen, stepParams(spinConfig, W, H, null, true), 1 / 60)
  }
  assert(
    frozen.spinAngle === 1 && frozen.angularVelocity === 3,
    'a frozen step holds the spin angle and angular velocity exactly',
  )

  // The max spin cap applies inside the step.
  const capped = createPondBody(W, H, 0, 5)
  capped.angularVelocity = 20
  stepPondBody(capped, stepParams(pondWith({ ...spinConfig, formationMaxAngularSpeed: 5 }), W, H), 1 / 60)
  assert(capped.angularVelocity === 5, 'the step clamps angular velocity to the max spin')

  // Long spin run: finite and wrapped.
  const spinner = createPondBody(W, H, 0, 5)
  spinner.angularVelocity = 9
  let spinOk = true
  for (let s = 0; s < 20000; s += 1) {
    stepPondBody(spinner, stepParams(spinConfig, W, H), 1 / 60)
    if (!Number.isFinite(spinner.spinAngle) || !Number.isFinite(spinner.angularVelocity) ||
        Math.abs(spinner.spinAngle) > Math.PI + EPS ||
        Math.abs(spinner.angularVelocity) > 10 + EPS) spinOk = false
  }
  assert(spinOk, 'a 20000-step spin run stays finite, wrapped, and capped')
}

// (25) transform composition: spin for every source (fixed orientation,
// heading never composes), rigid invariants preserved
{
  // Every source — creatures included: angle = spinAngle alone.
  const drift = resolvePondTransform(
    { x: W * 0.5, y: H * 0.5, heading: 0, spinAngle: 0.4 },
    W,
    H,
  )
  assert(drift.angle === 0.4, 'a source rotates by the spin angle alone')

  const composed = resolvePondTransform(
    { x: W * 0.5, y: H * 0.5, heading: 2.9, spinAngle: 0.4 },
    W,
    H,
  )
  assert(
    composed.angle === 0.4,
    'a swimming heading never composes into the angle (creatures keep their fixed orientation)',
  )

  // Rigid transforms with spin still preserve pairwise distances.
  const count = 256
  const fieldX = new Float32Array(count)
  const fieldY = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    fieldX[i] = W * 0.5 + ((i * 41) % 180) - 90
    fieldY[i] = H * 0.5 + ((i * 67) % 140) - 70
  }
  const beforeX = Float64Array.from(fieldX)
  const beforeY = Float64Array.from(fieldY)
  applyPondTransform(fieldX, fieldY, count, {
    angle: 0.9,
    anchorPx: W * 0.5,
    anchorPy: H * 0.5,
    translateX: -30,
    translateY: 45,
  })
  let rigidOk = true
  for (let i = 0; i < 100; i += 1) {
    const j = (i * 3 + 1) % count
    const bLen = Math.hypot(beforeX[j] - beforeX[i], beforeY[j] - beforeY[i])
    if (bLen < 1) continue
    const aLen = Math.hypot(fieldX[j] - fieldX[i], fieldY[j] - fieldY[i])
    if (Math.abs(aLen - bLen) / bLen > 1e-3) rigidOk = false
  }
  assert(rigidOk, 'spun rigid transforms still preserve pairwise distances')
}

// (26) no-contact / null-body safety
{
  const tracker = createPondFormationTracker(16)
  const body = createPondBody(W, H, 0, 5)
  const config = pondWith({ formationContactThresholdPercent: 1 })
  assert(
    resolvePondFormationTorque(tracker, POND_EDGE_LEFT, body, W, H, config) === 0,
    'no accumulated contacts resolve to zero torque',
  )
  assert(
    resolvePondFormationBounce(tracker, null, 100, config, 1000, W, H) === 0,
    'a missing body never triggers a formation bounce',
  )
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll pond verifications passed.')
