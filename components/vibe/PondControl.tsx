'use client'

/**
 * Pond control: a round toggle fixed at the lower-right screen corner, using
 * the supplied pond glyph (sun over water). Clicking it enables the pond and
 * expands a teal gradient pill — the same structure as the Sound control: a
 * badge on the left (click it to disable/collapse) and the four swimming-body
 * characters as a radiogroup.
 *
 * Session-only UI: nothing here persists — the parent owns the state.
 */

import type { PondCharacter } from '../../engine/pondConfig'

export type PondControlProps = {
  /** Parent-driven master switch; also expands/collapses the choice pill. */
  enabled: boolean
  character: PondCharacter
  onToggle: () => void
  onSelect: (character: PondCharacter) => void
}

const POND_CHOICES: { value: PondCharacter; label: string }[] = [
  { value: 'source', label: 'Source' },
  { value: 'original', label: 'Fish' },
  { value: 'jelly', label: 'Jelly' },
  { value: 'ray', label: 'Ray' },
]

/* The pond glyph (sun over water) supplied as public/toolbar/AmbientPond.png;
   rendered as a CSS mask over currentColor. */
const POND_GLYPH_MASK = {
  WebkitMaskImage: 'url(/toolbar/AmbientPond.png)',
  maskImage: 'url(/toolbar/AmbientPond.png)',
} as const

export default function PondControl({
  enabled,
  character,
  onToggle,
  onSelect,
}: PondControlProps) {
  if (!enabled) {
    return (
      <div className="vibe-pond-control">
        <button
          type="button"
          className="vibe-pond-toggle"
          aria-label="Pond"
          aria-pressed={false}
          aria-expanded={false}
          onClick={onToggle}
        >
          <span className="vibe-pond-toggle-icon" style={POND_GLYPH_MASK} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className="vibe-pond-control">
      <div className="vibe-pond-pill" role="group" aria-label="Pond">
        <button
          type="button"
          className="vibe-pond-badge"
          aria-label="Turn pond off"
          aria-expanded={true}
          onClick={onToggle}
        >
          <span className="vibe-pond-badge-icon" style={POND_GLYPH_MASK} aria-hidden="true" />
        </button>
        <div className="vibe-pond-choices" role="radiogroup" aria-label="Pond character">
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
                onClick={() => onSelect(choice.value)}
              >
                {choice.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
