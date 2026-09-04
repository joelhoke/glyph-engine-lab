'use client'

import { KeyboardEvent, RefObject, useEffect, useRef, useState } from 'react'
import {
  getWorkSlide,
  getWorkSlideMark,
  getWorkSlideTitle,
  nextWorkStoryIndex,
  previousWorkStoryIndex,
  WorkSlide,
} from '../../content/work'
import { AnalyticsEvent } from '../../engine/analytics'
import BoundedScrollPanel from '../BoundedScrollPanel'
import WorkStoryView from './WorkStory'
import { MIN_EXPANSION_RANGE_PX } from './expansionRange'

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
  /** Scroll-scrubbed expansion, 0 (compact) to 1 (expanded reading panel).
   *  Controlled by PortfolioExperience so gap gestures and mode changes share
   *  the same value. */
  expansionProgress: number
  onExpansionProgressChange: (progress: number) => void
  /** Reports the active slide's expansion metrics (measured from compact
   *  geometry only): whether the content overflows its compact viewport, and
   *  the card's expansion travel in px — the scrub denominator shared by card
   *  and gap gestures. PortfolioExperience gates gap gestures on this. */
  onExpansionMetricsChange?: (metrics: WorkExpansionMetrics) => void
  /** Consented public analytics events; no-op before opt-in. */
  onTrackEvent?: (event: AnalyticsEvent) => void
}

/** Expansion metrics reported to PortfolioExperience: overflow eligibility
 *  plus the card's expansion travel (compactCardTop - expandedCardTop), the
 *  scrub denominator both card and gap gestures accumulate against. */
export type WorkExpansionMetrics = {
  eligible: boolean
  rangePx: number
}

/** scrollTop tolerance for "at the top" — sub-pixel scroll positions count. */
const TOP_EPSILON = 1
/** Slides overflowing their compact viewport by more than this are expandable. */
const OVERFLOW_TOLERANCE_PX = 8
/** Below this width the expanded panel goes edge-to-edge (matches globals.css). */
const MOBILE_MEDIA_QUERY = '(max-width: 760px)'
/** Compact card border radius (globals.css) — interpolated to 0 on mobile. */
const CARD_RADIUS_PX = 12
/** Safe positive minimum for the expansion range (a degenerate measurement
 *  must never divide the scrub by ~0). Defined in ./expansionRange so the
 *  landing chunk shares the constant without importing this subtree. */
export { MIN_EXPANSION_RANGE_PX }
/** The compact fold hides the first story section this far below the visible
 *  edge, absorbing sub-pixel/late layout settling (font metrics, marks). */
const FOLD_HIDE_MARGIN_PX = 8
/** Mobile drags cover only this fraction of the card's expansion travel for
 *  the full 0→1 scrub (desktop keeps 1:1). */
const MOBILE_SCRUB_RANGE_FACTOR = 0.48

/** One full visual-viewport height of accumulated input = the full 0→1 scrub. */
function visualViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight
}

let safeAreaCache: { top: number; bottom: number } | null = null
/** CSS env() safe-area insets, read once via a probe (reset on resize). */
function safeAreaInsets(): { top: number; bottom: number } {
  if (safeAreaCache) return safeAreaCache
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  safeAreaCache = {
    top: parseFloat(style.paddingTop) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
  }
  probe.remove()
  return safeAreaCache
}

type Rect = { left: number; top: number; width: number; height: number }

/** The fully-expanded target rect in viewport coordinates: desktop keeps the
 *  60rem-capped panel inside the 4rem reserves; mobile goes edge-to-edge. */
function expandedRect(): Rect {
  const vw = window.visualViewport?.width ?? window.innerWidth
  const vh = visualViewportHeight()
  if (window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
    return { left: 0, top: 0, width: vw, height: vh }
  }
  const safe = safeAreaInsets()
  const width = Math.min(960, vw - 64) // min(60rem, 100vw - 4rem)
  const height = vh - 128 - safe.top - safe.bottom // 100dvh - 8rem - safe areas
  return { left: (vw - width) / 2, top: 64 + safe.top, width, height }
}

