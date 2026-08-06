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
  createClipRecorder,
  ClipRecorder,
  ClipRecorderLike,
  ClipRecordingResult,
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
  /** Dev-only test hook (?clipTestMs=) shortens the active-time target. */
  durationMs?: number
}

export type ClipRecorderControls = {
  /** Clip capability (captureStream + MediaRecorder + a usable MIME). */
  supported: boolean
  unsupportedReason: string | null
  phase: ClipPhase
  durationMs: number
  /** Active-time remaining (hidden time excluded). */
  remainingMs: number
  /** Restrained live-region text: started/paused/resumed/ready/canceled/failed. */
  announcement: string | null
  error: string | null
  preview: ClipPreview | null
  start: () => void
  cancel: () => void
  retake: () => void
  closePreview: () => void
  /** Called after a SUCCESSFUL native share: releases the preview. */
  releasePreview: () => void
}

const CLIP_UNSUPPORTED_MESSAGE = 'Clip recording is not supported in this browser.'
const CLIP_AUDIO_FAILURE_MESSAGE = 'Could not start the soundtrack — the clip was not recorded.'
const CLIP_CAPTURE_FAILURE_MESSAGE = 'Could not capture the canvas — the clip was not recorded.'

export function useClipRecorder({
  enabled,
  sceneCanvasRef,
  beginCapture,
  durationMs = CLIP_DURATION_DEFAULT_MS,
}: UseClipRecorderOptions): ClipRecorderControls {
  const [phase, setPhase] = useState<ClipPhase>('idle')
  const [remainingMs, setRemainingMs] = useState(durationMs)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ClipPreview | null>(null)

  const recorderRef = useRef<ClipRecorder | null>(null)
  const captureRef = useRef<SonificationCaptureSession | null>(null)
  const frameTimerRef = useRef<number | null>(null)
  const prevCoreStateRef = useRef<string>('idle')
  const durationRef = useRef(durationMs)
  useEffect(() => {
    durationRef.current = durationMs
  }, [durationMs])

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

  const stopFrameTimer = () => {
    if (frameTimerRef.current !== null) {
      window.clearInterval(frameTimerRef.current)
      frameTimerRef.current = null
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

  const handleFinished = useCallback((result: ClipRecordingResult) => {
    stopFrameTimer()
    finishCapture()
    setPreview({
      url: result.url,
      blob: result.blob,
      mimeType: result.mimeType,
      filename: result.filename,
    })
    setPhase('ready')
    setAnnouncement('Clip ready')
  }, [])

  const handleError = useCallback((message: string) => {
    stopFrameTimer()
    finishCapture()
    recorderRef.current = null
    setError(message)
    setPhase('error')
    setAnnouncement('Recording failed')
  }, [])

  const handleCanceled = useCallback((reason: string) => {
    stopFrameTimer()
    finishCapture()
    recorderRef.current = null
    setPhase('idle')
    setRemainingMs(durationRef.current)
    setAnnouncement(reason === 'user' ? 'Recording canceled' : 'Recording canceled')
  }, [])

  const start = useCallback(() => {
    if (!support.supported || recorderRef.current) return
    setError(null)
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
      const canvasStream = canvas.captureStream(30)
      videoTrack = canvasStream.getVideoTracks()[0] ?? null
      audioTrack = (capture.stream as MediaStream).getAudioTracks()[0]?.clone() ?? null
      if (!videoTrack || !audioTrack) throw new Error('missing track')
      combined = new MediaStream([videoTrack, audioTrack])
    } catch {
      finishCapture()
      setError(CLIP_CAPTURE_FAILURE_MESSAGE)
      setPhase('error')
      setAnnouncement('Recording failed')
      return
    }

    // Reduced motion: the canvas settles statically, so captureStream would
    // emit no frames — request them deterministically instead. The requested
    // soundtrack is unaffected.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const requestableTrack = videoTrack as MediaStreamTrack & { requestFrame?: () => void }
    if (reducedMotion && typeof requestableTrack.requestFrame === 'function') {
      frameTimerRef.current = window.setInterval(() => {
        try {
          requestableTrack.requestFrame?.()
        } catch {}
      }, 500)
    }

    prevCoreStateRef.current = 'idle'
    setRemainingMs(durationRef.current)
    const recorder = createClipRecorder({
      stream: combined,
      createRecorder: (stream, options) =>
        new MediaRecorder(
          stream as unknown as MediaStream,
          options,
        ) as unknown as ClipRecorderLike,
      isTypeSupported: (mime) => MediaRecorder.isTypeSupported(mime),
      now: () => performance.now(),
      setIntervalFn: (fn, ms) => window.setInterval(fn, ms),
      clearIntervalFn: (id) => window.clearInterval(id as number),
      url: {
        create: (blob) => URL.createObjectURL(blob),
        revoke: (url) => URL.revokeObjectURL(url),
      },
      durationMs: durationRef.current,
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
    setRemainingMs(durationRef.current)
  }, [])

  const retake = useCallback(() => {
    recorderRef.current?.discardResult()
    recorderRef.current = null
    setPreview(null)
    setPhase('idle')
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start])

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
      stopFrameTimer()
      finishCapture()
      setPreview(null)
      setPhase('idle')
      setRemainingMs(durationRef.current)
    }
  }, [enabled])

  // Unmount: stop owned tracks/timers and revoke any preview URL.
  useEffect(
    () => () => {
      recorderRef.current?.dispose()
      recorderRef.current = null
      stopFrameTimer()
      captureRef.current?.finish()
      captureRef.current = null
    },
    [],
  )

  return {
    supported: support.supported,
    unsupportedReason: support.reason,
    phase,
    durationMs,
    remainingMs,
    announcement,
    error,
    preview,
    start,
    cancel,
    retake,
    closePreview,
    releasePreview: closePreview,
  }
}
