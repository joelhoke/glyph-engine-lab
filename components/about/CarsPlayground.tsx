'use client'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type * as THREE from 'three'
import { createStudioRig } from '../lighting/studioRig'
import { currentPageIllumination } from '../lighting/pageIllumination'
import { createFrameLoop } from '../../engine/frameLoop'
import { useDetailPopover } from '../../engine/useDetailPopover'
import type { PageIllumination } from '../home/light-study/illumination'
import styles from '../../app/about/about.module.css'
import CARS from '../../public/assets/about/garage/catalog.json'
import type { Garage, GarageState } from './garageTypes'
import CarGalleryControls from '../gallery/CarGalleryControls'
import { CAR_STORIES, type CarStoryId } from '../../content/about'
import garageBuild from '../../public/assets/about/garage/revision.json'

export default function CarsPlayground({ active, reducedMotion, mode = 'composition', onNightChange }: { active: boolean; reducedMotion: boolean; mode?: 'composition' | 'gallery'; onNightChange?: (night: boolean) => void }) {
  const mount = useRef<HTMLDivElement>(null), status = useRef<HTMLDivElement>(null), engine = useRef<Garage | null>(null)
  const latest = useRef({ active, reducedMotion, onNightChange }); latest.current = { active, reducedMotion, onNightChange }
  const [selected, setSelected] = useState<CarStoryId | null>(null)
  const [hovered, setHovered] = useState<CarStoryId | null>(null)
  const detail = useRef<HTMLElement>(null), opener = useRef<HTMLButtonElement | null>(null)
  const story = CAR_STORIES.find(item => item.id === selected)
  useDetailPopover(selected, active, detail,
    () => Array.from(mount.current?.querySelectorAll('[data-car-story-trigger]') ?? []),
    () => setSelected(null))
  const closeDetails = () => { setSelected(null); opener.current?.focus({ preventScroll: true }) }
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const [state, setState] = useState<GarageState>({ busy: true, hasLights: false, lightsOn: false })
  useEffect(() => {
    let disposed = false, lastLight = 0
    const host = mount.current!, page = host.closest('[data-lighting-page], [data-about-desktop]')!
    // Generated from the actual playground, loaded only when Cars becomes the hero.
    const url = `/assets/about/garage/runtime.js?v=${garageBuild.revision}`
    void import(/* webpackIgnore: true */ url).then(module => {
      if (disposed) return
      engine.current = module.mountGarage(host, status.current, (three: typeof THREE, scene: THREE.Scene) => createStudioRig(three, scene, { studioFill: false }), createFrameLoop, (value: GarageState) => { if (!disposed) { setState(value); latest.current.onNightChange?.(!!value.night) } }, mode)
      engine.current?.setIllumination(currentPageIllumination(page))
      engine.current?.setActive(latest.current.active, latest.current.reducedMotion)
    }).catch(() => { if (!disposed) setFailed(true) })
    const illuminate = (event: Event) => {
      if (performance.now() - lastLight < 1000 / 15) return
      lastLight = performance.now(); engine.current?.setIllumination((event as CustomEvent<PageIllumination>).detail)
    }
    page.addEventListener('study-illumination', illuminate)
    return () => { disposed = true; page.removeEventListener('study-illumination', illuminate); engine.current?.dispose(); engine.current = null }
  }, [mode])
  useEffect(() => { engine.current?.setActive(active, reducedMotion) }, [active, reducedMotion])
  const move = (direction: number) => {
    const next = (index + direction + CARS.length) % CARS.length
    if (engine.current?.load(CARS[next].id)) setIndex(next)
  }
  return <div className={styles.garage} role="region" aria-label="My garage" onKeyDown={event => {
    if (event.key === 'Escape' && selected) { event.stopPropagation(); closeDetails() }
  }}>
    <div ref={mount} className={`${styles.garageStage} ${mode === 'gallery' ? styles.garageInteractive : ''}`} aria-label={mode === 'gallery' ? `${CARS[index].name}, driving toward the left` : "4Runner and Formula 1 car sharing the road, driving toward the left"}>
      {mode !== 'gallery' && CAR_STORIES.map(item => {
        const placement = {
          '--car-left': `var(--vehicle-${item.id}-left, 0px)`, '--car-top': `var(--vehicle-${item.id}-top, 0px)`,
          '--car-width': `var(--vehicle-${item.id}-width, 0px)`, '--car-height': `var(--vehicle-${item.id}-height, 0px)`,
          '--car-glow': item.id === 'lighting' ? '#68c6ff' : '#ff8750',
        } as CSSProperties
        const ready = !state.busy && state.vehicles?.includes(item.id)
        return <div key={item.id} style={placement}>
          <div className={styles.vehicleGlow} aria-hidden="true" data-visible={!!ready && (hovered === item.id || selected === item.id)} />
          <button type="button" className={styles.vehicleStoryTrigger} data-car-story-trigger disabled={!ready}
            aria-label={`Read about ${item.label}`} aria-expanded={selected === item.id} aria-controls="car-story"
            onPointerEnter={() => setHovered(item.id)} onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(item.id)} onBlur={() => setHovered(null)}
            onClick={event => {
              const hit = event.detail ? engine.current?.pickVehicle({ x: event.clientX, y: event.clientY }) : item.id
              if (hit !== 'lighting' && hit !== 'mclaren') { setSelected(null); return }
              opener.current = event.currentTarget; setSelected(current => current === hit ? null : hit)
            }} />
        </div>
      })}
      <div ref={status} className={styles.garageStatus} role="status">{failed ? 'The 3D view is unavailable on this device.' : 'Loading the garage…'}</div>
    {mode !== 'gallery' && story && <section ref={detail} id="car-story" popover="manual" tabIndex={-1}
      className={styles.carStory} style={{
        '--story-car-left': `var(--vehicle-${story.id}-left)`, '--story-car-top': `var(--vehicle-${story.id}-top)`,
        '--story-car-width': `var(--vehicle-${story.id}-width)`, '--story-car-height': `var(--vehicle-${story.id}-height)`,
      } as CSSProperties} data-car={story.id} data-has-photo={'photo' in story} aria-labelledby="car-story-title">
      <button type="button" className={styles.carStoryClose} aria-label="Close car details" onClick={closeDetails}>×</button>
      {'photo' in story && <figure className={styles.carStoryHero}>
        <img src={story.photo.src} srcSet={story.photo.srcSet} sizes="(max-width: 700px) 90vw, (max-width: 1500px) 32vw, 480px"
          width={story.photo.width} height={story.photo.height} alt={story.photo.alt} decoding="async" />
      </figure>}
      <p className={styles.eyebrow}>{story.label}</p>
      <h2 id="car-story-title">{story.title}</h2>
      <p className={styles.carStoryBody}>{story.body}</p>
      {story.id === 'lighting' && <button type="button" className={styles.carStoryLights} aria-pressed={state.lightsOn}
        disabled={state.busy || !state.hasLights} onClick={() => engine.current?.toggleLights()}>
        Vehicle lights · {state.lightsOn ? 'On' : 'Off'}
      </button>}
    </section>}
    </div>
    {mode === 'gallery' && <CarGalleryControls engine={engine} state={state} reducedMotion={reducedMotion} />}
    {mode === 'gallery' && <div className={styles.carouselControls}>
      <button type="button" aria-label="Previous car" disabled={state.busy} onClick={() => move(-1)}>←</button>
      <p aria-live="polite">{CARS[index].name}<small>{index + 1} / {CARS.length}</small></p>
      <button type="button" aria-label="Next car" disabled={state.busy} onClick={() => move(1)}>→</button>
    </div>}
  </div>
}
