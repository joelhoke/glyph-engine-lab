'use client'

import { ExperienceSceneKey } from '../engine/types'
import { RECRUITER_LINKS } from '../content/site'
import JHLogotype from './JHLogotype'

type SiteHeaderProps = {
  /** The settled section, or null on the home/landing state. */
  active: ExperienceSceneKey | null
  onSelect: (key: ExperienceSceneKey) => void
  /** Lockup click: return to the home/landing state (`/`). */
  onHome: () => void
  /** Extra classes for the header element (e.g. the mobile chat-active state
   *  that collapses the tab list to reclaim vertical space). */
  className?: string
}

const NAV_ITEMS: { key: ExperienceSceneKey; label: string }[] = [
  { key: 'work', label: 'Work' },
  { key: 'vibe', label: 'Vibe' },
  { key: 'collaborate', label: 'Collaborate' },
]

/**
 * Persistent site frame (homepage-redesign phase 1). Always rendered — on the
 * landing and inside every section — so the recruiter shortcuts (résumé,
 * LinkedIn, email), the section tabs, and the way home are reachable in one
 * click from anywhere. Sits above the canvas and the foreground layer; the
 * tab list reuses the experience-nav pill classes so its styling and theme
 * transitions stay in one place.
 */
export default function SiteHeader({ active, onSelect, onHome, className }: SiteHeaderProps) {
  return (
    <header className={`site-header${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="site-header-home"
        onClick={onHome}
        aria-label="joel hoke design — back to home"
      >
        {/* The logotype is the whole lockup: inlined with currentColor so the
            theme sets it (near-white on dark, near-black on light). */}
        <JHLogotype className="site-header-logotype" aria-hidden="true" />
      </button>
      <nav className="site-header-nav" aria-label="Experience">
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
      <div className="site-header-links">
        <a href={RECRUITER_LINKS.resume.url} target="_blank" rel="noopener noreferrer">
          {RECRUITER_LINKS.resume.label}
        </a>
        <a href={RECRUITER_LINKS.linkedin.url} target="_blank" rel="noopener noreferrer">
          {RECRUITER_LINKS.linkedin.label}
          <span aria-hidden="true"> ↗</span>
        </a>
        <a href={RECRUITER_LINKS.email.url}>{RECRUITER_LINKS.email.label}</a>
      </div>
    </header>
  )
}
