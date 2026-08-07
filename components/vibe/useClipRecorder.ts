'use client'

/**
 * Vibe clip sharing: React glue between the pure recording core
 * (engine/clipRecorder.ts), the scene canvas, and the sonification engine.
 *
 * Records canvas.captureStream(30) — ONLY the canvas element, so toolbar
 * chrome, the countdown chip, the brush cursor, and the sonification scan
 * line (all DOM) can never leak into the export — plus a CLONED track from
 * the sonification capture stream (the original keeps feeding the speakers).
 *
 * Lifecycle rules enforced here:
 *  - Hidden tab: the recorder core pauses MediaRecorder + the active-time
 *    countdown; useSonification's own visibilitychange handling suspends the
 *    audio context, so the sweep freezes and resumes on the same audio clock.
 *  - Cancel + discard on leaving Vibe (enabled off), unmount, recorder
 *    error, canvas backing-size change, or explicit Cancel.
 *  - The preview object URL lives in the recorder core and is revoked on
 *    Close/Retake/successful share/replacement/unmount.
 *
 * Session-only: no history entries, no analytics, no uploads — the blob
 * never leaves the browser unless the visitor explicitly shares/downloads it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CLIP_DURATION_DEFAULT_MS,
  CLIP_FRAME_FLOW_DEADLINE_MS,
  createClipRecorder,
  ClipRecorder,
  ClipRecorderLike,
  ClipRecordingResult,
  resolveClipCaptureSize,
  resolveClipMimeType,
} from '../../engine/clipRecorder'
import type { SonificationCaptureSession } from '../../engine/sonificationEngine'
import type { SceneCanvasHandle } from '../SceneCanvas'

export type ClipPhase = 'idle' | 'recording' | 'processing' | 'ready' | 'error'

export type ClipPreview = {
  url: string
  blob: Blob
  mimeType: string
  filename: string
}

export type UseClipRecorderOptions = {
  /** Vibe Mode only: leaving Vibe cancels any in-flight recording. */
  enabled: boolean
  sceneCanvasRef: React.RefObject<SceneCanvasHandle | null>
  beginCapture: () => SonificationCaptureSession | null
  /** Dev-only test hook (?clipTestMs=, clamped 500–15000 upstream): takes
   *  precedence over ANY chosen duration. Null in production, where the
   *  chooser's 5/10/15s selection is always honored. */
  durationOverrideMs?: number | null
}

export type ClipRecorderControls = {
  /** Clip capability (captureStream + MediaRecorder + a usable MIME). */
  supported: boolean
  unsupportedReason: string | null
  phase: ClipPhase
  /** Active-time remaining (hidden time excluded). */
  remainingMs: number
  /** Restrained live-region text: started/paused/resumed/ready/canceled/failed. */
  announcement: string | null
  error: string | null
  preview: ClipPreview | null
  /** Copyable, Safari-readable diagnostics (JSON text). Shown in the failure
   *  state always; under debugMode also with the preview. */
  diagnostics: string | null
  /** Start a recording of the chosen duration (seconds). */
  start: (durationSeconds?: number) => void
  cancel: () => void
  retake: () => void
  closePreview: () => void
  /** Called after a SUCCESSFUL native share: releases the preview. */
  releasePreview: () => void
  /** Preview element events: dimensions on metadata, decode failure. */
  reportPreviewInfo: (info: { videoWidth: number; videoHeight: number }) => void
  reportPreviewError: (errorCode: number) => void
}

const CLIP_UNSUPPORTED_MESSAGE = 'Clip recording is not supported in this browser.'
const CLIP_AUDIO_FAILURE_MESSAGE = 'Could not start the soundtrack — the clip was not recorded.'
const CLIP_CAPTURE_FAILURE_MESSAGE = 'Could not capture the canvas — the clip was not recorded.'

