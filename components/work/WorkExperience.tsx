'use client'

import { KeyboardEvent, RefObject, useEffect, useRef } from 'react'
import {
  getWorkStory,
  nextWorkStoryIndex,
  previousWorkStoryIndex,
  WORK_INTRO,
  WorkStory,
} from '../../content/work'
import { AnalyticsEvent } from '../../engine/analytics'
import WorkStoryView from './WorkStory'

type WorkExperienceProps = {
  stories: WorkStory[]
  activeIndex: number
  onIndexChange: (index: number) => void
  /** Mode-level focus target (owned by PortfolioExperience's focus management). */
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Base document title; the story title is appended on story changes. */
  titleBase: string
  /** Mode document title from the scene descriptor (e.g. "Work"). */
  modeTitle: string
  /** Consented public analytics events; no-op before opt-in. */
  onTrackEvent?: (event: AnalyticsEvent) => void
}

/**
 * Authored narrative Work surface: one case study at a time with prev/next
 * and arrow-key traversal. The active index is controlled by
 * PortfolioExperience so the same state also drives the canvas descriptor
 * (per-story source, palette, behavior) — story changes morph the persistent
 * glyph population rather than remounting anything here.
 */
export default function WorkExperience({
  stories,
  activeIndex,
  onIndexChange,
  headingRef,
  titleBase,
  modeTitle,
  onTrackEvent,
}: WorkExperienceProps) {
  const story = getWorkStory(activeIndex)
  const storyHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const hasMountedRef = useRef(false)

  // Story change: scroll the story heading into view, move focus to it, and
  // extend the document title. Expansion/lightbox state lives inside
  // WorkStoryView, which remounts on story change (key={story.id}) — so both
  // close automatically. The first render is skipped — entering the mode is
  // handled by the M3 mode-level focus/title management (which focuses
  // headingRef).
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    const heading = storyHeadingRef.current
    if (heading) {
      heading.scrollIntoView({ block: 'start' })
      heading.focus({ preventScroll: true })
    }
    document.title = `${titleBase} — ${modeTitle} — ${story.title}`
  }, [activeIndex, story.title, titleBase, modeTitle])

  const goToPrevious = () => onIndexChange(previousWorkStoryIndex(activeIndex, stories.length))
  const goToNext = () => onIndexChange(nextWorkStoryIndex(activeIndex, stories.length))

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
    >
      <h2
        ref={headingRef as RefObject<HTMLHeadingElement>}
        tabIndex={-1}
        className="work-mode-heading"
      >
        Work
      </h2>
      <p className="work-mode-intro">{WORK_INTRO}</p>
      <WorkStoryView key={story.id} story={story} headingRef={storyHeadingRef} onTrackEvent={onTrackEvent} />
      {stories.length > 1 && (
        <div className="work-controls">
          <button
            type="button"
            className="work-nav-button"
            onClick={goToPrevious}
            aria-label="Previous case study"
          >
            <span aria-hidden="true">←</span> Prev
          </button>
          <p className="work-progress">
            {activeIndex + 1} / {stories.length}
          </p>
          <button
            type="button"
            className="work-nav-button"
            onClick={goToNext}
            aria-label="Next case study"
          >
            Next <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </section>
  )
}
