'use client'

import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { createFrameLoop, type FrameLoop } from '../../engine/frameLoop'
import { createStudioRig } from '../lighting/studioRig'
import type { PageIllumination } from '../home/light-study/illumination'
import { createInterestModel, type ObjectId } from './interestModels'
import { createDockPreview } from './dockPreview'
import type { Comic } from '../../lib/comics.mjs'
import type { InterestId } from '../../content/about'
import styles from '../../app/about/about.module.css'

type Props = { host: RefObject<HTMLDivElement | null>; comics: Comic[]; highlighted: InterestId | null; selected: InterestId | null;
  active: boolean; reducedMotion: boolean; onReady: () => void; onUnavailable: () => void }

/** One WebGL context for all interest objects. DOM buttons own input and focus. */
export default function InterestObjects(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const latest = useRef(props)
  const loopRef = useRef<FrameLoop | null>(null)
  const snapshotRef = useRef<(() => void) | null>(null)
  const illuminationRef = useRef<PageIllumination>([])
  useEffect(() => {
    latest.current = props
    if (props.active) loopRef.current?.resume()
    else { loopRef.current?.park(); if (props.selected) snapshotRef.current?.() }
  }, [props])
  const coverKey = props.comics.slice(0, 3).map(comic => `${comic.url}:${comic.cover}`).join('|')

  useEffect(() => {
    const element = canvas.current
    const host = props.host.current
    if (!element || !host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas: element, alpha: true, antialias: true, preserveDrawingBuffer: false })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.15
      renderer.autoClear = false
    } catch { latest.current.onUnavailable(); return }
    let bounds = host.getBoundingClientRect()
    let pointer = { x: 0, y: 0 }
    let settling = false
    let disposed = false
    let failed = false
    const createSlot = (slot: HTMLElement) => {
      const id = slot.dataset.interestObject as ObjectId
      const scene = new THREE.Scene()
      const preview = createDockPreview(slot.querySelector<HTMLImageElement>('[data-dock-preview]'), () => loopRef.current?.renderOnce())
      const invalidate = () => { preview.dirty = true; if (latest.current.active) loopRef.current?.renderOnce(); else if (latest.current.selected) snapshotRef.current?.() }
      const model = createInterestModel(id, latest.current.comics, invalidate)
      scene.add(model.object)
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
      camera.position.set(0, 0, 4.7)
      const lighting = createStudioRig(THREE, scene)
      return { id, slot, scene, model, camera, lighting, preview, rect: slot.getBoundingClientRect(), amount: 0, x: 0, y: 0 }
    }
    const slots = Array.from(host.querySelectorAll<HTMLElement>('[data-interest-object]')).map(createSlot)
    let previous = 0, announcedReady = false, rectsDirty = true, lastLightPaint = 0
    const announceReady = () => {
      if (!announcedReady) { announcedReady = true; latest.current.onReady() }
    }
    const frame = (now: number) => {
      if (disposed) return
      const state = latest.current
      const delta = Math.min(64, now - previous || 16)
      const damping = state.reducedMotion ? 1 : 1 - Math.exp(-delta / 110)
      previous = now; settling = false
      renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true)
      const ordered = [...slots].sort((a, b) => Number(a.slot.parentElement?.dataset.weight ?? 0) - Number(b.slot.parentElement?.dataset.weight ?? 0))
      for (const item of ordered) {
        if (rectsDirty) {
          const rect = item.slot.getBoundingClientRect()
          // A PNG captured before responsive layout settled may be clipped or empty.
          // Rebuild it at the new size instead of retaining an invisible resting icon.
          if (rect.width !== item.rect.width || rect.height !== item.rect.height) item.preview.dirty = true
          item.rect = rect
        }
        const { model, camera, scene, rect, id } = item
        const highlighted = id === (state.highlighted ?? state.selected)
        item.amount = id === state.selected ? 1 : Number(item.slot.parentElement?.dataset.weight ?? 0)
        const resting = item.amount <= 0.005
        item.preview.show(resting && item.preview.ready && !item.preview.dirty)
        // Cached PNGs follow the existing DOM slot along the arc. Only a hovered
        // or selected item (or an invalidated preview) uses the live renderer.
        if (resting && item.preview.ready && !item.preview.dirty) continue
        // Resting icons use the shared neutral studio light so the blue finish
        // stays consistent and doesn't require continuous background redraws.
        item.lighting.apply(item.amount > 0.005 ? illuminationRef.current : [], bounds, rect)
        const targetX = highlighted && !state.reducedMotion ? pointer.y * 0.06 : 0
        const targetY = highlighted && !state.reducedMotion ? pointer.x * 0.08 : 0
        item.x += (targetX - item.x) * damping; item.y += (targetY - item.y) * damping
        if (Math.abs(targetX - item.x) + Math.abs(targetY - item.y) > 0.002) settling = true
        model.object.rotation.set(model.pose[0] + item.x - item.amount * 0.025,
          model.pose[1] + item.y + item.amount * 0.035, model.pose[2])
        model.object.scale.setScalar(1)
        const activeLight = illuminationRef.current.find(light => light.intensity > 0) ?? illuminationRef.current[0]
        if (activeLight) model.setLightColor?.(activeLight.color)
        model.update(item.amount)
        if (model.animate?.(delta / 1000, item.amount, state.active && !state.reducedMotion)) settling = true
        item.slot.dataset.modelReady = String(model.object.children.length > 0)
        const w = rect.width, h = rect.height
        if (!w || !h) continue
        camera.aspect = w / h; camera.updateProjectionMatrix()
        renderer.setViewport(rect.left - bounds.left, bounds.height - (rect.bottom - bounds.top), w, h)
        renderer.setScissor(rect.left - bounds.left, bounds.height - (rect.bottom - bounds.top), w, h)
        renderer.clearDepth()
        renderer.render(scene, camera)
        if (resting && item.preview.dirty && model.object.children.length) {
          item.preview.capture(element, { left: rect.left - bounds.left, top: rect.top - bounds.top, width: w, height: h }, renderer.getPixelRatio())
        }
      }
      rectsDirty = false
      announceReady()
    }
    const loop = createFrameLoop({ frame, keepRunning: () => settling && !latest.current.reducedMotion,
      isParked: () => disposed || failed || document.hidden || !latest.current.active })
    loopRef.current = loop
    snapshotRef.current = () => { if (!document.hidden && !failed) frame(performance.now()) }
    const theme = matchMedia('(prefers-color-scheme: light)')
    const syncTheme = () => {
      const blue = getComputedStyle(host).getPropertyValue('--color-hero-blue-light').trim() || '#8abaff'
      slots.forEach(item => { item.model.setTheme?.(blue, theme.matches ? 'light' : 'dark'); item.preview.dirty = true })
      loop.renderOnce()
    }
    theme.addEventListener('change', syncTheme)
    syncTheme()
    const resize = () => {
      bounds = host.getBoundingClientRect()
      renderer.setSize(bounds.width, bounds.height, false)
      rectsDirty = true
      loop.renderOnce()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host); slots.forEach(item => observer.observe(item.slot))
    const move = (event: globalThis.PointerEvent) => {
      if (latest.current.reducedMotion || event.pointerType !== 'mouse' || !latest.current.highlighted) return
      const item = slots.find(item => item.id === latest.current.highlighted)
      if (!item) return
      pointer = { x: Math.max(-1, Math.min(1, (event.clientX - item.rect.left) / item.rect.width * 2 - 1)),
        y: Math.max(-1, Math.min(1, (event.clientY - item.rect.top) / item.rect.height * 2 - 1)) }
      loop.renderOnce()
    }
    const visibility = () => { if (document.hidden) loop.park(); else { previous = 0; loop.resume() } }
    const lost = (event: Event) => { event.preventDefault(); failed = true; loop.park(); latest.current.onUnavailable() }
    const layout = () => {
      rectsDirty = true
      if (latest.current.active) loop.renderOnce()
      else if (latest.current.selected) snapshotRef.current?.()
    }
    const illuminate = (event: Event) => {
      illuminationRef.current = (event as CustomEvent<PageIllumination>).detail
      // Source color transitions take ten seconds; active previews need at most
      // 15 lighting updates/sec. Hover motion still animates at display speed.
      const now = performance.now()
      if (latest.current.highlighted && now - lastLightPaint >= 1000 / 15) { lastLightPaint = now; loop.renderOnce() }
    }
    host.addEventListener('study-illumination', illuminate)
    host.addEventListener('interest-layout', layout)
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('visibilitychange', visibility)
    element.addEventListener('webglcontextlost', lost)
    resize()
    return () => {
      disposed = true; loop.dispose(); loopRef.current = null; snapshotRef.current = null
      theme.removeEventListener('change', syncTheme)
      host.removeEventListener('study-illumination', illuminate)
      host.removeEventListener('interest-layout', layout)
      observer.disconnect(); window.removeEventListener('pointermove', move)
      document.removeEventListener('visibilitychange', visibility); element.removeEventListener('webglcontextlost', lost)
      slots.forEach(item => { item.preview.dispose(); item.model.dispose() }); renderer.dispose()
    }
  }, [coverKey, props.host])
  return <canvas ref={canvas} className={styles.objectCanvas} aria-hidden="true" />
}
