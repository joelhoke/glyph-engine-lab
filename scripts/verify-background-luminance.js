#!/usr/bin/env node
/**
 * Deterministic verification for the fixed landing glyph gradient
 * (pre-release): engine/backgroundLuminance.ts.
 *
 * Checks: the gradient is exactly #0C5E7D → #3B9EC8, applied horizontally
 * (left-to-right) over the field's normX coordinates with linear midpoint
 * interpolation and per-target alpha preservation, and the API is
 * luminance-independent — the module exposes no background-luminance
 * selection anymore.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-background-luminance')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'backgroundLuminance.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const gradientModule = require(path.join(tmpDir, 'backgroundLuminance.js'))
const { applyHorizontalGlyphGradient, LANDING_GLYPH_GRADIENT, LANDING_GLYPH_GRADIENT_THEMES } = gradientModule
const { packSourceRgba, unpackSourceA, unpackSourceB, unpackSourceG, unpackSourceR } = require(
  path.join(tmpDir, 'targetSampling.js'),
)

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- the gradient is fixed to the exact landing pair ----------------------------

assert(
  LANDING_GLYPH_GRADIENT.from === '#0C5E7D' && LANDING_GLYPH_GRADIENT.to === '#3B9EC8',
  'the landing glyph gradient is exactly #0C5E7D → #3B9EC8',
)

// --- the gradient is unified across themes (feature/light-dark) ------------------

assert(
  LANDING_GLYPH_GRADIENT_THEMES.dark === LANDING_GLYPH_GRADIENT,
  'the dark theme uses the shared landing gradient',
)
assert(
  LANDING_GLYPH_GRADIENT_THEMES.light === LANDING_GLYPH_GRADIENT,
  'the light theme uses the same landing gradient as dark',
)
assert(
  LANDING_GLYPH_GRADIENT_THEMES.light.from === '#0C5E7D' &&
    LANDING_GLYPH_GRADIENT_THEMES.light.to === '#3B9EC8',
  'the light landing glyph gradient is exactly #0C5E7D → #3B9EC8',
)

// --- luminance-independence: no conditional selection survives -------------------

assert(
  typeof gradientModule.resolveLandingGlyphGradient === 'undefined' &&
    typeof gradientModule.computeRelativeLuminance === 'undefined' &&
    typeof gradientModule.LANDING_GRADIENT_DARK === 'undefined' &&
    typeof gradientModule.LANDING_GRADIENT_LIGHT === 'undefined' &&
    typeof gradientModule.applyVerticalGlyphGradient === 'undefined',
  'no luminance-conditional or vertical-gradient API remains',
)

// --- horizontal gradient recolor ---------------------------------------------------

{
  const colors = new Uint32Array([
    packSourceRgba(255, 255, 255, 255),
    packSourceRgba(255, 255, 255, 128),
    packSourceRgba(255, 255, 255, 255),
    packSourceRgba(255, 255, 255, 255),
    packSourceRgba(255, 255, 255, 255),
  ])
  const normX = new Float32Array([0, 1, 0.5, -0.25, 1.25])
  applyHorizontalGlyphGradient(
    colors,
    normX,
    LANDING_GLYPH_GRADIENT.from,
    LANDING_GLYPH_GRADIENT.to,
  )

  const parse = (hex) => {
    const value = parseInt(hex.replace('#', ''), 16)
    return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
  }
  const from = parse(LANDING_GLYPH_GRADIENT.from)
  const to = parse(LANDING_GLYPH_GRADIENT.to)

  assert(
    unpackSourceR(colors[0]) === from.r &&
      unpackSourceG(colors[0]) === from.g &&
      unpackSourceB(colors[0]) === from.b,
    'the left edge of the field takes the from color',
  )
  assert(
    unpackSourceR(colors[1]) === to.r &&
      unpackSourceG(colors[1]) === to.g &&
      unpackSourceB(colors[1]) === to.b,
    'the right edge of the field takes the to color',
  )
  assert(unpackSourceA(colors[1]) === 128, 'per-target alpha is preserved')
  const mid = {
    r: Math.round((from.r + to.r) / 2),
    g: Math.round((from.g + to.g) / 2),
    b: Math.round((from.b + to.b) / 2),
  }
  assert(
    Math.abs(unpackSourceR(colors[2]) - mid.r) <= 1 &&
      Math.abs(unpackSourceG(colors[2]) - mid.g) <= 1 &&
      Math.abs(unpackSourceB(colors[2]) - mid.b) <= 1,
    'the horizontal midpoint interpolates linearly',
  )
  assert(
    unpackSourceR(colors[3]) === from.r && unpackSourceR(colors[4]) === to.r,
    'out-of-range normX clamps to the endpoints',
  )
}

// --- the same pair applies regardless of the background ---------------------------

{
  // Recolor identical fields "behind" two very different backgrounds: the
  // function takes no background input at all, so identical inputs must
  // recolor identically. (Guards against a background parameter sneaking
  // back into the application path.)
  const make = () =>
    new Uint32Array([
      packSourceRgba(10, 20, 30, 255),
      packSourceRgba(200, 210, 220, 200),
    ])
  const normX = new Float32Array([0.2, 0.8])
  const a = make()
  const b = make()
  applyHorizontalGlyphGradient(a, normX, LANDING_GLYPH_GRADIENT.from, LANDING_GLYPH_GRADIENT.to)
  applyHorizontalGlyphGradient(b, normX, LANDING_GLYPH_GRADIENT.from, LANDING_GLYPH_GRADIENT.to)
  assert(
    a[0] === b[0] && a[1] === b[1],
    'the recolor depends only on normX and the fixed pair (no background input)',
  )
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll fixed landing-gradient verifications passed.')
