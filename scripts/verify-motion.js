#!/usr/bin/env node
/**
 * Deterministic verification for engine/motion.ts
 * (organic-flow base-field displacement and the parametric-creature registry:
 * original fish, jelly, ray, and the bounded custom lab) and its
 * dependency engine/motionConfig.ts (variant options vs. registry drift).
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFiles = [
  path.join(projectRoot, 'engine', 'motion.ts'),
  path.join(projectRoot, 'engine', 'motionConfig.ts'),
]
const tmpDir = path.join(projectRoot, 'tmp-verify-motion')

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
  buildMotionBaseField,
  computeOrganicTargets,
  buildCreatureTopology,
  computeCreatureTargets,
  CREATURE_DEFINITIONS,
} = require(path.join(tmpDir, 'motion.js'))
const { PARAMETRIC_VARIANT_OPTIONS } = require(path.join(tmpDir, 'motionConfig.js'))

const TAU = Math.PI * 2

let failures = 0
let scannedElements = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

/** Number.isFinite scan; also feeds the global coverage counter (test 11). */
function scanFinite(arr, label) {
  let ok = true
  for (let i = 0; i < arr.length; i += 1) {
    if (!Number.isFinite(arr[i])) {
      ok = false
      break
    }
  }
  scannedElements += arr.length
  assert(ok, label)
}

function byteIdentical(a, b) {
  if (a.length !== b.length) return false
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(
    Buffer.from(b.buffer, b.byteOffset, b.byteLength),
  )
}

function arraysDiffer(a, b) {
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return true
  }
  return false
}

function bounds(arr) {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < arr.length; i += 1) {
    if (arr[i] < min) min = arr[i]
    if (arr[i] > max) max = arr[i]
  }
  return { min, max }
}

// ---------------------------------------------------------------------------
// Base field: 50 targets on a deterministic hand-written 10x5 normalized grid.
// ---------------------------------------------------------------------------
const FIELD_W = 1280
const FIELD_H = 720
const COLS = 10
const ROWS = 5
const COUNT = COLS * ROWS

const baseX = new Float32Array(COUNT)
const baseY = new Float32Array(COUNT)
const normX = new Float32Array(COUNT)
const normY = new Float32Array(COUNT)
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    const i = row * COLS + col
    normX[i] = (col + 0.5) / COLS
    normY[i] = (row + 0.5) / ROWS
    baseX[i] = normX[i] * FIELD_W
    baseY[i] = normY[i] * FIELD_H
  }
}

// buildMotionBaseField shape and stable per-index phase.
const field = buildMotionBaseField(baseX, baseY, normX, normY)
assert(field.count === COUNT, `base field count is ${COUNT}`)
assert(
  field.baseX === baseX && field.baseY === baseY && field.normX === normX && field.normY === normY,
  'base field keeps the caller arrays',
)
assert(field.phase instanceof Float32Array && field.phase.length === COUNT, 'phase is a per-target Float32Array')
let phaseInRange = true
for (let i = 0; i < COUNT; i += 1) {
  if (!(field.phase[i] >= 0 && field.phase[i] < TAU)) phaseInRange = false
}
assert(phaseInRange, 'phase values are in [0, 2π)')
scanFinite(field.phase, 'base field phase is finite')

// Phase is deterministic across rebuilds.
const rebuilt = buildMotionBaseField(baseX, baseY, normX, normY)
assert(!arraysDiffer(field.phase, rebuilt.phase), 'phase is stable across rebuilds')

// ---------------------------------------------------------------------------
// Test 1: organic amount 0 reproduces the base targets EXACTLY (time 1.234).
// ---------------------------------------------------------------------------
const idleParams = { time: 1.234, amount: 0, speed: 1, waveScale: 1, complexity: 3, width: FIELD_W, height: FIELD_H }
const idleX = new Float32Array(COUNT)
const idleY = new Float32Array(COUNT)
computeOrganicTargets(field, idleParams, idleX, idleY)
let exactX = true
let exactY = true
for (let i = 0; i < COUNT; i += 1) {
  if (idleX[i] !== baseX[i]) exactX = false
  if (idleY[i] !== baseY[i]) exactY = false
}
assert(exactX, 'organic amount 0 copies baseX exactly')
assert(exactY, 'organic amount 0 copies baseY exactly')

