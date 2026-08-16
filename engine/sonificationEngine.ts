/**
 * Visual Sonification experiment (debug-only): the Web Audio engine.
 *
 * Resource model: ONE lazily created AudioContext (created only inside the
 * Play action — never at module load, engine construction, or panel open),
 * a master gain → transition-fade gain → 120 Hz high-pass → DynamicsCompressor
 * limiter chain, and a small fixed voice pool: 6 reusable note voices (the
 * SONIFICATION_MAX_VOICES ceiling). Note voices are never stopped per note —
 * their oscillators run continuously and a gain envelope gates them, so there
 * is never one node per glyph/pixel and no node churn per sweep.
 *
 * There is NO continuous bed by design: no root/fifth drone and no looping
 * noise texture. Between gated events every voice gain is EXACTLY 0 (never a
 * 0.0001 "almost zero"), every envelope begins and ends at exactly 0, and a
 * silent or below-threshold scene renders as exact digital silence. The
 * 120 Hz master high-pass sits before the limiter to strip DC and
 * low-frequency buildup from stacked envelopes (the melody floor is 220 Hz,
 * so nothing musical is lost).
 *
 * A short look-ahead scheduler (25ms interval, ~0.18s horizon) schedules the
 * 24 scan steps against the audio clock; the scan-line overlay derives its
 * position from audioContext.currentTime via getSweepPosition(), never rAF.
 * Volume applies immediately; direction/duration changes begin on the next
 * sweep. Every audible transition — Play, Pause, Stop, hidden-tab suspension,
 * and the capture stop/start cycle — ramps a dedicated transition-fade gain
 * (30ms) so context suspends never chop a sounding envelope into a click;
 * the suspend itself is deferred until the fade completes. Hidden tabs
 * suspend the context (the audio clock freezes, so the sweep resumes exactly
 * where it paused); stop() ends playback entirely and the next Play starts a
 * fresh sweep.
 *
 * DOM-free by design: the context comes from an injected factory and every
 * node is a minimal structural interface, so scripts/verify-sonification-audio.js
 * drives the full lifecycle in Node with a stub AudioContext.
 */

import {
  clampSonificationConfig,
  SonificationConfig,
  SONIFICATION_DEFAULTS,
  SONIFICATION_STEPS,
} from './sonificationConfig'
import type {
  SonificationPulseTexture,
  SonificationStepOutput,
} from './sonificationMapper'

// --- Minimal structural Web Audio interfaces (stub-friendly) ----------------

export type SonificationAudioParamLike = {
  value: number
  setValueAtTime: (value: number, time: number) => void
  linearRampToValueAtTime: (value: number, time: number) => void
  cancelScheduledValues: (time: number) => void
}

type NodeLike = {
  connect: (node: unknown) => void
  disconnect: () => void
}

export type SonificationOscillatorLike = NodeLike & {
  type: string
  frequency: SonificationAudioParamLike
  start: (when?: number) => void
  stop: (when?: number) => void
}

export type SonificationGainLike = NodeLike & {
  gain: SonificationAudioParamLike
}

export type SonificationBiquadLike = NodeLike & {
  type: string
  frequency: SonificationAudioParamLike
  Q: SonificationAudioParamLike
}

export type SonificationCompressorLike = NodeLike & {
  threshold: SonificationAudioParamLike
  knee: SonificationAudioParamLike
  ratio: SonificationAudioParamLike
  attack: SonificationAudioParamLike
  release: SonificationAudioParamLike
}

export type SonificationAudioContextLike = {
  currentTime: number
  state: string
  destination: unknown
  createOscillator: () => SonificationOscillatorLike
  createGain: () => SonificationGainLike
  createDynamicsCompressor: () => SonificationCompressorLike
  createBiquadFilter: () => SonificationBiquadLike
  /** Optional: MediaStreamAudioDestinationNode factory for clip capture.
   *  Absent = sonification capture unavailable. */
  createMediaStreamDestination?: () => SonificationCaptureDestinationLike
  suspend: () => void | Promise<void>
  resume: () => void | Promise<void>
  close: () => void | Promise<void>
}

