/**
 * Semantic theme tokens (pre-release): the single source of truth for the
 * page/canvas/surface/text/border/accent colors, in both a dark and a light
 * mapping. The dark theme is the only shipped theme — `<html>` carries
 * `data-theme="dark"` statically and the CSS custom properties in
 * `app/globals.css` (`--color-*`) mirror the dark values below. The light
 * mapping is authored but unused until a future controller can switch the
 * attribute; there is deliberately no `prefers-color-scheme`, persistence,
 * or toggle yet.
 *
 * Pure data only — no runtime behavior.
 */

export type ThemeName = 'dark' | 'light'

export type CanvasTheme = {
  /** Page background (body, the base behind everything). */
  page: string
  /** Canvas base background (the landing gradient's primary stop). */
  canvas: string
  /** Elevated surface (skip link, overlays, cards). */
  surface: string
  /** Primary text. */
  text: string
  /** Secondary/muted text. */
  textMuted: string
  /** Default hairline border on dark fills. */
  border: string
  /** Interaction accent (links, labels, focus rings, nav). */
  accent: string
}

export const CANVAS_THEMES: Record<ThemeName, CanvasTheme> = {
  dark: {
    page: '#090C12',
    canvas: '#090C12',
    surface: '#0E1620',
    text: '#F7FBFF',
    textMuted: '#C5D4EA',
    border: 'rgba(255, 255, 255, 0.14)',
    accent: '#8ABAFF',
  },
  light: {
    page: '#F4F6F9',
    canvas: '#F4F6F9',
    surface: '#FFFFFF',
    text: '#101826',
    textMuted: '#44536A',
    border: 'rgba(16, 24, 38, 0.14)',
    accent: '#0C5E7D',
  },
}

/**
 * The fixed landing canvas background: a radial gradient from the dark
 * canvas token out to a deeper blue-black. The intro playground forces both
 * stops (components/PortfolioExperience), replacing the old forced black.
 */
export const LANDING_CANVAS_GRADIENT = {
  color1: CANVAS_THEMES.dark.canvas,
  color2: '#101826',
}
