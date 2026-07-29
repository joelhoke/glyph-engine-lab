/**
 * Launch budgets for the canvas renderer (M9): a devicePixelRatio cap that
 * bounds fill cost on high-density displays, and viewport-dependent budgets
 * that keep glyph count and SVG sampling density sane on small screens.
 *
 * Pure functions only — verified by scripts/verify-display-budget.js.
 */

// Rendering above 2x costs fill rate with no visible gain for glyph fields.
const MAX_DEVICE_PIXEL_RATIO = 2

// Below this CSS width the scene switches to mobile budgets.
const MOBILE_VIEWPORT_MAX_WIDTH = 768

// Upper bound on the live glyph population on small viewports.
const MOBILE_GLYPH_CAP = 1200

// Sampling step multiplier on small viewports: larger steps → fewer targets.
const MOBILE_SAMPLING_STEP_FACTOR = 1.6

const resolveRenderPixelRatio = (rawDevicePixelRatio: number): number => {
  const raw = rawDevicePixelRatio > 0 ? rawDevicePixelRatio : 1
  return Math.min(raw, MAX_DEVICE_PIXEL_RATIO)
}

const isMobileViewport = (viewportWidth: number): boolean =>
  viewportWidth > 0 && viewportWidth < MOBILE_VIEWPORT_MAX_WIDTH

const resolveSamplingStep = (baseStep: number, viewportWidth: number): number => {
  const base = baseStep > 0 ? baseStep : 1
  if (!isMobileViewport(viewportWidth)) return base
  return Math.max(1, Math.ceil(base * MOBILE_SAMPLING_STEP_FACTOR))
}

const resolveGlyphBudget = (requestedCount: number, viewportWidth: number): number => {
  const requested = Math.max(0, Math.floor(requestedCount))
  if (!isMobileViewport(viewportWidth)) return requested
  return Math.min(requested, MOBILE_GLYPH_CAP)
}

export {
  MAX_DEVICE_PIXEL_RATIO,
  MOBILE_GLYPH_CAP,
  MOBILE_SAMPLING_STEP_FACTOR,
  MOBILE_VIEWPORT_MAX_WIDTH,
  isMobileViewport,
  resolveGlyphBudget,
  resolveRenderPixelRatio,
  resolveSamplingStep,
}
