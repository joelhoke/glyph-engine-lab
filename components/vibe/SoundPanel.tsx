'use client'

import { useId } from 'react'
import {
  clampSonificationConfig,
  SonificationConfig,
  SonificationDirection,
  SONIFICATION_DIRECTION_OPTIONS,
  SONIFICATION_SWEEP_DURATION_MAX,
  SONIFICATION_SWEEP_DURATION_MIN,
  SONIFICATION_VOLUME_MAX,
  SONIFICATION_VOLUME_MIN,
} from '../../engine/sonificationConfig'
import type { SonificationPlaybackState } from '../../engine/sonificationEngine'
import NumericControl from '../tuning/NumericControl'

export type SoundPanelProps = {
  config: SonificationConfig
  playback: SonificationPlaybackState
  error: string | null
  onPlay: () => void
  onPause: () => void
  /** Session-only sonification config; never enters history/presets/sharing. */
  onConfigChange: (next: SonificationConfig) => void
  /** Disabled while a clip recording owns the sonification transport. */
  transportDisabled?: boolean
}

const PLAYBACK_LABELS: Record<SonificationPlaybackState, string> = {
  idle: 'Stopped',
  playing: 'Playing',
  paused: 'Paused',
  error: 'Unavailable',
}

export default function SoundPanel({
  config,
  playback,
  error,
  onPlay,
  onPause,
  onConfigChange,
  transportDisabled = false,
}: SoundPanelProps) {
  const stableId = useId().replace(/:/g, '-')
  const directionId = `sound-direction-${stableId}`
  const playing = playback === 'playing'

  const update = (patch: Partial<SonificationConfig>) => {
    onConfigChange(clampSonificationConfig({ ...config, ...patch }))
  }

  return (
    <div className="vibe-sound-panel">
      <div className="vibe-sound-transport">
        <button
          type="button"
          className="vibe-sound-play"
          aria-label={playing ? 'Pause sound' : 'Play sound'}
          aria-pressed={playing}
          disabled={transportDisabled}
          onClick={playing ? onPause : onPlay}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        {/* Static status text only — no aria-live on changing note data. */}
        <span className="vibe-sound-state">{PLAYBACK_LABELS[playback]}</span>
      </div>

      {error && (
        <p className="vibe-sound-error" role="status">
          {error}
        </p>
      )}

      <div className="vibe-sound-field">
        <label htmlFor={directionId} className="vibe-sound-field-label">
          Direction
        </label>
        <select
          id={directionId}
          className="vibe-sound-select"
          value={config.direction}
          onChange={(event) =>
            update({ direction: event.target.value as SonificationDirection })
          }
        >
          {SONIFICATION_DIRECTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <NumericControl
        id={`sound-sweep-${stableId}`}
        label="Sweep duration"
        value={config.sweepDuration}
        min={SONIFICATION_SWEEP_DURATION_MIN}
        max={SONIFICATION_SWEEP_DURATION_MAX}
        step={0.5}
        unit="s"
        showSlider
        onChange={(value) => update({ sweepDuration: value })}
      />
      <NumericControl
        id={`sound-volume-${stableId}`}
        label="Volume"
        value={config.volume}
        min={SONIFICATION_VOLUME_MIN}
        max={SONIFICATION_VOLUME_MAX}
        step={1}
        unit="%"
        showSlider
        onChange={(value) => update({ volume: value })}
      />
    </div>
  )
}