export function useClipRecorder({
  enabled,
  sceneCanvasRef,
  beginCapture,
  durationOverrideMs = null,
}: UseClipRecorderOptions): ClipRecorderControls {
  const [phase, setPhase] = useState<ClipPhase>('idle')
  const [remainingMs, setRemainingMs] = useState(CLIP_DURATION_DEFAULT_MS)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ClipPreview | null>(null)
  const [diagnostics, setDiagnostics] = useState<string | null>(null)

  const recorderRef = useRef<ClipRecorder | null>(null)
  const captureRef = useRef<SonificationCaptureSession | null>(null)
  const framePumpRef = useRef<number | null>(null)
  const videoTrackRef = useRef<MediaStreamTrack | null>(null)
  const framesPumpedRef = useRef(0)
  const framesObservedRef = useRef(0)
  /** Source vs staging dimensions of the current/last recording. */
  const captureSizeRef = useRef<{
    sourceWidth: number
    sourceHeight: number
    stagingWidth: number
    stagingHeight: number
    scale: number
  } | null>(null)
  const prevCoreStateRef = useRef<string>('idle')
  const overrideRef = useRef(durationOverrideMs)
  const activeDurationRef = useRef(CLIP_DURATION_DEFAULT_MS)
  const lastDurationSecondsRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    overrideRef.current = durationOverrideMs
  }, [durationOverrideMs])

  // Safari (incl. iOS browsers, which are all WebKit) overclaims the
  // codecs-parameterized MP4 candidate: isTypeSupported says yes, then the
  // recording is broken. Plain container MIMEs are preferred there.
  const preferPlainContainers = useMemo(() => {
    if (typeof navigator === 'undefined') return false
    return /^((?!chrome|chromium|crios|android|fxios).)*safari/i.test(navigator.userAgent)
  }, [])

  /** Snapshot the recorder + track state into the copyable diagnostics text. */
  const collectDiagnostics = (extra?: Record<string, unknown>) => {
    const core = recorderRef.current?.getDiagnostics() ?? null
    const track = videoTrackRef.current
    setDiagnostics(
      JSON.stringify(
        {
          userAgent: navigator.userAgent,
          preferPlainContainers,
          requestedMime: core?.requestedMime ?? null,
          recorderMime: core?.recorderMime || '(none)',
          videoTrack: track
            ? {
                readyState: track.readyState,
                muted: track.muted,
                settings:
                  typeof track.getSettings === 'function' ? track.getSettings() : null,
              }
            : null,
          framesPumped: framesPumpedRef.current,
          framesObservedViaUnmute: framesObservedRef.current,
          capture: captureSizeRef.current,
          chunkCount: core?.chunkCount ?? 0,
          chunkBytes: core?.chunkBytes ?? 0,
          blobBytes: core?.blobBytes ?? 0,
          containerProbe: core?.probe ?? null,
          ...(extra ?? {}),
        },
        null,
        1,
      ),
    )
  }

  // One-time client capability check: canvas captureStream, MediaRecorder,
  // and at least a browser-default MIME. Sonification capture availability
  // can only be known at record time (the context is gesture-created) and
  // fails visibly there instead.
  const support = useMemo(() => {
    if (typeof window === 'undefined') return { supported: false, reason: null as string | null }
    const canvas = document.createElement('canvas')
    const captureStream = (canvas as HTMLCanvasElement & {
      captureStream?: (frameRate?: number) => MediaStream
    }).captureStream
    if (typeof captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      return { supported: false, reason: CLIP_UNSUPPORTED_MESSAGE }
    }
    // resolveClipMimeType returning null means "browser default" — still OK.
    resolveClipMimeType((mime) => MediaRecorder.isTypeSupported(mime))
    return { supported: true, reason: null as string | null }
  }, [])

  const stopFramePump = () => {
    if (framePumpRef.current !== null) {
      cancelAnimationFrame(framePumpRef.current)
      framePumpRef.current = null
    }
  }

  const finishCapture = () => {
    captureRef.current?.finish()
    captureRef.current = null
  }

  const handleStateChange = useCallback((state: string) => {
    const prev = prevCoreStateRef.current
    prevCoreStateRef.current = state
    if (state === 'recording' && prev === 'hidden') {
      setAnnouncement('Recording resumed')
    } else if (state === 'recording') {
      setPhase('recording')
      setAnnouncement('Recording started')
    } else if (state === 'hidden') {
      setAnnouncement('Recording paused')
    } else if (state === 'finishing') {
      setPhase('processing')
    }
  }, [])

  const handleTick = useCallback((remaining: number) => {
    // Re-render only when the displayed second changes.
    setRemainingMs((prev) =>
      Math.ceil(prev / 1000) === Math.ceil(remaining / 1000) ? prev : remaining,
    )
  }, [])

  const clearVideoTrack = () => {
    videoTrackRef.current = null
  }

  const handleFinished = useCallback((result: ClipRecordingResult) => {
    stopFramePump()
    finishCapture()
    setPreview({
      url: result.url,
      blob: result.blob,
      mimeType: result.mimeType,
      filename: result.filename,
    })
    setPhase('ready')
    setAnnouncement('Clip ready')
    collectDiagnostics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleError = useCallback((message: string) => {
    // Read the core diagnostics BEFORE dropping the recorder reference.
    collectDiagnostics({ failure: message })
    stopFramePump()
    finishCapture()
    recorderRef.current = null
    setError(message)
    setPhase('error')
    setAnnouncement('Recording failed')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCanceled = useCallback((reason: string) => {
    stopFramePump()
    finishCapture()
    recorderRef.current = null
    clearVideoTrack()
    setPhase('idle')
    setRemainingMs(activeDurationRef.current)
    setAnnouncement('Recording canceled')
  }, [])

  const start = useCallback((durationSeconds?: number) => {
    if (!support.supported || recorderRef.current) return
    setError(null)
    // Effective duration: the dev-only ?clipTestMs= override (when present)
    // wins over any chosen duration; production honors the chooser.
    const effectiveMs =
      overrideRef.current ??
      (durationSeconds ? durationSeconds * 1000 : CLIP_DURATION_DEFAULT_MS)
    activeDurationRef.current = effectiveMs
    lastDurationSecondsRef.current = durationSeconds
    const canvas = sceneCanvasRef.current?.getCanvas()
    if (!canvas) {
      setError(CLIP_CAPTURE_FAILURE_MESSAGE)
      setPhase('error')
      setAnnouncement('Recording failed')
      return
    }
    // Soundtrack first: never silently export video without sound.
    const capture = beginCapture()
    if (!capture || !capture.stream) {
      setError(CLIP_AUDIO_FAILURE_MESSAGE)
      setPhase('error')
      setAnnouncement('Recording failed')
      return
    }
    captureRef.current = capture

    let videoTrack: MediaStreamTrack | null = null
    let audioTrack: MediaStreamTrack | null = null
    let combined: MediaStream | null = null
    try {
      // Safari/mp4 fixes (audio-only export), both from field diagnostics:
      //  1. captureStream on a GPU-accelerated 2D canvas (the scene context
      //     is deliberately NOT willReadFrequently, the right call for its
      //     60fps full-screen render loop) can record black/empty frames —
      //     so the live canvas is painted into a CPU-backed staging canvas
      //     via drawImage (the read-back path Safari handles correctly) and
      //     THAT stream is captured. Cost: one bounded drawImage per display
      //     frame, only while recording; zero when idle. The pump also paints
      //     under reduced motion (the scene settles statically), so frames
      //     stay deterministic without requestFrame.
      //  2. Safari 26.5 asked to encode the full 6016×3204 retina backing
      //     store answered with avc1.42000a (H.264 level 1.0, QCIF-class)
      //     and silently ENDED the video track → audio-only MP4. The staging
      //     canvas is therefore capped at 1080p-class (long edge ≤ 1920,
      //     even dimensions, never upscaled) and drawImage scales the full
      //     source into it each pumped frame.
      const staging = document.createElement('canvas')
      const captureSize = resolveClipCaptureSize(canvas.width, canvas.height)
      staging.width = captureSize.width
      staging.height = captureSize.height
      captureSizeRef.current = {
        sourceWidth: canvas.width,
        sourceHeight: canvas.height,
        stagingWidth: captureSize.width,
        stagingHeight: captureSize.height,
        scale: captureSize.scale,
      }
      const stagingCtx = staging.getContext('2d')
      if (!stagingCtx) throw new Error('no staging context')
      stagingCtx.drawImage(canvas, 0, 0, captureSize.width, captureSize.height)
      const stagingStream = staging.captureStream(30)
      videoTrack = stagingStream.getVideoTracks()[0] ?? null
      audioTrack = (capture.stream as MediaStream).getAudioTracks()[0]?.clone() ?? null
      if (!videoTrack || !audioTrack) throw new Error('missing track')
      combined = new MediaStream([videoTrack, audioTrack])
      // Frame-flow diagnostics: the pump counts drawImage calls; the track's
      // unmute event counts frames actually OBSERVED by the capture path.
      framesPumpedRef.current = 0
      framesObservedRef.current = 0
      videoTrackRef.current = videoTrack
      videoTrack.addEventListener('unmute', () => {
        framesObservedRef.current += 1
      })
      const pump = () => {
        framePumpRef.current = requestAnimationFrame(pump)
        try {
          stagingCtx.drawImage(canvas, 0, 0, captureSize.width, captureSize.height)
          framesPumpedRef.current += 1
        } catch {}
      }
      framePumpRef.current = requestAnimationFrame(pump)
    } catch {
      stopFramePump()
      finishCapture()
      setError(CLIP_CAPTURE_FAILURE_MESSAGE)
      setPhase('error')
      setAnnouncement('Recording failed')
      return
    }

    prevCoreStateRef.current = 'idle'
    setRemainingMs(effectiveMs)
    setDiagnostics(null)
    const recorder = createClipRecorder({
      stream: combined,
      createRecorder: (stream, options) =>
        new MediaRecorder(
          stream as unknown as MediaStream,
          options,
        ) as unknown as ClipRecorderLike,
      isTypeSupported: (mime) => MediaRecorder.isTypeSupported(mime),
      preferPlainContainers,
      frameFlow: {
        deadlineMs: CLIP_FRAME_FLOW_DEADLINE_MS,
        isFlowing: () => {
          const track = videoTrackRef.current
          if (!track || track.readyState !== 'live') return false
          // A track that unmuted (or was never muted) has delivered frames.
          return !track.muted || framesObservedRef.current > 0
        },
      },
      now: () => performance.now(),
      setIntervalFn: (fn, ms) => window.setInterval(fn, ms),
      clearIntervalFn: (id) => window.clearInterval(id as number),
      url: {
        create: (blob) => URL.createObjectURL(blob),
        revoke: (url) => URL.revokeObjectURL(url),
      },
      durationMs: effectiveMs,
      getCanvasSize: () => ({ width: canvas.width, height: canvas.height }),
      onStateChange: handleStateChange,
      onTick: handleTick,
      onFinished: handleFinished,
      onError: handleError,
      onCanceled: handleCanceled,
    })
    recorderRef.current = recorder
    recorder.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [support.supported, sceneCanvasRef, beginCapture])

  const cancel = useCallback(() => {
    recorderRef.current?.cancel('user')
  }, [])

  const closePreview = useCallback(() => {
    recorderRef.current?.discardResult()
    recorderRef.current = null
    setPreview(null)
    setPhase('idle')
    setRemainingMs(activeDurationRef.current)
  }, [])

  const retake = useCallback(() => {
    recorderRef.current?.discardResult()
    recorderRef.current = null
    setPreview(null)
    setPhase('idle')
    // Retake keeps the duration the visitor chose.
    start(lastDurationSecondsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start])

  // Preview element events: dimensions once metadata loads, and a decode
  // failure (Safari's stricter blob handling) surfaces as a visible error
  // with Retake/Close instead of a dead preview.
  const reportPreviewInfo = useCallback(
    (info: { videoWidth: number; videoHeight: number }) => {
      collectDiagnostics({ previewVideo: info })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  )

  const reportPreviewError = useCallback((errorCode: number) => {
    collectDiagnostics({ previewVideo: { error: errorCode } })
    recorderRef.current?.discardResult()
    recorderRef.current = null
    setPreview(null)
    setError('The recorded clip could not be decoded for preview.')
    setPhase('error')
    setAnnouncement('Clip preview failed')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hidden tab pauses the recorder + countdown (the sonification sweep
  // suspends on its own visibilitychange handler in useSonification).
  useEffect(() => {
    const handleVisibility = () => recorderRef.current?.setHidden(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Leaving Vibe mid-recording cancels and discards.
  useEffect(() => {
    if (!enabled) {
      recorderRef.current?.cancel('navigation')
      recorderRef.current?.discardResult()
      recorderRef.current = null
      stopFramePump()
      finishCapture()
      setPreview(null)
      setPhase('idle')
      setRemainingMs(activeDurationRef.current)
    }
  }, [enabled])

  // Unmount: stop owned tracks/timers and revoke any preview URL.
  useEffect(
    () => () => {
      recorderRef.current?.dispose()
      recorderRef.current = null
      stopFramePump()
      captureRef.current?.finish()
      captureRef.current = null
    },
    [],
  )

  return {
    supported: support.supported,
    unsupportedReason: support.reason,
    phase,
    remainingMs,
    announcement,
    error,
    preview,
    diagnostics,
    start,
    cancel,
    retake,
    closePreview,
    releasePreview: closePreview,
    reportPreviewInfo,
    reportPreviewError,
  }
}
