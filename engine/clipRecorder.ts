/**
 * Vibe clip sharing: the pure recording core behind
 * components/vibe/useClipRecorder.ts.
 *
 * Records a canvas captureStream video track plus a cloned sonification
 * audio track into a 15-second (active-time) clip. Everything clock-,
 * recorder-, and URL-related is injected, so scripts/verify-clip-recorder.js
 * drives the full state machine in Node with doubles — no DOM, no real
 * MediaRecorder.
 *
 * Design notes:
 *  - ACTIVE time: hidden tabs pause the recorder and freeze the active-time
 *    accumulator, so the exported clip is exactly `durationMs` of visible
 *    recording, excluding hidden time.
 *  - The stream's tracks are OWNED by the recorder (the canvas capture track
 *    and the cloned audio track) and stopped on every exit path: finish,
 *    cancel, error, canvas-size change, dispose.
 *  - The result object URL is created here (via the injected factory) and
 *    revoked on discard/dispose — never leaked across Close/Retake/successful
 *    share/replacement/unmount.
 *  - Only the canvas element is captured (canvas.captureStream), so toolbar
 *    chrome, the countdown, the brush cursor, and the sonification scan line
 *    — all DOM — can never appear in the export.
 */

import { ClipContainerInfo, probeClipContainer } from './clipContainerProbe'

/** MIME precedence: MP4 (H.264/AAC) first, then WebM (VP9, VP8, bare), then
 *  the browser default when nothing matches. */
export const CLIP_MIME_CANDIDATES: readonly string[] = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export const CLIP_DURATION_DEFAULT_MS = 15000
/** Selectable clip durations in the Share chooser, seconds. */
export const CLIP_DURATION_OPTIONS_SECONDS: readonly number[] = [5, 10, 15]
export const CLIP_VIDEO_BITS_PER_SECOND = 4_000_000
export const CLIP_AUDIO_BITS_PER_SECOND = 128_000
/** MediaRecorder timeslice: collect 1-second chunks. */
export const CLIP_CHUNK_TIMESLICE_MS = 1000
/** Frame-flow watchdog: after this much ACTIVE recording the video track
 *  must have produced frames, or the recording fails visibly. */
export const CLIP_FRAME_FLOW_DEADLINE_MS = 1000
/** Recording resolution cap: longest edge in pixels. 1080p-class — H.264
 *  level 4.0 territory, safe on every modern hardware encoder. Field
 *  evidence (Safari 26.5 diagnostics): asked to encode a 6016×3204 retina
 *  backing store, Safari's encoder answered with avc1.42000a (level 1.0,
 *  QCIF-class) and silently ended the video track → audio-only MP4. */
export const CLIP_CAPTURE_MAX_LONG_EDGE = 1920
const TICK_INTERVAL_MS = 100

/** Plain-container-first order: Safari's isTypeSupported overclaims the
 *  codecs-parameterized MP4 string (it accepts it, then records a broken
 *  file); the plain container MIME lets the browser pick codecs it can
 *  actually mux. */
const CLIP_MIME_CANDIDATES_PLAIN_FIRST: readonly string[] = [
  'video/mp4',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
]

/** First supported candidate, or null for the browser default. With
 *  `preferPlainContainers` (Safari), plain container MIMEs are tried before
 *  codecs-parameterized ones — see CLIP_MIME_CANDIDATES_PLAIN_FIRST. */
export function resolveClipMimeType(
  isTypeSupported: (mimeType: string) => boolean,
  preferPlainContainers = false,
): string | null {
  const candidates = preferPlainContainers ? CLIP_MIME_CANDIDATES_PLAIN_FIRST : CLIP_MIME_CANDIDATES
  for (const candidate of candidates) {
    if (isTypeSupported(candidate)) return candidate
  }
  return null
}

