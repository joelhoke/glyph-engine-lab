#!/usr/bin/env node
/**
 * Deterministic verification for the Vibe experience (M5) content model:
 * content/vibe.ts (copy, presets, upload-error copy) plus the curated default
 * composition wiring in engine/sceneConfig.ts, engine/playgroundConfig.ts, and
 * the nested motion config in engine/motionConfig.ts.
 *
 * Checks: presets are complete valid configs (including a complete valid
 * motion config each), copy fields are non-empty, the vibe scene descriptor
 * matches the default composition (which a preset mirrors), the privacy note
 * claims local-only processing, the friendly-error map covers every error
 * literal the upload validators can produce, 'source-colors' is a known color
 * mode, 'custom' is a known parametric variant, the default playground motion
 * deep-equals MOTION_DEFAULTS (mode off, including the nested custom creature
 * params), and vibe keeps the most energetic behavior of the three modes.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-vibe-content')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'content', 'vibe.ts')}" "${path.join(projectRoot, 'engine', 'sceneConfig.ts')}" "${path.join(projectRoot, 'engine', 'playgroundConfig.ts')}" "${path.join(projectRoot, 'engine', 'motionConfig.ts')}" "${path.join(projectRoot, 'engine', 'ambientConfig.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  VIBE_INVITATION,
  VIBE_MAKE_IT_YOURS_LABEL,
  VIBE_DOCK_INVITATION,
  VIBE_PRIVACY_NOTE,
  VIBE_UPLOAD_PENDING_LABEL,
  VIBE_UPLOAD_ERROR_COPY,
  VIBE_UPLOAD_ERROR_FALLBACK,
  VIBE_PRESETS,
  getFriendlyUploadError,
  getVibePreset,
} = require(path.join(tmpDir, 'content', 'vibe.js'))
const { EXPERIENCE_SCENES } = require(path.join(tmpDir, 'engine', 'sceneConfig.js'))
const {
  VIBE_DEFAULT_PLAYGROUND,
  GLYPH_FONT_OPTIONS,
  GLYPH_COLOR_MODE_OPTIONS,
  MAX_GLYPH_PALETTE_SIZE,
} = require(path.join(tmpDir, 'engine', 'playgroundConfig.js'))
const {
  MOTION_DEFAULTS,
  GLYPH_MOTION_MODE_OPTIONS,
  PARAMETRIC_VARIANT_OPTIONS,
  MOTION_AMOUNT_MIN,
  MOTION_AMOUNT_MAX,
  MOTION_SPEED_MIN,
  MOTION_SPEED_MAX,
  MOTION_WAVE_SCALE_MIN,
  MOTION_WAVE_SCALE_MAX,
  MOTION_COMPLEXITY_MIN,
  MOTION_COMPLEXITY_MAX,
  MOTION_DENSITY_MIN,
  MOTION_DENSITY_MAX,
  MOTION_UPDATE_RATE_MIN,
  MOTION_UPDATE_RATE_MAX,
  CUSTOM_FORM_OPTIONS,
  CUSTOM_SYMMETRY_MIN,
  CUSTOM_SYMMETRY_MAX,
  CUSTOM_WAVES_MIN,
  CUSTOM_WAVES_MAX,
  CUSTOM_TRAVEL_MIN,
  CUSTOM_TRAVEL_MAX,
  CUSTOM_PULSE_MIN,
  CUSTOM_PULSE_MAX,
} = require(path.join(tmpDir, 'engine', 'motionConfig.js'))
const {
  AMBIENT_DEFAULTS,
  AMBIENT_MODE_OPTIONS,
  WEATHER_PRESET_OPTIONS,
} = require(path.join(tmpDir, 'engine', 'ambientConfig.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const CONFIG_KEYS = [
  'glyphText',
  'glyphPalette',
  'backgroundColor1',
  'backgroundColor2',
  'glyphFont',
  'glyphColorMode',
  'glyphScale',
  'motion',
  'ambient',
]

const MOTION_NUMERIC_RANGES = [
  ['amount', MOTION_AMOUNT_MIN, MOTION_AMOUNT_MAX],
  ['speed', MOTION_SPEED_MIN, MOTION_SPEED_MAX],
  ['waveScale', MOTION_WAVE_SCALE_MIN, MOTION_WAVE_SCALE_MAX],
  ['complexity', MOTION_COMPLEXITY_MIN, MOTION_COMPLEXITY_MAX],
  ['density', MOTION_DENSITY_MIN, MOTION_DENSITY_MAX],
  ['updateRate', MOTION_UPDATE_RATE_MIN, MOTION_UPDATE_RATE_MAX],
]

const CUSTOM_NUMERIC_RANGES = [
  ['symmetry', CUSTOM_SYMMETRY_MIN, CUSTOM_SYMMETRY_MAX],
  ['waves', CUSTOM_WAVES_MIN, CUSTOM_WAVES_MAX],
  ['travel', CUSTOM_TRAVEL_MIN, CUSTOM_TRAVEL_MAX],
  ['pulse', CUSTOM_PULSE_MIN, CUSTOM_PULSE_MAX],
]

function isCompleteValidCustomCreatureParams(custom) {
  if (!custom || typeof custom !== 'object') return false
  if (!CUSTOM_FORM_OPTIONS.some((option) => option.value === custom.form)) return false
  return CUSTOM_NUMERIC_RANGES.every(
    ([key, min, max]) =>
      typeof custom[key] === 'number' && custom[key] >= min && custom[key] <= max,
  )
}

function isCompleteValidMotionConfig(motion) {
  if (!motion || typeof motion !== 'object') return false
  if (!GLYPH_MOTION_MODE_OPTIONS.some((option) => option.value === motion.mode)) return false
  if (!PARAMETRIC_VARIANT_OPTIONS.some((option) => option.value === motion.variant)) return false
  if (!isCompleteValidCustomCreatureParams(motion.custom)) return false
  return MOTION_NUMERIC_RANGES.every(
    ([key, min, max]) =>
      typeof motion[key] === 'number' && motion[key] >= min && motion[key] <= max,
  )
}

function isCompleteValidConfig(config) {
  if (!config || typeof config !== 'object') return false
  if (!CONFIG_KEYS.every((key) => key in config)) return false
  if (typeof config.glyphText !== 'string' || config.glyphText.trim().length === 0) return false
  if (
    !Array.isArray(config.glyphPalette) ||
    config.glyphPalette.length < 1 ||
    config.glyphPalette.length > MAX_GLYPH_PALETTE_SIZE ||
    !config.glyphPalette.every((color) => HEX_COLOR_RE.test(color))
  ) {
    return false
  }
  if (!HEX_COLOR_RE.test(config.backgroundColor1)) return false
  if (!HEX_COLOR_RE.test(config.backgroundColor2)) return false
  if (!GLYPH_FONT_OPTIONS.some((option) => option.value === config.glyphFont)) return false
  if (!GLYPH_COLOR_MODE_OPTIONS.some((option) => option.value === config.glyphColorMode)) return false
  // Must stay inside the scale slider's range (PlaygroundControls: 0.6–1.6).
  if (typeof config.glyphScale !== 'number' || config.glyphScale < 0.6 || config.glyphScale > 1.6) {
    return false
  }
  if (!isCompleteValidMotionConfig(config.motion)) return false
  if (!isCompleteValidAmbientConfig(config.ambient)) return false
  return true
}

function isCompleteValidAmbientConfig(ambient) {
  if (!ambient || typeof ambient !== 'object') return false
  if (!AMBIENT_MODE_OPTIONS.some((option) => option.value === ambient.mode)) return false
  if (typeof ambient.interactionStrength !== 'number') return false
  const weather = ambient.weather
  if (!weather || typeof weather !== 'object') return false
  if (!WEATHER_PRESET_OPTIONS.some((option) => option.value === weather.preset)) return false
  if (
    !['intensity', 'wind', 'turbulence', 'blur'].every(
      (key) => typeof weather[key] === 'number',
    )
  ) {
    return false
  }
  const matrix = ambient.matrix
  if (!matrix || typeof matrix !== 'object') return false
  return ['spread', 'speed', 'volume', 'trailStrength'].every(
    (key) => typeof matrix[key] === 'number',
  )
}

function motionConfigsEqual(a, b) {
  return (
    Boolean(a) &&
    Boolean(b) &&
    a.mode === b.mode &&
    a.variant === b.variant &&
    a.amount === b.amount &&
    a.speed === b.speed &&
    a.waveScale === b.waveScale &&
    a.complexity === b.complexity &&
    a.density === b.density &&
    a.updateRate === b.updateRate &&
    Boolean(a.custom) &&
    Boolean(b.custom) &&
    a.custom.form === b.custom.form &&
    a.custom.symmetry === b.custom.symmetry &&
    a.custom.waves === b.custom.waves &&
    a.custom.travel === b.custom.travel &&
    a.custom.pulse === b.custom.pulse
  )
}

function ambientConfigsEqual(a, b) {
  return (
    Boolean(a) &&
    Boolean(b) &&
    a.mode === b.mode &&
    a.interactionStrength === b.interactionStrength &&
    Boolean(a.weather) &&
    Boolean(b.weather) &&
    a.weather.preset === b.weather.preset &&
    a.weather.intensity === b.weather.intensity &&
    a.weather.wind === b.weather.wind &&
    a.weather.turbulence === b.weather.turbulence &&
    a.weather.blur === b.weather.blur &&
    Boolean(a.matrix) &&
    Boolean(b.matrix) &&
    a.matrix.spread === b.matrix.spread &&
    a.matrix.speed === b.matrix.speed &&
    a.matrix.volume === b.matrix.volume &&
    a.matrix.trailStrength === b.matrix.trailStrength
  )
}

function configsEqual(a, b) {
  return (
    a.glyphText === b.glyphText &&
    a.glyphFont === b.glyphFont &&
    a.glyphColorMode === b.glyphColorMode &&
    a.glyphScale === b.glyphScale &&
    a.backgroundColor1 === b.backgroundColor1 &&
    a.backgroundColor2 === b.backgroundColor2 &&
    a.glyphPalette.length === b.glyphPalette.length &&
    a.glyphPalette.every((color, index) => color === b.glyphPalette[index]) &&
    motionConfigsEqual(a.motion, b.motion) &&
    ambientConfigsEqual(a.ambient, b.ambient)
  )
}

// --- copy fields -----------------------------------------------------------

const copyFields = [
  VIBE_INVITATION,
  VIBE_MAKE_IT_YOURS_LABEL,
  VIBE_DOCK_INVITATION,
  VIBE_PRIVACY_NOTE,
  VIBE_UPLOAD_PENDING_LABEL,
  VIBE_UPLOAD_ERROR_FALLBACK,
]
assert(
  copyFields.every((value) => typeof value === 'string' && value.trim().length > 0),
  'invitation, button label, dock invitation, privacy note, pending label, and error fallback are non-empty strings',
)

// --- privacy note ----------------------------------------------------------

assert(
  /browser/i.test(VIBE_PRIVACY_NOTE) && /never/i.test(VIBE_PRIVACY_NOTE),
  'privacy note states SVGs are processed in the browser and never uploaded',
)

// the privacy claim must match reality: the upload validators must not make
// network requests — scan their sources for outbound-capable APIs.
const validatorSources = [
  fs.readFileSync(path.join(projectRoot, 'engine', 'svgUpload.ts'), 'utf8'),
  fs.readFileSync(path.join(projectRoot, 'engine', 'rasterUpload.ts'), 'utf8'),
]
for (const source of validatorSources) {
  assert(
    !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket/.test(source),
    'upload validator source contains no network APIs (privacy note matches reality)',
  )
}

// --- color mode options ------------------------------------------------------

assert(
  GLYPH_COLOR_MODE_OPTIONS.some(
    (option) => option.value === 'source-colors' && option.label === 'Source colors',
  ),
  "color mode options include 'source-colors' labeled 'Source colors'",
)

// --- parametric variant options ------------------------------------------------

assert(
  PARAMETRIC_VARIANT_OPTIONS.some(
    (option) => option.value === 'custom' && option.label === 'Custom',
  ),
  "parametric variant options include 'custom' labeled 'Custom'",
)

// --- default motion config ----------------------------------------------------

// Vibe defaults to motion Off; the curated default carries MOTION_DEFAULTS.
assert(
  motionConfigsEqual(VIBE_DEFAULT_PLAYGROUND.motion, MOTION_DEFAULTS) &&
    VIBE_DEFAULT_PLAYGROUND.motion.mode === 'off',
  "VIBE_DEFAULT_PLAYGROUND.motion deep-equals MOTION_DEFAULTS with mode 'off'",
)

// --- default ambient config ---------------------------------------------------

// Vibe defaults to ambient Off; the curated default carries AMBIENT_DEFAULTS.
assert(
  ambientConfigsEqual(VIBE_DEFAULT_PLAYGROUND.ambient, AMBIENT_DEFAULTS) &&
    VIBE_DEFAULT_PLAYGROUND.ambient.mode === 'off',
  "VIBE_DEFAULT_PLAYGROUND.ambient deep-equals AMBIENT_DEFAULTS with mode 'off'",
)

// --- presets ---------------------------------------------------------------

assert(
  VIBE_PRESETS.length >= 3 && VIBE_PRESETS.length <= 4,
  `preset count is 3–4 (got ${VIBE_PRESETS.length})`,
)

const presetIds = VIBE_PRESETS.map((preset) => preset.id)
assert(new Set(presetIds).size === presetIds.length, 'preset ids are unique')

for (const preset of VIBE_PRESETS) {
  assert(
    typeof preset.id === 'string' &&
      preset.id.trim().length > 0 &&
      typeof preset.label === 'string' &&
      preset.label.trim().length > 0,
    `${preset.id}: id and label are non-empty strings`,
  )
  assert(
    isCompleteValidConfig(preset.config),
    `${preset.id}: config is complete and valid (all fields, hex colors, non-empty text, known font/mode, in-range scale, complete valid motion and ambient configs)`,
  )
  if (preset.sourceUrl !== undefined) {
    assert(
      /^\/assets\/.+\.svg$/.test(preset.sourceUrl),
      `${preset.id}: sourceUrl is a built-in /assets/*.svg path when present`,
    )
  }
}

// presets are complete compositions: applying one changes the whole field
assert(
  VIBE_PRESETS.every((preset) =>
    CONFIG_KEYS.every((key) => preset.config[key] !== undefined),
  ),
  'every preset supplies every config field (complete composition)',
)

// --- curated default composition ---------------------------------------------

assert(
  isCompleteValidConfig(VIBE_DEFAULT_PLAYGROUND),
  'VIBE_DEFAULT_PLAYGROUND is a complete valid config',
)

const vibeScene = EXPERIENCE_SCENES.vibe
assert(
  configsEqual(vibeScene.playground, VIBE_DEFAULT_PLAYGROUND),
  'vibe scene descriptor adopts the curated default composition',
)

assert(
  VIBE_PRESETS.some((preset) => configsEqual(preset.config, vibeScene.playground)),
  'vibe scene descriptor matches a preset-or-default config',
)

// the scene descriptor must not share the palette array with the exported
// default (state must never mutate authored config)
assert(
  vibeScene.playground.glyphPalette !== VIBE_DEFAULT_PLAYGROUND.glyphPalette,
  'vibe scene descriptor does not share the palette array reference',
)

// --- bounds-safe preset lookup ---------------------------------------------

assert(getVibePreset(null) === null, 'null preset id resolves to null')
assert(getVibePreset('nope') === null, 'unknown preset id resolves to null')
assert(
  getVibePreset(VIBE_PRESETS[0].id) === VIBE_PRESETS[0],
  'known preset id resolves to its preset',
)

// --- upload error copy -------------------------------------------------------

// every error literal the upload validators can produce must have mapped copy
const messageSources = [
  ...validatorSources,
  fs.readFileSync(path.join(projectRoot, 'engine', 'visualSource.ts'), 'utf8'),
]
const sanitizerMessages = new Set()
const messageRe = /'((?:The uploaded SVG|The SVG file|The image|The selected file|Could not read)[^']*)'/g
let match
for (const source of messageSources) {
  while ((match = messageRe.exec(source)) !== null) {
    sanitizerMessages.add(match[1])
  }
}
assert(sanitizerMessages.size > 0, 'extracted validator error literals from the upload modules')
for (const message of sanitizerMessages) {
  const mapped = VIBE_UPLOAD_ERROR_COPY[message]
  assert(
    typeof mapped === 'string' && mapped.trim().length > 0,
    `friendly copy exists for sanitizer message: "${message}"`,
  )
}

for (const [key, value] of Object.entries(VIBE_UPLOAD_ERROR_COPY)) {
  assert(
    key.trim().length > 0 && value.trim().length > 0,
    `error map entry "${key.slice(0, 40)}…" has non-empty key and copy`,
  )
}

assert(
  getFriendlyUploadError([...sanitizerMessages][0]) ===
    VIBE_UPLOAD_ERROR_COPY[[...sanitizerMessages][0]],
  'getFriendlyUploadError maps a known sanitizer message',
)
assert(
  getFriendlyUploadError('totally unknown error') === VIBE_UPLOAD_ERROR_FALLBACK,
  'getFriendlyUploadError falls back for unknown messages',
)

// --- behavior tuning ---------------------------------------------------------

// vibe keeps the most immediate pointer/weather response of the three modes
const { work, collaborate } = EXPERIENCE_SCENES
assert(
  vibeScene.behavior.particleRepel >= work.behavior.particleRepel &&
    vibeScene.behavior.particleRepel >= collaborate.behavior.particleRepel &&
    vibeScene.behavior.weatherRepelMult >= work.behavior.weatherRepelMult &&
    vibeScene.behavior.weatherRepelMult >= collaborate.behavior.weatherRepelMult &&
    vibeScene.behavior.mouseR >= work.behavior.mouseR &&
    vibeScene.behavior.mouseR >= collaborate.behavior.mouseR,
  'vibe behavior is the most energetic of the three modes',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll vibe content verifications passed.')
