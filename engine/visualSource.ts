/**
 * The seam between "what the visitor points the field at" and the engine.
 *
 * A VisualSource is one decodable frame — today always a static image (SVG or
 * raster) that the shared sampler in engine/svgTargetSource.ts turns into
 * target points. Nothing downstream (glyph assignment, simulation, renderer)
 * changes per source kind.
 *
 * Animated sources live behind the internal lifecycle in
 * engine/animatedSource.ts (Stage 3); nothing here grows per-frame behavior.
 */
export type VisualSourceKind = 'svg' | 'raster'

export type VisualSource = {
  kind: VisualSourceKind
  id: string
  url: string
}

/** Sanitizer-style literal for files outside every supported type; mapped to
 *  friendly copy in content/vibe.ts (verify-vibe-content.js keeps them in sync). */
export const UNSUPPORTED_SOURCE_TYPE_ERROR = 'The selected file type is not supported.'

/** Transactional-upload literals (engine/sourcePromotion): a validated
 *  candidate can still fail the decode/visible-target probe before promotion.
 *  Kept here (a scanned module) so the error-copy sync check covers them. */
export const SVG_UNDECODABLE_ERROR = 'The uploaded SVG could not be decoded.'
export const SVG_EMPTY_FIELD_ERROR = 'The uploaded SVG has no visible artwork.'
export const RASTER_EMPTY_FIELD_ERROR = 'The image has no visible artwork.'
export const RASTER_UNDECODABLE_ERROR = 'The image could not be decoded.'
