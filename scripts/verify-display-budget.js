#!/usr/bin/env node
/**
 * Deterministic verification for engine/displayBudget.ts.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'displayBudget.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify')

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
  MAX_DEVICE_PIXEL_RATIO,
  MOBILE_GLYPH_CAP,
  MOBILE_SAMPLING_STEP_FACTOR,
  MOBILE_VIEWPORT_MAX_WIDTH,
  isMobileViewport,
  resolveGlyphBudget,
  resolveRenderPixelRatio,
  resolveSamplingStep,
} = require(path.join(tmpDir, 'displayBudget.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// pixel ratio is capped at the launch maximum
assert(MAX_DEVICE_PIXEL_RATIO === 2, 'pixel ratio cap is 2')
assert(resolveRenderPixelRatio(3) === 2, 'raw ratio 3 is capped to 2')
assert(resolveRenderPixelRatio(2) === 2, 'raw ratio 2 stays 2')
assert(resolveRenderPixelRatio(1.5) === 1.5, 'raw ratio 1.5 passes through')
assert(resolveRenderPixelRatio(1) === 1, 'raw ratio 1 passes through')

// degenerate raw ratios fall back to 1 before capping
assert(resolveRenderPixelRatio(0) === 1, 'raw ratio 0 falls back to 1')
assert(resolveRenderPixelRatio(-2) === 1, 'negative raw ratio falls back to 1')

// mobile breakpoint boundaries
assert(isMobileViewport(MOBILE_VIEWPORT_MAX_WIDTH - 1) === true, 'width below breakpoint is mobile')
assert(isMobileViewport(MOBILE_VIEWPORT_MAX_WIDTH) === false, 'width at breakpoint is not mobile')
assert(isMobileViewport(1440) === false, 'desktop width is not mobile')
assert(isMobileViewport(0) === false, 'unknown width (0) is not treated as mobile')

// sampling step grows on mobile, stays put on desktop
assert(resolveSamplingStep(10, 1440) === 10, 'desktop sampling step unchanged')
assert(resolveSamplingStep(10, 320) === Math.ceil(10 * MOBILE_SAMPLING_STEP_FACTOR), 'mobile sampling step is scaled up')
assert(resolveSamplingStep(3, 320) >= 1, 'mobile sampling step never drops below 1')
assert(resolveSamplingStep(0, 320) >= 1, 'non-positive base step is clamped to at least 1')

// glyph budget caps only on mobile
assert(resolveGlyphBudget(5000, 1440) === 5000, 'desktop glyph count is uncapped')
assert(resolveGlyphBudget(5000, 320) === MOBILE_GLYPH_CAP, 'mobile glyph count is capped')
assert(resolveGlyphBudget(600, 320) === 600, 'mobile count under the cap passes through')
assert(resolveGlyphBudget(-5, 320) === 0, 'negative requested count clamps to 0')
assert(resolveGlyphBudget(250.7, 1440) === 250, 'fractional count is floored')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll display-budget verifications passed.')
