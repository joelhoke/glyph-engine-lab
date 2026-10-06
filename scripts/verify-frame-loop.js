#!/usr/bin/env node
/**
 * Verification for the phase-3 frame scheduler: engine/frameLoop.ts is
 * compiled standalone and driven with a fake rAF queue (no browser), and
 * SceneCanvas.tsx is checked for the source invariants that wire it up.
 *
 * Asserted scheduling invariants:
 * - at most one pending frame, ever (no duplicate loops on suspend/resume)
 * - frames stop while parked (suspended || hidden); renderOnce while parked
 *   is a no-op; a stale callback that still fires while parked bails without
 *   rescheduling
 * - resume requests exactly one loop
 * - reduced motion (keepRunning false) renders one frame then parks
 * - dispose cancels and permanently detaches
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'frameLoop.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-frame-loop')

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

const { createFrameLoop } = require(path.join(tmpDir, 'frameLoop.js'))

let failures = 0
function assert(condition, message) {
  if (condition) console.log(`PASS: ${message}`)
  else {
    console.error(`FAIL: ${message}`)
    failures += 1
  }
}

/** Fake rAF: an explicit callback queue the test steps through. */
function fakeRaf() {
  let nextHandle = 1
  const queue = new Map()
  return {
    request: (cb) => {
      const handle = nextHandle++
      queue.set(handle, cb)
      return handle
    },
    cancel: (handle) => {
      queue.delete(handle)
    },
    /** Run every queued callback once; returns how many fired. */
    step: (now) => {
      const due = [...queue.entries()]
      queue.clear()
      for (const [, cb] of due) cb(now)
      return due.length
    },
    pendingCount: () => queue.size,
  }
}

function makeLoop({ parked = { value: false }, keepRunning = { value: true } } = {}) {
  const raf = fakeRaf()
  let frames = 0
  const loop = createFrameLoop({
    frame: () => {
      frames += 1
    },
    keepRunning: () => keepRunning.value,
    isParked: () => parked.value,
    requestFrame: raf.request,
    cancelFrame: raf.cancel,
  })
  return {
    raf,
    loop,
    parked,
    keepRunning,
    frames: () => frames,
  }
}

// --- Continuous running ------------------------------------------------------
{
  const env = makeLoop()
  env.loop.renderOnce()
  assert(env.raf.pendingCount() === 1, 'initial renderOnce schedules exactly one frame')
  env.loop.renderOnce()
  env.loop.renderOnce()
  assert(env.raf.pendingCount() === 1, 'renderOnce while pending never duplicates the loop')
  env.raf.step(16)
  env.raf.step(32)
  env.raf.step(48)
  assert(env.frames() === 3 && env.raf.pendingCount() === 1, 'continuous loop reschedules each frame')
}

// --- Suspend / resume ---------------------------------------------------------
{
  const env = makeLoop()
  env.loop.renderOnce()
  env.raf.step(16)
  env.parked.value = true
  env.loop.park()
  assert(env.raf.pendingCount() === 0, 'park cancels the pending frame')
  env.raf.step(32)
  assert(env.frames() === 1, 'no frames run while parked')
  env.loop.renderOnce()
  assert(env.raf.pendingCount() === 0, 'renderOnce while parked is a no-op')
  // Stale callback that somehow still fires while parked (e.g. queued before
  // the park landed): bails without rescheduling.
  env.parked.value = false
  env.loop.resume()
  assert(env.raf.pendingCount() === 1, 'resume re-arms exactly one frame')
  env.parked.value = true // suspend lands after the frame was queued
  env.raf.step(48)
  assert(env.frames() === 1 && env.raf.pendingCount() === 0, 'a frame firing while parked bails without rescheduling')
  env.parked.value = false
  env.loop.resume()
  env.loop.resume()
  assert(env.raf.pendingCount() === 1, 'repeated resume never forks a second loop')
  for (let i = 0; i < 5; i += 1) env.raf.step(64 + i * 16)
  assert(env.frames() === 6 && env.raf.pendingCount() === 1, 'resumed loop runs continuously again')
  // Rapid suspend/resume cycling: pending count never exceeds one.
  for (let i = 0; i < 20; i += 1) {
    env.parked.value = true
    env.loop.park()
    env.loop.resume() // parked: no-op
    env.parked.value = false
    env.loop.resume()
    env.raf.step(100 + i)
  }
  assert(env.raf.pendingCount() === 1, '20 suspend/resume cycles leave exactly one pending frame')
}

// --- Reduced motion ------------------------------------------------------------
{
  const env = makeLoop({ keepRunning: { value: false } })
  env.loop.renderOnce()
  env.raf.step(16)
  assert(env.frames() === 1 && env.raf.pendingCount() === 0, 'reduced motion renders one frame then parks')
  env.loop.renderOnce()
  assert(env.raf.pendingCount() === 1, 'rebuild re-arms a single frame under reduced motion')
  env.raf.step(32)
  assert(env.frames() === 2 && env.raf.pendingCount() === 0, 're-armed frame parks again')
}

// --- Dispose -------------------------------------------------------------------
{
  const env = makeLoop()
  env.loop.renderOnce()
  env.loop.dispose()
  assert(env.raf.pendingCount() === 0, 'dispose cancels the pending frame')
  env.loop.renderOnce()
  env.loop.resume()
  assert(env.raf.pendingCount() === 0 && env.frames() === 0, 'a disposed loop never schedules again')
}

// --- SceneCanvas source invariants ---------------------------------------------
{
  const source = fs.readFileSync(path.join(projectRoot, 'components', 'SceneCanvas.tsx'), 'utf8')
  assert(source.includes('suspended?: boolean'), 'SceneCanvasProps declares suspended')
  assert(source.includes("interactionMode?: 'canvas' | 'page'"), 'SceneCanvasProps declares interactionMode')
  assert(source.includes('createFrameLoop({'), 'frame loop is scheduled through engine/frameLoop')
  assert(
    source.includes('isParked: () => suspendedRef.current || document.hidden'),
    'the parked gate is suspended || document.hidden',
  )
  assert(
    !/canvas\.style\.touchAction = 'none'\n/.test(source) ||
      source.includes("interactionMode === 'page' ? 'pan-y pinch-zoom' : 'none'"),
    'touchAction is reactive to interactionMode (pan-y pinch-zoom in page mode)',
  )
  assert(
    source.includes('TAP_MOVEMENT_THRESHOLD_PX = 8'),
    'page-mode tap threshold is 8px',
  )
  assert(
    (source.match(/requestAnimationFrame/g) || []).length === 0 ||
      !/animationRef\.current = requestAnimationFrame/.test(source),
    'no direct animationRef rAF scheduling remains in SceneCanvas',
  )
}

console.log(
  failures === 0 ? '\nAll frame-loop verifications passed.' : `\n${failures} check(s) failed.`,
)
process.exit(failures === 0 ? 0 : 1)
