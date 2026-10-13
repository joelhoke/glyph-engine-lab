'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { FAMILY_STICKERS } from '../../content/about'
import { StickerSurface, stickerMaterial, visibleBounds } from '../home/light-study/sticker'
import { createStudioRig } from '../lighting/studioRig'
import type { PageIllumination } from '../home/light-study/illumination'
import { createFrameLoop } from '../../engine/frameLoop'
import styles from '../../app/about/about.module.css'

export default function FamilyStickers({ reducedMotion, active }: { reducedMotion: boolean; active: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const wake = useRef<(() => void) | null>(null)
  const state = useRef({ active, reducedMotion }); state.current = { active, reducedMotion }
  const [index, setIndex] = useState(0)
  const [peeled, setPeeled] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { if (active) wake.current?.() }, [active])
  const source = FAMILY_STICKERS[index]
  useEffect(() => {
    const mount = host.current
    if (!mount) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }) } catch { setFailed(true); return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); mount.append(renderer.domElement)
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-3, 3, 2.2, -2.2, .1, 30)
    camera.position.set(0, 0, 10)
    const rig = createStudioRig(THREE, scene)
    const page = mount.closest<HTMLElement>('[data-about-desktop]')
    let illumination: PageIllumination = [], lastLight = 0, drawnProgress = -1
    let rect = mount.getBoundingClientRect()
    let mesh: THREE.Mesh | null = null, surface: StickerSurface | null = null, texture: THREE.Texture | null = null
    let disposed = false, progress = 0, target = 0, previous = 0, done: (() => void) | null = null
    let dragging = false, origin = { x: 0, y: 0 }, startProgress = 0
    const loop = createFrameLoop({
      isParked: () => document.hidden || !state.current.active,
      keepRunning: () => Math.abs(progress - target) > .001,
      frame: now => {
        const dt = previous ? Math.min(now - previous, 50) : 16; previous = now
        if (!dragging) progress = state.current.reducedMotion ? target : progress + (target - progress) * (1 - Math.exp(-dt / 115))
        if (Math.abs(progress - target) < .001) progress = target
        if (mesh && surface) {
          mesh.visible = progress < 1
          if (drawnProgress !== progress) { surface.updatePeel(progress); drawnProgress = progress }
          mesh.rotation.z = -.055
          mesh.updateMatrixWorld(); camera.updateMatrixWorld(); surface.sort(camera, mesh)
        }
        rig.apply(illumination, { left: 0, top: 0, width: innerWidth, height: innerHeight }, rect)
        renderer.render(scene, camera)
        if (progress === target && done) { const callback = done; done = null; callback() }
      },
    })
    const draw = () => { previous = 0; loop.renderOnce() }
    wake.current = draw
    const finish = () => {
      if (FAMILY_STICKERS.length > 1) setIndex(value => (value + 1) % FAMILY_STICKERS.length)
      else setPeeled(true)
    }
    const image = new Image()
    image.onload = () => {
      if (disposed) return
      const width = 4, height = width * image.height / image.width
      const sample = document.createElement('canvas'); sample.width = image.width; sample.height = image.height
      const ctx = sample.getContext('2d')!; ctx.drawImage(image, 0, 0)
      const bounds = visibleBounds(ctx.getImageData(0, 0, image.width, image.height).data, image.width, image.height, width, height)
      texture = new THREE.Texture(image); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true
      surface = new StickerSurface(width, height, bounds)
      mesh = new THREE.Mesh(surface.geometry, stickerMaterial(texture)); scene.add(mesh)
      setReady(true); setPeeled(false); draw()
    }
    image.onerror = () => { if (!disposed) setFailed(true) }
    image.src = source.src
    const resize = () => {
      rect = mount.getBoundingClientRect()
      const w = mount.clientWidth, h = Math.max(1, mount.clientHeight), halfHeight = Math.max(2.1, 2.6 * h / Math.max(w, 1))
      renderer.setSize(w, h); camera.top = halfHeight; camera.bottom = -halfHeight
      camera.right = halfHeight * w / h; camera.left = -camera.right; camera.updateProjectionMatrix(); draw()
    }
    const observer = new ResizeObserver(resize); observer.observe(mount)
    const down = (event: PointerEvent) => {
      if (!surface || done || progress === 1) return
      dragging = true; origin = { x: event.clientX, y: event.clientY }; startProgress = progress
      mount.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!dragging) return
      progress = target = THREE.MathUtils.clamp(startProgress + (origin.x - event.clientX + origin.y - event.clientY) / Math.max(160, mount.clientWidth * .55), 0, 1)
      draw()
    }
    const up = () => { if (!dragging) return; dragging = false; target = progress > .48 ? 1 : 0; if (target === 1) done = finish; draw() }
    const cancel = () => { dragging = false; target = 0; done = null; draw() }
    const visibility = () => document.hidden ? loop.park() : draw()
    mount.addEventListener('pointerdown', down); mount.addEventListener('pointermove', move)
    mount.addEventListener('pointerup', up); mount.addEventListener('pointercancel', cancel)
    document.addEventListener('visibilitychange', visibility)
    const illuminate = (event: Event) => {
      illumination = (event as CustomEvent<PageIllumination>).detail
      if (performance.now() - lastLight < 1000 / 15) return
      lastLight = performance.now(); draw()
    }
    page?.addEventListener('study-illumination', illuminate)
    resize()
    return () => {
      disposed = true; wake.current = null; loop.dispose(); observer.disconnect();
      mount.removeEventListener('pointerdown', down); mount.removeEventListener('pointermove', move)
      mount.removeEventListener('pointerup', up); mount.removeEventListener('pointercancel', cancel)
      document.removeEventListener('visibilitychange', visibility)
      page?.removeEventListener('study-illumination', illuminate)
      surface?.geometry.dispose(); if (mesh) (mesh.material as THREE.Material).dispose(); texture?.dispose()
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
    }
  }, [source])
  return <div className={styles.stickerCarousel} role="region" aria-roledescription="carousel" aria-label="Family moments">
    <div ref={host} className={styles.stickerStage} role="img" aria-label={peeled ? 'Sticker peeled away' : source.alt}>
      {(!ready || failed) && !peeled && <img className={styles.stickerFallback} src={source.src} alt="" />}
      {peeled && <p className={styles.visuallyHidden}>More memories to come.</p>}
    </div>
    <p className={styles.visuallyHidden} aria-live="polite">{peeled ? 'Peeled away' : `${index + 1} / ${FAMILY_STICKERS.length}`}</p>
    <p className={styles.visuallyHidden}>Drag the sticker from its lower-right corner toward the upper left.</p>
  </div>
}
