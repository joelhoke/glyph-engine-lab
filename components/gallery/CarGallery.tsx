'use client'
import { useState } from 'react'
import SiteHeader from '../SiteHeader'
import CarsPlayground from '../about/CarsPlayground'
import AnalyticsConsent from '../AnalyticsConsent'
import { useReducedMotion } from '../../engine/useReducedMotion'
import styles from '../../app/about/about.module.css'
const ignoreAnalyticsClient = () => {}

export default function CarGallery() {
  const reduced = useReducedMotion()
  const [night, setNight] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  return <div data-lighting-page data-night={night} className={`${styles.shell} ${styles.carGalleryShell}`}>
    <SiteHeader active="gallery" onMenuOpenChange={setMenuOpen} />
    <main id="main-content" className={styles.carGalleryMain} inert={menuOpen}>
      <h1 className={styles.visuallyHidden}>Car gallery</h1>
      <a href="/gallery" className={styles.carGalleryBack}>← Gallery</a>
      <CarsPlayground mode="gallery" onNightChange={setNight} active={!menuOpen} reducedMotion={reduced} />
    </main>
    <AnalyticsConsent onClient={ignoreAnalyticsClient} />
  </div>
}
