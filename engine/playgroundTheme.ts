/**
 * Themed playground colors (feature/light-dark): the three color-bearing
 * fields of a PlaygroundConfig (background gradient stops + glyph palette)
 * exist in a dark and a light table; everything else — text, font, color
 * mode, size, motion, ambient — is theme-neutral and shared. Scene baselines
 * (engine/sceneConfig.ts) and vibe presets (content/vibe.ts) carry the themed
 * shape; consumers resolve it against the ACTIVE theme at the moment of use
 * (system-following defaults, preset application, reset).
 *
 * Pure data + one resolver — verified by scripts/verify-theme.js.
 */

import { PlaygroundConfig } from './playgroundConfig'
import { ThemeName } from './theme'

/** The color-bearing slice of a playground config, per theme. */
export type PlaygroundThemeColors = {
  backgroundColor1: string
  backgroundColor2: string
  glyphPalette: string[]
}

/** A complete playground composition with themed color tables. */
export type ThemedPlaygroundConfig = Omit<
  PlaygroundConfig,
  'backgroundColor1' | 'backgroundColor2' | 'glyphPalette'
> & {
  dark: PlaygroundThemeColors
  light: PlaygroundThemeColors
}

/**
 * Resolve a themed config against one theme into a plain PlaygroundConfig.
 * The result is a deep-enough copy — the palette array and the nested
 * motion/ambient objects are cloned — so callers can mutate the resolved
 * config without ever touching the shared authored tables.
 */
export function resolvePlaygroundConfig(
  themed: ThemedPlaygroundConfig,
  theme: ThemeName,
): PlaygroundConfig {
  const colors = themed[theme]
  return {
    glyphText: themed.glyphText,
    glyphPalette: [...colors.glyphPalette],
    backgroundColor1: colors.backgroundColor1,
    backgroundColor2: colors.backgroundColor2,
    glyphFont: themed.glyphFont,
    glyphColorMode: themed.glyphColorMode,
    glyphSizePt: themed.glyphSizePt,
    motion: { ...themed.motion, custom: { ...themed.motion.custom } },
    ambient: {
      ...themed.ambient,
      weather: { ...themed.ambient.weather },
      matrix: { ...themed.ambient.matrix },
    },
  }
}
