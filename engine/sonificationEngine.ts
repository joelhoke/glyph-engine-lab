/**
 * Visual Sonification experiment (debug-only): the Web Audio engine.
 *
 * Resource model: ONE lazily created AudioContext (created only inside the
 * Play action — never at module load, engine construction, or panel open),
 * a master gain + DynamicsCompressor limiter, and a small fixed voice pool:
 * 2 drone oscillators + 6 reusable note voices (8 total, the
 * SONIFICATION_MAX_VOICES ceiling) plus one seeded looping noise source.
 * Note voices are never stopped per note — their oscillators run
 * continuously and a gain envelope gates them, so there is never one node
 * per glyph/pixel and no node churn per sweep.
 *
 * A short look-ahead scheduler (25ms interval, ~0.18s horizon) schedules the
 * 24 scan steps against the audio clock; the scan-line overlay derives its
 * position from audioContext.currentTime via getSweepPosition(), never rAF.
 * Volume applies immediately; direction/duration changes begin on the next
 * sweep. Hidden tabs suspend the context (the audio clock freezes, so the
 * sweep resumes exactly where it paused); stop() ends playback entirely and
 * the next Play starts a fresh sweep.
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
  SonificationDrone,
  SonificationNoiseTexture,
  SonificationPulseTexture,
  SonificationStepOutput,
} from './sonificationMapper'
import { createSeededRandom } from './random'

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

export type SonificationBufferLike = {
  getChannelData: (channel: number) => Float32Array
}

export type SonificationBufferSourceLike = NodeLike & {
  buffer: SonificationBufferLike | null
  loop: boolean
  start: (when?: number) => void
  stop: (when?: number) => void
}

export type SonificationAudioContextLike = {
  currentTime: number
  state: string
  destination: unknown
  createOscillator: () => SonificationOscillatorLike
  createGain: () => SonificationGainLike
  createDynamicsCompressor: () => SonificationCompressorLike
  createBiquadFilter: () => SonificationBiquadLike
  createBuffer: (
    channels: number,
    length: number,
    sampleRate: number,
  ) => SonificationBufferLike
  createBufferSource: () => SonificationBufferSourceLike
  suspend: () => void | Promise<void>
  resume: () => void | Promise<void>
  close: () => void | Promise<void>
}

// --- Public types -------------------------------------------------------------

export type SonificationPlaybackState = 'idle' | 'playing' | 'paused' | 'error'

export type SonificationEngineTextures = {
  drone: SonificationDrone
  noise: SonificationNoiseTexture | null
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
  /** Called by the scheduler ~LOOKAHEAD before each scan step sounds; the
   *  host re-reads the current strip, re-maps, and returns the step's notes
   *  (null = drone/ambient only). */
  onScheduleStep: (
    playbackStep: number,
    stepTime: number,
    stepDuration: number,
  ) => SonificationStepOutput | null
  /** Drone/noise/pulse params, re-queried at every sweep start. */
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
const NOTE_VOICE_COUNT = 6 // + 2 drone oscillators = SONIFICATION_MAX_VOICES
const NOTE_LEVEL = 0.5
const PULSE_DURATION_S = 0.06

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
  let droneGain: SonificationGainLike | null = null
  let droneFilter: SonificationBiquadLike | null = null
  let droneOsc: SonificationOscillatorLike | null = null
  let droneFifthOsc: SonificationOscillatorLike | null = null
  let noiseGain: SonificationGainLike | null = null
  let noiseFilter: SonificationBiquadLike | null = null
  let noiseSource: SonificationBufferSourceLike | null = null
  let pulseTexture: SonificationPulseTexture | null = null
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

    const master = context.createGain()
    master.gain.value = volumeToGain(config?.volume ?? 35)
    master.connect(compressor)
    masterGain = master

    // Drone: root + fifth sines through a soft lowpass.
    const dFilter = context.createBiquadFilter()
    dFilter.type = 'lowpass'
    dFilter.frequency.value = 800
    const dGain = context.createGain()
    dGain.gain.value = 0
    const dOsc = context.createOscillator()
    dOsc.type = 'sine'
    const dFifth = context.createOscillator()
    dFifth.type = 'sine'
    dOsc.connect(dFilter)
    dFifth.connect(dFilter)
    dFilter.connect(dGain)
    dGain.connect(master)
    dOsc.start(0)
    dFifth.start(0)
    droneFilter = dFilter
    droneGain = dGain
    droneOsc = dOsc
    droneFifthOsc = dFifth

    // Seeded noise texture (deterministic buffer, reused for the session).
    const nFilter = context.createBiquadFilter()
    nFilter.type = 'lowpass'
    nFilter.frequency.value = 600
    const nGain = context.createGain()
    nGain.gain.value = 0
    const source = context.createBufferSource()
    const length = 44100 * 2
    const buffer = context.createBuffer(1, length, 44100)
    const data = buffer.getChannelData(0)
    const random = createSeededRandom(0x5eed)
    for (let i = 0; i < length; i += 1) {
      data[i] = random() * 2 - 1
    }
    source.buffer = buffer
    source.loop = true
    source.connect(nFilter)
    nFilter.connect(nGain)
    nGain.connect(master)
    source.start(0)
    noiseFilter = nFilter
    noiseGain = nGain
    noiseSource = source

    // Reusable note voices: always-running oscillators gated by gain.
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
    gain.setValueAtTime(0.0001, when)
    gain.linearRampToValueAtTime(Math.max(0.0001, peak), when + 0.015)
    gain.setValueAtTime(Math.max(0.0001, peak), when + duration * 0.6)
    gain.linearRampToValueAtTime(0.0001, when + duration * 0.95)
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

  const rampParam = (param: SonificationAudioParamLike, value: number, now: number, ramp: number) => {
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(value, now + ramp)
  }

  const applyTextures = (textures: SonificationEngineTextures | null) => {
    if (!ctx || !droneGain || !droneFilter || !droneOsc || !droneFifthOsc) return
    const now = ctx.currentTime
    const drone = textures?.drone ?? null
    if (drone) {
      droneOsc.frequency.setValueAtTime(drone.rootFrequency, now)
      droneFifthOsc.frequency.setValueAtTime(drone.fifthFrequency, now)
      droneFilter.frequency.setValueAtTime(drone.cutoff, now)
      rampParam(droneGain.gain, drone.gain, now, 0.5)
    } else {
      rampParam(droneGain.gain, 0, now, 0.3)
    }
    if (noiseGain && noiseFilter) {
      const noise = textures?.noise ?? null
      if (noise && noise.gain > 0) {
        noiseFilter.frequency.setValueAtTime(noise.cutoff, now)
        rampParam(noiseGain.gain, noise.gain, now, 0.5)
      } else {
        rampParam(noiseGain.gain, 0, now, 0.3)
      }
    }
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
    if (droneGain) {
      droneGain.gain.cancelScheduledValues(now)
      droneGain.gain.setValueAtTime(0, now)
    }
    if (noiseGain) {
      noiseGain.gain.cancelScheduledValues(now)
      noiseGain.gain.setValueAtTime(0, now)
    }
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
    try {
      ctx.resume()
    } catch {}
    startTimer()
  }

  const pause = () => {
    if (state !== 'playing' || !ctx) return
    stopTimer()
    setState('paused')
    try {
      ctx.suspend()
    } catch {}
  }

  const stop = () => {
    if (state === 'idle' && !ctx) return
    stopTimer()
    hiddenSuspended = false
    silenceNow()
    nextStep = 0
    setState('idle')
    if (ctx) {
      try {
        ctx.suspend()
      } catch {}
    }
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
        try {
          ctx.suspend()
        } catch {}
      }
      return
    }
    if (hiddenSuspended) {
      hiddenSuspended = false
      if (state === 'playing' && ctx) {
        try {
          ctx.resume()
        } catch {}
        startTimer()
      }
    }
  }

  const dispose = () => {
    stopTimer()
    hiddenSuspended = false
    if (ctx) {
      silenceNow()
      for (const voice of voices) {
        try {
          voice.osc.stop(0)
          voice.osc.disconnect()
        } catch {}
      }
      for (const osc of [droneOsc, droneFifthOsc]) {
        try {
          osc?.stop(0)
          osc?.disconnect()
        } catch {}
      }
      try {
        noiseSource?.stop(0)
        noiseSource?.disconnect()
      } catch {}
      try {
        ctx.close()
      } catch {}
    }
    ctx = null
    masterGain = null
    droneGain = null
    droneFilter = null
    droneOsc = null
    droneFifthOsc = null
    noiseGain = null
    noiseFilter = null
    noiseSource = null
    pulseTexture = null
    voices = []
    setState('idle')
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
