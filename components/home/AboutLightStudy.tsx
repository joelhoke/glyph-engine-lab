'use client'

import { useEffect, useRef, useState } from 'react'
import copy from '../../content/aboutLightStudy.json'
import type { LightingScene } from './light-study/scene'
import type { LayoutRect } from './light-study/layout'

type Props = { near: boolean; active: boolean; reducedMotion: boolean }

/** CSS owns the layout; the 3D greeting and artwork follow measured CSS slots. */
export default function AboutLightStudy({ near, active, reducedMotion }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const headingSlot = useRef<HTMLHeadingElement>(null)
  const artworkSlot = useRef<HTMLDivElement>(null)
  const scene = useRef<LightingScene | null>(null)
  const preferences = useRef({ active, reducedMotion })
  preferences.current = { active, reducedMotion }
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!near || !host.current || !headingSlot.current || !artworkSlot.current) return
    const container = host.current
    const heading = headingSlot.current
    const artwork = artworkSlot.current
    const abort = new AbortController()
    const theme = window.matchMedia('(prefers-color-scheme: light)')
    const mobile = window.matchMedia('(max-width: 767px)')
    let instance: LightingScene | undefined
    let loaded = false
    const syncLayout = () => {
      if (!loaded || abort.signal.aborted) return
      const hostRect = container.getBoundingClientRect()
      const localRect = (element: HTMLElement): LayoutRect => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left - hostRect.left, top: rect.top - hostRect.top, width: rect.width, height: rect.height }
      }
      instance?.setLayout({ heading: localRect(heading), artwork: localRect(artwork), mobile: mobile.matches })
    }
    const syncTheme = () => {
      if (!loaded || abort.signal.aborted) return
      const styles = getComputedStyle(container)
      const color = (name: string) => styles.getPropertyValue(name).trim()
      instance?.updateSettings({ brightness: theme.matches || mobile.matches ? 100 : 200 })
      instance?.setTheme(color('--about-wall'), color('--color-text'), color('--color-hero-blue-mid'), color('--color-hero-blue-edge'), color('--about-glass'))
    }
    const observer = new ResizeObserver(syncLayout)
    observer.observe(container)
    observer.observe(heading)
    observer.observe(artwork)
    theme.addEventListener('change', syncTheme)
    mobile.addEventListener('change', syncLayout)
    mobile.addEventListener('change', syncTheme)
    const fail = () => {
      if (abort.signal.aborted) return
      loaded = false
      setStatus('error')
      instance?.dispose()
      scene.current = null
    }
    const reveal = () => {
      if (!loaded || abort.signal.aborted) return
      setStatus('ready')
      performance.mark('home:section:about:first-frame')
      container.removeEventListener('study-render', reveal)
    }
    container.addEventListener('lighting-error', fail)
    container.addEventListener('study-render', reveal)

    async function load() {
      try {
        const [{ createLightingScene }, project] = await Promise.all([
          import('./light-study/scene'),
          fetch('/assets/about-light-study/light-study-3.json', { signal: abort.signal })
            .then(response => {
              if (!response.ok) throw new Error('Unable to load the About composition.')
              return response.json()
            }),
        ])
        if (abort.signal.aborted) return
        instance = createLightingScene(container)
        scene.current = instance
        instance.setActive(preferences.current.active)
        instance.setArrangeMode(false)
        await instance.ready
        if (abort.signal.aborted) return
        await instance.loadProject(project)
        if (abort.signal.aborted) return
        instance.setMotionEnabled(project.motionEnabled && !preferences.current.reducedMotion)
        loaded = true
        syncTheme()
        syncLayout()
        // Font loading may change the surrounding grid after the scene is ready.
        void document.fonts.ready.then(syncLayout)
        // Reveal only when the loaded composition, theme and measured layout
        // have actually rendered. Offscreen sections keep their preview.
        instance.invalidate()
      } catch (error) {
        if (!abort.signal.aborted) console.error('About light study:', error)
        fail()
      }
    }
    void load()
    return () => {
      abort.abort()
      observer.disconnect()
      theme.removeEventListener('change', syncTheme)
      mobile.removeEventListener('change', syncLayout)
      mobile.removeEventListener('change', syncTheme)
      container.removeEventListener('lighting-error', fail)
      container.removeEventListener('study-render', reveal)
      instance?.dispose()
      scene.current = null
    }
  }, [near])

  useEffect(() => { scene.current?.setActive(active) }, [active])
  useEffect(() => { scene.current?.setMotionEnabled(!reducedMotion) }, [reducedMotion])

  return <div className={`home-about-study home-about-study--${status}`}>
    <div ref={host} className="home-about-study-scene" aria-hidden="true" />
    <div className="home-about-study-layout">
      <div ref={artworkSlot} className="home-about-study-artwork" role="img" aria-label={status === 'ready' ? 'Joel with his family, beneath an interactive hanging light bulb' : 'Joel with his family'}>
        <div className="home-about-study-preview" aria-hidden="true">
          <img src="/assets/about-light-study/placeholder.webp" alt="" loading="lazy" decoding="async" width={1328} height={1238} />
        </div>
      </div>
      <div className="home-about-study-copy">
        <h2 ref={headingSlot} id="home-about-heading" tabIndex={-1}><span>{copy.heading}</span></h2>
        {copy.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        <a className="home-section-action" href="/#home/collaborate">Say hello</a>
      </div>
    </div>
  </div>
}
