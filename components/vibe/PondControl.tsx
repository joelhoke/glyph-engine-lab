'use client'

/**
 * Pond control (debug-only "Private Pond" experiment): a round fish button
 * fixed at the lower-right screen corner. Clicking it toggles the pond (the
 * parent flips `enabled`); while enabled a horizontal pill above the button
 * offers the four swimming-body characters as a radiogroup.
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

export default function PondControl({
  enabled,
  character,
  onToggle,
  onSelect,
}: PondControlProps) {
  return (
    <div className="vibe-pond-control">
      {enabled && (
        <div className="vibe-pond-pill" role="radiogroup" aria-label="Pond character">
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
      )}
      <button
        type="button"
        className={
          enabled ? 'vibe-pond-toggle vibe-pond-toggle-active' : 'vibe-pond-toggle'
        }
        aria-label="Pond"
        aria-pressed={enabled}
        aria-expanded={enabled}
        onClick={onToggle}
      >
        {/* Icons render as CSS masks over currentColor (same idiom as the
            vibe toolbar) so color/hover/focus states come from CSS. */}
        <span
          className="vibe-pond-toggle-icon"
          style={{
            WebkitMaskImage: 'url(/toolbar/Pond-icon.svg)',
            maskImage: 'url(/toolbar/Pond-icon.svg)',
          }}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
