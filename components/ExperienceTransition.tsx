'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { ExperienceMode } from '../engine/types'

export type ExperienceTransitionPhase = 'leaving' | 'morphing' | 'settled'

const LEAVE_DURATION_MS = 220
const MORPH_DURATION_MS = 420

/**
 * Drives the leaving → morphing → settled lifecycle around mode changes.
 *
 * `displayed` lags `target`: the outgoing content stays mounted during
 * `leaving`, swaps at the start of `morphing` (the same moment the canvas
 * begins morphing to the new scene), and the lifecycle settles afterwards.
 * Rapid re-targeting clears the pending timers, so the last selected mode
 * always wins. Reduced-motion users get an instant content swap with no
 * animated travel.
 */
export function useExperienceTransition(target: ExperienceMode) {
  const [displayed, setDisplayed] = useState(target)
  const [phase, setPhase] = useState<ExperienceTransitionPhase>('settled')
  const displayedRef = useRef(target)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    if (target === displayedRef.current) return undefined

    const clearTimers = () => {
      for (const timer of timersRef.current) window.clearTimeout(timer)
      timersRef.current = []
    }
    clearTimers()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      displayedRef.current = target
      setDisplayed(target)
      setPhase('settled')
      return undefined
    }

    setPhase('leaving')
    timersRef.current.push(
      window.setTimeout(() => {
        displayedRef.current = target
        setDisplayed(target)
        setPhase('morphing')
      }, LEAVE_DURATION_MS),
    )
    timersRef.current.push(
      window.setTimeout(() => {
        setPhase('settled')
      }, LEAVE_DURATION_MS + MORPH_DURATION_MS),
    )
    return clearTimers
  }, [target])

  return { displayed, phase }
}

type ExperienceTransitionProps = {
  phase: ExperienceTransitionPhase
  children: ReactNode
}

export default function ExperienceTransition({ phase, children }: ExperienceTransitionProps) {
  return (
    <div className={`experience-transition experience-transition-${phase}`}>
      {children}
    </div>
  )
}
