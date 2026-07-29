/**
 * Motion configuration for the glyph field (Vibe playground).
 *
 * Two motion systems share one nested config: `organic-flow`, which coherently
 * displaces the source's immutable base targets, and `parametric-creature`,
 * which replaces target positions with a generated creature while retaining
 * the glyph population. `off` adds no per-frame procedural work.
 *
 * Pure functions only — verified by scripts/verify-motion-config.js.
 */

import { isMobileViewport, MOBILE_GLYPH_CAP } from './displayBudget'

export type GlyphMotionMode = 'off' | 'organic-flow' | 'parametric-creature'

export type ParametricVariant = 'original' | 'jelly' | 'ray' | 'custom'

/** Base forms the visitor-facing custom lab can assemble (engine/motion.ts). */
export type CustomCreatureForm = 'school' | 'grid' | 'bell' | 'wing'

/**
 * Safe, bounded knobs for the visitor custom-creature lab. All numeric and
 * clamped — no code eval, fully deterministic.
 */
export type CustomCreatureParams = {
  form: CustomCreatureForm
  /** Mirrored/stacked repetitions of the base form, 1–8. */
  symmetry: number
  /** Layered wave terms in the form's motion, 1–6. */
  waves: number
  /** Wave travel speed multiplier, 0–2. */
  travel: number
  /** Scale-breathing amplitude multiplier, 0–2. */
  pulse: number
}

export const CUSTOM_FORM_OPTIONS: { value: CustomCreatureForm; label: string }[] = [
  { value: 'school', label: 'School' },
  { value: 'grid', label: 'Grid' },
  { value: 'bell', label: 'Bell' },
  { value: 'wing', label: 'Wing' },
]

export const CUSTOM_SYMMETRY_MIN = 1
export const CUSTOM_SYMMETRY_MAX = 8
export const CUSTOM_WAVES_MIN = 1
export const CUSTOM_WAVES_MAX = 6
export const CUSTOM_TRAVEL_MIN = 0
export const CUSTOM_TRAVEL_MAX = 2
export const CUSTOM_PULSE_MIN = 0
export const CUSTOM_PULSE_MAX = 2

export const CUSTOM_CREATURE_DEFAULTS: CustomCreatureParams = {
  form: 'school',
  symmetry: 2,
  waves: 3,
  travel: 1,
  pulse: 1,
}

export function clampCustomCreatureParams(
  params: CustomCreatureParams,
): CustomCreatureParams {
  return {
    form: params.form,
    symmetry: Math.round(
      clampNumber(params.symmetry, CUSTOM_SYMMETRY_MIN, CUSTOM_SYMMETRY_MAX),
    ),
    waves: Math.round(clampNumber(params.waves, CUSTOM_WAVES_MIN, CUSTOM_WAVES_MAX)),
    travel: clampNumber(params.travel, CUSTOM_TRAVEL_MIN, CUSTOM_TRAVEL_MAX),
    pulse: clampNumber(params.pulse, CUSTOM_PULSE_MIN, CUSTOM_PULSE_MAX),
  }
}

export type MotionConfig = {
  mode: GlyphMotionMode
  variant: ParametricVariant
  /** Displacement intensity, 0–100. */
  amount: number
  /** Procedural time multiplier, 0.1–2.0. */
  speed: number
  /** Spatial frequency multiplier for the wave fields, 0.5–2.5. */
  waveScale: number
  /** Number of layered wave terms, 1–4. */
  complexity: number
  /** Requested creature target count, 400–4000. */
  density: number
  /** Requested target-math update rate in Hz, 15–60. */
  updateRate: number
  /** Bounded knobs for the custom variant; inert for the other variants. */
  custom: CustomCreatureParams
}

export const MOTION_AMOUNT_MIN = 0
export const MOTION_AMOUNT_MAX = 100
export const MOTION_SPEED_MIN = 0.1
export const MOTION_SPEED_MAX = 2
export const MOTION_WAVE_SCALE_MIN = 0.5
export const MOTION_WAVE_SCALE_MAX = 2.5
export const MOTION_COMPLEXITY_MIN = 1
export const MOTION_COMPLEXITY_MAX = 4
export const MOTION_DENSITY_MIN = 400
export const MOTION_DENSITY_MAX = 4000
export const MOTION_UPDATE_RATE_MIN = 15
export const MOTION_UPDATE_RATE_MAX = 60

