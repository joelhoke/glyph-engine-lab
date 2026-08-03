import { isMobileViewport } from './displayBudget'
import { ExperienceMode } from './types'

/**
 * Discrete glyph point sizes for the playground. Canvas design points equal
 * CSS pixels: 8 pt renders an 8 CSS-pixel glyph. 12 pt is the baseline the
 * sampling spacing and the ambient typography anchor to.
 *
 * 4 pt and 6 pt are MOBILE-ONLY sizes: they are selectable only below the
 * 768px mobile breakpoint, and every resolution path clamps them up to 8 pt
 * on larger viewports, so a stored mobile selection can never render on
 * desktop.
 */
export type GlyphPointSize = 4 | 6 | 8 | 12 | 16 | 24 | 32 | 48

export const GLYPH_POINT_SIZES: readonly GlyphPointSize[] = [4, 6, 8, 12, 16, 24, 32, 48]

/** Sizes selectable only below the mobile breakpoint. */
export const MOBILE_ONLY_POINT_SIZES: readonly GlyphPointSize[] = [4, 6]

/** Sizes always selectable (the desktop ladder). */
export const DESKTOP_POINT_SIZES: readonly GlyphPointSize[] = [8, 12, 16, 24, 32, 48]

export const GLYPH_BASE_POINT_SIZE: GlyphPointSize = 12

/** Below the mobile breakpoint, non-Vibe scenes cap the effective size. */
export const MOBILE_GLYPH_POINT_CAP: GlyphPointSize = 8

/** Work scenes run denser on mobile so the hero art stays legible. */
export const WORK_MOBILE_GLYPH_POINT_CAP: GlyphPointSize = 4

/** Smallest size allowed outside mobile viewports. */
export const DESKTOP_POINT_FLOOR: GlyphPointSize = 8

/** Nearest valid point size (ties round up); non-finite/unknown input falls back to 12. */
export const clampGlyphPointSize = (value: unknown): GlyphPointSize => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return GLYPH_BASE_POINT_SIZE
  let nearest: GlyphPointSize = GLYPH_BASE_POINT_SIZE
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const size of GLYPH_POINT_SIZES) {
    const distance = Math.abs(size - value)
    if (distance <= nearestDistance) {
      nearest = size
      nearestDistance = distance
    }
  }
  return nearest
}

/** Viewport-aware clamp: mobile-only sizes clamp up to the desktop floor on
 *  larger viewports; everything else behaves like clampGlyphPointSize. */
export const clampGlyphPointSizeForViewport = (
  value: unknown,
  viewportWidth: number,
): GlyphPointSize => {
  const size = clampGlyphPointSize(value)
  if (!isMobileViewport(viewportWidth) && size < DESKTOP_POINT_FLOOR) {
    return DESKTOP_POINT_FLOOR
  }
  return size
}

/** Sizes offered in the size select: the full ladder on mobile, the desktop
 *  ladder (no 4/6pt) on larger viewports. */
export const resolveSelectableGlyphSizes = (viewportWidth: number): readonly GlyphPointSize[] =>
  isMobileViewport(viewportWidth) ? GLYPH_POINT_SIZES : DESKTOP_POINT_SIZES

/** Canvas line height for a point size (matches the legacy 1.42 factor). */
export const resolveGlyphLineHeight = (size: GlyphPointSize): number =>
  Math.round(size * 1.42)

/** Sampling-step scale relative to the 12pt baseline: larger glyphs get
 *  proportionate spacing (6 → 1/2, 8 → 2/3, 24 → 2, 48 → 4). */
export const resolveGlyphSamplingScale = (size: GlyphPointSize): number =>
  size / GLYPH_BASE_POINT_SIZE

/** Effective size for a scene: on mobile viewports, non-Vibe scenes cap the
 *  size (Work caps denser at 4pt so its hero art stays legible; other scenes
 *  cap at 8pt); the Vibe scene honors the explicit user selection even on
 *  mobile. Mobile-only sizes (4/6pt) are clamped to the desktop floor on
 *  larger viewports regardless of scene. */
export const resolveEffectiveGlyphSize = (
  size: GlyphPointSize,
  experience: ExperienceMode,
  viewportWidth: number,
): GlyphPointSize => {
  const viewportClamped =
    !isMobileViewport(viewportWidth) && size < DESKTOP_POINT_FLOOR ? DESKTOP_POINT_FLOOR : size
  if (experience !== 'vibe' && isMobileViewport(viewportWidth)) {
    const cap = experience === 'work' ? WORK_MOBILE_GLYPH_POINT_CAP : MOBILE_GLYPH_POINT_CAP
    return viewportClamped > cap ? cap : viewportClamped
  }
  return viewportClamped
}
