'use client'

import { Ref } from 'react'
import DoorwayCard from './DoorwayCard'
import { DOORWAY_CARDS } from '../content/site'

type PrimaryActionsProps = {
  selected: ExperienceKey | null
  onSelect: (key: ExperienceKey) => void
  groupRef?: Ref<HTMLDivElement>
}

export type ExperienceKey = 'work' | 'vibe' | 'collaborate'

/** BorderBeam hue per doorway, keyed to match DOORWAY_CARDS order. */
const DOORWAY_HUES: Record<ExperienceKey, string> = {
  work: '20deg',
  vibe: '200deg',
  collaborate: '320deg',
}

export const PRIMARY_ACTION_COUNT = DOORWAY_CARDS.length

/**
 * The homepage doorway group (homepage-redesign phase 3): one DoorwayCard per
 * section. Keeps the intro-sequence contract — the shell's rAF loop toggles
 * options-hidden/options-inert/aria-hidden/inert on this group and drives
 * --option-progress-{i}, consumed per slot via the stable data-action-index.
 */
export default function PrimaryActions({ selected, onSelect, groupRef }: PrimaryActionsProps) {
  return (
    <div
      ref={groupRef}
      className="primary-actions options-inert"
      role="group"
      aria-label="Primary portfolio actions"
      aria-hidden="true"
    >
      {DOORWAY_CARDS.map((card, index) => (
        <div
          key={card.key}
          className="primary-action-slot"
          data-action-index={index}
        >
          <DoorwayCard
            card={card}
            selected={selected === card.key}
            onClick={() => onSelect(card.key)}
            hue={DOORWAY_HUES[card.key]}
            style={{ '--option-index': String(index) } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  )
}
