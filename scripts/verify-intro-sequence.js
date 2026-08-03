#!/usr/bin/env node
/**
 * Deterministic verification for engine/introSequence.ts.
 *
 * Compiles the TypeScript source to a temporary CommonJS module and asserts
 * the documented boundary semantics of the landing sequence:
 *
 *   logo-scale (900ms) → logo-hold (2000ms) → options-entering (900ms,
 *   120ms stagger) → complete
 *
 * Also asserts the structural removals that came with the sequence swap:
 * no tagline machinery in the engine, no tagline copy in app/components,
 * and no components/Intro.tsx. This script is intended as a focused sanity
 * check until a unit-test framework is introduced.
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

const {
  evaluateIntroSequence,
  getPhaseStartTime,
  getPrimaryActionProgresses,
  getStaggeredItemProgress,
  getTotalDuration,
  portfolioIntroPreset,
} = require(path.join(tmpDir, 'introSequence.js'))

const timing = {
  logoScaleDuration: 900,
  logoHoldDuration: 2000,
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

// --- preset shape ------------------------------------------------------------

const presetTimingKeys = Object.keys(portfolioIntroPreset.timing).sort()
assert(
  presetTimingKeys.length === 4 &&
    presetTimingKeys.join(',') ===
      ['logoHoldDuration', 'logoScaleDuration', 'optionStagger', 'optionsTransitionDuration']
        .sort()
        .join(','),
  'IntroTiming preset has exactly the four landing keys',
)
assert(
  portfolioIntroPreset.timing.logoScaleDuration === 900 &&
    portfolioIntroPreset.timing.logoHoldDuration === 2000 &&
    portfolioIntroPreset.timing.optionsTransitionDuration === 900 &&
    portfolioIntroPreset.timing.optionStagger === 120,
  'preset carries the launch timing (900 / 2000 / 900 / 120)',
)

// --- exact phase boundaries ----------------------------------------------------

// Time zero
let s = evaluateIntroSequence(0, timing)
assert(s.phase === 'logo-scale', 'time zero is logo-scale')
assert(s.elapsedMs === 0, 'time zero elapsed is 0')
assert(s.phaseProgress === 0, 'time zero progress is 0')
assert(s.logoScale === 0, 'logo scale is 0 at t=0')
assert(!s.optionsVisible && !s.optionsReady, 'time zero options hidden and inert')

// Negative elapsed behaves as zero
s = evaluateIntroSequence(-1000, timing)
assert(s.phase === 'logo-scale' && s.elapsedMs === 0, 'negative elapsed clamps to 0')
assert(s.logoScale === 0, 'negative elapsed keeps logo scale 0')

// Interior of logo-scale
s = evaluateIntroSequence(450, timing)
assert(s.phase === 'logo-scale', 'interior logo-scale')
assert(approx(s.phaseProgress, 0.5), 'logo-scale progress at midpoint')
assert(approx(s.logoScale, 0.5), 'logo scale 0.5 at midpoint')

// Exact boundary: logo-scale end / logo-hold start
s = evaluateIntroSequence(900, timing)
assert(s.phase === 'logo-hold', 'exact 900ms boundary belongs to logo-hold')
assert(s.logoScale === 1, 'logo scale is 1 from logo-hold on')

// Interior of logo-hold
s = evaluateIntroSequence(2000, timing)
assert(s.phase === 'logo-hold', 'interior logo-hold')
assert(s.phaseProgress === 0, 'logo-hold progress is 0')
assert(s.logoScale === 1, 'logo scale stays 1 through the hold')
assert(!s.optionsVisible, 'options still hidden during logo-hold')

// Exact boundary: logo-hold end / options-entering start
s = evaluateIntroSequence(2900, timing)
assert(s.phase === 'options-entering', 'exact 2900ms boundary belongs to options-entering')
assert(s.optionsVisible && !s.optionsReady, 'options visible but not ready at 2900ms')
assert(s.optionsProgress === 0, 'options progress 0 at options-entering start')

// Interior of options-entering
s = evaluateIntroSequence(3350, timing)
assert(s.phase === 'options-entering', 'interior options-entering')
assert(approx(s.optionsProgress, 0.5), 'options progress at midpoint')
assert(s.optionsVisible && !s.optionsReady, 'options entering: visible but not ready')
assert(s.logoScale === 1, 'logo scale stays 1 through options-entering')

// Complete boundary
s = evaluateIntroSequence(3800, timing)
assert(s.phase === 'complete', 'exact 3800ms boundary is complete')
assert(s.optionsReady, 'options ready at complete')
assert(s.optionsProgress === 1, 'options progress capped at 1')
assert(s.logoScale === 1, 'logo scale is 1 at complete')

// Beyond completion remains stable
s = evaluateIntroSequence(10000, timing)
assert(s.phase === 'complete', 'beyond completion remains complete')
assert(s.elapsedMs === 10000, 'elapsed beyond completion is preserved')

// logoScale monotonicity across the whole sequence
let previousScale = -1
let monotonic = true
for (let t = 0; t <= 4200; t += 25) {
  const scale = evaluateIntroSequence(t, timing).logoScale
  if (scale < previousScale) monotonic = false
  previousScale = scale
}
assert(monotonic, 'logoScale is monotonically non-decreasing across the sequence')

// Reduced-motion equivalent: elapsed at or beyond the total duration lands
// completed, with the logo fully scaled and the choices usable.
s = evaluateIntroSequence(getTotalDuration(timing), timing)
assert(
  s.phase === 'complete' && s.logoScale === 1 && s.optionsReady,
  'elapsed >= total duration is complete with logoScale 1 and optionsReady',
)

// Zero-duration phases are skipped deterministically
const zeroTiming = {
  logoScaleDuration: 0,
  logoHoldDuration: 0,
  optionsTransitionDuration: 0,
  optionStagger: 0,
}
s = evaluateIntroSequence(0, zeroTiming)
assert(s.phase === 'complete', 'zero durations collapse to complete at time 0')
assert(s.logoScale === 1, 'zero durations keep logo scale 1')

// Phase-start calculations
assert(getPhaseStartTime('logo-scale', timing) === 0, 'logo-scale start')
assert(getPhaseStartTime('logo-hold', timing) === 900, 'logo-hold start')
assert(getPhaseStartTime('options-entering', timing) === 2900, 'options-entering start')
assert(getPhaseStartTime('complete', timing) === 3800, 'complete start')

// Total duration
assert(getTotalDuration(timing) === 3800, 'total duration')

// --- stagger math (unchanged) --------------------------------------------------

const stagger = getStaggeredItemProgress
const optionDuration = timing.optionsTransitionDuration
const staggerMs = timing.optionStagger
const itemCount = 3

assert(
  stagger({ phaseElapsedMs: 0, groupDurationMs: optionDuration, staggerMs, itemIndex: 0, itemCount }).progress === 0,
  'stagger: first item at group start',
)
assert(
  stagger({ phaseElapsedMs: staggerMs * 0.5, groupDurationMs: optionDuration, staggerMs, itemIndex: 1, itemCount }).progress === 0,
  'stagger: later item before its stagger start',
)
assert(
  stagger({ phaseElapsedMs: staggerMs, groupDurationMs: optionDuration, staggerMs, itemIndex: 1, itemCount }).progress === 0,
  'stagger: item at exact stagger start',
)
assert(
  stagger({ phaseElapsedMs: staggerMs + optionDuration / 3, groupDurationMs: optionDuration, staggerMs, itemIndex: 1, itemCount }).progress > 0 && stagger({ phaseElapsedMs: staggerMs + optionDuration / 3, groupDurationMs: optionDuration, staggerMs, itemIndex: 1, itemCount }).progress < 1,
  'stagger: later item interior is between 0 and 1',
)
assert(
  stagger({ phaseElapsedMs: optionDuration, groupDurationMs: optionDuration, staggerMs, itemIndex: 2, itemCount }).progress === 1,
  'stagger: all items complete at group completion',
)
assert(
  stagger({ phaseElapsedMs: 0, groupDurationMs: optionDuration, staggerMs, itemIndex: 0, itemCount: 1 }).progress === 0,
  'stagger: one item at start',
)
assert(
  stagger({ phaseElapsedMs: optionDuration, groupDurationMs: optionDuration, staggerMs, itemIndex: 0, itemCount: 1 }).progress === 1,
  'stagger: one item at completion',
)
assert(
  stagger({ phaseElapsedMs: 100, groupDurationMs: optionDuration, staggerMs: 0, itemIndex: 1, itemCount }).progress === stagger({ phaseElapsedMs: 100, groupDurationMs: optionDuration, staggerMs: 0, itemIndex: 0, itemCount }).progress,
  'stagger: zero stagger aligns all items',
)
const excessiveStagger = stagger({
  phaseElapsedMs: staggerMs,
  groupDurationMs: staggerMs * (itemCount - 1) + 5,
  staggerMs: staggerMs * 10,
  itemIndex: 1,
  itemCount,
})
assert(excessiveStagger.progress === 0, 'stagger: excessive stagger clamps without crash')
assert(excessiveStagger.itemDurationMs > 0, 'stagger: excessive stagger retains positive item duration')
const zeroDuration = stagger({ phaseElapsedMs: 0, groupDurationMs: 0, staggerMs, itemIndex: 0, itemCount })
assert(zeroDuration.progress === 0, 'stagger: zero group duration returns 0')
assert(!Number.isNaN(zeroDuration.progress) && Number.isFinite(zeroDuration.progress), 'stagger: zero group duration is finite')
const negativeElapsed = stagger({ phaseElapsedMs: -50, groupDurationMs: optionDuration, staggerMs, itemIndex: 0, itemCount })
assert(negativeElapsed.progress === 0, 'stagger: negative elapsed clamps to 0')
assert(!Number.isNaN(negativeElapsed.progress) && Number.isFinite(negativeElapsed.progress), 'stagger: negative elapsed is finite')

// Primary action progress helper
function allEqual(arr, value) {
  return arr.every((x) => x === value)
}

function allFinite(arr) {
  return arr.every((x) => Number.isFinite(x) && !Number.isNaN(x))
}

function allInRange(arr) {
  return arr.every((x) => x >= 0 && x <= 1)
}

// Before options-entering: all zero
let actionProgresses = getPrimaryActionProgresses(
  evaluateIntroSequence(getPhaseStartTime('logo-hold', timing), timing),
  itemCount,
  timing,
)
assert(actionProgresses.length === itemCount, 'progress: returns one value per action')
assert(allEqual(actionProgresses, 0), 'progress: all zero before options-entering')
assert(allFinite(actionProgresses), 'progress: finite before options-entering')
assert(allInRange(actionProgresses), 'progress: clamped before options-entering')

// At options-entering start: all zero
actionProgresses = getPrimaryActionProgresses(
  evaluateIntroSequence(getPhaseStartTime('options-entering', timing), timing),
  itemCount,
  timing,
)
assert(allEqual(actionProgresses, 0), 'progress: all zero at options-entering start')

// Interior of options-entering: staggered values
actionProgresses = getPrimaryActionProgresses(
  evaluateIntroSequence(3350, timing),
  itemCount,
  timing,
)
assert(
  actionProgresses[0] > actionProgresses[1] && actionProgresses[1] > actionProgresses[2],
  'progress: stagger order Work > Vibes > Make Something during options-entering',
)
assert(
  actionProgresses.every((p) => p > 0 && p < 1),
  'progress: all actions interior is between 0 and 1',
)
assert(allFinite(actionProgresses), 'progress: finite during options-entering')
assert(allInRange(actionProgresses), 'progress: clamped during options-entering')

// Exact options completion boundary: all one
actionProgresses = getPrimaryActionProgresses(
  evaluateIntroSequence(3800, timing),
  itemCount,
  timing,
)
assert(allEqual(actionProgresses, 1), 'progress: all one at exact options completion')

// Complete phase start: all one
actionProgresses = getPrimaryActionProgresses(
  evaluateIntroSequence(getPhaseStartTime('complete', timing), timing),
  itemCount,
  timing,
)
assert(allEqual(actionProgresses, 1), 'progress: all one at complete phase start')

// Elapsed beyond completion: all one
actionProgresses = getPrimaryActionProgresses(
  evaluateIntroSequence(10000, timing),
  itemCount,
  timing,
)
assert(allEqual(actionProgresses, 1), 'progress: all one beyond completion')
assert(allFinite(actionProgresses), 'progress: finite beyond completion')

// --- structural removals ---------------------------------------------------------

const engineSource = fs.readFileSync(sourceFile, 'utf8')
assert(!/tagline/i.test(engineSource), 'engine/introSequence.ts contains no tagline machinery')

function collectFiles(dir, extensions) {
  const results = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('._') || entry.name === 'node_modules' || entry.name === '.next') {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(full)
    }
  }
  return results
}

const appComponentFiles = [
  ...collectFiles(path.join(projectRoot, 'app'), ['.ts', '.tsx', '.css']),
  ...collectFiles(path.join(projectRoot, 'components'), ['.ts', '.tsx', '.css']),
]
const taglineCopyFiles = appComponentFiles.filter((file) =>
  fs.readFileSync(file, 'utf8').includes("This isn't a portfolio"),
)
assert(
  taglineCopyFiles.length === 0,
  `no "This isn't a portfolio" copy in app/components${taglineCopyFiles.length ? ` (found: ${taglineCopyFiles.join(', ')})` : ''}`,
)

assert(
  !fs.existsSync(path.join(projectRoot, 'components', 'Intro.tsx')),
  'components/Intro.tsx no longer exists',
)
const introImportFiles = appComponentFiles.filter((file) =>
  /from\s+['"][^'"]*\/Intro['"]|from\s+['"]\.\/Intro['"]/.test(fs.readFileSync(file, 'utf8')),
)
assert(
  introImportFiles.length === 0,
  `components/Intro.tsx is no longer imported${introImportFiles.length ? ` (found: ${introImportFiles.join(', ')})` : ''}`,
)

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true })

if (failures > 0) {
  console.error(`\n${failures} verification failure(s)`)
  process.exit(1)
}

console.log('\nAll intro-sequence verifications passed.')
