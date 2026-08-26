#!/usr/bin/env node
/**
 * Deterministic verification for the Vibe memento modules
 * (engine/vibeMemento.ts): the engagement tracker (step/tool/element
 * qualifiers, raw-transaction step counting vs the undo history's same-key
 * coalescing, no tool credit for motion/ambient config keys), memento
 * build/serialize/hash/parse/restore round-trips (Float32Array <-> rounded
 * number[] points, deterministic key-sorted stringify, capturedAt- and
 * mediaKey-independent SHA-256 config hash), defensive parsing, and the
 * builtin/preset/upload source mapping.
 *
 * Compile TS to tmp-verify-vibe-memento, assert in Node — the standard idiom.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-vibe-memento')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'vibeMemento.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  VIBE_MEMENTO_MIN_STEPS,
  VIBE_MEMENTO_MIN_TOOLS,
  createVibeMementoTracker,
  buildVibeMemento,
  stableStringify,
  mementoConfigHash,
  parseVibeMemento,
  mementoToVibeSnapshot,
} = require(path.join(tmpDir, 'vibeMemento.js'))
const {
  cloneVibeConfig,
  createEmptyVibeSnapshot,
} = require(path.join(tmpDir, 'vibeHistory.js'))
const { APPROVED_PLAYGROUND_DEFAULTS } = require(path.join(tmpDir, 'playgroundConfig.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const BASE_CONFIG = cloneVibeConfig(APPROVED_PLAYGROUND_DEFAULTS)
const BASE_PAINT_TOOL = {
  enabled: false,
  tool: 'paint',
  glyphColor: '#8abaff',
  backgroundColor: 'none',
  brushDiameter: 48,
}

function configWith(patch) {
  return { ...cloneVibeConfig(BASE_CONFIG), ...patch }
}

function snap(overrides = {}) {
  const base = createEmptyVibeSnapshot(BASE_CONFIG, BASE_PAINT_TOOL)
  return {
    config: overrides.config ? cloneVibeConfig(overrides.config) : base.config,
    paintTool: overrides.paintTool ? { ...overrides.paintTool } : base.paintTool,
    paint: overrides.paint ? overrides.paint : base.paint,
    upload: overrides.upload !== undefined ? overrides.upload : base.upload,
  }
}

function tx(kind, key, before, after) {
  return { kind, key, before: before ?? snap(), after: after ?? snap() }
}

function configTx(key) {
  return tx('config', key, snap(), snap({ config: configWith({ glyphSizePt: 16 }) }))
}

function samplePaint() {
  return {
    strokes: [
      {
        tool: 'paint',
        glyphColor: 16711680,
        backgroundColor: null,
        radiusNorm: 0.05,
        points: Float32Array.from([0.123456789, 0.25, 0.5, 0.987654321]),
      },
      {
        tool: 'erase',
        glyphColor: null,
        backgroundColor: 255,
        radiusNorm: 0.1,
        points: Float32Array.from([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]),
      },
    ],
    redoStrokes: [
      {
        tool: 'paint',
        glyphColor: 42,
        backgroundColor: null,
        radiusNorm: 0.02,
        points: Float32Array.from([0.9, 0.9]),
      },
    ],
  }
}

// --- tracker: thresholds ------------------------------------------------------

{
  const tracker = createVibeMementoTracker()
  for (let i = 0; i < VIBE_MEMENTO_MIN_STEPS - 1; i += 1) {
    tracker.recordTransaction(configTx(`glyphPalette.${i}`))
  }
  assert(
    tracker.getStepCount() === VIBE_MEMENTO_MIN_STEPS - 1 && !tracker.isQualified(),
    'tracker: below every threshold, nothing qualifies',
  )

  tracker.recordTransaction(configTx('glyphPalette.4'))
  assert(
    tracker.qualifiers().includes('steps'),
    'tracker: five recorded transactions earn the steps qualifier',
  )
  assert(tracker.isQualified(), 'tracker: any qualifier flips isQualified')

  const toolTracker = createVibeMementoTracker()
  toolTracker.recordTransaction(tx('source', null))
  toolTracker.recordTransaction(tx('text', null))
  toolTracker.recordTransaction(tx('paint-stroke', null))
  assert(
    toolTracker.getToolCount() === VIBE_MEMENTO_MIN_TOOLS &&
      toolTracker.qualifiers().includes('tools'),
    'tracker: three distinct tool categories (upload/text/paint) earn the tools qualifier',
  )

  const elementTracker = createVibeMementoTracker()
  elementTracker.touchElement('toolbar')
  elementTracker.touchElement('carousel')
  elementTracker.touchElement('music')
  assert(!elementTracker.qualifiers().includes('elements'), 'tracker: three of four elements is not enough')
  elementTracker.touchElement('pond')
  assert(
    elementTracker.qualifiers().includes('elements'),
    'tracker: touching all four elements earns the elements qualifier',
  )
  assert(
    elementTracker.getElementsTouched().has('carousel') && elementTracker.getElementsTouched().size === 4,
    'tracker: getElementsTouched reports the touched set',
  )
}

// --- tracker: qualifier order --------------------------------------------------

{
  const tracker = createVibeMementoTracker()
  for (let i = 0; i < 5; i += 1) tracker.recordTransaction(configTx(`glyphPalette.${i}`))
  tracker.recordTransaction(tx('source', null))
  tracker.recordTransaction(tx('text', null))
  for (const el of ['carousel', 'music', 'pond']) tracker.touchElement(el)
  assert(
    tracker.qualifiers().join(',') === 'steps,tools,elements',
    'tracker: qualifiers are ordered steps, tools, elements',
  )
}

// --- tracker: tool-category mapping --------------------------------------------

{
  const tracker = createVibeMementoTracker()
  tracker.recordTransaction(tx('preset', null))
  tracker.recordTransaction(tx('clear-paint', null))
  tracker.recordTransaction(configTx('backgroundColor1'))
  tracker.recordTransaction(configTx('glyphColorMode'))
  tracker.recordTransaction(configTx('glyphFont'))
  tracker.recordTransaction(configTx('glyphSizePt'))
  assert(
    tracker.getToolCount() === 4,
    'tracker: preset->upload, clear-paint->paint, backgroundColor1/glyphColorMode->colorStyles, glyphFont/glyphSizePt->text',
  )

  const noCredit = createVibeMementoTracker()
  noCredit.recordTransaction(configTx('motion.amount'))
  noCredit.recordTransaction(configTx('ambient.mode'))
  assert(
    noCredit.getStepCount() === 2 && noCredit.getToolCount() === 0,
    'tracker: motion.*/ambient.* config keys count steps but earn no tool credit',
  )
  assert(
    noCredit.getElementsTouched().has('toolbar'),
    'tracker: recording any transaction touches the toolbar element',
  )
}