/**
 * Authored narrative Work surface: one slide at a time with prev/next and
 * arrow-key traversal. Slide 1 is the intro (title + the tenure copy); the
 * remaining slides are the case studies. The active index is controlled by
 * PortfolioExperience so the same state also drives the canvas descriptor.
 *
 * Expansion is a scroll-SCRUBBED transition, not a binary toggle: the card's
 * own expansion travel (compactCardTop - expandedCardTop, shortened on
 * mobile and clamped to a safe positive minimum) is the scrub denominator
 * — dragging or accumulating that distance of wheel/trackpad/touch input
 * moves progress 0→1, and the card's geometry interpolates every frame (no
 * CSS transition, no easing). Touch
 * progress is computed from the gesture's starting Y and starting progress,
 * so reversing a drag reverses progress directly. While progress < 1 the
 * viewport's scrollTop is pinned to 0 and vertical input is consumed for
 * expansion; once fully expanded, unused delta flows into normal content
 * scrolling. Upward input scrolls content normally until scrollTop <= 1,
 * then contracts the card — unused delta is preserved across both
 * boundaries. Reduced motion snaps between the two states instead of
 * scrubbing.
 *
 * A slide is expandable only when its content overflows the compact viewport
 * (measured from compact geometry and cached, so mid-transition geometry
 * changes never disable it). Non-overflowing slides (e.g. the intro) pin
 * progress to 0 and ignore expansion input. Overflowing public slides also
 * show a "Read the case study" button in the compact fold — a discoverable
 * affordance that eases progress to 1 through the same commit pipeline.
 *
 * Native non-passive listeners are used for wheel/touchmove because the
 * transition consumes input (preventDefault) — React's delegated listeners
 * are passive and cannot.
 */
