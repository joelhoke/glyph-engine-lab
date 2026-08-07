#!/usr/bin/env node
/**
 * Deterministic verification for the Vibe clip recording core
 * (engine/clipRecorder.ts) and the container probe
 * (engine/clipContainerProbe.ts) with injected clock, MediaRecorder doubles,
 * hand-built container fixtures, and fake object-URL factories — no DOM, no
 * real media.
 *
 * Covers: MIME precedence (incl. the Safari plain-container order), exactly
 * N seconds of ACTIVE time for 5/10/15, hidden pause/resume exclusion,
 * cancellation, empty-chunk filtering, recorder error path, filename
 * selection from the recorder's ACTUAL MIME, owned-track cleanup, object-URL
 * lifecycle, container validation (audio-only → "no picture", unparseable →
 * "could not be validated"), and the frame-flow watchdog.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFiles = [
  path.join(projectRoot, 'engine', 'clipRecorder.ts'),
  path.join(projectRoot, 'engine', 'clipContainerProbe.ts'),
]
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
  CLIP_DURATION_OPTIONS_SECONDS,
  CLIP_MIME_CANDIDATES,
  CLIP_VIDEO_BITS_PER_SECOND,
  clipFilenameForMime,
  createClipRecorder,
  resolveClipCaptureSize,
  resolveClipMimeType,
} = require(path.join(tmpDir, 'clipRecorder.js'))
const { probeClipContainer } = require(path.join(tmpDir, 'clipContainerProbe.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

// --- container fixtures (hand-built, minimal but well-formed) -------------------

function ebmlEl(id, payload) {
  const n = payload.length
  let len = 1
  while (len < 8 && n >= Math.pow(2, 7 * len) - 1) len += 1
  const sizeBytes = Buffer.alloc(len)
  let v = n
  for (let i = len - 1; i > 0; i -= 1) {
    sizeBytes[i] = v % 256
    v = Math.floor(v / 256)
  }
  sizeBytes[0] = (v % 256) | (1 << (8 - len))
  return Buffer.concat([Buffer.from(id), sizeBytes, payload])
}

function webmFixture({ withVideo }) {
  const entries = []
  if (withVideo) {
    const videoEl = ebmlEl(
      [0xe0],
      Buffer.concat([
        ebmlEl([0xb0], Buffer.from([0x07, 0x80])), // PixelWidth 1920
        ebmlEl([0xb1], Buffer.from([0x04, 0x38])), // PixelHeight 1080
      ]),
    )
    entries.push(
      ebmlEl(
        [0xae],
        Buffer.concat([
          ebmlEl([0xd7], Buffer.from([1])),
          ebmlEl([0x83], Buffer.from([1])),
          videoEl,
        ]),
      ),
    )
  }
  entries.push(
    ebmlEl([0xae], Buffer.concat([ebmlEl([0xd7], Buffer.from([2])), ebmlEl([0x83], Buffer.from([2]))])),
  )
  const tracks = ebmlEl([0x16, 0x54, 0xae, 0x6b], Buffer.concat(entries))
  const blocks = []
  if (withVideo) {
    blocks.push(
      ebmlEl([0xa3], Buffer.concat([Buffer.from([0x81, 0, 0, 0x80]), Buffer.alloc(500, 7)])),
    )
  }
  blocks.push(ebmlEl([0xa3], Buffer.concat([Buffer.from([0x82, 0, 0, 0x80]), Buffer.alloc(60, 3)])))
  const cluster = ebmlEl([0x1f, 0x43, 0xb6, 0x75], Buffer.concat(blocks))
  const segment = ebmlEl([0x18, 0x53, 0x80, 0x67], Buffer.concat([tracks, cluster]))
  const header = ebmlEl([0x1a, 0x45, 0xdf, 0xa3], Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]))
  return Buffer.concat([header, segment])
}

function mp4Box(type, payload) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(8 + payload.length, 0)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, payload])
}

function mp4Fixture({ withVideo }) {
  const hdlr = (kind) =>
    mp4Box('hdlr', Buffer.concat([Buffer.alloc(8), Buffer.from(kind, 'latin1'), Buffer.alloc(12)]))
  const stsz = (sampleSize, count) => {
    const p = Buffer.alloc(12)
    p.writeUInt32BE(sampleSize, 4)
    p.writeUInt32BE(count, 8)
    return mp4Box('stsz', p)
  }
  const tkhd = (w, h) => {
    const p = Buffer.alloc(84) // version-0 layout: 16.16 width/height at 76/80
    p.writeUInt32BE(w * 65536, 76)
    p.writeUInt32BE(h * 65536, 80)
    return mp4Box('tkhd', p)
  }
  const trak = (kind, size, count, withTkhd) =>
    mp4Box(
      'trak',
      Buffer.concat([
        ...(withTkhd ? [tkhd(1920, 1080)] : []),
        mp4Box('mdia', Buffer.concat([hdlr(kind), mp4Box('minf', mp4Box('stbl', stsz(size, count)))])),
      ]),
    )
  const traks = []
  if (withVideo) traks.push(trak('vide', 400, 3, true))
  traks.push(trak('soun', 50, 4, false))
  const ftyp = mp4Box('ftyp', Buffer.from('isom\0\0\0\1isom', 'latin1'))
  const moov = mp4Box('moov', Buffer.concat(traks))
  const mdat = mp4Box('mdat', Buffer.alloc(withVideo ? 1200 : 200))
  return Buffer.concat([ftyp, moov, mdat])
}

const VALID_WEBM = webmFixture({ withVideo: true })
const AUDIO_ONLY_WEBM = webmFixture({ withVideo: false })
const VALID_MP4 = mp4Fixture({ withVideo: true })
const AUDIO_ONLY_MP4 = mp4Fixture({ withVideo: false })
const GARBAGE = Buffer.from('this is not a media container at all........')

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

function createRig({
  supportedMimes = [],
  actualMime,
  canvasSize = { width: 800, height: 600 },
  durationMs,
  frameFlow,
  preferPlainContainers,
} = {}) {
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
    async pump(ms, step = 100) {
      for (let t = 0; t < ms; t += step) {
        rig.now += step
        rig.tick()
      }
      await flush()
    },
  }
  const recorder = createClipRecorder({
    stream: rig.stream,
    createRecorder: (stream, options) => createRecorderDouble(stream, options, rig),
    isTypeSupported: (mime) => supportedMimes.includes(mime),
    preferPlainContainers,
    frameFlow,
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

const chunk = (buffer) => new Blob([buffer], { type: 'video/webm' })

async function main() {
  // (0) container probe unit tests
  {
    const webm = probeClipContainer(VALID_WEBM.buffer.slice(VALID_WEBM.byteOffset, VALID_WEBM.byteOffset + VALID_WEBM.byteLength))
    assert(
      webm && webm.containerKind === 'webm' && webm.hasVideoTrack && webm.hasAudioTrack && webm.videoSampleBytes === 500,
      `probe: valid webm → video+audio tracks, 500 video bytes (got ${JSON.stringify(webm)})`,
    )
    assert(
      webm.videoWidth === 1920 && webm.videoHeight === 1080,
      `probe: webm exposes video dimensions from PixelWidth/PixelHeight (got ${webm.videoWidth}×${webm.videoHeight})`,
    )
    const webmAudio = probeClipContainer(AUDIO_ONLY_WEBM.buffer.slice(AUDIO_ONLY_WEBM.byteOffset, AUDIO_ONLY_WEBM.byteOffset + AUDIO_ONLY_WEBM.byteLength))
    assert(
      webmAudio && !webmAudio.hasVideoTrack && webmAudio.hasAudioTrack && webmAudio.videoSampleBytes === 0,
      'probe: audio-only webm → no video track, zero video bytes',
    )
    const mp4 = probeClipContainer(VALID_MP4.buffer.slice(VALID_MP4.byteOffset, VALID_MP4.byteOffset + VALID_MP4.byteLength))
    assert(
      mp4 && mp4.containerKind === 'mp4' && mp4.hasVideoTrack && mp4.hasAudioTrack && mp4.videoSampleBytes === 1200,
      `probe: valid mp4 → video+audio tracks, 1200 video bytes (got ${JSON.stringify(mp4)})`,
    )
    assert(
      mp4.videoWidth === 1920 && mp4.videoHeight === 1080,
      `probe: mp4 exposes video dimensions from tkhd (got ${mp4.videoWidth}×${mp4.videoHeight})`,
    )
    const mp4Audio = probeClipContainer(AUDIO_ONLY_MP4.buffer.slice(AUDIO_ONLY_MP4.byteOffset, AUDIO_ONLY_MP4.byteOffset + AUDIO_ONLY_MP4.byteLength))
    assert(
      mp4Audio && !mp4Audio.hasVideoTrack,
      'probe: audio-only mp4 → no video track',
    )
    assert(
      mp4Audio.videoSampleBytes > 0 === false || mp4Audio.videoSampleBytes === 200,
      'probe: audio-only mp4 video bytes come only from the mdat fallback or are zero',
    )
    assert(probeClipContainer(GARBAGE.buffer.slice(GARBAGE.byteOffset, GARBAGE.byteOffset + GARBAGE.byteLength)) === null, 'probe: garbage buffer → null')
    assert(probeClipContainer(new ArrayBuffer(4)) === null, 'probe: tiny buffer → null')
  }

  // (1) MIME precedence + constants
  {
    assert(CLIP_DURATION_DEFAULT_MS === 15000, 'clip target defaults to 15 seconds')
    assert(
      CLIP_DURATION_OPTIONS_SECONDS.join(',') === '5,10,15',
      'selectable durations are 5/10/15 seconds',
    )
    assert(CLIP_VIDEO_BITS_PER_SECOND === 4000000, 'video bitrate is 4 Mbps')
    assert(CLIP_AUDIO_BITS_PER_SECOND === 128000, 'audio bitrate is 128 kbps')
    assert(CLIP_CHUNK_TIMESLICE_MS === 1000, 'chunks are collected per second')
    const onlyVp8 = resolveClipMimeType((m) => m === 'video/webm;codecs=vp8,opus')
    assert(onlyVp8 === 'video/webm;codecs=vp8,opus', 'MIME precedence falls through to a supported candidate')
    const mp4First = resolveClipMimeType(() => true)
    assert(mp4First === 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'MP4 H.264/AAC wins by default')
    const safariFirst = resolveClipMimeType(() => true, true)
    assert(
      safariFirst === 'video/mp4',
      'preferPlainContainers (Safari) picks the plain MP4 container first',
    )
    const safariWebmOnly = resolveClipMimeType((m) => /webm/.test(m), true)
    assert(
      safariWebmOnly === 'video/webm',
      'preferPlainContainers picks plain WebM before parameterized WebM',
    )
    const none = resolveClipMimeType(() => false)
    assert(none === null, 'no supported candidate → browser default (null)')
    assert(CLIP_MIME_CANDIDATES.length === 5, 'five explicit candidates before the browser default')
    assert(clipFilenameForMime('video/mp4;codecs=avc1.42E01E,mp4a.40.2') === 'joel-hoke-vibe.mp4', 'mp4 MIME → .mp4 filename')
    assert(clipFilenameForMime('video/webm') === 'joel-hoke-vibe.webm', 'webm MIME → .webm filename')
  }

  // (1b) capture resolution cap math (Safari level-1.0 encoder field fix)
  {
    const retina = resolveClipCaptureSize(6016, 3204)
    assert(
      retina.width === 1920 && retina.height === 1022 && Math.abs(retina.scale - 1920 / 6016) < 1e-9,
      `retina 6016×3204 caps to 1920×1022 (got ${retina.width}×${retina.height})`,
    )
    const small = resolveClipCaptureSize(800, 600)
    assert(
      small.width === 800 && small.height === 600 && small.scale === 1,
      'a small source is never upscaled',
    )
    const portrait = resolveClipCaptureSize(1000, 3000)
    assert(
      portrait.width === 640 && portrait.height === 1920,
      `portrait 1000×3000 caps the long edge to 1920 (got ${portrait.width}×${portrait.height})`,
    )
    const odd = resolveClipCaptureSize(6017, 3205)
    assert(
      odd.width % 2 === 0 && odd.height % 2 === 0 && odd.width <= 1920 && odd.height <= 1920,
      `odd source dimensions round to even mod-2 (got ${odd.width}×${odd.height})`,
    )
    const oddSmall = resolveClipCaptureSize(801, 601)
    assert(
      oddSmall.width % 2 === 0 && oddSmall.height % 2 === 0 && Math.abs(oddSmall.width - 801) <= 1,
      'uncapped odd dimensions still round to even (H.264 mod-2)',
    )
    const degenerate = resolveClipCaptureSize(0, 0)
    assert(degenerate.width === 2 && degenerate.height === 2, 'a degenerate source falls back to 2×2')
  }

  // (2) exactly N seconds of active time for each selectable duration
  for (const durationMs of [5000, 10000, 15000]) {
    const { recorder, rig } = createRig({
      supportedMimes: ['video/webm;codecs=vp9,opus'],
      actualMime: 'video/webm;codecs=vp8,opus',
      durationMs,
    })
    recorder.start()
    assert(rig.recorders[0].startedWith === 1000, `${durationMs}ms: recorder starts with a 1s timeslice`)
    assert(rig.recorders[0].options.videoBitsPerSecond === 4000000, `${durationMs}ms: 4 Mbps video requested`)
    assert(rig.recorders[0].options.audioBitsPerSecond === 128000, `${durationMs}ms: 128 kbps audio requested`)
    rig.recorders[0].emit(chunk(VALID_WEBM))
    rig.recorders[0].emit(chunk(Buffer.alloc(0))) // empty chunk — filtered
    await rig.pump(durationMs - 200)
    assert(rig.finished.length === 0, `${durationMs}ms: not finished before the full active time`)
    await rig.pump(300)
    assert(rig.finished.length === 1, `${durationMs}ms: finishes at exactly the chosen active time`)
    const result = rig.finished[0]
    assert(
      result.blob.size === VALID_WEBM.length,
      `${durationMs}ms: final blob sums the non-empty chunks (got ${result.blob.size})`,
    )
    assert(
      result.mimeType === 'video/webm;codecs=vp8,opus' && result.filename === 'joel-hoke-vibe.webm',
      `${durationMs}ms: the recorder's ACTUAL output MIME drives the blob type and filename`,
    )
    assert(
      rig.stream.tracks.every((track) => track.stopped),
      `${durationMs}ms: owned tracks stop when the recording finishes`,
    )
    assert(
      rig.ticks.length > 0 && rig.ticks[rig.ticks.length - 1] === 0,
      `${durationMs}ms: countdown ticks down to zero`,
    )
    if (durationMs === 15000) {
      const diag = recorder.getDiagnostics()
      assert(
        diag.requestedMime === 'video/webm;codecs=vp9,opus' &&
          diag.recorderMime === 'video/webm;codecs=vp8,opus' &&
          diag.chunkCount === 1 &&
          diag.chunkBytes === VALID_WEBM.length &&
          diag.blobBytes === VALID_WEBM.length &&
          diag.probe?.hasVideoTrack === true,
        'diagnostics expose requested/actual MIME, chunks, bytes, and the probe',
      )
      assert(rig.urlsCreated.length === 1 && result.url === 'blob:fake-1', 'preview URL created on finish')
      recorder.discardResult()
      assert(rig.urlsRevoked.join() === 'blob:fake-1', 'discardResult revokes the preview URL')
      assert(recorder.getResult() === null && recorder.getState() === 'idle', 'discard returns to idle')
    }
  }

  // (3) hidden time is excluded (pause/resume together)
  {
    const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
    recorder.start()
    rig.recorders[0].emit(chunk(VALID_WEBM))
    await rig.pump(5000)
    recorder.setHidden(true)
    assert(rig.states[rig.states.length - 1] === 'hidden', 'hidden state reported')
    assert(rig.recorders[0].pauseCalls === 1, 'MediaRecorder pauses when hidden')
    await rig.pump(10000)
    assert(rig.finished.length === 0, 'hidden time does not advance the recording')
    recorder.setHidden(false)
    assert(rig.recorders[0].resumeCalls === 1, 'MediaRecorder resumes when visible')
    await rig.pump(9900)
    assert(rig.finished.length === 0, 'still short of 15 ACTIVE seconds')
    await rig.pump(200)
    assert(rig.finished.length === 1, 'finishes after exactly 15s of ACTIVE (visible) time')
    recorder.dispose()
  }

  // (4) cancellation: discard everything, stop tracks, no result
  {
    const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
    recorder.start()
    rig.recorders[0].emit(chunk(VALID_WEBM))
    await rig.pump(3000)
    recorder.cancel('user')
    assert(rig.canceled.join() === 'user', 'cancel reason reported')
    assert(rig.finished.length === 0, 'a canceled recording never produces a result')
    assert(rig.stream.tracks.every((track) => track.stopped), 'cancel stops the owned tracks')
    assert(rig.intervalFn === null, 'cancel stops the ticker')
    assert(rig.urlsCreated.length === 0, 'cancel creates no object URL')
    assert(recorder.getResult() === null, 'no result after cancel')
  }

  // (5) canvas backing-size change cancels mid-recording
  {
    const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
    recorder.start()
    await rig.pump(1000)
    rig.canvasSize = { width: 1024, height: 768 }
    rig.tick()
    assert(rig.canceled.join() === 'canvas-size-changed', 'canvas size change cancels the recording')
    assert(rig.finished.length === 0, 'size-change cancellation discards the media')
  }

  // (6) recorder error path: cancel + discard + visible failure
  {
    const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
    recorder.start()
    await rig.pump(500)
    rig.recorders[0].emitError()
    assert(rig.errors.length === 1, 'recorder error surfaces as a failure')
    assert(rig.stream.tracks.every((track) => track.stopped), 'error path stops the owned tracks')
    assert(rig.finished.length === 0 && rig.urlsCreated.length === 0, 'error path discards everything')
  }

  // (7) empty recording fails visibly instead of exporting nothing
  {
    const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
    recorder.start()
    await rig.pump(15100)
    assert(rig.finished.length === 0, 'an empty recording never calls onFinished')
    assert(rig.errors.join().includes('no media'), 'empty final blob is a visible failure')
  }

  // (8) unsupported recorder constructor: clean failure, tracks stopped
  {
    const rig2 = { stream: createStream(), errors: [] }
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
    rig.recorders[0].emit(chunk(VALID_WEBM))
    await rig.pump(15000)
    assert(rig.finished.length === 1, 'recording finished before dispose')
    recorder.dispose()
    assert(rig.urlsRevoked.length === 1, 'dispose revokes the preview URL')
    assert(recorder.getState() === 'idle', 'dispose returns to idle')
  }

  // (10) audio-only container: NEVER handed out — visible failure instead
  for (const [name, fixture] of [
    ['webm', AUDIO_ONLY_WEBM],
    ['mp4', AUDIO_ONLY_MP4],
  ]) {
    const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
    recorder.start()
    rig.recorders[0].emit(chunk(fixture))
    await rig.pump(15100)
    assert(rig.finished.length === 0, `${name}: an audio-only container never calls onFinished`)
    assert(
      rig.errors.join().includes('no picture'),
      `${name}: audio-only container fails with "no picture" (got ${rig.errors.join()})`,
    )
    assert(rig.urlsCreated.length === 0, `${name}: no preview URL is created for an audio-only file`)
  }

  // (11) unparseable container: visible validation failure
  {
    const { recorder, rig } = createRig({ supportedMimes: ['video/webm'] })
    recorder.start()
    rig.recorders[0].emit(chunk(GARBAGE))
    await rig.pump(15100)
    assert(rig.finished.length === 0, 'an unparseable container never calls onFinished')
    assert(
      rig.errors.join().includes('could not be validated'),
      `unparseable container fails validation (got ${rig.errors.join()})`,
    )
  }

  // (12) frame-flow watchdog: no frames within the deadline → visible failure
  {
    const { recorder, rig } = createRig({
      supportedMimes: ['video/webm'],
      frameFlow: { deadlineMs: 1000, isFlowing: () => false },
    })
    recorder.start()
    await rig.pump(900)
    assert(rig.errors.length === 0, 'watchdog stays quiet before the deadline')
    await rig.pump(200)
    assert(
      rig.errors.join().includes('no frames'),
      `watchdog fails a frameless recording (got ${rig.errors.join()})`,
    )
    assert(
      rig.stream.tracks.every((track) => track.stopped),
      'watchdog failure stops the owned tracks',
    )
  }

  // (13) frame-flow watchdog: flowing frames → recording completes
  {
    const { recorder, rig } = createRig({
      supportedMimes: ['video/webm'],
      frameFlow: { deadlineMs: 1000, isFlowing: () => true },
    })
    recorder.start()
    rig.recorders[0].emit(chunk(VALID_WEBM))
    await rig.pump(15100)
    assert(rig.finished.length === 1, 'a flowing recording completes past the watchdog')
    assert(rig.errors.length === 0, 'no watchdog error when frames flow')
  }

  if (failures > 0) {
    console.error(`\n${failures} verification(s) failed.`)
    process.exit(1)
  }

  console.log('\nAll clip recorder verifications passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
