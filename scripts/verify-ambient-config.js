#!/usr/bin/env node
/**
 * Deterministic verification for engine/ambientConfig.ts: defaults, clamping
 * of every numeric field, and the mutual-exclusivity mode helper.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'ambientConfig.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-ambient-config')

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
  AMBIENT_DEFAULTS,
  AMBIENT_MODE_OPTIONS,
  WEATHER_PRESET_OPTIONS,
  AMBIENT_INTERACTION_MIN,
  AMBIENT_INTERACTION_MAX,
  WEATHER_INTENSITY_MIN,
  WEATHER_INTENSITY_MAX,
  WEATHER_WIND_MIN,
  WEATHER_WIND_MAX,
  WEATHER_TURBULENCE_MIN,
  WEATHER_TURBULENCE_MAX,
  WEATHER_BLUR_MIN,
  WEATHER_BLUR_MAX,
  MATRIX_SPREAD_MIN,
  MATRIX_SPREAD_MAX,
  MATRIX_SPEED_MIN,
  MATRIX_SPEED_MAX,
  MATRIX_VOLUME_MIN,
  MATRIX_VOLUME_MAX,
  MATRIX_TRAIL_MIN,
  MATRIX_TRAIL_MAX,
  clampAmbientConfig,
  clampWeatherAmbientConfig,
  clampMatrixAmbientConfig,
  resolveAmbientMode,
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

function withOverrides(overrides) {
  return {
    ...AMBIENT_DEFAULTS,
    ...overrides,
    weather: { ...AMBIENT_DEFAULTS.weather, ...(overrides.weather || {}) },
    matrix: { ...AMBIENT_DEFAULTS.matrix, ...(overrides.matrix || {}) },
  }
}

// (1) AMBIENT_DEFAULTS exact values — Vibe defaults to Off.
assert(AMBIENT_DEFAULTS.mode === 'off', 'defaults mode is off')
assert(AMBIENT_DEFAULTS.interactionStrength === 1, 'defaults interactionStrength is 1')
assert(AMBIENT_DEFAULTS.weather.preset === 'rain', 'defaults weather preset is rain')
assert(AMBIENT_DEFAULTS.weather.intensity === 100, 'defaults weather intensity is 100')
assert(AMBIENT_DEFAULTS.weather.wind === 50, 'defaults weather wind is 50')
assert(AMBIENT_DEFAULTS.weather.turbulence === 100, 'defaults weather turbulence is 100')
assert(AMBIENT_DEFAULTS.weather.blur === 25, 'defaults weather blur is 25')
assert(AMBIENT_DEFAULTS.matrix.spread === 100, 'defaults matrix spread is 100')
assert(AMBIENT_DEFAULTS.matrix.speed === 100, 'defaults matrix speed is 100')
assert(AMBIENT_DEFAULTS.matrix.volume === 100, 'defaults matrix volume is 100')
assert(AMBIENT_DEFAULTS.matrix.trailStrength === 60, 'defaults matrix trailStrength is 60')

// (2) option lists contain exactly the documented values
assert(
  JSON.stringify(AMBIENT_MODE_OPTIONS.map((o) => o.value)) ===
    JSON.stringify(['off', 'weather', 'matrix']),
  'ambient mode option values are off, weather, matrix',
)
assert(
  JSON.stringify(WEATHER_PRESET_OPTIONS.map((o) => o.value)) ===
    JSON.stringify(['clear', 'rain', 'storm', 'snow', 'blizzard', 'fog', 'wind']),
  'weather preset option values are clear, rain, storm, snow, blizzard, fog, wind',
)

// (3) clamping of out-of-range values on every field
const low = clampAmbientConfig(
  withOverrides({
    interactionStrength: -5,
    weather: { intensity: -1, wind: -1, turbulence: -1, blur: -1 },
    matrix: { spread: 0, speed: 0, volume: -1, trailStrength: -1 },
  }),
)
assert(low.interactionStrength === AMBIENT_INTERACTION_MIN, 'interactionStrength clamps to min')
assert(low.weather.intensity === WEATHER_INTENSITY_MIN, 'weather intensity clamps to min')
assert(low.weather.wind === WEATHER_WIND_MIN, 'weather wind clamps to min')
assert(low.weather.turbulence === WEATHER_TURBULENCE_MIN, 'weather turbulence clamps to min')
assert(low.weather.blur === WEATHER_BLUR_MIN, 'weather blur clamps to min')
assert(low.matrix.spread === MATRIX_SPREAD_MIN, 'matrix spread clamps to min')
assert(low.matrix.speed === MATRIX_SPEED_MIN, 'matrix speed clamps to min')
assert(low.matrix.volume === MATRIX_VOLUME_MIN, 'matrix volume clamps to min')
assert(low.matrix.trailStrength === MATRIX_TRAIL_MIN, 'matrix trailStrength clamps to min')

const high = clampAmbientConfig(
  withOverrides({
    interactionStrength: 99,
    weather: { intensity: 999, wind: 999, turbulence: 999, blur: 999 },
    matrix: { spread: 999, speed: 9999, volume: 999, trailStrength: 999 },
  }),
)
assert(high.interactionStrength === AMBIENT_INTERACTION_MAX, 'interactionStrength clamps to max')
assert(high.weather.intensity === WEATHER_INTENSITY_MAX, 'weather intensity clamps to max')
assert(high.weather.wind === WEATHER_WIND_MAX, 'weather wind clamps to max')
assert(high.weather.turbulence === WEATHER_TURBULENCE_MAX, 'weather turbulence clamps to max')
assert(high.weather.blur === WEATHER_BLUR_MAX, 'weather blur clamps to max')
assert(high.matrix.spread === MATRIX_SPREAD_MAX, 'matrix spread clamps to max')
assert(high.matrix.speed === MATRIX_SPEED_MAX, 'matrix speed clamps to max')
assert(high.matrix.volume === MATRIX_VOLUME_MAX, 'matrix volume clamps to max')
assert(high.matrix.trailStrength === MATRIX_TRAIL_MAX, 'matrix trailStrength clamps to max')

const nonFinite = clampAmbientConfig(
  withOverrides({ interactionStrength: NaN, weather: { intensity: Infinity } }),
)
assert(nonFinite.interactionStrength === AMBIENT_INTERACTION_MIN, 'NaN interactionStrength clamps to min')
assert(nonFinite.weather.intensity === WEATHER_INTENSITY_MIN, 'non-finite intensity clamps to min')

const preserved = clampAmbientConfig(
  withOverrides({ mode: 'weather', weather: { preset: 'blizzard' } }),
)
assert(preserved.mode === 'weather', 'clamp preserves mode')
assert(preserved.weather.preset === 'blizzard', 'clamp preserves weather preset')

// (4) sub-config clamp helpers work standalone
const weatherOnly = clampWeatherAmbientConfig({ preset: 'fog', intensity: 500, wind: 50, turbulence: 50, blur: 50 })
assert(weatherOnly.preset === 'fog' && weatherOnly.intensity === WEATHER_INTENSITY_MAX, 'weather-only clamp works')
const matrixOnly = clampMatrixAmbientConfig({ spread: 100, speed: 1, volume: 100, trailStrength: 60 })
assert(matrixOnly.speed === MATRIX_SPEED_MIN, 'matrix-only clamp works')

// (5) clamp fills missing sub-configs with defaults
const sparse = clampAmbientConfig({ mode: 'matrix', interactionStrength: 1 })
assert(
  JSON.stringify(sparse.weather) === JSON.stringify(AMBIENT_DEFAULTS.weather) &&
    JSON.stringify(sparse.matrix) === JSON.stringify(AMBIENT_DEFAULTS.matrix),
  'clamp fills missing weather/matrix sub-configs with defaults',
)

// (6) mutual exclusivity: a single mode decides, invalid values resolve off
assert(resolveAmbientMode(withOverrides({ mode: 'off' })) === 'off', 'off resolves off')
assert(resolveAmbientMode(withOverrides({ mode: 'weather' })) === 'weather', 'weather resolves weather')
assert(resolveAmbientMode(withOverrides({ mode: 'matrix' })) === 'matrix', 'matrix resolves matrix')
assert(resolveAmbientMode(withOverrides({ mode: 'both' })) === 'off', 'unknown mode resolves off')
assert(
  resolveAmbientMode(withOverrides({ mode: 'weather' })) !== 'matrix',
  'weather and matrix can never be active at once',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll ambient-config verifications passed.')
