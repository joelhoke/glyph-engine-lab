import { BAND_LIMIT, H, W, hitBand, makeBand, renderScene, smoothStroke, translatePoints, type Band, type Point, type Scene } from './bands'
import type { PlaygroundEngine } from '../playground/usePlayground'

export type Brush = Pick<Band, 'colors' | 'width' | 'style' | 'glow' | 'speed' | 'amplitude'>
export type BandSettings = { scene: Scene; tool: 'move' | 'draw'; selected: string; brush: Brush }

type Stroke = { kind: 'draw'; pointer: number; band: Band; points: Point[] }
type Drag = { kind: 'move'; pointer: number; id: string; start: Point; offset: Point }
type SceneChange = (scene: Scene, selected: string, previous?: Pick<BandSettings, 'scene' | 'selected'>) => void

export function createBands(canvas: HTMLCanvasElement, initial: BandSettings, onChange: SceneChange): PlaygroundEngine<BandSettings> {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const underlay = document.createElement('canvas')
  let settings = initial
  let time = 0
  let dirty = true
  let gesture: Stroke | Drag | null = null

  function position(event: PointerEvent, rect: DOMRect): Point {
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height }
  }

  function captureUnderlay() {
    underlay.width = canvas.width
    underlay.height = canvas.height
    underlay.getContext('2d')?.drawImage(canvas, 0, 0)
  }

  function setCursor() {
    if (settings.tool === 'draw') canvas.style.cursor = settings.scene.bands.length >= BAND_LIMIT ? 'not-allowed' : 'crosshair'
    else canvas.style.cursor = gesture ? 'grabbing' : 'grab'
  }

  function down(event: PointerEvent) {
    if (event.button !== 0 || gesture) return
    const start = position(event, canvas.getBoundingClientRect())
    if (settings.tool === 'draw') {
      if (settings.scene.bands.length >= BAND_LIMIT) return
      const next = settings.scene.bands.reduce((max, band) => Math.max(max, Number(/^Ribbon (\d+)$/.exec(band.name)?.[1]) || 0), 0) + 1
      const band = makeBand([], { ...settings.brush, name: `Ribbon ${next}` })
      band.id = `drawn-${band.id}`
      captureUnderlay()
      gesture = { kind: 'draw', pointer: event.pointerId, band, points: [start] }
    } else {
      const band = [...settings.scene.bands].reverse().find(band => hitBand(band, start, time, 15))
      if (!band) return
      gesture = { kind: 'move', pointer: event.pointerId, id: band.id, start, offset: { x: 0, y: 0 } }
      onChange(settings.scene, band.id)
    }
    canvas.setPointerCapture(event.pointerId)
    setCursor()
  }

  function appendSamples(stroke: Stroke, event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    // Some browsers coalesce fast pen/mouse input into a single dispatched event.
    const samples = event.getCoalescedEvents?.() ?? []
    for (const sample of [...samples, event]) {
      const point = position(sample, rect)
      const last = stroke.points[stroke.points.length - 1]
      if (Math.hypot(last.x - point.x, last.y - point.y) >= 2) stroke.points.push(point)
    }
    // Long strokes retain their entire path while keeping its resolution bounded.
    if (stroke.points.length > 4096) stroke.points = stroke.points.filter((_, i, points) => i % 2 === 0 || i === points.length - 1)
    dirty = true
  }

  function move(event: PointerEvent) {
    if (!gesture || gesture.pointer !== event.pointerId) return
    if (gesture.kind === 'draw') {
      appendSamples(gesture, event)
      return
    }
    const point = position(event, canvas.getBoundingClientRect())
    gesture.offset = { x: point.x - gesture.start.x, y: point.y - gesture.start.y }
    dirty = true
  }

  function movedScene({ id, offset }: Drag): Scene {
    const bands = settings.scene.bands.map(band => band.id === id
      ? { ...band, points: translatePoints(band.points, offset.x, offset.y) }
      : band)
    return { ...settings.scene, bands }
  }

  function commit(scene: Scene, selected: string) {
    const previous = settings
    settings = { ...settings, scene, selected }
    onChange(scene, selected, previous)
  }

  function end(event: PointerEvent) {
    if (!gesture || gesture.pointer !== event.pointerId) return
    if (event.type === 'pointerup' && gesture.kind === 'draw') {
      appendSamples(gesture, event)
      const points = smoothStroke(gesture.points)
      if (points.length >= 2) {
        const band = { ...gesture.band, points }
        const scene = { ...settings.scene, bands: [...settings.scene.bands, band] }
        commit(scene, band.id)
      }
    } else if (event.type === 'pointerup' && gesture.kind === 'move') {
      move(event)
      if (Math.hypot(gesture.offset.x, gesture.offset.y) >= 1) commit(movedScene(gesture), gesture.id)
    }
    gesture = null
    dirty = true
    setCursor()
  }

  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('lostpointercapture', end)

  return {
    update(value) {
      settings = value
      dirty = true
      setCursor()
    },
    render(delta, running) {
      if (running && !gesture) {
        time += delta
        dirty = true
      }
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(devicePixelRatio || 1, 1.5)
      const width = Math.max(1, Math.round(rect.width * ratio))
      const height = Math.max(1, Math.round(rect.height * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        dirty = true
      }
      if (!dirty) return
      dirty = false
      if (gesture?.kind === 'draw') {
        const stride = Math.max(1, Math.ceil(gesture.points.length / 56))
        const points = gesture.points.filter((_, i, all) => i % stride === 0 || i === all.length - 1)
        const draft = { ...gesture.band, points, amplitude: 0 }
        renderScene(ctx, { ...settings.scene, bands: [draft] }, time, width, height, underlay)
      } else {
        renderScene(ctx, gesture?.kind === 'move' ? movedScene(gesture) : settings.scene, time, width, height)
      }
    },
    dispose() {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', end)
      canvas.removeEventListener('pointercancel', end)
      canvas.removeEventListener('lostpointercapture', end)
      canvas.style.cursor = ''
      underlay.width = underlay.height = 0
    },
  }
}
