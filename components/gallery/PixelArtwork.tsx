'use client'

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import JHMark from '../JHMark'
import { GALLERY_PALETTES, GALLERY_ARTWORK_RENDERER } from '../../content/galleryArtwork'
import { GLYPH_BASE_POINT_SIZE, resolveGlyphLineHeight } from '../../engine/glyphSize'
import { APPROVED_PLAYGROUND_DEFAULTS } from '../../engine/playgroundConfig'
import { createFrameLoop } from '../../engine/frameLoop'
import { stepGlyphParticle } from '../../engine/glyphPhysics'
import { applyRadialImpulse } from '../../engine/impulse'
import { RIPPLE_DEFAULTS, createRippleStore, spawnRipple, applyRippleForces } from '../../engine/ripple'
import { seededRandom, unprojectTilePoint } from './galleryGeometry'
import type { GalleryArtwork } from './galleryTypes'
import styles from './sphere.module.css'

export default memo(function PixelArtwork({ artwork, active = false, interactive = false }: {
  artwork: GalleryArtwork; active?: boolean; interactive?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<HTMLSpanElement>(null)
  const [near, setNear] = useState(false)
  const [warmed, setWarmed] = useState(false)
  const activeRef = useRef(active), nearRef = useRef(near)
  const syncPlayback = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    activeRef.current = active; nearRef.current = near
    syncPlayback.current?.()
  }, [active, near])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new IntersectionObserver(([entry]) => {
      setNear(entry.isIntersecting)
      if (entry.isIntersecting) setWarmed(true)
    }, { rootMargin: '180px' })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])
  const palette = GALLERY_PALETTES[artwork.palette % GALLERY_PALETTES.length]
  const mesh = useMemo(() => {
    const random = seededRandom(artwork.seed)
    // Use an unmodified palette swatch; the seed keeps each tile's choice stable.
    const monogram = palette.colors[artwork.seed % palette.colors.length]
    return { monogram, size: 24 + Math.floor(random() * 24), points: palette.colors.map(hex => ({
      x: random(), y: random(), phase: random() * Math.PI * 2, speed: 0.2 + random() * 0.25,
      color: [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)),
    })) }
  }, [artwork.seed, palette])
  useLayoutEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    // Prewarm near the viewport, then retain the rendered frame until this
    // virtual tile unmounts. Pausing must never clear or reseed its canvas.
    if (!warmed) return
    const canAnimate = () => activeRef.current && nearRef.current && !document.hidden
    const ascii = GALLERY_ARTWORK_RENDERER === 'ascii'
    const cols = mesh.size, rows = Math.round(cols * 0.75)
    const cell = resolveGlyphLineHeight(GLYPH_BASE_POINT_SIZE)
    canvas.width = ascii ? cols * cell : cols; canvas.height = ascii ? rows * cell : rows
    const field = document.createElement('canvas')
    field.width = cols; field.height = rows
    const fieldContext = field.getContext('2d')!
    const frame = fieldContext.createImageData(cols, rows)
    const glyphs = '.:+*=#@'
    const luminance = (color: number[]) => color[0] * .2126 + color[1] * .7152 + color[2] * .0722
    const sorted = [...mesh.points].sort((a, b) => luminance(a.color) - luminance(b.color))
    const particles = Array.from({ length: cols * rows }, (_, i) => {
      const x = (i % cols + .5) * cell, y = (Math.floor(i / cols) + .5) * cell
      return { x, y, tx: x, ty: y, vx: 0, vy: 0 }
    })
    const ripples = createRippleStore(RIPPLE_DEFAULTS.maxConcurrent)
    const pointer = { x: -9999, y: -9999, active: false, influence: 0 }
    const velocity = { x: 0, y: 0, lastX: 0, lastY: 0 }
    let last = 0, lastFrame = 0, elapsed = 0, fadeUntil = 0, held = false, dragEase = 0
    const host = hostRef.current!
    const locate = (event: PointerEvent) => {
      const tile = host.closest<HTMLElement>('[data-tile-key]'), placement = tile?.parentElement
      if (tile && placement?.parentElement) {
        const bounds = placement.parentElement.getBoundingClientRect()
        const transform = new DOMMatrix(getComputedStyle(placement).transform)
        const point = unprojectTilePoint(Array.from(transform.toFloat64Array()),
          event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2)
        return { x: point.x / tile.offsetWidth * canvas.width, y: point.y / tile.offsetHeight * canvas.height }
      }
      const bounds = canvas.getBoundingClientRect()
      return { x: (event.clientX - bounds.left) / bounds.width * canvas.width,
        y: (event.clientY - bounds.top) / bounds.height * canvas.height }
    }
    const move = (event: PointerEvent) => {
      if (!canAnimate() || (event.pointerType === 'touch' && !interactive)) return
      const point = locate(event)
      if (!pointer.active) { velocity.lastX = point.x; velocity.lastY = point.y; velocity.x = 0; velocity.y = 0 }
      Object.assign(pointer, point, { active: true, influence: 1 }); fadeUntil = 0
    }
    const impact = (x: number, y: number) => {
      if (!canAnimate() || !ascii) return
      spawnRipple(ripples, x, y, performance.now(), 1, velocity.x, velocity.y, RIPPLE_DEFAULTS)
      applyRadialImpulse(particles, x, y, 200, 10 * .35)
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !canAnimate()) return
      move(event)
      held = true
      if (interactive) {
        host.setPointerCapture(event.pointerId)
        impact(pointer.x, pointer.y)
      }
      // Thumbnail press belongs to gallery navigation; its open study owns click/drag ripples.
    }
    const up = (event: PointerEvent) => {
      held = false
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
    }
    const leave = () => { pointer.active = false; held = false; fadeUntil = performance.now() + 350 }
    const key = (event: KeyboardEvent) => {
      if (interactive && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault(); impact(canvas.width / 2, canvas.height / 2)
      }
    }
    host.addEventListener('pointerenter', move); host.addEventListener('pointermove', move)
    host.addEventListener('pointerdown', down); host.addEventListener('pointerup', up)
    host.addEventListener('pointercancel', leave); host.addEventListener('pointerleave', leave)
    host.addEventListener('keydown', key)
    const draw = (time: number) => {
      // Color sampling stays at 25fps; shared glyph physics runs at the hero's frame cadence.
      const sample = time === 0 || time - last >= 40
      if (sample) last = time
      if (time && lastFrame) elapsed += Math.min(40, time - lastFrame)
      const t = elapsed / 1000
      const points = mesh.points.map(p => ({ ...p, x: p.x + Math.sin(t * p.speed + p.phase) * 0.24,
        y: p.y + Math.cos(t * p.speed + p.phase) * 0.24 }))
      if (sample) for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        let sum = 0; const color = [0, 0, 0]
        for (const p of points) {
          const d = (x / cols - p.x) ** 2 + (y / rows - p.y) ** 2
          const weight = 1 / (0.008 + d * d)
          sum += weight; for (let c = 0; c < 3; c++) color[c] += p.color[c] * weight
        }
        const i = (y * cols + x) * 4
        for (let c = 0; c < 3; c++) frame.data[i + c] = color[c] / sum
        frame.data[i + 3] = 255
      }
      if (!ascii) ctx.putImageData(frame, 0, 0)
      else {
        if (sample) fieldContext.putImageData(frame, 0, 0)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(field, 0, 0, canvas.width, canvas.height)
        ctx.font = `400 ${GLYPH_BASE_POINT_SIZE}px ${APPROVED_PLAYGROUND_DEFAULTS.glyphFont}`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        if (canAnimate() && time) {
          const dt = Math.max(1, time - (lastFrame || time))
          velocity.x += (((pointer.x - velocity.lastX) / dt * 1000) - velocity.x) * .35
          velocity.y += (((pointer.y - velocity.lastY) / dt * 1000) - velocity.y) * .35
          velocity.lastX = pointer.x; velocity.lastY = pointer.y
          dragEase += ((held ? 1 : 0) - dragEase) * (1 - Math.exp(-dt / (held ? 200 : 250)))
          applyRippleForces(ripples, particles, time, RIPPLE_DEFAULTS)
          const influence = pointer.active ? 1 : Math.max(0, (fadeUntil - time) / 350)
          const currentPointer = { ...pointer, active: influence > 0, influence }
          const radius = 225 * (1 + .6 * dragEase)
          for (const particle of particles) stepGlyphParticle(particle, currentPointer, radius, .48)
        }
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4
          const luma = luminance([frame.data[i], frame.data[i + 1], frame.data[i + 2]])
          const low = sorted[0].color, high = sorted[sorted.length - 1].color
          const ink = Math.abs(luma - luminance(low)) > Math.abs(luma - luminance(high)) ? low : high
          // Palette-only ink; density follows the moving field rather than flickering randomly.
          ctx.fillStyle = `rgba(${ink.join(',')}, .72)`
          const density = Math.min(glyphs.length - 1, Math.floor(luma / 256 * glyphs.length))
          const particle = particles[y * cols + x]
          ctx.fillText(glyphs[density], particle.x, particle.y)
        }
      }
      lastFrame = time
    }
    const loop = createFrameLoop({ frame: draw, isParked: () => !canAnimate(), keepRunning: canAnimate })
    const sync = () => {
      // Exclude paused time from mesh flow and pointer velocity calculations.
      lastFrame = 0
      if (canAnimate()) loop.resume()
      else {
        loop.park(); pointer.active = false; held = false; fadeUntil = 0
        velocity.x = 0; velocity.y = 0
      }
    }
    syncPlayback.current = sync
    draw(0)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      syncPlayback.current = null
      loop.dispose(); document.removeEventListener('visibilitychange', sync)
      host.removeEventListener('pointerenter', move); host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerdown', down); host.removeEventListener('pointerup', up)
      host.removeEventListener('pointercancel', leave); host.removeEventListener('pointerleave', leave)
      host.removeEventListener('keydown', key)
    }
  }, [mesh, warmed, interactive])
  return <span ref={hostRef} className={styles.artwork} data-renderer={GALLERY_ARTWORK_RENDERER}
    data-interactive={interactive} tabIndex={interactive ? 0 : undefined} role={interactive ? 'group' : undefined}
    aria-label={interactive ? 'Interactive glyph mesh. Move or drag to repel glyphs; click or press Space to ripple.' : undefined}
    style={{ background: palette.colors[0] }}>
    <canvas ref={canvasRef} aria-hidden="true" />
    <JHMark className={styles.monogram} aria-hidden="true" style={{ color: mesh.monogram }} />
  </span>
})
