import { defaultSceneState } from './constants'
import type { SourceLayoutConfig } from './svgTargetSource'

// Authored scene defaults shared by the renderer surfaces and tuning controls.
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
