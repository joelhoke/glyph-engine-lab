'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import PlaygroundShell from '../playground/PlaygroundShell'
import { PaletteControl, PlaybackControls, RangeControl, SelectControl, UndoButton } from '../playground/Controls'
import { Preview } from '../playground/Preview'
import { usePlayground, type EngineFactory } from '../playground/usePlayground'
import { useLightTheme } from '../playground/useLightTheme'
import { useUndoHistory } from '../playground/useUndoHistory'
import styles from '../playground/playground.module.css'
import DrawingSurface from './DrawingSurface'
import { defaultScene, newBalloon, PALETTE, shape } from './engine/scene'
import type { PlaygroundRenderer } from './engine/renderer'
import { MAX_BALLOONS, type Balloon, type SceneDocument, type Vec2 } from './engine/types'

type Settings = { scene: SceneDocument; selected: string; mode: 'select' | 'orbit' | 'draw' }
type Shape = Parameters<typeof shape>[0]
type BalloonSetting = 'color' | 'scale' | 'inflation' | 'roughness'
const initial = (): Settings => {
  const scene = defaultScene()
  return { scene, selected: scene.balloons[0].id, mode: 'draw' }
}

const toolHints = {
  draw: 'Trace a closed outline anywhere on the canvas. Lift to inflate it, then draw another.',
  select: 'Drag a balloon to move it. Release while moving to give it a gentle throw.',
  orbit: 'Drag to orbit the balloons. Pinch or scroll to zoom.',
}

