// =============================================================================
// Vibe content — single source of truth for the Vibe experience.
//
// The invitation line, the "Make it yours" entry point, the privacy note shown
// next to the upload control, the human-readable upload error copy, and the
// authored presets all live below. Nothing outside this file should need to
// change when copy or compositions evolve.
// =============================================================================

import { ThemedPlaygroundConfig } from '../engine/playgroundTheme'
import { VIBE_THEMED_PLAYGROUND, WORK_THEME_COLORS, COLLABORATE_THEME_COLORS } from '../engine/sceneConfig'
import { AMBIENT_DEFAULTS } from '../engine/ambientConfig'
import { MOTION_DEFAULTS } from '../engine/motionConfig'

/** Short, direct invitation shown on the Vibe surface. */
export const VIBE_INVITATION =
  'An open glyph field, tuned the way I like it — until you change your mind. Bend the type, the color, the shape; nothing leaves your browser.'

/** Label for the single entry point that opens the control dock. */
export const VIBE_MAKE_IT_YOURS_LABEL = 'Make it yours'

/** Quiet one-line nudge inside the open dock, under the pane header. */
export const VIBE_DOCK_INVITATION =
  'Everything here is editable, reversible, and local.'

/**
 * Privacy note shown next to the upload control. This must match reality:
 * engine/svgUpload.ts and engine/rasterUpload.ts read the file in-browser,
 * validate it locally, and hand the renderer a data/object URL — no network
 * request is ever made. Do not weaken this copy without checking the
 * validators still behave that way.
 */
export const VIBE_PRIVACY_NOTE =
  'SVG, PNG, or WebP only — your file is processed entirely in your browser and is never uploaded anywhere.'

/** Status announced while an uploaded source is being read and validated. */
export const VIBE_UPLOAD_PENDING_LABEL = 'Reading your image locally…'

/**
 * Human-readable copy for every error the validators (engine/svgUpload.ts,
 * engine/rasterUpload.ts, engine/visualSource.ts) can produce, keyed by the
 * exact message. scripts/verify-vibe-content.js extracts the error literals
 * from those modules and fails if any key is missing, so keep this map in
 * sync when the validators' messages change. Their behavior must not change.
 */
export const VIBE_UPLOAD_ERROR_COPY: Record<string, string> = {
  'The SVG file must be smaller than 1 MB.':
    'That SVG is too large — files must be under 1 MB.',
  'The uploaded SVG is not valid XML.':
    "That file isn't readable as an SVG — try exporting it again.",
  'The uploaded SVG is missing an <svg> root.':
    "We couldn't find an SVG image in that file.",
  'The uploaded SVG contains disallowed content.':
    "That SVG contains content we can't safely show — try a simpler file.",
  'The uploaded SVG contains external resource references.':
    'That SVG links to outside resources — save a self-contained copy and try again.',
  'The uploaded SVG contains an external image reference.':
    'That SVG uses an image from the web — embed it or remove it and try again.',
  'The uploaded SVG contains an unsafe external reference.':
    'That SVG references an outside file — keep everything inside one file and try again.',
  'The uploaded SVG contains unsafe event handlers.':
    'That SVG contains interactive scripts — remove them and try again.',
  'The uploaded SVG contains unsafe script URLs.':
    'That SVG contains script links — remove them and try again.',
  'The uploaded SVG contains external references.':
    'That SVG reaches out to the web — make it self-contained and try again.',
  'The uploaded SVG contains external stylesheets.':
    'That SVG pulls in an outside stylesheet — inline it and try again.',
  'The uploaded SVG contains external fonts.':
    'That SVG pulls in an outside font — outline the text and try again.',
  'Could not read the selected file.':
    "We couldn't read that file — try choosing it again.",
  'The image file must be smaller than 4 MB.':
    'That image is too large — files must be under 4 MB.',
  'The image must be a PNG or WebP file.':
    "That file isn't a PNG or WebP image — try converting it first.",
  'The image file type does not match its contents.':
    "That file's contents don't match its type — try exporting it again.",
  'The image is too large — dimensions must be 4096px or less.':
    'That image is too big — both sides must be 4096px or less.',
  'The image could not be decoded.':
    "We couldn't decode that image — try re-saving it.",
  'The selected file type is not supported.':
    'That file type is not supported — choose an SVG, PNG, or WebP.',
}

