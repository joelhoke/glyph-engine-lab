'use client'

import { useEffect, useId, useState } from 'react'
import { BorderBeam } from 'border-beam'
import { DoorwayCardContent } from '../content/site'

/** Preview cycle cadence. Paused on hover/focus; disabled entirely under
 *  prefers-reduced-motion (first frame stays put). */
const CYCLE_INTERVAL_MS = 5000

type DoorwayCardProps = {
  card: DoorwayCardContent
  selected: boolean
  onClick: () => void
  hue?: string
  style?: React.CSSProperties
}

/**
 * Homepage doorway card (homepage-redesign phase 3): replaces the bare
 * primary-action pill with evidence — a cycling 3:2 preview, the section
 * name, a one-line promise, and (Work) role/timeframe metadata. A real
 * <button>, so it stays keyboard-operable; the preview is decorative
 * (aria-hidden) because the label + promise already describe the destination.
 *
 * The BorderBeam wrapper keeps the intro-sequence reveal contract: the shell's
 * rAF loop drives `--option-progress-{i}` on the group, and the beam's
 * opacity/translate consume it (see globals.css .primary-action-beam).
 */
export default function DoorwayCard({ card, selected, onClick, hue, style }: DoorwayCardProps) {
  const stableId = useId().replace(/:/g, '-')
  const [mounted, setMounted] = useState(false)
  const [frame, setFrame] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (paused || card.previews.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % card.previews.length)
    }, CYCLE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [paused, card.previews.length])

  const beamStyle: React.CSSProperties = { ...style }
  if (hue) (beamStyle as any)['--beam-hue-base'] = hue

  const button = (
    <button
      type="button"
      className={`doorway-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="doorway-card-preview" aria-hidden="true">
        {card.previews.map((preview, index) => (
          <img
            key={preview.src}
            src={preview.src}
            alt=""
            width={600}
            height={400}
            loading="lazy"
            className={index === frame ? 'is-active' : undefined}
          />
        ))}
      </span>
      <span className="doorway-card-body">
        <span className="doorway-card-label">{card.label}</span>
        <span className="doorway-card-promise">{card.promise}</span>
        {card.meta ? <span className="doorway-card-meta">{card.meta}</span> : null}
      </span>
    </button>
  )

  if (!mounted) {
    return button
  }

  return (
    <BorderBeam
      size="sm"
      colorVariant="colorful"
      staticColors
      hueRange={0}
      theme="auto"
      strength={selected ? 0.7 : 0.45}
      className="primary-action-beam"
      style={beamStyle}
      id={stableId}
    >
      {button}
    </BorderBeam>
  )
}