export default function LoonzPlayground() {
  const [settings, setSettings] = useState(initial)
  const [customBackground, setCustomBackground] = useState<string | null>(null)
  const [drawingColor, setDrawingColor] = useState(PALETTE[5])
  const [kind, setKind] = useState<Shape>('heart')
  const [notice, setNotice] = useState('')
  const rendererRef = useRef<PlaygroundRenderer | null>(null)
  const { record, undo, canUndo, clear } = useUndoHistory()
  const light = useLightTheme()
  const background = customBackground ?? (light ? '#f2d5e3' : '#322a40')
  const displaySettings = useMemo(() => ({
    ...settings, scene: { ...settings.scene, background },
  }), [settings, background])

  const updateBalloon = useCallback((id: string, values: Partial<Balloon>) => {
    setSettings(s => ({
      ...s, scene: { ...s.scene, balloons: s.scene.balloons.map(b => b.id === id ? { ...b, ...values } : b) },
    }))
  }, [])

  const create = useCallback<EngineFactory<Settings>>(async (canvas, value, fail) => {
    const { PlaygroundRenderer } = await import('./engine/renderer')
    const renderer = new PlaygroundRenderer(canvas, {
      select: id => setSettings(s => ({ ...s, selected: id || '' })),
      move: (id, position, previous) => {
        if (position.every((value, index) => value === previous[index])) return
        record(() => updateBalloon(id, { position: previous }))
        updateBalloon(id, { position })
      },
      camera: camera => setSettings(s => ({ ...s, scene: { ...s.scene, camera } })),
      box: () => {}, stats: () => {}, background: () => {}, error: fail,
    })
    rendererRef.current = renderer
    renderer.setScene(value.scene)
    renderer.setCamera(value.scene.camera)
    let previousScene = value.scene
    return {
      update(next) {
        if (next.scene !== previousScene) {
          renderer.setScene(next.scene)
          previousScene = next.scene
        }
        renderer.setSelected(next.selected || null)
        renderer.setMode(next.mode)
      },
      render(_delta, running) {
        renderer.setPlaying(running)
        renderer.render()
      },
      dispose() {
        if (rendererRef.current === renderer) rendererRef.current = null
        renderer.dispose()
      },
    }
  }, [record, updateBalloon])

  const play = usePlayground(displaySettings, create)
  const selectedBalloon = settings.scene.balloons.find(b => b.id === settings.selected)
  const full = settings.scene.balloons.length >= MAX_BALLOONS

  function changeBalloon<K extends BalloonSetting>(key: K, value: Balloon[K]) {
    if (!selectedBalloon || selectedBalloon[key] === value) return
    const { id } = selectedBalloon
    const previous = selectedBalloon[key]
    record(() => updateBalloon(id, { [key]: previous }), `balloon-${id}-${key}`)
    updateBalloon(id, { [key]: value })
  }

  function changeDrift(drift: number) {
    const previous = settings.scene.physics.drift
    if (drift === previous) return
    const apply = (value: number) => setSettings(s => ({
      ...s, scene: { ...s.scene, physics: { ...s.scene.physics, drift: value } },
    }))
    record(() => apply(previous), 'float-amount')
    apply(drift)
  }

  function changeDrawingColor(color: string) {
    if (drawingColor === color) return
    record(() => setDrawingColor(drawingColor), 'drawing-color')
    setDrawingColor(color)
  }

  function changeBackground(color: string) {
    if (background === color) return
    record(() => setCustomBackground(customBackground), 'background')
    setCustomBackground(color)
  }

  function removeBalloon() {
    if (!selectedBalloon) return
    const index = settings.scene.balloons.indexOf(selectedBalloon)
    const fallback = settings.scene.balloons.find(b => b.id !== selectedBalloon.id)?.id ?? ''
    record(() => setSettings(s => {
      const balloons = [...s.scene.balloons]
      balloons.splice(index, 0, selectedBalloon)
      return { ...s, selected: s.selected === fallback ? selectedBalloon.id : s.selected, scene: { ...s.scene, balloons } }
    }))
    setSettings(s => ({
      ...s, selected: fallback, scene: { ...s.scene, balloons: s.scene.balloons.filter(b => b.id !== selectedBalloon.id) },
    }))
  }

  function addBalloon(outline: Vec2[], placement?: Pick<Balloon, 'rotation' | 'scale' | 'position'>) {
    const balloon = {
      ...newBalloon(outline, settings.scene.balloons.length),
      ...placement,
      color: drawingColor,
    }
    const previouslySelected = settings.selected
    record(() => setSettings(s => ({
      ...s,
      selected: s.selected === balloon.id ? previouslySelected : s.selected,
      scene: { ...s.scene, balloons: s.scene.balloons.filter(b => b.id !== balloon.id) },
    })))
    setSettings(s => ({
      ...s, selected: balloon.id, scene: { ...s.scene, balloons: [...s.scene.balloons, balloon] },
    }))
    setNotice('')
  }

  function inflate(points: Vec2[]) {
    if (full || !rendererRef.current) return
    try {
      const { outline, ...placement } = rendererRef.current.drawingPlacement(points)
      addBalloon(outline, placement)
    } catch (error) {
      setNotice(error instanceof Error && error.message.startsWith('Draw')
        ? error.message
        : 'Try a closed outline without crossing the line.')
    }
  }

  function reset() {
    clear()
    setSettings(initial())
    setCustomBackground(null)
    setDrawingColor(PALETTE[5])
    setKind('heart')
    setNotice('')
    play.reset()
  }

  const atCapacity = `This composition has ${MAX_BALLOONS} balloons. Remove one to draw another.`
  return <PlaygroundShell title="Loonz" description="Draw an outline and lift to inflate it into a foil balloon. Fill the canvas with your shapes, then grab one and give it a throw."
    onMenuOpenChange={play.setMenuOpen} controls={<>
      <div className={styles.settings}>
        <SelectControl label="Canvas tool" value={settings.mode} onChange={mode => {
          setSettings(s => ({ ...s, mode: mode as Settings['mode'] }))
          setNotice('')
        }}>
          <option value="draw">Draw a balloon</option>
          <option value="select">Grab &amp; throw</option>
          <option value="orbit">Orbit camera</option>
        </SelectControl>
      </div>
      <UndoButton onUndo={undo} canUndo={canUndo} />
      {settings.mode === 'draw' && <PaletteControl label="Drawing color" colors={[drawingColor]} onChange={([color]) => changeDrawingColor(color)} />}
      <div className={styles.settings}>
        <RangeControl label="Float amount" value={settings.scene.physics.drift} onChange={changeDrift} />
      </div>
      <PlaybackControls running={play.running} onToggle={play.toggle} onReset={reset} disabled={!play.ready || !!play.error} />
      {notice && <p role="status" className={styles.hint}>{notice}</p>}
      {settings.scene.balloons.length > 0 && <div className={styles.settings}>
        <SelectControl label="Selected balloon" value={settings.selected} onChange={selected => setSettings(s => ({ ...s, selected }))}>
          <option value="">Choose a balloon</option>
          {settings.scene.balloons.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}
        </SelectControl>
      </div>}
      {selectedBalloon && <details className={styles.details}>
        <summary>Fine-tune the balloon</summary>
        <fieldset>
          <PaletteControl label="Balloon color" colors={[selectedBalloon.color]} onChange={([color]) => changeBalloon('color', color)} />
          <RangeControl label="Size" value={selectedBalloon.scale} min={.25} max={2} onChange={scale => changeBalloon('scale', scale)} />
          <RangeControl label="Inflation" value={selectedBalloon.inflation} min={.3} max={1.8} onChange={inflation => changeBalloon('inflation', inflation)} />
          <RangeControl label="Roughness" value={selectedBalloon.roughness} min={.08} max={.5} onChange={roughness => changeBalloon('roughness', roughness)} />
          <button type="button" onClick={removeBalloon}>Remove selected balloon</button>
        </fieldset>
      </details>}
      <details className={styles.details}>
        <summary>Use a preset shape</summary>
        <fieldset className={styles.settings}>
          <SelectControl label="New balloon shape" value={kind} onChange={value => {
            if (value === kind) return
            record(() => setKind(kind))
            setKind(value as Shape)
          }}>
            {['heart', 'flower', 'blob', 'circle', 'star'].map(v => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
          </SelectControl>
          <button type="button" disabled={full || !play.ready || !!play.error} onClick={() => addBalloon(shape(kind))}>Add balloon</button>
        </fieldset>
      </details>
      <PaletteControl label="Background" colors={[background]} onChange={([color]) => changeBackground(color)} />
    </>}>
    <Preview {...play} viewport={play.ref} label="Interactive floating foil balloons" hint={full && settings.mode === 'draw' ? atCapacity : toolHints[settings.mode]}>
      {settings.mode === 'draw' && play.ready && !play.error && !full && <DrawingSurface color={drawingColor} onFinish={inflate} />}
    </Preview>
  </PlaygroundShell>
}
