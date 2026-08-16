#!/usr/bin/env node
/**
 * Deterministic verification for engine/ambientScenes.ts: the carousel
 * registry (order, labels, count, index), the fixed per-scene config
 * compositions (weather defaults per preset; matrix pinned at speed 25; off
 * preserving the default sub-configs), build/resolve round-trips for all nine
 * ids, and cyclic next/prev wrapping.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'ambientScenes.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-ambient-scenes')

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
  AMBIENT_SCENES,
  AMBIENT_SCENE_COUNT,
  ambientSceneIndex,
  buildSceneAmbientConfig,
  nextAmbientSceneId,
  resolveAmbientSceneId,
} = require(path.join(tmpDir, 'ambientScenes.js'))
const {
  AMBIENT_DEFAULTS,
  BACKDROP_OPACITY_DEFAULT,
  MATRIX_DEFAULTS,
  WEATHER_DEFAULTS,
  clampAmbientConfig,
} = require(path.join(tmpDir, 'ambientConfig.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const IDS = ['off', 'clear', 'rain', 'storm', 'snow', 'blizzard', 'fog', 'wind', 'matrix']
const LABELS = ['Off', 'Clear', 'Rain', 'Storm', 'Snow', 'Blizzard', 'Fog', 'Wind', 'Matrix']

// (1) registry order, labels, and count
assert(
  JSON.stringify(AMBIENT_SCENES.map((s) => s.id)) === JSON.stringify(IDS),
  'scenes are exactly off, clear, rain, storm, snow, blizzard, fog, wind, matrix in order',
)
assert(
  JSON.stringify(AMBIENT_SCENES.map((s) => s.label)) === JSON.stringify(LABELS),
  'scene labels are Off, Clear, Rain, Storm, Snow, Blizzard, Fog, Wind, Matrix',
)
assert(AMBIENT_SCENE_COUNT === 9, 'scene count is 9')
assert(
  AMBIENT_SCENES.every((s, i) => ambientSceneIndex(s.id) === i),
  'ambientSceneIndex matches the registry position for every scene',
)
assert(
  AMBIENT_SCENES.filter((s) => s.mode === 'weather').every((s) => s.preset === s.id) &&
    AMBIENT_SCENES.find((s) => s.id === 'off').preset === undefined &&
    AMBIENT_SCENES.find((s) => s.id === 'matrix').preset === undefined,
  'weather scenes carry their preset; off and matrix carry none',
)

// (2) weather scenes: fixed defaults at the scene's preset
for (const id of IDS.slice(1, 8)) {
  const config = buildSceneAmbientConfig(id)
  assert(
    config.mode === 'weather' && config.weather.preset === id,
    `${id}: builds a weather config at its own preset`,
  )
  assert(
    config.weather.intensity === 100 &&
      config.weather.wind === 50 &&
      config.weather.turbulence === 100 &&
      config.weather.blur === 25,
    `${id}: weather knobs pinned to the fixed scene composition`,
  )
  assert(
    config.interactionStrength === 1 && config.backdropOpacity === BACKDROP_OPACITY_DEFAULT,
    `${id}: interaction 1 and the default backdrop opacity`,
  )
  assert(
    JSON.stringify(config.matrix) === JSON.stringify(MATRIX_DEFAULTS),
    `${id}: inactive matrix sub-config stays at defaults`,
  )
}

// (3) matrix scene: speed pinned at 25, every other knob at defaults
{
  const config = buildSceneAmbientConfig('matrix')
  assert(config.mode === 'matrix', 'matrix: builds a matrix config')
  assert(config.matrix.speed === 25, 'matrix: speed pinned at 25 (not the 100 knob default)')
  assert(
    config.matrix.spread === 100 && config.matrix.volume === 100 && config.matrix.trailStrength === 60,
    'matrix: spread/volume/trailStrength at defaults',
  )
  assert(
    config.interactionStrength === 1 && config.backdropOpacity === BACKDROP_OPACITY_DEFAULT,
    'matrix: interaction 1 and the default backdrop opacity',
  )
  assert(
    JSON.stringify(config.weather) === JSON.stringify(WEATHER_DEFAULTS),
    'matrix: inactive weather sub-config stays at defaults',
  )
}

// (4) off scene: untouched defaults, sub-configs preserved
{
  const config = buildSceneAmbientConfig('off')
  assert(
    JSON.stringify(config) === JSON.stringify(AMBIENT_DEFAULTS),
    'off: builds exactly AMBIENT_DEFAULTS (sub-configs preserved)',
  )
  assert(
    config.weather !== AMBIENT_DEFAULTS.weather && config.matrix !== AMBIENT_DEFAULTS.matrix,
    'off: returns fresh sub-config copies, never the shared default objects',
  )
}

// (5) resolve: mode/preset mapping, unknown weather preset → off
assert(resolveAmbientSceneId(AMBIENT_DEFAULTS) === 'off', 'resolves the defaults to off')
assert(
  resolveAmbientSceneId(buildSceneAmbientConfig('matrix')) === 'matrix',
  'resolves matrix mode to matrix',
)
for (const id of IDS.slice(1, 8)) {
  assert(
    resolveAmbientSceneId(buildSceneAmbientConfig(id)) === id,
    `resolves weather preset ${id} to its scene`,
  )
}
{
  const unknown = clampAmbientConfig({
    ...AMBIENT_DEFAULTS,
    mode: 'weather',
  })
  unknown.weather.preset = 'hail'
  assert(resolveAmbientSceneId(unknown) === 'off', 'unknown weather preset resolves to off')
}

// (6) build → resolve round-trip for all nine ids
for (const id of IDS) {
  assert(
    resolveAmbientSceneId(buildSceneAmbientConfig(id)) === id,
    `round-trip: resolve(build(${id})) === ${id}`,
  )
}

// (7) cyclic next/prev wrapping
assert(nextAmbientSceneId('off', 'next') === 'clear', 'next from off is clear')
assert(nextAmbientSceneId('matrix', 'next') === 'off', 'next wraps from matrix to off')
assert(nextAmbientSceneId('off', 'prev') === 'matrix', 'prev wraps from off to matrix')
assert(nextAmbientSceneId('matrix', 'prev') === 'wind', 'prev from matrix is wind')
{
  let id = 'off'
  for (let i = 0; i < AMBIENT_SCENE_COUNT; i += 1) id = nextAmbientSceneId(id, 'next')
  assert(id === 'off', 'stepping next through every scene returns to the start')
  for (let i = 0; i < AMBIENT_SCENE_COUNT; i += 1) id = nextAmbientSceneId(id, 'prev')
  assert(id === 'off', 'stepping prev through every scene returns to the start')
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll ambient scene registry checks passed')
