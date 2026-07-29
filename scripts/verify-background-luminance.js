#!/usr/bin/env node
/**
 * Deterministic verification for the fixed landing glyph gradient (Stage 3):
 * engine/backgroundLuminance.ts and its production wiring.
 *
 * Checks: the approved fixed pair on every background, vertical recoloring
 * (endpoints, midpoint, and alpha preservation), and the production landing's
 * source-colors mode / first-frame atmosphere wiring.
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
  LANDING_GLYPH_GRADIENT,
  LANDING_GRADIENT_DARK,
  LANDING_GRADIENT_LIGHT,
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

// --- fixed gradient selection --------------------------------------------------

{
  const dark = resolveLandingGlyphGradient('#0a0a0a', '#12121a')
  assert(
    dark.from === '#0C5E7D' && dark.to === '#3B9EC8',
    'dark background keeps the approved pair (#0C5E7D → #3B9EC8)',
  )
  const light = resolveLandingGlyphGradient('#eae2dc', '#f2e6d8')
  assert(
    light.from === '#0C5E7D' && light.to === '#3B9EC8',
    'light background keeps the same approved pair',
  )
  assert(
    LANDING_GRADIENT_DARK === LANDING_GLYPH_GRADIENT &&
      LANDING_GRADIENT_LIGHT === LANDING_GLYPH_GRADIENT,
    'legacy pair exports alias the approved fixed gradient',
  )
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

// --- production wiring ---------------------------------------------------------

{
  const portfolioSource = fs.readFileSync(
    path.join(projectRoot, 'components', 'PortfolioExperience.tsx'),
    'utf8',
  )
  const sceneSource = fs.readFileSync(
    path.join(projectRoot, 'components', 'SceneCanvas.tsx'),
    'utf8',
  )
  assert(
    portfolioSource.includes("glyphColorMode: 'source-colors'"),
    'the landing renders sampled source colors instead of the ROYGBV palette',
  )
  assert(
    portfolioSource.includes('useState<AmbientConfig>(resolveInitialLandingAtmosphere)'),
    'the seasonal atmosphere is resolved during initial state creation',
  )
  assert(
    !portfolioSource.includes('landingAtmosphereStartedRef') &&
      !portfolioSource.includes('setLandingAmbient'),
    'the delayed options-reveal atmosphere ramp is absent',
  )
  assert(
    sceneSource.includes('LANDING_GLYPH_GRADIENT.from') &&
      sceneSource.includes('LANDING_GLYPH_GRADIENT.to'),
    'SceneCanvas applies the approved fixed colors to landing source samples',
  )
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll background-luminance verifications passed.')
