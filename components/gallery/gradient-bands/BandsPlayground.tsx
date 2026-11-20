'use client'

import { useCallback, useMemo, useState } from 'react'
import PlaygroundShell from '../playground/PlaygroundShell'
import { PaletteControl, PlaybackControls, RangeControl, SelectControl, UndoButton } from '../playground/Controls'
import { Preview } from '../playground/Preview'
import { usePlayground, type EngineFactory } from '../playground/usePlayground'
import { useUndoHistory } from '../playground/useUndoHistory'
import { useLightTheme } from '../playground/useLightTheme'
import { BAND_LIMIT, makeBand, preset, presets, type Band, type Scene } from './bands'
import type { BandSettings, Brush } from './renderer'
import styles from '../playground/playground.module.css'

const drawingStudy = -1
const backgroundColors = [
  ['#f8f7f4', '#181624'], // Daydream
  ['#faf1ed', '#251b33'], // Afterglow
  ['#efecfa', '#10121d'], // Electric
  ['#eff7f6', '#102227'], // Tidal
  ['#fff6e9', '#251c23'], // Solar
  ['#f8f7f4', '#161924'], // Blank canvas
]

const defaultBrush: Brush = {
  colors: ['#ff8c91', '#ad78e7', '#49c8e7'],
  width: 100, glow: 18, speed: .7, amplitude: 20, style: 'Silk',
}

function startingScene(index: number): Scene {
  if (index !== drawingStudy) return preset(index)
  const sample = makeBand([
    { x: -100, y: 585 }, { x: 245, y: 600 }, { x: 600, y: 470 },
    { x: 900, y: 580 }, { x: 1310, y: 490 },
  ], { ...defaultBrush, id: 'sample-band', name: 'Sample ribbon', width: 140 })
  return { bands: [sample], title: 'Drawing study', background: '#f8f7f4' }
}

function initialSettings(index = drawingStudy): BandSettings {
  const scene = startingScene(index)
  return { scene, tool: 'draw', selected: scene.bands[0]?.id ?? '', brush: defaultBrush }
}

