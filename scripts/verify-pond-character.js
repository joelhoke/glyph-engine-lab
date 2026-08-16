#!/usr/bin/env node
/**
 * Verification for the pond character render override: the PondCharacter type
 * in engine/pondConfig.ts, and the SceneCanvas routing invariants — the
 * creature override computes from CREATURE_DEFINITIONS at the hidden
 * MOTION_DEFAULTS (behavioral: the registry entries and default values exist
 * and produce finite targets), wins over any live motion mode while the pond
 * is enabled, never mutates playgroundConfig/motion config/paint state, hides
 * only the glyph paint channel, and restores the exact prior routing on
 * 'source'/disable.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFiles = [
  path.join(projectRoot, 'engine', 'pondConfig.ts'),
  path.join(projectRoot, 'engine', 'motion.ts'),
  path.join(projectRoot, 'engine', 'motionConfig.ts'),
]
const tmpDir = path.join(projectRoot, 'tmp-verify-pond-character')

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

const { CREATURE_DEFINITIONS, buildCreatureTopology, computeCreatureTargets } = require(
  path.join(tmpDir, 'motion.js'),
)
const { MOTION_DEFAULTS } = require(path.join(tmpDir, 'motionConfig.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// (1) the PondCharacter type lives in engine/pondConfig.ts (source text —
// types vanish at compile time)
{
  const pondConfigSrc = fs.readFileSync(
    path.join(projectRoot, 'engine', 'pondConfig.ts'),
    'utf8',
  )
  assert(
    pondConfigSrc.includes(
      "export type PondCharacter = 'source' | 'original' | 'jelly' | 'ray'",
    ),
    'pondConfig exports PondCharacter = source | original | jelly | ray',
  )
}

// (2) every PondCharacter creature resolves through CREATURE_DEFINITIONS and
// computes finite targets at the hidden MOTION_DEFAULTS (behavioral)
for (const character of ['original', 'jelly', 'ray']) {
  const definition = CREATURE_DEFINITIONS[character]
  assert(!!definition && definition.variant === character, `${character} has a registry entry`)
  const topology = buildCreatureTopology(400, character, MOTION_DEFAULTS.custom)
  const outX = new Float32Array(400)
  const outY = new Float32Array(400)
  computeCreatureTargets(
    topology,
    {
      time: 0.8,
      amount: MOTION_DEFAULTS.amount / 100,
      speed: MOTION_DEFAULTS.speed,
      waveScale: MOTION_DEFAULTS.waveScale,
      complexity: MOTION_DEFAULTS.complexity,
      width: 1280,
      height: 720,
      custom: MOTION_DEFAULTS.custom,
    },
    outX,
    outY,
  )
  let finite = true
  for (let i = 0; i < 400; i += 1) {
    if (!Number.isFinite(outX[i]) || !Number.isFinite(outY[i])) finite = false
  }
  assert(finite, `${character} computes finite targets at MOTION_DEFAULTS`)
}
assert(
  MOTION_DEFAULTS.mode === 'off' &&
    MOTION_DEFAULTS.amount === 35 &&
    MOTION_DEFAULTS.updateRate === 30 &&
    MOTION_DEFAULTS.density === 1600,
  'the hidden motion defaults keep their documented values',
)

// (3) SceneCanvas routing (source-text invariants)
{
  const src = fs.readFileSync(path.join(projectRoot, 'components', 'SceneCanvas.tsx'), 'utf8')

  assert(
    src.includes('pondCharacter?: PondCharacter') &&
      src.includes("pondCharacter = 'source'"),
    'SceneCanvas takes an optional pondCharacter prop defaulting to source',
  )
  assert(
    src.includes(
      "const getPondOverrideCharacter = (): Exclude<PondCharacter, 'source'> | null =>",
    ) && src.includes("return character === 'source' ? null : character"),
    'the override character derives from the pond config + pondCharacter refs only',
  )
  // The override wins over any live motion mode while the pond is enabled.
  assert(
    /const applyMotionField = \(\) => \{\s*const mode = motionConfigRef\.current\.mode\s*const pondOverride = getPondOverrideCharacter\(\)\s*if \(pondOverride\) \{[\s\S]*?rebuildPondOverrideField\(pondOverride\)\s*\} else if \(mode === 'parametric-creature'\)/.test(
      src,
    ),
    'applyMotionField routes the override before every motion-mode branch',
  )
  // The compute path uses CREATURE_DEFINITIONS via the dispatchers at the
  // hidden MOTION_DEFAULTS, then the same pond transform as any source.
  assert(
    /pondOverride && pondOverrideTopologyRef\.current\) \{[\s\S]*?computeCreatureTargets\([\s\S]*?amount: MOTION_DEFAULTS\.amount \/ 100[\s\S]*?speed: MOTION_DEFAULTS\.speed[\s\S]*?custom: MOTION_DEFAULTS\.custom[\s\S]*?transformPondTargets\(pond, pondOverrideTopologyRef\.current\.count\)/.test(
      src,
    ),
    'the override computes creature targets at MOTION_DEFAULTS, then the pond transform',
  )
  assert(
    src.includes('Math.min(MOTION_DEFAULTS.updateRate, qualityBudgetRef.current.creatureRate)'),
    'the override computes at the hidden defaults’ cadence, tier-capped',
  )
  // The override topology is separate from the creature mode's cached state.
  assert(
    src.includes('pondOverrideTopologyRef') &&
      /buildCreatureTopology\(\s*needed,\s*character,\s*MOTION_DEFAULTS\.custom,?\s*\)/.test(src),
    'the override keeps its own topology built from MOTION_DEFAULTS.custom',
  )
  // No mutation of playgroundConfig, the motion config mirror, or paint state
  // anywhere on the override path.
  assert(
    !/rebuildPondOverrideField[\s\S]*?(playgroundConfigRef\.current =|motionConfigRef\.current =|paintHistoryRef\.current =|paintedColorsRef\.current\[)/.test(
      src.split('const rebuildPondOverrideField')[1]?.split('const viewportCenter')[0] || '',
    ),
    'the override path never mutates playgroundConfig, motion config, or paint state',
  )
  // Glyph paint hidden only while the override is active; paint data and the
  // background paint channel are untouched.
  assert(
    /colorContext\.paintedColors = getPondOverrideCharacter\(\)\s*\?\s*undefined\s*:\s*paintedColorsRef\.current/.test(
      src,
    ),
    'the glyph paint channel is skipped only while the override is active',
  )
  // A character change re-routes through applyMotionField; a change with the
  // pond off is free.
  assert(
    /pondCharacterRef\.current = pondCharacter[\s\S]*?if \(!getPondConfig\(\)\) return[\s\S]*?applyMotionField\(\)/.test(
      src,
    ),
    'a pondCharacter change re-routes the field only while the pond is live',
  )
  // The pond physics path is unchanged: the pond config mirror
  // effect is unchanged and character defaults to 'source'.
  assert(
    src.includes('pondConfigRef.current = pond ? clampPondConfig(pond) : null'),
    'the pond config mirror (hidden physics defaults path) is unchanged',
  )
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll pond character override checks passed')
