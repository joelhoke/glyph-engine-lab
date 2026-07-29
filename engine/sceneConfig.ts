import { defaultSceneState } from './constants'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  PlaygroundConfig,
  VIBE_DEFAULT_PLAYGROUND,
} from './playgroundConfig'
import { SourceLayoutConfig } from './svgTargetSource'
import { ExperienceSceneKey } from './types'

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
 */
export type SceneDescriptor = {
  /** SVG source URL for the target field. Null keeps the current source
   *  (the uploaded SVG in vibe, or the built-in default). */
  sourceUrl: string | null
  /** Baseline playground-style config for the field. In vibe this only seeds
   *  the initial state — the control dock keeps it user-editable. */
  playground: PlaygroundConfig
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

export const EXPERIENCE_SCENES: Record<ExperienceSceneKey, SceneDescriptor> = {
  work: {
    // Baseline source for the work scene; the active story's sourceUrl
    // replaces this via resolveWorkScene (content/work.ts) before it ever
    // reaches SceneCanvas.
    sourceUrl: '/assets/work/story-01.svg',
    playground: {
      ...APPROVED_PLAYGROUND_DEFAULTS,
      glyphPalette: ['#8abaff', '#bcd7ff', '#5a8fd6', '#dbe9ff'],
      backgroundColor1: '#080b12',
      backgroundColor2: '#101826',
    },
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
    // of the first preset — see VIBE_DEFAULT_PLAYGROUND and content/vibe.ts.
    playground: {
      ...VIBE_DEFAULT_PLAYGROUND,
      glyphPalette: [...VIBE_DEFAULT_PLAYGROUND.glyphPalette],
    },
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
    playground: {
      ...APPROVED_PLAYGROUND_DEFAULTS,
      glyphPalette: ['#f2b28a', '#ffd9c4', '#d68a5a', '#fff0e6'],
      backgroundColor1: '#100a0a',
      backgroundColor2: '#201410',
    },
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
