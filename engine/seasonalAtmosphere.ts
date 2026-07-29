/**
 * Seasonal landing atmosphere (Stage 3): a deterministic daily weather mood
 * for the completed-intro landing scene.
 *
 * The atmosphere is derived ONLY from local date/time, the IANA timezone
 * name, and the locale's region (a hemisphere approximation). It is NOT a
 * weather service: nothing here performs network I/O, no IP geolocation is
 * consulted, and the same inputs always produce the same output. Site copy
 * must never describe the result as live or current conditions — it is a
 * seasonal mood, nothing more.
 *
 * Pure functions only — verified by scripts/verify-seasonal-atmosphere.js.
 */

import {
  AmbientConfig,
  clampAmbientConfig,
  MATRIX_DEFAULTS,
  WeatherPreset,
} from './ambientConfig'

export type Hemisphere = 'northern' | 'southern'

export type SeasonalAtmosphereInput = {
  /** Local month, 1–12. */
  month: number
  /** Local hour, 0–23. */
  hour: number
  /** BCP 47 locale (e.g. 'en-US'); may be empty. */
  locale: string
  /** IANA timezone name (e.g. 'Australia/Sydney'); may be empty. */
  timeZone: string
}

/**
 * Locale regions mostly or entirely in the southern hemisphere. The locale
 * region is the strongest signal; the timezone name is the fallback.
 */
const SOUTHERN_REGIONS = new Set([
  'AR', 'AU', 'BO', 'BR', 'CL', 'FJ', 'MG', 'MZ', 'NC', 'NZ', 'PE', 'PG',
  'PY', 'SB', 'TL', 'UY', 'ZA', 'ZW',
])

/** Timezone name fragments that imply the southern hemisphere. */
const SOUTHERN_TIMEZONE_HINTS = [
  'Australia/',
  'Antarctica/',
  'Auckland',
  'Argentina',
  'Santiago',
  'Sao_Paulo',
  'Asuncion',
  'Montevideo',
  'La_Paz',
  'Lima',
  'Johannesburg',
  'Harare',
  'Maputo',
  'Fiji',
]

/** Extract the region subtag from a BCP 47 locale ('en-AU' → 'AU'). */
function localeRegion(locale: string): string {
  const parts = locale.replace(/_/g, '-').split('-')
  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i]
    if (/^[a-zA-Z]{2}$/.test(part) || /^[0-9]{3}$/.test(part)) {
      return part.toUpperCase()
    }
  }
  return ''
}

/**
 * Hemisphere approximation from locale region first, timezone name second;
 * defaults to northern when neither says otherwise.
 */
export function resolveHemisphere(locale: string, timeZone: string): Hemisphere {
  const region = localeRegion(locale)
  if (region && SOUTHERN_REGIONS.has(region)) return 'southern'
  if (region) return 'northern'
  if (SOUTHERN_TIMEZONE_HINTS.some((hint) => timeZone.includes(hint))) return 'southern'
  return 'northern'
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** Meteorological season for the month in the given hemisphere. */
export function resolveSeason(month: number, hemisphere: Hemisphere): Season {
  const m = ((Math.floor(month) - 1) % 12 + 12) % 12 // 0–11, tolerant of bad input
  const shifted = hemisphere === 'southern' ? (m + 6) % 12 : m
  if (shifted >= 2 && shifted <= 4) return 'spring'
  if (shifted >= 5 && shifted <= 7) return 'summer'
  if (shifted >= 8 && shifted <= 10) return 'autumn'
  return 'winter'
}

type SeasonalWeather = {
  preset: WeatherPreset
  intensity: number
  wind: number
  turbulence: number
  blur: number
}

/** Quiet, moderate moods — the landing stays calm, never a storm. */
const SEASONAL_WEATHER: Record<Season, SeasonalWeather> = {
  spring: { preset: 'rain', intensity: 55, wind: 35, turbulence: 70, blur: 30 },
  summer: { preset: 'clear', intensity: 50, wind: 45, turbulence: 60, blur: 15 },
  autumn: { preset: 'wind', intensity: 55, wind: 65, turbulence: 80, blur: 20 },
  winter: { preset: 'snow', intensity: 60, wind: 30, turbulence: 55, blur: 25 },
}

/** Calmer pointer influence than the playground default: a backdrop, not a toy. */
const LANDING_INTERACTION_STRENGTH = 0.6

/**
 * Resolve the day's seasonal atmosphere. Deterministic: no randomness, no
 * clock reads, no network — the caller injects the local date parts. Night
 * (before 6h, from 20h) softens the intensity a notch.
 */
export function resolveSeasonalAtmosphere(input: SeasonalAtmosphereInput): AmbientConfig {
  const hemisphere = resolveHemisphere(input.locale, input.timeZone)
  const season = resolveSeason(input.month, hemisphere)
  const weather = SEASONAL_WEATHER[season]
  const night = input.hour < 6 || input.hour >= 20
  return clampAmbientConfig({
    mode: 'weather',
    interactionStrength: LANDING_INTERACTION_STRENGTH,
    weather: {
      preset: weather.preset,
      intensity: night ? weather.intensity - 10 : weather.intensity,
      wind: weather.wind,
      turbulence: weather.turbulence,
      blur: weather.blur,
    },
    matrix: { ...MATRIX_DEFAULTS },
  })
}

/**
 * Build the resolver input from a local Date and the environment's resolved
 * locale/timezone (both injected, so the module itself never touches Intl).
 */
export function captureSeasonalAtmosphereInput(
  now: Date,
  resolved: { locale?: string; timeZone?: string },
): SeasonalAtmosphereInput {
  return {
    month: now.getMonth() + 1,
    hour: now.getHours(),
    locale: resolved.locale ?? '',
    timeZone: resolved.timeZone ?? '',
  }
}
