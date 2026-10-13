'use client'

import { useEffect, useRef, useState } from 'react'
import FibreArc, { fibreArcBaseline } from '../originkit/ui/fibre-arc'
import { useFibrePalette } from '../originkit/useFibrePalette'
import { useSystemTheme } from '../../engine/useSystemTheme'
import { createFrameLoop } from '../../engine/frameLoop'

const APEX = [0, 0] as const
const BUNDLE = { curve: 20, spread: 22, thickness: 90, comb: 110 }

/** The existing Fibre Arc, anchored to the live hand poses rather than another fan layout. */
export default function HomeDockFibre({ hero, active }: { hero: HTMLElement | null; active: boolean }) {
  const host = useRef<HTMLLIElement>(null)
  const [mounted, setMounted] = useState(false)
  const [reduced, setReduced] = useState(true)
  const palette = useFibrePalette(host, useSystemTheme())
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update(); media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => { if (active) setMounted(true) }, [active])
  useEffect(() => {
    const element = host.current
    const parent = element?.parentElement
    const left = hero?.querySelector<HTMLElement>('.home-hero-hand--left .home-hero-hand-sprite')
    const right = hero?.querySelector<HTMLElement>('.home-hero-hand--right .home-hero-hand-sprite')
    if (!element || !parent || !left || !right || !active) return
    const place = () => {
      const bounds = parent.getBoundingClientRect()
      const scale = bounds.width / parent.clientWidth
      if (!scale || !Number.isFinite(scale)) return
      const l = left.getBoundingClientRect(), r = right.getBoundingClientRect()
      const x = (l.left + l.width * 0.62 - bounds.left) / scale
      const y = (l.top + l.height * 0.38 - bounds.top) / scale
      const dx = (r.left + r.width * 0.38 - bounds.left) / scale - x
      const dy = (r.top + r.height * 0.38 - bounds.top) / scale - y
      if (dx <= 0) return
      const width = Math.hypot(dx, dy), height = Math.max(120, width * 0.5)
      const baseline = fibreArcBaseline(0, width, height, BUNDLE.curve, APEX)
      Object.assign(element.style, { left: `${x}px`, top: `${y - baseline}px`, width: `${width}px`, height: `${height}px`,
        transformOrigin: `0 ${baseline}px`, transform: `rotate(${Math.atan2(dy, dx)}rad)` })
    }
    const loop = createFrameLoop({ frame: place, keepRunning: () => !reduced, isParked: () => document.hidden })
    const update = () => { if (document.hidden) loop.park(); else loop.renderOnce() }
    const observer = new ResizeObserver(update)
    observer.observe(parent); observer.observe(left); observer.observe(right)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('scroll', update, { passive: true })
    place(); loop.renderOnce()
    return () => { loop.dispose(); observer.disconnect(); document.removeEventListener('visibilitychange', update); window.removeEventListener('scroll', update) }
  }, [hero, active, reduced])
  return <li ref={host} className="home-hero-fibre" aria-hidden="true" hidden={!active}>
    {mounted && <FibreArc transparent active={active} reducedMotion={reduced} globalPointer
      apex={APEX} bundle={BUNDLE} direction={0} speed={30} density={22} hover={75} reach={24} {...palette}
      style={{ minWidth: 0, minHeight: 0, width: '100%', height: '100%' }} />}
  </li>
}
