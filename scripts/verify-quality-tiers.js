#!/usr/bin/env node
/**
 * Deterministic verification for engine/qualityTiers.ts: the full hysteresis
 * state machine (warm-up, 2-second windows, 2-bad-down, 5-good-up, cooldown,
 * ignored windows, debug override), the mobile start tier, min() composition
 * with the existing mobile caps, and stride-subsampling determinism.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'qualityTiers.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-quality-tiers')

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
  QUALITY_TIER_BUDGETS,
  QUALITY_WARMUP_MS,
  QUALITY_WINDOW_MS,
  QUALITY_COOLDOWN_MS,
  createQualityController,
  resolveEffectiveQualityBudget,
  subsampleStrided,
} = require(path.join(tmpDir, 'qualityTiers.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const WARMUP = QUALITY_WARMUP_MS
const WINDOW = QUALITY_WINDOW_MS

// Feed one full 2-second window of frames and report any transition.
// intervalMs 16 → 62.5 fps, 20 → 50 fps, 25 → 40 fps.
function feedWindow(controller, startMs, renderMs, intervalMs, flags = {}) {
  let transition = null
  for (let t = startMs; t <= startMs + WINDOW; t += intervalMs) {
    const result = controller.recordFrame({ timestampMs: t, renderMs, ...flags })
    if (result) transition = result
  }
  return transition
}

// (1) tier budget table matches the documented ladder
assert(QUALITY_TIER_BUDGETS.length === 4, 'four quality tiers')
assert(
  QUALITY_TIER_BUDGETS[0].glyphCap === 0 &&
    QUALITY_TIER_BUDGETS[0].creatureCap === 2400 &&
    QUALITY_TIER_BUDGETS[0].creatureRate === 60 &&
    QUALITY_TIER_BUDGETS[0].ambientCap === 600 &&
    QUALITY_TIER_BUDGETS[0].ambientTickHz === 30 &&
    QUALITY_TIER_BUDGETS[0].samplingHz === 8 &&
    QUALITY_TIER_BUDGETS[0].renderPixelRatioCap === 2 &&
    QUALITY_TIER_BUDGETS[0].backgroundPaintPixelRatio === 2,
  'T0 budget: device glyph budget, 2400/60Hz creature, 600/30Hz ambient, 8Hz sampling, DPR ≤ 2',
)
assert(
  QUALITY_TIER_BUDGETS[1].glyphCap === 2400 &&
    QUALITY_TIER_BUDGETS[1].creatureCap === 1600 &&
    QUALITY_TIER_BUDGETS[1].creatureRate === 30 &&
    QUALITY_TIER_BUDGETS[1].ambientCap === 360 &&
    QUALITY_TIER_BUDGETS[1].ambientTickHz === 30 &&
    QUALITY_TIER_BUDGETS[1].samplingHz === 6,
  'T1 budget: 2400 glyphs, 1600/30Hz creature, 360/30Hz ambient, 6Hz sampling',
)
assert(
  QUALITY_TIER_BUDGETS[2].glyphCap === 1600 &&
    QUALITY_TIER_BUDGETS[2].creatureCap === 1200 &&
    QUALITY_TIER_BUDGETS[2].creatureRate === 30 &&
    QUALITY_TIER_BUDGETS[2].ambientCap === 220 &&
    QUALITY_TIER_BUDGETS[2].ambientTickHz === 20 &&
    QUALITY_TIER_BUDGETS[2].samplingHz === 4 &&
    QUALITY_TIER_BUDGETS[2].backgroundPaintPixelRatio === 1,
  'T2 budget: 1600 glyphs, 1200/30Hz creature, 220/20Hz ambient, 4Hz sampling, bg paint DPR 1',
)
assert(
  QUALITY_TIER_BUDGETS[3].glyphCap === 1000 &&
    QUALITY_TIER_BUDGETS[3].creatureCap === 800 &&
    QUALITY_TIER_BUDGETS[3].creatureRate === 15 &&
    QUALITY_TIER_BUDGETS[3].ambientCap === 100 &&
    QUALITY_TIER_BUDGETS[3].ambientTickHz === 15 &&
    QUALITY_TIER_BUDGETS[3].samplingHz === 0 &&
    QUALITY_TIER_BUDGETS[3].renderPixelRatioCap === 1.5 &&
    QUALITY_TIER_BUDGETS[3].backgroundPaintPixelRatio === 1,
  'T3 budget: 1000 glyphs, 800/15Hz creature, 100/15Hz ambient, static sampling, DPR ≤ 1.5, bg paint DPR 1',
)

// (2) min() composition with the existing mobile caps
assert(
  resolveEffectiveQualityBudget(0, 1280).glyphCap === 0,
  'desktop T0 glyph cap defers to the device budget (0)',
)
assert(
  resolveEffectiveQualityBudget(2, 1280).glyphCap === 1600,
  'desktop T2 glyph cap is 1600',
)
assert(
  resolveEffectiveQualityBudget(0, 500).glyphCap === 1200,
  'mobile T0 glyph cap composes to the 1200 mobile cap',
)
assert(
  resolveEffectiveQualityBudget(1, 500).glyphCap === 1200,
  'mobile T1 glyph cap is min(2400, 1200) = 1200',
)
assert(
  resolveEffectiveQualityBudget(3, 500).glyphCap === 1000,
  'mobile T3 glyph cap is min(1000, 1200) = 1000',
)
assert(
  resolveEffectiveQualityBudget(0, 1280).creatureCap === 2400 &&
    resolveEffectiveQualityBudget(0, 500).creatureCap === 1200,
  'creature cap composes with desktop/mobile density caps',
)

// (3) start tiers
{
  const desktop = createQualityController({ mobile: false, mountMs: 0 })
  assert(desktop.getTier() === 0, 'desktop starts at T0')
  assert(desktop.getLastTransitionReason() === 'initial', 'desktop start reason is initial')
  const mobile = createQualityController({ mobile: true, mountMs: 0 })
  assert(mobile.getTier() === 1, 'mobile starts at T1')
  assert(mobile.getLastTransitionReason() === 'mobile-start', 'mobile start reason is mobile-start')
}

// (4) warm-up: bad frames before the warm-up ends never evaluate
{
  const c = createQualityController({ mobile: false, mountMs: 1000 })
  let transition = null
  for (let t = 0; t < 1000 + QUALITY_WARMUP_MS; t += 20) {
    const r = c.recordFrame({ timestampMs: t, renderMs: 30 })
    if (r) transition = r
  }
  assert(transition === null && c.getTier() === 0, 'frames during warm-up never transition')
  assert(c.getStats().windowActive === false, 'no window accumulates during warm-up')
}

// (5) one bad window does not step down; two consecutive bad windows do
{
  const c = createQualityController({ mobile: false, mountMs: 0 })
  const first = feedWindow(c, WARMUP, 20, 20) // avg render 20 > 18 → bad
  assert(first === null && c.getTier() === 0, 'one bad window does not step down')
  assert(c.getStats().consecutiveBad === 1, 'one bad window recorded')
  const second = feedWindow(c, WARMUP + WINDOW, 20, 20)
  assert(
    second !== null && second.from === 0 && second.to === 1 && second.reason === 'bad-windows',
    'two consecutive bad windows step down with reason bad-windows',
  )
  assert(c.getTier() === 1, 'tier is T1 after stepping down')
}

// (6) the bad-fps variant: fps < 48 while render cost > 12 ms
{
  const c = createQualityController({ mobile: false, mountMs: 0 })
  feedWindow(c, WARMUP, 14, 25) // 40 fps, 14 ms render
  const second = feedWindow(c, WARMUP + WINDOW, 14, 25)
  assert(
    second !== null && second.to === 1,
    'two consecutive low-fps/costly windows step down',
  )
}

// (7) neutral windows break both streaks
{
  const c = createQualityController({ mobile: false, mountMs: 0 })
  feedWindow(c, WARMUP, 20, 20) // bad
  feedWindow(c, WARMUP + WINDOW, 14, 20) // neutral (14 ms @ 50 fps)
  feedWindow(c, WARMUP + 2 * WINDOW, 20, 20) // bad again — streak restarted
  assert(
    c.getTier() === 0 && c.getStats().consecutiveBad === 1,
    'a neutral window resets the bad streak',
  )
}

// (8) cooldown: windows closing during the 5-second cooldown do not evaluate
{
  const c = createQualityController({ mobile: false, mountMs: 0 })
  feedWindow(c, WARMUP, 20, 20)
  const transition = feedWindow(c, WARMUP + WINDOW, 20, 20)
  const at = WARMUP + 2 * WINDOW // transition closed here; cooldown runs to at + 5000
  assert(transition !== null, 'setup: stepped down once')
  feedWindow(c, at, 20, 20) // closes at at+2000 < at+5000 → ignored
  feedWindow(c, at + WINDOW, 20, 20) // closes at at+4000 < at+5000 → ignored
  assert(
    c.getTier() === 1 && c.getStats().consecutiveBad === 0,
    'windows during cooldown do not evaluate',
  )
  feedWindow(c, at + 2 * WINDOW, 20, 20) // closes at at+6000 ≥ cooldown end → counts
  const second = feedWindow(c, at + 3 * WINDOW, 20, 20)
  assert(
    second !== null && second.from === 1 && second.to === 2,
    'after the cooldown, two more bad windows step down again',
  )
}

// (9) ignored windows: hidden, resize, and rebuild flags skip evaluation
{
  for (const flag of ['hidden', 'resized', 'rebuilt']) {
    const c = createQualityController({ mobile: false, mountMs: 0 })
    const transition = feedWindow(c, WARMUP, 30, 20, { [flag]: true })
    assert(
      transition === null && c.getStats().consecutiveBad === 0,
      `a ${flag} window is ignored even when costly`,
    )
  }
  // A window with only one flagged frame is still ignored.
  {
    const c = createQualityController({ mobile: false, mountMs: 0 })
    for (let t = WARMUP; t <= WARMUP + WINDOW; t += 20) {
      c.recordFrame({ timestampMs: t, renderMs: 30, resized: t === WARMUP + 100 })
    }
    assert(
      c.getStats().consecutiveBad === 0,
      'a single resize inside a window ignores the whole window',
    )
  }
}

// (10) five consecutive good windows step up; four do not
{
  const c = createQualityController({ mobile: true, mountMs: 0 })
  assert(c.getTier() === 1, 'setup: mobile starts at T1')
  for (let w = 0; w < 4; w += 1) {
    const transition = feedWindow(c, WARMUP + w * WINDOW, 5, 16) // 5 ms @ 62.5 fps → good
    assert(transition === null, `good window ${w + 1} of 4 does not step up`)
  }
  assert(c.getTier() === 1, 'four good windows do not step up')
  const fifth = feedWindow(c, WARMUP + 4 * WINDOW, 5, 16)
  assert(
    fifth !== null && fifth.from === 1 && fifth.to === 0 && fifth.reason === 'good-windows',
    'five consecutive good windows step up to T0 (mobile may reach T0)',
  )
}

// (11) good windows do not step above T0; bad windows do not step below T3
{
  const c = createQualityController({ mobile: false, mountMs: 0 })
  for (let w = 0; w < 6; w += 1) feedWindow(c, WARMUP + w * WINDOW, 5, 16)
  assert(c.getTier() === 0, 'good windows never step above T0')
}
{
  const c = createQualityController({ mobile: false, mountMs: 0 })
  let at = WARMUP
  let last = null
  for (let steps = 0; steps < 4; steps += 1) {
    last = feedWindow(c, at, 25, 20)
    last = feedWindow(c, at + WINDOW, 25, 20) || last
    at += 2 * WINDOW + QUALITY_COOLDOWN_MS + WINDOW // clear the cooldown
  }
  assert(c.getTier() === 3, 'repeated bad windows bottom out at T3')
  assert(last === null || last.to <= 3, 'no transition past T3')
}

// (12) debug override: forces the tier, suspends evaluation, release resumes
{
  const c = createQualityController({ mobile: false, mountMs: 0 })
  const forced = c.setOverride(3, WARMUP)
  assert(
    forced !== null && forced.to === 3 && forced.reason === 'debug-override',
    'override forces T3 with reason debug-override',
  )
  assert(c.isOverrideActive(), 'override is active')
  const during = feedWindow(c, WARMUP, 5, 16)
  assert(during === null && c.getTier() === 3, 'windows do not evaluate while overridden')
  const released = c.setOverride(null, WARMUP + WINDOW)
  assert(released === null && !c.isOverrideActive(), 'releasing the override emits no transition')
  assert(c.getTier() === 3, 'tier holds after release until windows evaluate')
  const fresh = createQualityController({ mobile: false, mountMs: 0 })
  const clamped = fresh.setOverride(9, WARMUP)
  assert(clamped !== null && clamped.to === 3, 'override values clamp into the tier range')
}

// (13) subsampling determinism
{
  const a = subsampleStrided(100, 40)
  const b = subsampleStrided(100, 40)
  assert(a.length === 40, 'subsample yields exactly cap indices')
  assert(
    JSON.stringify(Array.from(a)) === JSON.stringify(Array.from(b)),
    'stride subsampling is deterministic across calls',
  )
  assert(a[0] === 0 && a[1] === 2 && a[2] === 5, 'stride picks floor(i * stride) (0, 2, 5, …)')
  assert(a[39] === 97, 'last strided index is floor(39 * 2.5) = 97')
  let sorted = true
  let unique = true
  for (let i = 1; i < a.length; i += 1) {
    if (a[i] < a[i - 1]) sorted = false
    if (a[i] === a[i - 1]) unique = false
  }
  assert(sorted && unique, 'strided indices are strictly increasing')
  const identity = subsampleStrided(50, 50)
  assert(
    identity.length === 50 && identity[49] === 49,
    'cap ≥ count returns the identity field',
  )
  const wider = subsampleStrided(50, 200)
  assert(wider.length === 50, 'cap above count still returns the identity field')
  assert(subsampleStrided(100, 0).length === 0, 'cap 0 returns an empty selection')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll quality-tier verifications passed.')
