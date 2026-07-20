#!/usr/bin/env node
/**
 * Deterministic verification for engine/introSequence.ts.
 *
 * Compiles the TypeScript source to a temporary CommonJS module and asserts
 * the documented boundary semantics. This script is intended as a focused
 * sanity check until a unit-test framework is introduced.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'introSequence.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify')

// Compile the pure evaluator to a temporary CommonJS module.
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

const { evaluateIntroSequence, getPhaseStartTime, getTotalDuration } = require(
  path.join(tmpDir, 'introSequence.js'),
)

const timing = {
  logoFormDuration: 900,
  logoHoldDuration: 2000,
  taglineTransitionDuration: 900,
  taglineHoldDuration: 1500,
  optionsTransitionDuration: 900,
  optionStagger: 120,
}

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function approx(a, b, tolerance = 0.0001) {
  return Math.abs(a - b) <= tolerance
}

// Time zero
let s = evaluateIntroSequence(0, timing)
assert(s.phase === 'logo-forming', 'time zero is logo-forming')
assert(s.elapsedMs === 0, 'time zero elapsed is 0')
assert(s.phaseProgress === 0, 'time zero progress is 0')
assert(s.logoVisible && !s.taglineVisible && !s.optionsVisible, 'time zero visibility')

// Negative elapsed behaves as zero
s = evaluateIntroSequence(-1000, timing)
assert(s.phase === 'logo-forming' && s.elapsedMs === 0, 'negative elapsed clamps to 0')

// Interior of logo-forming
s = evaluateIntroSequence(450, timing)
assert(s.phase === 'logo-forming', 'interior logo-forming')
assert(approx(s.phaseProgress, 0.5), 'logo-forming progress at midpoint')

// Exact boundary: logo-forming end / logo-hold start
s = evaluateIntroSequence(900, timing)
assert(s.phase === 'logo-hold', 'exact 900ms boundary belongs to logo-hold')

// Interior of logo-hold
s = evaluateIntroSequence(1500, timing)
assert(s.phase === 'logo-hold', 'interior logo-hold')
assert(s.phaseProgress === 0, 'logo-hold progress is 0')

// Exact boundary: logo-hold end / tagline-entering start
s = evaluateIntroSequence(2900, timing)
assert(s.phase === 'tagline-entering', 'exact 2900ms boundary belongs to tagline-entering')

// Interior of tagline-entering
s = evaluateIntroSequence(3350, timing)
assert(s.phase === 'tagline-entering', 'interior tagline-entering')
assert(approx(s.taglineProgress, 0.5), 'tagline progress at midpoint')
assert(s.taglineVisible && !s.optionsVisible, 'tagline entering visibility')

// Exact boundary: tagline-entering end / tagline-hold start
s = evaluateIntroSequence(3800, timing)
assert(s.phase === 'tagline-hold', 'exact 3800ms boundary belongs to tagline-hold')

// Interior of tagline-hold
s = evaluateIntroSequence(4550, timing)
assert(s.phase === 'tagline-hold', 'interior tagline-hold')
assert(s.taglineProgress === 1, 'tagline-hold progress is 1')

// Exact boundary: tagline-hold end / options-entering start
s = evaluateIntroSequence(5300, timing)
assert(s.phase === 'options-entering', 'exact 5300ms boundary belongs to options-entering')

// Interior of options-entering
s = evaluateIntroSequence(5750, timing)
assert(s.phase === 'options-entering', 'interior options-entering')
assert(approx(s.optionsProgress, 0.5), 'options progress at midpoint')
assert(s.optionsVisible && !s.optionsReady, 'options entering: visible but not ready')

// Complete boundary
s = evaluateIntroSequence(6200, timing)
assert(s.phase === 'complete', 'exact 6200ms boundary is complete')
assert(s.optionsReady, 'options ready at complete')
assert(s.optionsProgress === 1, 'options progress capped at 1')

// Beyond completion remains stable
s = evaluateIntroSequence(10000, timing)
assert(s.phase === 'complete', 'beyond completion remains complete')
assert(s.elapsedMs === 10000, 'elapsed beyond completion is preserved')

// Zero-duration phases are skipped deterministically
const zeroTiming = {
  logoFormDuration: 0,
  logoHoldDuration: 0,
  taglineTransitionDuration: 0,
  taglineHoldDuration: 0,
  optionsTransitionDuration: 0,
  optionStagger: 0,
}
s = evaluateIntroSequence(0, zeroTiming)
assert(s.phase === 'complete', 'zero durations collapse to complete at time 0')

// Phase-start calculations
assert(getPhaseStartTime('logo-forming', timing) === 0, 'logo-forming start')
assert(getPhaseStartTime('logo-hold', timing) === 900, 'logo-hold start')
assert(getPhaseStartTime('tagline-entering', timing) === 2900, 'tagline-entering start')
assert(getPhaseStartTime('tagline-hold', timing) === 3800, 'tagline-hold start')
assert(getPhaseStartTime('options-entering', timing) === 5300, 'options-entering start')
assert(getPhaseStartTime('complete', timing) === 6200, 'complete start')

// Total duration
assert(getTotalDuration(timing) === 6200, 'total duration')

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true })

if (failures > 0) {
  console.error(`\n${failures} verification failure(s)`)
  process.exit(1)
}

console.log('\nAll intro-sequence verifications passed.')
