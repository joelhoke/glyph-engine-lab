export type GlyphColorMode =
  | 'image-gradient'
  | 'glyph-cycle'
  | 'word-cycle'
  | 'rows'

export type PlaygroundConfig = {
  glyphText: string
  glyphPalette: string[]
  backgroundColor1: string
  backgroundColor2: string
  glyphFont: string
  glyphColorMode: GlyphColorMode
}

export const GLYPH_COLOR_MODE_OPTIONS: { value: GlyphColorMode; label: string }[] = [
  { value: 'image-gradient', label: 'Image gradient' },
  { value: 'glyph-cycle', label: 'Glyph cycle' },
  { value: 'word-cycle', label: 'Word cycle' },
  { value: 'rows', label: 'Rows' },
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

export const APPROVED_PLAYGROUND_DEFAULTS: PlaygroundConfig = {
  glyphText:
    "Voilà! In View, a humble Vaudevillian Veteran, cast Vicariously as both Victim and Villain by the Vicissitudes of fate. This Visage, no mere Veneer of Vanity, is a Vestige of the Vox populi, now Vacant, Vanished.",
  glyphPalette: [
    '#ff0000',
    '#ff8800',
    '#ffff00',
    '#00ff00',
    '#0088ff',
    '#8800ff',
  ],
  backgroundColor1: '#0a0a0a',
  backgroundColor2: '#12121a',
  glyphFont: "'Cutive Mono', monospace",
  glyphColorMode: 'image-gradient',
}
