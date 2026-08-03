import { defaultSceneState } from './constants'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  PlaygroundConfig,
} from './playgroundConfig'
import {
  PlaygroundThemeColors,
  ThemedPlaygroundConfig,
  resolvePlaygroundConfig,
} from './playgroundTheme'
import { ThemeName } from './theme'
import { SourceLayoutConfig } from './svgTargetSource'
import { ExperienceSceneKey } from './types'
import { VisualSourceKind } from './visualSource'

/**
 * Declarative description of everything an experience mode needs to drive the
 * persistent glyph scene: which SVG source to sample, the baseline playground
 * config (text, palette, background, type), simulation/behavior parameters,
 * and the copy hooks used by the mode surface and document title.
 *
 * This is a plain typed config object consumed directly by PortfolioExperience
 * and SceneCanvas — no registry or plugin machinery. The work and collaborate
 * scenes are baselines: PortfolioExperience merges the active case study over
 * work via resolveWorkScene (content/work.ts) and the selected conversation
 * starter over collaborate via resolveCollaborateScene (content/collaborate.ts).
 *
 * Theming (feature/light-dark): every scene's colors are authored as a
 * dark+light pair in `themedPlayground`; `playground` stays the resolved dark
 * config so dark behavior is byte-identical to the pre-theme baseline, and
 * consumers resolve the active theme via resolveScenePlayground.
 */
export type SceneDescriptor = {
  /** SVG source URL for the target field. Null keeps the current source
   *  (the uploaded SVG in vibe, or the built-in default). */
  sourceUrl: string | null
  /** Source asset kind for sourceUrl — defaults to 'svg'. */
  sourceKind?: VisualSourceKind
  /** Baseline playground-style config for the field, resolved for the dark
   *  theme. In vibe this only seeds the initial state — the control dock
   *  keeps it user-editable. */
  playground: PlaygroundConfig
  /** The same baseline with dark+light color tables. resolveScenePlayground
   *  picks the active theme's colors while preserving any slide/story-level
   *  overrides merged into `playground`. */
  themedPlayground: ThemedPlaygroundConfig
  /** Simulation/behavior parameters passed through to SceneCanvas. */
  behavior: {
    mouseR: number
    particleRepel: number
    weatherRepelMult: number
    clickImpulseRadius: number
    clickImpulseForce: number
  }
  sourceLayout: SourceLayoutConfig
  /** Copy hooks for the mode surface and document title. */
  copy: {
    documentTitle: string
    heading: string
    tagline: string
  }
}

const DEFAULT_BEHAVIOR = {
  mouseR: defaultSceneState.mouseR,
  particleRepel: 0.48,
  weatherRepelMult: 6,
  clickImpulseRadius: 220,
  clickImpulseForce: 12,
}

// Work mode sits behind long-form copy, so the field responds to the pointer
// and weather much more gently than the other modes.
const WORK_BEHAVIOR = {
  mouseR: 120,
  particleRepel: 0.2,
  weatherRepelMult: 3,
  clickImpulseRadius: 150,
  clickImpulseForce: 5,
}

// Collaborate is a conversation surface, so the field should feel warmer and
// calmer than vibe — the gentlest pointer/weather response of the three modes.
const COLLABORATE_BEHAVIOR = {
  mouseR: 100,
  particleRepel: 0.16,
  weatherRepelMult: 2,
  clickImpulseRadius: 180,
  clickImpulseForce: 8,
}

const DEFAULT_SOURCE_LAYOUT: SourceLayoutConfig = {
  samplingStep: 10,
  alphaThreshold: 64,
  margin: 0.08,
  fit: 'contain',
  scale: 0,
  offsetX: 0,
  offsetY: 0,
}

/**
 * Landing (completed intro) hero source: the full JH logotype. Vibe and
 * Collaborate keep the built-in monogram as their default mark; if the
 * logotype ever fails to decode, the source pipeline falls back to that same
 * monogram (engine/sourceOutcome).
 */
export const LANDING_SOURCE_URL = '/assets/JH-Logotype.svg'

