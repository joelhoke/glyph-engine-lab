#!/usr/bin/env node
/**
 * Verification for the phase-4 hero parallax math: components/home/
 * useHeroParallax.ts is compiled standalone (no browser — the hook's React
 * imports resolve but are never called) and the pure helpers are asserted:
 * normalizePointer clamping, the easing step (alpha cap, convergence, settle
 * snap), the depth map, and the disable-condition truth table.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-hero-parallax')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc components/home/useHeroParallax.ts components/home/handMotion.ts --outDir "${tmpDir}" --module commonjs --target es2020 --jsx react-jsx --strict false --esModuleInterop true --moduleResolution node`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  HERO_DEPTH_PX,
  HERO_PARALLAX_MIN_VIEWPORT_PX,
  normalizePointer,
  stepParallaxValue,
  isHeroParallaxActive,
} = require(path.join(tmpDir, 'components', 'home', 'useHeroParallax.js'))

let failures = 0
function assert(condition, message) {
  if (condition) console.log(`PASS: ${message}`)
  else {
    console.error(`FAIL: ${message}`)
    failures += 1
  }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

// --- normalizePointer ---------------------------------------------------------
{
  const bounds = { left: 100, top: 200, width: 400, height: 200 }
  const center = normalizePointer(300, 300, bounds)
  assert(near(center.x, 0) && near(center.y, 0), 'center normalizes to 0,0')
  const edge = normalizePointer(500, 400, bounds)
  assert(near(edge.x, 1) && near(edge.y, 1), 'bottom-right edge normalizes to 1,1')
  const outside = normalizePointer(5000, -5000, bounds)
  assert(near(outside.x, 1) && near(outside.y, -1), 'out-of-bounds pointers clamp to ±1')
  const degenerate = normalizePointer(0, 0, { left: 0, top: 0, width: 0, height: 0 })
  assert(near(degenerate.x, 0) && near(degenerate.y, 0), 'degenerate bounds normalize to 0,0')
}

// --- Depth map -----------------------------------------------------------------
{
  assert(
    HERO_DEPTH_PX.portrait === 6 &&
      HERO_DEPTH_PX.work === 20 &&
      HERO_DEPTH_PX.vibe === 14 &&
      HERO_DEPTH_PX.intro === 12 &&
      HERO_DEPTH_PX.gallery === 14 &&
      HERO_DEPTH_PX.collaborate === 20,
    'depth map: portrait 6, work 20, vibe 14, intro 12, gallery 14, collaborate 20',
  )
  assert(HERO_PARALLAX_MIN_VIEWPORT_PX === 768, 'parallax disabled below 768px viewport')
  // Depth application: offset = -normalized × depth (layers drift against
  // the pointer); the outer slots outtravel the portrait.
  assert(
    HERO_DEPTH_PX.work > HERO_DEPTH_PX.portrait &&
      HERO_DEPTH_PX.collaborate > HERO_DEPTH_PX.intro,
    'fan slots outtravel the portrait',
  )
}

// --- Easing step -----------------------------------------------------------------
{
  // alpha = 1 - exp(-min(deltaMs, 64) / 120)
  const alpha16 = 1 - Math.exp(-16 / 120)
  const next = stepParallaxValue(0, 1, 16)
  assert(near(next, alpha16), 'one 16ms step applies alpha = 1 - exp(-16/120)')
  const capped = stepParallaxValue(0, 1, 10000)
  const alphaCap = 1 - Math.exp(-64 / 120)
  assert(near(capped, alphaCap), 'deltaMs caps at 64 (stalled frame never jumps)')
  // Convergence with snap: from 0 toward 1 at 16ms steps settles exactly.
  let current = 0
  let steps = 0
  while (current !== 1 && steps < 1000) {
    current = stepParallaxValue(current, 1, 16)
    steps += 1
  }
  assert(current === 1 && steps < 500, `easing converges and snaps to target (${steps} steps)`)
  const still = stepParallaxValue(1, 1, 16)
  assert(still === 1, 'a settled value stays exactly settled')
}

// Original desktop sprite motion and mobile/reduced-motion gates.
{
  const { handPose, handIsFlexed, stepHandMotion } = require(path.join(tmpDir, 'components/home/handMotion.js'))
  const center = { x: 300, y: 400 }, gaze = { x: 0.5, y: -0.2 }
  assert(HERO_DEPTH_PX['hand-left'] === 20 && HERO_DEPTH_PX['hand-right'] === 14,
    'desktop hands retain their established cursor parallax')
  const idle = handPose(null, center, gaze, 100, -1)
  assert(idle.x === 0 && idle.y === 0 && idle.tilt === 0, 'no pointer returns sprite to rest')
  const near = handPose({ x: 290, y: 400 }, center, gaze, 100, -1)
  assert(near.x !== 0 && near.y !== 0 && near.tilt !== 0, 'desktop retains drift, proximity response and tilt')
  assert(handIsFlexed({ x: 350, y: 400 }, center, 100, false), 'nearby cursor flexes the hand')
  assert(handIsFlexed({ x: 370, y: 400 }, center, 100, true) &&
    !handIsFlexed({ x: 370, y: 400 }, center, 100, false), 'flex hysteresis prevents rapid pose flicker')
  assert(!handIsFlexed(null, center, 100, true), 'idle and disabled states use open hands')
  let current = 0, monotonic = true
  for (let frame = 0; frame < 200; frame++) {
    const next = stepHandMotion(current, 45, 16)
    monotonic = monotonic && next >= current && next <= 45
    current = next
  }
  assert(monotonic && current === 45, 'hand interpolation settles without spring overshoot')
}

// --- Disable-condition truth table ----------------------------------------------
{
  const base = {
    enabled: true,
    fineHoverPointer: true,
    reducedMotion: false,
    viewportWidth: 1280,
  }
  assert(isHeroParallaxActive(base), 'active when enabled + fine/hover + motion + ≥768px')
  assert(!isHeroParallaxActive({ ...base, enabled: false }), 'disabled by the shell gate')
  assert(!isHeroParallaxActive({ ...base, fineHoverPointer: false }), 'disabled on coarse/no-hover pointer')
  assert(!isHeroParallaxActive({ ...base, reducedMotion: true }), 'disabled under reduced motion')
  assert(!isHeroParallaxActive({ ...base, viewportWidth: 767 }), 'disabled below 768px')
  assert(isHeroParallaxActive({ ...base, viewportWidth: 768 }), 'active at exactly 768px')
}

console.log(
  failures === 0 ? '\nAll hero-parallax verifications passed.' : `\n${failures} check(s) failed.`,
)
process.exit(failures === 0 ? 0 : 1)
