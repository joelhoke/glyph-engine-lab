/**
 * Ambient-effect configuration for the glyph field (Stage 2): a weather or
 * matrix layer that runs alongside the spring-tethered glyph population in a
 * separate agent pool — it never takes the population over like the legacy
 * whole-scene modes did.
 *
 * Weather and Matrix are mutually exclusive by construction: a single `mode`
 * selector decides which effect consumes the ambient budget (`off` consumes
 * none). Vibe defaults to Off; the config is capable of carrying the
 * landing/intro seasonal weather composition, which a later stage wires up.
 *
 * Pure functions only — verified by scripts/verify-ambient-config.js.
 */

export type AmbientMode = 'off' | 'weather' | 'matrix'

export type WeatherPreset =
  | 'clear'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'blizzard'
  | 'fog'
  | 'wind'

export type WeatherAmbientConfig = {
  /** Weather profile driving the agent behavior and background mood. */
  preset: WeatherPreset
  /** Effect strength (agent count and fall speed scale), 0–200. */
  intensity: number
  /** Horizontal drift force, 0–100. */
  wind: number
  /** Per-agent wander amplitude, 0–200. */
  turbulence: number
  /** Soft-focus blur amount applied to the ambient layer, 0–100. */
  blur: number
}

export type MatrixAmbientConfig = {
  /** Column spacing multiplier, 50–200. */
  spread: number
  /** Fall speed multiplier, 25–400. */
  speed: number
  /** Share of the ambient budget the streams occupy, 0–100. */
  volume: number
  /** Trail fade persistence: higher = longer glow trails, 0–100. */
  trailStrength: number
}

export type AmbientConfig = {
  mode: AmbientMode
  /** Pointer influence on ambient agents (repel and drag forces), 0–2. */
  interactionStrength: number
  weather: WeatherAmbientConfig
  matrix: MatrixAmbientConfig
}

export const AMBIENT_INTERACTION_MIN = 0
export const AMBIENT_INTERACTION_MAX = 2

export const WEATHER_INTENSITY_MIN = 0
export const WEATHER_INTENSITY_MAX = 200
export const WEATHER_WIND_MIN = 0
export const WEATHER_WIND_MAX = 100
export const WEATHER_TURBULENCE_MIN = 0
export const WEATHER_TURBULENCE_MAX = 200
export const WEATHER_BLUR_MIN = 0
export const WEATHER_BLUR_MAX = 100

export const MATRIX_SPREAD_MIN = 50
export const MATRIX_SPREAD_MAX = 200
export const MATRIX_SPEED_MIN = 25
export const MATRIX_SPEED_MAX = 400
export const MATRIX_VOLUME_MIN = 0
export const MATRIX_VOLUME_MAX = 100
export const MATRIX_TRAIL_MIN = 0
export const MATRIX_TRAIL_MAX = 100

export const WEATHER_DEFAULTS: WeatherAmbientConfig = {
  preset: 'rain',
  intensity: 100,
  wind: 50,
  turbulence: 100,
  blur: 25,
}

export const MATRIX_DEFAULTS: MatrixAmbientConfig = {
  spread: 100,
  speed: 100,
  volume: 100,
  trailStrength: 60,
}

/** Vibe defaults to ambient Off; every complete PlaygroundConfig carries this. */
export const AMBIENT_DEFAULTS: AmbientConfig = {
  mode: 'off',
  interactionStrength: 1,
  weather: { ...WEATHER_DEFAULTS },
  matrix: { ...MATRIX_DEFAULTS },
}

export const AMBIENT_MODE_OPTIONS: { value: AmbientMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'weather', label: 'Weather' },
  { value: 'matrix', label: 'Matrix' },
]

export const WEATHER_PRESET_OPTIONS: { value: WeatherPreset; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'rain', label: 'Rain' },
  { value: 'storm', label: 'Storm' },
  { value: 'snow', label: 'Snow' },
  { value: 'blizzard', label: 'Blizzard' },
  { value: 'fog', label: 'Fog' },
  { value: 'wind', label: 'Wind' },
]

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Clamp every numeric field of a weather config into its documented range. */
export function clampWeatherAmbientConfig(
  config: WeatherAmbientConfig,
): WeatherAmbientConfig {
  return {
    preset: config.preset,
    intensity: clampNumber(config.intensity, WEATHER_INTENSITY_MIN, WEATHER_INTENSITY_MAX),
    wind: clampNumber(config.wind, WEATHER_WIND_MIN, WEATHER_WIND_MAX),
    turbulence: clampNumber(
      config.turbulence,
      WEATHER_TURBULENCE_MIN,
      WEATHER_TURBULENCE_MAX,
    ),
    blur: clampNumber(config.blur, WEATHER_BLUR_MIN, WEATHER_BLUR_MAX),
  }
}

/** Clamp every numeric field of a matrix config into its documented range. */
export function clampMatrixAmbientConfig(
  config: MatrixAmbientConfig,
): MatrixAmbientConfig {
  return {
    spread: clampNumber(config.spread, MATRIX_SPREAD_MIN, MATRIX_SPREAD_MAX),
    speed: clampNumber(config.speed, MATRIX_SPEED_MIN, MATRIX_SPEED_MAX),
    volume: clampNumber(config.volume, MATRIX_VOLUME_MIN, MATRIX_VOLUME_MAX),
    trailStrength: clampNumber(
      config.trailStrength,
      MATRIX_TRAIL_MIN,
      MATRIX_TRAIL_MAX,
    ),
  }
}

/** Clamp the whole ambient config; missing sub-configs fall back to defaults. */
export function clampAmbientConfig(config: AmbientConfig): AmbientConfig {
  return {
    mode: config.mode,
    interactionStrength: clampNumber(
      config.interactionStrength,
      AMBIENT_INTERACTION_MIN,
      AMBIENT_INTERACTION_MAX,
    ),
    weather: clampWeatherAmbientConfig(config.weather ?? WEATHER_DEFAULTS),
    matrix: clampMatrixAmbientConfig(config.matrix ?? MATRIX_DEFAULTS),
  }
}

/**
 * Mutual exclusivity helper: the single mode selector is the only switch, so
 * the active effect is exactly the selected one — never both, and `off`
 * consumes no ambient budget at all.
 */
export function resolveAmbientMode(config: AmbientConfig): AmbientMode {
  return config.mode === 'weather' || config.mode === 'matrix' ? config.mode : 'off'
}
