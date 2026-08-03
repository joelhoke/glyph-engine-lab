/**
 * Semantic theme tokens: the single source of truth for the
 * page/canvas/surface/text/border/accent colors, in both a dark and a light
 * mapping. The shipped theme follows the visitor's system preference —
 * `app/globals.css` declares the dark values on `:root` and overrides them
 * inside `@media (prefers-color-scheme: light)`, and engine/useSystemTheme.ts
 * mirrors the same media query for the canvas. There is deliberately no
 * toggle, persistence, or `data-theme` attribute.
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
 * The landing canvas background per theme: a radial gradient from the theme's
 * canvas token out to a deeper (dark) or cooler (light) edge. The intro
 * playground forces both stops (components/PortfolioExperience), replacing
 * the old forced black.
 */
export const LANDING_CANVAS_GRADIENT: Record<ThemeName, { color1: string; color2: string }> = {
  dark: {
    color1: CANVAS_THEMES.dark.canvas,
    color2: '#101826',
  },
  light: {
    color1: CANVAS_THEMES.light.canvas,
    color2: '#DCE7F3',
  },
}

/**
 * Theme-aware source resolution for scene/slide/preset source assets that
 * carry a light-variant twin (e.g. a white wordmark that would vanish on a
 * light field). A missing light variant always falls back to the base URL —
 * wiring the optional `lightSourceUrl` field is opt-in per slide/story.
 */
export function resolveThemedSourceUrl(
  sourceUrl: string,
  lightSourceUrl: string | null | undefined,
  theme: ThemeName,
): string {
  return theme === 'light' && lightSourceUrl ? lightSourceUrl : sourceUrl
}