// --- tracker: raw transactions count as steps (pre-coalescing) ------------------

{
  // The undo history would coalesce same-key config transactions into ONE
  // entry; the tracker deliberately counts the RAW recorded transactions, so
  // repeated slider nudges still accrue engagement steps.
  const tracker = createVibeMementoTracker()
  for (let i = 0; i < VIBE_MEMENTO_MIN_STEPS; i += 1) {
    tracker.recordTransaction(configTx('motion.amount'))
  }
  assert(
    tracker.getStepCount() === VIBE_MEMENTO_MIN_STEPS &&
      tracker.qualifiers().includes('steps'),
    'tracker: repeated same-key transactions (coalesced by the undo history) still count as steps',
  )
  assert(tracker.getToolCount() === 0, 'tracker: the coalesced motion run earns no tool credit')
}

// --- round-trip: build / stringify / parse / restore ----------------------------

const CAPTURED_AT = 1756000000

function sampleMemento() {
  return buildVibeMemento(
    snap({
      paint: samplePaint(),
      upload: { kind: 'svg', url: '/assets/vibe/sample-mark.svg', filename: 'sample source' },
    }),
    { capturedAt: CAPTURED_AT },
  )
}

{
  const memento = sampleMemento()
  assert(memento.version === 1 && memento.capturedAt === CAPTURED_AT, 'round-trip: version and capturedAt are set')
  assert(memento.paint.strokes.length === 2, 'round-trip: both paint strokes are serialized')
  assert(
    memento.paint.strokes[0].points.every((p) => typeof p === 'number') &&
      memento.paint.strokes[0].points[0] === 0.1235 &&
      memento.paint.strokes[0].points[3] === 0.9877,
    'round-trip: Float32Array points flatten to number[] rounded to 4 decimals',
  )
  assert(
    memento.source.kind === 'preset' && memento.source.url === '/assets/vibe/sample-mark.svg',
    'round-trip: an /assets/ upload ref maps to a preset source',
  )
  // The memento must be JSON-safe end to end.
  JSON.parse(JSON.stringify(memento))

  const reparsed = parseVibeMemento(JSON.parse(JSON.stringify(memento)))
  assert(
    reparsed !== null && stableStringify(reparsed) === stableStringify(memento),
    'round-trip: parseVibeMemento accepts a JSON round-trip and deep-equals the input',
  )

  const restored = mementoToVibeSnapshot(memento)
  assert(
    restored.paint.strokes.length === 2 &&
      restored.paint.strokes[0].points instanceof Float32Array &&
      restored.paint.redoStrokes.length === 0,
    'round-trip: restore rebuilds Float32Array points with an empty redo stack',
  )
  const originalPoints = samplePaint().strokes[0].points
  const restoredPoints = restored.paint.strokes[0].points
  let withinRounding = restoredPoints.length === originalPoints.length
  for (let i = 0; i < originalPoints.length && withinRounding; i += 1) {
    withinRounding = Math.abs(restoredPoints[i] - originalPoints[i]) <= 1e-4
  }
  assert(withinRounding, 'round-trip: restored point values match the originals within the 4-decimal rounding')
  assert(
    restored.upload &&
      restored.upload.kind === 'svg' &&
      restored.upload.url === '/assets/vibe/sample-mark.svg' &&
      restored.upload.filename === 'sample-mark.svg',
    'round-trip: a preset source restores an svg upload ref with the filename from the URL',
  )
  assert(
    JSON.stringify(restored.config) === JSON.stringify(BASE_CONFIG) &&
      JSON.stringify(restored.paintTool) === JSON.stringify(BASE_PAINT_TOOL),
    'round-trip: config and paint tool survive the round-trip exactly',
  )
}