/** Filename by the recorder's ACTUAL output MIME. */
export function clipFilenameForMime(mimeType: string): string {
  return /mp4/i.test(mimeType) ? 'joel-hoke-vibe.mp4' : 'joel-hoke-vibe.webm'
}

export type ClipCaptureSize = {
  width: number
  height: number
  scale: number
}

/** Staging-canvas size for a recording: the source aspect ratio scaled to
 *  fit the CLIP_CAPTURE_MAX_LONG_EDGE cap, never upscaled, dimensions rounded
 *  to even (H.264 wants mod-2). See the cap's field-evidence comment. */
export function resolveClipCaptureSize(
  sourceWidth: number,
  sourceHeight: number,
  maxLongEdge: number = CLIP_CAPTURE_MAX_LONG_EDGE,
): ClipCaptureSize {
  const w = Math.max(0, Math.floor(sourceWidth))
  const h = Math.max(0, Math.floor(sourceHeight))
  if (w === 0 || h === 0) return { width: 2, height: 2, scale: 1 }
  const longEdge = Math.max(w, h)
  const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2)
  return { width: even(w * scale), height: even(h * scale), scale }
}

// --- Minimal structural MediaRecorder/MediaStream interfaces (double-friendly)

export type ClipTrackLike = {
  kind?: string
  stop: () => void
}

export type ClipStreamLike = {
  getTracks: () => ClipTrackLike[]
}

export type ClipRecorderLike = {
  mimeType: string
  state: string
  ondataavailable: ((event: { data: Blob }) => void) | null
  onerror: ((event: { error?: unknown }) => void) | null
  onstop: (() => void) | null
  start: (timesliceMs?: number) => void
  stop: () => void
  pause: () => void
  resume: () => void
}

export type ClipUrlFactory = {
  create: (blob: Blob) => string
  revoke: (url: string) => void
}

export type ClipRecorderState =
  | 'idle'
  | 'recording'
  | 'hidden'
  | 'finishing'
  | 'done'
  | 'error'
  | 'canceled'

export type ClipRecordingResult = {
  blob: Blob
  mimeType: string
  filename: string
  url: string
}

/** Recorder-side diagnostics for the copyable clip-diagnostics block. */
export type ClipRecorderDiagnostics = {
  /** Requested MIME candidate (null = browser default was used). */
  requestedMime: string | null
  /** The recorder's ACTUAL output MIME. */
  recorderMime: string
  chunkCount: number
  chunkBytes: number
  blobBytes: number
  /** Container probe of the finished blob (null until validated). */
  probe: ClipContainerInfo | null
}

export type ClipRecorderOptions = {
  /** Combined stream (canvas video track + cloned audio track). Its tracks
   *  are owned and stopped on every exit path. */
  stream: ClipStreamLike
  createRecorder: (
    stream: ClipStreamLike,
    options: {
      mimeType?: string
      videoBitsPerSecond: number
      audioBitsPerSecond: number
    },
  ) => ClipRecorderLike
  isTypeSupported: (mimeType: string) => boolean
  /** Safari workaround: try plain container MIMEs before codecs-parameterized
   *  ones (see CLIP_MIME_CANDIDATES_PLAIN_FIRST). */
  preferPlainContainers?: boolean
  /** Frame-flow watchdog: after deadlineMs of ACTIVE recording, isFlowing()
   *  must report true or the recording fails visibly (catches Safari's
   *  silent black/empty video track within ~1s instead of after 15s). */
  frameFlow?: { deadlineMs: number; isFlowing: () => boolean }
  /** Injected clock (ms). */
  now: () => number
  setIntervalFn: (fn: () => void, ms: number) => unknown
  clearIntervalFn: (id: unknown) => void
  /** Object-URL lifecycle (URL.createObjectURL/revokeObjectURL in the DOM). */
  url: ClipUrlFactory
  /** Active-time target; defaults to 15 seconds. */
  durationMs?: number
  /** Canvas backing-size guard: a change cancels the recording. */
  getCanvasSize?: () => { width: number; height: number }
  onStateChange?: (state: ClipRecorderState) => void
  onTick?: (remainingMs: number) => void
  onFinished?: (result: ClipRecordingResult) => void
  onError?: (message: string) => void
  onCanceled?: (reason: string) => void
}

