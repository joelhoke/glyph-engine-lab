'use client'

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { STATEMENT_FLOWER as config } from '../../content/statementFlower'
import { useSectionVisibility } from './useSectionVisibility'
import { useReducedMotion } from './useReducedMotion'
import type { createFlowerRenderer } from './flower/renderer'

export default function StatementFlower({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { ref, near, active } = useSectionVisibility(enabled)
  const host = useRef<HTMLDivElement>(null)
  const renderer = useRef<ReturnType<typeof createFlowerRenderer> | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const reduced = useReducedMotion()
  const clock = useRef(0)

  useEffect(() => {
    if (!near || reduced || failed) return
    let disposed = false
    let instance: ReturnType<typeof createFlowerRenderer> | undefined
    import('./flower/renderer').then(({ createFlowerRenderer }) => {
      if (disposed || !host.current) return
      instance = createFlowerRenderer(host.current, () => setFailed(true))
      renderer.current = instance
      instance.resize()
      setReady(true)
    }).catch(() => { if (!disposed) setFailed(true) })
    return () => {
      disposed = true
      instance?.dispose()
      renderer.current = null
      setReady(false)
    }
  }, [near, reduced, failed])

  useEffect(() => {
    const instance = renderer.current, section = ref.current, element = host.current
    if (!ready || !instance || !section || !element) return
    let frame = 0, last = 0
    const resize = () => {
      const phone = matchMedia('(max-width: 767px)').matches
      const framing = phone ? config.framing.phone : config.framing.desktop
      const size = Math.min(framing.size, section.clientWidth * framing.width)
      element.style.width = `${size}px`
      element.style.height = `${size}px`
      element.style.right = `${size * framing.right}px`
      instance.resize()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(section)
    resize()
    const tick = (now: number) => {
      clock.current += last ? Math.min((now - last) / 1000, 0.05) : 0
      last = now
      const bounds = section.getBoundingClientRect()
      const progress = Math.max(0, Math.min(1, (innerHeight - bounds.top) / (innerHeight + bounds.height)))
      const framing = innerWidth < 768 ? config.framing.phone : config.framing.desktop
      element.style.transform = `translateY(calc(-50% + ${(progress * 2 - 1) * framing.parallax}px))`
      if (instance.render(progress, clock.current)) section.dataset.flowerReady = 'true'
      frame = requestAnimationFrame(tick)
    }
    if (active) frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [ready, active, ref])

  return <section ref={ref} className="home-statement-scene" data-flower-ready={ready && !failed && !reduced ? undefined : 'false'} style={{
    '--flower-desktop-size': `min(${config.framing.desktop.size}px, ${config.framing.desktop.width * 100}vw)`,
    '--flower-phone-size': `min(${config.framing.phone.size}px, ${config.framing.phone.width * 100}vw)`,
    '--flower-desktop-right': config.framing.desktop.right,
    '--flower-phone-right': config.framing.phone.right,
  } as CSSProperties}>
    <div className="home-statement-flower" aria-hidden="true">
      <img className="home-flower-poster" src={config.poster} alt="" width="720" height="720" loading="lazy" />
      <div className="home-flower-renderer" ref={host} />
    </div>
    {children}
  </section>
}
