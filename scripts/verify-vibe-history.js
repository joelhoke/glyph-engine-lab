#!/usr/bin/env node
/**
 * Deterministic verification for the unified Vibe undo/redo history
 * (engine/vibeHistory.ts, launch item 6): transaction ordering and cursor
 * movement, the 50-entry bound with oldest-first trimming, config/paint-tool
 * coalescing (same key merges, different key splits, keyless kinds break the
 * run), compound preset/source transactions carrying paint + upload refs,
 * redo truncation on new transactions, exact undo/redo round-trips, and
 * object-URL reference accounting (an URL referenced by a retained entry is
 * never released; trimming/clearing releases the orphaned ones). Also checks
 * the uploadPending gating helpers.
 *
 * Compile TS to tmp-verify-vibe-history, assert in Node — the standard idiom.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-vibe-history')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'vibeHistory.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  VIBE_HISTORY_LIMIT,
  createVibeHistory,
  createEmptyVibeSnapshot,
  cloneVibeConfig,
  collectRetainedUrls,
  pushTransaction,
  undoTransaction,
  redoTransaction,
  clearVibeHistory,
  canUndoTransactions,
  canRedoTransactions,
  canUndoVibe,
  canRedoVibe,
} = require(path.join(tmpDir, 'vibeHistory.js'))
const { APPROVED_PLAYGROUND_DEFAULTS } = require(path.join(tmpDir, 'playgroundConfig.js'))
const { createEmptyPaintSnapshot, clonePaintSnapshot } = require(path.join(tmpDir, 'paint.js'))

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

/** Build a snapshot with the given overrides (small test fixture). The paint
 *  override is deep-copied, mirroring the app's capture contract. */
function snap(overrides = {}) {
  const base = createEmptyVibeSnapshot(BASE_CONFIG, BASE_PAINT_TOOL)
  return {
    config: overrides.config ? cloneVibeConfig(overrides.config) : base.config,
    paintTool: overrides.paintTool ? { ...overrides.paintTool } : base.paintTool,
    paint: overrides.paint ? clonePaintSnapshot(overrides.paint) : base.paint,
    upload: overrides.upload !== undefined ? overrides.upload : base.upload,
  }
}

function configWith(patch) {
  return { ...cloneVibeConfig(BASE_CONFIG), ...patch }
}

function strokePaint(count) {
  const paint = createEmptyPaintSnapshot()
  for (let i = 0; i < count; i += 1) {
    paint.strokes.push({
      tool: 'paint',
      glyphColor: 100 + i,
      backgroundColor: null,
      radiusNorm: 0.05,
      points: Float32Array.from([0.1 * i, 0.1 * i]),
    })
  }
  return paint
}

function uploadRef(url, filename = 'file.png') {
  return { kind: 'raster', url, filename }
}

function tx(kind, key, before, after) {
  return { kind, key, before, after }
}

