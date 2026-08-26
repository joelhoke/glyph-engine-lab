'use client'

/**
 * Sound control (visual sonification experiment): a round note FAB anchored
 * at the lower-left screen corner. The control is ONE persistent DOM tree —
 * the FAB never moves or unmounts; the pill shell stays mounted behind it and
 * grows out (desktop: rightward; ≤640px: upward) via a clip-path transition,
 * then retracts back behind the FAB on close:
 *
 *   [FAB = note badge] [play/pause] [direction arrow]
 *
 * The FAB doubles as the active badge: while the control is open it carries a
 * circular "rotor" (music note over the conic gradient sampled from the
 * supplied vibe-sound-on.png artwork) under a separate, stationary 2px ring
 * (the button border). The rotor spins only while playback is 'playing' —
 * CSS animation-play-state freezes it mid-rotation on pause (never jumping
 * back) and resumes from the frozen angle on play. Disabling stops playback
 * immediately, but the rotor (and its rotation) only resets once the close
 * transition has completed and the pill is hidden.
 *
 * Transition lifecycle (driven by data-state on .vibe-sound-control):
 *   closed → open      pill clip-path opens 340ms ease-out; inner controls
 *                      fade/translate in after the shell starts moving
 *   open  → closing    descendants go inert + pointer-events:none at once;
 *                      inner controls fade out fast, then the shell retracts
 *                      280ms ease-in; the pill hides on transitionend (with a
 *                      setTimeout fallback, and instantly under reduced
 *                      motion, where the global kill-switch removes the
 *                      transitions entirely)
 *   closing → closed   pill stays mounted but visibility:hidden
 *
 * Session-only UI: the parent owns expansion, playback, and config state.
 * Expanding must NOT start audio — the visitor presses play explicitly.
 */

import { useEffect, useRef, useState } from 'react'
import type { SonificationDirection } from '../../engine/sonificationConfig'
import type { SonificationPlaybackState } from '../../engine/sonificationEngine'

export type SoundControlProps = {
  /** Parent-driven expansion; expanding never starts audio. */
  expanded: boolean
  playback: SonificationPlaybackState
  error: string | null
  direction: SonificationDirection
  onExpand: () => void
  /** Disable/collapse (stop playback and return to the round button). */
  onDisable: () => void
  onPlay: () => void
  onPause: () => void
  /** Cycles right → down → left → up (left-to-right → top-to-bottom →
   *  right-to-left → bottom-to-top). */
  onCycleDirection: () => void
  /** Fired ONCE per mount on the first meaningful interaction (play/pause,
   *  sweep cycle) — feeds the vibe-creations engagement tracker. */
  onInteract?: () => void
}

/** Arrow artwork points up; rotate it to the sweep direction. */
const DIRECTION_ROTATION_DEG: Record<SonificationDirection, number> = {
  'bottom-to-top': 0,
  'left-to-right': 90,
  'top-to-bottom': 180,
  'right-to-left': 270,
}

const DIRECTION_LABELS: Record<SonificationDirection, string> = {
  'left-to-right': 'right',
  'right-to-left': 'left',
  'top-to-bottom': 'down',
  'bottom-to-top': 'up',
}

/* Safety net for the close transition: the shell retraction finishes at
   60ms (delay) + 280ms = 340ms and normally reports via transitionend; this
   fallback covers skipped/cancelled transitions so the pill always ends up
   hidden. */
const CLOSE_FALLBACK_MS = 600

