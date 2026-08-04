#!/usr/bin/env node
/**
 * Deterministic verification for engine/experienceHash.ts,
 * engine/sceneConfig.ts, and engine/motionConfig.ts: hash parsing/formatting,
 * scene descriptor resolution for the experience shell, and the nested motion
 * config every scene's playground now carries.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-scene-config')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'experienceHash.ts')}" "${path.join(projectRoot, 'engine', 'sceneConfig.ts')}" "${path.join(projectRoot, 'engine', 'motionConfig.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  EXPERIENCE_SCENE_KEYS,
  COLLABORATE_CHAT_HASH,
  formatExperienceHash,
  parseExperienceHash,
  parseExperienceHashTarget,
  shouldCanonicalizeCollaborateChat,
} = require(path.join(tmpDir, 'experienceHash.js'))
const { EXPERIENCE_SCENES, getSceneDescriptor, resolveScenePlayground } = require(path.join(tmpDir, 'sceneConfig.js'))
const { resolvePlaygroundConfig } = require(path.join(tmpDir, 'playgroundTheme.js'))
const {
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
} = require(path.join(tmpDir, 'motionConfig.js'))

const VALID_MOTION_MODES = GLYPH_MOTION_MODE_OPTIONS.map((option) => option.value)
const VALID_PARAMETRIC_VARIANTS = PARAMETRIC_VARIANT_OPTIONS.map((option) => option.value)
const VALID_CUSTOM_FORMS = CUSTOM_FORM_OPTIONS.map((option) => option.value)
const {
  AMBIENT_MODE_OPTIONS,
  WEATHER_PRESET_OPTIONS,
} = require(path.join(tmpDir, 'ambientConfig.js'))
const VALID_AMBIENT_MODES = AMBIENT_MODE_OPTIONS.map((option) => option.value)
const VALID_WEATHER_PRESETS = WEATHER_PRESET_OPTIONS.map((option) => option.value)

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// scene keys are exactly the three shell modes
assert(
  EXPERIENCE_SCENE_KEYS.length === 3 &&
    EXPERIENCE_SCENE_KEYS.includes('work') &&
    EXPERIENCE_SCENE_KEYS.includes('vibe') &&
    EXPERIENCE_SCENE_KEYS.includes('collaborate'),
  'scene keys are work, vibe, collaborate',
)

// every scene key parses from its canonical hash
for (const key of EXPERIENCE_SCENE_KEYS) {
  assert(parseExperienceHash(`#${key}`) === key, `parses #${key}`)
}

// formatting and parsing round-trip
for (const key of EXPERIENCE_SCENE_KEYS) {
  assert(parseExperienceHash(formatExperienceHash(key)) === key, `round-trips ${key}`)
}

// tolerant of missing hash prefix and casing
assert(parseExperienceHash('work') === 'work', 'parses bare hash body')
assert(parseExperienceHash('#VIBE') === 'vibe', 'parses case-insensitively')

// unknown, legacy, and empty hashes resolve to null (caller keeps current mode)
assert(parseExperienceHash('') === null, 'empty hash resolves to null')
assert(parseExperienceHash('#') === null, 'bare # resolves to null')
assert(parseExperienceHash('#playground') === null, 'legacy #playground resolves to null')
assert(parseExperienceHash('#portfolio') === null, 'legacy #portfolio resolves to null')
assert(parseExperienceHash('#nope') === null, 'unknown hash resolves to null')

// collaborate chat subview: `#collaborate/chat` parses as collaborate + chat
{
  const target = parseExperienceHashTarget(COLLABORATE_CHAT_HASH)
  assert(
    !!target && target.key === 'collaborate' && target.subview === 'chat' && target.storyId === null,
    'parses #collaborate/chat as collaborate with the chat subview',
  )
  assert(
    parseExperienceHash(COLLABORATE_CHAT_HASH) === 'collaborate',
    'the backward-compatible wrapper resolves #collaborate/chat to the collaborate mode',
  )
}
// unknown nested hashes degrade to the bare mode
{
  const unknown = parseExperienceHashTarget('#collaborate/nope')
  assert(
    !!unknown && unknown.key === 'collaborate' && unknown.subview === undefined,
    'an unknown collaborate subview degrades to the bare collaborate mode',
  )
  const workUnknown = parseExperienceHashTarget('#work/nope')
  assert(
    !!workUnknown && workUnknown.key === 'work' && workUnknown.storyId === 'nope',
    'unknown work story ids still parse as story ids (caller degrades them)',
  )
  const bare = parseExperienceHashTarget('#collaborate')
  assert(!!bare && bare.subview === undefined, 'bare #collaborate carries no subview')
}
// canonicalization: the chat deep link is only meaningful with turns in memory
assert(
  shouldCanonicalizeCollaborateChat(parseExperienceHashTarget('#collaborate/chat'), false),
  'a chat deep link with zero in-memory turns canonicalizes to the landing',
)
assert(
  !shouldCanonicalizeCollaborateChat(parseExperienceHashTarget('#collaborate/chat'), true),
  'a chat deep link with a live conversation stays on the chat',
)
assert(
  !shouldCanonicalizeCollaborateChat(parseExperienceHashTarget('#collaborate'), false) &&
    !shouldCanonicalizeCollaborateChat(parseExperienceHashTarget('#work'), false) &&
    !shouldCanonicalizeCollaborateChat(null, false),
  'non-chat targets never canonicalize',
)

// motion option lists match the documented mode/variant vocabulary
assert(
  VALID_MOTION_MODES.length === 3 &&
    VALID_MOTION_MODES.includes('off') &&
    VALID_MOTION_MODES.includes('organic-flow') &&
    VALID_MOTION_MODES.includes('parametric-creature'),
  'motion modes are off, organic-flow, parametric-creature',
)
assert(
  PARAMETRIC_VARIANT_OPTIONS.length === 4 &&
    PARAMETRIC_VARIANT_OPTIONS[0].value === 'original' &&
    PARAMETRIC_VARIANT_OPTIONS[1].value === 'jelly' &&
    PARAMETRIC_VARIANT_OPTIONS[2].value === 'ray' &&
    PARAMETRIC_VARIANT_OPTIONS[3].value === 'custom' &&
    PARAMETRIC_VARIANT_OPTIONS[3].label === 'Custom',
  'parametric variants are original, jelly, ray, custom (Custom last)',
)

// every scene descriptor is complete
for (const key of EXPERIENCE_SCENE_KEYS) {
  const scene = EXPERIENCE_SCENES[key]
  assert(!!scene, `descriptor exists for ${key}`)
  assert(scene === getSceneDescriptor(key), `getSceneDescriptor resolves ${key}`)
  assert(
    typeof scene.copy.documentTitle === 'string' && scene.copy.documentTitle.length > 0 &&
      typeof scene.copy.heading === 'string' && scene.copy.heading.length > 0 &&
      typeof scene.copy.tagline === 'string' && scene.copy.tagline.length > 0,
    `${key} has copy hooks (title, heading, tagline)`,
  )
  assert(
    typeof scene.behavior.mouseR === 'number' &&
      typeof scene.behavior.particleRepel === 'number' &&
      typeof scene.behavior.weatherRepelMult === 'number' &&
      typeof scene.behavior.clickImpulseRadius === 'number' &&
      typeof scene.behavior.clickImpulseForce === 'number',
    `${key} has behavior parameters`,
  )
  assert(
    typeof scene.sourceLayout.samplingStep === 'number' && scene.sourceLayout.samplingStep >= 1,
    `${key} has a usable source layout`,
  )
  assert(
    Array.isArray(scene.playground.glyphPalette) && scene.playground.glyphPalette.length > 0 &&
      typeof scene.playground.glyphText === 'string' && scene.playground.glyphText.length > 0,
    `${key} has a baseline playground config`,
  )
  const motion = scene.playground.motion
  assert(
    !!motion &&
      VALID_MOTION_MODES.includes(motion.mode) &&
      VALID_PARAMETRIC_VARIANTS.includes(motion.variant),
    `${key} playground motion exists with a valid mode and variant`,
  )
  assert(
    !!motion &&
      typeof motion.amount === 'number' &&
        motion.amount >= MOTION_AMOUNT_MIN && motion.amount <= MOTION_AMOUNT_MAX &&
      typeof motion.speed === 'number' &&
        motion.speed >= MOTION_SPEED_MIN && motion.speed <= MOTION_SPEED_MAX &&
      typeof motion.waveScale === 'number' &&
        motion.waveScale >= MOTION_WAVE_SCALE_MIN && motion.waveScale <= MOTION_WAVE_SCALE_MAX &&
      typeof motion.complexity === 'number' &&
        motion.complexity >= MOTION_COMPLEXITY_MIN && motion.complexity <= MOTION_COMPLEXITY_MAX &&
      typeof motion.density === 'number' &&
        motion.density >= MOTION_DENSITY_MIN && motion.density <= MOTION_DENSITY_MAX &&
      typeof motion.updateRate === 'number' &&
        motion.updateRate >= MOTION_UPDATE_RATE_MIN && motion.updateRate <= MOTION_UPDATE_RATE_MAX,
    `${key} playground motion numeric fields are in range`,
  )
  const custom = motion && motion.custom
  assert(
    !!custom &&
      VALID_CUSTOM_FORMS.includes(custom.form) &&
      typeof custom.symmetry === 'number' &&
        custom.symmetry >= CUSTOM_SYMMETRY_MIN && custom.symmetry <= CUSTOM_SYMMETRY_MAX &&
      typeof custom.waves === 'number' &&
        custom.waves >= CUSTOM_WAVES_MIN && custom.waves <= CUSTOM_WAVES_MAX &&
      typeof custom.travel === 'number' &&
        custom.travel >= CUSTOM_TRAVEL_MIN && custom.travel <= CUSTOM_TRAVEL_MAX &&
      typeof custom.pulse === 'number' &&
        custom.pulse >= CUSTOM_PULSE_MIN && custom.pulse <= CUSTOM_PULSE_MAX,
    `${key} playground motion custom params are in range`,
  )
  assert(
    !!motion && motion.mode === 'off',
    `${key} playground motion defaults to off`,
  )
  const ambient = scene.playground.ambient
  assert(
    !!ambient &&
      VALID_AMBIENT_MODES.includes(ambient.mode) &&
      !!ambient.weather &&
      VALID_WEATHER_PRESETS.includes(ambient.weather.preset) &&
      !!ambient.matrix &&
      typeof ambient.interactionStrength === 'number' &&
      typeof ambient.backdropOpacity === 'number' &&
      ambient.backdropOpacity >= 0 &&
      ambient.backdropOpacity <= 1 &&
      typeof ambient.weather.intensity === 'number' &&
      typeof ambient.weather.wind === 'number' &&
      typeof ambient.weather.turbulence === 'number' &&
      typeof ambient.weather.blur === 'number' &&
      typeof ambient.matrix.spread === 'number' &&
      typeof ambient.matrix.speed === 'number' &&
      typeof ambient.matrix.volume === 'number' &&
      typeof ambient.matrix.trailStrength === 'number',
    `${key} playground ambient exists with a valid mode, preset, and numeric fields`,
  )
  assert(
    !!ambient && ambient.mode === 'off',
    `${key} playground ambient defaults to off`,
  )
  // themed signature (feature/light-dark): every scene carries dark+light
  // color tables, the baseline playground is the dark resolution, and the
  // light resolution picks the light table up.
  const themed = scene.themedPlayground
  assert(
    !!themed && !!themed.dark && !!themed.light &&
      Array.isArray(themed.dark.glyphPalette) && themed.dark.glyphPalette.length > 0 &&
      Array.isArray(themed.light.glyphPalette) && themed.light.glyphPalette.length > 0 &&
      typeof themed.dark.backgroundColor1 === 'string' &&
      typeof themed.dark.backgroundColor2 === 'string' &&
      typeof themed.light.backgroundColor1 === 'string' &&
      typeof themed.light.backgroundColor2 === 'string',
    `${key} carries themed dark+light color tables`,
  )
  const darkResolved = resolvePlaygroundConfig(themed, 'dark')
  assert(
    darkResolved.glyphPalette.join(',') === scene.playground.glyphPalette.join(',') &&
      darkResolved.backgroundColor1 === scene.playground.backgroundColor1 &&
      darkResolved.backgroundColor2 === scene.playground.backgroundColor2,
    `${key} baseline playground is the dark resolution of its themed config`,
  )
  const lightResolved = resolveScenePlayground(scene, 'light')
  assert(
    lightResolved.backgroundColor1 === themed.light.backgroundColor1 &&
      lightResolved.backgroundColor2 === themed.light.backgroundColor2 &&
      lightResolved.glyphPalette.join(',') === themed.light.glyphPalette.join(','),
    `${key} resolves the light color table for the light theme`,
  )
}

// vibe keeps the upload/default source seam open
assert(EXPERIENCE_SCENES.vibe.sourceUrl === null, 'vibe sourceUrl is null (upload/default seam)')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll scene config verifications passed.')