function configsMatch(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

// --- ordering + cursor -------------------------------------------------------

{
  const history = createVibeHistory()
  assert(!canUndoTransactions(history) && !canRedoTransactions(history), 'empty history: nothing to undo or redo')

  const s0 = snap()
  const s1 = snap({ config: configWith({ glyphSizePt: 16 }) })
  const s2 = snap({ config: configWith({ glyphSizePt: 24 }) })
  pushTransaction(history, tx('config', 'glyphSizePt', s0, s1))
  pushTransaction(history, tx('config', 'glyphFont', s1, s2))
  assert(history.entries.length === 2 && history.cursor === 2, 'two key-different transactions land in order')

  const undone = undoTransaction(history)
  assert(undone === history.entries[1] && history.cursor === 1, 'undo returns the newest entry and moves the cursor back')
  assert(canRedoTransactions(history), 'redo available after undo')

  const redone = redoTransaction(history)
  assert(redone === history.entries[1] && history.cursor === 2, 'redo returns the same entry and moves the cursor forward')
  assert(!canRedoTransactions(history), 'nothing to redo at the tip')
}

// --- undo/redo round-trips config state exactly -------------------------------

{
  const history = createVibeHistory()
  const states = [
    snap({ config: configWith({ glyphSizePt: 12 }) }),
    snap({ config: configWith({ glyphSizePt: 16 }) }),
    snap({ config: configWith({ glyphSizePt: 24 }) }),
    snap({ config: configWith({ glyphSizePt: 32 }) }),
  ]
  pushTransaction(history, tx('config', 'glyphSizePt', states[0], states[1]))
  pushTransaction(history, tx('config', 'backgroundColor1', states[1], states[2]))
  pushTransaction(history, tx('preset', null, states[2], states[3]))

  // Walk all the way back: each undo's `before` must equal the prior state.
  const back = []
  let entry
  while ((entry = undoTransaction(history)) !== null) back.push(entry.before)
  assert(
    configsMatch(back[0].config, states[2].config) &&
      configsMatch(back[1].config, states[1].config) &&
      configsMatch(back[2].config, states[0].config),
    'undo chain restores each prior config state exactly',
  )
  // And forward again.
  const fwd = []
  while ((entry = redoTransaction(history)) !== null) fwd.push(entry.after)
  assert(
    configsMatch(fwd[0].config, states[1].config) &&
      configsMatch(fwd[1].config, states[2].config) &&
      configsMatch(fwd[2].config, states[3].config),
    'redo chain restores each forward config state exactly',
  )
}

// --- coalescing ----------------------------------------------------------------

{
  const history = createVibeHistory()
  const s0 = snap()
  const s1 = snap({ config: configWith({ motion: { ...BASE_CONFIG.motion, amount: 10 } }) })
  const s2 = snap({ config: configWith({ motion: { ...BASE_CONFIG.motion, amount: 20 } }) })
  pushTransaction(history, tx('config', 'motion.amount', s0, s1))
  pushTransaction(history, tx('config', 'motion.amount', s1, s2))
  assert(history.entries.length === 1, 'same-key config transactions coalesce into one')
  assert(
    history.entries[0].after.config.motion.amount === 20 &&
      history.entries[0].before.config.motion.amount === BASE_CONFIG.motion.amount,
    'coalesced transaction keeps the first before and the newest after',
  )

  const s3 = snap({ config: configWith({ glyphSizePt: 32 }) })
  pushTransaction(history, tx('config', 'glyphSizePt', s2, s3))
  assert(history.entries.length === 2, 'a different key splits the coalescing run')

  const s4 = snap({ config: configWith({ glyphText: 'new text' }) })
  pushTransaction(history, tx('text', null, s3, s4))
  assert(history.entries.length === 3, 'a text transaction lands as its own entry')

  const s5 = snap({ config: configWith({ motion: { ...BASE_CONFIG.motion, amount: 30 } }) })
  pushTransaction(history, tx('config', 'motion.amount', s4, s5))
  assert(history.entries.length === 4, 'a keyless transaction (text) breaks the coalescing run')

  const t0 = snap()
  const t1 = snap({ paintTool: { ...BASE_PAINT_TOOL, brushDiameter: 60 } })
  const t2 = snap({ paintTool: { ...BASE_PAINT_TOOL, brushDiameter: 72 } })
  pushTransaction(history, tx('paint-tool', 'brushDiameter', t0, t1))
  pushTransaction(history, tx('paint-tool', 'brushDiameter', t1, t2))
  const paintToolEntries = history.entries.filter((e) => e.kind === 'paint-tool')
  assert(
    paintToolEntries.length === 1 && paintToolEntries[0].after.paintTool.brushDiameter === 72,
    'paint-tool transactions coalesce by key (brush size)',
  )
}

// --- compound preset/source transactions ---------------------------------------

{
  const history = createVibeHistory()
  const beforePaint = strokePaint(3)
  const beforeUpload = uploadRef('blob:mock-before')
  const before = snap({ paint: beforePaint, upload: beforeUpload })
  const after = snap({
    config: configWith({ glyphText: 'preset text' }),
    paint: createEmptyPaintSnapshot(),
    upload: uploadRef('blob:mock-after'),
  })
  pushTransaction(history, tx('preset', null, before, after))

  const undone = undoTransaction(history)
  assert(
    undone.before.paint.strokes.length === 3 && undone.after.paint.strokes.length === 0,
    'preset transaction carries the pre/post paint snapshots',
  )
  assert(
    undone.before.upload.url === 'blob:mock-before' && undone.after.upload.url === 'blob:mock-after',
    'preset transaction carries the pre/post upload refs',
  )
  // Snapshots are deep copies: mutating live state must not corrupt history.
  beforePaint.strokes.length = 0
  assert(
    history.entries[0].before.paint.strokes.length === 3,
    'stored paint snapshots are deep copies (stroke buffers not shared)',
  )

  const sourceBefore = snap({ upload: null })
  const sourceAfter = snap({ upload: uploadRef('blob:mock-upload') })
  pushTransaction(history, tx('source', null, sourceBefore, sourceAfter))
  assert(
    history.entries.length === 1 && history.entries[0].kind === 'source',
    'pushing after an undo truncates the redo tail before the new entry lands',
  )
}

// --- redo cleared on a new transaction ------------------------------------------

{
  const released = []
  const release = (url) => released.push(url)
  const history = createVibeHistory()
  const s0 = snap()
  const s1 = snap({ config: configWith({ glyphSizePt: 16 }) })
  const s2 = snap({ config: configWith({ glyphSizePt: 24 }), upload: uploadRef('blob:mock-redo') })
  pushTransaction(history, tx('config', 'a', s0, s1), release)
  pushTransaction(history, tx('config', 'b', s1, s2), release)
  undoTransaction(history)
  const s3 = snap({ config: configWith({ glyphSizePt: 8 }) })
  pushTransaction(history, tx('config', 'c', s1, s3), release)
  assert(!canRedoTransactions(history), 'a new transaction clears the redo tail')
  assert(history.entries.length === 2 && history.entries[1].after === s3, 'the redo entry is replaced by the new transaction')
  assert(
    released.includes('blob:mock-redo'),
    'URLs referenced only by the dropped redo entry are released',
  )
}

// --- 50-entry bound + trimming + URL accounting ---------------------------------

{
  const released = []
  const release = (url) => released.push(url)
  const history = createVibeHistory()
  // Entry 0: before references blob:shared, after references blob:u0.
  // Entry 1: before ALSO references blob:u0 (chain) — blob:u0 stays retained.
  pushTransaction(
    history,
    tx('source', null, snap({ upload: uploadRef('blob:shared') }), snap({ upload: uploadRef('blob:u0') })),
    release,
  )
  for (let i = 1; i <= VIBE_HISTORY_LIMIT; i += 1) {
    pushTransaction(
      history,
      tx(
        'source',
        null,
        snap({ upload: uploadRef(`blob:u${i - 1}`) }),
        snap({ upload: uploadRef(`blob:u${i}`) }),
      ),
      release,
    )
  }
  assert(history.entries.length === VIBE_HISTORY_LIMIT, `history is bounded at ${VIBE_HISTORY_LIMIT} entries`)
  assert(history.cursor === VIBE_HISTORY_LIMIT, 'cursor stays at the tip after trimming')
  assert(
    history.entries[0].before.upload.url === 'blob:u0',
    'the oldest entry was trimmed first',
  )
  assert(
    released.includes('blob:shared'),
    'an URL referenced only by the trimmed entry is released',
  )
  assert(
    !released.includes('blob:u0'),
    'an URL still referenced by a retained entry is NOT released',
  )

  // Trim the entry that holds the last reference to blob:u0.
  pushTransaction(
    history,
    tx('source', null, snap({ upload: uploadRef('blob:u50') }), snap({ upload: uploadRef('blob:u51') })),
    release,
  )
  assert(released.includes('blob:u0'), 'the URL is released once its last referencing entry is trimmed')
  assert(
    released.filter((url) => url === 'blob:u0').length === 1,
    'each orphaned URL is released exactly once',
  )

  // Clear releases everything still referenced only by the history.
  released.length = 0
  clearVibeHistory(history, release)
  assert(history.entries.length === 0 && history.cursor === 0, 'clear empties the history and resets the cursor')
  const retained = collectRetainedUrls(history)
  assert(retained.size === 0, 'no retained URLs after clear')
  assert(
    released.includes('blob:u51') && released.includes('blob:u1'),
    'clear releases URLs orphaned by the drop',
  )
  assert(
    new Set(released).size === released.length,
    'clear releases each orphaned URL exactly once',
  )
}

// --- coalescing never crosses the cursor ----------------------------------------

{
  const history = createVibeHistory()
  const s0 = snap()
  const s1 = snap({ config: configWith({ glyphSizePt: 16 }) })
  pushTransaction(history, tx('config', 'glyphSizePt', s0, s1))
  undoTransaction(history)
  // After an undo the cursor is mid-stack: pushing the same key must truncate
  // redo and push (not merge into the entry being redone).
  const s2 = snap({ config: configWith({ glyphSizePt: 16 }) })
  pushTransaction(history, tx('config', 'glyphSizePt', s0, s2))
  assert(history.entries.length === 1 && history.entries[0].after === s2, 'coalescing never merges across an undo cursor')
}

// --- uploadPending gating ---------------------------------------------------------

{
  const history = createVibeHistory()
  const s0 = snap()
  const s1 = snap({ config: configWith({ glyphSizePt: 16 }) })
  pushTransaction(history, tx('config', 'glyphSizePt', s0, s1))
  assert(canUndoVibe(history, false) === true, 'canUndoVibe true with an undoable entry and no pending upload')
  assert(canUndoVibe(history, true) === false, 'canUndoVibe false while an upload is pending')
  undoTransaction(history)
  assert(canRedoVibe(history, false) === true, 'canRedoVibe true with a redoable entry and no pending upload')
  assert(canRedoVibe(history, true) === false, 'canRedoVibe false while an upload is pending')
  assert(canUndoVibe(createVibeHistory(), false) === false, 'canUndoVibe false on an empty history')
}

// --- cloneVibeConfig deep independence ---------------------------------------------

{
  const cloned = cloneVibeConfig(BASE_CONFIG)
  cloned.glyphPalette[0] = '#123456'
  cloned.motion.amount = 99
  cloned.motion.custom.symmetry = 99
  cloned.ambient.weather.intensity = 99
  assert(
    BASE_CONFIG.glyphPalette[0] !== '#123456' &&
      BASE_CONFIG.motion.amount !== 99 &&
      BASE_CONFIG.motion.custom.symmetry !== 99 &&
      BASE_CONFIG.ambient.weather.intensity !== 99,
    'cloneVibeConfig deep-copies palette, motion (incl. custom), and ambient (incl. weather)',
  )
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll vibe history verifications passed.')
