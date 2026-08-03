#!/usr/bin/env node
/**
 * Deterministic verification for engine/ambientField.ts: weather profile
 * distinctness, matrix stream behavior (columns fall, wrap, head glow),
 * bounds bounce, the 8-response-per-tick collision cap, and impulse clamping.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'ambientField.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-ambient-physics')

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
  AMBIENT_MAX_COLLISION_RESPONSES,
  AMBIENT_COLLISION_IMPULSE_CLAMP,
  AMBIENT_COLLISION_RADIUS,
  MATRIX_LINE_HEIGHT,
  WEATHER_PROFILES,
  createAmbientField,
  createAmbientCollisionGrid,
  normalizeAmbientField,
  rebuildAmbientCollisionGrid,
  resolveAmbientCollisions,
  resolveAmbientCount,
  stepAmbientField,
  applyAmbientRadialImpulse,
} = require(path.join(tmpDir, 'ambientField.js'))
const { AMBIENT_DEFAULTS, clampAmbientConfig } = require(path.join(tmpDir, 'ambientConfig.js'))
const { createSeededRandom } = require(path.join(tmpDir, 'random.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function ambientWith(overrides) {
  return clampAmbientConfig({
    ...AMBIENT_DEFAULTS,
    ...overrides,
    weather: { ...AMBIENT_DEFAULTS.weather, ...((overrides && overrides.weather) || {}) },
    matrix: { ...AMBIENT_DEFAULTS.matrix, ...((overrides && overrides.matrix) || {}) },
  })
}

const NO_POINTER = { x: 0, y: 0, active: false, influence: 0, vx: 0, vy: 0 }

function stepParams(config, width, height, dt, pointer = NO_POINTER) {
  return {
    dt,
    time: 1,
    config,
    pointer,
    repelRadius: 50,
    repelStrength: 1,
    width,
    height,
  }
}

const PRESETS = ['clear', 'rain', 'storm', 'snow', 'blizzard', 'fog', 'wind']

// (1) every weather preset is a distinct profile
{
  const keys = [
    'fallSpeed',
    'fallSpread',
    'windScale',
    'turbulenceScale',
    'density',
    'alphaMin',
    'alphaMax',
    'sizeMin',
    'sizeMax',
    'hue',
  ]
  let allDistinct = true
  for (let a = 0; a < PRESETS.length; a += 1) {
    for (let b = a + 1; b < PRESETS.length; b += 1) {
      const pa = WEATHER_PROFILES[PRESETS[a]]
      const pb = WEATHER_PROFILES[PRESETS[b]]
      const same = keys.every((key) => pa[key] === pb[key])
      if (same) allDistinct = false
    }
  }
  assert(allDistinct, 'no two weather presets share a numeric profile row')

  // Distinctness carries through to generated agent parameters: same seed,
  // different presets → different per-agent fields.
  for (const [a, b] of [['rain', 'snow'], ['storm', 'fog'], ['blizzard', 'clear']]) {
    const fa = createAmbientField('weather', 50, 800, 600, ambientWith({ mode: 'weather', weather: { preset: a } }), createSeededRandom(7))
    const fb = createAmbientField('weather', 50, 800, 600, ambientWith({ mode: 'weather', weather: { preset: b } }), createSeededRandom(7))
    const differs =
      fa.speed.some((v, i) => v !== fb.speed[i]) ||
      fa.alpha.some((v, i) => v !== fb.alpha[i]) ||
      fa.size.some((v, i) => v !== fb.size[i])
    assert(differs, `${a} and ${b} produce different agent parameters`)
  }
  assert(WEATHER_PROFILES.storm.lightning === true, 'storm carries lightning')
  assert(
    WEATHER_PROFILES.storm.fallSpeed > WEATHER_PROFILES.rain.fallSpeed &&
      WEATHER_PROFILES.storm.windScale > WEATHER_PROFILES.rain.windScale,
    'storm is rain with stronger fall and gusts',
  )
  assert(
    WEATHER_PROFILES.blizzard.density > WEATHER_PROFILES.snow.density &&
      WEATHER_PROFILES.blizzard.fallSpeed > WEATHER_PROFILES.snow.fallSpeed &&
      WEATHER_PROFILES.blizzard.windScale > WEATHER_PROFILES.snow.windScale,
    'blizzard is denser, faster, more angled snow',
  )
  assert(
    WEATHER_PROFILES.fog.alphaMax < WEATHER_PROFILES.clear.alphaMax &&
      WEATHER_PROFILES.fog.sizeMin > WEATHER_PROFILES.snow.sizeMax,
    'fog is large, very low-alpha, slow agents',
  )
}

// (2) agent counts follow intensity (weather) and volume (matrix)
{
  const rain = ambientWith({ mode: 'weather', weather: { preset: 'rain' } })
  const field = createAmbientField('weather', 100, 800, 600, rain, createSeededRandom(1))
  const at100 = resolveAmbientCount(field, rain)
  assert(at100 === Math.round(100 * WEATHER_PROFILES.rain.density), 'weather count at intensity 100 matches the profile density')
  const at200 = resolveAmbientCount(field, ambientWith({ mode: 'weather', weather: { preset: 'rain', intensity: 200 } }))
  assert(at200 === 100, 'weather count caps at the ambient budget')
  const at0 = resolveAmbientCount(field, ambientWith({ mode: 'weather', weather: { preset: 'rain', intensity: 0 } }))
  assert(at0 === 0, 'weather intensity 0 produces no agents')

  const matrix = ambientWith({ mode: 'matrix' })
  const mfield = createAmbientField('matrix', 5000, 800, 600, matrix, createSeededRandom(1))
  const slots = mfield.columnCount * mfield.rowsPerColumn
  assert(mfield.count === slots, 'matrix volume 100 fills every stream slot within budget')
  const half = resolveAmbientCount(mfield, ambientWith({ mode: 'matrix', matrix: { volume: 50 } }))
  assert(half === Math.round(slots * 0.5), 'matrix volume scales the live stream count')
}

// (3) matrix streams: columns fall, wrap, and set the head glow flag
{
  const config = ambientWith({ mode: 'matrix' })
  const field = createAmbientField('matrix', 5000, 800, 600, config, createSeededRandom(3))
  const wrapHeight = (field.rowsPerColumn + 4) * MATRIX_LINE_HEIGHT

  // Fall: every column scrolls downward (scrolls zeroed first so none wrap
  // inside the 10-step window).
  field.columnScroll.fill(0)
  for (let s = 0; s < 10; s += 1) {
    stepAmbientField(field, stepParams(config, 800, 600, 1 / 60))
  }
  let fell = true
  for (let c = 0; c < field.columnCount; c += 1) {
    if (!(field.columnScroll[c] > 0)) fell = false
  }
  assert(fell, 'matrix columns fall (scroll increases)')

  // Wrap: a column scrolled past the wrap height wraps back into range.
  field.columnScroll[0] = 0
  field.columnSpeed[0] = 1000 // px/s
  for (let s = 0; s < 17; s += 1) {
    stepAmbientField(field, stepParams(config, 800, 600, 0.05))
  }
  // 17 steps × 1000 × 0.05 = 850 px → wraps once past (rowsPerColumn+4)*lineHeight.
  assert(field.columnScroll[0] >= 0 && field.columnScroll[0] < wrapHeight, 'matrix column scroll wraps into range')
  assert(
    Math.abs(field.columnScroll[0] - (850 - wrapHeight)) < 1e-3,
    'matrix wrap preserves the overflow remainder',
  )

  // Head glow: with every slot populated, each column has a head row.
  let heads = 0
  for (let i = 0; i < field.count; i += 1) heads += field.head[i]
  assert(
    heads >= field.columnCount,
    `matrix head glow flag is set (got ${heads} heads across ${field.columnCount} columns)`,
  )
}

// (4) horizontal wrap through the gutter; vertical behaviors preserved
{
  const fog = ambientWith({ mode: 'weather', weather: { preset: 'fog' } })
  const field = createAmbientField('weather', 10, 200, 100, fog, createSeededRandom(5))
  field.count = 1
  field.x[0] = 215
  field.y[0] = 50
  field.vx[0] = 500
  field.vy[0] = 0
  stepAmbientField(field, stepParams(fog, 200, 100, 1 / 30))
  assert(
    field.x[0] < 0 && field.x[0] >= -24 - 1,
    `agent exiting the right edge wraps to the left gutter (got x=${field.x[0].toFixed(2)})`,
  )
  assert(field.vx[0] > 0, 'wrap preserves horizontal velocity (no inversion)')

  // Reverse direction: exiting left wraps to the right gutter.
  field.x[0] = -10
  field.vx[0] = -500
  field.vy[0] = 0
  stepAmbientField(field, stepParams(fog, 200, 100, 1 / 30))
  assert(
    field.x[0] > 200 && field.x[0] <= 200 + 24 + 1,
    `agent exiting the left edge wraps to the right gutter (got x=${field.x[0].toFixed(2)})`,
  )
  assert(field.vx[0] < 0, 'reverse wrap preserves leftward velocity')

  // Vertical: non-precipitation still bounces off the bottom.
  field.x[0] = 100
  field.y[0] = 95
  field.vx[0] = 0
  field.vy[0] = 1000
  stepAmbientField(field, stepParams(fog, 200, 100, 1 / 30))
  assert(field.y[0] <= 100 && field.vy[0] < 0, 'non-precipitation presets bounce off the bottom')

  const rain = ambientWith({ mode: 'weather', weather: { preset: 'rain' } })
  const rainField = createAmbientField('weather', 10, 20, 10, rain, createSeededRandom(5))
  rainField.count = 1
  rainField.x[0] = 10
  rainField.y[0] = 5
  rainField.vy[0] = 500
  stepAmbientField(rainField, stepParams(rain, 20, 10, 1 / 30))
  assert(rainField.y[0] === 0, 'precipitation recycles to the top at the bottom edge')
}

// (4b) signed wind: 50 is calm, below 50 leftward, above 50 rightward
{
  const run = (windValue) => {
    const config = ambientWith({
      mode: 'weather',
      weather: { preset: 'wind', wind: windValue, turbulence: 0 },
    })
    const field = createAmbientField('weather', 200, 800, 600, config, createSeededRandom(29))
    for (let s = 0; s < 240; s += 1) {
      stepAmbientField(field, stepParams(config, 800, 600, 1 / 30))
    }
    let sum = 0
    for (let i = 0; i < field.count; i += 1) sum += field.vx[i]
    return sum / Math.max(1, field.count)
  }
  const calm = run(50)
  const left = run(0)
  const right = run(100)
  assert(Math.abs(calm) < 1, `wind 50 has no directional bias (mean vx ${calm.toFixed(3)})`)
  assert(left < -20 && right > 20, `wind 0 and 100 move in opposite directions (${left.toFixed(1)} / ${right.toFixed(1)})`)
  assert(Math.abs(Math.abs(left) - Math.abs(right)) < 1, 'wind extremes are symmetric around 50')
}

// (4c) long-run distribution: sustained wind leaves no persistent edge row
{
  const config = ambientWith({
    mode: 'weather',
    weather: { preset: 'rain', wind: 100, turbulence: 60 },
  })
  const field = createAmbientField('weather', 200, 800, 600, config, createSeededRandom(31))
  // ~5 minutes at a 30 Hz tick.
  for (let s = 0; s < 9000; s += 1) {
    stepAmbientField(field, stepParams(config, 800, 600, 1 / 30))
  }
  const bins = new Array(16).fill(0)
  for (let i = 0; i < field.count; i += 1) {
    const x = Math.min(799.99, Math.max(0, field.x[i]))
    bins[Math.floor((x / 800) * 16)] += 1
  }
  const mean = field.count / 16
  const edgeMax = Math.max(bins[0], bins[15])
  assert(
    edgeMax <= mean * 2.5,
    `no persistent edge accumulation after 5 minutes (edge bin ${edgeMax}, mean ${mean.toFixed(1)})`,
  )
  // No clamp artifacts: nothing rests exactly on the edges.
  let clamped = 0
  for (let i = 0; i < field.count; i += 1) {
    if (field.x[i] === 0 || field.x[i] === 800) clamped += 1
  }
  assert(clamped === 0, 'no agents clamped at x=0 or x=width after long run')
}

// (4d) matrix displacement stays bounded to the home column
{
  const config = ambientWith({ mode: 'matrix' })
  const field = createAmbientField('matrix', 5000, 800, 600, config, createSeededRandom(37))
  // Blast the whole scene with overlapping impulses and pointer forces.
  for (let s = 0; s < 30; s += 1) {
    applyAmbientRadialImpulse(field, 400, 300, 800, 500)
    stepAmbientField(field, stepParams(config, 800, 600, 1 / 30))
  }
  let maxOffset = 0
  for (let i = 0; i < field.count; i += 1) {
    maxOffset = Math.max(maxOffset, Math.abs(field.x[i] - field.columnX[field.column[i]]))
  }
  assert(
    maxOffset <= 24 + 1.5 + 1e-3,
    `matrix displacement is bounded to the home column (max offset ${maxOffset.toFixed(2)}px)`,
  )
}

// (4e) normalizeAmbientField repairs stale positions without a rebuild
{
  const config = ambientWith({ mode: 'weather', weather: { preset: 'wind' } })
  const field = createAmbientField('weather', 100, 800, 600, config, createSeededRandom(41))
  field.x[0] = 5000
  field.x[1] = -3000
  field.y[0] = -50
  field.y[1] = 5000
  normalizeAmbientField(field, 360, 640)
  for (let i = 0; i < field.count; i += 1) {
    assert(
      field.x[i] >= -24 && field.x[i] <= 360 + 24,
      `normalized x ${field.x[i].toFixed(1)} is inside the gutter range`,
    )
    assert(
      field.y[i] >= 0 && field.y[i] <= 640,
      `normalized y ${field.y[i].toFixed(1)} is inside the viewport`,
    )
  }
  assert(field.width === 360 && field.height === 640, 'normalize updates the measured region')

  const mconfig = ambientWith({ mode: 'matrix' })
  const mfield = createAmbientField('matrix', 5000, 800, 600, mconfig, createSeededRandom(43))
  mfield.vx[0] = 9999
  mfield.vy[1] = -9999
  mfield.columnScroll[0] = -12345
  normalizeAmbientField(mfield, 800, 600)
  assert(Math.abs(mfield.vx[0]) <= 24, 'normalize clamps matrix horizontal displacement')
  assert(Math.abs(mfield.vy[1]) <= MATRIX_LINE_HEIGHT * 2, 'normalize clamps matrix vertical displacement')
  const wrapHeight = (mfield.rowsPerColumn + 4) * MATRIX_LINE_HEIGHT
  assert(
    mfield.columnScroll[0] >= 0 && mfield.columnScroll[0] < wrapHeight,
    'normalize wraps stale column scrolls',
  )
}

// (5) pointer: movement repels, drags push directionally, interactionStrength scales
// (turbulence zeroed so the pointer force is measured in isolation)
{
  const rain = ambientWith({ mode: 'weather', weather: { preset: 'rain', turbulence: 0 } })
  const field = createAmbientField('weather', 10, 200, 200, rain, createSeededRandom(11))
  field.count = 1
  field.x[0] = 110
  field.y[0] = 100
  field.vx[0] = 0
  field.vy[0] = 0
  const pointer = { x: 100, y: 100, active: true, influence: 1, vx: 0, vy: 0 }
  stepAmbientField(field, stepParams(rain, 200, 200, 1 / 30, pointer))
  assert(field.vx[0] > 0.5, 'pointer movement repels ambient agents away')

  const dragField = createAmbientField('weather', 10, 200, 200, rain, createSeededRandom(11))
  dragField.count = 1
  dragField.x[0] = 110
  dragField.y[0] = 100
  dragField.vx[0] = 0
  dragField.vy[0] = 0
  const dragPointer = { x: 100, y: 100, active: true, influence: 1, vx: 1000, vy: 0 }
  stepAmbientField(dragField, stepParams(rain, 200, 200, 1 / 30, dragPointer))
  assert(
    dragField.vx[0] > field.vx[0] + 5,
    'pointer drag adds a directional force (pointer velocity scaled)',
  )

  const noInteraction = ambientWith({ mode: 'weather', interactionStrength: 0, weather: { preset: 'rain', turbulence: 0 } })
  const zeroField = createAmbientField('weather', 10, 200, 200, noInteraction, createSeededRandom(11))
  zeroField.count = 1
  zeroField.x[0] = 110
  zeroField.y[0] = 100
  zeroField.vx[0] = 0
  zeroField.vy[0] = 0
  stepAmbientField(zeroField, stepParams(noInteraction, 200, 200, 1 / 30, dragPointer))
  assert(
    Math.abs(zeroField.vx[0]) < 5,
    'interactionStrength 0 disables pointer forces on ambient agents',
  )

  // Taps use the radial-impulse mirror of engine/impulse.ts.
  const impulseField = createAmbientField('weather', 10, 200, 200, rain, createSeededRandom(13))
  impulseField.count = 2
  impulseField.x[0] = 110
  impulseField.y[0] = 100
  impulseField.x[1] = 190
  impulseField.y[1] = 190
  impulseField.vx[0] = 0
  impulseField.vx[1] = 0
  const affected = applyAmbientRadialImpulse(impulseField, 100, 100, 50, 10)
  assert(affected === 1 && impulseField.vx[0] > 0 && impulseField.vx[1] === 0, 'radial impulse kicks only agents inside the radius')
}

// (6) collisions: 8-response cap per agent per tick
{
  const rain = ambientWith({ mode: 'weather', weather: { preset: 'rain' } })
  const field = createAmbientField('weather', 50, 400, 400, rain, createSeededRandom(17))
  field.count = 50
  for (let i = 0; i < 50; i += 1) {
    // 5×10 grid at 1px spacing: every pair distinct and within the radius.
    field.x[i] = 50 + (i % 5)
    field.y[i] = 50 + Math.floor(i / 5)
    field.vx[i] = 0
    field.vy[i] = 0
  }
  const grid = createAmbientCollisionGrid(400, 400, 50)
  const mainX = new Float32Array(0)
  const mainY = new Float32Array(0)
  const impulseX = new Float32Array(0)
  const impulseY = new Float32Array(0)
  rebuildAmbientCollisionGrid(grid, field, mainX, mainY, 0)
  const responses = resolveAmbientCollisions(field, grid, mainX, mainY, 0, impulseX, impulseY)
  assert(responses > 0, 'co-located agents collide')
  assert(
    responses <= field.count * AMBIENT_MAX_COLLISION_RESPONSES,
    `responses are capped at count × ${AMBIENT_MAX_COLLISION_RESPONSES} (got ${responses})`,
  )
  // Exact cap behavior: agent i responds to at most 8 higher-indexed agents
  // (all pairs are in range here), so responses = 42×8 + (7+6+…+1) = 364.
  assert(responses === 364, `per-agent 8-response cap is exact (got ${responses}, expected 364)`)
  // Agent 0 processes exactly the cap (8 responses) and receives no
  // counter-impulses (no lower-indexed agents exist), so its velocity change
  // is bounded by responses × clamp.
  const maxV0 = Math.max(Math.abs(field.vx[0]), Math.abs(field.vy[0]))
  assert(
    maxV0 <= AMBIENT_MAX_COLLISION_RESPONSES * AMBIENT_COLLISION_IMPULSE_CLAMP + 1e-4,
    'agent 0 velocity change is bounded by responses × clamp',
  )
}

// (7) impulse clamping: a single near-overlap response transfers exactly the clamp
{
  const rain = ambientWith({ mode: 'weather', weather: { preset: 'rain' } })
  const field = createAmbientField('weather', 2, 400, 400, rain, createSeededRandom(19))
  field.count = 2
  field.x[0] = 50
  field.y[0] = 50
  field.x[1] = 50.5
  field.y[1] = 50
  field.vx[0] = 0
  field.vx[1] = 0
  const grid = createAmbientCollisionGrid(400, 400, 2)
  const mainX = new Float32Array(0)
  const mainY = new Float32Array(0)
  rebuildAmbientCollisionGrid(grid, field, mainX, mainY, 0)
  resolveAmbientCollisions(field, grid, mainX, mainY, 0, new Float32Array(0), new Float32Array(0))
  assert(
    Math.abs(field.vx[0] + AMBIENT_COLLISION_IMPULSE_CLAMP) < 1e-4 &&
      Math.abs(field.vx[1] - AMBIENT_COLLISION_IMPULSE_CLAMP) < 1e-4,
    `a near-overlap response transfers exactly the ${AMBIENT_COLLISION_IMPULSE_CLAMP} clamp`,
  )
}

// (8) ambient-to-main collisions transfer a clamped counter-impulse; main
// glyphs are never checked against each other
{
  const rain = ambientWith({ mode: 'weather', weather: { preset: 'rain' } })
  const field = createAmbientField('weather', 2, 400, 400, rain, createSeededRandom(23))
  field.count = 1
  field.x[0] = 50
  field.y[0] = 50
  field.vx[0] = 0
  const mainX = new Float32Array([51, 55, 200])
  const mainY = new Float32Array([50, 50, 200])
  const impulseX = new Float32Array(3)
  const impulseY = new Float32Array(3)
  const grid = createAmbientCollisionGrid(400, 400, 4)
  rebuildAmbientCollisionGrid(grid, field, mainX, mainY, 3)
  const responses = resolveAmbientCollisions(field, grid, mainX, mainY, 3, impulseX, impulseY)
  assert(responses === 2, 'one ambient agent collides with exactly the two nearby main glyphs')
  assert(impulseX[0] > 0 && impulseX[1] > 0, 'main glyphs receive the counter-impulse')
  assert(
    impulseX[0] <= AMBIENT_COLLISION_IMPULSE_CLAMP + 1e-4 &&
      impulseX[1] <= AMBIENT_COLLISION_IMPULSE_CLAMP + 1e-4,
    'counter-impulses to main glyphs are clamped',
  )
  assert(impulseX[2] === 0, 'a distant main glyph is untouched')
  // Main-to-main: the two main glyphs at 51 and 55 are within the collision
  // radius of each other but no ambient agent sits between them — with the
  // ambient agent moved away, no responses may occur at all.
  field.x[0] = 300
  field.y[0] = 300
  impulseX.fill(0)
  impulseY.fill(0)
  rebuildAmbientCollisionGrid(grid, field, mainX, mainY, 3)
  const none = resolveAmbientCollisions(field, grid, mainX, mainY, 3, impulseX, impulseY)
  assert(none === 0 && impulseX[0] === 0 && impulseX[1] === 0, 'no main-to-main collision checks')
  assert(
    AMBIENT_COLLISION_RADIUS > 0,
    'collision radius constant is exported and positive',
  )
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll ambient-physics verifications passed.')
