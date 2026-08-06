#!/usr/bin/env node
/**
 * Deterministic verification for the Vibe clip recording core
 * (engine/clipRecorder.ts) with injected clock, MediaRecorder doubles, and
 * fake object-URL factories — no DOM, no real media.
 *
 * Covers: MIME precedence, exactly 15s of ACTIVE time, hidden pause/resume
 * exclusion, cancellation, empty-chunk filtering, recorder error path,
 * filename selection from the recorder's ACTUAL MIME, owned-track cleanup on
 * every exit, and object-URL creation/revocation.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFiles = [path.join(projectRoot, 'engine', 'clipRecorder.ts')]
const tmpDir = path.join(projectRoot, 'tmp-verify-clip-recorder')

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
  CLIP_AUDIO_BITS_PER_SECOND,
  CLIP_CHUNK_TIMESLICE_MS,
  CLIP_DURATION_DEFAULT_MS,
  CLIP_MIME_CANDIDATES,
  CLIP_VIDEO_BITS_PER_SECOND,
  clipFilenameForMime,
  createClipRecorder,
  resolveClipMimeType,
} = require(path.join(tmpDir, 'clipRecorder.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- doubles ------------------------------------------------------------------

function createTrack(kind) {
  return { kind, stopped: false, stop() { this.stopped = true } }
}

function createStream() {
  const tracks = [createTrack('video'), createTrack('audio')]
  return { tracks, getTracks: () => tracks }
}

function createRecorderDouble(stream, options, rig) {
  const recorder = {
    stream,
    options,
    mimeType: rig.actualMime ?? options.mimeType ?? '',
    state: 'inactive',
    ondataavailable: null,
    onerror: null,
    onstop: null,
    startedWith: null,
    pauseCalls: 0,
    resumeCalls: 0,
    start(timeslice) {
      this.startedWith = timeslice
      this.state = 'recording'
    },
    stop() {
      this.state = 'inactive'
      // Real recorders flush a final chunk, then fire stop.
      if (rig.finalChunk) this.ondataavailable?.({ data: rig.finalChunk })
      this.onstop?.()
    },
    pause() {
      this.pauseCalls += 1
      this.state = 'paused'
    },
    resume() {
      this.resumeCalls += 1
      this.state = 'recording'
    },
    emit(chunk) {
      this.ondataavailable?.({ data: chunk })
    },
    emitError() {
      this.onerror?.({ error: new Error('boom') })
    },
  }
  rig.recorders.push(recorder)
  return recorder
}

function createRig({ supportedMimes = [], actualMime, canvasSize = { width: 800, height: 600 }, durationMs } = {}) {
  const rig = {
    now: 0,
    recorders: [],
    actualMime,
    intervalFn: null,
    states: [],
    ticks: [],
    finished: [],
    errors: [],
    canceled: [],
    urlsCreated: [],
    urlsRevoked: [],
    stream: createStream(),
    canvasSize,
    tick() {
      if (rig.intervalFn) rig.intervalFn()
    },
    pump(ms, step = 100) {
      for (let t = 0; t < ms; t += step) {
        rig.now += step
        rig.tick()
      }
    },
  }
  const recorder = createClipRecorder({
    stream: rig.stream,
    createRecorder: (stream, options) => createRecorderDouble(stream, options, rig),
    isTypeSupported: (mime) => supportedMimes.includes(mime),
    now: () => rig.now,
    setIntervalFn: (fn) => {
      rig.intervalFn = fn
      return 1
    },
    clearIntervalFn: () => {
      rig.intervalFn = null
    },
    url: {
      create: (blob) => {
        const url = `blob:fake-${rig.urlsCreated.length + 1}`
        rig.urlsCreated.push({ url, size: blob.size })
        return url
      },
      revoke: (url) => rig.urlsRevoked.push(url),
    },
    durationMs,
    getCanvasSize: () => rig.canvasSize,
    onStateChange: (state) => rig.states.push(state),
    onTick: (remaining) => rig.ticks.push(remaining),
    onFinished: (result) => rig.finished.push(result),
    onError: (message) => rig.errors.push(message),
    onCanceled: (reason) => rig.canceled.push(reason),
  })
  return { recorder, rig }
}

const chunk = (size) => new Blob([new Uint8Array(size)], { type: 'video/webm' })

// (1) MIME precedence + constants
{
  assert(CLIP_DURATION_DEFAULT_MS === 15000, 'clip target is 15 seconds')
  assert(CLIP_VIDEO_BITS_PER_SECOND === 4000000, 'video bitrate is 4 Mbps')
  assert(CLIP_AUDIO_BITS_PER_SECOND === 128000, 'audio bitrate is 128 kbps')
  assert(CLIP_CHUNK_TIMESLICE_MS === 1000, 'chunks are collected per second')
  const onlyVp8 = resolveClipMimeType((m) => m === 'video/webm;codecs=vp8,opus')
  assert(onlyVp8 === 'video/webm;codecs=vp8,opus', 'MIME precedence falls through to a supported candidate')
  const mp4First = resolveClipMimeType(() => true)
  assert(mp4First === 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'MP4 H.264/AAC wins when supported')
  const none = resolveClipMimeType(() => false)
  assert(none === null, 'no supported candidate → browser default (null)')
  assert(CLIP_MIME_CANDIDATES.length === 5, 'five explicit candidates before the browser default')
  assert(clipFilenameForMime('video/mp4;codecs=avc1.42E01E,mp4a.40.2') === 'joel-hoke-vibe.mp4', 'mp4 MIME → .mp4 filename')
  assert(clipFilenameForMime('video/webm') === 'joel-hoke-vibe.webm', 'webm MIME → .webm filename')
}

// (2) exactly 15s of active time, chunk filtering, actual-MIME result
{
  const { recorder, rig } = createRig({
    supportedMimes: ['video/webm;codecs=vp9,opus'],
    actualMime: 'video/webm;codecs=vp8,opus', // recorder negotiates something else
  })
  recorder.start()
  assert(rig.recorders[0].startedWith === 1000, 'recorder starts with a 1s timeslice')
  assert(rig.recorders[0].options.videoBitsPerSecond === 4000000, '4 Mbps video requested')
  assert(rig.recorders[0].options.audioBitsPerSecond === 128000, '128 kbps audio requested')
  rig.recorders[0].emit(chunk(500))
  rig.recorders[0].emit(chunk(0)) // empty chunk — filtered
  rig.recorders[0].emit(chunk(700))
  rig.pump(14900)
  assert(rig.finished.length === 0, 'not finished before 15s of active time')
  rig.pump(200)
  assert(rig.finished.length === 1, 'finishes at exactly 15s of active time')
  const result = rig.finished[0]
  assert(result.blob.size === 1200, `final blob sums the non-empty chunks (got ${result.blob.size})`)
  assert(
    result.mimeType === 'video/webm;codecs=vp8,opus' && result.filename === 'joel-hoke-vibe.webm',
    "the recorder's ACTUAL output MIME drives the blob type and filename",
  )
  assert(
    rig.stream.tracks.every((track) => track.stopped),
    'owned tracks stop when the recording finishes',
  )
  assert(rig.ticks.length > 0 && rig.ticks[rig.ticks.length - 1] === 0, 'countdown ticks down to zero')
  // Object URL lifecycle: created on finish, revoked on discard.
  assert(rig.urlsCreated.length === 1 && result.url === 'blob:fake-1', 'preview URL created on finish')
  recorder.discardResult()
  assert(rig.urlsRevoked.join() === 'blob:fake-1', 'discardResult revokes the preview URL')
  assert(recorder.getResult() === null && recorder.getState() === 'idle', 'discard returns to idle')
}

// (3) hidden time is excluded (pause/resume together)
{
  const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
  recorder.start()
  rig.recorders[0].emit(chunk(400))
  rig.pump(5000)
  recorder.setHidden(true)
  assert(rig.states[rig.states.length - 1] === 'hidden', 'hidden state reported')
  assert(rig.recorders[0].pauseCalls === 1, 'MediaRecorder pauses when hidden')
  rig.pump(10000) // 10 hidden seconds must not count
  assert(rig.finished.length === 0, 'hidden time does not advance the recording')
  recorder.setHidden(false)
  assert(rig.recorders[0].resumeCalls === 1, 'MediaRecorder resumes when visible')
  rig.pump(9900)
  assert(rig.finished.length === 0, 'still short of 15 ACTIVE seconds')
  rig.pump(200)
  assert(rig.finished.length === 1, 'finishes after exactly 15s of ACTIVE (visible) time')
  recorder.dispose()
}

// (4) cancellation: discard everything, stop tracks, no result
{
  const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
  recorder.start()
  rig.recorders[0].emit(chunk(500))
  rig.pump(3000)
  recorder.cancel('user')
  assert(rig.canceled.join() === 'user', 'cancel reason reported')
  assert(rig.finished.length === 0, 'a canceled recording never produces a result')
  assert(rig.stream.tracks.every((track) => track.stopped), 'cancel stops the owned tracks')
  assert(rig.intervalFn === null, 'cancel stops the ticker')
  assert(rig.urlsCreated.length === 0, 'cancel creates no object URL')
  // Late stop-flush after cancel is discarded (no zombie result).
  assert(recorder.getResult() === null, 'no result after cancel')
}

// (5) canvas backing-size change cancels mid-recording
{
  const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
  recorder.start()
  rig.pump(1000)
  rig.canvasSize = { width: 1024, height: 768 } // e.g. window resize
  rig.tick()
  assert(rig.canceled.join() === 'canvas-size-changed', 'canvas size change cancels the recording')
  assert(rig.finished.length === 0, 'size-change cancellation discards the media')
}

// (6) recorder error path: cancel + discard + visible failure
{
  const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
  recorder.start()
  rig.pump(500)
  rig.recorders[0].emitError()
  assert(rig.errors.length === 1, 'recorder error surfaces as a failure')
  assert(rig.stream.tracks.every((track) => track.stopped), 'error path stops the owned tracks')
  assert(rig.finished.length === 0 && rig.urlsCreated.length === 0, 'error path discards everything')
}

// (7) empty recording fails visibly instead of exporting nothing
{
  const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
  recorder.start()
  rig.pump(15100) // no chunks at all
  assert(rig.finished.length === 0, 'an empty recording never calls onFinished')
  assert(rig.errors.join().includes('no media'), 'empty final blob is a visible failure')
}

// (8) unsupported recorder constructor: clean failure, tracks stopped
{
  const rig2 = {
    stream: createStream(),
    errors: [],
  }
  const recorder = createClipRecorder({
    stream: rig2.stream,
    createRecorder: () => {
      throw new Error('unsupported')
    },
    isTypeSupported: () => false,
    now: () => 0,
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    url: { create: () => 'blob:x', revoke: () => {} },
    onError: (message) => rig2.errors.push(message),
  })
  recorder.start()
  assert(rig2.errors.length === 1, 'recorder construction failure is reported')
  assert(
    rig2.stream.tracks.every((track) => track.stopped),
    'construction failure stops the owned tracks',
  )
}

// (9) dispose mid-recording: cancel + revoke + full cleanup
{
  const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
  recorder.start()
  rig.recorders[0].emit(chunk(400))
  rig.pump(15000)
  assert(rig.finished.length === 1, 'recording finished before dispose')
  recorder.dispose()
  assert(rig.urlsRevoked.length === 1, 'dispose revokes the preview URL')
  assert(recorder.getState() === 'idle', 'dispose returns to idle')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll clip recorder verifications passed.')
