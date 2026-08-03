import { defaultSceneState } from '../../engine/constants'
import { SourceLayoutConfig } from '../../engine/svgTargetSource'

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