export default function WorkExperience({
  slides,
  activeIndex,
  onIndexChange,
  headingRef,
  titleBase,
  modeTitle,
  expansionProgress,
  onExpansionProgressChange,
  onExpansionMetricsChange,
  onTrackEvent,
}: WorkExperienceProps) {
  const slide = getWorkSlide(activeIndex)
  const mark = getWorkSlideMark(slide)
  const slideTitle = getWorkSlideTitle(slide)
  const slideHeadingRef = useRef<HTMLHeadingElement | null>(null)
  // The INNER viewport of the scroll panel — the element that scrolls.
  const panelRef = useRef<HTMLDivElement | null>(null)
  // Content wrapper inside the viewport — its scrollHeight decides overflow
  // eligibility against the compact viewport's clientHeight.
  const contentRef = useRef<HTMLDivElement | null>(null)
  // Live progress mirror (handlers read/write it between renders).
  const progressRef = useRef(expansionProgress)
  // rAF-coalesced commit: input events accumulate, one state write per frame.
  const pendingProgressRef = useRef(expansionProgress)
  const rafRef = useRef<number | null>(null)
  // Compact card rect (viewport coordinates), captured while progress === 0;
  // the interpolation source. Cached so mid-transition changes never
  // destabilize the scrub.
  const compactRectRef = useRef<Rect | null>(null)
  const eligibleRef = useRef(false)
  // The scrub denominator: compactCardTop - expandedCardTop, measured from
  // compact geometry and cached (mid-transition changes never rescale an
  // in-flight gesture). Always >= MIN_EXPANSION_RANGE_PX.
  const rangeRef = useRef(MIN_EXPANSION_RANGE_PX)
  const reportedRangeRef = useRef(MIN_EXPANSION_RANGE_PX)
  // Touch gesture state: progress is computed from the gesture's starting Y
  // and starting progress (not incremental deltas), so reversing a drag
  // reverses the scrub exactly. 'native' gestures let the browser scroll the
  // content; an upward native gesture that reaches the top rebases into
  // 'scrub' from that point.
  const touchRef = useRef<{
    startY: number
    startProgress: number
    mode: 'pending' | 'scrub' | 'native'
  } | null>(null)
  const hasMountedRef = useRef(false)
  // True while the active slide overflows its compact fold (mirrors
  // eligibleRef for render) — gates the "Read the case study" button.
  const [expandable, setExpandable] = useState(false)
  // rAF handle for the button-triggered expand animation (null when idle).
  const expandAnimRef = useRef<number | null>(null)
  // Set by the button path so focus lands on the story heading once the
  // expanded state has actually committed (the button unmounts there).
  const focusOnExpandRef = useRef(false)
  // Latest callbacks, so native listeners never go stale.
  const progressChangeRef = useRef(onExpansionProgressChange)
  progressChangeRef.current = onExpansionProgressChange
  const metricsChangeRef = useRef(onExpansionMetricsChange)
  metricsChangeRef.current = onExpansionMetricsChange

  const isReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /** The scrub denominator in px, never below the safe minimum. */
  const expansionRangePx = () => Math.max(rangeRef.current, MIN_EXPANSION_RANGE_PX)

  const commitProgress = (next: number) => {
    const clamped = Math.min(1, Math.max(0, next))
    if (clamped === progressRef.current) return
    progressRef.current = clamped
    pendingProgressRef.current = clamped
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        progressChangeRef.current(pendingProgressRef.current)
      })
    }
  }

  /** Expand by `amount` CSS px of input; returns the unused excess. */
  const expandBy = (amount: number): number => {
    if (isReducedMotion()) {
      commitProgress(1)
      return 0
    }
    const range = expansionRangePx()
    const room = (1 - progressRef.current) * range
    const used = Math.min(amount, room)
    commitProgress(progressRef.current + used / range)
    return amount - used
  }

  /** Contract by `amount` CSS px of upward input. */
  const contractBy = (amount: number) => {
    if (isReducedMotion()) {
      commitProgress(0)
      return
    }
    commitProgress(progressRef.current - amount / expansionRangePx())
  }

  // Shared vertical-input machine for WHEEL deltas (positive = downward
  // content-scroll intent). Consumes input for expansion while progress < 1,
  // hands unused delta to content scrolling, and contracts only once the
  // content is back at the top. Touch uses the absolute start-Y/start-progress
  // mapping in handleTouchMove below instead.
  const applyVerticalInput = (delta: number, preventDefault: () => void) => {
    if (!eligibleRef.current) return
    const viewport = panelRef.current
    if (!viewport || delta === 0) return
    // Direct wheel input wins over an in-flight button animation.
    cancelExpandAnim()
    if (delta > 0) {
      if (progressRef.current < 1) {
        preventDefault()
        const excess = expandBy(delta)
        if (progressRef.current < 1) {
          viewport.scrollTop = 0
        } else if (excess > 0) {
          viewport.scrollTop = excess
        }
      } // fully expanded: native content scroll
    } else {
      const up = -delta
      const scrollTop = viewport.scrollTop
      if (scrollTop <= TOP_EPSILON && progressRef.current > 0) {
        preventDefault()
        viewport.scrollTop = 0
        contractBy(up)
      } else if (
        scrollTop > TOP_EPSILON &&
        scrollTop - up <= TOP_EPSILON &&
        progressRef.current > 0
      ) {
        // Crossing the top boundary: scroll the remaining content distance,
        // then contract with the unused delta.
        preventDefault()
        const remainder = up - scrollTop
        viewport.scrollTop = 0
        contractBy(remainder)
      } // otherwise: native upward content scroll
    }
  }

  const cancelExpandAnim = () => {
    if (expandAnimRef.current !== null) {
      cancelAnimationFrame(expandAnimRef.current)
      expandAnimRef.current = null
    }
  }

  /** "Read the case study" button: ease progress to full expansion through
   *  the same commit pipeline as the scrub (reduced motion snaps). Focus
   *  moves to the story heading once the expanded state commits — the
   *  button unmounts there, so it cannot keep focus itself. */
  const expandToFull = () => {
    if (!eligibleRef.current) return
    cancelExpandAnim()
    if (isReducedMotion()) {
      focusOnExpandRef.current = true
      commitProgress(1)
      return
    }
    const start = progressRef.current
    const startTime = performance.now()
    const DURATION_MS = 420
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / DURATION_MS)
      const eased = 1 - Math.pow(1 - t, 3)
      commitProgress(start + (1 - start) * eased)
      if (t < 1) {
        expandAnimRef.current = requestAnimationFrame(tick)
      } else {
        expandAnimRef.current = null
        focusOnExpandRef.current = true
      }
    }
    expandAnimRef.current = requestAnimationFrame(tick)
  }

  // Native (non-passive) input listeners on the viewport.
  useEffect(() => {
    const viewport = panelRef.current
    if (!viewport) return
    const handleWheel = (event: globalThis.WheelEvent) => {
      applyVerticalInput(event.deltaY, () => event.preventDefault())
    }
    const handleTouchStart = (event: globalThis.TouchEvent) => {
      const y = event.touches[0]?.clientY
      touchRef.current =
        y === undefined
          ? null
          : { startY: y, startProgress: progressRef.current, mode: 'pending' }
    }
    // Touch scrubbing is ABSOLUTE: progress comes from the gesture's starting
    // Y and starting progress (progress = startProgress + dy / rangePx), so a
    // single uninterrupted drag across the expansion range moves exactly
    // 0→100% and reversing the drag reverses progress without snapping. Only
    // gestures that can affect expansion are intercepted ('scrub' mode);
    // pure content-scroll gestures stay native (iOS momentum preserved) until
    // an upward drag reaches the top, which rebases into scrub mode.
    const handleTouchMove = (event: globalThis.TouchEvent) => {
      const touch = touchRef.current
      const y = event.touches[0]?.clientY
      if (!touch || y === undefined) return
      if (!eligibleRef.current) return
      const dy = touch.startY - y // positive = downward content-scroll intent
      // dy === 0 only matters once the gesture is scrubbing: returning to the
      // exact start point must commit the start progress (reversal to zero).
      if (dy === 0 && touch.mode === 'pending') return
      if (isReducedMotion()) {
        if (dy > 0 && progressRef.current < 1) {
          event.preventDefault()
          commitProgress(1)
        } else if (dy < 0 && viewport.scrollTop <= TOP_EPSILON && progressRef.current > 0) {
          event.preventDefault()
          viewport.scrollTop = 0
          commitProgress(0)
        }
        return
      }
      if (touch.mode === 'pending') {
        touch.mode =
          dy > 0
            ? touch.startProgress < 1
              ? 'scrub'
              : 'native'
            : viewport.scrollTop <= TOP_EPSILON && touch.startProgress > 0
              ? 'scrub'
              : 'native'
      }
      if (touch.mode === 'scrub') {
        event.preventDefault()
        // Direct touch input wins over an in-flight button animation.
        cancelExpandAnim()
        const range = expansionRangePx()
        if (dy >= 0) {
          const expandRoom = (1 - touch.startProgress) * range
          if (dy <= expandRoom) {
            commitProgress(touch.startProgress + dy / range)
            viewport.scrollTop = 0
          } else {
            // Fully expanded: the unused distance scrolls the content.
            commitProgress(1)
            viewport.scrollTop = dy - expandRoom
          }
        } else {
          commitProgress(touch.startProgress + dy / range)
          viewport.scrollTop = 0
        }
      } else if (dy < 0 && viewport.scrollTop <= TOP_EPSILON && progressRef.current > 0) {
        // An upward native scroll reached the top: rebase into scrub mode so
        // the rest of the gesture contracts the card from this point.
        touch.mode = 'scrub'
        touch.startY = y
        touch.startProgress = progressRef.current
        event.preventDefault()
        viewport.scrollTop = 0
      }
    }
    const handleTouchEnd = () => {
      touchRef.current = null
    }
    viewport.addEventListener('wheel', handleWheel, { passive: false })
    viewport.addEventListener('touchstart', handleTouchStart, { passive: true })
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false })
    viewport.addEventListener('touchend', handleTouchEnd)
    viewport.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      viewport.removeEventListener('wheel', handleWheel)
      viewport.removeEventListener('touchstart', handleTouchStart)
      viewport.removeEventListener('touchmove', handleTouchMove)
      viewport.removeEventListener('touchend', handleTouchEnd)
      viewport.removeEventListener('touchcancel', handleTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Measure compact geometry: overflow eligibility (cached — never measured
  // from expanded geometry), the compact card rect used as the interpolation
  // source, and the expansion range (compactCardTop - expandedCardTop) used
  // as the scrub denominator. No-op while expanded.
  const measureCompact = () => {
    const viewport = panelRef.current
    const content = contentRef.current
    if (!viewport || !content || progressRef.current > 0) return
    const card = viewport.parentElement as HTMLElement | null
    // Compact fold: project cards clip so the first story section (Outcome)
    // starts at the bottom edge of the scroll viewport — the compact state
    // shows the title, thesis, and role/context meta only, and the scrub
    // reveals the case study. The intro slide has no sections and keeps its
    // natural compact height. Never exceeds the CSS max-height cap.
    if (card) {
      card.style.maxHeight = ''
      if (slide.kind === 'project') {
        const firstSection = content.querySelector('.work-story-section')
        const footer = card.querySelector('.bounded-scroll-footer')
        if (firstSection) {
          // The CSS max-height cap can compute to an unresolved min() — cap
          // against the card's current (already CSS-capped) height instead.
          const cardRect = card.getBoundingClientRect()
          const sectionTop = firstSection.getBoundingClientRect().top - cardRect.top
          const footerHeight = footer?.getBoundingClientRect().height ?? 0
          const clip = sectionTop + footerHeight - FOLD_HIDE_MARGIN_PX
          if (clip < cardRect.height) {
            card.style.maxHeight = `${Math.round(clip)}px`
          }
        }
      }
    }
    const style = getComputedStyle(viewport)
    const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    const overflow = content.scrollHeight + verticalPadding - viewport.clientHeight
    const eligible = overflow > OVERFLOW_TOLERANCE_PX
    if (card) {
      const rect = card.getBoundingClientRect()
      compactRectRef.current = rect
      // The scrub denominator: the card's expansion travel (compactCardTop -
      // expandedCardTop), shortened on mobile so a comfortable drag covers
      // the full transition. Card and gap gestures share this value via the
      // reported metrics.
      const travel = rect.top - expandedRect().top
      const mobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches
      rangeRef.current = Math.max(
        travel * (mobile ? MOBILE_SCRUB_RANGE_FACTOR : 1),
        MIN_EXPANSION_RANGE_PX,
      )
    }
    if (eligible !== eligibleRef.current || rangeRef.current !== reportedRangeRef.current) {
      eligibleRef.current = eligible
      reportedRangeRef.current = rangeRef.current
      setExpandable(eligible)
      metricsChangeRef.current?.({ eligible, rangePx: rangeRef.current })
    }
    if (!eligible) {
      progressRef.current = 0
      progressChangeRef.current(0)
    }
  }

  // Geometry: progress 0 restores the pure-CSS compact card; any progress >
  // 0 fixes the card in the viewport and interpolates the measured compact
  // rect toward the expanded target. --work-expansion exposes the scrub to
  // CSS (inline-media sizing, mobile top padding).
  const applyGeometry = (progress: number) => {
    const viewport = panelRef.current
    const card = viewport?.parentElement as HTMLElement | null
    if (!viewport || !card) return
    if (progress <= 0) {
      card.style.cssText = ''
      return
    }
    if (progress < 1) viewport.scrollTop = 0
    let compact = compactRectRef.current
    if (!compact) {
      compact = card.getBoundingClientRect()
      compactRectRef.current = compact
    }
    const target = expandedRect()
    const lerp = (a: number, b: number) => a + (b - a) * progress
    const mobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches
    card.style.position = 'fixed'
    card.style.left = `${lerp(compact.left, target.left)}px`
    card.style.top = `${lerp(compact.top, target.top)}px`
    card.style.bottom = 'auto'
    card.style.transform = 'none'
    card.style.width = `${lerp(compact.width, target.width)}px`
    card.style.height = `${lerp(compact.height, target.height)}px`
    card.style.maxHeight = 'none'
    card.style.zIndex = '30'
    card.style.borderRadius = `${lerp(CARD_RADIUS_PX, mobile ? 0 : CARD_RADIUS_PX)}px`
    card.style.setProperty('--work-expansion', String(progress))
  }

  // Keep the progress mirror in sync with the controlled prop (gap gestures
  // and mode-level resets come from PortfolioExperience).
  useEffect(() => {
    progressRef.current = expansionProgress
  }, [expansionProgress])

  // Apply the scrubbed geometry on every progress change; at 0, re-measure
  // the compact card (the interpolation source for the next scrub).
  useEffect(() => {
    applyGeometry(expansionProgress)
    if (expansionProgress <= 0) measureCompact()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expansionProgress])

  // Slide change: reset the viewport's scroll position and the expansion
  // progress, move focus to the new slide heading without scrolling, and
  // extend the document title. The document and foreground shell must not
  // move — never scroll the heading into view here. Lightbox state lives
  // inside WorkStoryView, which remounts on slide change (key={slide id}).
  // The first render is skipped — entering the mode is handled by the M3
  // mode-level focus/title management (which focuses headingRef).
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (panelRef.current) panelRef.current.scrollTop = 0
    cancelExpandAnim()
    focusOnExpandRef.current = false
    const card = panelRef.current?.parentElement as HTMLElement | null
    if (card) card.style.cssText = ''
    progressRef.current = 0
    pendingProgressRef.current = 0
    progressChangeRef.current(0)
    compactRectRef.current = null
    slideHeadingRef.current?.focus({ preventScroll: true })
    document.title = `${titleBase} — ${modeTitle} — ${slideTitle}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, slideTitle, titleBase, modeTitle])

  // Eligibility/compact-rect recalculation: slide changes, viewport and
  // orientation changes, font readiness, and content/media resizing. All
  // guarded to compact geometry inside measureCompact.
  useEffect(() => {
    measureCompact()
    const content = contentRef.current
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && content) {
      observer = new ResizeObserver(() => measureCompact())
      observer.observe(content)
    }
    const handleResize = () => {
      safeAreaCache = null
      if (progressRef.current > 0) {
        applyGeometry(progressRef.current)
      } else {
        measureCompact()
      }
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    let fontsCancelled = false
    document.fonts?.ready.then(() => {
      if (!fontsCancelled) measureCompact()
    })
    // Late layout settling (font metrics, mark images) can shift content by a
    // few px without changing the content box (no ResizeObserver fire) —
    // re-measure once after the slide has settled.
    const settleTimer = window.setTimeout(measureCompact, 350)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      window.clearTimeout(settleTimer)
      fontsCancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

  // Cancel a pending rAF commit / expand animation on unmount.
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (expandAnimRef.current !== null) cancelAnimationFrame(expandAnimRef.current)
    },
    [],
  )

  // Button path: once full expansion has committed, move focus to the story
  // heading (the button unmounts at progress 1 and cannot hold focus).
  useEffect(() => {
    if (expansionProgress >= 1 && focusOnExpandRef.current) {
      focusOnExpandRef.current = false
      slideHeadingRef.current?.focus({ preventScroll: true })
    }
  }, [expansionProgress])

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
    <BoundedScrollPanel
      className="work-experience"
      viewportClassName="work-experience-viewport"
      label="Work case studies"
      onKeyDown={handleKeyDown}
      viewportRef={panelRef}
      footer={
        slides.length > 1 ? (
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
        ) : undefined
      }
    >
      <div className="work-experience-content" ref={contentRef}>
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
            onReadCaseStudy={expandable && expansionProgress < 1 ? expandToFull : undefined}
            onTrackEvent={onTrackEvent}
          />
        )}
      </div>
    </BoundedScrollPanel>
  )
}