// --- pond field: optional, round-trips, participates in the hash ---------------

const pondedMemento = buildVibeMemento(snap(), {
  capturedAt: CAPTURED_AT,
  pond: { enabled: true, character: 'jelly' },
})
{
  assert(
    pondedMemento.pond?.enabled === true && pondedMemento.pond.character === 'jelly',
    'pond: buildVibeMemento carries the pond field when provided',
  )
  assert(
    sampleMemento().pond === undefined,
    'pond: omitted when the piece was saved pondless',
  )
  const reparsed = parseVibeMemento(JSON.parse(JSON.stringify(pondedMemento)))
  assert(
    reparsed !== null && stableStringify(reparsed) === stableStringify(pondedMemento),
    'pond: parseVibeMemento round-trips the pond field',
  )
  assert(
    parseVibeMemento({ ...JSON.parse(JSON.stringify(pondedMemento)), pond: { enabled: 'yes' } }) === null &&
      parseVibeMemento({ ...JSON.parse(JSON.stringify(pondedMemento)), pond: { enabled: true, character: 'shark' } }) === null,
    'pond: malformed pond payloads are rejected',
  )
}

// --- stableStringify determinism ------------------------------------------------

{
  const a = { z: 1, a: { y: [3, 2, 1], b: 'x' }, m: null }
  const b = { m: null, a: { b: 'x', y: [3, 2, 1] }, z: 1 }
  assert(
    stableStringify(a) === stableStringify(b),
    'stableStringify: key insertion order does not change the output',
  )
  assert(
    stableStringify({ a: 1, b: [true, null, 's'] }) === '{"a":1,"b":[true,null,"s"]}',
    'stableStringify: output is compact, sorted, and JSON-shaped',
  )
}

// --- defensive parsing -----------------------------------------------------------