/** Minimal MediaStreamAudioDestinationNode shape. The stream is opaque to
 *  the engine; the host hands it to MediaRecorder. */
export type SonificationCaptureDestinationLike = NodeLike & {
  stream: unknown
}

/** A capture session returned by beginCapture(): the recordable stream plus
 *  an idempotent finish() that restores the pre-capture playback mode. */
export type SonificationCaptureSession = {
  stream: unknown
  finish: () => void
}

// --- Public types -------------------------------------------------------------

export type SonificationPlaybackState = 'idle' | 'playing' | 'paused' | 'error'

export type SonificationEngineTextures = {
  /** Matrix pulse texture; null = no pulses. There is deliberately no drone
   *  or noise texture — continuous beds may not ship. */
  pulses: SonificationPulseTexture | null
}

export type SonificationEngineDiagnostics = {
  playbackState: SonificationPlaybackState
  contextState: string
  activeVoices: number
  scheduledSteps: number
  droppedSteps: number
  /** Last canvas-analysis cost reported by the host, ms. */
  analysisMs: number
}

export type SonificationEngineOptions = {
  /** Context factory — invoked ONLY inside play(). Return null when Web
   *  Audio is unsupported. Defaults to window.AudioContext/webkitAudioContext. */
  createContext?: () => SonificationAudioContextLike | null
  /** Timer injection for non-DOM runtimes (defaults to global setInterval). */
  setIntervalFn?: (fn: () => void, ms: number) => unknown
  clearIntervalFn?: (id: unknown) => void
  /** Timeout injection for the deferred post-fade suspend (defaults to
   *  global setTimeout/clearTimeout). */
  setTimeoutFn?: (fn: () => void, ms: number) => unknown
  clearTimeoutFn?: (id: unknown) => void
  /** Called by the scheduler ~LOOKAHEAD before each scan step sounds; the
   *  host re-reads the current strip, re-maps, and returns the step's notes
   *  (null = silence this step). */
  onScheduleStep: (
    playbackStep: number,
    stepTime: number,
    stepDuration: number,
  ) => SonificationStepOutput | null
  /** Pulse texture params, re-queried at every sweep start. */
  getTextures?: () => SonificationEngineTextures | null
  onPlaybackChange?: (state: SonificationPlaybackState) => void
  onError?: (message: string) => void
}

export type SonificationEngine = {
  play: () => void
  pause: () => void
  /** Full stop: sweep resets; the visitor must press Play again. */
  stop: () => void
  /** Volume applies immediately; sweep duration applies on the next sweep. */
  setConfig: (config: SonificationConfig) => void
  /** visibilitychange driver: hidden suspends, visible resumes if playing. */
  setHidden: (hidden: boolean) => void
  /** Unmount cleanup: stops every source and closes the context. */
  dispose: () => void
  getState: () => SonificationPlaybackState
  /** Audio-clock sweep position 0..1 (playback direction), null when idle. */
  getSweepPosition: () => number | null
  /** The single reusable capture stream (tapped after master gain + limiter,
   *  so the recording equals the audible mix). Null until a context exists,
   *  or when the context can't create a MediaStream destination. */
  getCaptureStream: () => unknown | null
  /** Clip recording: snapshots the current playback mode, starts a FRESH
   *  sweep from step zero (playing through the speakers), and returns the
   *  capture stream + an idempotent finish() restoring the prior mode.
   *  Null when playback or the capture stream can't start. */
  beginCapture: () => SonificationCaptureSession | null
  reportAnalysisMs: (ms: number) => void
  getDiagnostics: () => SonificationEngineDiagnostics
}

export const SONIFICATION_UNSUPPORTED_MESSAGE =
  'Web Audio is not supported in this browser.'