/**
 * The curated vibe default composition with themed color tables. The dark
 * table mirrors VIBE_DEFAULT_PLAYGROUND exactly; the light table is the
 * Signature palette tuned for the light field.
 */
export const VIBE_THEMED_PLAYGROUND: ThemedPlaygroundConfig = {
  glyphText: 'play · bend · make it yours · vibe · ',
  glyphFont: "'Cutive Mono', monospace",
  glyphColorMode: 'image-gradient',
  glyphSizePt: 12,
  motion: { ...APPROVED_PLAYGROUND_DEFAULTS.motion, custom: { ...APPROVED_PLAYGROUND_DEFAULTS.motion.custom } },
  ambient: {
    ...APPROVED_PLAYGROUND_DEFAULTS.ambient,
    weather: { ...APPROVED_PLAYGROUND_DEFAULTS.ambient.weather },
    matrix: { ...APPROVED_PLAYGROUND_DEFAULTS.ambient.matrix },
  },
  dark: {
    backgroundColor1: '#0d0a14',
    backgroundColor2: '#1a1026',
    glyphPalette: ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'],
  },
  light: {
    backgroundColor1: '#FAF7FF',
    backgroundColor2: '#E9E0F3',
    // ROYGBV hues deepened halfway toward the muted light palette — the Vibe
    // identity stays intact on light backgrounds without going neon or muddy.
    glyphPalette: ['#E0110C', '#D07200', '#BCB200', '#0ABF1E', '#0673BE', '#7B21D4'],
  },
}

/** Work/Blueprint scene colors: dark mirrors the original baseline. */
export const WORK_THEME_COLORS: Record<ThemeName, PlaygroundThemeColors> = {
  dark: {
    backgroundColor1: '#080b12',
    backgroundColor2: '#101826',
    glyphPalette: ['#8abaff', '#bcd7ff', '#5a8fd6', '#dbe9ff'],
  },
  light: {
    backgroundColor1: '#E8EEF6',
    backgroundColor2: '#C9D8EA',
    glyphPalette: ['#0C5E7D', '#224F7A', '#47729D', '#101826'],
  },
}

/** Collaborate/Ember scene colors: dark mirrors the original baseline. */
export const COLLABORATE_THEME_COLORS: Record<ThemeName, PlaygroundThemeColors> = {
  dark: {
    backgroundColor1: '#100a0a',
    backgroundColor2: '#201410',
    glyphPalette: ['#f2b28a', '#ffd9c4', '#d68a5a', '#fff0e6'],
  },
  light: {
    backgroundColor1: '#FFF7F2',
    backgroundColor2: '#F1DDD2',
    glyphPalette: ['#8A3F1A', '#A9562A', '#713415', '#5A2C18'],
  },
}

const WORK_THEMED_PLAYGROUND: ThemedPlaygroundConfig = {
  glyphText: APPROVED_PLAYGROUND_DEFAULTS.glyphText,
  glyphFont: APPROVED_PLAYGROUND_DEFAULTS.glyphFont,
  glyphColorMode: APPROVED_PLAYGROUND_DEFAULTS.glyphColorMode,
  glyphSizePt: APPROVED_PLAYGROUND_DEFAULTS.glyphSizePt,
  motion: { ...APPROVED_PLAYGROUND_DEFAULTS.motion, custom: { ...APPROVED_PLAYGROUND_DEFAULTS.motion.custom } },
  ambient: {
    ...APPROVED_PLAYGROUND_DEFAULTS.ambient,
    weather: { ...APPROVED_PLAYGROUND_DEFAULTS.ambient.weather },
    matrix: { ...APPROVED_PLAYGROUND_DEFAULTS.ambient.matrix },
  },
  dark: WORK_THEME_COLORS.dark,
  light: WORK_THEME_COLORS.light,
}

const COLLABORATE_THEMED_PLAYGROUND: ThemedPlaygroundConfig = {
  ...WORK_THEMED_PLAYGROUND,
  dark: COLLABORATE_THEME_COLORS.dark,
  light: COLLABORATE_THEME_COLORS.light,
}