/** Shown when a validator produces a message with no mapped copy above. */
export const VIBE_UPLOAD_ERROR_FALLBACK =
  "That file didn't make it through the safety check — try a different file."

/** Map a raw sanitizer error to friendly copy; unknown messages get the fallback. */
export function getFriendlyUploadError(rawError: string): string {
  return VIBE_UPLOAD_ERROR_COPY[rawError] ?? VIBE_UPLOAD_ERROR_FALLBACK
}

export type VibePreset = {
  /** Stable, unique identifier — used as the React key and selection state. */
  id: string
  /** The preset's name, shown on its button in the control dock. */
  label: string
  /** Complete composition with dark+light color tables: text, palette,
   *  background, font, color mode, size. Applying a preset resolves it
   *  against the ACTIVE theme at selection time (feature/light-dark). */
  config: ThemedPlaygroundConfig
  /** Optional built-in SVG source for the composition. When omitted, applying
   *  the preset clears any uploaded SVG and returns to the default source. */
  sourceUrl?: string
}

/**
 * Authored presets: complete compositions applied in one tap from the control
 * dock. The first preset mirrors the curated default (VIBE_THEMED_PLAYGROUND)
 * — it is the entry composition and doubles as the "back to the start"
 * option; the verify script asserts the vibe scene descriptor matches it.
 * Dark color tables are the original compositions; light tables keep each
 * preset's identity on the light field.
 */
export const VIBE_PRESETS: VibePreset[] = [
  {
    id: 'signature',
    label: 'Signature',
    config: VIBE_THEMED_PLAYGROUND,
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    config: {
      glyphText: 'draft · draw · measure · make · ',
      glyphFont: "'Courier New', monospace",
      glyphColorMode: 'rows',
      glyphSizePt: 12,
      motion: { ...MOTION_DEFAULTS },
      ambient: { ...AMBIENT_DEFAULTS },
      dark: WORK_THEME_COLORS.dark,
      light: WORK_THEME_COLORS.light,
    },
    sourceUrl: '/assets/work/story-01.svg',
  },
  {
    id: 'ember',
    label: 'Ember',
    config: {
      glyphText: 'ember · glow · slow fire · ',
      glyphFont: "'Georgia', serif",
      glyphColorMode: 'word-cycle',
      glyphSizePt: 16,
      motion: { ...MOTION_DEFAULTS },
      ambient: { ...AMBIENT_DEFAULTS },
      dark: COLLABORATE_THEME_COLORS.dark,
      light: COLLABORATE_THEME_COLORS.light,
    },
    sourceUrl: '/assets/work/story-02.svg',
  },
  {
    id: 'mono',
    label: 'Mono',
    config: {
      glyphText: 'form follows feeling — ',
      glyphFont: "'Times New Roman', serif",
      glyphColorMode: 'glyph-cycle',
      glyphSizePt: 24,
      motion: { ...MOTION_DEFAULTS },
      ambient: { ...AMBIENT_DEFAULTS },
      dark: {
        backgroundColor1: '#050505',
        backgroundColor2: '#141414',
        glyphPalette: ['#f5f5f5', '#9a9a9a', '#ffffff'],
      },
      light: {
        backgroundColor1: '#FAFAFA',
        backgroundColor2: '#E5E7EB',
        glyphPalette: ['#111827', '#4B5563', '#000000'],
      },
    },
    sourceUrl: '/assets/work/story-03.svg',
  },
]

/** Bounds-safe preset lookup — unknown or null ids resolve to null. */
export function getVibePreset(id: string | null): VibePreset | null {
  if (!id) return null
  return VIBE_PRESETS.find((preset) => preset.id === id) ?? null
}
