import type { HeroSlotId } from '../../content/home'

export const DOCK_SLOTS: HeroSlotId[] = ['work', 'vibe', 'intro', 'collaborate', 'gallery']
export const DOCK_REST_SPACING = 0.5
export const DOCK_REST_SCALE = 0.75

/** A continuous cosine wave magnifies the nearest object and softly lifts
 *  its neighbors. Coordinates come from fixed expanded centers, not moving
 *  element bounds, so the animation cannot chase its own hit targets. */
export function dockWeights(position: number | null): number[] {
  return DOCK_SLOTS.map((_, index) => {
    if (position === null) return 0
    const distance = Math.abs(index - position)
    return distance >= 1.75 ? 0 : Math.cos(distance / 1.75 * Math.PI / 2) ** 2
  })
}

export function dockPosition(clientX: number, centerX: number, gap: number): number {
  return Math.max(0, Math.min(4, 2 + (clientX - centerX) / Math.max(1, gap)))
}
