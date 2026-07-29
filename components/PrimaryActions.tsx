'use client'

import { Ref, RefObject } from 'react'
import PrimaryAction from './PrimaryAction'

type PrimaryActionsProps = {
  selected: ExperienceKey | null
  onSelect: (key: ExperienceKey) => void
  groupRef?: Ref<HTMLDivElement>
}

export type ExperienceKey = 'work' | 'vibe' | 'collaborate'

export const primaryActions = [
  { key: 'work' as const, label: 'Work', hue: '20deg' },
  { key: 'vibe' as const, label: 'Vibe', hue: '200deg' },
  { key: 'collaborate' as const, label: 'Collaborate', hue: '320deg' },
]

export const PRIMARY_ACTION_COUNT = primaryActions.length

export default function PrimaryActions({ selected, onSelect, groupRef }: PrimaryActionsProps) {
  return (
    <div
      ref={groupRef}
      className="primary-actions options-inert"
      role="group"
      aria-label="Primary portfolio actions"
      aria-hidden="true"
    >
      {primaryActions.map((action, index) => (
        <div
          key={action.key}
          className="primary-action-slot"
          data-action-index={index}
        >
          <PrimaryAction
            label={action.label}
            selected={selected === action.key}
            onClick={() => onSelect(action.key)}
            hue={action.hue}
            style={{ '--option-index': String(index) } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  )
}
