'use client'

import { useId } from 'react'
import {
  AMBIENT_INTERACTION_MAX,
  AMBIENT_INTERACTION_MIN,
  AMBIENT_MODE_OPTIONS,
  AmbientConfig,
  MATRIX_SPREAD_MAX,
  MATRIX_SPREAD_MIN,
  MATRIX_SPEED_MAX,
  MATRIX_SPEED_MIN,
  MATRIX_TRAIL_MAX,
  MATRIX_TRAIL_MIN,
  MATRIX_VOLUME_MAX,
  MATRIX_VOLUME_MIN,
  WEATHER_BLUR_MAX,
  WEATHER_BLUR_MIN,
  WEATHER_INTENSITY_MAX,
  WEATHER_INTENSITY_MIN,
  WEATHER_PRESET_OPTIONS,
  WEATHER_TURBULENCE_MAX,
  WEATHER_TURBULENCE_MIN,
  WEATHER_WIND_MAX,
  WEATHER_WIND_MIN,
} from '../../engine/ambientConfig'
import NumericControl from '../tuning/NumericControl'

export type AmbientPanelProps = {
  config: AmbientConfig
  onChange: (patch: Partial<{ ambient: AmbientConfig }>, historyKey?: string) => void
}

export default function AmbientPanel({ config, onChange }: AmbientPanelProps) {
  const stableId = useId().replace(/:/g, '-')
  const modeId = `ambient-mode-${stableId}`
  const presetId = `ambient-weather-preset-${stableId}`

  return (
    <div className="vibe-ambient-panel">
      <div className="vibe-select-control">
        <label htmlFor={modeId} className="vibe-panel-section-label">
          Ambient mode
        </label>
        <select
          id={modeId}
          value={config.mode}
          onChange={(e) =>
            onChange(
              { ambient: { ...config, mode: e.target.value as AmbientConfig['mode'] } },
              'ambient.mode',
            )
          }
          className="vibe-select"
        >
          {AMBIENT_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {config.mode !== 'off' && (
        <NumericControl
          id={`ambient-interaction-${stableId}`}
          label="Interaction"
          value={config.interactionStrength}
          min={AMBIENT_INTERACTION_MIN}
          max={AMBIENT_INTERACTION_MAX}
          step={0.05}
          showSlider
          onChange={(value) =>
            onChange({ ambient: { ...config, interactionStrength: value } }, 'ambient.interactionStrength')
          }
        />
      )}

      {config.mode === 'weather' && (
        <div className="vibe-ambient-weather">
          <div className="vibe-select-control">
            <label htmlFor={presetId} className="vibe-panel-section-label">
              Preset
            </label>
            <select
              id={presetId}
              value={config.weather.preset}
              onChange={(e) =>
                onChange(
                {
                  ambient: {
                    ...config,
                    weather: { ...config.weather, preset: e.target.value as typeof config.weather.preset },
                  },
                },
                'ambient.weather.preset',
              )
              }
              className="vibe-select"
            >
              {WEATHER_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <NumericControl
            id={`weather-intensity-${stableId}`}
            label="Intensity"
            value={config.weather.intensity}
            min={WEATHER_INTENSITY_MIN}
            max={WEATHER_INTENSITY_MAX}
            step={1}
            showSlider
            onChange={(value) =>
              onChange(
                { ambient: { ...config, weather: { ...config.weather, intensity: value } } },
                'ambient.weather.intensity',
              )
            }
          />
          <NumericControl
            id={`weather-wind-${stableId}`}
            label="Wind"
            value={config.weather.wind}
            min={WEATHER_WIND_MIN}
            max={WEATHER_WIND_MAX}
            step={1}
            showSlider
            onChange={(value) =>
              onChange(
                { ambient: { ...config, weather: { ...config.weather, wind: value } } },
                'ambient.weather.wind',
              )
            }
          />
          <NumericControl
            id={`weather-turbulence-${stableId}`}
            label="Turbulence"
            value={config.weather.turbulence}
            min={WEATHER_TURBULENCE_MIN}
            max={WEATHER_TURBULENCE_MAX}
            step={1}
            showSlider
            onChange={(value) =>
              onChange(
                { ambient: { ...config, weather: { ...config.weather, turbulence: value } } },
                'ambient.weather.turbulence',
              )
            }
          />
          <NumericControl
            id={`weather-blur-${stableId}`}
            label="Blur"
            value={config.weather.blur}
            min={WEATHER_BLUR_MIN}
            max={WEATHER_BLUR_MAX}
            step={1}
            showSlider
            onChange={(value) =>
              onChange(
                { ambient: { ...config, weather: { ...config.weather, blur: value } } },
                'ambient.weather.blur',
              )
            }
          />
        </div>
      )}

      {config.mode === 'matrix' && (
        <div className="vibe-ambient-matrix">
          <NumericControl
            id={`matrix-spread-${stableId}`}
            label="Spread"
            value={config.matrix.spread}
            min={MATRIX_SPREAD_MIN}
            max={MATRIX_SPREAD_MAX}
            step={1}
            showSlider
            onChange={(value) =>
              onChange(
                { ambient: { ...config, matrix: { ...config.matrix, spread: value } } },
                'ambient.matrix.spread',
              )
            }
          />
          <NumericControl
            id={`matrix-speed-${stableId}`}
            label="Speed"
            value={config.matrix.speed}
            min={MATRIX_SPEED_MIN}
            max={MATRIX_SPEED_MAX}
            step={1}
            showSlider
            onChange={(value) =>
              onChange(
                { ambient: { ...config, matrix: { ...config.matrix, speed: value } } },
                'ambient.matrix.speed',
              )
            }
          />
          <NumericControl
            id={`matrix-volume-${stableId}`}
            label="Volume"
            value={config.matrix.volume}
            min={MATRIX_VOLUME_MIN}
            max={MATRIX_VOLUME_MAX}
            step={1}
            showSlider
            onChange={(value) =>
              onChange(
                { ambient: { ...config, matrix: { ...config.matrix, volume: value } } },
                'ambient.matrix.volume',
              )
            }
          />
          <NumericControl
            id={`matrix-trail-${stableId}`}
            label="Trail"
            value={config.matrix.trailStrength}
            min={MATRIX_TRAIL_MIN}
            max={MATRIX_TRAIL_MAX}
            step={1}
            showSlider
            onChange={(value) =>
              onChange(
                { ambient: { ...config, matrix: { ...config.matrix, trailStrength: value } } },
                'ambient.matrix.trailStrength',
              )
            }
          />
        </div>
      )}
    </div>
  )
}
