'use client'

/**
 * Sound control (visual sonification experiment): a round note button fixed
 * at the lower-left screen corner. Clicking it expands a pill built from the
 * supplied artwork layers (public/toolbar/vibe-sound-*.png, derived by
 * scripts/dev/derive-sound-layers.py):
 *
 *   [note badge] [play/pause] [direction arrow]
 *
 * The music note spins continuously while — and only while — playback is
 * 'playing' (CSS animation frozen via animation-play-state when paused, so
 * the note never jumps back; collapsing the pill unmounts it, resetting the
 * rotation). Clicking the note badge disables/collapses the control. The
 * direction arrow artwork points UP ('bottom-to-top') and is rotated with a
 * CSS transform to match the active sweep direction.
 *
 * Session-only UI: the parent owns expansion, playback, and config state.
 * Expanding must NOT start audio — the visitor presses play explicitly.
 */

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
}: SoundControlProps) {
  const playing = playback === 'playing'

  if (!expanded) {
    return (
      <div className="vibe-sound-control">
        <button
          type="button"
          className="vibe-sound-toggle"
          aria-label="Sound"
          aria-expanded={false}
          onClick={onExpand}
        >
          {/* Collapsed (off) state: note glyph as a CSS mask over the toolbar
              beam background, per the simplified-controls direction. The
              supplied vibe-sound-off.png original stays unused but kept. */}
          <span
            className="vibe-sound-toggle-icon"
            style={{
              WebkitMaskImage: 'url(/toolbar/vibe-sound-note.png)',
              maskImage: 'url(/toolbar/vibe-sound-note.png)',
            }}
            aria-hidden="true"
          />
        </button>
      </div>
    )
  }

  return (
    <div className="vibe-sound-control">
      <div
        className={
          playing ? 'vibe-sound-pill is-playing' : 'vibe-sound-pill'
        }
        role="group"
        aria-label="Sound"
      >
        <img
          className="vibe-sound-shell"
          src="/toolbar/vibe-sound-shell.png"
          alt=""
          aria-hidden="true"
        />
        <button
          type="button"
          className="vibe-sound-badge"
          aria-label="Turn sound off"
          onClick={onDisable}
        >
          <img
            className="vibe-sound-note"
            src="/toolbar/vibe-sound-note.png"
            alt=""
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          className="vibe-sound-transport"
          aria-label={playing ? 'Pause sound' : 'Play sound'}
          aria-pressed={playing}
          onClick={playing ? onPause : onPlay}
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
          onClick={onCycleDirection}
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
      {error && (
        <p className="vibe-sound-control-error" role="status">
          {error}
        </p>
      )}
    </div>
  )
}