export default function BandsPlayground() {
  const light = useLightTheme()
  const { record, undo, canUndo, clear } = useUndoHistory()
  const [settings, setSettings] = useState(() => initialSettings())
  const [presetIndex, setPresetIndex] = useState(drawingStudy)
  const [customBackground, setCustomBackground] = useState<string | null>(null)
  const themeColors = backgroundColors[Math.max(0, presetIndex)]
  const background = customBackground ?? themeColors[light ? 0 : 1]
  const renderedSettings = useMemo(() => ({
    ...settings, scene: { ...settings.scene, background },
  }), [settings, background])
  const rememberScene = useCallback(({ scene, selected }: Pick<BandSettings, 'scene' | 'selected'>) => {
    record(() => setSettings(current => ({
      ...current, scene, selected, tool: scene.bands.length ? current.tool : 'draw',
    })))
  }, [record])
  const create = useCallback<EngineFactory<BandSettings>>(async (canvas, value) => {
    const { createBands } = await import('./renderer')
    return createBands(canvas, value, (scene, selected, previous) => {
      if (previous) rememberScene(previous)
      setSettings(current => ({ ...current, scene, selected }))
    })
  }, [rememberScene])
  const play = usePlayground(renderedSettings, create)
  const { scene, selected, tool } = settings
  const selectedBand = scene.bands.find(band => band.id === selected)
  const drawing = tool === 'draw'
  const active = drawing ? settings.brush : selectedBand

  function updateBrush<K extends keyof Brush>(key: K, value: Brush[K]) {
    if (!active) return
    const previous = active[key]
    const changedSwatch = key === 'colors' ? (value as string[]).findIndex((color, i) => color !== active.colors[i]) : undefined
    if (previous === value || changedSwatch === -1) return
    // A selection can change before Undo. Restore the brush/ribbon actually edited.
    const target = drawing ? null : selected
    function apply(next: Brush[K]) {
      setSettings(current => {
        if (target === null) return { ...current, brush: { ...current.brush, [key]: next } }
        const bands = current.scene.bands.map(band => band.id === target ? { ...band, [key]: next } : band)
        return { ...current, scene: { ...current.scene, bands } }
      })
    }
    const group = key === 'style' ? undefined : `${target ?? 'brush'}/${key}/${changedSwatch ?? ''}`
    record(() => apply(previous), group)
    apply(value)
  }

  function updateBackground(color: string | null) {
    if (color === customBackground || color === background) return
    record(() => setCustomBackground(customBackground), color === null ? undefined : 'background')
    setCustomBackground(color)
  }

  function applyPreset(index: number, resetting = false) {
    if (resetting) clear()
    else {
      record(() => {
        setPresetIndex(presetIndex)
        setCustomBackground(customBackground)
        setSettings(current => ({ ...settings, tool: settings.scene.bands.length ? current.tool : 'draw' }))
      })
    }
    const next = initialSettings(index)
    const sample = next.scene.bands[0]
    if (sample && index !== drawingStudy) {
      next.brush = { ...defaultBrush, colors: [...sample.colors], style: sample.style, glow: sample.glow }
    }
    setPresetIndex(index)
    setCustomBackground(null)
    setSettings(next)
  }

  function removeBand(id: string) {
    rememberScene(settings)
    setSettings(current => {
      const bands = current.scene.bands.filter(band => band.id !== id)
      const selected = bands.some(band => band.id === current.selected) ? current.selected : bands.at(-1)?.id ?? ''
      return { ...current, selected, tool: bands.length ? current.tool : 'draw', scene: { ...current.scene, bands } }
    })
  }

  let hint = 'Drag a ribbon to move it. Its colors and width are editable in the controls.'
  if (drawing) {
    hint = scene.bands.length >= BAND_LIMIT
      ? `All ${BAND_LIMIT} bands are in use. Remove a band to draw another.`
      : 'Draw anywhere with your mouse, pen, or finger. Lift to finish the ribbon, then draw another.'
  }

  return <PlaygroundShell title="Gradient Bands" description="Draw a path and watch it fill with color. Layer ribbons, then set them in motion." onMenuOpenChange={play.setMenuOpen} controls={<>
    <div className={styles.settings}>
      <SelectControl label="Canvas tool" value={tool} onChange={value => setSettings(current => ({ ...current, tool: value as BandSettings['tool'] }))}>
        <option value="draw">Draw a band</option>
        <option value="move" disabled={!scene.bands.length}>Select &amp; move</option>
      </SelectControl>
      <UndoButton onUndo={undo} canUndo={canUndo} />
      {!drawing && <SelectControl label="Selected band" value={selected} onChange={value => setSettings(current => ({ ...current, selected: value }))}>
        {scene.bands.map(band => <option value={band.id} key={band.id}>{band.name}</option>)}
      </SelectControl>}
    </div>
    {active && <>
      <PaletteControl label={drawing ? 'Brush colors' : 'Band colors'} colors={active.colors} onChange={colors => updateBrush('colors', colors)} />
      <div className={styles.settings}>
        <SelectControl label="Band style" value={active.style} onChange={value => updateBrush('style', value as Band['style'])}>
          {['Silk', 'Radiant', 'Neon'].map(name => <option key={name}>{name}</option>)}
        </SelectControl>
        <RangeControl label="Width" value={active.width} min={20} max={300} step={1} onChange={width => updateBrush('width', width)} />
        {!drawing && <button type="button" onClick={() => removeBand(selected)}>Remove selected band</button>}
      </div>
    </>}
    <PlaybackControls running={play.running} onToggle={play.toggle} onReset={() => { applyPreset(drawingStudy, true); play.reset() }} disabled={!play.ready || !!play.error} />
    {play.reduced && !play.running && <p className={styles.hint}>Motion is paused for your preference. You can still draw and move bands.</p>}
    <details className={styles.details}><summary>Fine-tune the bands</summary><fieldset className={styles.settings}>
      <SelectControl label="Starting point" value={presetIndex} onChange={value => applyPreset(Number(value))}>
        <option value={drawingStudy}>Drawing study</option>
        {presets.map((name, index) => <option key={name} value={index}>{name}</option>)}
      </SelectControl>
      {active && <>
        <RangeControl label="Speed" value={active.speed} max={2} onChange={speed => updateBrush('speed', speed)} />
        <RangeControl label="Glow" value={active.glow} max={60} step={1} onChange={glow => updateBrush('glow', glow)} />
        <RangeControl label="Wave amount" value={active.amplitude} max={60} step={1} onChange={amplitude => updateBrush('amplitude', amplitude)} />
      </>}
      <PaletteControl label="Background" colors={[background]} onChange={colors => updateBackground(colors[0])} />
      {customBackground && <button type="button" onClick={() => updateBackground(null)}>Use theme background</button>}
    </fieldset></details>
  </>}>
    <Preview {...play} viewport={play.ref} label="Interactive luminous gradient ribbons" hint={hint} />
  </PlaygroundShell>
}
