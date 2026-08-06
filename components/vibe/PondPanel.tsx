'use client'

import { useId } from 'react'
import {
  POND_CRUISE_SPEED_MAX,
  POND_CRUISE_SPEED_MIN,
  POND_FORMATION_ANGULAR_IMPULSE_MAX,
  POND_FORMATION_ANGULAR_IMPULSE_MIN,
  POND_FORMATION_CONTACT_THRESHOLD_MAX,
  POND_FORMATION_CONTACT_THRESHOLD_MIN,
  POND_FORMATION_COOLDOWN_MAX,
  POND_FORMATION_COOLDOWN_MIN,
  POND_FORMATION_MAX_SPIN_MAX,
  POND_FORMATION_MAX_SPIN_MIN,
  POND_FORMATION_MIN_INWARD_MAX,
  POND_FORMATION_MIN_INWARD_MIN,
  POND_FORMATION_RESTITUTION_MAX,
  POND_FORMATION_RESTITUTION_MIN,
  POND_FORMATION_SPIN_HALF_LIFE_MAX,
  POND_FORMATION_SPIN_HALF_LIFE_MIN,
  POND_FORMATION_WINDOW_MAX,
  POND_FORMATION_WINDOW_MIN,
  POND_FULL_BOUNCE_IMPACT_MAX,
  POND_FULL_BOUNCE_IMPACT_MIN,
  POND_MAX_BOUNCE_MAX,
  POND_MAX_BOUNCE_MIN,
  POND_MIN_BOUNCE_MAX,
  POND_MIN_BOUNCE_MIN,
  POND_POINTER_CURRENT_MAX,
  POND_POINTER_CURRENT_MIN,
  POND_RIPPLE_MAX,
  POND_RIPPLE_MIN,
  POND_WANDER_MAX,
  POND_WANDER_MIN,
  PondConfig,
} from '../../engine/pondConfig'
import NumericControl from '../tuning/NumericControl'

export type PondPanelProps = {
  pond: PondConfig
  /** Session-only pond config; never enters history/presets/sharing. */
  onPondChange: (next: PondConfig) => void
}

