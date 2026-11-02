'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import SiteHeader from '../../SiteHeader'
import { useReducedMotion } from '../../home/useReducedMotion'
import { useSectionVisibility } from '../../home/useSectionVisibility'
import type { createFlowerRenderer } from '../../home/flower/renderer'
import type { FlowerGradientSettings } from '../../home/flower/types'
import { STATEMENT_FLOWER } from '../../../content/statementFlower'
import { GRADIENT_PLAYGROUND as defaults, GRADIENT_TYPES } from '../../../content/gradientPlayground'
import { advanceFlowerProgress, flowerPositionLabel, playgroundFlowerProgress, scrollFlowerProgress, type AnimationMode } from './motion'
import styles from './playground.module.css'

export default function GradientPlayground() {
  const [gradient, setGradient] = useState<FlowerGradientSettings>(() => ({ ...defaults.gradient, palette: [...defaults.gradient.palette] }))
  const [mode, setMode] = useState<AnimationMode>('time')
  const [seconds, setSeconds] = useState<number>(defaults.travelSeconds)
  const [intent, setIntent] = useState<'auto' | 'play' | 'pause'>('auto')
  const [menuOpen, setMenuOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState(0)
  const reduced = useReducedMotion()
  const { ref: viewport, near, active } = useSectionVisibility<HTMLDivElement>(!menuOpen)
  const host = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const renderer = useRef<ReturnType<typeof createFlowerRenderer> | null>(null)
  const settings = useRef(gradient)
  const position = useRef(0)
  const direction = useRef<1 | -1>(1)
  const time = useRef(0)
  const running = intent === 'play' || (intent === 'auto' && !reduced)

  // Preference changes pause even a previously opted-in animation.
  useEffect(() => { if (reduced) setIntent(value => value === 'play' ? 'pause' : value) }, [reduced])

  useEffect(() => {
    settings.current = gradient
    renderer.current?.setGradient(gradient)
    renderer.current?.render(position.current, time.current)
  }, [gradient])

  useEffect(() => {
    if (!near || failed) return
    let canceled = false
    let instance: ReturnType<typeof createFlowerRenderer> | undefined
    let observer: ResizeObserver | undefined
    import('../../home/flower/renderer').then(({ createFlowerRenderer }) => {
      if (canceled || !host.current) return
      instance = createFlowerRenderer(host.current, () => { if (!canceled) setFailed(true) }, {
        viewHeight: defaults.viewHeight, minViewWidth: defaults.minViewWidth, target: defaults.target, gradient: settings.current,
        sequence: defaults.sequence, resolveProgress: playgroundFlowerProgress,
      })
      renderer.current = instance
      const resize = () => {
        instance?.resize()
        instance?.render(position.current, time.current)
      }
      observer = new ResizeObserver(resize)
      observer.observe(host.current)
      resize()
      setReady(true)
    }).catch(() => { if (!canceled) setFailed(true) })
    return () => {
      canceled = true
      observer?.disconnect()
      instance?.dispose()
      renderer.current = null
      setReady(false)
    }
  }, [near, failed])

  useEffect(() => {
    const instance = renderer.current
    if (!ready || !instance || !active || !running || failed) return
    let frame = 0, last = 0, lastReport = 0
    const tick = (now: number) => {
      const delta = last ? Math.min((now - last) / 1000, 0.05) : 0
      last = now
      time.current += delta
      if (mode === 'time') {
        const next = advanceFlowerProgress(position.current, direction.current, delta, seconds)
        position.current = next.progress
        direction.current = next.direction
      } else if (track.current && stage.current) {
        const bounds = track.current.getBoundingClientRect()
        const next = scrollFlowerProgress(bounds.top, bounds.height, stage.current.offsetHeight, parseFloat(getComputedStyle(stage.current).top) || 0)
        if (next !== position.current) direction.current = next > position.current ? 1 : -1
        position.current = next
      }
      instance.render(position.current, time.current)
      if (now - lastReport > 100) { setProgress(position.current); lastReport = now }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); setProgress(position.current) }
  }, [ready, active, running, mode, seconds, failed])

  const seek = (value: number) => {
    setIntent('pause')
    position.current = value
    setProgress(value)
    renderer.current?.render(value, time.current)
  }
  const reset = () => {
    position.current = 0
    direction.current = 1
    time.current = 0
    setProgress(0)
    setMode('time')
    setIntent('auto')
    setSeconds(defaults.travelSeconds)
    setGradient({ ...defaults.gradient, palette: [...defaults.gradient.palette] })
  }
  const update = <K extends keyof FlowerGradientSettings>(key: K, value: FlowerGradientSettings[K]) => setGradient(current => ({ ...current, [key]: value }))

  return <div className={styles.shell}>
    <SiteHeader active="gallery" onMenuOpenChange={setMenuOpen} />
    <main id="main-content" className={styles.main}>
      <header className={styles.heading}>
        <Link href="/gallery" className={styles.back}>← Gallery</Link>
        <p className={styles.eyebrow}>A study in color and motion</p>
        <h1>Three.Gradient</h1>
        <p>Make the flower your own. Change its colors, shape the gradient, and let time or your scroll bring it to life.</p>
      </header>
      <section className={styles.workspace} aria-label="Flower playground" data-animation-mode={mode}>
        <aside className={styles.controls} aria-label="Playground controls">
          <fieldset disabled={failed} className={styles.palette}>
            <legend>Color palette</legend>
            <div className={styles.swatches}>
              {gradient.palette.map((color, index) => <label key={index} className={styles.swatch}>
                <span className={styles.srOnly}>Color {index + 1}</span>
                <input type="color" value={color} onChange={event => update('palette', gradient.palette.map((value, i) => i === index ? event.target.value : value))} />
                <span>{color.toUpperCase()}</span>
              </label>)}
            </div>
          </fieldset>
          <fieldset disabled={failed} className={styles.settings}>
            <legend className={styles.srOnly}>Gradient and animation settings</legend>
            <label>Gradient type
              <select value={gradient.mode} onChange={event => update('mode', event.target.value as FlowerGradientSettings['mode'])}>
                {GRADIENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label>Gradient application
              <select value={gradient.scope} onChange={event => update('scope', event.target.value as FlowerGradientSettings['scope'])}>
                <option value="element">Per element</option>
                <option value="object">Whole object</option>
              </select>
            </label>
            <div className={styles.animationChoice} role="group" aria-label="Animation source">
              <span>Animate with</span>
              <div className={styles.segmented}>
                <button type="button" aria-pressed={mode === 'time'} onClick={() => setMode('time')}>Time</button>
                <button type="button" aria-pressed={mode === 'scroll'} onClick={() => setMode('scroll')}>Scroll</button>
              </div>
            </div>
            {mode === 'time' && <label className={styles.wide}>Journey duration <span>{seconds}s each way</span>
              <input type="range" min="8" max="40" step="1" value={seconds} onChange={event => setSeconds(Number(event.target.value))} aria-valuetext={`${seconds} seconds each way`} />
            </label>}
          </fieldset>
          <p className={styles.hint} id="gradient-animation-help">{mode === 'scroll'
            ? 'Scroll down through the flower to morph into Cherry blossom. Scroll up to return to Plumeria.'
            : 'Plumeria becomes Rose, Daisy, then Cherry blossom, before returning. Adjust the duration to slow down or speed up.'}</p>
          <div className={styles.actions}>
            <button type="button" disabled={!ready || failed} onClick={() => setIntent(running ? 'pause' : 'play')}>{running ? 'Pause animation' : 'Play animation'}</button>
            <button type="button" disabled={failed} onClick={reset}>Reset</button>
          </div>
          {reduced && !running && <p className={styles.hint}>Motion is paused for your preference. Use the position slider, or choose Play animation.</p>}
          <details className={styles.details}>
            <summary>Fine-tune the gradient</summary>
            <fieldset disabled={failed}>
              <legend className={styles.srOnly}>Fine-tune the gradient</legend>
              <label>Scale <input type="range" min="0.3" max="3" step="0.05" value={gradient.scale} onChange={event => update('scale', Number(event.target.value))} /></label>
              <label>Softness <input type="range" min="0" max="1" step="0.01" value={gradient.softness} onChange={event => update('softness', Number(event.target.value))} /></label>
              {gradient.mode === 'bands' && <label>Direction <input type="range" min="0" max="360" step="1" value={gradient.direction} aria-valuetext={`${gradient.direction} degrees`} onChange={event => update('direction', Number(event.target.value))} /></label>}
              <label>Noise amount <input type="range" min="0" max="1" step="0.01" value={gradient.noise} onChange={event => update('noise', Number(event.target.value))} /></label>
            </fieldset>
          </details>
        </aside>
        <div ref={track} className={styles.track}>
          <div ref={stage} className={styles.stage}>
            <div ref={viewport} className={styles.viewport} role="img" aria-label="A three-dimensional flower morphing between Plumeria, Rose, Daisy and Cherry blossom" data-render-state={failed ? 'unavailable' : ready ? 'ready' : 'loading'}>
              {(!ready || failed) && <img src={STATEMENT_FLOWER.poster} alt="" className={styles.poster} />}
              <div ref={host} className={styles.canvas} aria-hidden="true" />
              <span className={styles.flowerName} aria-hidden="true">{flowerPositionLabel(progress)}</span>
            </div>
            <div className={styles.timeline}>
              <label htmlFor="flower-position">Flower position <span>{Math.round(progress * 100)}%</span></label>
              <input id="flower-position" type="range" min="0" max="1" step="0.001" value={progress} disabled={failed}
                aria-valuetext={`${Math.round(progress * 100)} percent, ${flowerPositionLabel(progress)}`}
                aria-describedby="gradient-animation-help" onChange={event => seek(Number(event.target.value))} />
              <div className={styles.stops} aria-hidden="true">{defaults.flowerLabels.map(label => <span key={label}>{label}</span>)}</div>
            </div>
            {failed && <p className={styles.status} role="status">The 3D preview couldn’t start in this browser. <button type="button" onClick={() => setFailed(false)}>Try again</button></p>}
            {!ready && !failed && <p className={styles.status} role="status">Preparing your flower…</p>}
          </div>
        </div>
      </section>
      <footer className={styles.footer}>A little color, a little curiosity. <Link href="/gallery">Keep exploring the gallery →</Link></footer>
    </main>
  </div>
}
