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
