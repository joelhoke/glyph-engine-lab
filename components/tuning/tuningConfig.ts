import { defaultSceneState } from '../../engine/constants'
import { SourceLayoutConfig } from '../../engine/svgTargetSource'
import { HERO_THREE_BASE_ROTATIONS } from '../home/renderers/HeroThreeObject'

const radToDeg = (rad: number) => (rad * 180) / Math.PI

export type NumericControlDefinition = {
  label: string
  min: number
  max: number
  step: number
  unit?: string
  showSlider?: boolean
}

export type SourceLayoutConfigKey = keyof SourceLayoutConfig

export type SourceLayoutControlDefinition = NumericControlDefinition & {
  kind: 'number' | 'select'
  options?: { label: string; value: string }[]
}

export type SceneConfigKey =
  | 'mouseR'
  | 'particleRepel'
  | 'weatherRepelMult'
  | 'clickImpulseRadius'
  | 'clickImpulseForce'

export type SceneConfig = {
  mouseR: number
  particleRepel: number
  weatherRepelMult: number
  clickImpulseRadius: number
  clickImpulseForce: number
  /** Held-pointer multiplier on the hover influence radius (not exposed as a
   *  tuning control; comes from the per-mode scene descriptor). */
  dragInfluenceMult: number
  /** Per-mode droplet ripple amplitude multiplier (descriptor-driven). */
  rippleStrength: number
}

export const INTERACTION_CONTROL_DEFINITIONS: Record<
  SceneConfigKey,
  NumericControlDefinition
> = {
  mouseR: {
    label: 'Radius',
    min: 0,
    max: 800,
    step: 1,
    unit: 'px',
    showSlider: true,
  },
  particleRepel: {
    label: 'Particle Strength',
    min: 0,
    max: 2,
    step: 0.01,
    showSlider: true,
  },
  weatherRepelMult: {
    label: 'Weather Mult',
    min: 0,
    max: 12,
    step: 0.1,
    showSlider: true,
  },
  clickImpulseRadius: {
    label: 'Click Radius',
    min: 50,
    max: 400,
    step: 1,
    unit: 'px',
    showSlider: true,
  },
  clickImpulseForce: {
    label: 'Click Force',
    min: 0,
    max: 30,
    step: 0.1,
    showSlider: true,
  },
}

export const APPROVED_SCENE_DEFAULTS: SceneConfig = {
  mouseR: defaultSceneState.mouseR,
  particleRepel: 0.48,
  weatherRepelMult: 6,
  clickImpulseRadius: 200,
  clickImpulseForce: 10,
  dragInfluenceMult: 1.7,
  rippleStrength: 1.0,
}

export const APPROVED_SOURCE_LAYOUT_DEFAULTS: SourceLayoutConfig = {
  samplingStep: 10,
  alphaThreshold: 64,
  margin: 0.08,
  fit: 'contain',
  scale: 0,
  offsetX: 0,
  offsetY: 0,
}

export const SOURCE_LAYOUT_CONTROL_DEFINITIONS: Record<
  SourceLayoutConfigKey,
  SourceLayoutControlDefinition
> = {
  samplingStep: {
    label: 'Sampling step',
    min: 2,
    max: 40,
    step: 1,
    unit: 'px',
    showSlider: true,
    kind: 'number',
  },
  alphaThreshold: {
    label: 'Alpha threshold',
    min: 0,
    max: 255,
    step: 1,
    kind: 'number',
  },
  margin: {
    label: 'Margin',
    min: 0,
    max: 0.45,
    step: 0.01,
    kind: 'number',
  },
  fit: {
    label: 'Fit mode',
    min: 0,
    max: 0,
    step: 1,
    kind: 'select',
    options: [
      { label: 'Contain', value: 'contain' },
      { label: 'Cover', value: 'cover' },
    ],
  },
  scale: {
    label: 'Scale override',
    min: 0,
    max: 5,
    step: 0.05,
    kind: 'number',
  },
  offsetX: {
    label: 'Horizontal offset',
    min: -400,
    max: 400,
    step: 1,
    unit: 'px',
    showSlider: true,
    kind: 'number',
  },
  offsetY: {
    label: 'Vertical offset',
    min: -400,
    max: 400,
    step: 1,
    unit: 'px',
    showSlider: true,
    kind: 'number',
  },
}

