'use client'

import { KeyboardEvent, RefObject, useEffect, useRef } from 'react'
import {
  getWorkSlide,
  getWorkSlideMark,
  getWorkSlideTitle,
  nextWorkStoryIndex,
  previousWorkStoryIndex,
  WorkSlide,
} from '../../content/work'
import { AnalyticsEvent } from '../../engine/analytics'
import WorkStoryView from './WorkStory'

type WorkExperienceProps = {
  slides: WorkSlide[]
  activeIndex: number
  onIndexChange: (index: number) => void
  /** Mode-level focus target (owned by PortfolioExperience's focus management). */
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Base document title; the slide title is appended on slide changes. */
  titleBase: string
  /** Mode document title from the scene descriptor (e.g. "Work"). */
  modeTitle: string
  /** Consented public analytics events; no-op before opt-in. */
  onTrackEvent?: (event: AnalyticsEvent) => void
}

/**
 * Authored narrative Work surface: one slide at a time with prev/next and
 * arrow-key traversal. Slide 1 is the intro (title + the tenure copy); the
 * remaining slides are the case studies. The active index is controlled by
 * PortfolioExperience so the same state also drives the canvas descriptor
 * (per-slide source, palette, behavior) — slide changes morph the persistent
 * glyph population rather than remounting anything here.
 */
export default function WorkExperience({
  slides,
  activeIndex,
  onIndexChange,
  headingRef,
  titleBase,
  modeTitle,
  onTrackEvent,
}: WorkExperienceProps) {
  const slide = getWorkSlide(activeIndex)
  const mark = getWorkSlideMark(slide)
  const slideTitle = getWorkSlideTitle(slide)
  const slideHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const panelRef = useRef<HTMLElement | null>(null)
  const hasMountedRef = useRef(false)

  // Slide change: reset the panel's own scroll position (the card is the
  // scroll container), move focus to the new slide heading without
  // scrolling, and extend the document title. The document and foreground
  // shell must not move — never scroll the heading into view here.
  // Expansion/lightbox state lives inside WorkStoryView, which remounts on
  // slide change (key={slide id}) — so both close automatically. The first
  // render is skipped — entering the mode is handled by the M3 mode-level
  // focus/title management (which focuses headingRef).
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (panelRef.current) panelRef.current.scrollTop = 0
    slideHeadingRef.current?.focus({ preventScroll: true })
    document.title = `${titleBase} — ${modeTitle} — ${slideTitle}`
  }, [activeIndex, slideTitle, titleBase, modeTitle])

  const goToPrevious = () => onIndexChange(previousWorkStoryIndex(activeIndex, slides.length))
  const goToNext = () => onIndexChange(nextWorkStoryIndex(activeIndex, slides.length))

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Never intercept keys aimed at the media lightbox, media elements, or
    // form controls — those own their arrow-key behavior.
    const target = event.target as HTMLElement | null
    if (
      target &&
      (target.closest('.work-lightbox') ||
        ['VIDEO', 'AUDIO', 'IFRAME', 'INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    ) {
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goToPrevious()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goToNext()
    }
  }

  return (
    <section
      className="work-experience"
      aria-label="Work case studies"
      onKeyDown={handleKeyDown}
      ref={panelRef}
    >
      <div className="work-card-header">
        <h2
          ref={headingRef as RefObject<HTMLHeadingElement>}
          tabIndex={-1}
          className="work-mode-heading"
        >
          Work
        </h2>
        {/* Reusable brand-mark slot: rendered for any slide that carries one
            (all current slides are Microsoft case studies), stable in the
            card header across slide changes and expanded case studies. */}
        <span className="work-slide-mark" aria-hidden={mark?.alt ? undefined : true}>
          {mark && (
            <picture>
              {mark.lightSrc && (
                <source srcSet={mark.lightSrc} media="(prefers-color-scheme: light)" />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mark.src} alt={mark.alt ?? ''} />
            </picture>
          )}
        </span>
      </div>
      {slide.kind === 'intro' ? (
        <article
          className="work-story work-slide-intro"
          aria-labelledby={`work-slide-title-${slide.id}`}
        >
          <h3
            id={`work-slide-title-${slide.id}`}
            ref={slideHeadingRef}
            tabIndex={-1}
            className="work-story-title"
          >
            {slide.title}
          </h3>
          <p className="work-mode-intro">{slide.copy}</p>
        </article>
      ) : (
        <WorkStoryView
          key={slide.story.id}
          story={slide.story}
          headingRef={slideHeadingRef}
          onTrackEvent={onTrackEvent}
        />
      )}
      {slides.length > 1 && (
        <div className="work-controls">
          <button
            type="button"
            className="work-nav-button"
            onClick={goToPrevious}
            aria-label="Previous slide"
          >
            <span aria-hidden="true">←</span> Prev
          </button>
          <p className="work-progress">
            {activeIndex + 1} / {slides.length}
          </p>
          <button
            type="button"
            className="work-nav-button"
            onClick={goToNext}
            aria-label="Next slide"
          >
            Next <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </section>
  )
}