/** Vibe defaults to motion Off; every complete PlaygroundConfig carries this. */
export const MOTION_DEFAULTS: MotionConfig = {
  mode: 'off',
  variant: 'original',
  amount: 35,
  speed: 1,
  waveScale: 1,
  complexity: 2,
  density: 1600,
  updateRate: 30,
  custom: { ...CUSTOM_CREATURE_DEFAULTS },
}

export const GLYPH_MOTION_MODE_OPTIONS: { value: GlyphMotionMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'organic-flow', label: 'Organic flow' },
  { value: 'parametric-creature', label: 'Parametric creature' },
]

// Labels mirror the creature registry in engine/motion.ts;
// scripts/verify-motion.js asserts the two never drift apart.
export const PARAMETRIC_VARIANT_OPTIONS: { value: ParametricVariant; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'jelly', label: 'Jelly' },
  { value: 'ray', label: 'Ray' },
  { value: 'custom', label: 'Custom' },
]

/** Desktop ceiling for the creature target population. */
export const DESKTOP_CREATURE_DENSITY_CAP = 2400
/** Mobile ceiling matches the existing glyph budget (engine/displayBudget). */
export const MOBILE_CREATURE_DENSITY_CAP = MOBILE_GLYPH_CAP

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Clamp every requested field into its documented UI range. */
export function clampMotionConfig(config: MotionConfig): MotionConfig {
  return {
    mode: config.mode,
    variant: config.variant,
    amount: clampNumber(config.amount, MOTION_AMOUNT_MIN, MOTION_AMOUNT_MAX),
    speed: clampNumber(config.speed, MOTION_SPEED_MIN, MOTION_SPEED_MAX),
    waveScale: clampNumber(config.waveScale, MOTION_WAVE_SCALE_MIN, MOTION_WAVE_SCALE_MAX),
    complexity: Math.round(
      clampNumber(config.complexity, MOTION_COMPLEXITY_MIN, MOTION_COMPLEXITY_MAX),
    ),
    density: Math.round(clampNumber(config.density, MOTION_DENSITY_MIN, MOTION_DENSITY_MAX)),
    updateRate: Math.round(
      clampNumber(config.updateRate, MOTION_UPDATE_RATE_MIN, MOTION_UPDATE_RATE_MAX),
    ),
    custom: clampCustomCreatureParams(config.custom ?? CUSTOM_CREATURE_DEFAULTS),
  }
}

export type MotionQuality = {
  /** Creature target count after the device cap (requested value is kept in UI). */
  effectiveDensity: number
  /** Target-math update rate after the device/complexity ceilings, in Hz. */
  effectiveUpdateRate: number
}

/**
 * Device-aware quality ceilings. The requested values stay visible in the UI;
 * these are the values the engine actually runs at.
 *
 * Density: 2400 on desktop, the existing 1200 glyph cap on mobile.
 * Desktop update rate: 60 Hz for ≤1600 targets at complexity ≤2, 30 Hz up to
 * 3000 targets, otherwise 15 Hz. Mobile: 30 Hz for ≤900 targets at
 * complexity ≤2, otherwise 15 Hz.
 */
export function resolveMotionQuality(
  config: MotionConfig,
  viewportWidth: number,
): MotionQuality {
  const clamped = clampMotionConfig(config)
  const mobile = isMobileViewport(viewportWidth)

  const densityCap = mobile ? MOBILE_CREATURE_DENSITY_CAP : DESKTOP_CREATURE_DENSITY_CAP
  const effectiveDensity = Math.min(clamped.density, densityCap)

  let rateCap: number
  if (mobile) {
    rateCap =
      effectiveDensity <= 900 && clamped.complexity <= 2
        ? 30
        : MOTION_UPDATE_RATE_MIN
  } else if (effectiveDensity <= 1600 && clamped.complexity <= 2) {
    rateCap = 60
  } else if (effectiveDensity <= 3000) {
    rateCap = 30
  } else {
    rateCap = MOTION_UPDATE_RATE_MIN
  }

  return {
    effectiveDensity,
    effectiveUpdateRate: Math.min(clamped.updateRate, rateCap),
  }
}
