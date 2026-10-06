#!/usr/bin/env node
/**
 * Deterministic verification for the live Seattle landing weather:
 * engine/liveWeather.ts.
 *
 * Checks: the request URL shape, WMO weather-code bucket coverage (every
 * documented code family maps to a known preset, unknown codes return null),
 * the strong-wind rule, night softening via the API's is_day flag, the calm
 * caps (the landing never storms), and that every mapped output is a valid,
 * already-clamped weather AmbientConfig. Also asserts the module itself
 * performs no network I/O — the fetch lives in the component layer.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-live-weather')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'liveWeather.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  SEATTLE_COORDINATES,
  STRONG_WIND_THRESHOLD_MS,
  LANDING_MAX_INTENSITY,
  buildLiveWeatherUrl,
  bucketWeatherCode,
  mapLiveConditions,
} = require(path.join(tmpDir, 'liveWeather.js'))
const { WEATHER_PRESET_OPTIONS, clampAmbientConfig } = require(
  path.join(tmpDir, 'ambientConfig.js'),
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

// --- request URL ----------------------------------------------------------------

{
  const url = buildLiveWeatherUrl()
  assert(
    url.startsWith('https://api.open-meteo.com/v1/forecast?'),
    'the request targets the Open-Meteo forecast endpoint',
  )
  assert(
    url.includes(`latitude=${SEATTLE_COORDINATES.latitude}`) &&
      url.includes(`longitude=${SEATTLE_COORDINATES.longitude}`),
    'the request is pinned to the Seattle coordinates',
  )
  assert(
    url.includes('weather_code') && url.includes('wind_speed_10m') && url.includes('is_day'),
    'the request asks for weather code, wind speed, and the day flag',
  )
  assert(url.includes('wind_speed_unit=ms'), 'wind speed is requested in m/s')
}

// --- code buckets ----------------------------------------------------------------

{
  const presets = WEATHER_PRESET_OPTIONS.map((option) => option.value)
  const families = [
    [[0, 1], 'clear'],
    [[2], 'clear'],
    [[3], 'fog'],
    [[45, 48], 'fog'],
    [[51, 53, 55, 56, 57], 'rain'],
    [[61, 63, 65, 66, 67], 'rain'],
    [[71, 73, 75, 77], 'snow'],
    [[80, 81, 82], 'rain'],
    [[85, 86], 'snow'],
    [[95, 96, 99], 'rain'],
  ]
  for (const [codes, expected] of families) {
    for (const code of codes) {
      const bucket = bucketWeatherCode(code)
      assert(
        bucket && bucket.preset === expected && presets.includes(bucket.preset),
        `WMO code ${code} maps to ${expected}`,
      )
    }
  }
  assert(
    bucketWeatherCode(4) === null && bucketWeatherCode(100) === null &&
      bucketWeatherCode(NaN) === null && bucketWeatherCode(Infinity) === null,
    'unrecognized or non-finite codes return null (caller keeps the fallback)',
  )
}

// --- mapped conditions -------------------------------------------------------------

{
  const clear = mapLiveConditions({ weatherCode: 0, windSpeedMs: 2, isDay: true })
  assert(clear.weather.preset === 'clear', 'clear sky maps to the clear preset')

  const drizzle = mapLiveConditions({ weatherCode: 51, windSpeedMs: 2, isDay: true })
  const heavyRain = mapLiveConditions({ weatherCode: 65, windSpeedMs: 2, isDay: true })
  assert(
    drizzle.weather.preset === 'rain' && heavyRain.weather.preset === 'rain' &&
      drizzle.weather.intensity < heavyRain.weather.intensity,
    'drizzle is gentler than heavy rain',
  )

  const gustyClear = mapLiveConditions({
    weatherCode: 0,
    windSpeedMs: STRONG_WIND_THRESHOLD_MS,
    isDay: true,
  })
  const calmClear = mapLiveConditions({
    weatherCode: 0,
    windSpeedMs: STRONG_WIND_THRESHOLD_MS - 0.5,
    isDay: true,
  })
  assert(
    gustyClear.weather.preset === 'wind' && calmClear.weather.preset === 'clear',
    'the strong-wind rule switches calm-coded conditions to the wind preset at the threshold',
  )
  const gustyRain = mapLiveConditions({
    weatherCode: 65,
    windSpeedMs: STRONG_WIND_THRESHOLD_MS + 5,
    isDay: true,
  })
  assert(gustyRain.weather.preset === 'rain', 'the strong-wind rule never overrides precipitation')

  const thunder = mapLiveConditions({ weatherCode: 99, windSpeedMs: 20, isDay: true })
  assert(
    thunder.weather.preset === 'rain' && thunder.weather.preset !== 'storm',
    'thunderstorms stay rain — the landing never storms',
  )

  const day = mapLiveConditions({ weatherCode: 61, windSpeedMs: 3, isDay: true })
  const night = mapLiveConditions({ weatherCode: 61, windSpeedMs: 3, isDay: false })
  assert(
    night.weather.intensity === day.weather.intensity - 10,
    'Seattle-local night softens the intensity by a fixed notch',
  )

  const calm = mapLiveConditions({ weatherCode: 0, windSpeedMs: 5, isDay: true })
  const windy = mapLiveConditions({ weatherCode: 0, windSpeedMs: 9, isDay: true })
  assert(
    calm.weather.wind === 50 && windy.weather.wind > calm.weather.wind,
    'the wind knob centers on 50 at 5 m/s and rises with measured wind',
  )
}

// --- every mapped output is a valid, clamped, calm landing config ---------------------

{
  for (let code = 0; code <= 99; code += 1) {
    for (const windSpeedMs of [0, 5, 11.9, 12, 25]) {
      for (const isDay of [true, false]) {
        const config = mapLiveConditions({ weatherCode: code, windSpeedMs, isDay })
        if (config === null) continue
        const label = `code=${code} wind=${windSpeedMs} isDay=${isDay}`
        assert(config.mode === 'weather', `${label}: mode is weather`)
        assert(config.backdropOpacity === 0, `${label}: backdrop stays suppressed`)
        assert(
          config.weather.preset !== 'storm' && config.weather.preset !== 'blizzard',
          `${label}: storm and blizzard never reach the landing`,
        )
        assert(
          config.weather.intensity <= LANDING_MAX_INTENSITY,
          `${label}: intensity never exceeds the landing cap`,
        )
        assert(
          JSON.stringify(clampAmbientConfig(config)) === JSON.stringify(config),
          `${label}: output is already clamped`,
        )
      }
    }
  }
}

// --- determinism ----------------------------------------------------------------------

{
  const input = { weatherCode: 63, windSpeedMs: 7.5, isDay: false }
  const a = mapLiveConditions(input)
  const b = mapLiveConditions(input)
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    'same conditions → identical atmosphere (deterministic)',
  )
}

// --- no network in the pure module -------------------------------------------------------

{
  const source = fs.readFileSync(path.join(projectRoot, 'engine', 'liveWeather.ts'), 'utf8')
  assert(
    !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|navigator\.geolocation/.test(source),
    'liveWeather.ts contains no network or geolocation APIs (the fetch lives in the component layer)',
  )
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll live-weather verifications passed.')
