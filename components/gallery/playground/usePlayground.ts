'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../home/useReducedMotion'
import { useSectionVisibility } from '../../home/useSectionVisibility'

export interface PlaygroundEngine<S> {
  update(settings: S): void
  render(delta: number, running: boolean): void
  dispose(): void
}
export type EngineFactory<S> = (canvas: HTMLCanvasElement, settings: S, fail: (message: string) => void) => Promise<PlaygroundEngine<S>>

/** One lifecycle for lazy loading, motion preferences, visibility, and GPU cleanup. */
export function usePlayground<S>(settings: S, create: EngineFactory<S>) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<PlaygroundEngine<S> | null>(null)
  const latest = useRef(settings)
  const [menuOpen, setMenuOpen] = useState(false)
  const { ref, near, active } = useSectionVisibility<HTMLDivElement>(!menuOpen)
  const reduced = useReducedMotion()
  const [intent, setIntent] = useState<'auto' | 'play' | 'pause'>('auto')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const running = intent === 'play' || (intent === 'auto' && !reduced)
  useEffect(() => { if (reduced) setIntent(value => value === 'play' ? 'pause' : value) }, [reduced])
  useEffect(() => {
    latest.current = settings
    try { engine.current?.update(settings); engine.current?.render(0, false) }
    catch { setError('The preview could not update. Try resetting the playground.') }
  }, [settings])
  useEffect(() => {
    if (!near || !canvas.current) return
    let canceled = false
    let instance: PlaygroundEngine<S> | undefined
    setReady(false); setError('')
    const fail = (message: string) => { if (!canceled) setError(message) }
    const lost = (event: Event) => { event.preventDefault(); fail('The graphics connection was interrupted. Reset to try again.') }
    const element = canvas.current
    element.addEventListener('webglcontextlost', lost)
    create(element, latest.current, fail).then(value => {
      if (canceled) { value.dispose(); return }
      instance = value; engine.current = value
      value.update(latest.current); value.render(0, false); setReady(true)
    }).catch(() => fail('The preview could not start. Try resetting, or use a browser with hardware acceleration.'))
    return () => { canceled = true; element.removeEventListener('webglcontextlost', lost); instance?.dispose(); engine.current = null }
  }, [near, create, revision])
  useEffect(() => {
    if (!ready || !active || error) return
    let frame = 0, last = 0
    const tick = (now: number) => {
      try { engine.current?.render(last ? Math.min((now - last) / 1000, 0.05) : 0, running) }
      catch { setError('The preview stopped. Reset to try again.'); return }
      last = now; frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [ready, active, running, error])
  return { canvas, ref, ready, error, reduced, running, setMenuOpen,
    toggle: () => setIntent(running ? 'pause' : 'play'),
    reset: () => { setIntent('auto'); setRevision(value => value + 1) },
  }
}
