'use client'

/**
 * Ambient scene carousel: prev/next edge buttons fixed at the vertical center
 * of the left/right screen edges, plus a temporary scene label chip pinned
 * top-center (kept clear of the toolbar, whose panels pop upward).
 *
 * Pure UI: the parent owns the active scene, the wipe transition (which drives
 * `disabled`), and decides when to show/clear `label`.
 */

export type AmbientCarouselProps = {
  onPrevious: () => void
  onNext: () => void
  /** True while a scene wipe runs; blocks re-entry mid-transition. */
  disabled: boolean
  /** Temporary chip text (e.g. "Storm · 4 of 9"), null hides the chip. */
  label: string | null
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      className={`vibe-ambient-nav-chevron vibe-ambient-nav-chevron-${direction}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={direction === 'left' ? 'M15 5L8 12L15 19' : 'M9 5L16 12L9 19'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function AmbientCarousel({
  onPrevious,
  onNext,
  disabled,
  label,
}: AmbientCarouselProps) {
  return (
    <>
      <div className="vibe-ambient-nav">
        <button
          type="button"
          className="vibe-ambient-nav-button vibe-ambient-nav-button-prev"
          aria-label="Previous ambient scene"
          disabled={disabled}
          onClick={onPrevious}
        >
          <ChevronIcon direction="left" />
        </button>
        <button
          type="button"
          className="vibe-ambient-nav-button vibe-ambient-nav-button-next"
          aria-label="Next ambient scene"
          disabled={disabled}
          onClick={onNext}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
      {label !== null && (
        <div className="vibe-ambient-label" aria-live="polite">
          {label}
        </div>
      )}
    </>
  )
}
