'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, MouseEvent, KeyboardEvent } from 'react'
import { bindMobileHeroTouch, createMobileCarouselClock, mobileCompositionScale, MOBILE_DOCK_GEOMETRY, mobileSlotAction, mobileSwipeStep, nextDockSlot } from './home/mobileHero'

/** Reusable mobile carousel interaction; callers own content and placement. */
export function useMobileDock<Slot extends string>(hero: HTMLElement | null, active: boolean, options: {
  slots: readonly Slot[]; initialSlot: Slot; mediaQuery?: string; focusTarget: (slot: Slot) => string
}) {
  const { slots, initialSlot, focusTarget, mediaQuery = '(max-width: 767px)' } = options
  const [mobile, setMobile] = useState(false)
  const [selected, setSelected] = useState<Slot | null>(initialSlot)
  const [reduced, setReduced] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [keyboardFocused, setKeyboardFocused] = useState(false)
  const [touching, setTouching] = useState(false)
  const [manualRevision, setManualRevision] = useState(0)
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null)
  const dragged = useRef(false)
  useEffect(() => {
    if (!hero || !mobile) return
    return bindMobileHeroTouch(hero, {
      start: () => { dragged.current = false; setTouching(true) },
      drag: () => { dragged.current = true },
      end: direction => {
        if (direction) setSelected(current => nextDockSlot(current, direction, slots))
        setManualRevision(value => value + 1)
        setTouching(false)
      },
    })
  }, [hero, mobile, slots])
  useEffect(() => {
    if (!hero) return
    const media = matchMedia(mediaQuery)
    const measure = () => {
      setMobile(media.matches)
      // Both consumers share the approved fan dimensions; desktop retains its own responsive values.
      for (const [property, value] of [['--mobile-dock-outer-offset', MOBILE_DOCK_GEOMETRY.outer], ['--mobile-dock-inner-offset', MOBILE_DOCK_GEOMETRY.inner], ['--mobile-dock-object-size', MOBILE_DOCK_GEOMETRY.object]] as const) {
        if (media.matches) hero.style.setProperty(property, `${value}px`)
        else hero.style.removeProperty(property)
      }
      hero.style.setProperty('--mobile-composition-scale', String(mobileCompositionScale(hero.clientWidth)))
      setSelected(current => media.matches ? current ?? initialSlot : null)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(hero)
    media.addEventListener('change', measure)
    measure()
    return () => { observer.disconnect(); media.removeEventListener('change', measure) }
  }, [hero, mediaQuery, initialSlot])

  useEffect(() => {
    if (!hero) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReduced(motion.matches)
    const updateVisibility = () => setHidden(document.hidden)
    const updateFocus = () => setKeyboardFocused(
      hero.contains(document.activeElement) && document.activeElement?.matches(':focus-visible') === true,
    )
    const blur = (event: FocusEvent) => {
      if (!hero.contains(event.relatedTarget as Node | null)) setKeyboardFocused(false)
    }
    updateMotion()
    updateVisibility()
    motion.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    hero.addEventListener('focusin', updateFocus)
    hero.addEventListener('focusout', blur)
    return () => {
      motion.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
      hero.removeEventListener('focusin', updateFocus)
      hero.removeEventListener('focusout', blur)
    }
  }, [hero])

  const autoRunning = mobile && active && !reduced && !hidden && !keyboardFocused && !touching
  useEffect(() => {
    if (!autoRunning) return
    const clock = createMobileCarouselClock(
      () => setSelected(current => nextDockSlot(current, 1, slots)),
      (callback, delay) => window.setTimeout(callback, delay),
      timer => window.clearTimeout(timer),
    )
    return clock.stop
  }, [autoRunning, manualRevision, slots])

  const select = (slot: Slot) => { setSelected(slot); setManualRevision(value => value + 1) }
  const step = (direction: number) => {
    setSelected(current => nextDockSlot(current, direction, slots))
    setManualRevision(value => value + 1)
  }
  return {
    mobile, selected, select, step, autoRunning,
    // Restart the visual timer for same-object taps and interrupted gestures,
    // as well as automatic advances. Keep the label link itself mounted.
    timerKey: `${selected}-${manualRevision}-${autoRunning}`,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (!mobile || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? slots[0] : event.key === 'End' ? slots[slots.length - 1]
        : nextDockSlot(selected, event.key === 'ArrowRight' ? 1 : -1, slots)
      select(next)
      const target = hero?.querySelector<HTMLElement>(
        focusTarget(next),
      )
      target?.focus({ preventScroll: true })
    },
    onSlotClick: (event: MouseEvent<HTMLElement>, slot: Slot) => {
      const action = mobileSlotAction({ mobile, selected, slot, dragged: dragged.current,
        detail: event.detail, button: event.button, metaKey: event.metaKey,
        ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey })
      if (action === 'navigate') return false
      event.preventDefault()
      if (action === 'select') select(slot)
      return true
    },
    gestureProps: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (!mobile || event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return
        dragged.current = false
        setTouching(true)
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const start = gesture.current
        if (!start || start.id !== event.pointerId) return
        const dx = event.clientX - start.x, dy = event.clientY - start.y
        if (Math.hypot(dx, dy) > 10) dragged.current = true
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.25) {
          event.currentTarget.setPointerCapture(event.pointerId)
        }
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        const start = gesture.current
        if (!start || start.id !== event.pointerId) return
        const direction = mobileSwipeStep(event.clientX - start.x, event.clientY - start.y)
        if (direction) { dragged.current = true; step(direction) }
        gesture.current = null
        setTouching(false)
      },
      onPointerCancel: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === 'touch') return
        gesture.current = null; dragged.current = true; setTouching(false)
      },
      onClickCapture: (event: MouseEvent<HTMLElement>) => {
        if (mobile && dragged.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation() }
      },
      onDragStart: (event: React.DragEvent<HTMLElement>) => { if (mobile) event.preventDefault() },
    },
  }
}
