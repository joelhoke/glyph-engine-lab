'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState } from 'react'
import AnalyticsConsent from '../AnalyticsConsent'
import SiteHeader from '../SiteHeader'
import LightingSurface from '../lighting/LightingSurface'
import { ABOUT, type InterestId } from '../../content/about'
import { useReducedMotion } from '../../engine/useReducedMotion'
import { useSystemTheme } from '../../engine/useSystemTheme'
import { useComicPullList } from './useComicPullList'
import InterestContent from './InterestContent'
import InterestToolbar from './InterestToolbar'
import styles from '../../app/about/about.module.css'

const ignoreAnalyticsClient = () => {}
const Objects = dynamic(() => import('./InterestObjects'), { ssr: false })
export default function AboutDesktop() {
  const theme = useSystemTheme()
  const comics = useComicPullList()
  const desktop = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<InterestId>('family')
  const [highlighted, setHighlighted] = useState<InterestId | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const reduced = useReducedMotion()
  const firstFrame = useCallback(() => setReady(true), [])
  const unavailable = useCallback(() => setReady(false), [])
  const item = ABOUT.interests.find(interest => interest.id === selected)
  const suspended = menuOpen

  return <div data-lighting-page data-about-desktop ref={desktop} className={`${styles.shell} ${ready ? styles.objectsReady : ''}`}>
    <LightingSurface near active={!suspended} reducedMotion={reduced} variant="desktop" />
    <Objects host={desktop} comics={comics.snapshot.comics} highlighted={highlighted} selected={selected} active={!suspended}
      reducedMotion={reduced} onReady={firstFrame} onUnavailable={unavailable} />
    <SiteHeader active="about" onMenuOpenChange={setMenuOpen} />
    <main id="main-content" className={styles.desktop} tabIndex={-1}>
      <div className={styles.dockSpacer} aria-hidden="true" />
      {item && <InterestContent item={item} comics={comics} reducedMotion={reduced} active={!suspended} />}
      <InterestToolbar active={!suspended} reducedMotion={reduced} theme={theme} selected={selected}
        onHighlight={setHighlighted} onOpen={id => setSelected(id)} />
    </main>
    <AnalyticsConsent onClient={ignoreAnalyticsClient} />
  </div>
}
