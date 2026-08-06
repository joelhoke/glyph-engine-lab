/**
 * Visual Sonification experiment (debug-only): session configuration for the
 * scanner that reads the live canvas and turns it into a tonal score.
 *
 * Session-only by design: this config must NEVER enter PlaygroundConfig,
 * presets, unified history, URL sharing, analytics, or uploaded-source state.
 * Playback state (idle/playing/paused/error) is deliberately separate — it
 * lives next to the config in the shell, not inside it.
 *
 * Pure functions only — verified by scripts/verify-sonification.js.
 */

export type SonificationDirection =
  | 'left-to-right'
  | 'right-to-left'
  | 'top-to-bottom'
  | 'bottom-to-top'

export type SonificationConfig = {
  /** Sweep axis and direction of the visible scan line (and the phrase). */
  direction: SonificationDirection
  /** Seconds per full 24-step sweep, 4–20. */
  sweepDuration: number
  /** Master volume, 0–100. */
  volume: number
}

/** Logical analysis grid: constant across quality tiers (the raster
 *  resolution adapts, the musical structure never does). */
export const SONIFICATION_STEPS = 24
export const SONIFICATION_BANDS = 12
/** Maximum active pitch bands a single step may voice. */
export const SONIFICATION_MAX_NOTES_PER_STEP = 3
/** Hard oscillator-voice ceiling (drone + note pool) for the audio engine. */
export const SONIFICATION_MAX_VOICES = 8

export const SONIFICATION_SWEEP_DURATION_MIN = 4
export const SONIFICATION_SWEEP_DURATION_MAX = 20
export const SONIFICATION_SWEEP_DURATION_DEFAULT = 8

export const SONIFICATION_VOLUME_MIN = 0
export const SONIFICATION_VOLUME_MAX = 100
export const SONIFICATION_VOLUME_DEFAULT = 35

export const SONIFICATION_DEFAULTS: SonificationConfig = {
  direction: 'left-to-right',
  sweepDuration: SONIFICATION_SWEEP_DURATION_DEFAULT,
  volume: SONIFICATION_VOLUME_DEFAULT,
}

export const SONIFICATION_DIRECTION_OPTIONS: { value: SonificationDirection; label: string }[] = [
  { value: 'left-to-right', label: 'Left to right' },
  { value: 'right-to-left', label: 'Right to left' },
  { value: 'top-to-bottom', label: 'Top to bottom' },
  { value: 'bottom-to-top', label: 'Bottom to top' },
]

/** Horizontal sweeps scan columns, vertical sweeps scan rows. */
export function isHorizontalSonificationDirection(direction: SonificationDirection): boolean {
  return direction === 'left-to-right' || direction === 'right-to-left'
}

/** Reverse directions play the canonical phrase backwards. */
export function isReversedSonificationDirection(direction: SonificationDirection): boolean {
  return direction === 'right-to-left' || direction === 'bottom-to-top'
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

const DIRECTIONS: readonly SonificationDirection[] = [
  'left-to-right',
  'right-to-left',
  'top-to-bottom',
  'bottom-to-top',
]

/** Clamp every field into its documented range; unknown directions and
 *  missing fields fall back to the defaults. */
export function clampSonificationConfig(config: SonificationConfig): SonificationConfig {
  return {
    direction: DIRECTIONS.includes(config.direction) ? config.direction : SONIFICATION_DEFAULTS.direction,
    sweepDuration: clampNumber(
      config.sweepDuration ?? SONIFICATION_SWEEP_DURATION_DEFAULT,
      SONIFICATION_SWEEP_DURATION_MIN,
      SONIFICATION_SWEEP_DURATION_MAX,
    ),
    volume: clampNumber(
      config.volume ?? SONIFICATION_VOLUME_DEFAULT,
      SONIFICATION_VOLUME_MIN,
      SONIFICATION_VOLUME_MAX,
    ),
  }
}
