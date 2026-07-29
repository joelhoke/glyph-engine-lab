#!/usr/bin/env node
/**
 * Deterministic verification for engine/targetSampling.ts.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'targetSampling.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-target-sampling')

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
  packSourceRgba,
  unpackSourceR,
  unpackSourceG,
  unpackSourceB,
  unpackSourceA,
  sampleTargetField,
} = require(path.join(tmpDir, 'targetSampling.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function makePixels(width, height, entries) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (const { px, py, r, g, b, a } of entries) {
    const offset = (py * width + px) * 4
    data[offset] = r
    data[offset + 1] = g
    data[offset + 2] = b
    data[offset + 3] = a
  }
  return { data, width, height }
}

// (1) pack/unpack round-trip, including alpha 0 and 128
const roundTripColors = [
  { r: 255, g: 0, b: 0, a: 255 },
  { r: 0, g: 255, b: 0, a: 128 },
  { r: 0, g: 0, b: 255, a: 0 },
  { r: 18, g: 52, b: 86, a: 200 },
]
for (const c of roundTripColors) {
  const packed = packSourceRgba(c.r, c.g, c.b, c.a)
  assert(unpackSourceR(packed) === c.r, `round-trip r for ${JSON.stringify(c)}`)
  assert(unpackSourceG(packed) === c.g, `round-trip g for ${JSON.stringify(c)}`)
  assert(unpackSourceB(packed) === c.b, `round-trip b for ${JSON.stringify(c)}`)
  assert(unpackSourceA(packed) === c.a, `round-trip a for ${JSON.stringify(c)}`)
}

// packed value stays unsigned even with the alpha high bit set
assert(packSourceRgba(1, 2, 3, 255) === ((255 << 24) | (3 << 16) | (2 << 8) | 1) >>> 0, 'packed value is unsigned at alpha 255')

// (2) translucent alpha preserved verbatim in sampled colors
{
  const pixels = makePixels(1, 1, [{ px: 0, py: 0, r: 10, g: 20, b: 30, a: 128 }])
  const field = sampleTargetField(pixels, 1, 127)
  assert(field.colors.length === 1, 'translucent pixel above threshold is kept')
  assert(unpackSourceA(field.colors[0]) === 128, 'translucent alpha 128 preserved in colors entry')
  assert(field.colors[0] === packSourceRgba(10, 20, 30, 128), 'translucent colors entry matches packSourceRgba')
}

// (3) threshold behavior: alpha <= threshold dropped, alpha === threshold + 1 kept
{
  const pixels = makePixels(3, 1, [
    { px: 0, py: 0, r: 1, g: 1, b: 1, a: 100 },
    { px: 1, py: 0, r: 2, g: 2, b: 2, a: 101 },
    { px: 2, py: 0, r: 3, g: 3, b: 3, a: 50 },
  ])
  const field = sampleTargetField(pixels, 1, 100)
  assert(field.x.length === 1, 'only alpha === threshold + 1 pixel kept')
  assert(field.x[0] === 1 && field.y[0] === 0, 'kept pixel is the threshold + 1 one')
  assert(unpackSourceA(field.colors[0]) === 101, 'kept pixel alpha is 101')
}

// (4) known 4x2 fixture at step 1 produces row-major targets at pixel coordinates
{
  const entries = []
  for (let py = 0; py < 2; py += 1) {
    for (let px = 0; px < 4; px += 1) {
      const i = py * 4 + px
      entries.push({ px, py, r: i * 10, g: i * 10 + 1, b: i * 10 + 2, a: 255 })
    }
  }
  const pixels = makePixels(4, 2, entries)
  const field = sampleTargetField(pixels, 1, 0)
  assert(field.x.length === 8, '4x2 fixture keeps all 8 pixels')
  for (let i = 0; i < 8; i += 1) {
    const expX = i % 4
    const expY = Math.floor(i / 4)
    assert(
      field.x[i] === expX && field.y[i] === expY,
      `target ${i} at row-major coordinate (${expX}, ${expY})`,
    )
  }
  assert(
    field.colors[5] === packSourceRgba(50, 51, 52, 255),
    'row-major colors entry matches source pixel 5',
  )
}

// (5) normalized metadata: first/last kept pixels hit norm 0 and 1 at opposite corners
{
  const pixels = makePixels(3, 2, [
    { px: 0, py: 0, r: 255, g: 0, b: 0, a: 255 },
    { px: 2, py: 1, r: 0, g: 0, b: 255, a: 255 },
  ])
  const field = sampleTargetField(pixels, 1, 0)
  assert(field.x.length === 2, 'corner fixture keeps exactly 2 pixels')
  assert(field.normX[0] === 0 && field.normY[0] === 0, 'first corner maps to norm (0, 0)')
  assert(field.normX[1] === 1 && field.normY[1] === 1, 'last corner maps to norm (1, 1)')
}

// (6) step 2 on a fully-opaque 4x4 image yields 4 targets on the even grid
{
  const entries = []
  for (let py = 0; py < 4; py += 1) {
    for (let px = 0; px < 4; px += 1) {
      entries.push({ px, py, r: 200, g: 200, b: 200, a: 255 })
    }
  }
  const pixels = makePixels(4, 4, entries)
  const field = sampleTargetField(pixels, 2, 0)
  assert(field.x.length === 4, 'step 2 on 4x4 keeps exactly 4 targets')
  const expected = [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ]
  for (let i = 0; i < expected.length; i += 1) {
    assert(
      field.x[i] === expected[i][0] && field.y[i] === expected[i][1],
      `step 2 target ${i} at (${expected[i][0]}, ${expected[i][1]})`,
    )
  }
}

// (7) empty input (all transparent) yields zero-length arrays of the right types
{
  const pixels = makePixels(3, 3, [])
  const field = sampleTargetField(pixels, 1, 0)
  assert(field.x.length === 0, 'empty field x length')
  assert(field.y.length === 0, 'empty field y length')
  assert(field.colors.length === 0, 'empty field colors length')
  assert(field.normX.length === 0, 'empty field normX length')
  assert(field.normY.length === 0, 'empty field normY length')
  assert(field.x instanceof Float32Array, 'empty field x is Float32Array')
  assert(field.y instanceof Float32Array, 'empty field y is Float32Array')
  assert(field.colors instanceof Uint32Array, 'empty field colors is Uint32Array')
  assert(field.normX instanceof Float32Array, 'empty field normX is Float32Array')
  assert(field.normY instanceof Float32Array, 'empty field normY is Float32Array')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll target-sampling verifications passed.')
