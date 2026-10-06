'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { HomeGalleryProject } from './galleryProjects'
import { galleryLoopOffset } from './galleryLoop'

function ProjectImage({ project }: { project: HomeGalleryProject }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="home-project-image">
      <span className="home-project-placeholder" aria-hidden="true">
        <span>{project.collection}</span><strong>{project.title}</strong>
      </span>
      {!failed && <img src={project.thumbnail} alt="" loading="lazy" decoding="async"
        width={960} height={600} onError={() => setFailed(true)} />}
    </span>
  )
}

export default function HomeGalleryCarousel({ projects, introduction, action, portrait }: {
  projects: HomeGalleryProject[]
  introduction: ReactNode
  action: ReactNode
  portrait: ReactNode
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  const trackId = useId()
  const looping = projects.length > 1
  const [copiesBefore, setCopiesBefore] = useState(2)
  useEffect(() => {
    const track = trackRef.current
    if (!track || !looping) return
    let period = 0
    let settleTimer: ReturnType<typeof setTimeout>
    let snapFrame = 0
    const jump = (offset: number) => {
      // Reposition between identical copies without animating or snapping
      // through the intervening projects.
      cancelAnimationFrame(snapFrame)
      track.style.scrollSnapType = 'none'
      track.scrollLeft = offset
      snapFrame = requestAnimationFrame(() => { track.style.scrollSnapType = '' })
    }
    const settle = () => {
      clearTimeout(settleTimer)
      const offset = galleryLoopOffset(track.scrollLeft, period, copiesBefore)
      if (Math.abs(offset - track.scrollLeft) > 1) jump(offset)
    }
    const measure = () => {
      const card = track.firstElementChild
      if (!card) return
      const css = getComputedStyle(track)
      const gap = parseFloat(css.columnGap) || 0
      const nextPeriod = (card.getBoundingClientRect().width + gap) * projects.length
      if (!nextPeriod) return
      // Keep enough copies on both sides even on unusually wide screens.
      const needed = Math.max(2, Math.ceil(track.clientWidth / nextPeriod) + 1)
      if (needed !== copiesBefore) { setCopiesBefore(needed); return }
      const progress = period ? galleryLoopOffset(track.scrollLeft, period, copiesBefore) / period - copiesBefore : 0
      period = nextPeriod
      jump((copiesBefore + progress) * period)
    }
    const onScroll = () => {
      clearTimeout(settleTimer)
      // Allow touch momentum and smooth arrow scrolling to finish first.
      // Recenter early only when a large gesture approaches a physical edge.
      if (track.scrollLeft < period / 2 || track.scrollLeft + track.clientWidth > track.scrollWidth - period / 2) settle()
      else settleTimer = setTimeout(settle, 160)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    track.addEventListener('scroll', onScroll, { passive: true })
    track.addEventListener('scrollend', settle)
    measure()
    return () => {
      observer.disconnect()
      clearTimeout(settleTimer)
      cancelAnimationFrame(snapFrame)
      track.style.scrollSnapType = ''
      track.removeEventListener('scroll', onScroll)
      track.removeEventListener('scrollend', settle)
    }
  }, [projects.length, looping, copiesBefore])
  const move = (direction: number) => {
    const track = trackRef.current
    const card = track?.firstElementChild
    if (!track || !card) return
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  return (
    <div className="home-gallery-carousel" role="region" aria-label="Gallery projects" aria-roledescription="carousel">
      <div id="home/gallery" className="home-section-inner home-gallery-heading home-section-anchor">
        <div className="home-gallery-copy">{introduction}</div>
        <div className="home-gallery-portrait" aria-hidden="true">{portrait}</div>
        <div className="home-gallery-action">{action}</div>
        <div className="home-gallery-controls">
          <div>
            <button type="button" aria-label="Previous projects" aria-controls={trackId}
              disabled={!looping} onClick={() => move(-1)}>←</button>
            <button type="button" aria-label="Next projects" aria-controls={trackId}
              disabled={!looping} onClick={() => move(1)}>→</button>
          </div>
        </div>
      </div>
      <ul className={`home-gallery-track${looping ? ' home-gallery-track--loop' : ''}`} ref={trackRef} id={trackId}>
        {Array.from({ length: looping ? copiesBefore * 2 + 1 : 1 }, (_, copy) => projects.map((project, index) => (
          <li key={`${copy}-${project.id}`} className="home-gallery-slide"
            aria-hidden={looping && copy !== copiesBefore ? true : undefined}>
            <a className="home-project" href={project.href}
              tabIndex={looping && copy !== copiesBefore ? -1 : undefined}>
              <ProjectImage project={project} />
              <span className="home-project-body">
                <span className="home-project-meta">{String(index + 1).padStart(2, '0')} / {project.collection}</span>
                <span className="home-project-title">{project.title}</span>
                <span className="home-project-summary">{project.summary}</span>
                <span className="home-project-access">{project.requiresPassword ? 'Open project · Password required' : 'Open project'}</span>
              </span>
            </a>
          </li>
        )))}
      </ul>
    </div>
  )
}
