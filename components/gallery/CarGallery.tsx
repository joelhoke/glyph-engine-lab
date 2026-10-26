'use client'

import { useEffect, useRef, useState } from 'react'
import SiteHeader from '../SiteHeader'
import AnalyticsConsent from '../AnalyticsConsent'
import { useReducedMotion } from '../../engine/useReducedMotion'
import { createFrameLoop } from '../../engine/frameLoop'
import catalog from '../../public/assets/about/garage/catalog.json'
import garageBuild from '../../public/assets/about/garage/revision.json'
import { GALLERY_HIGHLIGHTS } from '../../content/galleryHighlights'
import CarGalleryControls from './CarGalleryControls'
import type { Garage, GarageState } from './garageTypes'
import styles from './car-playground.module.css'

// Only the two vehicles selected for this gallery exhibit; the source catalog also archives Lancia.
const cars = catalog.filter(car => car.id === 'lighting' || car.id === 'mclaren')
const poster = GALLERY_HIGHLIGHTS.find(project => project.id === 'cars')!.thumbnail
const ignoreAnalyticsClient = () => {}

export default function CarGallery() {
  const reducedMotion = useReducedMotion()
  const [menuOpen, setMenuOpen] = useState(false)
  const [state, setState] = useState<GarageState>({ busy: true, hasLights: false, lightsOn: false })
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const mount = useRef<HTMLDivElement>(null), status = useRef<HTMLDivElement>(null), engine = useRef<Garage | null>(null)
  const current = useRef({ menuOpen, reducedMotion }); current.current = { menuOpen, reducedMotion }

  useEffect(() => {
    let disposed = false
    setFailed(false); setIndex(0); setState({ busy: true, hasLights: false, lightsOn: false })
    const url = `/assets/about/garage/runtime.js?v=${garageBuild.revision}`
    // Reuse the original renderer, vehicle lighting, camera controls and model lifecycle.
    void import(/* webpackIgnore: true */ url).then(module => {
      if (disposed) return
      const garage: Garage = module.mountGarage(mount.current, status.current, null, createFrameLoop,
        (value: GarageState) => {
          if (disposed) return
          setState(value)
          if (!value.busy) setFailed(!value.vehicles?.length)
        }, 'gallery')
      engine.current = garage
      garage.setActive(!current.current.menuOpen, current.current.reducedMotion)
    }).catch(() => { if (!disposed) setFailed(true) })
    return () => { disposed = true; engine.current?.dispose(); engine.current = null }
  }, [attempt])
  useEffect(() => { engine.current?.setActive(!menuOpen, reducedMotion) }, [menuOpen, reducedMotion])

  const move = (direction: number) => {
    const next = (index + direction + cars.length) % cars.length
    if (engine.current?.load(cars[next].id)) { setFailed(false); setIndex(next) }
  }
  return <div className={styles.shell} data-night={!!state.night}>
    <SiteHeader active="gallery" onMenuOpenChange={setMenuOpen} />
    <main id="main-content" className={styles.main} inert={menuOpen}>
      <header className={styles.heading} data-gallery-ui>
        <a href="/gallery">← Gallery</a>
        <h1>Vehicle playground</h1>
        <p>Drag to rotate. Scroll or pinch to zoom. Make it your view.</p>
      </header>
      <div ref={mount} className={styles.stage} role="region" aria-label={`${cars[index].name} interactive 3D view`}>
        <div ref={status} className={styles.status} role="status">Loading the garage…</div>
      </div>
      {failed && <div className={styles.fallback}>
        <img src={poster} alt="Toyota 4Runner in the vehicle playground" width={1200} height={675} />
        <p role="alert">The 3D view couldn’t load on this device.</p>
        <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
      </div>}
      {!failed && <CarGalleryControls engine={engine} state={state} reducedMotion={reducedMotion} />}
      <nav className={styles.vehicleNav} aria-label="Choose a vehicle" data-gallery-ui>
        <button type="button" aria-label="Previous vehicle" disabled={state.busy || failed} onClick={() => move(-1)}>←</button>
        <p aria-live="polite"><strong>{cars[index].name}</strong><span>{index + 1} / {cars.length}</span></p>
        <button type="button" aria-label="Next vehicle" disabled={state.busy || failed} onClick={() => move(1)}>→</button>
      </nav>
    </main>
    <AnalyticsConsent onClient={ignoreAnalyticsClient} />
  </div>
}
