/**
 * Pond configuration (debug-only "Private Pond" experiment): a single
 * swimming body that carries any glyph source around the canvas — drift and
 * impact-driven spin for all, creatures holding a fixed upright orientation
 * (engine/pondBody.ts does the steering physics, engine/pondTransform.ts the
 * target transform) — plus hard viewport boundaries for the visible main
 * glyph particles (engine/pondBoundaries.ts) and the aggregate formation
 * bounce and torque (engine/pondFormation.ts).
 *
 * Session-only by design: the config never enters PlaygroundConfig, presets,
 * unified history, URL sharing, analytics, or uploaded-source state. The
 * body count is fixed at one — no boids, schooling, or collisions.
 *
 * Pure functions only — verified by scripts/verify-pond.js.
 */

/**
 * What the pond body carries (SceneCanvas render routing): 'source' keeps the
 * current source field; a creature character is a temporary render override —
 * the field targets compute from CREATURE_DEFINITIONS[character] at the hidden
 * MOTION_DEFAULTS while the pond transform applies exactly as with a source.
 */
export type PondCharacter = 'source' | 'original' | 'jelly' | 'ray'

export type PondConfig = {
  /** Master switch; when false the scene behaves exactly as without pond. */
  enabled: boolean
  /** Target cruising speed in px/s; also the base of the hard speed clamp. */
  cruiseSpeed: number
  /** Wander steering strength, 0–1 (0 = straight cruising). */
  wanderStrength: number
  /** Pointer-current coupling, 0–2 (how strongly pointer motion drags the body). */
  pointerCurrentStrength: number
  /** Click/tap ripple strength, 0–2 (outward body impulse). */
  rippleStrength: number
  /** Glyph boundary rebound floor (px/frame): the rebound at zero impact. */
  boundaryMinBounceSpeed: number
  /** Glyph boundary rebound ceiling (px/frame) at/above the full-bounce
   *  impact speed. Invariant: never below boundaryMinBounceSpeed. */
  boundaryMaxBounceSpeed: number
  /** Wall-normal impact speed (px/frame) that maps to the max rebound. */
  boundaryFullBounceImpactSpeed: number
  /** Formation bounce trigger: unique wall contacts within the window as a
   *  percentage of the visible glyph count (threshold = max(1, ceil)). */
  formationContactThresholdPercent: number
  /** Formation bounce: wall contact window length in ms. */
  formationImpactWindowMs: number
  /** Formation bounce: fraction of the incoming wall-normal speed kept. */
  formationBounceRestitution: number
  /** Formation bounce: minimum inward speed as a multiple of cruiseSpeed. */
  formationMinInwardSpeedRatio: number
  /** Formation bounce: global cooldown in ms after a trigger (no accumulation). */
  formationBounceCooldownMs: number
  /** Angular impulse per unit of normalized impact torque (rad/s). 0
   *  disables new rotational impulses. */
  formationAngularImpulseStrength: number
  /** Spin drag half-life in ms (angular velocity halves per interval). */
  formationSpinHalfLifeMs: number
  /** Angular velocity cap in rad/s; 0 disables new rotational impulses. */
  formationMaxAngularSpeed: number
}

export const POND_CRUISE_SPEED_MIN = 0
export const POND_CRUISE_SPEED_MAX = 300
export const POND_WANDER_MIN = 0
export const POND_WANDER_MAX = 1
export const POND_POINTER_CURRENT_MIN = 0
export const POND_POINTER_CURRENT_MAX = 2
export const POND_RIPPLE_MIN = 0
export const POND_RIPPLE_MAX = 2
export const POND_MIN_BOUNCE_MIN = 0
export const POND_MIN_BOUNCE_MAX = 10
export const POND_MAX_BOUNCE_MIN = 0
export const POND_MAX_BOUNCE_MAX = 30
export const POND_FULL_BOUNCE_IMPACT_MIN = 0.5
export const POND_FULL_BOUNCE_IMPACT_MAX = 30
export const POND_FORMATION_CONTACT_THRESHOLD_MIN = 1
export const POND_FORMATION_CONTACT_THRESHOLD_MAX = 50
export const POND_FORMATION_WINDOW_MIN = 100
export const POND_FORMATION_WINDOW_MAX = 1500
export const POND_FORMATION_RESTITUTION_MIN = 0
export const POND_FORMATION_RESTITUTION_MAX = 2
export const POND_FORMATION_MIN_INWARD_MIN = 0
export const POND_FORMATION_MIN_INWARD_MAX = 2
export const POND_FORMATION_COOLDOWN_MIN = 0
export const POND_FORMATION_COOLDOWN_MAX = 2000
export const POND_FORMATION_ANGULAR_IMPULSE_MIN = 0
export const POND_FORMATION_ANGULAR_IMPULSE_MAX = 8
export const POND_FORMATION_SPIN_HALF_LIFE_MIN = 100
export const POND_FORMATION_SPIN_HALF_LIFE_MAX = 5000
export const POND_FORMATION_MAX_SPIN_MIN = 0
export const POND_FORMATION_MAX_SPIN_MAX = 10

