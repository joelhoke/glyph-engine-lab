'use client'

import { useEffect, useRef } from 'react'
import type { HeroSlotId } from '../../content/home'
import { createFrameLoop } from '../../engine/frameLoop'

/**
 * Layered hero parallax (homepage-redesign phase 4): one animation loop that
 * writes `--parallax-x` / `--parallax-y` custom properties onto the motion
 * nodes HomeHero registers (the fan rotation lives on the separate position
 * elements and is never touched). CSS transforms only, no per-frame React
 * updates. Scheduling uses the same parked discipline as the canvas
 * (engine/frameLoop.ts): disabled conditions park the loop, and once the
 * eased position settles the loop stops requesting frames entirely — the
 * next pointer movement re-arms it.
 *
 * The glyph field's own pointer response is untouched: this loop only READS
 * pointer position, listening passively at the window level (canvas pointer
 * events don't bubble through the foreground hero sibling).
 */

/** Per-slot travel in CSS px at the hero's edge (pointer normalized ±1).
 *  The portrait sits deepest (barely moves); the fan's outer slots most. */
export type HeroMotionId = HeroSlotId | 'portrait' | 'hand-left' | 'hand-right'
export const HERO_DEPTH_PX: Record<HeroMotionId, number> = {
  portrait: 6,
  work: 20,
  vibe: 14,
  intro: 12,
  gallery: 14,
  collaborate: 20,
  'hand-left': 20,
  'hand-right': 14,
}

/** Below the fan breakpoint the hero is the touch-controlled mobile fan — no
 *  parallax. Matches the ≥768px fan media query in globals.css. */
export const HERO_PARALLAX_MIN_VIEWPORT_PX = 768

/** Normalized-axis snap distance at which the loop considers itself settled
 *  (well under a pixel at every depth). */
const PARALLAX_SETTLE_EPSILON = 0.0005

export type NormalizedPointer = {
  /** -1…1, 0 at the horizontal center. */
  x: number
  /** -1…1, 0 at the vertical center. */
  y: number
}

/** Pointer position within a rectangle, normalized to -1…1 on both axes
 *  (0,0 = center). Clamped so pointers outside the bounds never overdrive
 *  the travel. */
export function normalizePointer(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
): NormalizedPointer {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 }
  const clampUnit = (value: number) => Math.min(1, Math.max(-1, value))
  return {
    x: clampUnit(((clientX - bounds.left) / bounds.width) * 2 - 1),
    y: clampUnit(((clientY - bounds.top) / bounds.height) * 2 - 1),
  }
}

/** One easing step toward the target: alpha = 1 - exp(-min(deltaMs, 64)/120)
 *  (the delta cap keeps a stalled frame from jumping), snapping onto the
 *  target once inside the settle epsilon so the loop can park. */
export function stepParallaxValue(current: number, target: number, deltaMs: number): number {
  const alpha = 1 - Math.exp(-Math.min(deltaMs, 64) / 120)
  const next = current + (target - current) * alpha
  return Math.abs(target - next) < PARALLAX_SETTLE_EPSILON ? target : next
}

export type HeroParallaxEnv = {
  /** External gate from the shell: Home displayed, hero onscreen, and (phase
   *  5) not menu-covered. */
  enabled: boolean
  /** matchMedia('(pointer: fine) and (hover: hover)') — coarse/no-hover
   *  pointers (touch) never parallax. */
  fineHoverPointer: boolean
  reducedMotion: boolean
  viewportWidth: number
}

export function isHeroParallaxActive(env: HeroParallaxEnv): boolean {
  return (
    env.enabled &&
    env.fineHoverPointer &&
    !env.reducedMotion &&
    env.viewportWidth >= HERO_PARALLAX_MIN_VIEWPORT_PX
  )
}

/** Motion-node registry, keyed by slot id plus 'portrait'. */
export type HeroMotionNodes = ReadonlyMap<HeroMotionId, HTMLElement>

