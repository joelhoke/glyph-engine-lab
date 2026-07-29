#!/usr/bin/env node
/**
 * Deterministic verification for engine/paint.ts.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'paint.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-paint')

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
  PAINT_MAX_STROKES,
  PAINT_MAX_POINTS,
  createPaintHistory,
  pushStroke,
  popStroke,
  clearPaintHistory,
  buildTargetSpatialIndex,
  stampPoint,
  stampStroke,
  replayPaintHistory,
  countPaintedTargets,
  countBackgroundStrokes,
  appendInterpolatedPoints,
} = require(path.join(tmpDir, 'paint.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// Non-zero opaque packed-RGBA test colors (0 is the unpainted sentinel).
const COLOR_A = 0xff0000ff
const COLOR_B = 0xff00ff00
const BG_COLOR = 0xffc86400

function makeStroke(tool, glyphColor, backgroundColor, radiusNorm, points) {
  return { tool, glyphColor, backgroundColor, radiusNorm, points: Float32Array.from(points) }
}

// history bounds constants
assert(PAINT_MAX_STROKES === 100, 'PAINT_MAX_STROKES is 100')
assert(PAINT_MAX_POINTS === 20000, 'PAINT_MAX_POINTS is 20000')

// createPaintHistory
const fresh = createPaintHistory()
assert(Array.isArray(fresh.strokes) && fresh.strokes.length === 0, 'new history has empty strokes')
assert(fresh.totalPoints === 0, 'new history has zero totalPoints')

// (1) stamping: two targets, paint/overwrite/erase at one spot
{
  const x = Float32Array.from([10, 90])
  const y = Float32Array.from([10, 90])
  const index = buildTargetSpatialIndex(x, y, 100, 100)
  const painted = new Uint32Array(2)

  const delta1 = stampPoint(index, 'paint', COLOR_A, 10, 10, 15, painted)
  assert(delta1 === 1, 'paint stamp delta is 1')
  assert(painted[0] === COLOR_A, 'paint stamp paints target 0')
  assert(painted[1] === 0, 'paint stamp leaves distant target 1 unpainted')

  const delta2 = stampPoint(index, 'paint', COLOR_B, 10, 10, 15, painted)
  assert(delta2 === 0, 're-stamp with new color keeps delta 0')
  assert(painted[0] === COLOR_B, 're-stamp overwrites the color')

  const delta3 = stampPoint(index, 'erase', 0, 10, 10, 15, painted)
  assert(delta3 === -1, 'erase stamp delta is -1')
  assert(painted[0] === 0, 'erase stamp zeroes target (reveals base)')
}

// (2) undo/redo via popStroke/pushStroke + replay
{
  const x = Float32Array.from([10, 90])
  const y = Float32Array.from([10, 90])
  const index = buildTargetSpatialIndex(x, y, 100, 100)
  const painted = new Uint32Array(2)
  const history = createPaintHistory()
  const strokeA = makeStroke('paint', COLOR_A, null, 0.15, [0.1, 0.1])
  const strokeB = makeStroke('paint', COLOR_B, null, 0.15, [0.9, 0.9])

  pushStroke(history, strokeA)
  pushStroke(history, strokeB)
  assert(replayPaintHistory(history, index, painted) === 2, 'replay with A and B paints 2 targets')

  const popped = popStroke(history)
  assert(popped === strokeB, 'popStroke returns the newest stroke')
  const undoCount = replayPaintHistory(history, index, painted)
  assert(undoCount === 1, 'replay after undo paints 1 target')
  assert(painted[0] === COLOR_A && painted[1] === 0, 'undo leaves only A marks')

  pushStroke(history, strokeB)
  const redoCount = replayPaintHistory(history, index, painted)
  assert(redoCount === 2, 'replay after redo paints 2 targets')
  assert(painted[0] === COLOR_A && painted[1] === COLOR_B, 'redo restores both marks')

  popStroke(history)
  popStroke(history)
  assert(popStroke(history) === null, 'popStroke on empty history returns null')
}

// (3) bounded history: stroke-count and point-count eviction
{
  const history = createPaintHistory()
  let evicted = false
  let evictedAt101 = false
  for (let i = 0; i < 110; i += 1) {
    const didEvict = pushStroke(history, makeStroke('paint', COLOR_A, null, 0.05, [0.5, 0.5]))
    evicted = evicted || didEvict
    if (i === 100) evictedAt101 = didEvict
  }
  assert(history.strokes.length === 100, 'history capped at 100 strokes')
  assert(evicted, 'pushing past 100 strokes reports eviction')
  assert(evictedAt101, 'the 101st push itself reports eviction')

  const pointsHistory = createPaintHistory()
  const big = makeStroke('paint', COLOR_A, null, 0.05, new Array(19000 * 2).fill(0.5))
  const small = makeStroke('paint', COLOR_A, null, 0.05, new Array(2000 * 2).fill(0.5))
  const bigEvicted = pushStroke(pointsHistory, big)
  assert(!bigEvicted, '19000-point stroke fits without eviction')
  const smallEvicted = pushStroke(pointsHistory, small)
  assert(smallEvicted, 'pushing past 20000 total points reports eviction')
  assert(pointsHistory.totalPoints <= 20000, 'totalPoints stays within bound')
  assert(pointsHistory.totalPoints === 2000, 'oldest stroke evicted, only the 2000-point stroke remains')
}

// (4) clearPaintHistory
{
  const history = createPaintHistory()
  pushStroke(history, makeStroke('paint', COLOR_A, null, 0.05, [0.1, 0.1, 0.2, 0.2]))
  clearPaintHistory(history)
  assert(history.strokes.length === 0, 'clearPaintHistory empties strokes')
  assert(history.totalPoints === 0, 'clearPaintHistory zeroes totalPoints')
}

// (5) resize replay: normalized history is viewport-independent
{
  const history = createPaintHistory()
  pushStroke(history, makeStroke('paint', COLOR_A, null, 0.1, [0.5, 0.5]))

  const indexA = buildTargetSpatialIndex(Float32Array.from([50]), Float32Array.from([50]), 100, 100)
  const paintedA = new Uint32Array(1)
  const countA = replayPaintHistory(history, indexA, paintedA)
  assert(countA === 1 && paintedA[0] === COLOR_A, 'replay paints target at (50,50) in 100x100')

  const indexB = buildTargetSpatialIndex(Float32Array.from([100]), Float32Array.from([25]), 200, 50)
  const paintedB = new Uint32Array(1)
  const countB = replayPaintHistory(history, indexB, paintedB)
  assert(countB === 1 && paintedB[0] === COLOR_A, 'replay paints same normalized target in 200x50')
}

// (6) appendInterpolatedPoints
{
  const out = []
  appendInterpolatedPoints(out, 0, 0, 100, 0, 10, 100, 100)
  assert(out.length === 20, 'interpolation appends 10 points (20 numbers)')
  assert(Math.abs(out[0] - 0.1) < 1e-6 && out[1] === 0, 'first appended point is x≈0.1 (start excluded)')
  assert(out[18] === 1.0 && out[19] === 0, 'last appended point is x===1.0 (end included)')

  const zero = []
  appendInterpolatedPoints(zero, 50, 50, 50, 50, 10, 100, 100)
  assert(zero.length === 2, 'zero-length segment appends exactly one point')
  assert(zero[0] === 0.5 && zero[1] === 0.5, 'zero-length point lands on the segment position')
}

// (7) countPaintedTargets matches manual count after mixed paint/erase
{
  const x = Float32Array.from([10, 20, 90])
  const y = Float32Array.from([10, 10, 90])
  const index = buildTargetSpatialIndex(x, y, 100, 100)
  const painted = new Uint32Array(3)
  const history = createPaintHistory()
  pushStroke(history, makeStroke('paint', COLOR_A, null, 0.1, [0.15, 0.1]))
  pushStroke(history, makeStroke('erase', null, null, 0.06, [0.2, 0.1]))
  const replayed = replayPaintHistory(history, index, painted)
  let manual = 0
  for (let i = 0; i < painted.length; i += 1) {
    if (painted[i] !== 0) manual += 1
  }
  assert(countPaintedTargets(painted) === manual, 'countPaintedTargets matches manual count')
  assert(replayed === manual, 'replayPaintHistory return matches manual count')
  assert(manual === 1 && painted[0] === COLOR_A && painted[1] === 0 && painted[2] === 0, 'paint then erase leaves only target 0')
}

// (8) replayPaintHistory with empty history zeroes the painted array
{
  const index = buildTargetSpatialIndex(Float32Array.from([10, 90]), Float32Array.from([10, 90]), 100, 100)
  const painted = Uint32Array.from([COLOR_A, COLOR_B])
  const count = replayPaintHistory(createPaintHistory(), index, painted)
  assert(count === 0, 'empty-history replay returns 0')
  assert(painted[0] === 0 && painted[1] === 0, 'empty-history replay zeroes the painted array')
}

// stampStroke return value agrees with stampPoint deltas
{
  const x = Float32Array.from([10, 12])
  const y = Float32Array.from([10, 10])
  const index = buildTargetSpatialIndex(x, y, 100, 100)
  const painted = new Uint32Array(2)
  const delta = stampStroke(index, makeStroke('paint', COLOR_A, null, 0.1, [0.1, 0.1, 0.12, 0.1]), painted)
  assert(delta === 2, 'stampStroke sums per-point deltas')
}

// (9) paint stroke with glyphColor null leaves the glyph channel untouched
{
  const x = Float32Array.from([10, 90])
  const y = Float32Array.from([10, 90])
  const index = buildTargetSpatialIndex(x, y, 100, 100)
  const painted = new Uint32Array(2)
  stampStroke(index, makeStroke('paint', COLOR_A, null, 0.15, [0.1, 0.1]), painted)
  const before = Array.from(painted)
  const delta = stampStroke(index, makeStroke('paint', null, BG_COLOR, 0.15, [0.1, 0.1, 0.9, 0.9]), painted)
  assert(delta === 0, 'paint stroke with null glyphColor returns delta 0')
  assert(painted[0] === before[0] && painted[1] === before[1], 'paint stroke with null glyphColor leaves the painted array unchanged')
}

// (10) erase stroke with both channel colors null still clears glyph overrides
{
  const x = Float32Array.from([10, 90])
  const y = Float32Array.from([10, 90])
  const index = buildTargetSpatialIndex(x, y, 100, 100)
  const painted = new Uint32Array(2)
  stampStroke(index, makeStroke('paint', COLOR_A, null, 0.15, [0.1, 0.1]), painted)
  assert(painted[0] === COLOR_A, 'setup: target 0 painted before null-color erase')
  const delta = stampStroke(index, makeStroke('erase', null, null, 0.15, [0.1, 0.1]), painted)
  assert(delta === -1, 'erase stroke with null channel colors returns delta -1')
  assert(painted[0] === 0, 'erase stroke with null channel colors still clears the glyph override')
}

// (11) countBackgroundStrokes counts background-channel strokes only
{
  const emptyHistory = createPaintHistory()
  assert(countBackgroundStrokes(emptyHistory) === 0, 'countBackgroundStrokes of empty history is 0')

  const history = createPaintHistory()
  pushStroke(history, makeStroke('paint', COLOR_A, null, 0.1, [0.1, 0.1]))
  pushStroke(history, makeStroke('paint', COLOR_A, BG_COLOR, 0.1, [0.2, 0.2]))
  pushStroke(history, makeStroke('erase', null, null, 0.1, [0.3, 0.3]))
  assert(countBackgroundStrokes(history) === 2, 'countBackgroundStrokes counts background paint and erase, skips glyph-only paint')
}

// (12) pushStroke/popStroke preserve the backgroundColor field
{
  const history = createPaintHistory()
  const stroke = makeStroke('paint', COLOR_A, BG_COLOR, 0.1, [0.1, 0.1])
  pushStroke(history, stroke)
  assert(history.strokes[0].backgroundColor === BG_COLOR, 'pushStroke preserves backgroundColor on the stroke')
  const popped = popStroke(history)
  assert(popped !== null && popped.backgroundColor === BG_COLOR, 'popStroke preserves backgroundColor on the stroke')
  assert(popped !== null && popped.glyphColor === COLOR_A, 'popStroke preserves glyphColor on the stroke')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll paint verifications passed.')
