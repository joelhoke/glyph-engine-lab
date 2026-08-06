'use client'

/**
 * Visual Sonification experiment (debug-only): the visible scan line.
 *
 * A pointer-transparent, aria-hidden DOM overlay — deliberately NOT painted
 * into the canvas, so the analysis sampler never reads its own marker. The
 * position is driven by the audio clock (engine getSweepPosition), read on a
 * rAF while playback is active. Under reduced motion the smoothly moving
 * line becomes a discrete band highlight that steps once per scan step; the
 * explicitly requested audio keeps playing either way.
 */

import { useEffect, useRef, useState } from 'react'
import {
  isHorizontalSonificationDirection,
  isReversedSonificationDirection,
  SonificationDirection,
  SONIFICATION_STEPS,
} from '../../engine/sonificationConfig'

export type SonificationOverlayProps = {
  /** Render only while playing/paused in debug mode. */
  active: boolean
  /** Audio-clock sweep position 0..1 in playback direction, null when idle. */
  getSweepPosition: () => number | null
  /** Direction of the sweep in flight (changes land on the next sweep). */
  getActiveDirection: () => SonificationDirection
}

export default function SonificationOverlay({
  active,
  getSweepPosition,
  getActiveDirection,
}: SonificationOverlayProps) {
  const lineRef = useRef<HTMLDivElement>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(query.matches)
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!active) return
    let raf = 0
    const update = () => {
      raf = requestAnimationFrame(update)
      const el = lineRef.current
      if (!el) return
      const position = getSweepPosition()
      if (position === null) {
        el.style.opacity = '0'
        return
      }
      const direction = getActiveDirection()
      const horizontal = isHorizontalSonificationDirection(direction)
      const reversed = isReversedSonificationDirection(direction)
      // Canonical fraction along the sweep axis (0 = the left/top edge).
      const canonical = reversed ? 1 - position : position
      const fraction = reducedMotion
        ? Math.min(SONIFICATION_STEPS - 1, Math.floor(canonical * SONIFICATION_STEPS)) /
          SONIFICATION_STEPS
        : canonical
      const pct = `${(fraction * 100).toFixed(3)}%`
      el.style.opacity = '1'
      el.dataset.axis = horizontal ? 'x' : 'y'
      if (horizontal) {
        el.style.left = pct
        el.style.top = '0'
      } else {
        el.style.top = pct
        el.style.left = '0'
      }
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [active, getSweepPosition, getActiveDirection, reducedMotion])

  if (!active) return null

  return (
    <div className="sonification-scan-overlay" aria-hidden="true">
      <div
        ref={lineRef}
        className={`sonification-scanline${reducedMotion ? ' sonification-scanline-stepped' : ''}`}
        data-axis="x"
      />
    </div>
  )
}