// --- Hero fan tuning (homepage-redesign) --------------------------------------
//
// The hero's fan geometry lives as CSS custom properties in globals.css
// (consumed by the slot POSITION elements); the tuning panel edits working
// copies of the shipped defaults below, and the shell writes the custom
// properties inline on the hero element. "Copy values" exports the CSS
// custom-property block for baking tuned values back into globals.css.

export const HERO_FAN_SLOT_KEYS = ['work', 'vibe', 'intro', 'collaborate', 'gallery'] as const
export type HeroFanSlotKey = (typeof HERO_FAN_SLOT_KEYS)[number]

export const HERO_FAN_SLOT_LABELS: Record<HeroFanSlotKey, string> = {
  work: 'Work',
  vibe: 'Vibe',
  intro: 'Intro',
  collaborate: 'Collaborate',
  gallery: 'Gallery',
}

export type HeroFanConfig = {
  /** Global horizontal spread — multiplies the per-slot X offsets. */
  spread: number
  /** The fan's vertical anchor (the slots' `top`, percent of hero height). */
  top: number
  /** Per-slot rest rotation, degrees (the 2D fan card angle). */
  angle: Record<HeroFanSlotKey, number>
  /** Per-slot scale multiplier. */
  scale: Record<HeroFanSlotKey, number>
  /** Per-slot 3D rest orientation, degrees (the objects' baseRotation). */
  rotation: Record<HeroFanSlotKey, { x: number; y: number }>
  /** Portrait backdrop: vertical anchor (percent) and height multiplier. */
  portraitTop: number
  portraitScale: number
}

/** Must match the custom-property defaults declared in globals.css exactly —
 *  the untuned render is pixel-identical to the shipped geometry. The 3D
 *  rotations derive from HERO_THREE_BASE_ROTATIONS (the builders' radians
 *  map) — one source of truth, converted to degrees for the panel. */
export const APPROVED_HERO_FAN_DEFAULTS: HeroFanConfig = {
  spread: 1.12,
  top: 50,
  angle: { work: -11, vibe: -5.5, intro: 0, collaborate: 5.5, gallery: 11 },
  scale: { work: 0.88, vibe: 0.86, intro: 1.38, collaborate: 0.92, gallery: 1 },
  rotation: {
    work: { x: radToDeg(HERO_THREE_BASE_ROTATIONS.work.x), y: radToDeg(HERO_THREE_BASE_ROTATIONS.work.y) },
    vibe: { x: radToDeg(HERO_THREE_BASE_ROTATIONS.vibe.x), y: radToDeg(HERO_THREE_BASE_ROTATIONS.vibe.y) },
    intro: { x: radToDeg(HERO_THREE_BASE_ROTATIONS.notebook.x), y: radToDeg(HERO_THREE_BASE_ROTATIONS.notebook.y) },
    collaborate: { x: radToDeg(HERO_THREE_BASE_ROTATIONS.collaborate.x), y: radToDeg(HERO_THREE_BASE_ROTATIONS.collaborate.y) },
    gallery: { x: radToDeg(HERO_THREE_BASE_ROTATIONS.gallery.x), y: radToDeg(HERO_THREE_BASE_ROTATIONS.gallery.y) },
  },
  portraitTop: 5,
  portraitScale: 1,
}