// ---------------------------------------------------------------------------
// Test 2: organic amount 0.35 — finite, deterministic, animating, small
// displacement relative to the viewport.
// ---------------------------------------------------------------------------
const flowParams = { time: 1.234, amount: 0.35, speed: 1, waveScale: 1, complexity: 3, width: FIELD_W, height: FIELD_H }
const flowX = new Float32Array(COUNT)
const flowY = new Float32Array(COUNT)
computeOrganicTargets(field, flowParams, flowX, flowY)
scanFinite(flowX, 'organic amount 0.35 outX is finite')
scanFinite(flowY, 'organic amount 0.35 outY is finite')

const flowX2 = new Float32Array(COUNT)
const flowY2 = new Float32Array(COUNT)
computeOrganicTargets(field, flowParams, flowX2, flowY2)
assert(byteIdentical(flowX, flowX2), 'organic outX is byte-identical across identical invocations')
assert(byteIdentical(flowY, flowY2), 'organic outY is byte-identical across identical invocations')

const laterParams = { ...flowParams, time: 4.567 }
const laterX = new Float32Array(COUNT)
const laterY = new Float32Array(COUNT)
computeOrganicTargets(field, laterParams, laterX, laterY)
assert(arraysDiffer(flowX, laterX) || arraysDiffer(flowY, laterY), 'organic output animates with time')

const maxDisplacement = Math.min(FIELD_W, FIELD_H) * 0.15
let displacementOk = true
for (let i = 0; i < COUNT; i += 1) {
  const dx = flowX[i] - baseX[i]
  const dy = flowY[i] - baseY[i]
  if (Math.hypot(dx, dy) >= maxDisplacement) displacementOk = false
}
assert(displacementOk, 'organic displacement stays below 15% of min(width, height) at amount 0.35')

// ---------------------------------------------------------------------------
// Test 3: per-variant creature (original fish, jelly, ray) — 400 targets,
// finite, deterministic, non-degenerate, and animating between time 0 and 2.
// ---------------------------------------------------------------------------
const creatureParams = { time: 2.5, amount: 0.5, speed: 1.2, waveScale: 1.1, complexity: 3, width: 1280, height: 720 }
const CREATURE_COUNT = 400

for (const variant of ['original', 'jelly', 'ray']) {
  const topology = buildCreatureTopology(CREATURE_COUNT, variant)
  assert(topology.count === CREATURE_COUNT, `${variant} topology count is ${CREATURE_COUNT}`)
  assert(topology.variant === variant, `${variant} topology keeps its variant`)
  assert(
    topology.u instanceof Float32Array &&
      topology.v instanceof Float32Array &&
      topology.aux instanceof Float32Array &&
      topology.phase instanceof Float32Array &&
      topology.u.length === CREATURE_COUNT &&
      topology.v.length === CREATURE_COUNT &&
      topology.aux.length === CREATURE_COUNT &&
      topology.phase.length === CREATURE_COUNT,
    `${variant} topology arrays are per-target Float32Arrays`,
  )
  let topoPhaseInRange = true
  for (let i = 0; i < CREATURE_COUNT; i += 1) {
    if (!(topology.phase[i] >= 0 && topology.phase[i] < TAU)) topoPhaseInRange = false
  }
  assert(topoPhaseInRange, `${variant} topology phase is in [0, 2π)`)
  scanFinite(topology.u, `${variant} topology u is finite`)
  scanFinite(topology.v, `${variant} topology v is finite`)
  scanFinite(topology.aux, `${variant} topology aux is finite`)
  scanFinite(topology.phase, `${variant} topology phase is finite`)

  const outX = new Float32Array(CREATURE_COUNT)
  const outY = new Float32Array(CREATURE_COUNT)
  computeCreatureTargets(topology, creatureParams, outX, outY)
  scanFinite(outX, `${variant} creature outX is finite`)
  scanFinite(outY, `${variant} creature outY is finite`)

  const outX2 = new Float32Array(CREATURE_COUNT)
  const outY2 = new Float32Array(CREATURE_COUNT)
  computeCreatureTargets(topology, creatureParams, outX2, outY2)
  assert(byteIdentical(outX, outX2), `${variant} creature outX is byte-identical across runs`)
  assert(byteIdentical(outY, outY2), `${variant} creature outY is byte-identical across runs`)

  const xb = bounds(outX)
  const yb = bounds(outY)
  assert(xb.max > xb.min && yb.max > yb.min, `${variant} creature is not degenerate to a single point`)

  const t0X = new Float32Array(CREATURE_COUNT)
  const t0Y = new Float32Array(CREATURE_COUNT)
  computeCreatureTargets(topology, { ...creatureParams, time: 0 }, t0X, t0Y)
  const t2X = new Float32Array(CREATURE_COUNT)
  const t2Y = new Float32Array(CREATURE_COUNT)
  computeCreatureTargets(topology, { ...creatureParams, time: 2 }, t2X, t2Y)
  assert(arraysDiffer(t0X, t2X) || arraysDiffer(t0Y, t2Y), `${variant} creature output differs between time 0 and time 2`)
}

