import { AMBIENT_DEFAULTS, AmbientConfig } from './ambientConfig'
import { GlyphColorMode } from './colorDistribution'
import { MOTION_DEFAULTS, MotionConfig } from './motionConfig'

export type { GlyphColorMode }

export type PlaygroundConfig = {
  glyphText: string
  glyphPalette: string[]
  backgroundColor1: string
  backgroundColor2: string
  glyphFont: string
  glyphColorMode: GlyphColorMode
  glyphScale: number
  /** Nested motion configuration; every complete config and preset carries it. */
  motion: MotionConfig
  /** Nested ambient-effect configuration (weather/matrix overlay); every
   *  complete config and preset carries it. */
  ambient: AmbientConfig
}

export const GLYPH_COLOR_MODE_OPTIONS: { value: GlyphColorMode; label: string }[] = [
  { value: 'image-gradient', label: 'Image gradient' },
  { value: 'glyph-cycle', label: 'Glyph cycle' },
  { value: 'word-cycle', label: 'Word cycle' },
  { value: 'rows', label: 'Rows' },
  { value: 'source-colors', label: 'Source colors' },
]

export const GLYPH_FONT_OPTIONS = [
  { value: "'Cutive Mono', monospace", label: 'Cutive Mono' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: "'Georgia', serif", label: 'Georgia' },
  { value: "'Arial', sans-serif", label: 'Arial' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Verdana', sans-serif", label: 'Verdana' },
]

export const MAX_GLYPH_PALETTE_SIZE = 6

/** The six-color ROYGBV set: the shared default glyph palette. */
export const ROYGBV_GLYPH_PALETTE = [
  '#ff0000',
  '#ff8800',
  '#ffff00',
  '#00ff00',
  '#0088ff',
  '#8800ff',
]

/**
 * Curated default composition for the Vibe experience (M5): the scene a
 * visitor sees on entry, before any control is opened. The vibe scene
 * descriptor (engine/sceneConfig.ts) adopts this verbatim, the first authored
 * preset (content/vibe.ts) mirrors it, and the dock's reset restores it.
 * The palette is the six-color ROYGBV set (Stage 3).
 */
export const VIBE_DEFAULT_PLAYGROUND: PlaygroundConfig = {
  glyphText: 'play · bend · make it yours · vibe · ',
  glyphPalette: [...ROYGBV_GLYPH_PALETTE],
  backgroundColor1: '#0d0a14',
  backgroundColor2: '#1a1026',
  glyphFont: "'Cutive Mono', monospace",
  glyphColorMode: 'image-gradient',
  glyphScale: 1,
  motion: { ...MOTION_DEFAULTS },
  ambient: { ...AMBIENT_DEFAULTS },
}

export const APPROVED_PLAYGROUND_DEFAULTS: PlaygroundConfig = {
  glyphText:
    "Voilà! In view, a humble vaudevillian veteran cast vicariously as both victim and villain by the vicissitudes of Fate... you may call me 'V'.",
  glyphPalette: [...ROYGBV_GLYPH_PALETTE],
  backgroundColor1: '#0a0a0a',
  backgroundColor2: '#12121a',
  glyphFont: "'Cutive Mono', monospace",
  glyphColorMode: 'image-gradient',
  glyphScale: 1,
  motion: { ...MOTION_DEFAULTS },
  ambient: { ...AMBIENT_DEFAULTS },
}
