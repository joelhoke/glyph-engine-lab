import { magnificationPosition, magnificationWeights } from '../../engine/dockMagnification'
import type { HeroSlotId } from '../../content/home'

export const DOCK_SLOTS: HeroSlotId[] = ['work', 'vibe', 'intro', 'collaborate', 'gallery']
export const DOCK_REST_SPACING = 0.5
export const DOCK_REST_SCALE = 0.75

/** A continuous cosine wave magnifies the nearest object and softly lifts
 *  its neighbors. Coordinates come from fixed expanded centers, not moving
 *  element bounds, so the animation cannot chase its own hit targets. */
export function dockWeights(position: number | null): number[] {
  return magnificationWeights(position, DOCK_SLOTS.length)
}

export function dockPosition(clientX: number, centerX: number, gap: number): number {
  return magnificationPosition(clientX, centerX, gap, DOCK_SLOTS.length)
}
