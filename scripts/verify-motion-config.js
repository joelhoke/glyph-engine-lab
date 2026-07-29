#!/usr/bin/env node
/**
 * Deterministic verification for engine/motionConfig.ts
 * (and its dependency engine/displayBudget.ts).
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'motionConfig.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-motion-config')

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
  MOTION_DEFAULTS,
  GLYPH_MOTION_MODE_OPTIONS,
  PARAMETRIC_VARIANT_OPTIONS,
  CUSTOM_FORM_OPTIONS,
  CUSTOM_CREATURE_DEFAULTS,
  clampMotionConfig,
  clampCustomCreatureParams,
  resolveMotionQuality,
} = require(path.join(tmpDir, 'motionConfig.js'))

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
  return { ...MOTION_DEFAULTS, ...overrides }
}

// (1) MOTION_DEFAULTS exact values
assert(MOTION_DEFAULTS.mode === 'off', 'defaults mode is off')
assert(MOTION_DEFAULTS.variant === 'original', 'defaults variant is original')
assert(MOTION_DEFAULTS.amount === 35, 'defaults amount is 35')
assert(MOTION_DEFAULTS.speed === 1, 'defaults speed is 1')
assert(MOTION_DEFAULTS.waveScale === 1, 'defaults waveScale is 1')
assert(MOTION_DEFAULTS.complexity === 2, 'defaults complexity is 2')
assert(MOTION_DEFAULTS.density === 1600, 'defaults density is 1600')
assert(MOTION_DEFAULTS.updateRate === 30, 'defaults updateRate is 30')
assert(
  JSON.stringify(MOTION_DEFAULTS.custom) === JSON.stringify(CUSTOM_CREATURE_DEFAULTS),
  'MOTION_DEFAULTS.custom deep-equals CUSTOM_CREATURE_DEFAULTS',
)

// (2) option lists contain exactly the documented values
assert(GLYPH_MOTION_MODE_OPTIONS.length === 3, 'motion mode options length is 3')
assert(
  JSON.stringify(GLYPH_MOTION_MODE_OPTIONS.map((o) => o.value)) ===
    JSON.stringify(['off', 'organic-flow', 'parametric-creature']),
  'motion mode option values are off, organic-flow, parametric-creature',
)
assert(PARAMETRIC_VARIANT_OPTIONS.length === 4, 'variant options length is 4')
assert(
  JSON.stringify(PARAMETRIC_VARIANT_OPTIONS.map((o) => o.value)) ===
    JSON.stringify(['original', 'jelly', 'ray', 'custom']),
  'variant option values are original, jelly, ray, custom',
)

// (3) clamping of out-of-range values on every field
const low = clampMotionConfig(
  withOverrides({ amount: -50, speed: 0, waveScale: 0, complexity: 0, density: 10, updateRate: 5 }),
)
assert(low.amount === 0, 'amount clamps to min 0')
assert(low.speed === 0.1, 'speed clamps to min 0.1')
assert(low.waveScale === 0.5, 'waveScale clamps to min 0.5')
assert(low.complexity === 1, 'complexity clamps to min 1')
assert(low.density === 400, 'density clamps to min 400')
assert(low.updateRate === 15, 'updateRate clamps to min 15')

const high = clampMotionConfig(
  withOverrides({ amount: 150, speed: 5, waveScale: 9, complexity: 9, density: 9999, updateRate: 99 }),
)
assert(high.amount === 100, 'amount clamps to max 100')
assert(high.speed === 2, 'speed clamps to max 2')
assert(high.waveScale === 2.5, 'waveScale clamps to max 2.5')
assert(high.complexity === 4, 'complexity clamps to max 4')
assert(high.density === 4000, 'density clamps to max 4000')
assert(high.updateRate === 60, 'updateRate clamps to max 60')

const fractional = clampMotionConfig(
  withOverrides({ complexity: 2.6, density: 1234.4, updateRate: 44.4 }),
)
assert(fractional.complexity === 3, 'complexity is rounded')
assert(fractional.density === 1234, 'density is rounded')
assert(fractional.updateRate === 44, 'updateRate is rounded')

const preserved = clampMotionConfig(withOverrides({ mode: 'organic-flow', variant: 'jelly' }))
assert(preserved.mode === 'organic-flow', 'clamp preserves mode')
assert(preserved.variant === 'jelly', 'clamp preserves variant')

// (4) desktop (width 1280)
assert(
  resolveMotionQuality(withOverrides({ density: 4000 }), 1280).effectiveDensity === 2400,
  'desktop density 4000 caps at 2400',
)
assert(
  resolveMotionQuality(withOverrides({ updateRate: 60, density: 1600, complexity: 2 }), 1280)
    .effectiveUpdateRate === 60,
  'desktop density 1600 & complexity 2 allows 60 Hz',
)
assert(
  resolveMotionQuality(withOverrides({ updateRate: 60, density: 2000 }), 1280)
    .effectiveUpdateRate === 30,
  'desktop density 2000 caps rate at 30',
)
assert(
  resolveMotionQuality(withOverrides({ updateRate: 60, density: 4000 }), 1280)
    .effectiveUpdateRate === 30,
  // The ladder's >3000-targets 15 Hz tier is unreachable on desktop because
  // the effective density is already capped at 2400 (≤ 3000 → 30 Hz).
  'desktop density 4000 caps rate at 30 (effective density is capped at 2400)',
)
assert(
  resolveMotionQuality(withOverrides({ updateRate: 60, density: 1600, complexity: 3 }), 1280)
    .effectiveUpdateRate === 30,
  'desktop complexity 3 with density 1600 caps rate at 30',
)

// (5) mobile (width 500)
assert(
  resolveMotionQuality(withOverrides({ density: 4000 }), 500).effectiveDensity === 1200,
  'mobile density 4000 caps at 1200',
)
assert(
  resolveMotionQuality(withOverrides({ updateRate: 60, density: 900, complexity: 2 }), 500)
    .effectiveUpdateRate === 30,
  'mobile density 900 & complexity 2 caps rate at 30',
)
assert(
  resolveMotionQuality(withOverrides({ updateRate: 60, density: 1000 }), 500)
    .effectiveUpdateRate === 15,
  'mobile density 1000 caps rate at 15',
)

// (6) requested rate below cap is preserved
assert(
  resolveMotionQuality(withOverrides({ updateRate: 20, density: 1600, complexity: 2 }), 1280)
    .effectiveUpdateRate === 20,
  'requested rate 20 below cap 60 is preserved',
)

// (7) viewportWidth 0 is treated as desktop
assert(
  resolveMotionQuality(withOverrides({ density: 4000 }), 0).effectiveDensity === 2400,
  'viewportWidth 0 uses desktop density cap 2400',
)
assert(
  resolveMotionQuality(withOverrides({ updateRate: 60, density: 1600, complexity: 2 }), 0)
    .effectiveUpdateRate === 60,
  'viewportWidth 0 uses desktop rate cap 60',
)

// (8) CUSTOM_FORM_OPTIONS contains exactly the documented forms
assert(CUSTOM_FORM_OPTIONS.length === 4, 'custom form options length is 4')
assert(
  JSON.stringify(CUSTOM_FORM_OPTIONS.map((o) => o.value)) ===
    JSON.stringify(['school', 'grid', 'bell', 'wing']),
  'custom form option values are school, grid, bell, wing',
)

// (9) clampCustomCreatureParams clamps every field and preserves form
const customLow = clampCustomCreatureParams({
  form: 'grid',
  symmetry: 0,
  waves: 0,
  travel: -1,
  pulse: -1,
})
assert(customLow.form === 'grid', 'custom clamp preserves form (grid)')
assert(customLow.symmetry === 1, 'custom symmetry clamps to min 1')
assert(customLow.waves === 1, 'custom waves clamps to min 1')
assert(customLow.travel === 0, 'custom travel clamps to min 0')
assert(customLow.pulse === 0, 'custom pulse clamps to min 0')

const customHigh = clampCustomCreatureParams({
  form: 'wing',
  symmetry: 99,
  waves: 99,
  travel: 9,
  pulse: 9,
})
assert(customHigh.form === 'wing', 'custom clamp preserves form (wing)')
assert(customHigh.symmetry === 8, 'custom symmetry clamps to max 8')
assert(customHigh.waves === 6, 'custom waves clamps to max 6')
assert(customHigh.travel === 2, 'custom travel clamps to max 2')
assert(customHigh.pulse === 2, 'custom pulse clamps to max 2')

const customFractional = clampCustomCreatureParams({
  form: 'bell',
  symmetry: 3.6,
  waves: 2.4,
  travel: 1.5,
  pulse: 0.5,
})
assert(customFractional.form === 'bell', 'custom clamp preserves form (bell)')
assert(customFractional.symmetry === 4, 'custom symmetry is rounded')
assert(customFractional.waves === 2, 'custom waves is rounded')
assert(customFractional.travel === 1.5, 'custom travel keeps in-range fraction unrounded')
assert(customFractional.pulse === 0.5, 'custom pulse keeps in-range fraction unrounded')

// (10) clampMotionConfig clamps nested custom and defaults it when missing
const nested = clampMotionConfig(
  withOverrides({ custom: { form: 'bell', symmetry: 99, waves: 0, travel: 5, pulse: -2 } }),
)
assert(
  JSON.stringify(nested.custom) ===
    JSON.stringify({ form: 'bell', symmetry: 8, waves: 1, travel: 2, pulse: 0 }),
  'clampMotionConfig clamps out-of-range nested custom',
)

const withoutCustom = withOverrides({})
delete withoutCustom.custom
const filled = clampMotionConfig(withoutCustom)
assert(
  JSON.stringify(filled.custom) === JSON.stringify(CUSTOM_CREATURE_DEFAULTS),
  'clampMotionConfig fills custom with defaults when missing',
)

// (11) resolveMotionQuality still clamps quality for a config with custom set
const customDesktop = resolveMotionQuality(
  withOverrides({
    variant: 'custom',
    custom: { form: 'wing', symmetry: 5, waves: 4, travel: 1.5, pulse: 0.5 },
    updateRate: 60,
    density: 1600,
    complexity: 2,
  }),
  1280,
)
assert(customDesktop.effectiveDensity === 1600, 'custom config keeps density 1600 on desktop')
assert(customDesktop.effectiveUpdateRate === 60, 'custom config allows 60 Hz on desktop')
assert(
  resolveMotionQuality(
    withOverrides({
      variant: 'custom',
      custom: { form: 'school', symmetry: 2, waves: 3, travel: 1, pulse: 1 },
      updateRate: 60,
      density: 4000,
    }),
    1280,
  ).effectiveDensity === 2400,
  'custom config density 4000 caps at 2400 on desktop',
)
assert(
  resolveMotionQuality(
    withOverrides({
      variant: 'custom',
      custom: { form: 'school', symmetry: 2, waves: 3, travel: 1, pulse: 1 },
      updateRate: 60,
      density: 1000,
    }),
    500,
  ).effectiveUpdateRate === 15,
  'custom config density 1000 caps rate at 15 on mobile',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll motion-config verifications passed.')
