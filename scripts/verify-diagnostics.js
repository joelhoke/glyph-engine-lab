#!/usr/bin/env node
/**
 * Deterministic verification for engine/diagnostics.ts.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'diagnostics.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-diagnostics')

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
  createDefaultDiagnosticsSnapshot,
  createFrameTimingAccumulator,
  DIAGNOSTICS_PUSH_INTERVAL_MS,
  FRAME_TIMING_WINDOW_SIZE,
  GLYPH_INIT_SEED,
} = require(path.join(tmpDir, 'diagnostics.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function closeTo(actual, expected, epsilon = 1e-6) {
  return Math.abs(actual - expected) <= epsilon
}

// --- Rolling frame-timing accumulator ---

// empty state: all zeros, no NaN
{
  const acc = createFrameTimingAccumulator()
  const s = acc.summary()
  assert(
    s.fps === 0 && s.avgFrameMs === 0 && s.worstFrameMs === 0 && s.framesInWindow === 0,
    'empty accumulator reports zeros',
  )
}

// known sequence: avg, worst, count, fps over the timestamp span
{
  const acc = createFrameTimingAccumulator()
  acc.record(10, 1000)
  acc.record(20, 1016.7)
  acc.record(30, 1033.4)
  const s = acc.summary()
  assert(closeTo(s.avgFrameMs, 20), 'avg is the mean of recorded frame times')
  assert(s.worstFrameMs === 30, 'worst is the max recorded frame time')
  assert(s.framesInWindow === 3, 'framesInWindow tracks recorded samples')
  assert(closeTo(s.fps, ((3 - 1) / (1033.4 - 1000)) * 1000, 1e-9), 'fps derives from timestamp span')
}

// a single sample cannot yield an fps estimate
{
  const acc = createFrameTimingAccumulator()
  acc.record(16, 500)
  const s = acc.summary()
  assert(s.fps === 0 && s.framesInWindow === 1 && s.avgFrameMs === 16, 'single sample: fps 0, avg set')
}

// window eviction: capacity holds, old samples leave the average
{
  const acc = createFrameTimingAccumulator(3)
  acc.record(10, 0)
  acc.record(20, 10)
  acc.record(30, 20)
  acc.record(5, 30) // evicts 10
  let s = acc.summary()
  assert(s.framesInWindow === 3, 'window never exceeds its capacity')
  assert(closeTo(s.avgFrameMs, (20 + 30 + 5) / 3), 'evicted sample leaves the running average')
  assert(s.worstFrameMs === 30, 'worst survives eviction of smaller samples')
  assert(closeTo(s.fps, ((3 - 1) / (30 - 10)) * 1000, 1e-9), 'fps span uses oldest/newest in window')

  acc.record(1, 40) // evicts 20
  acc.record(1, 50) // evicts 30, the sample holding the worst time
  s = acc.summary()
  assert(s.worstFrameMs === 5, 'worst is rescanned when the worst sample is evicted')
  assert(closeTo(s.avgFrameMs, (5 + 1 + 1) / 3), 'average tracks the remaining window')
  assert(closeTo(s.fps, ((3 - 1) / (50 - 30)) * 1000, 1e-9), 'fps span advances with eviction')
}

// reset returns the accumulator to the empty state
{
  const acc = createFrameTimingAccumulator(4)
  acc.record(8, 0)
  acc.record(12, 16)
  acc.reset()
  const s = acc.summary()
  assert(
    s.fps === 0 && s.avgFrameMs === 0 && s.worstFrameMs === 0 && s.framesInWindow === 0,
    'reset restores the empty state',
  )
  acc.record(4, 100)
  assert(acc.summary().framesInWindow === 1, 'accumulator is reusable after reset')
}

assert(FRAME_TIMING_WINDOW_SIZE >= 30, 'default window holds a meaningful sample count')

// --- Snapshot defaults ---

{
  const snap = createDefaultDiagnosticsSnapshot()
  const expectedKeys = [
    'experience', 'sceneId', 'mode',
    'sourceId', 'sourceKind', 'sourceStatus', 'sourceError', 'sourceDecodeMs', 'targetRebuildCount',
    'targetCount', 'glyphCount', 'assignedCount', 'unassignedCount', 'visibleCount', 'hiddenCount',
    'fps', 'avgFrameMs', 'worstFrameMs', 'framesInWindow',
    'viewportWidth', 'viewportHeight', 'devicePixelRatio', 'reducedMotion',
    'pointerType', 'pointerActive', 'pointerX', 'pointerY',
    'impulseCount', 'lastImpulseAffected',
    'motionMode', 'motionVariant',
    'motionRequestedDensity', 'motionEffectiveDensity',
    'motionRequestedUpdateRate', 'motionEffectiveUpdateRate',
    'paintedTargetCount', 'paintedBackgroundStrokeCount',
    'seed', 'simParams',
  ]
  assert(
    expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(snap, key)),
    'default snapshot carries the full field set',
  )
  assert(snap.experience === 'intro' && snap.sceneId === 'intro' && snap.mode === 'svg', 'identity defaults')
  assert(
    snap.sourceId === 'none' && snap.sourceKind === 'builtin' && snap.sourceStatus === 'idle' &&
    snap.sourceError === null && snap.sourceDecodeMs === null && snap.targetRebuildCount === 0,
    'source lifecycle defaults',
  )
  assert(
    snap.targetCount === 0 && snap.glyphCount === 0 && snap.assignedCount === 0 &&
    snap.unassignedCount === 0 && snap.visibleCount === 0 && snap.hiddenCount === 0,
    'count defaults are zero',
  )
  assert(
    snap.fps === 0 && snap.avgFrameMs === 0 && snap.worstFrameMs === 0 && snap.framesInWindow === 0,
    'frame timing defaults are zero',
  )
  assert(
    snap.viewportWidth === 0 && snap.viewportHeight === 0 && snap.devicePixelRatio === 1 &&
    snap.reducedMotion === false,
    'environment defaults',
  )
  assert(
    snap.pointerType === 'none' && snap.pointerActive === false && snap.pointerX === 0 && snap.pointerY === 0,
    'pointer defaults',
  )
  assert(
    snap.impulseCount === 0 && snap.lastImpulseAffected === 0,
    'impulse defaults are zero',
  )
  assert(snap.motionMode === 'off', 'motion mode defaults to off')
  assert(snap.motionVariant === 'original', 'motion variant defaults to original')
  assert(
    snap.motionRequestedDensity === 0 && snap.motionEffectiveDensity === 0,
    'motion density defaults are zero',
  )
  assert(
    snap.motionRequestedUpdateRate === 0 && snap.motionEffectiveUpdateRate === 0,
    'motion update-rate defaults are zero',
  )
  assert(snap.paintedTargetCount === 0, 'painted target count defaults to zero')
  assert(snap.paintedBackgroundStrokeCount === 0, 'painted background stroke count defaults to zero')
  assert(snap.seed === GLYPH_INIT_SEED, 'snapshot seed matches GLYPH_INIT_SEED')
  assert(
    snap.simParams && ['spring', 'damp', 'mouseR', 'particleRepel', 'weatherRepelMult']
      .every((key) => typeof snap.simParams[key] === 'number'),
    'simParams carries the core simulation parameters',
  )
  const again = createDefaultDiagnosticsSnapshot()
  assert(
    JSON.stringify(again) === JSON.stringify(snap),
    'default snapshot factory is deterministic',
  )
}

// --- Throttle interval: 4-10Hz (100-250ms) ---

assert(
  DIAGNOSTICS_PUSH_INTERVAL_MS >= 100 && DIAGNOSTICS_PUSH_INTERVAL_MS <= 250,
  `push interval ${DIAGNOSTICS_PUSH_INTERVAL_MS}ms is within 4-10Hz`,
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll diagnostics verifications passed.')
