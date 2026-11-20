'use client'
import { useMemo, useState } from 'react'
import { useLightTheme } from '../playground/useLightTheme'
import PlaygroundShell from '../playground/PlaygroundShell'
import { PaletteControl, PlaybackControls, RangeControl, SelectControl, UndoButton } from '../playground/Controls'
import { Preview } from '../playground/Preview'
import { usePlayground, type EngineFactory } from '../playground/usePlayground'
import { useUndoHistory } from '../playground/useUndoHistory'
import { neonDefaults, type NeonSettings } from './renderer'
import { limitText, typefaces } from './text-mask'
import styles from '../playground/playground.module.css'

const shapeNames = ['Circle', 'Square', 'Triangle', 'Diamond', 'Hexagon', 'Star']
const motionNames = ['Rolling', 'Breathing', 'Rippling', 'Flowing']
const shapeIcons = [
  <circle key="circle" cx="12" cy="12" r="8" />,
  <rect key="square" x="4" y="4" width="16" height="16" rx="2" />,
  <path key="triangle" d="M12 3 22 20H2Z" />,
  <path key="diamond" d="m12 2 9 10-9 10L3 12Z" />,
  <path key="hexagon" d="M7 4h10l5 8-5 8H7l-5-8Z" />,
  <path key="star" d="m12 2 3 6.5 7 1-5 5 1.2 7L12 18l-6.2 3.5L7 14.5l-5-5 7-1Z" />,
]
const shapeIcon = (value: string) => <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.5">{shapeIcons[Number(value)]}</svg>
const create: EngineFactory<NeonSettings> = async (canvas, settings) => (await import('./renderer')).createNeon(canvas, settings)
export default function NeonPlayground() {
  const [form, setSettings] = useState(neonDefaults)
  const [customBackground, setCustomBackground] = useState<string | null>(null)
  const { record, undo, canUndo, clear } = useUndoHistory()
  const light = useLightTheme()
  const settings = useMemo(() => ({
    ...form,
    background: customBackground ?? (light ? '#e9e5f3' : neonDefaults.background),
  }), [form, customBackground, light])
  const play = usePlayground(settings, create)
  function update<K extends keyof NeonSettings>(key: K, value: NeonSettings[K]) {
    const previous = form[key]
    if (Object.is(value, previous)) return
    let group: string = key
    if (Array.isArray(value) && Array.isArray(previous)) {
      const index = value.findIndex((color, i) => previous[i] !== color)
      if (index === -1) return
      group += index
    }
    record(() => setSettings(current => ({ ...current, [key]: previous })), group)
    setSettings(current => ({ ...current, [key]: value }))
  }

  function changeBackground(color: string) {
    if (color === settings.background) return
    record(() => setCustomBackground(customBackground), 'background')
    setCustomBackground(color)
  }

  function reset() {
    clear()
    setCustomBackground(null)
    setSettings(neonDefaults)
    play.reset()
  }
  return <PlaygroundShell title="Neon Trip" description="Simple forms, luminous color. Shape the light, make a word glow, and find a rhythm of your own." onMenuOpenChange={play.setMenuOpen} controls={<>
    <fieldset className={styles.settings} disabled={!!play.error}>
      <legend className={styles.srOnly}>Artwork settings</legend>
      <SelectControl label="Artwork" value={settings.textMode} onChange={value => update('textMode', Number(value))}>
        <option value={0}>Shape</option><option value={1}>Text</option>
      </SelectControl>
      {settings.textMode ? <>
        <label>Your text<input type="text" value={settings.text} onChange={event => update('text', limitText(event.target.value))} /></label>
        <SelectControl label="Typeface" value={settings.font} onChange={value => update('font', Number(value))}>
          {typefaces.map((face, index) => <option value={index} key={face.name}>{face.name}</option>)}
        </SelectControl>
      </> : <SelectControl buttons icon={shapeIcon} label="Shape" value={settings.shape} onChange={value => update('shape', Number(value))}>
        {shapeNames.map((name, index) => <option value={index} key={name}>{name}</option>)}
      </SelectControl>}
    </fieldset>
    <UndoButton onUndo={undo} canUndo={canUndo} />
    <PaletteControl colors={settings.palette} onChange={colors => update('palette', colors)} />
    <fieldset className={styles.settings} disabled={!!play.error}>
      <legend className={styles.srOnly}>Animation settings</legend>
      <SelectControl label="Light motion" value={settings.mode} onChange={value => update('mode', Number(value))}>
        {motionNames.map((name, index) => <option value={index} key={name}>{name}</option>)}
      </SelectControl>
      <RangeControl label="Speed" max={3} value={settings.speed} onChange={value => update('speed', value)} />
    </fieldset>
    <PlaybackControls running={play.running} onToggle={play.toggle} onReset={reset} disabled={!play.ready || !!play.error} />
    {play.reduced && !play.running && <p className={styles.hint}>Motion is paused for your preference. Choose Play animation to begin.</p>}
    <details className={styles.details}><summary>Fine-tune the light</summary><fieldset>
      <RangeControl label="Distortion" value={settings.distortion} onChange={v => update('distortion',v)} />
      <RangeControl label="Interior noise" value={settings.noise} onChange={v => update('noise',v)} />
      <RangeControl label="Glow" value={settings.glow} onChange={v => update('glow',v)} />
      <RangeControl label="Grain" value={settings.grain} onChange={v => update('grain',v)} />
      <PaletteControl label="Background" colors={[settings.background]} onChange={([color]) => changeBackground(color)} />
    </fieldset></details>
  </>}><Preview {...play} viewport={play.ref} label="Luminous neon artwork" hint="Try a shape or a short word, then explore the colors and light motion." /></PlaygroundShell>
}
