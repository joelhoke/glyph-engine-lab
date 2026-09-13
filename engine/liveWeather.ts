/**
 * Live Seattle weather for the landing atmosphere: current conditions at the
 * designer's home base, mapped onto the existing weather presets.
 *
 * Data source: Open-Meteo (https://open-meteo.com/, free for non-commercial
 * use, no API key; weather data CC BY 4.0). The coordinates are FIXED — no
 * geolocation, nothing about the visitor leaves the page beyond the forecast
 * request itself. The module only builds the request and maps the response;
 * the network call lives in the component layer
 * (components/PortfolioExperience.tsx), which applies the seasonal mood from
 * engine/seasonalAtmosphere.ts first and swaps to live conditions when the
 * fetch resolves. Offline, slow, or malformed responses silently keep the
 * seasonal fallback.
 *
 * The landing stays a calm backdrop: `storm` and `blizzard` remain
 * playground-only presets, and intensity never exceeds LANDING_MAX_INTENSITY.
 *
 * Pure functions only — verified by scripts/verify-live-weather.js.
 */

import {
  AmbientConfig,
  clampAmbientConfig,
  MATRIX_DEFAULTS,
  WeatherPreset,
} from './ambientConfig'
import { LANDING_INTERACTION_STRENGTH } from './seasonalAtmosphere'

/** Seattle, Washington — home base. */
export const SEATTLE_COORDINATES = { latitude: 47.6062, longitude: -122.3321 }

/** Wind speed (m/s) at which calm-coded conditions read as the wind preset. */
export const STRONG_WIND_THRESHOLD_MS = 12

/** The landing never exceeds this intensity, whatever the conditions. */
export const LANDING_MAX_INTENSITY = 75

/** Night (per the API's Seattle-local is_day) softens intensity a notch. */
const NIGHT_INTENSITY_SOFTEN = 10

/** Wind-knob scaling: 5 m/s is the calm center (50), ±5 knob points per m/s. */
const WIND_CALM_SPEED_MS = 5
const WIND_KNOB_PER_MS = 5

/** Current-conditions request: WMO weather code, 10 m wind speed, day flag. */
export function buildLiveWeatherUrl(
  coordinates: { latitude: number; longitude: number } = SEATTLE_COORDINATES,
): string {
  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: 'weather_code,wind_speed_10m,is_day',
    wind_speed_unit: 'ms',
  })
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

export type LiveConditions = {
  /** WMO weather interpretation code (0–99). */
  weatherCode: number
  /** 10 m wind speed in m/s (request `wind_speed_unit=ms`). */
  windSpeedMs: number
  /** Seattle-local daylight flag from the API. */
  isDay: boolean
}

type LiveMoodBucket = {
  preset: WeatherPreset
  intensity: number
}

/**
 * WMO weather-code buckets → preset + base intensity. Ranges are contiguous
 * on purpose: codes are sparse within each family (51/53/55 drizzle), and any
 * code the table doesn't recognize returns null so the caller keeps the
 * seasonal fallback instead of guessing.
 */
export function bucketWeatherCode(weatherCode: number): LiveMoodBucket | null {
  if (!Number.isFinite(weatherCode)) return null
  const code = Math.round(weatherCode)
  if (code === 0 || code === 1) return { preset: 'clear', intensity: 50 }
  if (code === 2) return { preset: 'clear', intensity: 45 }
  if (code === 3) return { preset: 'fog', intensity: 40 }
  if (code === 45 || code === 48) return { preset: 'fog', intensity: 60 }
  // Drizzle (51–57, incl. freezing): rain at a gentle intensity.
  if (code >= 51 && code <= 57) return { preset: 'rain', intensity: 35 + (code - 51) * 2 }
  // Rain (61–67, incl. freezing): moderate to heavy.
  if (code >= 61 && code <= 67) return { preset: 'rain', intensity: 50 + (code - 61) * 3 }
  // Snow fall (71–77, incl. grains).
  if (code >= 71 && code <= 77) return { preset: 'snow', intensity: 50 + (code - 71) * 3 }
  // Rain showers (80–82): a notch heavier than steady rain.
  if (code >= 80 && code <= 82) return { preset: 'rain', intensity: 55 + (code - 80) * 7 }
  // Snow showers (85–86).
  if (code === 85 || code === 86) return { preset: 'snow', intensity: 60 + (code - 85) * 5 }
  // Thunderstorm (95–99): the landing stays calm — heavy rain, never storm.
  if (code >= 95 && code <= 99) return { preset: 'rain', intensity: LANDING_MAX_INTENSITY }
  return null
}

/**
 * Map live conditions onto the landing's ambient weather envelope (same shape
 * as the seasonal resolver: suppressed backdrop, calmer pointer influence).
 * The wind knob follows the measured wind speed around its calm center;
 * turbulence rises gently with wind. Returns null for unrecognized codes.
 */
export function mapLiveConditions(conditions: LiveConditions): AmbientConfig | null {
  const bucket = bucketWeatherCode(conditions.weatherCode)
  if (!bucket) return null
  const windSpeed = Number.isFinite(conditions.windSpeedMs)
    ? Math.max(0, conditions.windSpeedMs)
    : 0
  // Gusty clear/overcast days read as wind rather than motionless calm.
  const preset =
    windSpeed >= STRONG_WIND_THRESHOLD_MS && (bucket.preset === 'clear' || bucket.preset === 'fog')
      ? 'wind'
      : bucket.preset
  const intensity = Math.min(
    LANDING_MAX_INTENSITY,
    bucket.intensity - (conditions.isDay ? 0 : NIGHT_INTENSITY_SOFTEN),
  )
  return clampAmbientConfig({
    mode: 'weather',
    interactionStrength: LANDING_INTERACTION_STRENGTH,
    // The landing paints its own fixed background gradient (same rationale as
    // the seasonal resolver): weather particles render above it.
    backdropOpacity: 0,
    weather: {
      preset,
      intensity,
      wind: 50 + (windSpeed - WIND_CALM_SPEED_MS) * WIND_KNOB_PER_MS,
      turbulence: 55 + windSpeed * 2,
      blur: preset === 'fog' ? 30 : preset === 'clear' || preset === 'wind' ? 15 : 25,
    },
    matrix: { ...MATRIX_DEFAULTS },
  })
}