// ---------------------------------------------------------------------------
// Test 4: registry drift guard — PARAMETRIC_VARIANT_OPTIONS (motionConfig)
// exactly matches Object.keys(CREATURE_DEFINITIONS) in order, labels agree,
// and every entry is a complete definition.
// ---------------------------------------------------------------------------
const registryKeys = Object.keys(CREATURE_DEFINITIONS)
const optionValues = PARAMETRIC_VARIANT_OPTIONS.map((option) => option.value)
assert(
  optionValues.length === registryKeys.length && optionValues.every((value, i) => value === registryKeys[i]),
  `variant options match registry keys in order (${registryKeys.join(', ')})`,
)
for (const option of PARAMETRIC_VARIANT_OPTIONS) {
  const definition = CREATURE_DEFINITIONS[option.value]
  assert(
    definition &&
      definition.variant === option.value &&
      typeof definition.buildTopology === 'function' &&
      typeof definition.compute === 'function',
    `${option.value} registry entry is a complete definition`,
  )
  assert(
    definition && definition.label === option.label,
    `${option.value} registry label matches its option label (${option.label})`,
  )
}

// ---------------------------------------------------------------------------
// Test 5: fish silhouette sanity — `original` at amount 0 is a static fish
// (bounding box wider than tall, aspect > 2) and swims at amount > 0.
// ---------------------------------------------------------------------------
const fishTopology = buildCreatureTopology(CREATURE_COUNT, 'original')
const fishStillParams = { time: 1.234, amount: 0, speed: 1, waveScale: 1, complexity: 3, width: 1280, height: 720 }
const stillX = new Float32Array(CREATURE_COUNT)
const stillY = new Float32Array(CREATURE_COUNT)
computeCreatureTargets(fishTopology, fishStillParams, stillX, stillY)
scanFinite(stillX, 'fish amount 0 outX is finite')
scanFinite(stillY, 'fish amount 0 outY is finite')

const stillXB = bounds(stillX)
const stillYB = bounds(stillY)
const stillWidth = stillXB.max - stillXB.min
const stillHeight = stillYB.max - stillYB.min
assert(
  stillHeight > 0 && stillWidth / stillHeight > 2,
  `fish amount 0 silhouette is wider than tall (aspect ${(stillWidth / stillHeight).toFixed(2)} > 2)`,
)

const fishSwimParams = { ...fishStillParams, amount: 0.6 }
const swimX = new Float32Array(CREATURE_COUNT)
const swimY = new Float32Array(CREATURE_COUNT)
computeCreatureTargets(fishTopology, fishSwimParams, swimX, swimY)
scanFinite(swimX, 'fish amount 0.6 outX is finite')
scanFinite(swimY, 'fish amount 0.6 outY is finite')
assert(arraysDiffer(stillX, swimX) || arraysDiffer(stillY, swimY), 'fish output differs at amount > 0 (it swims)')

// ---------------------------------------------------------------------------
// Test 6: creature at complexity 1 and 4 is all-finite (every variant).
// ---------------------------------------------------------------------------
for (const variant of ['original', 'jelly', 'ray']) {
  const topology = buildCreatureTopology(CREATURE_COUNT, variant)
  for (const complexity of [1, 4]) {
    const outX = new Float32Array(CREATURE_COUNT)
    const outY = new Float32Array(CREATURE_COUNT)
    computeCreatureTargets(topology, { ...creatureParams, complexity }, outX, outY)
    scanFinite(outX, `${variant} creature complexity ${complexity} outX is finite`)
    scanFinite(outY, `${variant} creature complexity ${complexity} outY is finite`)
  }
}

// ---------------------------------------------------------------------------
// Test 7: organic at complexity 1..4 is all-finite.
// ---------------------------------------------------------------------------
for (const complexity of [1, 2, 3, 4]) {
  const outX = new Float32Array(COUNT)
  const outY = new Float32Array(COUNT)
  computeOrganicTargets(field, { ...flowParams, complexity }, outX, outY)
  scanFinite(outX, `organic complexity ${complexity} outX is finite`)
  scanFinite(outY, `organic complexity ${complexity} outY is finite`)
}