export default function PondPanel({ pond, onPondChange }: PondPanelProps) {
  const stableId = useId().replace(/:/g, '-')
  const enableId = `pond-enable-${stableId}`

  const updatePond = (patch: Partial<PondConfig>) => {
    onPondChange({ ...pond, ...patch })
  }

  return (
    <div className="vibe-pond-panel">
      <div className="vibe-paint-enable-row">
        <input
          id={enableId}
          type="checkbox"
          checked={pond.enabled}
          onChange={(e) => updatePond({ enabled: e.target.checked })}
        />
        <label htmlFor={enableId}>Enable pond</label>
      </div>

      {pond.enabled && (
        <>
          <p className="vibe-pond-hint">
            Every source swims: the field drifts with the body, wall impacts
            can spin it, and creatures with a known facing (Original, Jelly,
            Ray) also follow the swimmer's heading.
          </p>
          <NumericControl
            id={`pond-cruise-speed-${stableId}`}
            label="Cruise speed"
            value={pond.cruiseSpeed}
            min={POND_CRUISE_SPEED_MIN}
            max={POND_CRUISE_SPEED_MAX}
            step={5}
            unit="px/s"
            showSlider
            onChange={(value) => updatePond({ cruiseSpeed: value })}
          />
          <NumericControl
            id={`pond-wander-${stableId}`}
            label="Wander"
            value={pond.wanderStrength}
            min={POND_WANDER_MIN}
            max={POND_WANDER_MAX}
            step={0.05}
            showSlider
            onChange={(value) => updatePond({ wanderStrength: value })}
          />
          <NumericControl
            id={`pond-pointer-current-${stableId}`}
            label="Pointer current"
            value={pond.pointerCurrentStrength}
            min={POND_POINTER_CURRENT_MIN}
            max={POND_POINTER_CURRENT_MAX}
            step={0.05}
            showSlider
            onChange={(value) => updatePond({ pointerCurrentStrength: value })}
          />
          <NumericControl
            id={`pond-ripple-${stableId}`}
            label="Ripple"
            value={pond.rippleStrength}
            min={POND_RIPPLE_MIN}
            max={POND_RIPPLE_MAX}
            step={0.05}
            showSlider
            onChange={(value) => updatePond({ rippleStrength: value })}
          />
          <NumericControl
            id={`pond-min-bounce-${stableId}`}
            label="Min bounce"
            value={pond.boundaryMinBounceSpeed}
            min={POND_MIN_BOUNCE_MIN}
            max={POND_MIN_BOUNCE_MAX}
            step={0.25}
            unit="px/frame"
            showSlider
            onChange={(value) => updatePond({ boundaryMinBounceSpeed: value })}
          />
          <NumericControl
            id={`pond-max-bounce-${stableId}`}
            label="Max bounce"
            value={pond.boundaryMaxBounceSpeed}
            min={POND_MAX_BOUNCE_MIN}
            max={POND_MAX_BOUNCE_MAX}
            step={0.25}
            unit="px/frame"
            showSlider
            onChange={(value) => updatePond({ boundaryMaxBounceSpeed: value })}
          />
          <NumericControl
            id={`pond-full-bounce-impact-${stableId}`}
            label="Full-bounce impact"
            value={pond.boundaryFullBounceImpactSpeed}
            min={POND_FULL_BOUNCE_IMPACT_MIN}
            max={POND_FULL_BOUNCE_IMPACT_MAX}
            step={0.5}
            unit="px/frame"
            showSlider
            onChange={(value) => updatePond({ boundaryFullBounceImpactSpeed: value })}
          />
          <NumericControl
            id={`pond-formation-contact-threshold-${stableId}`}
            label="Object contact threshold"
            value={pond.formationContactThresholdPercent}
            min={POND_FORMATION_CONTACT_THRESHOLD_MIN}
            max={POND_FORMATION_CONTACT_THRESHOLD_MAX}
            step={1}
            unit="%"
            showSlider
            onChange={(value) => updatePond({ formationContactThresholdPercent: value })}
          />
          <NumericControl
            id={`pond-formation-impact-window-${stableId}`}
            label="Object impact window"
            value={pond.formationImpactWindowMs}
            min={POND_FORMATION_WINDOW_MIN}
            max={POND_FORMATION_WINDOW_MAX}
            step={50}
            unit="ms"
            showSlider
            onChange={(value) => updatePond({ formationImpactWindowMs: value })}
          />
          <NumericControl
            id={`pond-formation-restitution-${stableId}`}
            label="Object restitution"
            value={pond.formationBounceRestitution}
            min={POND_FORMATION_RESTITUTION_MIN}
            max={POND_FORMATION_RESTITUTION_MAX}
            step={0.05}
            showSlider
            onChange={(value) => updatePond({ formationBounceRestitution: value })}
          />
          <NumericControl
            id={`pond-formation-min-inward-${stableId}`}
            label="Object inward kick"
            value={pond.formationMinInwardSpeedRatio}
            min={POND_FORMATION_MIN_INWARD_MIN}
            max={POND_FORMATION_MIN_INWARD_MAX}
            step={0.05}
            unit="× cruise"
            showSlider
            onChange={(value) => updatePond({ formationMinInwardSpeedRatio: value })}
          />
          <NumericControl
            id={`pond-formation-cooldown-${stableId}`}
            label="Object bounce cooldown"
            value={pond.formationBounceCooldownMs}
            min={POND_FORMATION_COOLDOWN_MIN}
            max={POND_FORMATION_COOLDOWN_MAX}
            step={50}
            unit="ms"
            showSlider
            onChange={(value) => updatePond({ formationBounceCooldownMs: value })}
          />
          <NumericControl
            id={`pond-formation-angular-impulse-${stableId}`}
            label="Impact torque"
            value={pond.formationAngularImpulseStrength}
            min={POND_FORMATION_ANGULAR_IMPULSE_MIN}
            max={POND_FORMATION_ANGULAR_IMPULSE_MAX}
            step={0.1}
            unit="rad/s"
            showSlider
            onChange={(value) => updatePond({ formationAngularImpulseStrength: value })}
          />
          <NumericControl
            id={`pond-formation-spin-half-life-${stableId}`}
            label="Spin half-life"
            value={pond.formationSpinHalfLifeMs}
            min={POND_FORMATION_SPIN_HALF_LIFE_MIN}
            max={POND_FORMATION_SPIN_HALF_LIFE_MAX}
            step={100}
            unit="ms"
            showSlider
            onChange={(value) => updatePond({ formationSpinHalfLifeMs: value })}
          />
          <NumericControl
            id={`pond-formation-max-spin-${stableId}`}
            label="Max spin speed"
            value={pond.formationMaxAngularSpeed}
            min={POND_FORMATION_MAX_SPIN_MIN}
            max={POND_FORMATION_MAX_SPIN_MAX}
            step={0.1}
            unit="rad/s"
            showSlider
            onChange={(value) => updatePond({ formationMaxAngularSpeed: value })}
          />
        </>
      )}
    </div>
  )
}
