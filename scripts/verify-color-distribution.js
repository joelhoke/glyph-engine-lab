#!/usr/bin/env node
/**
 * Deterministic verification for engine/colorDistribution.ts.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'colorDistribution.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-color-distribution')

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
  clamp,
  parseHexColor,
  sampleImageGradient,
  sampleRowBand,
  buildWordColorIndices,
  buildTargetSpatialData,
  buildTargetSpatialDataFromArrays,
  resolveGlyphColor,
  resolveGlyphAlphaScale,
  formatRgb,
} = require(path.join(tmpDir, 'colorDistribution.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function rgbEqual(a, b, tolerance = 0.0001) {
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance
  )
}

// clamp
assert(clamp(-0.5, 0, 1) === 0, 'clamp below min')
assert(clamp(1.5, 0, 1) === 1, 'clamp above max')
assert(clamp(0.5, 0, 1) === 0.5, 'clamp interior')

// hex parsing
assert(rgbEqual(parseHexColor('#ff0000'), { r: 255, g: 0, b: 0 }), 'parse red hex')
assert(rgbEqual(parseHexColor('#abc'), { r: 170, g: 187, b: 204 }), 'parse short hex')
assert(rgbEqual(parseHexColor('not-a-color'), { r: 255, g: 255, b: 255 }), 'parse invalid hex falls back')

// one-color image gradient is uniform
const red = [{ r: 255, g: 0, b: 0 }]
assert(rgbEqual(sampleImageGradient(red, 0), red[0]), 'one-color gradient at 0')
assert(rgbEqual(sampleImageGradient(red, 0.5), red[0]), 'one-color gradient at 0.5')
assert(rgbEqual(sampleImageGradient(red, 1), red[0]), 'one-color gradient at 1')

// two-color interpolation at 0, 0.5, 1
const blackWhite = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 },
]
assert(rgbEqual(sampleImageGradient(blackWhite, 0), blackWhite[0]), 'two-color at 0')
assert(rgbEqual(sampleImageGradient(blackWhite, 1), blackWhite[1]), 'two-color at 1')
assert(rgbEqual(sampleImageGradient(blackWhite, 0.5), { r: 127.5, g: 127.5, b: 127.5 }), 'two-color midpoint')

// six-color interpolation across stops
const rainbow = [
  { r: 255, g: 0, b: 0 },
  { r: 255, g: 165, b: 0 },
  { r: 255, g: 255, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 75, g: 0, b: 130 },
]
// t=0 -> red, t=1 -> indigo
assert(rgbEqual(sampleImageGradient(rainbow, 0), rainbow[0]), 'rainbow at 0')
assert(rgbEqual(sampleImageGradient(rainbow, 1), rainbow[5]), 'rainbow at 1')
// t=0.2 -> second color (orange) at exact stop
assert(rgbEqual(sampleImageGradient(rainbow, 0.2), rainbow[1]), 'rainbow at first stop')
// t=0.4 -> third color (yellow) at exact stop
assert(rgbEqual(sampleImageGradient(rainbow, 0.4), rainbow[2]), 'rainbow at middle stop')
// t=0.5 -> midpoint between yellow and green
assert(
  rgbEqual(sampleImageGradient(rainbow, 0.5), { r: 127.5, g: 255, b: 0 }),
  'rainbow between middle stops',
)

// glyph-cycle determinism is implicit via modulo; assert palette lookup stable
const palette = ['#ff0000', '#00ff00', '#0000ff']
const cycleIndex = (i) => i % palette.length
assert(cycleIndex(0) === 0, 'glyph-cycle index 0')
assert(cycleIndex(1) === 1, 'glyph-cycle index 1')
assert(cycleIndex(5) === 2, 'glyph-cycle index wraps')

// word grouping with spaces and punctuation
const { indices: wordIndices } = buildWordColorIndices('Hello, world! Test.', 3)
const expected = [
  0, 0, 0, 0, 0, 0,     // Hello, (word 1)
  -1,                   // space
  1, 1, 1, 1, 1, 1,     // world!
  -1,                   // space
  2, 2, 2, 2, 2,        // Test.
]
assert(wordIndices.length === expected.length, `word indices length: ${wordIndices.length} vs ${expected.length}`)
assert(wordIndices.every((v, i) => v === expected[i]), 'word grouping with punctuation')

// repeated word pattern
const { indices: repeated } = buildWordColorIndices('A B A B', 2)
const repeatedExpected = [0, -1, 1, -1, 0, -1, 1]
assert(repeated.every((v, i) => v === repeatedExpected[i]), 'repeated word pattern cycles')

// row assignment at top, middle, bottom
assert(sampleRowBand(3, 0) === 0, 'row top band')
assert(sampleRowBand(3, 0.5) === 1, 'row middle band')
assert(sampleRowBand(3, 0.99) === 2, 'row bottom band')
assert(sampleRowBand(1, 0.5) === 0, 'row one-color band')

// empty palette fallback protection
assert(rgbEqual(sampleImageGradient([], 0.5), { r: 255, g: 255, b: 255 }), 'empty palette gradient fallback')
assert(sampleRowBand(0, 0.5) === 0, 'empty palette row band fallback')

// invalid hex input protection
const invalidRgb = parseHexColor('#zzzzzz')
assert(rgbEqual(invalidRgb, { r: 255, g: 255, b: 255 }), 'invalid hex returns safe fallback')

// target spatial data
const targets = [
  { tx: 0, ty: 0 },
  { tx: 100, ty: 50 },
  { tx: 200, ty: 100 },
]
const { gradientT, rowT } = buildTargetSpatialData(targets)
assert(gradientT[0] === 0, 'gradient leftmost')
assert(gradientT[2] === 1, 'gradient rightmost')
assert(rowT[0] === 0, 'row top')
assert(rowT[2] === 1, 'row bottom')
assert(Math.abs(gradientT[1] - 0.5) < 0.0001, 'gradient middle')
assert(Math.abs(rowT[1] - 0.5) < 0.0001, 'row middle')

// pack helper matching engine/targetSampling RGBA layout
function pack(r, g, b, a) {
  return (((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0
}

// buildTargetSpatialDataFromArrays matches buildTargetSpatialData
const xs = new Float32Array(targets.map((t) => t.tx))
const ys = new Float32Array(targets.map((t) => t.ty))
const fromArrays = buildTargetSpatialDataFromArrays(xs, ys)
assert(fromArrays.gradientT.length === gradientT.length, 'fromArrays gradientT length matches')
assert(
  fromArrays.gradientT.every((v, i) => v === gradientT[i]),
  'fromArrays gradientT matches object form',
)
assert(
  fromArrays.rowT.every((v, i) => v === rowT[i]),
  'fromArrays rowT matches object form',
)

// source-colors mode resolves the packed target color and its alpha
const sourceColors = new Uint32Array([pack(255, 0, 0, 255), pack(0, 255, 0, 200)])
const sourcePalette = [{ r: 9, g: 9, b: 9 }]
const sourceCtx = {
  mode: 'source-colors',
  palette: sourcePalette,
  particleIndex: 0,
  targetIndex: 1,
  targetCount: 2,
  sourceColors,
}
assert(
  rgbEqual(resolveGlyphColor(sourceCtx), { r: 0, g: 255, b: 0 }),
  'source-colors uses packed target color',
)
assert(
  Math.abs(resolveGlyphAlphaScale(sourceCtx) - 200 / 255) < 0.0001,
  'source-colors alpha scale preserves sampled alpha',
)

// paint precedence: painted override wins over source-colors and image-gradient
const painted = new Uint32Array([0, pack(0, 0, 255, 255)])
assert(
  rgbEqual(
    resolveGlyphColor({ ...sourceCtx, paintedColors: painted }),
    { r: 0, g: 0, b: 255 },
  ),
  'paint wins over source-colors',
)
const gradientCtx = {
  mode: 'image-gradient',
  palette: rainbow,
  particleIndex: 0,
  targetIndex: 1,
  targetCount: 3,
  gradientT,
}
assert(
  rgbEqual(
    resolveGlyphColor({ ...gradientCtx, paintedColors: new Uint32Array([0, pack(0, 0, 255, 255), 0]) }),
    { r: 0, g: 0, b: 255 },
  ),
  'paint wins over image-gradient',
)
// erased paint (0) falls back to the base distribution
assert(
  rgbEqual(
    resolveGlyphColor({ ...sourceCtx, paintedColors: new Uint32Array([0, 0]) }),
    { r: 0, g: 255, b: 0 },
  ),
  'erased paint falls back to source-colors',
)
// alpha scale is 1 when painted
assert(
  resolveGlyphAlphaScale({ ...sourceCtx, paintedColors: painted }) === 1,
  'painted alpha scale is opaque',
)

// fallbacks
// resolveGlyphColor takes Rgb palettes (unlike the hex strings above)
const rgbPalette = palette.map(parseHexColor)
// source-colors with no sourceColors array falls back to palette modulo
assert(
  rgbEqual(
    resolveGlyphColor({
      mode: 'source-colors',
      palette: rgbPalette,
      particleIndex: 4,
      targetIndex: 0,
      targetCount: 1,
    }),
    rgbPalette[4 % rgbPalette.length],
  ),
  'source-colors without array falls back to palette modulo',
)
// empty palette returns white
assert(
  rgbEqual(
    resolveGlyphColor({
      mode: 'source-colors',
      palette: [],
      particleIndex: 0,
      targetIndex: 0,
      targetCount: 1,
      sourceColors,
    }),
    { r: 255, g: 255, b: 255 },
  ),
  'empty palette resolves to white',
)
// alpha scale is 1 for non-source-colors modes
assert(resolveGlyphAlphaScale(gradientCtx) === 1, 'image-gradient alpha scale is 1')
assert(
  resolveGlyphAlphaScale({
    mode: 'glyph-cycle',
    palette,
    particleIndex: 0,
    targetIndex: 0,
    targetCount: 1,
  }) === 1,
  'glyph-cycle alpha scale is 1',
)

// existing modes resolve identically through resolveGlyphColor
// image-gradient uses gradientT[targetIndex]
assert(
  rgbEqual(
    resolveGlyphColor({ ...gradientCtx, targetIndex: 2 }),
    sampleImageGradient(rainbow, gradientT[2]),
  ),
  'image-gradient resolves via gradientT',
)
// rows uses rowT bands
const rowsCtx = {
  mode: 'rows',
  palette: rainbow,
  particleIndex: 0,
  targetIndex: 2,
  targetCount: 3,
  rowT,
}
assert(
  rgbEqual(resolveGlyphColor(rowsCtx), rainbow[sampleRowBand(rainbow.length, rowT[2])]),
  'rows bottom target resolves via rowT band',
)
assert(
  rgbEqual(resolveGlyphColor({ ...rowsCtx, targetIndex: 0 }), rainbow[0]),
  'rows top target resolves via rowT band',
)
// word-cycle uses wordColorIndices
const wordCtx = {
  mode: 'word-cycle',
  palette: rgbPalette,
  particleIndex: 4,
  targetIndex: -1,
  targetCount: 0,
  wordColorIndices: [2, 0, 1],
}
assert(
  rgbEqual(resolveGlyphColor(wordCtx), rgbPalette[0]),
  'word-cycle resolves via wordColorIndices',
)
// default (glyph-cycle) falls back to palette modulo
assert(
  rgbEqual(
    resolveGlyphColor({
      mode: 'glyph-cycle',
      palette: rgbPalette,
      particleIndex: 5,
      targetIndex: 0,
      targetCount: 1,
    }),
    rgbPalette[5 % rgbPalette.length],
  ),
  'glyph-cycle falls back to palette modulo',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll color-distribution verifications passed.')