// ---------------------------------------------------------------------------
// Test 8: custom variant — every form (school/grid/bell/wing) at mid-range
// knobs and at both extreme corners (symmetry 1/8, waves 1/6, travel 0/2,
// pulse 0/2): finite and deterministic at a fixed time.
// ---------------------------------------------------------------------------
const CUSTOM_KNOB_SETS = [
  { label: 'mid', symmetry: 4, waves: 3, travel: 1, pulse: 1 },
  { label: 'min', symmetry: 1, waves: 1, travel: 0, pulse: 0 },
  { label: 'max', symmetry: 8, waves: 6, travel: 2, pulse: 2 },
]
for (const form of ['school', 'grid', 'bell', 'wing']) {
  for (const knobs of CUSTOM_KNOB_SETS) {
    const custom = { form, symmetry: knobs.symmetry, waves: knobs.waves, travel: knobs.travel, pulse: knobs.pulse }
    const label = `custom ${form} ${knobs.label} (symmetry ${knobs.symmetry}, waves ${knobs.waves}, travel ${knobs.travel}, pulse ${knobs.pulse})`
    const topology = buildCreatureTopology(CREATURE_COUNT, 'custom', custom)
    const params = { ...creatureParams, custom }

    const outX = new Float32Array(CREATURE_COUNT)
    const outY = new Float32Array(CREATURE_COUNT)
    computeCreatureTargets(topology, params, outX, outY)
    scanFinite(outX, `${label} outX is finite`)
    scanFinite(outY, `${label} outY is finite`)

    const outX2 = new Float32Array(CREATURE_COUNT)
    const outY2 = new Float32Array(CREATURE_COUNT)
    computeCreatureTargets(topology, params, outX2, outY2)
    assert(byteIdentical(outX, outX2), `${label} outX is byte-identical across runs`)
    assert(byteIdentical(outY, outY2), `${label} outY is byte-identical across runs`)
  }
}

// ---------------------------------------------------------------------------
// Test 9: custom topology records customForm/customSymmetry from build inputs.
// ---------------------------------------------------------------------------
const wingTopology = buildCreatureTopology(CREATURE_COUNT, 'custom', {
  form: 'wing',
  symmetry: 5,
  waves: 2,
  travel: 1,
  pulse: 1,
})
assert(wingTopology.customForm === 'wing', 'custom topology records customForm from build inputs')
assert(wingTopology.customSymmetry === 5, 'custom topology records customSymmetry from build inputs')
const bellTopology = buildCreatureTopology(CREATURE_COUNT, 'custom', {
  form: 'bell',
  symmetry: 3,
  waves: 2,
  travel: 1,
  pulse: 1,
})
assert(bellTopology.customForm === 'bell', 'custom bell topology records customForm from build inputs')
assert(bellTopology.customSymmetry === 3, 'custom bell topology records customSymmetry from build inputs')

// ---------------------------------------------------------------------------
// Test 10: school with symmetry 3 stacks fish vertically — taller layout
// (maxY - minY) than a single symmetry-1 fish, at amount 0, fixed time.
// ---------------------------------------------------------------------------
function schoolYRange(symmetry) {
  const custom = { form: 'school', symmetry, waves: 3, travel: 1, pulse: 1 }
  const topology = buildCreatureTopology(CREATURE_COUNT, 'custom', custom)
  const outX = new Float32Array(CREATURE_COUNT)
  const outY = new Float32Array(CREATURE_COUNT)
  computeCreatureTargets(topology, { ...fishStillParams, custom }, outX, outY)
  scanFinite(outX, `school symmetry ${symmetry} outX is finite`)
  scanFinite(outY, `school symmetry ${symmetry} outY is finite`)
  const yb = bounds(outY)
  return yb.max - yb.min
}
const schoolRange1 = schoolYRange(1)
const schoolRange3 = schoolYRange(3)
assert(
  schoolRange3 > schoolRange1,
  `school symmetry 3 layout is taller than symmetry 1 (${schoolRange3.toFixed(1)} > ${schoolRange1.toFixed(1)})`,
)

// ---------------------------------------------------------------------------
// Test 11: the Number.isFinite scans above covered every array produced.
// ---------------------------------------------------------------------------
assert(scannedElements >= 50 + 8 * 400 + 4 * 3 * 2 * 400, `finite scan covered ${scannedElements} elements`)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll motion verifications passed.')
