/**
 * Visual Sonification experiment (debug-only): the scene → score mapper.
 *
 * Pure and deterministic: identical input produces an identical score, and
 * materially different scenes produce distinct scores. No clocks, no DOM, no
 * Math.random — tie-breaks are structural (band order), never random.
 *
 * Mapping summary:
 *  - Sweep axis = time; reverse directions are exactly the canonical phrase
 *    reversed (right-to-left = reverse of left-to-right, etc.) because each
 *    step's output depends only on that step's own cells.
 *  - Perpendicular position = pitch; band 0 (top/left) maps highest.
 *  - Background hues → chromatic root + a quiet root/fifth drone.
 *  - Background luminance → register and filter brightness.
 *  - Cell contrast/density → note selection and loudness (activity
 *    threshold; below it only the drone/ambient texture sounds).
 *  - Cell hue/saturation → harmonic brightness and the sine/triangle blend.
 *  - Weather → a seeded filtered-noise texture shaped by intensity/wind.
 *  - Matrix → restrained high pulses and an echo shaped by speed/volume/trail.
 *  - Melody notes quantize to minor pentatonic across ~3 octaves.
 *
 * Verified by scripts/verify-sonification.js.
 */

import type { SonificationGrid } from './sonificationAnalysis'
import {
  isReversedSonificationDirection,
  SonificationDirection,
  SONIFICATION_BANDS,
  SONIFICATION_MAX_NOTES_PER_STEP,
  SONIFICATION_STEPS,
} from './sonificationConfig'

export type SonificationSceneParams = {
  /** Background gradient hues in degrees (0..360). */
  backgroundHue1: number
  backgroundHue2: number
  /** Background luminance 0..1 (drives register and filter brightness). */
  backgroundLuminance: number
  /** Active weather layer params; null when weather is off. */
  weather: { intensity: number; wind: number } | null
  /** Active matrix layer params; null when matrix is off. */
  matrix: { speed: number; volume: number; trailStrength: number } | null
}

export type SonificationNoteEvent = {
  /** Quantized minor-pentatonic frequency in Hz. */
  frequency: number
  /** Pre-master loudness 0..1 from cell contrast/density. */
  gain: number
  /** Source band (0 = top/left, highest). */
  band: number
  /** Sine/triangle blend 0..1 from cell saturation. */
  blend: number
  /** Harmonic brightness 0..1 from cell hue/saturation. */
  brightness: number
}

export type SonificationStepOutput = {
  /** At most SONIFICATION_MAX_NOTES_PER_STEP notes. */
  notes: SonificationNoteEvent[]
  /** Strongest band activity this step (after thresholding), 0..1. */
  activity: number
}

export type SonificationDrone = {
  rootFrequency: number
  fifthFrequency: number
  gain: number
  cutoff: number
}

export type SonificationNoiseTexture = {
  gain: number
  cutoff: number
  /** Wind-driven stereo/filter drift 0..1. */
  drift: number
}

export type SonificationPulseTexture = {
  rateHz: number
  frequency: number
  gain: number
  /** Echo delay in seconds and echo level, shaped by trail strength. */
  delaySeconds: number
  echoGain: number
}

export type SonificationScore = {
  /** 24 steps in PLAYBACK order (direction already applied). */
  steps: SonificationStepOutput[]
  drone: SonificationDrone
  noise: SonificationNoiseTexture | null
  pulses: SonificationPulseTexture | null
}

/** Minor pentatonic across ~3 octaves (15 degrees). */
const PENTATONIC_MINOR = [0, 3, 5, 7, 10] as const
const SCALE_OCTAVES = 3
const SCALE_DEGREES = PENTATONIC_MINOR.length * SCALE_OCTAVES

/** A2: low enough to stay atmospheric, high enough to read as a root. */
const ROOT_BASE_MIDI = 45

/** A band must clear this activity to voice a note; below it the step is
 *  drone/ambient only. */
export const SONIFICATION_ACTIVITY_THRESHOLD = 0.12

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Circular mean of the two background hues → chromatic root semitone. */
export function resolveRootSemitone(hue1: number, hue2: number): number {
  const r1 = (hue1 * Math.PI) / 180
  const r2 = (hue2 * Math.PI) / 180
  const x = Math.cos(r1) + Math.cos(r2)
  const y = Math.sin(r1) + Math.sin(r2)
  if (Math.sqrt(x * x + y * y) < 1e-6) return 0
  let mean = (Math.atan2(y, x) * 180) / Math.PI
  if (mean < 0) mean += 360
  return Math.floor(mean / 30) % 12
}

/** Background luminance → register shift in semitones (darker = lower). */
export function resolveRegisterShift(backgroundLuminance: number): number {
  if (backgroundLuminance < 0.3) return -12
  if (backgroundLuminance > 0.75) return 12
  return 0
}

