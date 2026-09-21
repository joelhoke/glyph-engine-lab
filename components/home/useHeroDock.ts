'use client'

import { useEffect, useRef, useState } from 'react'
import type { HeroSlotId } from '../../content/home'
import { createFrameLoop } from '../../engine/frameLoop'
import { stepParallaxValue } from './useHeroParallax'
import { DOCK_REST_SCALE, DOCK_REST_SPACING, DOCK_SLOTS, dockPosition, dockWeights } from './heroDock'
import { mobileDockScale, mobileDockSpacing, mobileDockWeights, MOBILE_DOCK_REST_SPACING } from './mobileHero'

export function useHeroDock(hero: HTMLElement | null, active: boolean, focused: HeroSlotId | null, mobileSelected: HeroSlotId | null = null) {
  const focusRef = useRef(focused)
  const mobileRef = useRef(mobileSelected)
  const updateRef = useRef<() => void>(() => {})
  const [hovered, setHovered] = useState<HeroSlotId | null>(null)
  useEffect(() => { focusRef.current = focused; updateRef.current() }, [focused])
  useEffect(() => { mobileRef.current = mobileSelected; updateRef.current() }, [mobileSelected])

  useEffect(() => {
    if (!hero) return
    const zone = hero.querySelector<HTMLElement>('.home-hero-dock-zone')
    if (!zone) return
    const desktop = window.matchMedia('(min-width: 768px)')
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let pointer: { x: number; y: number } | null = null
    let selected: HeroSlotId | null = null
    let spacing = desktop.matches ? DOCK_REST_SPACING : MOBILE_DOCK_REST_SPACING, targetSpacing = spacing
    let weights = dockWeights(null), targetWeights = weights.slice()
    let lastTime = 0
    const enabled = () => active && !document.hidden
    const write = () => {
      hero.style.setProperty('--dock-spread', String(spacing))
      // Desktop wrists follow the accordion's original eased opening.
      // Mobile hands override this with their independent, static pose.
      hero.style.setProperty('--hand-rest-turn', `${45 * (1 - Math.max(...weights))}deg`)
      DOCK_SLOTS.forEach((slot, index) => {
        hero.style.setProperty(`--dock-${slot}-scale`, String(desktop.matches
          ? DOCK_REST_SCALE + 0.35 * weights[index] : mobileDockScale(weights[index])))
        hero.style.setProperty(`--dock-${slot}-layer`, String([2, 4, 6, 5, 3][index] + Math.round(weights[index] * 20) + (slot === selected ? 10 : 0)))
      })
    }
    const loop = createFrameLoop({
      isParked: () => !enabled() || reduced.matches,
      keepRunning: () => spacing !== targetSpacing || weights.some((weight, i) => weight !== targetWeights[i]),
      frame: now => {
        const delta = lastTime ? now - lastTime : 16
        lastTime = now
        spacing = stepParallaxValue(spacing, targetSpacing, delta)
        weights = weights.map((weight, i) => stepParallaxValue(weight, targetWeights[i], delta))
        write()
      },
    })
    const update = () => {
      const css = getComputedStyle(hero)
      const expanded = Number.parseFloat(css.getPropertyValue('--hero-spread')) || 1.12
      const bounds = zone.getBoundingClientRect()
      let position: number | null = null
      if (enabled() && !desktop.matches && mobileRef.current) position = DOCK_SLOTS.indexOf(mobileRef.current)
      else if (enabled() && desktop.matches && focusRef.current) position = DOCK_SLOTS.indexOf(focusRef.current)
      else if (enabled() && desktop.matches && fine.matches && pointer && pointer.x >= bounds.left && pointer.x <= bounds.right &&
        pointer.y >= bounds.top && pointer.y <= bounds.bottom) {
        const gap = Math.max(82, Math.min(122, window.innerWidth * 0.082)) * expanded
        position = dockPosition(pointer.x, bounds.left + bounds.width / 2, gap)
      }
      selected = position === null ? null : DOCK_SLOTS[Math.round(position)]
      setHovered(selected)
      targetSpacing = desktop.matches
        ? position === null ? DOCK_REST_SPACING : Math.max(DOCK_REST_SPACING, expanded)
        : mobileDockSpacing(expanded)
      targetWeights = desktop.matches ? dockWeights(position) : mobileDockWeights(selected)
      if (!enabled() || reduced.matches) {
        loop.park()
        spacing = targetSpacing
        weights = targetWeights.slice()
        write()
      } else {
        if (!loop.isPending()) lastTime = 0
        loop.renderOnce()
      }
    }
    updateRef.current = update
    const move = (event: PointerEvent) => {
      pointer = event.pointerType === 'touch' ? null : { x: event.clientX, y: event.clientY }
      update()
    }
    const reset = () => { pointer = null; update() }
    const leave = (event: PointerEvent) => { if (event.relatedTarget === null) reset() }
    const observer = new ResizeObserver(update)
    observer.observe(zone)
    // Tuning writes geometry inline; ignore changes to the dock's own
    // per-frame custom properties when inspecting the style attribute.
    let priorSpread = hero.style.getPropertyValue('--hero-spread')
    const tuningObserver = new MutationObserver(() => {
      const next = hero.style.getPropertyValue('--hero-spread')
      if (next !== priorSpread) { priorSpread = next; update() }
    })
    tuningObserver.observe(hero, { attributes: true, attributeFilter: ['style'] })
    write()
    update()
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerout', leave)
    window.addEventListener('blur', reset)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    document.addEventListener('visibilitychange', reset)
    desktop.addEventListener('change', update)
    fine.addEventListener('change', update)
    reduced.addEventListener('change', update)
    return () => {
      updateRef.current = () => {}
      loop.dispose()
      observer.disconnect()
      tuningObserver.disconnect()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerout', leave)
      window.removeEventListener('blur', reset)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
      document.removeEventListener('visibilitychange', reset)
      desktop.removeEventListener('change', update)
      fine.removeEventListener('change', update)
      reduced.removeEventListener('change', update)
    }
  }, [hero, active])
  return hovered
}
