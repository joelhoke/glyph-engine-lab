import type { HeroSlotId } from '../../content/home'
import { DOCK_SLOTS } from './heroDock'

export const MOBILE_DOCK_REST_SCALE = 0.9
export const MOBILE_DOCK_SELECTED_SCALE = 1.44
export const MOBILE_CAROUSEL_DELAY_MS = 5000
export const MOBILE_INITIAL_SLOT: HeroSlotId = 'work'
export const MOBILE_DOCK_REST_SPACING = 1.15

/** Keep the mobile fan at its saved spacing while an object grows.
 * The existing spread tuner remains proportional to its approved 1.12. */
export function mobileDockSpacing(tunedSpread: number): number {
  return MOBILE_DOCK_REST_SPACING * tunedSpread / 1.12
}

export function mobileDockScale(weight: number): number {
  return MOBILE_DOCK_REST_SCALE + (MOBILE_DOCK_SELECTED_SCALE - MOBILE_DOCK_REST_SCALE) * weight
}

/** A fresh five-second wait after each advance or manual selection. The
 * owner stops the clock while offscreen, paused, or interacting. */
export function createMobileCarouselClock(
  advance: () => void,
  schedule: (callback: () => void, delay: number) => number,
  cancel: (timer: number) => void,
) {
  let timer: number | null = null
  let stopped = false
  const restart = () => {
    if (timer !== null) cancel(timer)
    if (stopped) return
    timer = schedule(() => {
      timer = null
      advance()
      restart()
    }, MOBILE_CAROUSEL_DELAY_MS)
  }
  restart()
  return {
    restart,
    stop: () => { stopped = true; if (timer !== null) cancel(timer); timer = null },
  }
}

/** One deliberate horizontal gesture advances one object; vertical scrolling
 * and short/diagonal taps must never select or follow a destination. */
export function mobileSwipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 28 || Math.abs(dx) < Math.abs(dy) * 1.25) return 0
  return dx < 0 ? 1 : -1
}

export function nextMobileSlot(current: HeroSlotId | null, step: number): HeroSlotId {
  const index = current === null ? 2 : DOCK_SLOTS.indexOf(current)
  return DOCK_SLOTS[(index + step + DOCK_SLOTS.length) % DOCK_SLOTS.length]
}

export function mobileDockWeights(selected: HeroSlotId | null): number[] {
  return DOCK_SLOTS.map(slot => slot === selected ? 1 : 0)
}

export function mobileCompositionScale(width: number): number {
  return Math.min(1, Math.max(0, width - 24) / 700)
}

export function mobileSlotAction(input: {
  mobile: boolean; selected: HeroSlotId | null; slot: HeroSlotId; dragged: boolean
  detail: number; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean
}): 'navigate' | 'select' | 'ignore' {
  if (!input.mobile || input.detail === 0 || input.button !== 0 || input.metaKey || input.ctrlKey || input.shiftKey || input.altKey) return 'navigate'
  if (input.dragged) return 'ignore'
  return input.selected === input.slot ? 'navigate' : 'select'
}