export const EXPERIENCE_SCENES: Record<ExperienceSceneKey, SceneDescriptor> = {
  work: {
    // Baseline source for the work scene; the active story's sourceUrl
    // replaces this via resolveWorkScene (content/work.ts) before it ever
    // reaches SceneCanvas.
    sourceUrl: '/assets/work/story-01.svg',
    playground: resolvePlaygroundConfig(WORK_THEMED_PLAYGROUND, 'dark'),
    themedPlayground: WORK_THEMED_PLAYGROUND,
    behavior: { ...WORK_BEHAVIOR },
    sourceLayout: { ...DEFAULT_SOURCE_LAYOUT },
    copy: {
      documentTitle: 'Work',
      heading: 'Work',
      tagline: 'Selected projects and case studies land here soon — the scene is wired and ready for them.',
    },
  },
  vibe: {
    // Null source: vibe keeps the uploaded SVG when present, otherwise the
    // built-in default — exactly the playground's current behavior.
    sourceUrl: null,
    // Curated default composition (M5): visually complete on entry, before
    // the control dock is ever opened. Also the reset target and the basis
    // of the first preset — see VIBE_THEMED_PLAYGROUND and content/vibe.ts.
    playground: resolvePlaygroundConfig(VIBE_THEMED_PLAYGROUND, 'dark'),
    themedPlayground: VIBE_THEMED_PLAYGROUND,
    behavior: { ...DEFAULT_BEHAVIOR },
    sourceLayout: { ...DEFAULT_SOURCE_LAYOUT },
    copy: {
      documentTitle: 'Vibe',
      heading: 'Vibe',
      tagline: 'An open glyph field to bend — type, color, and shape, all live.',
    },
  },
  collaborate: {
    sourceUrl: '/assets/test-source.svg',
    playground: resolvePlaygroundConfig(COLLABORATE_THEMED_PLAYGROUND, 'dark'),
    themedPlayground: COLLABORATE_THEMED_PLAYGROUND,
    behavior: { ...COLLABORATE_BEHAVIOR },
    sourceLayout: { ...DEFAULT_SOURCE_LAYOUT },
    copy: {
      documentTitle: 'Collaborate',
      heading: 'Collaborate',
      tagline: "A conversation invitation — starters, contact routes, and a warmer, calmer field.",
    },
  },
}

export function getSceneDescriptor(key: ExperienceSceneKey): SceneDescriptor {
  return EXPERIENCE_SCENES[key]
}

const palettesEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((color, index) => color === b[index])

/**
 * Resolve a scene descriptor's playground config against the active theme.
 * Slide/story-level overrides merged into `descriptor.playground` (by
 * resolveWorkSlideScene / resolveCollaborateScene) are preserved: every
 * non-color field carries over verbatim, and a color override (an authored
 * per-story palette/background, theme-independent by design) wins over the
 * theme table. When the descriptor's colors still match the dark baseline,
 * the active theme's colors apply.
 */
export function resolveScenePlayground(
  descriptor: SceneDescriptor,
  theme: ThemeName,
): PlaygroundConfig {
  const themed = descriptor.themedPlayground
  const colors = themed[theme]
  const resolved: PlaygroundConfig = {
    ...descriptor.playground,
    backgroundColor1: colors.backgroundColor1,
    backgroundColor2: colors.backgroundColor2,
    glyphPalette: [...colors.glyphPalette],
  }
  // Authored story-level color overrides (content/work.ts) are
  // theme-independent: when the descriptor's colors no longer match the dark
  // baseline tables, they are an explicit override and stick in both themes.
  if (!palettesEqual(descriptor.playground.glyphPalette, themed.dark.glyphPalette)) {
    resolved.glyphPalette = [...descriptor.playground.glyphPalette]
  }
  if (
    descriptor.playground.backgroundColor1 !== themed.dark.backgroundColor1 ||
    descriptor.playground.backgroundColor2 !== themed.dark.backgroundColor2
  ) {
    resolved.backgroundColor1 = descriptor.playground.backgroundColor1
    resolved.backgroundColor2 = descriptor.playground.backgroundColor2
  }
  return resolved
}