export type HeroFanChange =
  | { kind: 'spread'; value: number }
  | { kind: 'top'; value: number }
  | { kind: 'angle'; slot: HeroFanSlotKey; value: number }
  | { kind: 'scale'; slot: HeroFanSlotKey; value: number }
  | { kind: 'rotation'; slot: HeroFanSlotKey; axis: 'x' | 'y'; value: number }
  | { kind: 'portraitTop'; value: number }
  | { kind: 'portraitScale'; value: number }

/** The CSS custom-property map for a fan config (property → value). */
export function heroFanCssProperties(config: HeroFanConfig): Record<string, string> {
  const props: Record<string, string> = {
    '--hero-spread': String(config.spread),
    '--hero-fan-top': `${config.top}%`,
    '--hero-portrait-top': `${config.portraitTop}%`,
    '--hero-portrait-scale': String(config.portraitScale),
  }
  for (const slot of HERO_FAN_SLOT_KEYS) {
    props[`--slot-${slot}-angle`] = `${config.angle[slot]}deg`
    props[`--slot-${slot}-scale`] = String(config.scale[slot])
  }
  return props
}

/** Clipboard export for the tuned values — the CSS custom-property block
 *  for globals.css plus the base rotations as a paste-able radians map for
 *  HERO_THREE_BASE_ROTATIONS in HeroThreeObject.tsx. */
export function formatHeroFanCss(config: HeroFanConfig): string {
  const props = heroFanCssProperties(config)
  const lines = Object.entries(props).map(([key, value]) => `  ${key}: ${value};`)
  const degToRad = (deg: number) => Number(((deg * Math.PI) / 180).toFixed(3))
  const rotationLines = HERO_FAN_SLOT_KEYS.map(
    (slot) =>
      `  ${slot === 'intro' ? 'notebook' : slot}: { x: ${degToRad(config.rotation[slot].x)}, y: ${degToRad(config.rotation[slot].y)} },`,
  )
  return `/* Hero fan geometry (tuned via the tuning panel's Hero section) */\n${lines.join('\n')}\n\n/* Object base rotations — paste into HERO_THREE_BASE_ROTATIONS (components/home/renderers/HeroThreeObject.tsx) */\n{\n${rotationLines.join('\n')}\n}\n`
}
function decimalPlaces(value: number): number {
  const match = String(value).match(/\.(\d+)$/)
  return match ? match[1].length : 0
}

export function formatNumericValue(value: number, step: number): string {
  return value.toFixed(decimalPlaces(step))
}

export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value
  const rounded = Math.round(value / step) * step
  return Number(rounded.toFixed(decimalPlaces(step)))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function isPotentiallyValidDraft(draft: string): boolean {
  if (draft === '' || draft === '-' || draft === '.' || draft === '-.') return true
  const parsed = Number(draft)
  return !Number.isNaN(parsed)
}

/**
 * Commit a raw number input string to an authoritative numeric value.
 *
 * Returns `null` when the input cannot be interpreted as a finite number,
 * signalling that the caller should revert to the last committed value.
 * Otherwise clamps to [min, max] and rounds to the nearest step increment.
 */
export function commitNumericInput(
  raw: string,
  current: number,
  min: number,
  max: number,
  step: number,
): number | null {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
    return null
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return null
  }
  const clamped = clamp(parsed, min, max)
  return roundToStep(clamped, step)
}

/**
 * Keyboard stepping for number/slider pairs: ArrowUp/ArrowDown move the value
 * by `multiplier` step intervals (1 plain, 10 with Shift), clamped to
 * [min, max] and snapped to the step grid. Pure — the DOM handlers in
 * NumericControl and the verify script both go through this.
 */
export function stepNumericValue(
  value: number,
  direction: 1 | -1,
  min: number,
  max: number,
  step: number,
  multiplier = 1,
): number {
  const safeStep = step > 0 ? step : 1
  const safeMultiplier = multiplier > 0 ? multiplier : 1
  const next = value + direction * safeStep * safeMultiplier
  return clamp(roundToStep(next, safeStep), min, max)
}