export function useHeroParallax(options: {
  hero: HTMLElement | null
  motionNodes: HeroMotionNodes
  enabled: boolean
}) {
  const { hero, motionNodes, enabled } = options
  // Ref mirrors: the loop and listeners never re-subscribe when the shell's
  // gate flips; the bridge lets the gate effect trigger the same
  // reset/re-measure path as an environment change.
  const enabledRef = useRef(enabled)
  const envChangedRef = useRef<() => void>(() => {})
  useEffect(() => {
    enabledRef.current = enabled
    envChangedRef.current()
  }, [enabled])

  useEffect(() => {
    if (!hero) return
    const fineHoverQuery = window.matchMedia('(pointer: fine) and (hover: hover)')
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    // Bounds are viewport-relative and the hero scrolls with the document:
    // measured once, refreshed on resize and scroll.
    let bounds = hero.getBoundingClientRect()
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let lastNow = 0

    const isActive = () =>
      isHeroParallaxActive({
        enabled: enabledRef.current,
        fineHoverPointer: fineHoverQuery.matches,
        reducedMotion: reducedMotionQuery.matches,
        viewportWidth: window.innerWidth,
      })

    const writeNodes = () => {
      motionNodes.forEach((node, id) => {
        const depth = HERO_DEPTH_PX[id] ?? 0
        // Layers drift AGAINST the pointer (camera-pan depth).
        node.style.setProperty('--parallax-x', `${(-current.x * depth).toFixed(2)}px`)
        node.style.setProperty('--parallax-y', `${(-current.y * depth).toFixed(2)}px`)
      })
    }

    const resetNeutral = () => {
      target.x = 0
      target.y = 0
      current.x = 0
      current.y = 0
      lastNow = 0
      writeNodes()
    }

    const loop = createFrameLoop({
      frame: (now) => {
        const deltaMs = lastNow > 0 ? now - lastNow : 16
        lastNow = now
        current.x = stepParallaxValue(current.x, target.x, deltaMs)
        current.y = stepParallaxValue(current.y, target.y, deltaMs)
        writeNodes()
      },
      // Settled (== after the epsilon snap) → the loop parks itself.
      keepRunning: () => current.x !== target.x || current.y !== target.y,
      isParked: () => !isActive(),
    })

    const measure = () => {
      bounds = hero.getBoundingClientRect()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      if (!isActive()) return
      // Only pointer coordinates inside the hero bounds drive the target;
      // outside, the target returns to neutral.
      const inside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom
      if (inside) {
        const next = normalizePointer(event.clientX, event.clientY, bounds)
        target.x = next.x
        target.y = next.y
      } else {
        target.x = 0
        target.y = 0
      }
      loop.renderOnce()
    }

    const onPointerGone = () => {
      target.x = 0
      target.y = 0
      loop.renderOnce()
    }

    const onEnvChange = () => {
      if (!isActive()) {
        // Disabled mid-flight: hard reset to neutral — the parked gate stops
        // any pending frame and writeNodes lands the 0s synchronously.
        resetNeutral()
        return
      }
      measure()
      loop.renderOnce()
    }
    envChangedRef.current = onEnvChange

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('resize', onEnvChange)
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('blur', onPointerGone)
    document.documentElement.addEventListener('pointerleave', onPointerGone)
    fineHoverQuery.addEventListener('change', onEnvChange)
    reducedMotionQuery.addEventListener('change', onEnvChange)

    // Mounting into a disabled environment still writes the neutral pose.
    onEnvChange()

    return () => {
      envChangedRef.current = () => {}
      loop.dispose()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', onEnvChange)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('blur', onPointerGone)
      document.documentElement.removeEventListener('pointerleave', onPointerGone)
      fineHoverQuery.removeEventListener('change', onEnvChange)
      reducedMotionQuery.removeEventListener('change', onEnvChange)
    }
  }, [hero, motionNodes])
}
