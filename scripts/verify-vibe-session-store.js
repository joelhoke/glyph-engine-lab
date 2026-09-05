#!/usr/bin/env node
/**
 * Deterministic verification for the vibe session store
 * (engine/vibeSessionStore.ts): write/read round-trips of the stored record
 * (memento + live upload ref), absent/corrupt/foreign data handling (read
 * returns null and removes the key), clear, and swallowed storage failures.
 *
 * Compile TS to tmp-verify-vibe-session-store, assert in Node — the standard
 * idiom (same as scripts/verify-vibe-memento.js).
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-vibe-session-store')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'vibeSessionStore.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  VIBE_SESSION_STORAGE_KEY,
  writeVibeSession,
  readVibeSession,
  clearVibeSession,
} = require(path.join(tmpDir, 'vibeSessionStore.js'))
const { buildVibeMemento, mementoToVibeSnapshot } = require(path.join(tmpDir, 'vibeMemento.js'))
const { createEmptyVibeSnapshot } = require(path.join(tmpDir, 'vibeHistory.js'))
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

/** Minimal in-memory Storage stand-in. */
function makeStorage(options = {}) {
  const map = new Map()
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      if (options.throwOnWrite) throw new Error('quota exceeded')
      map.set(key, value)
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}

const BASE_PAINT_TOOL = {
  enabled: false,
  tool: 'paint',
  glyphColor: '#8abaff',
  backgroundColor: 'none',
  brushDiameter: 48,
}

const memento = buildVibeMemento(
  createEmptyVibeSnapshot(APPROVED_PLAYGROUND_DEFAULTS, BASE_PAINT_TOOL),
  {
  capturedAt: 1700000000,
  pond: { enabled: true, character: 'jelly' },
})
const upload = { kind: 'raster', url: 'blob:https://example.com/abc-123', filename: 'photo.png' }

// --- Round-trip ---

{
  const storage = makeStorage()
  writeVibeSession(storage, memento, upload)
  assert(storage.map.has(VIBE_SESSION_STORAGE_KEY), 'write stores under the session key')
  const record = readVibeSession(storage)
  assert(record !== null, 'read returns the stored record')
  assert(
    record && record.memento.capturedAt === 1700000000 && record.memento.pond?.character === 'jelly',
    'memento survives the round-trip (pond included)',
  )
  assert(
    record && record.upload && record.upload.url === upload.url && record.upload.kind === 'raster',
    'live upload ref survives the round-trip',
  )
  // The restored memento feeds mementoToVibeSnapshot without loss.
  const snapshot = record ? mementoToVibeSnapshot(record.memento) : null
  assert(snapshot !== null && snapshot.paint.strokes.length === 0, 'memento restores to a vibe snapshot')
}

// --- Absent / corrupt / foreign data ---

{
  const storage = makeStorage()
  assert(readVibeSession(storage) === null, 'empty storage reads as null')

  storage.map.set(VIBE_SESSION_STORAGE_KEY, '{not json')
  assert(readVibeSession(storage) === null, 'corrupt JSON reads as null')
  assert(!storage.map.has(VIBE_SESSION_STORAGE_KEY), 'corrupt entry is removed')

  storage.map.set(VIBE_SESSION_STORAGE_KEY, JSON.stringify({ memento: { version: 2 }, upload: null }))
  assert(readVibeSession(storage) === null, 'foreign memento shape reads as null')
  assert(!storage.map.has(VIBE_SESSION_STORAGE_KEY), 'foreign entry is removed')

  storage.map.set(
    VIBE_SESSION_STORAGE_KEY,
    JSON.stringify({ memento, upload: { bogus: true } }),
  )
  const record = readVibeSession(storage)
  assert(record !== null && record.upload === null, 'malformed upload ref degrades to null, memento kept')
}

// --- Null upload + clear + write failure ---

{
  const storage = makeStorage()
  writeVibeSession(storage, memento, null)
  const record = readVibeSession(storage)
  assert(record !== null && record.upload === null, 'null upload round-trips')
  clearVibeSession(storage)
  assert(readVibeSession(storage) === null, 'clear removes the entry')

  const failing = makeStorage({ throwOnWrite: true })
  writeVibeSession(failing, memento, upload)
  assert(!failing.map.has(VIBE_SESSION_STORAGE_KEY), 'storage failure is swallowed (no throw)')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}
console.log('\nAll vibe session store verifications passed.')
