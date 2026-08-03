#!/usr/bin/env node
/**
 * Deterministic verification for the seasonal landing atmosphere (Stage 3):
 * engine/seasonalAtmosphere.ts.
 *
 * Checks: same inputs → same output (no randomness, no clock reads), the
 * hemisphere approximation from locale regions and timezone names, the
 * seasonal mapping across representative northern/southern dates, night
 * softening, and that the output is always a valid, already-clamped weather
 * AmbientConfig. Also asserts the module performs no network I/O — it is a
 * deterministic seasonal mood, never a weather service.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-seasonal-atmosphere')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'seasonalAtmosphere.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  captureSeasonalAtmosphereInput,
  resolveHemisphere,
  resolveSeason,
  resolveSeasonalAtmosphere,
} = require(path.join(tmpDir, 'seasonalAtmosphere.js'))
const {
  AMBIENT_INTERACTION_MAX,
  AMBIENT_INTERACTION_MIN,
  clampAmbientConfig,
  WEATHER_BLUR_MAX,
  WEATHER_BLUR_MIN,
  WEATHER_INTENSITY_MAX,
  WEATHER_INTENSITY_MIN,
  WEATHER_PRESET_OPTIONS,
  WEATHER_TURBULENCE_MAX,
  WEATHER_TURBULENCE_MIN,
  WEATHER_WIND_MAX,
  WEATHER_WIND_MIN,
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

// --- hemisphere approximation --------------------------------------------------

assert(
  resolveHemisphere('en-US', 'America/New_York') === 'northern',
  'en-US resolves northern',
)
assert(
  resolveHemisphere('en-AU', 'Australia/Sydney') === 'southern',
  'en-AU locale region resolves southern',
)
assert(
  resolveHemisphere('pt-BR', 'America/Sao_Paulo') === 'southern',
  'pt-BR locale region resolves southern',
)
assert(
  resolveHemisphere('', 'Africa/Johannesburg') === 'southern',
  'timezone name resolves southern when the locale is absent',
)
assert(
  resolveHemisphere('', 'Pacific/Auckland') === 'southern',
  'Auckland timezone resolves southern',
)
assert(
  resolveHemisphere('en-GB', 'Europe/London') === 'northern',
  'en-GB resolves northern',
)
assert(
  resolveHemisphere('de-DE', 'Australia/Sydney') === 'northern',
  'a northern locale region wins over the timezone fallback',
)
assert(resolveHemisphere('', '') === 'northern', 'unknown inputs default to northern')

// --- seasonal mapping across representative dates ---------------------------------

assert(resolveSeason(1, 'northern') === 'winter', 'northern January is winter')
assert(resolveSeason(4, 'northern') === 'spring', 'northern April is spring')
assert(resolveSeason(7, 'northern') === 'summer', 'northern July is summer')
assert(resolveSeason(10, 'northern') === 'autumn', 'northern October is autumn')
assert(resolveSeason(1, 'southern') === 'summer', 'southern January is summer')
assert(resolveSeason(7, 'southern') === 'winter', 'southern July is winter')
assert(resolveSeason(12, 'southern') === 'summer', 'southern December is summer')

const NORTHERN = { locale: 'en-US', timeZone: 'America/New_York' }
const SOUTHERN = { locale: 'en-AU', timeZone: 'Australia/Sydney' }

assert(
  resolveSeasonalAtmosphere({ month: 1, hour: 12, ...NORTHERN }).weather.preset === 'snow',
  'northern winter noon → snow atmosphere',
)
assert(
  resolveSeasonalAtmosphere({ month: 7, hour: 12, ...NORTHERN }).weather.preset === 'clear',
  'northern summer noon → clear atmosphere',
)
assert(
  resolveSeasonalAtmosphere({ month: 4, hour: 12, ...NORTHERN }).weather.preset === 'rain',
  'northern spring noon → rain atmosphere',
)
assert(
  resolveSeasonalAtmosphere({ month: 10, hour: 12, ...NORTHERN }).weather.preset === 'wind',
  'northern autumn noon → wind atmosphere',
)
assert(
  resolveSeasonalAtmosphere({ month: 1, hour: 12, ...SOUTHERN }).weather.preset === 'clear',
  'southern summer (January) noon → clear atmosphere',
)
assert(
  resolveSeasonalAtmosphere({ month: 7, hour: 12, ...SOUTHERN }).weather.preset === 'snow',
  'southern winter (July) noon → snow atmosphere',
)

// --- night softening ----------------------------------------------------------------

{
  const day = resolveSeasonalAtmosphere({ month: 1, hour: 12, ...NORTHERN })
  const night = resolveSeasonalAtmosphere({ month: 1, hour: 23, ...NORTHERN })
  assert(
    night.weather.intensity === day.weather.intensity - 10,
    'night softens the intensity by a fixed notch',
  )
  assert(
    night.weather.preset === day.weather.preset,
    'night keeps the seasonal preset',
  )
}

// --- determinism -----------------------------------------------------------------------

{
  const input = { month: 6, hour: 9, locale: 'en-NZ', timeZone: 'Pacific/Auckland' }
  const a = resolveSeasonalAtmosphere(input)
  const b = resolveSeasonalAtmosphere(input)
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    'same inputs → identical atmosphere (deterministic)',
  )
}

// --- output is always a valid, clamped weather AmbientConfig ---------------------------

{
  const inputs = []
  for (let month = 1; month <= 12; month += 1) {
    for (const hour of [0, 6, 12, 18, 23]) {
      inputs.push({ month, hour, ...NORTHERN }, { month, hour, ...SOUTHERN })
    }
  }
  const presets = WEATHER_PRESET_OPTIONS.map((option) => option.value)
  for (const input of inputs) {
    const config = resolveSeasonalAtmosphere(input)
    const label = `month=${input.month} hour=${input.hour} ${input.locale}`
    assert(config.mode === 'weather', `${label}: mode is weather`)
    assert(
      config.backdropOpacity === 0,
      `${label}: the legacy weather mesh backdrop is fully suppressed on the landing`,
    )
    assert(presets.includes(config.weather.preset), `${label}: preset is a known weather preset`)
    assert(
      config.weather.intensity >= WEATHER_INTENSITY_MIN &&
        config.weather.intensity <= WEATHER_INTENSITY_MAX &&
      config.weather.wind >= WEATHER_WIND_MIN &&
        config.weather.wind <= WEATHER_WIND_MAX &&
      config.weather.turbulence >= WEATHER_TURBULENCE_MIN &&
        config.weather.turbulence <= WEATHER_TURBULENCE_MAX &&
      config.weather.blur >= WEATHER_BLUR_MIN &&
        config.weather.blur <= WEATHER_BLUR_MAX &&
      config.interactionStrength >= AMBIENT_INTERACTION_MIN &&
        config.interactionStrength <= AMBIENT_INTERACTION_MAX,
      `${label}: all numeric knobs are inside their documented ranges`,
    )
    assert(
      JSON.stringify(clampAmbientConfig(config)) === JSON.stringify(config),
      `${label}: output is already clamped`,
    )
  }
}

// --- input capture is injected, not global ----------------------------------------------

{
  const input = captureSeasonalAtmosphereInput(new Date(2026, 0, 15, 21, 0, 0), {
    locale: 'en-AU',
    timeZone: 'Australia/Sydney',
  })
  assert(
    input.month === 1 && input.hour === 21 && input.locale === 'en-AU',
    'capture maps the local date parts and resolved options',
  )
  const config = resolveSeasonalAtmosphere(input)
  assert(config.weather.preset === 'clear', 'a southern summer evening resolves the summer mood')
}

// --- no network ----------------------------------------------------------------------------

{
  const source = fs.readFileSync(
    path.join(projectRoot, 'engine', 'seasonalAtmosphere.ts'),
    'utf8',
  )
  assert(
    !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|navigator\.geolocation/.test(source),
    'seasonalAtmosphere.ts contains no network or geolocation APIs',
  )
  assert(!/\bIntl\./.test(source), 'seasonalAtmosphere.ts never calls Intl itself (inputs are injected)')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll seasonal-atmosphere verifications passed.')