export default function SoundControl({
  expanded,
  playback,
  error,
  direction,
  onExpand,
  onDisable,
  onPlay,
  onPause,
  onCycleDirection,
  onInteract,
}: SoundControlProps) {
  const playing = playback === 'playing'
  /* The pill stays mounted across the whole open/close lifecycle so its exit
     transition can run; pillVisible only gates visibility/interactivity. */
  const [pillVisible, setPillVisible] = useState(expanded)
  const pillRef = useRef<HTMLDivElement | null>(null)
  /* First meaningful interaction only (per mount): the tracker credits the
     music corner element once, no matter how often the transport is used. */
  const interactedRef = useRef(false)
  const fireInteract = () => {
    if (interactedRef.current) return
    interactedRef.current = true
    onInteract?.()
  }

  const state = expanded ? 'open' : pillVisible ? 'closing' : 'closed'

  /* inert is applied via the ref callback: @types/react 18.3 has no `inert`
     prop, and the attribute must flip in the SAME commit as data-state so
     descendants leave keyboard/pointer interaction the moment closing
     starts. */
  const setPillRef = (el: HTMLDivElement | null) => {
    pillRef.current = el
    el?.toggleAttribute('inert', state !== 'open')
  }

  useEffect(() => {
    if (expanded) {
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
      /* Hiding the pill unmounts the rotor below (state becomes 'closed'),
         which resets its rotation — deliberately AFTER closing completes. */
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
  }, [expanded, pillVisible])

  return (
    <div
      className={playing ? 'vibe-sound-control is-playing' : 'vibe-sound-control'}
      data-state={state}
    >
      {/* Persistent pill: mounted in every state; clip-path + visibility do
          the show/hide work so the exit transition always runs. Descendants
          leave the tab/pointer order the moment the control is not fully
          open (inert + aria-hidden + pointer-events:none in CSS). */}
      <div
        ref={setPillRef}
        className="vibe-sound-pill"
        role="group"
        aria-label="Sound"
        aria-hidden={state !== 'open'}
      >
        <div className="vibe-sound-pill-inner">
          <button
            type="button"
            className="vibe-sound-transport"
            aria-label={playing ? 'Pause sound' : 'Play sound'}
            aria-pressed={playing}
            onClick={() => {
              fireInteract()
              if (playing) {
                onPause()
              } else {
                onPlay()
              }
            }}
          >
            {playing ? (
              <svg
                className="vibe-sound-pause-icon"
                width="22"
                height="25"
                viewBox="0 0 14 16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <rect x="1" y="1" width="4" height="14" rx="1.5" />
                <rect x="9" y="1" width="4" height="14" rx="1.5" />
              </svg>
            ) : (
              <img
                className="vibe-sound-play-icon"
                src="/toolbar/vibe-sound-play.png"
                alt=""
                aria-hidden="true"
              />
            )}
          </button>
          <button
            type="button"
            className="vibe-sound-direction"
            aria-label={`Sweep direction: ${DIRECTION_LABELS[direction]}`}
            onClick={() => {
              fireInteract()
              onCycleDirection()
            }}
          >
            <img
              className="vibe-sound-direction-arrow"
              src="/toolbar/vibe-sound-direction.png"
              alt=""
              aria-hidden="true"
              style={{ transform: `rotate(${DIRECTION_ROTATION_DEG[direction]}deg)` }}
            />
          </button>
        </div>
      </div>
      {/* Anchored FAB: identical screen position in every state. Collapsed it
          is the muted note toggle; open/closing it is the active badge — the
          conic-gradient rotor spins the note + gradient as ONE composited
          layer while the 2px border ring (the button's own border) stays
          stationary. Clicking it toggles the control. */}
      <button
        type="button"
        className="vibe-sound-toggle"
        aria-label={state === 'closed' ? 'Sound' : 'Turn sound off'}
        aria-expanded={expanded}
        onClick={expanded ? onDisable : onExpand}
      >
        {state === 'closed' ? (
          /* Collapsed (off) state: note glyph as a CSS mask over the toolbar
             beam background, per the simplified-controls direction. The
             supplied vibe-sound-off.png original stays unused but kept. */
          <span
            className="vibe-sound-toggle-icon"
            style={{
              WebkitMaskImage: 'url(/toolbar/vibe-sound-note.png)',
              maskImage: 'url(/toolbar/vibe-sound-note.png)',
            }}
            aria-hidden="true"
          />
        ) : (
          <span className="vibe-sound-rotor" aria-hidden="true">
            <img
              className="vibe-sound-note"
              src="/toolbar/vibe-sound-note.png"
              alt=""
              aria-hidden="true"
            />
          </span>
        )}
      </button>
      {error && (
        <p className="vibe-sound-control-error" role="status">
          {error}
        </p>
      )}
    </div>
  )
}
