'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createGalleryWheelInput, type Point } from './galleryGeometry'

export function useGalleryMotion(enabled: boolean, reduced: boolean) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1200, height: 720 })
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const [moving, setMoving] = useState(false)
  const current = useRef(position), target = useRef(position), velocity = useRef<Point>({ x: 0, y: 0 })
  const journey = useRef<{ from: Point; to: Point; start: number; duration: number } | null>(null)
  const frame = useRef(0), wake = useRef<() => void>(() => {})
  const mapWheel = useMemo(createGalleryWheelInput, [])
  const restore = useCallback((point: Point) => {
    journey.current = null
    current.current = { ...point }; target.current = { ...point }; velocity.current = { x: 0, y: 0 }
    setPosition({ ...point }); setMoving(false)
  }, [])
  const animateTo = useCallback((point: Point) => {
    const distance = Math.hypot(point.x - current.current.x, point.y - current.current.y)
    if (reduced || !enabled || distance < 0.1) { restore(point); return }
    velocity.current = { x: 0, y: 0 }
    journey.current = { from: { ...current.current }, to: { ...point }, start: performance.now(),
      duration: Math.min(1200, Math.max(500, Math.sqrt(distance) * 24)) }
    wake.current()
  }, [enabled, reduced, restore])
  const move = useCallback((x: number, y: number) => {
    if (journey.current) { journey.current = null; target.current = { ...current.current } }
    target.current = { x: target.current.x + x, y: target.current.y + y }
    velocity.current = { x: 0, y: 0 }; wake.current()
  }, [])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!enabled || !surface) return
    let drag: { id: number; x: number; y: number; lastX: number; lastY: number; time: number; moved: boolean } | null = null
    let suppressClick = false, lastTime = 0, settleAt = 0, focusAfter = false
    const measure = () => setSize({ width: surface.clientWidth, height: surface.clientHeight })
    const observer = new ResizeObserver(measure); observer.observe(surface); measure()
    const animate = (time: number) => {
      frame.current = 0
      const dt = Math.min(32, time - (lastTime || time - 16)); lastTime = time
      const trip = journey.current
      if (trip) {
        const progress = Math.max(0, Math.min(1, (time - trip.start) / trip.duration))
        // Smooth acceleration and deceleration, with an exact final position.
        const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10)
        current.current = progress === 1 ? { ...trip.to } : {
          x: trip.from.x + (trip.to.x - trip.from.x) * eased,
          y: trip.from.y + (trip.to.y - trip.from.y) * eased,
        }
        target.current = { ...current.current }
        if (progress === 1) journey.current = null
      } else {
        if (!drag) {
          target.current.x += velocity.current.x * dt; target.current.y += velocity.current.y * dt
          const friction = Math.exp(-dt / 180)
          velocity.current.x *= friction; velocity.current.y *= friction
        }
        const alpha = reduced || drag ? 1 : 1 - Math.exp(-dt / 55)
        current.current = { x: current.current.x + (target.current.x - current.current.x) * alpha,
          y: current.current.y + (target.current.y - current.current.y) * alpha }
      }
      setPosition({ ...current.current })
      const busy = Boolean(journey.current || drag?.moved) || Math.hypot(target.current.x - current.current.x, target.current.y - current.current.y) > 0.1
        || Math.hypot(velocity.current.x, velocity.current.y) > 0.005 || time < settleAt
      if (busy) frame.current = requestAnimationFrame(animate)
      else {
        velocity.current = { x: 0, y: 0 }; setMoving(false); lastTime = 0
        if (focusAfter) {
          focusAfter = false
          requestAnimationFrame(() => surface.querySelector<HTMLElement>('[data-nearest="true"]')?.focus({ preventScroll: true }))
        }
      }
    }
    wake.current = () => { setMoving(true); if (!frame.current) frame.current = requestAnimationFrame(animate) }
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0 || e.ctrlKey || e.metaKey) return
      journey.current = null
      suppressClick = false; velocity.current = { x: 0, y: 0 }; target.current = { ...current.current }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, time: e.timeStamp, moved: false }
    }
    const pointerMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return
      if (!drag.moved) { surface.setPointerCapture(e.pointerId); drag.moved = true; surface.dataset.dragging = 'true' }
      const dx = drag.lastX - e.clientX, dy = drag.lastY - e.clientY, dt = Math.max(8, e.timeStamp - drag.time)
      target.current = { x: target.current.x + dx, y: target.current.y + dy }
      velocity.current = { x: Math.max(-2.5, Math.min(2.5, dx / dt)), y: Math.max(-2.5, Math.min(2.5, dy / dt)) }
      drag.lastX = e.clientX; drag.lastY = e.clientY; drag.time = e.timeStamp; wake.current()
    }
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      suppressClick = drag.moved
      if (reduced || e.type === 'pointercancel' || e.timeStamp - drag.time > 80) velocity.current = { x: 0, y: 0 }
      const moved = drag.moved; drag = null; delete surface.dataset.dragging
      if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId)
      if (moved) wake.current()
    }
    const click = (e: MouseEvent) => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false } }
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || drag) return
      e.preventDefault()
      // Read the unit first: some browsers adapt delta values to this access.
      const mode = e.deltaMode
      const delta = mapWheel(e.deltaX, e.deltaY, mode, surface.clientHeight)
      settleAt = performance.now() + 100; move(delta.x, delta.y)
    }
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const direction: Record<string, Point> = { ArrowRight: { x: 240, y: 0 }, ArrowLeft: { x: -240, y: 0 },
        ArrowDown: { x: 0, y: 180 }, ArrowUp: { x: 0, y: -180 } }
      const delta = direction[e.key]
      if (!delta) return
      e.preventDefault(); surface.focus({ preventScroll: true }); focusAfter = true; move(delta.x, delta.y)
    }
    const stop = () => {
      journey.current = null
      drag = null; velocity.current = { x: 0, y: 0 }; target.current = { ...current.current }
      cancelAnimationFrame(frame.current); frame.current = 0; setMoving(false); delete surface.dataset.dragging
    }
    const visibility = () => { if (document.hidden) stop() }
    const preventNativeDrag = (e: DragEvent) => e.preventDefault()
    surface.addEventListener('pointerdown', down); surface.addEventListener('pointermove', pointerMove)
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    surface.addEventListener('click', click, true); surface.addEventListener('wheel', wheel, { passive: false })
    surface.addEventListener('keydown', key); surface.addEventListener('dragstart', preventNativeDrag)
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', visibility)
    return () => {
      observer.disconnect(); stop(); wake.current = () => {}
      surface.removeEventListener('pointerdown', down); surface.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      surface.removeEventListener('click', click, true); surface.removeEventListener('wheel', wheel)
      surface.removeEventListener('keydown', key); surface.removeEventListener('dragstart', preventNativeDrag)
      window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility)
    }
  }, [enabled, reduced, move, mapWheel])
  return { surfaceRef, size, position, moving, restore, animateTo, move }
}
