'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { HOME_HIGHLIGHTS, type HomeHighlight } from '../../content/homeHighlights'
import { HighlightPlayback } from './highlightPlayback'
import { useSectionVisibility } from './useSectionVisibility'
import { useReducedMotion } from './useReducedMotion'

function usePortrait() {
  const [portrait, setPortrait] = useState<boolean | null>(null)
  useEffect(() => {
    const query = matchMedia('(max-width: 767px)')
    const update = () => setPortrait(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return portrait
}

const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function HighlightMedia({ item, active, near, portrait, reduced }: {
  item: HomeHighlight; active: boolean; near: boolean; portrait: boolean | null; reduced: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  const { ref: frameRef, active: mediaActive } = useSectionVisibility<HTMLDivElement>(active)
  const playback = useRef<HighlightPlayback | null>(null)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const selected = portrait === null ? null : item.sources[portrait ? 'portrait' : 'landscape']
  useEffect(() => {
    if (!video.current) return
    const controller = new HighlightPlayback(video.current, setBlocked)
    playback.current = controller
    return () => { controller.dispose(); playback.current = null }
  }, [])
  useEffect(() => { playback.current?.configure(mediaActive, reduced) }, [mediaActive, reduced])
  useEffect(() => {
    if (near && selected) {
      setError(false)
      playback.current?.setSource(selected.src)
    }
  }, [near, selected])
  const toggle = () => {
    if (playing) playback.current?.pause()
    else playback.current?.play()
  }
  return <>
    <div ref={frameRef} className="home-highlight-frame" style={{
      '--highlight-landscape-ratio': `${item.sources.landscape.width} / ${item.sources.landscape.height}`,
      '--highlight-portrait-ratio': `${item.sources.portrait.width} / ${item.sources.portrait.height}`,
    } as CSSProperties}>
      {item.media === 'video' && <video ref={video} muted playsInline loop preload="metadata"
        aria-label={item.alt} poster={selected?.poster}
        onPlaying={() => { setPlaying(true); setStarted(true) }} onPause={() => setPlaying(false)}
        onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
        onError={() => setError(true)} />}
      {(item.media === 'image' || !started || blocked || error || (reduced && !playing)) && <picture className="home-highlight-poster">
        <source media="(min-width: 768px)" srcSet={item.media === 'image' ? item.sources.landscape.src : item.sources.landscape.poster} />
        <img src={item.media === 'image' ? item.sources.portrait.src : item.sources.portrait.poster}
          alt={item.media === 'image' ? item.alt : ''} width={item.sources.portrait.width} height={item.sources.portrait.height} loading="lazy" />
      </picture>}
      {item.media === 'video' && !playing && !error && <button className="home-highlight-play" onClick={toggle} aria-label={`Play ${item.title}`}>
        <span aria-hidden="true">▶</span> Play recap
      </button>}
    </div>
    {item.media === 'video' && <div className="home-highlight-controls">
      <button onClick={toggle} disabled={error} aria-label={`${playing ? 'Pause' : 'Play'} ${item.title}`}>{playing ? 'Pause' : 'Play'}</button>
      <label className="home-highlight-seek">
        <span className="sr-only">Playback position for {item.title}</span>
        <input type="range" min="0" max={duration || 1} step="0.1" value={position} disabled={!duration || error}
          aria-valuetext={duration ? `${timestamp(position)} of ${timestamp(duration)}` : 'Loading video duration'}
          onChange={event => { if (video.current && duration) { video.current.currentTime = Number(event.target.value); setPosition(Number(event.target.value)) } }} />
      </label>
      <span className="home-highlight-time">{timestamp(position)} / {duration ? timestamp(duration) : '–:––'}</span>
      {error && <span role="status">Video unavailable. Please reload to retry.</span>}
    </div>}
  </>
}

export default function HomeHighlights({ enabled, items = HOME_HIGHLIGHTS }: { enabled: boolean; items?: HomeHighlight[] }) {
  const { ref, near, active } = useSectionVisibility(enabled)
  const [index, setIndex] = useState(0)
  const portrait = usePortrait()
  const reduced = useReducedMotion()
  const touch = useRef<{ x: number; y: number } | null>(null)
  const multiple = items.length > 1
  const current = Math.min(index, Math.max(0, items.length - 1))
  const move = (delta: number) => setIndex((current + delta + items.length) % items.length)
  if (!items.length) return null
  return <section ref={ref} className="home-highlights home-section-inner" aria-label="Featured highlights"
    aria-roledescription={multiple ? 'carousel' : undefined} tabIndex={multiple ? 0 : undefined}
    onKeyDown={event => {
      if (!multiple || (event.target as HTMLElement).matches('input, textarea, select')) return
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        // Moving away from a slide's Play/link control must not strand focus
        // inside a hidden article. The carousel remains the keyboard target.
        event.preventDefault()
        event.currentTarget.focus({ preventScroll: true })
      }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      if (event.key === 'Home') { event.preventDefault(); setIndex(0) }
      if (event.key === 'End') { event.preventDefault(); setIndex(items.length - 1) }
    }}>
    <div onTouchStart={event => {
      if ((event.target as HTMLElement).closest('button, input, a') || event.touches.length !== 1) { touch.current = null; return }
      touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
    }} onTouchCancel={() => { touch.current = null }} onTouchEnd={event => {
      if (!touch.current || !multiple) return
      const dx = event.changedTouches[0].clientX - touch.current.x, dy = event.changedTouches[0].clientY - touch.current.y
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1)
      touch.current = null
    }}>
      {items.map((item, itemIndex) => <article key={item.id} hidden={itemIndex !== current}
        aria-roledescription={multiple ? 'slide' : undefined} aria-label={multiple ? `${itemIndex + 1} of ${items.length}` : undefined}>
        <HighlightMedia item={item} active={active && itemIndex === current} near={near && itemIndex === current}
          portrait={portrait} reduced={reduced} />
        <header className="home-highlight-heading">
          <h2>{item.title}</h2>
          <p>{item.caption}</p>
        </header>
        {item.destination && <a className="home-highlight-destination" href={item.destination.href}>{item.destination.label} <span aria-hidden="true">↗</span></a>}
      </article>)}
    </div>
    {multiple && <nav className="home-highlight-navigation" aria-label="Highlight navigation">
      <button onClick={() => move(-1)} aria-label="Previous highlight">←</button>
      {items.map((item, itemIndex) => <button key={item.id} aria-label={`Show highlight ${itemIndex + 1}: ${item.title}`}
        aria-current={itemIndex === current ? 'true' : undefined} onClick={() => setIndex(itemIndex)}>{itemIndex + 1}</button>)}
      <button onClick={() => move(1)} aria-label="Next highlight">→</button>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{current + 1} of {items.length}: {items[current].title}</span>
    </nav>}
  </section>
}
