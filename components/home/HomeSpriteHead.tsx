'use client'

import { useEffect, useRef, useState } from 'react'
import HomeSpriteFrame, { decodeSpriteFrame } from './HomeSpriteFrame'
import type { HomePortrait } from '../../content/home'
import { SPRITE_DIRECTIONS, spriteDirection, type SpriteDirection } from './spriteTracking'

/** Reuse the sample's nine head directions. Existing hero parallax owns
 *  translation; this component only swaps decoded frames when gaze changes. */
export default function HomeSpriteHead({ portrait, active }: { portrait: HomePortrait; active: boolean }) {
  const imageRef = useRef<HTMLSpanElement>(null)
  const [direction, setDirection] = useState<SpriteDirection>('center')
  const decoded = useRef(new Set<SpriteDirection>(['center']))
  const loading = useRef(false)

  useEffect(() => {
    const image = imageRef.current
    if (!image || !portrait.spritePath) return
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const desktop = window.matchMedia('(min-width: 768px)')
    let disposed = false
    let current: SpriteDirection = 'center'
    const canTrack = () => active && !document.hidden && pointer.matches && !reduced.matches && desktop.matches
    const reset = () => { current = 'center'; setDirection('center') }
    const preload = () => {
      if (loading.current || !canTrack()) return
      loading.current = true
      for (const name of SPRITE_DIRECTIONS) {
        const paths = [portrait.spritePath, portrait.watercolorPath].filter(Boolean)
        void Promise.all(paths.map(path => decodeSpriteFrame(`${path}/head-${name}.png`))).then(() => {
          if (!disposed) decoded.current.add(name)
        }).catch(() => { /* Keep the current matched pair if either angle fails. */ })
      }
    }
    const move = (event: PointerEvent) => {
      if (!canTrack() || event.pointerType === 'touch') return
      const hero = image.closest('.home-hero')
      const bounds = hero?.getBoundingClientRect()
      if (!bounds || event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) { reset(); return }
      preload()
      const rect = image.getBoundingClientRect()
      const x = (event.clientX - rect.left - rect.width * 0.5) / Math.max(180, window.innerWidth * 0.4)
      const y = (event.clientY - rect.top - rect.height * 0.46) / Math.max(180, window.innerHeight * 0.4)
      const next = spriteDirection(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)), current)
      if (next !== current && decoded.current.has(next)) { current = next; setDirection(next) }
    }
    const leave = (event: PointerEvent) => { if (event.relatedTarget === null) reset() }
    const preference = () => { reset(); preload() }
    reset()
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerout', leave)
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', reset)
    pointer.addEventListener('change', preference)
    reduced.addEventListener('change', preference)
    desktop.addEventListener('change', preference)
    return () => {
      disposed = true
      loading.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerout', leave)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', reset)
      pointer.removeEventListener('change', preference)
      reduced.removeEventListener('change', preference)
      desktop.removeEventListener('change', preference)
    }
  }, [active, portrait.spritePath, portrait.watercolorPath])

  return <HomeSpriteFrame
    ref={imageRef}
    className="home-hero-portrait home-hero-sprite-head"
    src={portrait.spritePath && direction !== 'center' ? `${portrait.spritePath}/head-${direction}.png` : portrait.src}
    watercolorSrc={portrait.watercolorPath ? `${portrait.watercolorPath}/head-${direction}.png` : undefined}
    alt={portrait.alt}
    width={portrait.width}
    height={portrait.height}
    fetchPriority="high"
    data-direction={direction}
  />
}
