'use client'

import type { MouseEvent, KeyboardEvent } from 'react'
import './MobileDockControls.css'
import { MOBILE_CAROUSEL_DELAY_MS } from './home/mobileHero'

/** Shared navigation chrome; each scene only decides where to place it. */
export function MobileDockArrow({ direction, onStep }: { direction: -1 | 1; onStep: (direction: number) => void }) {
  return <button type="button" className={`home-hero-mobile-arrow home-hero-mobile-arrow--${direction === -1 ? 'previous' : 'next'}`}
    aria-label={direction === -1 ? 'Previous section' : 'Next section'} onClick={() => onStep(direction)}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d={direction === -1 ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'} />
    </svg>
  </button>
}

export function MobileDockLabel({ id, label, index, count, href, onActivate, onKeyDown, timerKey, autoRunning }: {
  id?: string; label?: string; index: number; count: number; href?: string
  onActivate: (event: MouseEvent<HTMLElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  timerKey: string; autoRunning: boolean
}) {
  const face = <>
    <span key={id} className="home-hero-label-pixels">{label}</span>
    <span key={timerKey} className="home-hero-label-timer" aria-hidden="true" data-running={autoRunning}
      style={{ animationDuration: `${MOBILE_CAROUSEL_DELAY_MS}ms` }} />
  </>
  return <div className="home-hero-mobile-controls" onKeyDown={onKeyDown}>
    <div className="home-hero-mobile-label">
      {label ? href ? <a href={href} onClick={onActivate}>{face}</a>
        : <button type="button" onClick={onActivate}>{face}</button> : <span>Explore</span>}
    </div>
    <span className="visually-hidden" role="status" aria-live={autoRunning ? 'off' : 'polite'} aria-atomic="true">
      {label ? `${label}, ${index + 1} of ${count}` : ''}
    </span>
  </div>
}