const SCHEDULER_INTERVAL_MS = 25
const LOOKAHEAD_S = 0.18
const START_OFFSET_S = 0.1
/** A step whose start time fell this far behind the audio clock is dropped. */
const DROP_SLOP_S = 0.05
const NOTE_VOICE_COUNT = 6 // = SONIFICATION_MAX_VOICES
const NOTE_LEVEL = 0.5
/** Pulse events are short and fully gated: 60ms total, ending at exactly 0,
 *  so there is real silence between pulses even at the fastest matrix rate. */
const PULSE_DURATION_S = 0.06
/** Master high-pass cutoff: strips DC and low-frequency buildup before the
 *  limiter. The musical floor is A3 = 220 Hz, so nothing scored is lost. */
const HIGHPASS_CUTOFF_HZ = 120
/** Transition-fade duration. 30ms is long enough to de-click any context
 *  suspend/resume boundary, short enough to feel immediate. */
const TRANSITION_FADE_S = 0.03

const volumeToGain = (volume: number): number =>
  Math.pow(Math.min(100, Math.max(0, volume)) / 100, 2) * 0.9

const defaultCreateContext = (): SonificationAudioContextLike | null => {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    return new Ctor() as unknown as SonificationAudioContextLike
  } catch {
    return null
  }
}

