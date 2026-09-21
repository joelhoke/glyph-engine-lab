'use client'

import { useEffect, useRef, useState } from 'react'
import type { HomeHand } from '../../content/home'
import HomeSpriteFrame, { decodeSpriteFrame } from './HomeSpriteFrame'
import { createFrameLoop } from '../../engine/frameLoop'
import { handIsFlexed, handPose, stepHandMotion, type HandPoint } from './handMotion'
import { isHeroParallaxActive } from './useHeroParallax'

/** Desktop wrists follow their held objects, with the original sprite
 * movement. Mobile keeps separate fixed anchors and a still, open pose. */
export default function HomeSpriteHand({ hand, side, active }: {
  hand: HomeHand
  side: 'left' | 'right'
  active: boolean
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<HTMLSpanElement>(null)
  const [flexed, setFlexed] = useState(false)

  useEffect(() => {
    const anchor = anchorRef.current, sprite = spriteRef.current
    const hero = anchor?.closest<HTMLElement>('.home-hero')
    if (!anchor || !sprite || !hero) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let disposed = false, poseReady = false, poseLoading = false, flex = false
    let current = { x: 0, y: 0, tilt: 0 }, target = { ...current }
    let lastPointer: HandPoint | null = null, lastTime = 0
    const enabled = () => isHeroParallaxActive({
      enabled: active && !document.hidden && anchor.getClientRects().length > 0,
      fineHoverPointer: fine.matches,
      reducedMotion: reduced.matches,
      viewportWidth: window.innerWidth,
    })
    const paint = () => {
      sprite.style.setProperty('--hand-x', `${current.x}px`)
      sprite.style.setProperty('--hand-y', `${current.y}px`)
      sprite.style.setProperty('--hand-tilt', `${current.tilt}deg`)
    }
    const loop = createFrameLoop({
      isParked: () => !enabled(),
      keepRunning: () => current.x !== target.x || current.y !== target.y || current.tilt !== target.tilt,
      frame: now => {
        const delta = lastTime ? now - lastTime : 16
        lastTime = now
        current = {
          x: stepHandMotion(current.x, target.x, delta),
          y: stepHandMotion(current.y, target.y, delta),
          tilt: stepHandMotion(current.tilt, target.tilt, delta),
        }
        paint()
      },
    })
    const update = (point: HandPoint | null) => {
      const bounds = hero.getBoundingClientRect()
      const inside = point && point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom
      lastPointer = inside && enabled() ? point : null
      const rect = anchor.getBoundingClientRect()
      const center = { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 }
      const radius = Math.max(80, Math.min(180, rect.width * 0.9))
      const head = hero.querySelector('.home-hero-portrait')?.getBoundingClientRect()
      const gaze = lastPointer && head ? {
        x: Math.max(-1, Math.min(1, (lastPointer.x - head.left - head.width * 0.5) / Math.max(180, window.innerWidth * 0.4))),
        y: Math.max(-1, Math.min(1, (lastPointer.y - head.top - head.height * 0.52) / Math.max(180, window.innerHeight * 0.4))),
      } : { x: 0, y: 0 }
      target = handPose(lastPointer, center, gaze, radius, side === 'left' ? -1 : 1)
      if (side === 'left' && lastPointer) target.x -= (anchor.parentElement?.clientWidth ?? 0) * 0.1
      const nextFlex = poseReady && handIsFlexed(lastPointer, center, radius, flex)
      if (nextFlex !== flex) { flex = nextFlex; setFlexed(flex) }
      if (!enabled()) {
        loop.park()
        current = target = { x: 0, y: 0, tilt: 0 }
        paint()
      } else {
        if (!loop.isPending()) lastTime = 0
        loop.renderOnce()
      }
    }
    const preload = () => {
      if (!enabled() || !hand.flexSrc || poseLoading) return
      poseLoading = true
      const sources = [hand.flexSrc, hand.watercolorFlexSrc].filter((src): src is string => Boolean(src))
      void Promise.all(sources.map(decodeSpriteFrame)).then(() => {
        if (!disposed) { poseReady = true; update(lastPointer) }
      }).catch(() => { /* Keep the open hand if an optional pose cannot load. */ })
    }
    const move = (event: PointerEvent) => {
      preload()
      update(event.pointerType === 'touch' ? null : { x: event.clientX, y: event.clientY })
    }
    const reset = () => update(null)
    const leave = (event: PointerEvent) => { if (event.relatedTarget === null) reset() }
    const measure = () => update(lastPointer)
    const preferences = () => { reset(); preload() }
    const observer = new ResizeObserver(measure)
    observer.observe(anchor)
    setFlexed(false)
    reset()
    preload()
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerout', leave)
    window.addEventListener('blur', reset)
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    document.addEventListener('visibilitychange', reset)
    fine.addEventListener('change', preferences)
    reduced.addEventListener('change', preferences)
    return () => {
      disposed = true
      loop.dispose()
      observer.disconnect()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerout', leave)
      window.removeEventListener('blur', reset)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      document.removeEventListener('visibilitychange', reset)
      fine.removeEventListener('change', preferences)
      reduced.removeEventListener('change', preferences)
      current = { x: 0, y: 0, tilt: 0 }
      paint()
    }
  }, [active, hand.flexSrc, hand.watercolorFlexSrc, side])

  return <div ref={anchorRef} className={`home-hero-hand home-hero-hand--${side}`} aria-hidden="true">
    <HomeSpriteFrame ref={spriteRef} className="home-hero-hand-sprite" src={flexed && hand.flexSrc ? hand.flexSrc : hand.src}
      watercolorSrc={flexed ? hand.watercolorFlexSrc : hand.watercolorSrc}
      width={hand.width} height={hand.height} alt="" data-pose={flexed ? 'flex' : 'open'} />
  </div>
}