/** Band index → scale degree; band 0 (top/left) is the highest degree. */
function bandToScaleDegree(band: number): number {
  const t = band / (SONIFICATION_BANDS - 1)
  return SCALE_DEGREES - 1 - Math.round(t * (SCALE_DEGREES - 1))
}

function degreeToMidi(rootMidi: number, degree: number): number {
  const octave = Math.floor(degree / PENTATONIC_MINOR.length)
  const step = PENTATONIC_MINOR[degree % PENTATONIC_MINOR.length]
  // Melody sits one octave above the drone root.
  return rootMidi + 12 + octave * 12 + step
}

/** Activity from contrast/density — the note-selection signal. */
function cellActivity(contrast: number, density: number): number {
  return clamp01(contrast * 1.6 + density * 0.9)
}

/** Wrapped hue distance 0..180 between a cell hue and the background mean. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Map the canonical 24×12 feature grid + scene params to a full score.
 * Steps are returned in playback order: reverse directions simply reverse
 * the canonical step order, so rtl(input) === reverse(ltr(input)) exactly.
 */
export function mapSonification(
  grid: SonificationGrid,
  params: SonificationSceneParams,
  direction: SonificationDirection,
): SonificationScore {
  const semitone = resolveRootSemitone(params.backgroundHue1, params.backgroundHue2)
  const rootMidi =
    ROOT_BASE_MIDI + semitone + resolveRegisterShift(params.backgroundLuminance)
  const backgroundMeanHue = (() => {
    const r1 = (params.backgroundHue1 * Math.PI) / 180
    const r2 = (params.backgroundHue2 * Math.PI) / 180
    let mean = (Math.atan2(Math.sin(r1) + Math.sin(r2), Math.cos(r1) + Math.cos(r2)) * 180) / Math.PI
    if (mean < 0) mean += 360
    return mean
  })()

  const steps: SonificationStepOutput[] = []
  const reversed = isReversedSonificationDirection(direction)
  // Scratch selection buffers reused across steps (no per-step allocation of
  // the candidate list itself is a non-goal at 3 maps/sec, but keep it tidy).
  for (let playback = 0; playback < SONIFICATION_STEPS; playback += 1) {
    const step = reversed ? SONIFICATION_STEPS - 1 - playback : playback
    const base = step * SONIFICATION_BANDS
    // Score every band, then keep the strongest ≤ MAX_NOTES that clear the
    // activity threshold. Sort is deterministic: activity desc, band asc.
    const candidates: { band: number; activity: number }[] = []
    for (let band = 0; band < SONIFICATION_BANDS; band += 1) {
      const activity = cellActivity(grid.contrast[base + band], grid.density[base + band])
      if (activity >= SONIFICATION_ACTIVITY_THRESHOLD) {
        candidates.push({ band, activity })
      }
    }
    candidates.sort((a, b) => b.activity - a.activity || a.band - b.band)
    const active = candidates.slice(0, SONIFICATION_MAX_NOTES_PER_STEP)
    const notes: SonificationNoteEvent[] = active.map(({ band, activity }) => {
      const cell = base + band
      const hue = grid.hue[cell]
      const saturation = clamp01(grid.saturation[cell])
      const brightness =
        hue < 0
          ? 0.4
          : clamp01(0.25 + saturation * 0.5 + (hueDistance(hue, backgroundMeanHue) / 180) * 0.5)
      return {
        frequency: midiToFrequency(degreeToMidi(rootMidi, bandToScaleDegree(band))),
        gain: clamp01(0.2 + activity * 0.8),
        band,
        blend: saturation,
        brightness,
      }
    })
    steps.push({
      notes,
      activity: active.length > 0 ? active[0].activity : 0,
    })
  }

  const drone: SonificationDrone = {
    rootFrequency: midiToFrequency(rootMidi),
    fifthFrequency: midiToFrequency(rootMidi + 7),
    gain: 0.18,
    cutoff: 300 + clamp01(params.backgroundLuminance) * 1200,
  }

  const noise: SonificationNoiseTexture | null = params.weather
    ? {
        gain: (clamp01(params.weather.intensity / 200) * 0.25),
        cutoff: 300 + clamp01(params.weather.wind / 100) * 2200,
        drift: clamp01(params.weather.wind / 100),
      }
    : null

  const pulses: SonificationPulseTexture | null = params.matrix
    ? {
        rateHz: 0.5 + clamp01(params.matrix.speed / 400) * 3.5,
        frequency: midiToFrequency(rootMidi + 36),
        gain: clamp01(params.matrix.volume / 100) * 0.12,
        delaySeconds: 0.12 + clamp01(params.matrix.trailStrength / 100) * 0.5,
        echoGain: 0.15 + clamp01(params.matrix.trailStrength / 100) * 0.4,
      }
    : null

  return { steps, drone, noise, pulses }
}
