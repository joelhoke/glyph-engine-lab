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

/** Track the original finger across object links. A non-passive touchmove
 * keeps horizontal gestures ours even when Safari cancels pointer events;
 * vertical scrolling and multi-finger zoom remain native. */
export function bindMobileHeroTouch(
  hero: HTMLElement,
  callbacks: { start: () => void; drag: () => void; end: (direction: -1 | 0 | 1) => void },
) {
  let start: { id: number; x: number; y: number } | null = null
  const cancel = () => {
    if (!start) return
    start = null
    callbacks.drag()
    callbacks.end(0)
  }
  const down = (event: TouchEvent) => {
    if (event.touches.length !== 1) { cancel(); return }
    const point = event.touches[0]
    start = { id: point.identifier, x: point.clientX, y: point.clientY }
    callbacks.start()
  }
  const move = (event: TouchEvent) => {
    if (event.touches.length !== 1) { cancel(); return }
    if (!start) return
    const point = Array.from(event.touches).find(touch => touch.identifier === start!.id)
    if (!point) return
    const dx = point.clientX - start.x, dy = point.clientY - start.y
    if (Math.hypot(dx, dy) > 10) callbacks.drag()
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.25 && event.cancelable) event.preventDefault()
  }
  const up = (event: TouchEvent) => {
    if (!start) return
    const point = Array.from(event.changedTouches).find(touch => touch.identifier === start!.id)
    if (!point) return
    const direction = mobileSwipeStep(point.clientX - start.x, point.clientY - start.y)
    start = null
    if (direction) callbacks.drag()
    callbacks.end(direction)
  }
  hero.addEventListener('touchstart', down, { passive: true })
  hero.addEventListener('touchmove', move, { passive: false })
  hero.addEventListener('touchend', up)
  hero.addEventListener('touchcancel', cancel)
  return () => {
    hero.removeEventListener('touchstart', down)
    hero.removeEventListener('touchmove', move)
    hero.removeEventListener('touchend', up)
    hero.removeEventListener('touchcancel', cancel)
  }
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