export function createSonificationEngine(
  options: SonificationEngineOptions,
): SonificationEngine {
  const createContext = options.createContext ?? defaultCreateContext
  const setTimer = options.setIntervalFn ?? ((fn: () => void, ms: number) => setInterval(fn, ms))
  const clearTimer =
    options.clearIntervalFn ?? ((id: unknown) => clearInterval(id as Parameters<typeof clearInterval>[0]))
  const setTimeoutFn =
    options.setTimeoutFn ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimeoutFn =
    options.clearTimeoutFn ?? ((id: unknown) => clearTimeout(id as Parameters<typeof clearTimeout>[0]))

  let ctx: SonificationAudioContextLike | null = null
  let state: SonificationPlaybackState = 'idle'
  let config: SonificationConfig | null = null
  // Direction/duration changes land on the next sweep; volume is immediate.
  let pendingSweepDuration: number | null = null
  let sweepDuration = 8
  let stepDuration = sweepDuration / SONIFICATION_STEPS
  let sweepStartTime = 0
  let nextStepTime = 0
  let nextStep = 0
  let nextPulseTime = 0
  let timerId: unknown = null
  let hiddenSuspended = false
  let scheduledSteps = 0
  let droppedSteps = 0
  let analysisMs = 0

  // Graph (built once per context).
  let masterGain: SonificationGainLike | null = null
  /** Dedicated fade stage for Play/Pause/Stop/visibility/capture transitions;
   *  separate from the volume stage so fades never fight user volume. */
  let transitionGain: SonificationGainLike | null = null
  let highpassFilter: SonificationBiquadLike | null = null
  let pulseTexture: SonificationPulseTexture | null = null
  /** Single reusable capture tap (after master gain + limiter). */
  let captureDest: SonificationCaptureDestinationLike | null = null
  let captureUnavailable = false
  /** Pending deferred suspend (fires only after the fade-out completes). */
  let suspendTimeoutId: unknown = null
  type Voice = {
    osc: SonificationOscillatorLike
    filter: SonificationBiquadLike
    gain: SonificationGainLike
    busyUntil: number
  }
  let voices: Voice[] = []

  const setState = (next: SonificationPlaybackState) => {
    if (state === next) return
    state = next
    options.onPlaybackChange?.(next)
  }

  const stopTimer = () => {
    if (timerId !== null) {
      clearTimer(timerId)
      timerId = null
    }
  }

  const startTimer = () => {
    if (timerId === null) {
      timerId = setTimer(tick, SCHEDULER_INTERVAL_MS)
    }
  }

  const buildGraph = (context: SonificationAudioContextLike) => {
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.knee.value = 24
    compressor.ratio.value = 8
    compressor.attack.value = 0.004
    compressor.release.value = 0.24
    compressor.connect(context.destination)

    // Master high-pass BEFORE the limiter: keeps 20–120 Hz buildup out of
    // both the speakers and the capture mix.
    const highpass = context.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = HIGHPASS_CUTOFF_HZ
    highpass.Q.value = 0.707 // Butterworth: maximally flat passband
    highpass.connect(compressor)
    highpassFilter = highpass

    // Transition-fade stage: Play/Pause/Stop/visibility/capture ramps live
    // here so they never rewrite (or fight) the visitor's volume setting.
    const transition = context.createGain()
    transition.gain.value = 0 // every playback begins with a fade-in
    transition.connect(highpass)
    transitionGain = transition

    const master = context.createGain()
    master.gain.value = volumeToGain(config?.volume ?? 35)
    master.connect(transition)
    masterGain = master

    // Clip capture: ONE reusable MediaStream destination tapped after the
    // limiter, so the recorded mix is exactly the audible mix.
    if (context.createMediaStreamDestination) {
      try {
        captureDest = context.createMediaStreamDestination()
        compressor.connect(captureDest)
        captureUnavailable = false
      } catch {
        captureDest = null
        captureUnavailable = true
      }
    } else {
      captureUnavailable = true
    }

    // Reusable note voices: always-running oscillators gated by gain. Every
    // idle gate is EXACTLY 0 — no 0.0001 leaks, no continuous bed.
    voices = []
    for (let i = 0; i < NOTE_VOICE_COUNT; i += 1) {
      const osc = context.createOscillator()
      osc.type = 'sine'
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 2000
      const gain = context.createGain()
      gain.gain.value = 0
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      osc.start(0)
      voices.push({ osc, filter, gain, busyUntil: 0 })
    }
  }

  const pickVoice = (when: number): Voice => {
    let oldest = voices[0]
    for (const voice of voices) {
      if (voice.busyUntil <= when) return voice
      if (voice.busyUntil < oldest.busyUntil) oldest = voice
    }
    // All busy: steal the voice that frees up first.
    return oldest
  }

  const gateVoice = (
    voice: Voice,
    when: number,
    duration: number,
    peak: number,
    frequency: number,
    blend: number,
    brightness: number,
  ) => {
    const osc = voice.osc
    osc.type = blend > 0.5 ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(frequency, when)
    voice.filter.frequency.setValueAtTime(300 + brightness * 3400, when)
    const gain = voice.gain.gain
    gain.cancelScheduledValues(when)
    // Every envelope begins AND ends at exactly 0.
    gain.setValueAtTime(0, when)
    gain.linearRampToValueAtTime(peak, when + 0.015)
    gain.setValueAtTime(peak, when + duration * 0.6)
    gain.linearRampToValueAtTime(0, when + duration)
    voice.busyUntil = when + duration
  }

  const scheduleNotes = (out: SonificationStepOutput, when: number, duration: number) => {
    for (const note of out.notes) {
      gateVoice(
        pickVoice(when),
        when,
        duration,
        note.gain * NOTE_LEVEL,
        note.frequency,
        note.blend,
        note.brightness,
      )
    }
  }

  const schedulePulse = (when: number, texture: SonificationPulseTexture) => {
    gateVoice(pickVoice(when), when, PULSE_DURATION_S, texture.gain, texture.frequency, 0, 0.9)
    const echoAt = when + texture.delaySeconds
    gateVoice(
      pickVoice(echoAt),
      echoAt,
      PULSE_DURATION_S,
      texture.gain * texture.echoGain,
      texture.frequency,
      0,
      0.9,
    )
  }

  const applyTextures = (textures: SonificationEngineTextures | null) => {
    pulseTexture = textures?.pulses ?? null
  }

  const silenceNow = () => {
    if (!ctx) return
    const now = ctx.currentTime
    for (const voice of voices) {
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setValueAtTime(0, now)
      voice.busyUntil = 0
    }
  }

  const clearSuspendTimeout = () => {
    if (suspendTimeoutId !== null) {
      clearTimeoutFn(suspendTimeoutId)
      suspendTimeoutId = null
    }
  }

  /** Ramp the transition-fade stage (30ms) so no transition chops a sounding
   *  envelope into a click. */
  const fadeTransition = (target: 0 | 1) => {
    if (!ctx || !transitionGain) return
    const now = ctx.currentTime
    const gain = transitionGain.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(gain.value, now)
    gain.linearRampToValueAtTime(target, now + TRANSITION_FADE_S)
  }

  /** Fade out first; suspend only after the fade has completed. A stale
   *  pending suspend is cancelled by any resume/play that lands first. */
  const suspendAfterFade = () => {
    if (!ctx) return
    fadeTransition(0)
    clearSuspendTimeout()
    suspendTimeoutId = setTimeoutFn(() => {
      suspendTimeoutId = null
      try {
        ctx?.suspend()
      } catch {}
    }, TRANSITION_FADE_S * 1000)
  }

  const resumeWithFade = () => {
    if (!ctx) return
    clearSuspendTimeout()
    try {
      ctx.resume()
    } catch {}
    fadeTransition(1)
  }

  const advanceSweep = () => {
    nextStep += 1
    if (nextStep >= SONIFICATION_STEPS) {
      // Sweep boundary: pending duration/direction changes take effect here.
      sweepStartTime += sweepDuration
      if (pendingSweepDuration !== null) {
        sweepDuration = pendingSweepDuration
        pendingSweepDuration = null
      }
      stepDuration = sweepDuration / SONIFICATION_STEPS
      nextStep = 0
      nextPulseTime = Math.max(nextPulseTime, sweepStartTime)
      try {
        applyTextures(options.getTextures?.() ?? null)
      } catch {}
    }
    nextStepTime = sweepStartTime + nextStep * stepDuration
  }

  function tick() {
    if (state !== 'playing' || !ctx) return
    const now = ctx.currentTime
    const horizon = now + LOOKAHEAD_S
    let guard = 0
    while (nextStepTime <= horizon && guard < 64) {
      guard += 1
      if (nextStepTime < now - DROP_SLOP_S) {
        // The scheduler fell behind (long task): skip, don't pile up.
        droppedSteps += 1
      } else {
        scheduledSteps += 1
        let out: SonificationStepOutput | null = null
        try {
          out = options.onScheduleStep(nextStep, nextStepTime, stepDuration)
        } catch {}
        if (out) scheduleNotes(out, nextStepTime, stepDuration)
      }
      advanceSweep()
    }
    if (pulseTexture && pulseTexture.gain > 0) {
      let pulseGuard = 0
      while (nextPulseTime <= horizon && pulseGuard < 64) {
        pulseGuard += 1
        if (nextPulseTime >= now - DROP_SLOP_S) {
          schedulePulse(nextPulseTime, pulseTexture)
        }
        nextPulseTime += 1 / Math.max(0.1, pulseTexture.rateHz)
      }
    }
  }

  const play = () => {
    if (state === 'playing') return
    if (!ctx) {
      // The ONLY place an AudioContext is created: inside the Play action.
      ctx = createContext()
      if (!ctx) {
        options.onError?.(SONIFICATION_UNSUPPORTED_MESSAGE)
        setState('error')
        return
      }
      buildGraph(ctx)
    }
    if (!config) config = { ...SONIFICATION_DEFAULTS }
    if (state !== 'paused') {
      // Fresh sweep (after idle/stop/error-retry): apply pending duration now.
      if (pendingSweepDuration !== null) {
        sweepDuration = pendingSweepDuration
        pendingSweepDuration = null
      }
      stepDuration = sweepDuration / SONIFICATION_STEPS
      sweepStartTime = ctx.currentTime + START_OFFSET_S
      nextStepTime = sweepStartTime
      nextStep = 0
      nextPulseTime = sweepStartTime
      try {
        applyTextures(options.getTextures?.() ?? null)
      } catch {}
    }
    setState('playing')
    resumeWithFade()
    startTimer()
  }

  const pause = () => {
    if (state !== 'playing' || !ctx) return
    stopTimer()
    setState('paused')
    suspendAfterFade()
  }

  const stop = () => {
    if (state === 'idle' && !ctx) return
    stopTimer()
    hiddenSuspended = false
    silenceNow()
    nextStep = 0
    setState('idle')
    suspendAfterFade()
  }

  const setConfig = (next: SonificationConfig) => {
    config = clampSonificationConfig(next)
    // Volume is immediate…
    if (masterGain && ctx) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime)
      masterGain.gain.setValueAtTime(volumeToGain(config.volume), ctx.currentTime)
    }
    // …duration (and direction, applied by the host's mapper) next sweep.
    pendingSweepDuration = config.sweepDuration
  }

  const setHidden = (hidden: boolean) => {
    if (hidden) {
      if (state === 'playing' && ctx && !hiddenSuspended) {
        hiddenSuspended = true
        stopTimer()
        suspendAfterFade()
      }
      return
    }
    if (hiddenSuspended) {
      hiddenSuspended = false
      if (state === 'playing' && ctx) {
        resumeWithFade()
        startTimer()
      }
    }
  }

  const dispose = () => {
    stopTimer()
    clearSuspendTimeout()
    hiddenSuspended = false
    if (ctx) {
      silenceNow()
      for (const voice of voices) {
        try {
          voice.osc.stop(0)
          voice.osc.disconnect()
        } catch {}
      }
      try {
        captureDest?.disconnect()
      } catch {}
      captureDest = null
      captureUnavailable = false
      try {
        ctx.close()
      } catch {}
    }
    ctx = null
    masterGain = null
    transitionGain = null
    highpassFilter = null
    pulseTexture = null
    voices = []
    setState('idle')
  }

  const getCaptureStream = (): unknown | null => {
    if (!ctx || captureUnavailable || !captureDest) return null
    return captureDest.stream
  }

  const restorePlaybackMode = (prior: SonificationPlaybackState) => {
    if (prior === 'playing') return // capture left playback running
    if (prior === 'paused') {
      pause()
      return
    }
    // idle/error: end playback entirely.
    stop()
  }

  const beginCapture = (): SonificationCaptureSession | null => {
    const prior = state
    // Fresh sweep from step zero: stop() resets the scan position, play()
    // (re)creates/resumes the single context and starts from step 0. Both
    // transitions are faded (stop fades out, play fades in), so the capture
    // boundary never clicks.
    if (state === 'playing' || state === 'paused') stop()
    play()
    if (state !== 'playing') {
      restorePlaybackMode(prior)
      return null
    }
    const stream = getCaptureStream()
    if (!stream) {
      restorePlaybackMode(prior)
      return null
    }
    let finished = false
    return {
      stream,
      finish: () => {
        if (finished) return
        finished = true
        restorePlaybackMode(prior)
      },
    }
  }

  return {
    play,
    pause,
    stop,
    setConfig,
    setHidden,
    dispose,
    getState: () => state,
    getSweepPosition: () => {
      if (!ctx || (state !== 'playing' && state !== 'paused')) return null
      const elapsed = ctx.currentTime - sweepStartTime
      if (elapsed <= 0) return 0
      return (elapsed % sweepDuration) / sweepDuration
    },
    getCaptureStream,
    beginCapture,
    reportAnalysisMs: (ms: number) => {
      if (Number.isFinite(ms) && ms >= 0) analysisMs = ms
    },
    getDiagnostics: () => {
      const now = ctx?.currentTime ?? 0
      let activeVoices = 0
      for (const voice of voices) {
        if (voice.busyUntil > now) activeVoices += 1
      }
      return {
        playbackState: state,
        contextState: ctx ? ctx.state : 'none',
        activeVoices,
        scheduledSteps,
        droppedSteps,
        analysisMs,
      }
    },
  }
}
