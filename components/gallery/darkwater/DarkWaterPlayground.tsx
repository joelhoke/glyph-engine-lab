'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import PlaygroundShell from '../playground/PlaygroundShell'
import { PaletteControl, PlaybackControls, RangeControl, SelectControl, UndoButton } from '../playground/Controls'
import { Preview } from '../playground/Preview'
import { useLightTheme } from '../playground/useLightTheme'
import { usePlayground, type EngineFactory } from '../playground/usePlayground'
import { useUndoHistory } from '../playground/useUndoHistory'
import type { ShapeKind, ShapeList, WaterEngine, WaterSettings } from './renderer'
import styles from '../playground/playground.module.css'

const defaults: Omit<WaterSettings, 'lightTheme'> = {
  colors: ['#32cfff', '#ff9e37'], waves: .65, speed: .7, intensity: 1,
  exposure: 1.05, bloom: .16, radius: .45, view: 'surface', tool: 'drop', shape: 'sphere',
}
const hints: Record<string, string> = {
  drop: 'Click the water to drop a shape. Hold longer to make it larger.',
  move: 'Drag a shape to lift or submerge it. Release to let it float.',
  orbit: 'Drag to orbit the water. Scroll or pinch to zoom.',
  ripple: 'Click or drag across the water to make ripples.',
}

export default function DarkWaterPlayground() {
  const [settings, setSettings] = useState(defaults)
  const latestSettings = useRef(settings)
  const [shapes, setShapes] = useState<ShapeList>({ items: [], selected: null })
  const engine = useRef<WaterEngine | null>(null)
  const { record, undo, canUndo, clear } = useUndoHistory()
  const create = useCallback<EngineFactory<WaterSettings>>(async (canvas, scene, fail) => {
    const { createDarkWater } = await import('./renderer')
    const instance = createDarkWater(canvas, scene, fail, setShapes, record)
    engine.current = instance
    return instance
  }, [record])
  const lightTheme = useLightTheme()
  const scene = useMemo(() => ({ ...settings, lightTheme }), [settings, lightTheme])
  const play = usePlayground(scene, create)
  function applySettings(next: typeof settings) {
    latestSettings.current = next
    setSettings(next)
  }
  function update<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
    const previous = latestSettings.current[key]
    if (previous === value) return
    let inputGroup: string | undefined
    if (Array.isArray(value) && Array.isArray(previous)) {
      const swatch = value.findIndex((color, index) => color !== previous[index])
      if (swatch === -1) return
      inputGroup = `color-${swatch}`
    } else if (typeof value === 'number') {
      inputGroup = key
    }
    if (key !== 'tool' && key !== 'shape') {
      record(() => {
        engine.current?.cancelPending()
        applySettings({ ...latestSettings.current, [key]: previous })
      }, inputGroup)
    }
    applySettings({ ...latestSettings.current, [key]: value })
  }
  function reset() {
    engine.current?.cancelPending()
    clear()
    applySettings(defaults)
    play.reset()
  }
  const canEdit = play.ready && !play.error
  const hint = settings.tool === 'ripple' && !play.running ? 'Choose Play animation to stir the water.' : hints[settings.tool]

  return <PlaygroundShell title="DarkWater" description="Drop shapes into the water, stir the surface, and color the light that catches their edges." onMenuOpenChange={play.setMenuOpen} controls={<>
    <fieldset className={styles.settings} disabled={!canEdit}>
      <legend className={styles.srOnly}>Water and shape controls</legend>
      <SelectControl label="Canvas tool" value={settings.tool} onChange={value => update('tool', value)}>
        <option value="drop">Drop shapes</option><option value="move">Select & move</option>
        <option value="ripple">Make ripples</option><option value="orbit">Orbit camera</option>
      </SelectControl>
      <span role="status" className={styles.srOnly}>{shapes.items.length} {shapes.items.length === 1 ? 'shape' : 'shapes'} in the water</span>
      {settings.tool === 'drop' && <>
        <SelectControl label="Shape" value={settings.shape} onChange={value => update('shape', value as ShapeKind)}>
          <option value="sphere">Sphere</option><option value="pyramid">Pyramid</option><option value="cube">Cube</option>
        </SelectControl>
        <button type="button" onClick={() => engine.current?.addShape()}>Add shape</button>
      </>}
      {settings.tool === 'move' && shapes.items.length === 0 && <p className={styles.hint}>Choose Drop shapes to add a shape to the water.</p>}
      {settings.tool === 'move' && shapes.items.length > 0 && <>
        <SelectControl label="Selected shape" value={shapes.selected ?? ''} onChange={value => engine.current?.selectShape(Number(value))}>
          <option value="">Choose a shape</option>
          {shapes.items.map(body => <option key={body.id} value={body.id}>{body.kind[0].toUpperCase() + body.kind.slice(1)} {body.id}</option>)}
        </SelectControl>
        <button type="button" disabled={!shapes.selected} onClick={() => engine.current?.removeShape()}>Remove selected shape</button>
      </>}
      <UndoButton onUndo={undo} canUndo={canUndo} />
      <SelectControl label="View" value={settings.view} onChange={value => update('view', value)}>
        <option value="surface">Surface</option><option value="overhead">Overhead</option><option value="underwater">Underwater</option>
      </SelectControl>
    </fieldset>
    <PaletteControl label="Light colors" colors={settings.colors} onChange={colors => update('colors', colors)} />
    <PlaybackControls running={play.running} onToggle={play.toggle} onReset={reset} disabled={!canEdit} />
    {play.reduced && !play.running && <p className={styles.hint}>Motion is paused for your preference. Choose Play animation to set the shapes afloat.</p>}
    <details className={styles.details}><summary>Fine-tune the scene</summary><fieldset disabled={!canEdit}>
      <RangeControl label="Wave strength" max={2} value={settings.waves} onChange={value => update('waves', value)} />
      <RangeControl label="Speed" max={2} value={settings.speed} onChange={value => update('speed', value)} />
      <RangeControl label="Light intensity" min={.1} max={2} value={settings.intensity} onChange={value => update('intensity', value)} />
      <RangeControl label="Exposure" min={.3} max={2} value={settings.exposure} onChange={value => update('exposure', value)} />
      <RangeControl label="Bloom" max={.6} value={settings.bloom} onChange={value => update('bloom', value)} />
      <RangeControl label="Ripple size" min={.15} max={1.2} value={settings.radius} onChange={value => update('radius', value)} />
      <button type="button" disabled={!shapes.items.length} onClick={() => engine.current?.clearShapes()}>Clear shapes</button>
    </fieldset></details>
    <a className={styles.back} href="/assets/gallery/darkwater-studio/index.html">Open full studio</a>
  </>}><Preview {...play} viewport={play.ref} label="Floating shapes, water, and colored light" hint={hint} /></PlaygroundShell>
}