export type ClipRecorder = {
  start: () => void
  cancel: (reason?: string) => void
  setHidden: (hidden: boolean) => void
  /** Release the finished result (Close/Retake/successful share): revokes
   *  the object URL and returns to idle. */
  discardResult: () => void
  dispose: () => void
  getState: () => ClipRecorderState
  getResult: () => ClipRecordingResult | null
  getDiagnostics: () => ClipRecorderDiagnostics
}

export function createClipRecorder(options: ClipRecorderOptions): ClipRecorder {
  const durationMs = Math.max(
    500,
    Number.isFinite(options.durationMs) ? (options.durationMs as number) : CLIP_DURATION_DEFAULT_MS,
  )

  let state: ClipRecorderState = 'idle'
  let recorder: ClipRecorderLike | null = null
  let chosenMime: string | null = null
  let chunks: Blob[] = []
  let result: ClipRecordingResult | null = null
  let timerId: unknown = null
  let activeStartMs = 0
  let accumulatedActiveMs = 0
  let discarding = false
  let canvasWidth = 0
  let canvasHeight = 0
  let flowChecked = false
  let recorderMime = ''
  let chunkCount = 0
  let chunkBytes = 0
  let blobBytes = 0
  let probeInfo: ClipContainerInfo | null = null

  const setState = (next: ClipRecorderState) => {
    if (state === next) return
    state = next
    options.onStateChange?.(next)
  }

  const stopTimer = () => {
    if (timerId !== null) {
      options.clearIntervalFn(timerId)
      timerId = null
    }
  }

  const stopOwnedTracks = () => {
    for (const track of options.stream.getTracks()) {
      try {
        track.stop()
      } catch {}
    }
  }

  const activeElapsedMs = () =>
    state === 'recording'
      ? accumulatedActiveMs + (options.now() - activeStartMs)
      : accumulatedActiveMs

  const finishRecording = () => {
    if (!recorder) return
    setState('finishing')
    stopTimer()
    try {
      // The recorder fires its final dataavailable, then onstop.
      recorder.stop()
    } catch {
      fail('The recorder could not be stopped cleanly.')
    }
  }

  const fail = (message: string) => {
    stopTimer()
    stopOwnedTracks()
    recorder = null
    chunks = []
    setState('error')
    options.onError?.(message)
  }

  const assembleResult = async () => {
    if (discarding || !recorder) return
    const current = recorder
    // The ACTUAL output MIME wins over the requested candidate.
    const actualMime = current.mimeType || chosenMime || 'video/webm'
    recorderMime = current.mimeType || ''
    const nonEmpty = chunks.filter((chunk) => chunk.size > 0)
    chunks = []
    const blob = new Blob(nonEmpty, { type: actualMime })
    blobBytes = blob.size
    recorder = null
    stopOwnedTracks()
    if (blob.size === 0) {
      setState('error')
      options.onError?.('The recording produced no media.')
      return
    }
    // Validate the container BEFORE handing the clip out: a file with no
    // video track (or no video samples) must never reach the preview — that
    // is exactly the audio-only Safari failure this guards against.
    try {
      probeInfo = probeClipContainer(await blob.arrayBuffer())
    } catch {
      probeInfo = null
    }
    if (discarding) return // canceled while the blob was being read
    if (!probeInfo) {
      setState('error')
      options.onError?.('The recording could not be validated as a playable clip.')
      return
    }
    if (!probeInfo.hasVideoTrack || probeInfo.videoSampleBytes <= 0) {
      setState('error')
      options.onError?.('The recording produced no picture.')
      return
    }
    result = {
      blob,
      mimeType: actualMime,
      filename: clipFilenameForMime(actualMime),
      url: options.url.create(blob),
    }
    setState('done')
    options.onFinished?.(result)
  }

  function tick() {
    if (state !== 'recording') return
    if (options.getCanvasSize) {
      const size = options.getCanvasSize()
      if (size.width !== canvasWidth || size.height !== canvasHeight) {
        cancel('canvas-size-changed')
        return
      }
    }
    // Frame-flow watchdog: catches a silently black/empty video track after
    // ~1s of ACTIVE recording instead of after the full duration.
    if (options.frameFlow && !flowChecked && activeElapsedMs() >= options.frameFlow.deadlineMs) {
      flowChecked = true
      if (!options.frameFlow.isFlowing()) {
        fail('The canvas produced no frames for the recorder.')
        return
      }
    }
    const remaining = Math.max(0, durationMs - activeElapsedMs())
    options.onTick?.(remaining)
    if (remaining <= 0) finishRecording()
  }

  const start = () => {
    if (state !== 'idle' && state !== 'canceled' && state !== 'error') return
    chosenMime = resolveClipMimeType(options.isTypeSupported, options.preferPlainContainers === true)
    try {
      recorder = options.createRecorder(options.stream, {
        ...(chosenMime ? { mimeType: chosenMime } : {}),
        videoBitsPerSecond: CLIP_VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: CLIP_AUDIO_BITS_PER_SECOND,
      })
    } catch {
      recorder = null
      stopOwnedTracks()
      setState('error')
      options.onError?.('Recording is not supported in this browser.')
      return
    }
    chunks = []
    discarding = false
    flowChecked = false
    recorderMime = ''
    chunkCount = 0
    chunkBytes = 0
    blobBytes = 0
    probeInfo = null
    if (options.getCanvasSize) {
      const size = options.getCanvasSize()
      canvasWidth = size.width
      canvasHeight = size.height
    }
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data)
        chunkCount += 1
        chunkBytes += event.data.size
      }
    }
    recorder.onerror = () => {
      fail('The recorder reported an error.')
    }
    recorder.onstop = () => {
      void assembleResult()
    }
    try {
      recorder.start(CLIP_CHUNK_TIMESLICE_MS)
    } catch {
      fail('The recorder could not start.')
      return
    }
    accumulatedActiveMs = 0
    activeStartMs = options.now()
    setState('recording')
    timerId = options.setIntervalFn(tick, TICK_INTERVAL_MS)
  }

  const cancel = (reason = 'canceled') => {
    if (state !== 'recording' && state !== 'hidden' && state !== 'finishing') return
    stopTimer()
    discarding = true
    if (recorder) {
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {}
      recorder = null
    }
    chunks = []
    stopOwnedTracks()
    setState('canceled')
    options.onCanceled?.(reason)
  }

  const setHidden = (hidden: boolean) => {
    if (hidden) {
      if (state !== 'recording' || !recorder) return
      accumulatedActiveMs += options.now() - activeStartMs
      try {
        recorder.pause()
      } catch {}
      setState('hidden')
      return
    }
    if (state !== 'hidden' || !recorder) return
    activeStartMs = options.now()
    try {
      recorder.resume()
    } catch {}
    setState('recording')
  }

  const discardResult = () => {
    if (result) {
      options.url.revoke(result.url)
      result = null
    }
    if (state === 'done' || state === 'error' || state === 'canceled') {
      setState('idle')
    }
  }

  const dispose = () => {
    cancel('disposed')
    discardResult()
  }

  return {
    start,
    cancel,
    setHidden,
    discardResult,
    dispose,
    getState: () => state,
    getResult: () => result,
    getDiagnostics: () => ({
      requestedMime: chosenMime,
      recorderMime,
      chunkCount,
      chunkBytes,
      blobBytes,
      probe: probeInfo,
    }),
  }
}