/** Inert defaults: disabled, gentle cruise. */
export const POND_DEFAULTS: PondConfig = {
  enabled: false,
  cruiseSpeed: 60,
  wanderStrength: 0.5,
  pointerCurrentStrength: 1,
  rippleStrength: 1,
  boundaryMinBounceSpeed: 0.5,
  boundaryMaxBounceSpeed: 8,
  boundaryFullBounceImpactSpeed: 8,
  formationContactThresholdPercent: 5,
  formationImpactWindowMs: 350,
  formationBounceRestitution: 1,
  formationMinInwardSpeedRatio: 0.5,
  formationBounceCooldownMs: 600,
  formationAngularImpulseStrength: 3.5,
  formationSpinHalfLifeMs: 1800,
  formationMaxAngularSpeed: 5,
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Clamp every requested field into its documented UI range. */
export function clampPondConfig(config: PondConfig): PondConfig {
  const minBounce = clampNumber(
    config.boundaryMinBounceSpeed,
    POND_MIN_BOUNCE_MIN,
    POND_MIN_BOUNCE_MAX,
  )
  return {
    enabled: config.enabled === true,
    cruiseSpeed: clampNumber(config.cruiseSpeed, POND_CRUISE_SPEED_MIN, POND_CRUISE_SPEED_MAX),
    wanderStrength: clampNumber(config.wanderStrength, POND_WANDER_MIN, POND_WANDER_MAX),
    pointerCurrentStrength: clampNumber(
      config.pointerCurrentStrength,
      POND_POINTER_CURRENT_MIN,
      POND_POINTER_CURRENT_MAX,
    ),
    rippleStrength: clampNumber(config.rippleStrength, POND_RIPPLE_MIN, POND_RIPPLE_MAX),
    boundaryMinBounceSpeed: minBounce,
    // Invariant: max ≥ min — clamp the max upward when necessary.
    boundaryMaxBounceSpeed: Math.max(
      minBounce,
      clampNumber(config.boundaryMaxBounceSpeed, POND_MAX_BOUNCE_MIN, POND_MAX_BOUNCE_MAX),
    ),
    boundaryFullBounceImpactSpeed: clampNumber(
      config.boundaryFullBounceImpactSpeed,
      POND_FULL_BOUNCE_IMPACT_MIN,
      POND_FULL_BOUNCE_IMPACT_MAX,
    ),
    formationContactThresholdPercent: clampNumber(
      config.formationContactThresholdPercent,
      POND_FORMATION_CONTACT_THRESHOLD_MIN,
      POND_FORMATION_CONTACT_THRESHOLD_MAX,
    ),
    formationImpactWindowMs: clampNumber(
      config.formationImpactWindowMs,
      POND_FORMATION_WINDOW_MIN,
      POND_FORMATION_WINDOW_MAX,
    ),
    formationBounceRestitution: clampNumber(
      config.formationBounceRestitution,
      POND_FORMATION_RESTITUTION_MIN,
      POND_FORMATION_RESTITUTION_MAX,
    ),
    formationMinInwardSpeedRatio: clampNumber(
      config.formationMinInwardSpeedRatio,
      POND_FORMATION_MIN_INWARD_MIN,
      POND_FORMATION_MIN_INWARD_MAX,
    ),
    formationBounceCooldownMs: clampNumber(
      config.formationBounceCooldownMs,
      POND_FORMATION_COOLDOWN_MIN,
      POND_FORMATION_COOLDOWN_MAX,
    ),
    formationAngularImpulseStrength: clampNumber(
      config.formationAngularImpulseStrength,
      POND_FORMATION_ANGULAR_IMPULSE_MIN,
      POND_FORMATION_ANGULAR_IMPULSE_MAX,
    ),
    formationSpinHalfLifeMs: clampNumber(
      config.formationSpinHalfLifeMs,
      POND_FORMATION_SPIN_HALF_LIFE_MIN,
      POND_FORMATION_SPIN_HALF_LIFE_MAX,
    ),
    formationMaxAngularSpeed: clampNumber(
      config.formationMaxAngularSpeed,
      POND_FORMATION_MAX_SPIN_MIN,
      POND_FORMATION_MAX_SPIN_MAX,
    ),
  }
}
