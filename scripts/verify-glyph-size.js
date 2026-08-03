#!/usr/bin/env node
/**
 * Deterministic verification for the discrete glyph point sizes
 * (engine/glyphSize.ts, wired through engine/playgroundConfig.ts):
 * the clampGlyphPointSize validator (all six sizes valid; off-ladder,
 * non-finite, and garbage inputs clamp correctly), the six select option
 * labels ('N pt'), the 12pt defaults, line-height math
 * (round(size * 1.42) per size), the mobile cap (below 768px non-Vibe scenes
 * cap at 8pt while Vibe honors the explicit selection; 768px and up is
 * uncapped), and the sampling-step scale relative to the 12pt baseline
 * (8 → 2/3, 24 → 2, 48 → 4).
 *
 * Compile TS to tmp-verify-glyph-size, assert in Node — the standard idiom.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-glyph-size')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'glyphSize.ts')}" "${path.join(projectRoot, 'engine', 'playgroundConfig.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  GLYPH_POINT_SIZES,
  GLYPH_BASE_POINT_SIZE,
  MOBILE_GLYPH_POINT_CAP,
  WORK_MOBILE_GLYPH_POINT_CAP,
  DESKTOP_POINT_FLOOR,
  MOBILE_ONLY_POINT_SIZES,
  DESKTOP_POINT_SIZES,
  clampGlyphPointSize,
  clampGlyphPointSizeForViewport,
  resolveSelectableGlyphSizes,
  resolveGlyphLineHeight,
  resolveGlyphSamplingScale,
  resolveEffectiveGlyphSize,
} = require(path.join(tmpDir, 'glyphSize.js'))
const {
  GLYPH_POINT_SIZE_OPTIONS,
  VIBE_DEFAULT_PLAYGROUND,
  APPROVED_PLAYGROUND_DEFAULTS,
} = require(path.join(tmpDir, 'playgroundConfig.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const SIZES = [4, 6, 8, 12, 16, 24, 32, 48]
const DESKTOP_SIZES = [8, 12, 16, 24, 32, 48]

// --- option ladder -----------------------------------------------------------

assert(
  JSON.stringify([...GLYPH_POINT_SIZES]) === JSON.stringify(SIZES),
  'GLYPH_POINT_SIZES is exactly 4, 6, 8, 12, 16, 24, 32, 48',
)
assert(GLYPH_BASE_POINT_SIZE === 12, 'the baseline point size is 12')
assert(MOBILE_GLYPH_POINT_CAP === 8, 'the mobile cap is 8pt')
assert(WORK_MOBILE_GLYPH_POINT_CAP === 4, 'the Work mobile cap is 4pt')
assert(DESKTOP_POINT_FLOOR === 8, 'the desktop floor is 8pt')
assert(
  JSON.stringify([...MOBILE_ONLY_POINT_SIZES]) === JSON.stringify([4, 6]),
  '4pt and 6pt are the mobile-only sizes',
)
assert(
  JSON.stringify([...DESKTOP_POINT_SIZES]) === JSON.stringify(DESKTOP_SIZES),
  'the desktop ladder excludes 4/6pt',
)

// --- validator ---------------------------------------------------------------

for (const size of SIZES) {
  assert(clampGlyphPointSize(size) === size, `valid size ${size} clamps to itself`)
}

const clampCases = [
  [7, 8],
  [9, 8],
  [13, 12],
  [0, 4],
  [-4, 4],
  [100, 48],
  [NaN, 12],
  [Infinity, 12],
  [-Infinity, 12],
  ['garbage', 12],
  [undefined, 12],
  [null, 12],
  [{}, 12],
]
for (const [input, expected] of clampCases) {
  assert(
    clampGlyphPointSize(input) === expected,
    `clampGlyphPointSize(${String(input)}) → ${expected}`,
  )
}

// Viewport-aware clamp: 4/6pt survive only below the 768px breakpoint.
assert(clampGlyphPointSizeForViewport(4, 767) === 4, '4pt survives at 767px')
assert(clampGlyphPointSizeForViewport(6, 320) === 6, '6pt survives at 320px')
assert(clampGlyphPointSizeForViewport(4, 768) === 8, '4pt clamps to 8pt at 768px')
assert(clampGlyphPointSizeForViewport(6, 1440) === 8, '6pt clamps to 8pt at 1440px')
assert(clampGlyphPointSizeForViewport(48, 1440) === 48, 'desktop sizes are untouched by the viewport clamp')

// Selectable ladder: mobile shows the full ladder, desktop hides 4/6pt.
assert(
  JSON.stringify([...resolveSelectableGlyphSizes(320)]) === JSON.stringify(SIZES),
  'mobile select offers the full ladder incl. 4/6pt',
)
assert(
  JSON.stringify([...resolveSelectableGlyphSizes(767)]) === JSON.stringify(SIZES),
  'select offers 4/6pt just below the breakpoint',
)
assert(
  JSON.stringify([...resolveSelectableGlyphSizes(768)]) === JSON.stringify(DESKTOP_SIZES),
  'desktop select hides 4/6pt',
)
assert(
  JSON.stringify([...resolveSelectableGlyphSizes(1440)]) === JSON.stringify(DESKTOP_SIZES),
  'wide select hides 4/6pt',
)

// --- select options ------------------------------------------------------------

assert(
  GLYPH_POINT_SIZE_OPTIONS.length === 8 &&
    GLYPH_POINT_SIZE_OPTIONS.every(
      (option, index) =>
        option.value === SIZES[index] && option.label === `${SIZES[index]} pt`,
    ),
  "GLYPH_POINT_SIZE_OPTIONS is exactly the eight 'N pt' options in order",
)

// --- defaults ------------------------------------------------------------------

assert(
  VIBE_DEFAULT_PLAYGROUND.glyphSizePt === 12,
  'VIBE_DEFAULT_PLAYGROUND.glyphSizePt is 12',
)
assert(
  APPROVED_PLAYGROUND_DEFAULTS.glyphSizePt === 12,
  'APPROVED_PLAYGROUND_DEFAULTS.glyphSizePt is 12',
)

// --- line height ----------------------------------------------------------------

const expectedLineHeights = { 4: 6, 6: 9, 8: 11, 12: 17, 16: 23, 24: 34, 32: 45, 48: 68 }
for (const size of SIZES) {
  assert(
    resolveGlyphLineHeight(size) === expectedLineHeights[size] &&
      resolveGlyphLineHeight(size) === Math.round(size * 1.42),
    `line height for ${size}pt is round(size * 1.42) = ${expectedLineHeights[size]}`,
  )
}

// --- mobile caps + desktop floor --------------------------------------------------

assert(resolveEffectiveGlyphSize(12, 'work', 767) === 4, 'work at 767px caps 12pt → 4pt (dense hero art)')
assert(resolveEffectiveGlyphSize(48, 'work', 500) === 4, 'work at 500px caps 48pt → 4pt')
assert(resolveEffectiveGlyphSize(4, 'work', 767) === 4, 'a 4pt work selection is unchanged by the cap')
assert(resolveEffectiveGlyphSize(12, 'work', 768) === 12, 'work at 768px renders the original 12pt')
assert(resolveEffectiveGlyphSize(48, 'collaborate', 767) === 8, 'collaborate at 767px caps 48pt → 8pt')
assert(resolveEffectiveGlyphSize(16, 'intro', 500) === 8, 'intro at 500px caps 16pt → 8pt')
assert(resolveEffectiveGlyphSize(8, 'collaborate', 767) === 8, 'an 8pt selection is unchanged by the cap')
assert(resolveEffectiveGlyphSize(48, 'vibe', 767) === 48, 'vibe at 767px honors the 48pt selection')
assert(resolveEffectiveGlyphSize(12, 'vibe', 320) === 12, 'vibe at 320px honors the 12pt selection')
assert(resolveEffectiveGlyphSize(4, 'vibe', 320) === 4, 'vibe at 320px honors the 4pt selection')
assert(resolveEffectiveGlyphSize(6, 'vibe', 767) === 6, 'vibe at 767px honors the 6pt selection')
assert(resolveEffectiveGlyphSize(4, 'vibe', 768) === 8, 'a stored 4pt clamps to 8pt at 768px (any scene)')
assert(resolveEffectiveGlyphSize(6, 'work', 1440) === 8, 'a stored 6pt clamps to 8pt on desktop (any scene)')
assert(resolveEffectiveGlyphSize(48, 'work', 768) === 48, 'work at 768px is uncapped (48pt)')
assert(resolveEffectiveGlyphSize(12, 'work', 768) === 12, 'work at 768px keeps 12pt')
assert(resolveEffectiveGlyphSize(24, 'work', 1024) === 24, 'desktop widths are uncapped')
assert(
  resolveEffectiveGlyphSize(24, 'work', 0) === 24,
  'an unknown (0) viewport width is treated as uncapped',
)

// --- sampling scale ----------------------------------------------------------------

const approx = (a, b) => Math.abs(a - b) < 1e-9
assert(approx(resolveGlyphSamplingScale(4), 1 / 3), 'sampling scale for 4pt is 1/3')
assert(approx(resolveGlyphSamplingScale(6), 1 / 2), 'sampling scale for 6pt is 1/2')
assert(approx(resolveGlyphSamplingScale(8), 2 / 3), 'sampling scale for 8pt is 2/3')
assert(approx(resolveGlyphSamplingScale(12), 1), 'sampling scale for 12pt is 1')
assert(approx(resolveGlyphSamplingScale(16), 4 / 3), 'sampling scale for 16pt is 4/3')
assert(approx(resolveGlyphSamplingScale(24), 2), 'sampling scale for 24pt is 2')
assert(approx(resolveGlyphSamplingScale(32), 8 / 3), 'sampling scale for 32pt is 8/3')
assert(approx(resolveGlyphSamplingScale(48), 4), 'sampling scale for 48pt is 4')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll glyph size verifications passed.')
