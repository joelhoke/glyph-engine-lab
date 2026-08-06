#!/usr/bin/env node
/**
 * Deterministic verification for the Visual Sonification experiment:
 * engine/sonificationConfig.ts (clamping, defaults, grid constants),
 * engine/sonificationAnalysis.ts (tier raster sizing, hex→HSL, strip feature
 * extraction on both axes, strip copy), and engine/sonificationMapper.ts
 * (four directions, reverse ordering, root/scale mapping from background
 * hues, note caps, silent-frame behavior, determinism, scene sensitivity,
 * register from background luminance).
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFiles = [
  path.join(projectRoot, 'engine', 'sonificationConfig.ts'),
  path.join(projectRoot, 'engine', 'sonificationAnalysis.ts'),
  path.join(projectRoot, 'engine', 'sonificationMapper.ts'),
]
const tmpDir = path.join(projectRoot, 'tmp-verify-sonification')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc ${sourceFiles.map((file) => `"${file}"`).join(' ')} --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  clampSonificationConfig,
  isHorizontalSonificationDirection,
  isReversedSonificationDirection,
  SONIFICATION_BANDS,
  SONIFICATION_DEFAULTS,
  SONIFICATION_MAX_NOTES_PER_STEP,
  SONIFICATION_MAX_VOICES,
  SONIFICATION_STEPS,
} = require(path.join(tmpDir, 'sonificationConfig.js'))
const {
  copyStripFeatures,
  createSonificationGrid,
  extractStripFeatures,
  hexToHsl,
  resolveSonificationRasterSize,
} = require(path.join(tmpDir, 'sonificationAnalysis.js'))
const {
  mapSonification,
  midiToFrequency,
  resolveRegisterShift,
  resolveRootSemitone,
  SONIFICATION_ACTIVITY_THRESHOLD,
} = require(path.join(tmpDir, 'sonificationMapper.js'))

const EPS = 1e-6

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const PARAMS = {
  backgroundHue1: 200,
  backgroundHue2: 220,
  backgroundLuminance: 0.5,
  weather: null,
  matrix: null,
}

function gridWith(fill) {
  const grid = createSonificationGrid()
  for (let step = 0; step < SONIFICATION_STEPS; step += 1) {
    for (let band = 0; band < SONIFICATION_BANDS; band += 1) {
      const cell = step * SONIFICATION_BANDS + band
      const value = fill(step, band)
      grid.luminance[cell] = value.luminance ?? 0
      grid.density[cell] = value.density ?? 0
      grid.contrast[cell] = value.contrast ?? 0
      grid.hue[cell] = value.hue ?? -1
      grid.saturation[cell] = value.saturation ?? 0
    }
  }
  return grid
}

const stepsJson = (score) => JSON.stringify(score.steps)

// (1) config: defaults and clamping
{
  assert(SONIFICATION_DEFAULTS.direction === 'left-to-right', 'default direction is left-to-right')
  assert(SONIFICATION_DEFAULTS.sweepDuration === 8, 'default sweep duration is 8s')
  assert(SONIFICATION_DEFAULTS.volume === 35, 'default volume is 35')
  const clamped = clampSonificationConfig({
    direction: 'sideways',
    sweepDuration: 999,
    volume: -10,
  })
  assert(clamped.direction === 'left-to-right', 'unknown direction falls back to the default')
  assert(clamped.sweepDuration === 20, 'sweep duration clamps to 20s')
  assert(clamped.volume === 0, 'volume clamps to 0')
  const clampedLow = clampSonificationConfig({
    direction: 'top-to-bottom',
    sweepDuration: 0.5,
    volume: 500,
  })
  assert(clampedLow.sweepDuration === 4, 'sweep duration clamps to 4s')
  assert(clampedLow.volume === 100, 'volume clamps to 100')
  const nan = clampSonificationConfig({
    direction: 'right-to-left',
    sweepDuration: NaN,
    volume: Infinity,
  })
  assert(nan.sweepDuration === 4, 'non-finite duration falls to the minimum')
  assert(nan.volume === 0, 'non-finite volume falls to the minimum')
  assert(SONIFICATION_STEPS === 24 && SONIFICATION_BANDS === 12, 'grid is 24 steps × 12 bands')
  assert(SONIFICATION_MAX_NOTES_PER_STEP === 3, 'at most 3 active bands per step')
  assert(SONIFICATION_MAX_VOICES === 8, 'voice ceiling is 8')
  assert(
    isHorizontalSonificationDirection('left-to-right') &&
      isHorizontalSonificationDirection('right-to-left') &&
      !isHorizontalSonificationDirection('top-to-bottom'),
    'horizontal direction classification',
  )
  assert(
    isReversedSonificationDirection('right-to-left') &&
      isReversedSonificationDirection('bottom-to-top') &&
      !isReversedSonificationDirection('left-to-right'),
    'reversed direction classification',
  )
}

// (2) analysis: tier raster sizing
{
  const t0 = resolveSonificationRasterSize(0)
  const t1 = resolveSonificationRasterSize(1)
  const t2 = resolveSonificationRasterSize(2)
  const t3 = resolveSonificationRasterSize(3)
  assert(
    t0.width === 96 && t0.height === 48 && t0.reuseSteps === 1,
    'T0 raster is 96×48, read every step',
  )
  assert(
    t1.width === 96 && t1.height === 48 && t1.reuseSteps === 1,
    'T1 raster is 96×48, read every step',
  )
  assert(
    t2.width === 64 && t2.height === 32 && t2.reuseSteps === 1,
    'T2 raster is 64×32, read every step',
  )
  assert(
    t3.width === 48 && t3.height === 24 && t3.reuseSteps === 2,
    'T3 raster is 48×24, one read per two steps',
  )
}

// (3) analysis: hex → HSL
{
  const red = hexToHsl('#ff0000')
  assert(Math.abs(red.h) < EPS && red.s === 1 && red.l === 0.5, '#ff0000 → hue 0, sat 1, lum 0.5')
  const blue = hexToHsl('#0000ff')
  assert(Math.abs(blue.h - 240) < EPS, '#0000ff → hue 240')
  const white = hexToHsl('#ffffff')
  assert(white.s === 0 && white.l === 1, '#ffffff → sat 0, lum 1')
  const invalid = hexToHsl('not-a-color')
  assert(invalid.l === 0, 'invalid hex resolves to black')
}

// (4) analysis: strip feature extraction (horizontal axis)
{
  // 4×48 strip: top half solid mid-gray, bottom half split black/white.
  const width = 4
  const height = 48
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      let v = 128
      if (y >= 24) v = x < 2 ? 0 : 255
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
      data[i + 3] = 255
    }
  }
  const grid = createSonificationGrid()
  extractStripFeatures({ data, width, height }, 'horizontal', 5, grid)
  const topCell = 5 * SONIFICATION_BANDS + 2 // inside the gray half
  const bottomCell = 5 * SONIFICATION_BANDS + 8 // inside the split half
  assert(
    Math.abs(grid.contrast[topCell]) < EPS && grid.density[topCell] === 0,
    'a uniform strip band has zero contrast and zero density',
  )
  assert(
    grid.contrast[bottomCell] > 0.4 && grid.density[bottomCell] > 0.9,
    'a split strip band has high contrast and density',
  )
  assert(grid.hue[topCell] === -1, 'an achromatic band reports hue -1')
  // Other steps stay untouched.
  assert(grid.luminance[0] === 0 && grid.luminance[4 * SONIFICATION_BANDS] === 0, 'only the read strip is written')
}

// (5) analysis: strip extraction (vertical axis) + hue/saturation + copy
{
  // 48×2 strip: left half pure red, right half pure blue.
  const width = 48
  const height = 2
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const red = x < 24
      data[i] = red ? 255 : 0
      data[i + 1] = 0
      data[i + 2] = red ? 0 : 255
      data[i + 3] = 255
    }
  }
  const grid = createSonificationGrid()
  extractStripFeatures({ data, width, height }, 'vertical', 3, grid)
  const leftCell = 3 * SONIFICATION_BANDS + 2
  const rightCell = 3 * SONIFICATION_BANDS + 9
  assert(Math.abs(grid.hue[leftCell]) < 1, 'left (red) band hue ≈ 0')
  assert(Math.abs(grid.hue[rightCell] - 240) < 1, 'right (blue) band hue ≈ 240')
  assert(grid.saturation[leftCell] === 1, 'saturated band reports saturation 1')
  assert(
    grid.contrast[leftCell] === 0,
    'a solid color band has zero luminance contrast',
  )

  copyStripFeatures(grid, 3, 4)
  assert(
    grid.hue[4 * SONIFICATION_BANDS + 2] === grid.hue[leftCell] &&
      grid.saturation[4 * SONIFICATION_BANDS + 9] === grid.saturation[rightCell],
    'copyStripFeatures duplicates a strip (T3 read reuse)',
  )
}

// (6) mapper: all four directions produce 24 steps; reverses are exact
{
  const grid = gridWith((step, band) => ({
    contrast: ((step * 7 + band * 13) % 10) / 20,
    density: ((step * 3 + band * 5) % 8) / 16,
    luminance: 0.5,
    hue: (step * 15) % 360,
    saturation: 0.6,
  }))
  const ltr = mapSonification(grid, PARAMS, 'left-to-right')
  const rtl = mapSonification(grid, PARAMS, 'right-to-left')
  const ttb = mapSonification(grid, PARAMS, 'top-to-bottom')
  const btt = mapSonification(grid, PARAMS, 'bottom-to-top')
  for (const [name, score] of [['ltr', ltr], ['rtl', rtl], ['ttb', ttb], ['btt', btt]]) {
    assert(score.steps.length === SONIFICATION_STEPS, `${name}: 24 steps`)
  }
  const reversed = (steps) => JSON.stringify([...steps].reverse())
  assert(
    stepsJson(rtl) === reversed(ltr.steps),
    'right-to-left is exactly the reverse of left-to-right',
  )
  assert(
    stepsJson(btt) === reversed(ttb.steps),
    'bottom-to-top is exactly the reverse of top-to-bottom',
  )
  // Horizontal and vertical sweeps read the same canonical grid, so ltr and
  // ttb map identical content to identical phrases.
  assert(
    stepsJson(ltr) === stepsJson(ttb),
    'ltr and ttb share the canonical phrase (axis is an analysis concern)',
  )
}

// (7) mapper: note cap, pentatonic quantization, threshold
{
  const hot = gridWith(() => ({ contrast: 0.8, density: 0.5, luminance: 0.5, hue: 120, saturation: 0.8 }))
  const score = mapSonification(hot, PARAMS, 'left-to-right')
  let capped = true
  let notes = 0
  for (const step of score.steps) {
    if (step.notes.length > SONIFICATION_MAX_NOTES_PER_STEP) capped = false
    notes += step.notes.length
  }
  assert(capped, 'no step voices more than 3 bands even when all 12 are hot')
  assert(notes === SONIFICATION_STEPS * 3, 'a fully hot scene voices 3 notes per step')

  // Every note quantizes to minor pentatonic relative to the drone root.
  const rootMidi = 69 + 12 * Math.log2(score.drone.rootFrequency / 440)
  let quantized = true
  for (const step of score.steps) {
    for (const note of step.notes) {
      const midi = 69 + 12 * Math.log2(note.frequency / 440)
      const offset = ((Math.round(midi - rootMidi) % 12) + 12) % 12
      if (![0, 3, 5, 7, 10].includes(offset)) quantized = false
    }
  }
  assert(quantized, 'all notes quantize to minor pentatonic around the root')

  // Below the activity threshold: drone only.
  const quiet = gridWith(() => ({ contrast: 0.02, density: 0.01, luminance: 0.5 }))
  const quietScore = mapSonification(quiet, PARAMS, 'left-to-right')
  const quietNotes = quietScore.steps.reduce((sum, step) => sum + step.notes.length, 0)
  assert(quietNotes === 0, 'a scene below the activity threshold voices no notes')
  assert(quietScore.drone.gain > 0, 'the drone still sounds under a silent frame')

  const silent = gridWith(() => ({}))
  const silentScore = mapSonification(silent, PARAMS, 'left-to-right')
  assert(
    silentScore.steps.every((step) => step.notes.length === 0 && step.activity === 0),
    'an empty grid is drone/ambient only',
  )
  assert(SONIFICATION_ACTIVITY_THRESHOLD > 0, 'activity threshold is exported and positive')
}

// (8) mapper: background hues → root, luminance → register
{
  const grid = gridWith(() => ({}))
  const atHue0 = mapSonification(grid, { ...PARAMS, backgroundHue1: 0, backgroundHue2: 0 }, 'left-to-right')
  const atHue90 = mapSonification(grid, { ...PARAMS, backgroundHue1: 90, backgroundHue2: 90 }, 'left-to-right')
  const expectedRatio = Math.pow(2, 3 / 12) // hue 0 → semitone 0, hue 90 → semitone 3
  assert(
    Math.abs(atHue90.drone.rootFrequency / atHue0.drone.rootFrequency - expectedRatio) < 1e-9,
    'background hue selects the chromatic root (90° → +3 semitones)',
  )
  assert(
    Math.abs(atHue90.drone.fifthFrequency / atHue90.drone.rootFrequency - Math.pow(2, 7 / 12)) < 1e-9,
    'the drone carries a perfect fifth above the root',
  )
  assert(resolveRootSemitone(350, 10) === 0, 'hues wrapping past 360° average correctly')

  const dark = mapSonification(grid, { ...PARAMS, backgroundLuminance: 0.1 }, 'left-to-right')
  const bright = mapSonification(grid, { ...PARAMS, backgroundLuminance: 0.9 }, 'left-to-right')
  assert(
    Math.abs(dark.drone.rootFrequency / PARAMS.backgroundLuminance - dark.drone.rootFrequency) > 0 &&
      Math.abs(dark.drone.rootFrequency * 4 - bright.drone.rootFrequency) < 0.001,
    'background luminance shifts the register (dark −1 octave, bright +1)',
  )
  assert(resolveRegisterShift(0.5) === 0, 'mid luminance keeps the base register')
  assert(
    bright.drone.cutoff > dark.drone.cutoff,
    'brighter backgrounds open the drone filter',
  )
}

// (9) mapper: weather and matrix textures
{
  const grid = gridWith(() => ({}))
  const calm = mapSonification(grid, PARAMS, 'left-to-right')
  assert(calm.noise === null && calm.pulses === null, 'no ambient layer → no textures')
  const weather = mapSonification(
    grid,
    { ...PARAMS, weather: { intensity: 200, wind: 100 } },
    'left-to-right',
  )
  assert(
    weather.noise && weather.noise.gain > 0 && weather.noise.cutoff > 2000,
    'weather adds a filtered-noise texture shaped by intensity/wind',
  )
  const matrix = mapSonification(
    grid,
    { ...PARAMS, matrix: { speed: 400, volume: 100, trailStrength: 100 } },
    'left-to-right',
  )
  assert(
    matrix.pulses &&
      matrix.pulses.rateHz > 3 &&
      matrix.pulses.gain > 0 &&
      matrix.pulses.delaySeconds > 0.5 &&
      matrix.pulses.frequency > matrix.drone.rootFrequency * 6,
    'matrix adds restrained high pulses with a trail-shaped echo',
  )
  const matrixQuiet = mapSonification(
    grid,
    { ...PARAMS, matrix: { speed: 25, volume: 0, trailStrength: 0 } },
    'left-to-right',
  )
  assert(
    matrixQuiet.pulses && matrixQuiet.pulses.gain === 0,
    'matrix volume 0 silences the pulses',
  )
}

// (10) mapper: determinism and scene sensitivity
{
  const sceneA = gridWith((step, band) => ({
    contrast: ((step + band) % 6) / 10,
    density: 0.3,
    luminance: 0.5,
    hue: 30,
    saturation: 0.5,
  }))
  const sceneA2 = gridWith((step, band) => ({
    contrast: ((step + band) % 6) / 10,
    density: 0.3,
    luminance: 0.5,
    hue: 30,
    saturation: 0.5,
  }))
  const sceneB = gridWith((step, band) => ({
    contrast: ((step * band) % 6) / 10,
    density: 0.7,
    luminance: 0.2,
    hue: 200,
    saturation: 0.9,
  }))
  const a1 = mapSonification(sceneA, PARAMS, 'left-to-right')
  const a2 = mapSonification(sceneA2, PARAMS, 'left-to-right')
  const b = mapSonification(sceneB, PARAMS, 'left-to-right')
  assert(JSON.stringify(a1) === JSON.stringify(a2), 'identical input → identical score')
  assert(JSON.stringify(a1) !== JSON.stringify(b), 'materially different scenes → distinct scores')
  const bRtl = mapSonification(sceneA, PARAMS, 'right-to-left')
  assert(JSON.stringify(a1) !== JSON.stringify(bRtl), 'direction changes the score')
}

// (11) helpers: midi → frequency sanity
{
  assert(Math.abs(midiToFrequency(69) - 440) < EPS, 'A4 = 440 Hz')
  assert(Math.abs(midiToFrequency(81) - 880) < 1e-9, 'one octave up doubles the frequency')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll sonification verifications passed.')
