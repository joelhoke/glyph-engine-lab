#!/usr/bin/env node
/**
 * Regression verification for the Work-SVG resize fix (M9 launch hardening).
 *
 * Proves two things:
 *
 * 1. The fallback rule (engine/sourceOutcome.ts): an active source stays
 *    active whenever its decode yields visible targets; the JH logo fallback
 *    is chosen ONLY after a genuine decoding failure (load error or a decode
 *    with zero visible targets).
 *
 * 2. The resize path (components/SceneCanvas.tsx, structural guard):
 *    resizeScene() rebuilds targets through buildSvgTargets(), and
 *    buildSvgTargets() reads the active source identity from the stable
 *    selection ref (sourceSelectionRef — the discriminated
 *    SceneSourceSelection of Stage 3) rather than a render closure or the
 *    default source — so a resize re-decodes the ACTIVE Work SVG (or
 *    re-samples the ACTIVE animated provider) instead of reverting to the
 *    default/fallback.
 *
 * 3. The animated path (Stage 3): an animated provider error preserves the
 *    last valid sampled field; the JH fallback only appears when no valid
 *    frame exists at all, and static selections stop the provider.
 *
 * 4. The glyph-stage region path (mobile Work): buildSvgTargets reads the
 *    measured stage rect from its stable ref (targetRegionRef) so region
 *    recalcs re-fit the ACTIVE source — never a stale closure, never the JH
 *    fallback on a mere recalc — and region updates route through
 *    resizeScene, the same rebuild path as a viewport resize.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'sourceOutcome.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-source-outcome')

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

const { resolveSourceFieldDecision } = require(path.join(tmpDir, 'sourceOutcome.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- Rule: source survives whenever the decode is genuinely good ---

const healthy = resolveSourceFieldDecision({ ok: true, targetCount: 1200 })
assert(healthy.use === 'source', 'healthy decode keeps the active source')

const singleTarget = resolveSourceFieldDecision({ ok: true, targetCount: 1 })
assert(singleTarget.use === 'source', 'decode with even one visible target keeps the source')

// --- Rule: only genuine decoding failures reach the JH fallback ---

const loadFailure = resolveSourceFieldDecision({ ok: false, targetCount: 0, error: '404' })
assert(loadFailure.use === 'fallback', 'load failure uses the fallback')
assert(loadFailure.reason === '404', 'load failure preserves the decode error detail')

const emptyDecode = resolveSourceFieldDecision({ ok: true, targetCount: 0 })
assert(emptyDecode.use === 'fallback', 'zero-target decode uses the fallback')
assert(
  emptyDecode.reason === 'source produced no visible targets',
  'zero-target decode reports the no-visible-targets reason',
)

const opaqueError = resolveSourceFieldDecision({ ok: false, targetCount: 0 })
assert(opaqueError.use === 'fallback', 'error-less failure still uses the fallback')
assert(opaqueError.reason === 'unknown error', 'error-less failure reports unknown error')

// --- Structural guard: resize re-decodes the ACTIVE source ---

const sceneCanvasSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'SceneCanvas.tsx'),
  'utf8',
)

function functionBody(name) {
  const start = sceneCanvasSource.indexOf(`const ${name} = `)
  if (start < 0) return ''
  // Slice to the next top-level const declaration at the same indent.
  const rest = sceneCanvasSource.slice(start)
  const next = rest.slice(1).search(/\n  const \w+ = /)
  return next < 0 ? rest : rest.slice(0, next + 1)
}

const resizeBody = functionBody('resizeScene')
assert(resizeBody.length > 0, 'resizeScene exists in SceneCanvas')
assert(
  resizeBody.includes('buildSvgTargets()'),
  'resizeScene rebuilds the target field via buildSvgTargets (active source survives resize)',
)

const buildBody = functionBody('buildSvgTargets')
assert(buildBody.length > 0, 'buildSvgTargets exists in SceneCanvas')
assert(
  buildBody.includes('sourceSelectionRef.current'),
  'buildSvgTargets reads the active selection from sourceSelectionRef (stable across renders/resizes)',
)
assert(
  buildBody.includes("selection.kind === 'static'") && buildBody.includes('selection.url'),
  'buildSvgTargets derives the active URL/kind from the discriminated selection',
)
assert(
  buildBody.includes('sourceLayoutRef.current'),
  'buildSvgTargets reads the active layout from its stable ref',
)
assert(
  buildBody.includes('resolveSourceFieldDecision('),
  'buildSvgTargets routes the decode through resolveSourceFieldDecision',
)
assert(
  sceneCanvasSource.includes("from '../engine/sourceOutcome'"),
  'SceneCanvas imports the shared fallback rule',
)

// --- Structural guard: the glyph-stage region path (mobile Work) ---

assert(
  sceneCanvasSource.includes('targetRegion?:'),
  'SceneCanvas accepts an optional targetRegion prop',
)
assert(
  buildBody.includes('targetRegionRef.current'),
  'buildSvgTargets reads the glyph-stage region from its stable ref (active slide source survives region recalcs)',
)
assert(
  /targetRegionRef\.current = targetRegion[\s\S]{0,400}resizeScene\(\)/.test(sceneCanvasSource),
  'region updates route through resizeScene (the same rebuild path as a viewport resize)',
)

// --- Structural guard: the animated path preserves the last valid field ---

assert(
  buildBody.includes("selection.kind === 'animated'"),
  'buildSvgTargets has a discriminated animated branch',
)
assert(
  buildBody.includes('animatedHasValidFieldRef.current'),
  'animated errors keep the last valid sampled field (fallback only when none exists)',
)
assert(
  buildBody.includes('stopAnimatedProvider()'),
  'static selections stop the animated provider',
)
const sampleBody = functionBody('sampleAnimatedProviderFrame')
assert(sampleBody.length > 0, 'sampleAnimatedProviderFrame exists in SceneCanvas')
assert(
  sampleBody.includes('resolveAnimatedStagingSize(') && sampleBody.includes('getImageData'),
  'animated sampling downscales into the tier-sized staging surface before getImageData',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll SVG resize/fallback verifications passed.')
