'use client'

import { ExperienceSceneKey } from '../engine/types'

type ExperienceNavProps = {
  active: ExperienceSceneKey | null
  onSelect: (key: ExperienceSceneKey) => void
  /** Extra classes for the nav element (e.g. the mobile chat-active state
   *  that hides the nav to reclaim vertical space). */
  className?: string
}

const NAV_ITEMS: { key: ExperienceSceneKey; label: string }[] = [
  { key: 'work', label: 'Work' },
  { key: 'vibe', label: 'Vibe' },
  { key: 'collaborate', label: 'Collaborate' },
]

/**
 * Persistent top nav for the experience shell. Rendered only after the intro
 * has been exited; buttons are natively keyboard reachable and the active
 * mode is exposed via aria-current.
 */
export default function ExperienceNav({ active, onSelect, className }: ExperienceNavProps) {
  return (
    <nav
      className={`experience-nav${className ? ` ${className}` : ''}`}
      aria-label="Experience"
    >
      <ul className="experience-nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className="experience-nav-button"
              aria-current={active === item.key ? 'page' : undefined}
              onClick={() => onSelect(item.key)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
