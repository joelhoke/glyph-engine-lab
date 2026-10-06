'use client'

import { useEffect, useState } from 'react'

/** The hero's transparent layers let events fall through to the canvas,
 *  so measure the section instead of relying on DOM pointer-enter events. */
export function useHeroPresence(hero: HTMLElement | null, active: boolean) {
  const [inside, setInside] = useState(false)
  useEffect(() => {
    if (!hero || !active) { setInside(false); return }
    let point: { x: number; y: number } | null = null
    const measure = () => {
      const rect = hero.getBoundingClientRect()
      setInside(Boolean(point && !document.hidden && point.x >= rect.left && point.x <= rect.right &&
        point.y >= rect.top && point.y <= rect.bottom))
    }
    const move = (event: PointerEvent) => { point = { x: event.clientX, y: event.clientY }; measure() }
    const reset = () => { point = null; setInside(false) }
    const leave = (event: PointerEvent) => { if (event.relatedTarget === null) reset() }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', move, { passive: true })
    window.addEventListener('pointerout', leave)
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', reset)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', move)
      window.removeEventListener('pointerout', leave)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', reset)
    }
  }, [hero, active])
  return inside
}
