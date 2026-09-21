'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, MouseEvent, KeyboardEvent } from 'react'
import type { HeroSlotId } from '../../content/home'
import { bindMobileHeroTouch, createMobileCarouselClock, MOBILE_INITIAL_SLOT, mobileCompositionScale, mobileSlotAction, mobileSwipeStep, nextMobileSlot } from './mobileHero'

export function useMobileHero(hero: HTMLElement | null, active: boolean) {
  const [mobile, setMobile] = useState(false)
  const [selected, setSelected] = useState<HeroSlotId | null>(MOBILE_INITIAL_SLOT)
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
        if (direction) setSelected(current => nextMobileSlot(current, direction))
        setManualRevision(value => value + 1)
        setTouching(false)
      },
    })
  }, [hero, mobile])
  useEffect(() => {
    if (!hero) return
    const media = matchMedia('(max-width: 767px)')
    const measure = () => {
      setMobile(media.matches)
      hero.style.setProperty('--mobile-composition-scale', String(mobileCompositionScale(hero.clientWidth)))
      setSelected(current => media.matches ? current ?? MOBILE_INITIAL_SLOT : null)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(hero)
    media.addEventListener('change', measure)
    measure()
    return () => { observer.disconnect(); media.removeEventListener('change', measure) }
  }, [hero])

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
      () => setSelected(current => nextMobileSlot(current, 1)),
      (callback, delay) => window.setTimeout(callback, delay),
      timer => window.clearTimeout(timer),
    )
    return clock.stop
  }, [autoRunning, manualRevision])

  const select = (slot: HeroSlotId) => { setSelected(slot); setManualRevision(value => value + 1) }
  const step = (direction: number) => {
    setSelected(current => nextMobileSlot(current, direction))
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
      const next = event.key === 'Home' ? 'work' : event.key === 'End' ? 'gallery'
        : nextMobileSlot(selected, event.key === 'ArrowRight' ? 1 : -1)
      select(next)
      const target = event.currentTarget.querySelector<HTMLElement>(
        `[data-slot="${next}"] .home-hero-slot-link`,
      )
      target?.focus({ preventScroll: true })
    },
    onSlotClick: (event: MouseEvent<HTMLAnchorElement>, slot: HeroSlotId) => {
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
