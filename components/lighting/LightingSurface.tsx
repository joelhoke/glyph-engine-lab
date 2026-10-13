'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { SCENE_LIGHT_PALETTE } from '../home/light-study/palette'
import type { LightingScene } from '../home/light-study/scene'
import type { LayoutRect } from '../home/light-study/layout'
import styles from './lighting.module.css'

type Status = 'loading' | 'ready' | 'error'
type Props = {
  near: boolean; active: boolean; reducedMotion: boolean
  variant?: 'home' | 'desktop'; className?: string
  headingSlot?: RefObject<HTMLHeadingElement | null>
  artworkSlot?: RefObject<HTMLDivElement | null>
  onStatusChange?: (status: Status) => void
}
const emptyRect: LayoutRect = { left: 0, top: 0, width: 0, height: 0 }

/** One renderer, preset, theme and interaction lifecycle for the site's hanging light. */
export default function LightingSurface({ near, active, reducedMotion, variant = 'home', className = '', headingSlot, artworkSlot, onStatusChange }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<LightingScene | null>(null)
  const preferences = useRef({ active, reducedMotion })
  preferences.current = { active, reducedMotion }
  const [lightOn, setLightOn] = useState(true)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!near || !host.current) return
    const container = host.current
    const heading = headingSlot?.current
    const artwork = artworkSlot?.current
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
      instance?.setLayout({ heading: heading ? localRect(heading) : emptyRect, artwork: artwork ? localRect(artwork) : emptyRect, mobile: mobile.matches,

      })
    }
    const syncTheme = () => {
      if (!loaded || abort.signal.aborted) return
      const styles = getComputedStyle(container)
      const color = (name: string) => styles.getPropertyValue(name).trim()
      if (variant === 'home') instance?.updateSettings({ brightness: theme.matches || mobile.matches ? 100 : 200 })
      instance?.setTheme(color('--light-wall'), color('--color-text'), color('--color-hero-blue-mid'), color('--color-hero-blue-edge'), color('--light-glass'), theme.matches ? 'light' : 'dark')
      instance?.setColorCycle(SCENE_LIGHT_PALETTE)
    }
    const observer = new ResizeObserver(syncLayout)
    observer.observe(container)
    if (heading) observer.observe(heading)
    if (artwork) observer.observe(artwork)
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
      if (variant === 'home') performance.mark('home:section:about:first-frame')
      container.removeEventListener('study-render', reveal)
    }
    const syncLight = () => { if (instance) setLightOn(instance.lightOn) }
    container.addEventListener('study-change', syncLight)
    container.addEventListener('lighting-error', fail)
    container.addEventListener('study-render', reveal)

    async function load() {
      try {
        const [{ createLightingScene }, project] = await Promise.all([
          import('../home/light-study/scene'),
          fetch('/assets/about-light-study/light-study-3.json', { signal: abort.signal })
            .then(response => {
              if (!response.ok) throw new Error('Unable to load the About composition.')
              return response.json()
            }),
        ])
        if (abort.signal.aborted) return
        instance = createLightingScene(container, { desktop: variant === 'desktop' })
        scene.current = instance
        instance.setActive(preferences.current.active)
        instance.setArrangeMode(false)
        await instance.ready
        if (abort.signal.aborted) return
        await instance.loadProject(variant === 'desktop' ? { ...project, items: [] } : project)
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
      container.removeEventListener('study-change', syncLight)
      container.removeEventListener('lighting-error', fail)
      container.removeEventListener('study-render', reveal)
      instance?.dispose()
      scene.current = null
    }
  }, [near, variant, headingSlot, artworkSlot])

  useEffect(() => { scene.current?.setActive(active) }, [active])
  useEffect(() => { scene.current?.setMotionEnabled(!reducedMotion) }, [reducedMotion])

  useEffect(() => { onStatusChange?.(status) }, [status, onStatusChange])

  return <>
    <div ref={host} className={`${styles.surface} ${variant === 'desktop' ? styles.desktop : ''} ${className}`}
    data-lighting-surface={variant} data-status={status} data-light-on={lightOn} aria-hidden={variant === 'home' ? true : undefined} />
    {variant === 'home' && status === 'ready' && active && <button type="button" className={styles.toggle} aria-label="Light" aria-pressed={lightOn}
      onClick={() => scene.current?.toggleLight()}>Turn light {lightOn ? 'off' : 'on'}</button>}
  </>
}
