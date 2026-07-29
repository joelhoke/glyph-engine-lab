#!/usr/bin/env node
/**
 * Deterministic verification for the background-luminance glyph gradient
 * (Stage 3): engine/backgroundLuminance.ts.
 *
 * Checks: the sRGB relative-luminance computation, the dark/light gradient
 * pair selection at and around the threshold boundary, and the vertical
 * gradient recolor of a sampled target field (endpoints, midpoint, and
 * per-target alpha preservation).
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

const {
  applyVerticalGlyphGradient,
  computeRelativeLuminance,
  LANDING_GRADIENT_DARK,
  LANDING_GRADIENT_LIGHT,
  LANDING_LUMINANCE_THRESHOLD,
  resolveLandingGlyphGradient,
} = require(path.join(tmpDir, 'backgroundLuminance.js'))
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

// --- luminance computation ----------------------------------------------------

assert(computeRelativeLuminance('#000000') === 0, 'black has zero luminance')
assert(
  Math.abs(computeRelativeLuminance('#ffffff') - 1) < 1e-9,
  'white has unit luminance',
)
assert(
  computeRelativeLuminance('#00ff00') > computeRelativeLuminance('#ff0000') &&
    computeRelativeLuminance('#ff0000') > computeRelativeLuminance('#0000ff'),
  'luminance weights green above red above blue (Rec. 709)',
)
assert(
  computeRelativeLuminance('not-a-color') === 0,
  'malformed input resolves to 0 (treated as dark)',
)

// --- gradient selection ---------------------------------------------------------

{
  const dark = resolveLandingGlyphGradient('#0a0a0a', '#12121a')
  assert(
    dark.from === LANDING_GRADIENT_DARK.from && dark.to === LANDING_GRADIENT_DARK.to,
    'dark background → the dark pair (#8FE3F5 → #2F9BC4)',
  )
  const light = resolveLandingGlyphGradient('#eae2dc', '#f2e6d8')
  assert(
    light.from === LANDING_GRADIENT_LIGHT.from && light.to === LANDING_GRADIENT_LIGHT.to,
    'light background → the light pair (#0C5E7D → #3B9EC8)',
  )
}

// threshold boundary: sweeping grays across the threshold must flip the pair
// exactly when the mean luminance crosses it.
{
  let sawDark = false
  let sawLight = false
  let consistent = true
  for (let gray = 0; gray <= 255; gray += 1) {
    const hex = `#${gray.toString(16).padStart(2, '0').repeat(3)}`
    const luminance = computeRelativeLuminance(hex)
    const pair = resolveLandingGlyphGradient(hex, hex)
    const expectLight = luminance >= LANDING_LUMINANCE_THRESHOLD
    if (expectLight) sawLight = true
    else sawDark = true
    const gotLight = pair.from === LANDING_GRADIENT_LIGHT.from
    if (gotLight !== expectLight) {
      consistent = false
      console.error(`  boundary mismatch at ${hex} (luminance ${luminance.toFixed(4)})`)
    }
  }
  assert(consistent, 'selection flips exactly at the luminance threshold across all grays')
  assert(sawDark && sawLight, 'the gray sweep exercises both sides of the threshold')
}

// --- vertical gradient recolor ----------------------------------------------------

{
  const colors = new Uint32Array([
    packSourceRgba(255, 255, 255, 255),
    packSourceRgba(255, 255, 255, 128),
    packSourceRgba(255, 255, 255, 255),
  ])
  const normY = new Float32Array([0, 1, 0.5])
  applyVerticalGlyphGradient(
    colors,
    normY,
    LANDING_GRADIENT_DARK.from,
    LANDING_GRADIENT_DARK.to,
  )

  const parse = (hex) => {
    const value = parseInt(hex.replace('#', ''), 16)
    return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
  }
  const from = parse(LANDING_GRADIENT_DARK.from)
  const to = parse(LANDING_GRADIENT_DARK.to)

  assert(
    unpackSourceR(colors[0]) === from.r &&
      unpackSourceG(colors[0]) === from.g &&
      unpackSourceB(colors[0]) === from.b,
    'the top of the field takes the from color',
  )
  assert(
    unpackSourceR(colors[1]) === to.r &&
      unpackSourceG(colors[1]) === to.g &&
      unpackSourceB(colors[1]) === to.b,
    'the bottom of the field takes the to color',
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
    'the midpoint interpolates linearly',
  )
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll background-luminance verifications passed.')
