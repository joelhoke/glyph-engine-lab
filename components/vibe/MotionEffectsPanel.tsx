'use client'

import { useId } from 'react'
import { PlaygroundConfig } from '../../engine/playgroundConfig'
import {
  CUSTOM_FORM_OPTIONS,
  CUSTOM_PULSE_MAX,
  CUSTOM_PULSE_MIN,
  CUSTOM_SYMMETRY_MAX,
  CUSTOM_SYMMETRY_MIN,
  CUSTOM_TRAVEL_MAX,
  CUSTOM_TRAVEL_MIN,
  CUSTOM_WAVES_MAX,
  CUSTOM_WAVES_MIN,
  GLYPH_MOTION_MODE_OPTIONS,
  MOTION_AMOUNT_MAX,
  MOTION_AMOUNT_MIN,
  MOTION_COMPLEXITY_MAX,
  MOTION_COMPLEXITY_MIN,
  MOTION_DENSITY_MAX,
  MOTION_DENSITY_MIN,
  MOTION_SPEED_MAX,
  MOTION_SPEED_MIN,
  MOTION_UPDATE_RATE_MAX,
  MOTION_UPDATE_RATE_MIN,
  MOTION_WAVE_SCALE_MAX,
  MOTION_WAVE_SCALE_MIN,
  MotionConfig,
  PARAMETRIC_VARIANT_OPTIONS,
} from '../../engine/motionConfig'
import NumericControl from '../tuning/NumericControl'

export type MotionEffectsPanelProps = {
  config: PlaygroundConfig
  onChange: (patch: Partial<PlaygroundConfig>, historyKey?: string) => void
}

export default function MotionEffectsPanel({ config, onChange }: MotionEffectsPanelProps) {
  const stableId = useId().replace(/:/g, '-')
  const modeId = `motion-mode-${stableId}`
  const variantId = `motion-variant-${stableId}`
  const formId = `motion-form-${stableId}`

  const motion = config.motion

  const updateMotion = (patch: Partial<MotionConfig>) => {
    onChange({ motion: { ...motion, ...patch } }, `motion.${Object.keys(patch)[0]}`)
  }

  const showVariant = motion.mode === 'parametric-creature'
  const showCustom = showVariant && motion.variant === 'custom'

  return (
    <div className="vibe-motion-effects-panel">
      <div className="vibe-select-control">
        <label htmlFor={modeId} className="vibe-panel-section-label">
          Motion mode
        </label>
        <select
          id={modeId}
          value={motion.mode}
          onChange={(e) => updateMotion({ mode: e.target.value as MotionConfig['mode'] })}
          className="vibe-select"
        >
          {GLYPH_MOTION_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {motion.mode !== 'off' && (
        <div className="vibe-motion-sliders">
          <NumericControl
            id={`motion-amount-${stableId}`}
            label="Amount"
            value={motion.amount}
            min={MOTION_AMOUNT_MIN}
            max={MOTION_AMOUNT_MAX}
            step={1}
            unit="%"
            showSlider
            onChange={(value) => updateMotion({ amount: value })}
          />
          <NumericControl
            id={`motion-speed-${stableId}`}
            label="Speed"
            value={motion.speed}
            min={MOTION_SPEED_MIN}
            max={MOTION_SPEED_MAX}
            step={0.05}
            showSlider
            onChange={(value) => updateMotion({ speed: value })}
          />
          <NumericControl
            id={`motion-wave-scale-${stableId}`}
            label="Wave scale"
            value={motion.waveScale}
            min={MOTION_WAVE_SCALE_MIN}
            max={MOTION_WAVE_SCALE_MAX}
            step={0.05}
            showSlider
            onChange={(value) => updateMotion({ waveScale: value })}
          />
          <NumericControl
            id={`motion-complexity-${stableId}`}
            label="Complexity"
            value={motion.complexity}
            min={MOTION_COMPLEXITY_MIN}
            max={MOTION_COMPLEXITY_MAX}
            step={1}
            showSlider
            onChange={(value) => updateMotion({ complexity: value })}
          />
        </div>
      )}

      {showVariant && (
        <div className="vibe-motion-variant-section">
          <div className="vibe-select-control">
            <label htmlFor={variantId} className="vibe-panel-section-label">
              Creature variant
            </label>
            <select
              id={variantId}
              value={motion.variant}
              onChange={(e) =>
                updateMotion({ variant: e.target.value as MotionConfig['variant'] })
              }
              className="vibe-select"
            >
              {PARAMETRIC_VARIANT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <NumericControl
            id={`motion-density-${stableId}`}
            label="Density"
            value={motion.density}
            min={MOTION_DENSITY_MIN}
            max={MOTION_DENSITY_MAX}
            step={50}
            showSlider
            onChange={(value) => updateMotion({ density: value })}
          />
          <NumericControl
            id={`motion-rate-${stableId}`}
            label="Update rate"
            value={motion.updateRate}
            min={MOTION_UPDATE_RATE_MIN}
            max={MOTION_UPDATE_RATE_MAX}
            step={1}
            unit="Hz"
            showSlider
            onChange={(value) => updateMotion({ updateRate: value })}
          />
        </div>
      )}

      {showCustom && (
        <div className="vibe-motion-custom">
          <div className="vibe-select-control">
            <label htmlFor={formId} className="vibe-panel-section-label">
              Form
            </label>
            <select
              id={formId}
              value={motion.custom.form}
              onChange={(e) =>
                updateMotion({
                  custom: { ...motion.custom, form: e.target.value as typeof motion.custom.form },
                })
              }
              className="vibe-select"
            >
              {CUSTOM_FORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <NumericControl
            id={`custom-symmetry-${stableId}`}
            label="Symmetry"
            value={motion.custom.symmetry}
            min={CUSTOM_SYMMETRY_MIN}
            max={CUSTOM_SYMMETRY_MAX}
            step={1}
            onChange={(value) =>
              updateMotion({ custom: { ...motion.custom, symmetry: value } })
            }
          />
          <NumericControl
            id={`custom-waves-${stableId}`}
            label="Waves"
            value={motion.custom.waves}
            min={CUSTOM_WAVES_MIN}
            max={CUSTOM_WAVES_MAX}
            step={1}
            onChange={(value) =>
              updateMotion({ custom: { ...motion.custom, waves: value } })
            }
          />
          <NumericControl
            id={`custom-travel-${stableId}`}
            label="Travel"
            value={motion.custom.travel}
            min={CUSTOM_TRAVEL_MIN}
            max={CUSTOM_TRAVEL_MAX}
            step={0.05}
            onChange={(value) =>
              updateMotion({ custom: { ...motion.custom, travel: value } })
            }
          />
          <NumericControl
            id={`custom-pulse-${stableId}`}
            label="Pulse"
            value={motion.custom.pulse}
            min={CUSTOM_PULSE_MIN}
            max={CUSTOM_PULSE_MAX}
            step={0.05}
            onChange={(value) =>
              updateMotion({ custom: { ...motion.custom, pulse: value } })
            }
          />
        </div>
      )}
    </div>
  )
}