{
  assert(parseVibeMemento(null) === null, 'parse: null is rejected')
  assert(parseVibeMemento('string') === null, 'parse: a bare string is rejected')
  assert(parseVibeMemento({ version: 2 }) === null, 'parse: a wrong version is rejected')
  assert(parseVibeMemento({ version: 1 }) === null, 'parse: missing sections are rejected')

  const memento = sampleMemento()
  const badStroke = JSON.parse(JSON.stringify(memento))
  badStroke.paint.strokes[0].points = [0.1, 0.2, 0.3] // odd length
  assert(parseVibeMemento(badStroke) === null, 'parse: an odd-length points array is rejected')

  const badSource = JSON.parse(JSON.stringify(memento))
  badSource.source = { kind: 'mystery' }
  assert(parseVibeMemento(badSource) === null, 'parse: an unknown source kind is rejected')

  const badConfig = JSON.parse(JSON.stringify(memento))
  delete badConfig.config.glyphPalette
  assert(parseVibeMemento(badConfig) === null, 'parse: a config missing a required key is rejected')
}

// --- upload mapping ---------------------------------------------------------------

{
  const blobMemento = buildVibeMemento(
    snap({ upload: { kind: 'raster', url: 'blob:mock-upload', filename: 'photo.png' } }),
  )
  assert(
    blobMemento.source.kind === 'upload' && blobMemento.source.mediaKey === 'pending',
    "upload mapping: a blob: URL maps to an upload source with mediaKey 'pending'",
  )
  const restoredUpload = mementoToVibeSnapshot({
    ...blobMemento,
    source: { kind: 'upload', mediaKey: 'abc123' },
  })
  assert(
    restoredUpload.upload &&
      restoredUpload.upload.url === '/api/creations/media/abc123' &&
      restoredUpload.upload.filename === 'creation-source' &&
      restoredUpload.upload.kind === 'raster',
    'upload mapping: an upload source restores the server media URL (raster when no .svg extension)',
  )

  const dataMemento = buildVibeMemento(
    snap({ upload: { kind: 'raster', url: 'data:image/png;base64,AAAA', filename: 'pasted.png' } }),
  )
  assert(dataMemento.source.kind === 'upload', 'upload mapping: a data: URL also maps to an upload source')

  const nullMemento = buildVibeMemento(snap({ upload: null }))
  assert(
    nullMemento.source.kind === 'builtin' && mementoToVibeSnapshot(nullMemento).upload === null,
    'upload mapping: a null upload ref maps to builtin and restores to null',
  )
}

// --- config hash (async) ----------------------------------------------------------

async function main() {
  const memento = sampleMemento()
  const hashA = await mementoConfigHash(memento)
  const hashB = await mementoConfigHash(sampleMemento())
  assert(
    /^[0-9a-f]{64}$/.test(hashA) && hashA === hashB,
    'hash: two identical mementos produce the same 64-char hex digest',
  )

  const later = buildVibeMemento(
    snap({
      paint: samplePaint(),
      upload: { kind: 'svg', url: '/assets/vibe/sample-mark.svg', filename: 'sample source' },
    }),
    { capturedAt: CAPTURED_AT + 3600 },
  )
  assert(
    (await mementoConfigHash(later)) === hashA,
    'hash: capturedAt is excluded from the digest',
  )

  const pendingUpload = { ...memento, source: { kind: 'upload', mediaKey: 'pending' } }
  const assignedUpload = { ...memento, source: { kind: 'upload', mediaKey: 'server-assigned-id' } }
  assert(
    (await mementoConfigHash(pendingUpload)) === (await mementoConfigHash(assignedUpload)),
    'hash: the upload mediaKey is normalized out of the digest',
  )

  assert(
    (await mementoConfigHash(pondedMemento)) !== hashA,
    'hash: a pond piece hashes differently from its pondless twin',
  )
  assert(
    (await mementoConfigHash({ ...pondedMemento, capturedAt: CAPTURED_AT + 99 })) ===
      (await mementoConfigHash(pondedMemento)),
    'hash: digest is stable across capturedAt with pond present',
  )

  const recolored = sampleMemento()
  recolored.config.glyphPalette[0] = '#123456'
  assert(
    (await mementoConfigHash(recolored)) !== hashA,
    'hash: changing a palette color changes the digest',
  )

  const restroked = sampleMemento()
  restroked.paint.strokes[0].points[0] = 0.5
  assert(
    (await mementoConfigHash(restroked)) !== hashA,
    'hash: changing a paint stroke changes the digest',
  )

  if (failures > 0) {
    console.error(`\n${failures} verification(s) failed.`)
    process.exit(1)
  }

  console.log('\nAll vibe memento verifications passed.')
}

main().catch((error) => {
  console.error('Verification crashed:', error)
  process.exit(1)
})
