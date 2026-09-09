'use client'

/**
 * Pond control: a round FAB anchored at the lower-right screen corner,
 * carrying the supplied pond glyph (sun over water) as an INLINE SVG — no
 * external mask asset, so the icon can never disappear while other assets
 * load. The control is ONE persistent DOM tree: the FAB never moves; the
 * teal gradient pill stays mounted behind it and grows out (desktop:
 * leftward, mirroring the Sound control; ≤640px: upward) via a clip-path
 * transition, then retracts back behind the FAB on close.
 *
 * The FAB doubles as the active badge (navy→teal gradient circle with the
 * white 2px ring) while the control is open; clicking it toggles the pond.
 * The four swimming-body characters stay a radiogroup, ordered from the
 * anchor outward: Source, Fish, Jelly, Ray.
 *
 * Transition lifecycle matches the Sound control (data-state on
 * .vibe-pond-control: open / closing / closed; pill hidden after
 * transitionend with a setTimeout fallback, instantly under reduced motion).
 *
 * Session-only UI: nothing here persists — the parent owns the state.
 */

import { useEffect, useRef, useState } from 'react'
import type { PondCharacter } from '../../engine/pondConfig'

export type PondControlProps = {
  /** Parent-driven master switch; also expands/collapses the choice pill. */
  enabled: boolean
  character: PondCharacter
  onToggle: () => void
  onSelect: (character: PondCharacter) => void
  /** Fired ONCE per mount on the first meaningful interaction (enable
   *  toggle, character pick) — feeds the vibe-creations engagement tracker. */
  onInteract?: () => void
}

const POND_CHOICES: { value: PondCharacter; label: string }[] = [
  { value: 'source', label: 'Source' },
  { value: 'original', label: 'Fish' },
  { value: 'jelly', label: 'Jelly' },
  { value: 'ray', label: 'Ray' },
]

/* Inline version of the supplied pond glyph (public/toolbar/AmbientPond.png,
   kept as the reference): a sun semicircle over three rounded water lines.
   Geometry measured from the artwork's 53×50 alpha mask — sun radius 16
   centered on (26,16); bars 5px tall with 2.5px end rounding. Rendered in
   currentColor so collapsed (muted) and badge (white) states share it. */
function PondGlyph() {
  return (
    <svg
      viewBox="0 0 53 50"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 16 A16 16 0 0 1 42 16 Z" />
      <rect x="0" y="22" width="53" height="5" rx="2.5" />
      <rect x="7" y="34" width="39" height="5" rx="2.5" />
      <rect x="16" y="45" width="20" height="5" rx="2.5" />
    </svg>
  )
}

/* Same contract as the Sound control: the close transition ends at 340ms
   (60ms delay + 280ms); transitionend normally reports it. */
const CLOSE_FALLBACK_MS = 600

export default function PondControl({
  enabled,
  character,
  onToggle,
  onSelect,
  onInteract,
}: PondControlProps) {
  /* The pill stays mounted across the whole enable/disable lifecycle so its
     exit transition can run; pillVisible only gates visibility. */
  const [pillVisible, setPillVisible] = useState(enabled)
  const pillRef = useRef<HTMLDivElement | null>(null)
  /* First meaningful interaction only (per mount): the tracker credits the
     pond corner element once. */
  const interactedRef = useRef(false)
  const fireInteract = () => {
    if (interactedRef.current) return
    interactedRef.current = true
    onInteract?.()
  }

  const state = enabled ? 'open' : pillVisible ? 'closing' : 'closed'

  /* inert is applied via the ref callback: @types/react 18.3 has no `inert`
     prop, and the attribute must flip in the SAME commit as data-state so
     descendants leave keyboard/pointer interaction the moment closing
     starts. */
  const setPillRef = (el: HTMLDivElement | null) => {
    pillRef.current = el
    el?.toggleAttribute('inert', state !== 'open')
  }

  useEffect(() => {
    if (enabled) {
      setPillVisible(true)
      return
    }
    if (!pillVisible) return
    /* Reduced motion removes the transitions (global kill-switch), so no
       transitionend ever arrives — hide immediately instead of waiting. */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPillVisible(false)
      return
    }
    const pill = pillRef.current
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      setPillVisible(false)
    }
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === pill && event.propertyName === 'clip-path') finish()
    }
    pill?.addEventListener('transitionend', onTransitionEnd)
    const fallback = window.setTimeout(finish, CLOSE_FALLBACK_MS)
    return () => {
      pill?.removeEventListener('transitionend', onTransitionEnd)
      window.clearTimeout(fallback)
    }
  }, [enabled, pillVisible])

  return (
    <div className="vibe-pond-control" data-state={state}>
      {/* Persistent pill: mounted in every state; inert + aria-hidden +
          pointer-events:none (CSS) remove descendants from interaction the
          moment the control is not fully open. */}
      <div
        ref={setPillRef}
        className="vibe-pond-pill"
        role="group"
        aria-label="Pond"
        aria-hidden={state !== 'open'}
      >
        <div className="vibe-pond-pill-inner" role="radiogroup" aria-label="Pond character">
          {POND_CHOICES.map((choice) => {
            const selected = choice.value === character
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={
                  selected
                    ? 'vibe-pond-choice vibe-pond-choice-selected'
                    : 'vibe-pond-choice'
                }
                onClick={() => {
                  fireInteract()
                  onSelect(choice.value)
                }}
              >
                {choice.label}
              </button>
            )
          })}
        </div>
      </div>
      {/* Anchored FAB: identical screen position in every state; becomes the
          active badge (gradient + white ring + white glyph) while open. */}
      <button
        type="button"
        className="vibe-pond-toggle"
        aria-label={state === 'closed' ? 'Pond' : 'Turn pond off'}
        aria-pressed={enabled}
        aria-expanded={enabled}
        onClick={() => {
          fireInteract()
          onToggle()
        }}
      >
        <span className="vibe-pond-toggle-icon" aria-hidden="true">
          <PondGlyph />
        </span>
      </button>
    </div>
  )
}
