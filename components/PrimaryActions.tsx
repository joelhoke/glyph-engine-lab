'use client'

import PrimaryAction from './PrimaryAction'

type PrimaryActionsProps = {
  selected: ExperienceKey | null
  onSelect: (key: ExperienceKey) => void
}

export type ExperienceKey = 'work' | 'vibes' | 'make'

const actions: { key: ExperienceKey; label: string; hue: string }[] = [
  { key: 'work', label: 'Work', hue: '20deg' },
  { key: 'vibes', label: 'Vibes', hue: '200deg' },
  { key: 'make', label: 'Make Something', hue: '320deg' },
]

export default function PrimaryActions({ selected, onSelect }: PrimaryActionsProps) {
  return (
    <div className="primary-actions" role="group" aria-label="Primary portfolio actions">
      {actions.map((action) => (
        <PrimaryAction
          key={action.key}
          label={action.label}
          selected={selected === action.key}
          onClick={() => onSelect(action.key)}
          hue={action.hue}
        />
      ))}
    </div>
  )
}
