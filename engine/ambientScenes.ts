/**
 * Ambient scene registry (vibe-playground carousel): the flat cyclic list of
 * named atmospheres the simplified ambient control steps through — one scene
 * = one full AmbientConfig with fixed, tuned parameter values, so the UI
 * never exposes the individual weather/matrix knobs.
 *
 * A scene is pure routing over engine/ambientConfig: weather scenes pin the
 * preset at WEATHER_DEFAULTS values, matrix pins the slow stream composition
 * (speed 25 — the meditative default, not the 100 knob default), and Off
 * carries the untouched AMBIENT_DEFAULTS sub-configs so a later mode switch
 * still finds the standard values.
 *
 * Pure functions only — verified by scripts/verify-ambient-scenes.js.
 */

import {
  AMBIENT_DEFAULTS,
  AmbientConfig,
  AmbientMode,
  BACKDROP_OPACITY_DEFAULT,
  MATRIX_DEFAULTS,
  WEATHER_DEFAULTS,
  WeatherPreset,
} from './ambientConfig'

export type AmbientSceneId =
  | 'off'
  | 'clear'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'blizzard'
  | 'fog'
  | 'wind'
  | 'matrix'

export interface AmbientSceneDefinition {
  id: AmbientSceneId
  label: string
  mode: AmbientMode
  /** Weather scenes only; matrix and off carry no preset. */
  preset?: WeatherPreset
}

/** The carousel order — cyclic, so next/prev wrap at both ends. */
export const AMBIENT_SCENES: readonly AmbientSceneDefinition[] = [
  { id: 'off', label: 'Off', mode: 'off' },
  { id: 'clear', label: 'Clear', mode: 'weather', preset: 'clear' },
  { id: 'rain', label: 'Rain', mode: 'weather', preset: 'rain' },
  { id: 'storm', label: 'Storm', mode: 'weather', preset: 'storm' },
  { id: 'snow', label: 'Snow', mode: 'weather', preset: 'snow' },
  { id: 'blizzard', label: 'Blizzard', mode: 'weather', preset: 'blizzard' },
  { id: 'fog', label: 'Fog', mode: 'weather', preset: 'fog' },
  { id: 'wind', label: 'Wind', mode: 'weather', preset: 'wind' },
  { id: 'matrix', label: 'Matrix', mode: 'matrix' },
]

export const AMBIENT_SCENE_COUNT = AMBIENT_SCENES.length

/** Carousel position of a scene (0-based) for the `Storm · 4 of 9` label. */
export function ambientSceneIndex(id: AmbientSceneId): number {
  const index = AMBIENT_SCENES.findIndex((scene) => scene.id === id)
  return index >= 0 ? index : 0
}

/**
 * Build the complete ambient config for a scene. Every knob is pinned to the
 * scene's fixed composition; sub-configs of the inactive mode stay at their
 * defaults so nothing is lost by cycling away and back.
 */
export function buildSceneAmbientConfig(id: AmbientSceneId): AmbientConfig {
  const scene = AMBIENT_SCENES.find((entry) => entry.id === id)
  if (scene && scene.mode === 'weather' && scene.preset) {
    return {
      mode: 'weather',
      interactionStrength: 1,
      backdropOpacity: BACKDROP_OPACITY_DEFAULT,
      weather: { ...WEATHER_DEFAULTS, preset: scene.preset },
      matrix: { ...MATRIX_DEFAULTS },
    }
  }
  if (scene && scene.mode === 'matrix') {
    return {
      mode: 'matrix',
      interactionStrength: 1,
      backdropOpacity: BACKDROP_OPACITY_DEFAULT,
      weather: { ...WEATHER_DEFAULTS },
      // The scene pins the slow stream composition: speed 25, not the 100
      // knob default.
      matrix: { ...MATRIX_DEFAULTS, speed: 25 },
    }
  }
  // Off (and any unknown id): the untouched defaults, sub-configs preserved.
  return {
    ...AMBIENT_DEFAULTS,
    weather: { ...AMBIENT_DEFAULTS.weather },
    matrix: { ...AMBIENT_DEFAULTS.matrix },
  }
}

/**
 * Inverse of buildSceneAmbientConfig: the scene a config represents. Only the
 * mode and weather preset identify the scene — parameter values are the
 * scene's own, so edited configs still resolve to their scene. A weather
 * config carrying an unknown preset resolves to 'off'.
 */
export function resolveAmbientSceneId(config: AmbientConfig): AmbientSceneId {
  if (config.mode === 'matrix') return 'matrix'
  if (config.mode === 'weather') {
    const scene = AMBIENT_SCENES.find(
      (entry) => entry.mode === 'weather' && entry.preset === config.weather.preset,
    )
    return scene ? scene.id : 'off'
  }
  return 'off'
}

/** Step through the carousel; wraps cyclically at both ends. */
export function nextAmbientSceneId(
  id: AmbientSceneId,
  direction: 'next' | 'prev',
): AmbientSceneId {
  const index = ambientSceneIndex(id)
  const stepped =
    direction === 'next'
      ? (index + 1) % AMBIENT_SCENE_COUNT
      : (index - 1 + AMBIENT_SCENE_COUNT) % AMBIENT_SCENE_COUNT
  return AMBIENT_SCENES[stepped].id
}
