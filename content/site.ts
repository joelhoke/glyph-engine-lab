import { COLLABORATE_CONTACT } from './collaborate'
import { ExperienceSceneKey } from '../engine/types'

/**
 * Site-level identity, recruiter links, and homepage doorway content.
 * Single source for the persistent header (SiteHeader), the homepage
 * identity block, and the doorway cards (DoorwayCard via PrimaryActions).
 *
 * Phase 0 placeholders still owed before launch:
 * - PORTRAIT/AVATAR: the treated monochrome portrait (48px + 200px crops,
 *   WebP + fallback). Both currently point at the monogram.
 * - RESUME: replace the placeholder public/resume.pdf with the final file.
 * - LINKEDIN: confirm the profile URL below.
 */
export const SITE_IDENTITY = {
  name: 'Joel Hoke',
  role: 'Senior Product Designer',
  positioning:
    'Seven years at Microsoft designing the future of work, from employee experience to agentic operations tools.',
  /** ~200px homepage portrait (placeholder: monogram, treated via CSS). */
  portraitSrc: '/JHLogo-180.png',
  /** ~48px header avatar (placeholder: monogram). */
  avatarSrc: '/JHLogo-180.png',
  portraitAlt: 'Portrait of Joel Hoke',
} as const

export const RECRUITER_LINKS = {
  resume: { url: '/resume.pdf', label: 'Résumé' },
  // TODO: confirm — guessed from the handle pattern, never verified.
  linkedin: { url: 'https://www.linkedin.com/in/joelhoke/', label: 'LinkedIn' },
  email: { url: COLLABORATE_CONTACT.mailtoUrl, label: 'Email' },
} as const

export type DoorwayPreview = {
  src: string
  alt: string
}

export type DoorwayCardContent = {
  key: ExperienceSceneKey
  label: string
  /** One-line promise: what the visitor gets past the doorway. */
  promise: string
  /** Cycling preview frames (first frame is the static/reduced-motion one). */
  previews: DoorwayPreview[]
  /** Evidence metadata — the Work card's role + timeframe line. */
  meta?: string
}

export const DOORWAY_CARDS: DoorwayCardContent[] = [
  {
    key: 'work',
    label: 'Work',
    promise: 'Three case studies from campus operations to employee experience.',
    meta: 'Senior Product Designer · Microsoft · 2019–2026',
    previews: [
      {
        src: '/assets/doorways/work-global-operations.jpg',
        alt: 'Global Operations — agentic campus operations keynote still',
      },
      {
        src: '/assets/doorways/work-employee-experience.jpg',
        alt: 'Employee Experience — Viva Connections dashboard',
      },
      {
        src: '/assets/doorways/work-global-compensation.jpg',
        alt: 'Global Compensation — Total Rewards portal',
      },
    ],
  },
  {
    key: 'vibe',
    label: 'Vibe',
    promise: 'A live playground for the glyph engine that powers this site.',
    previews: [
      {
        src: '/assets/doorways/vibe-signature.svg',
        alt: 'The playground in the Signature theme',
      },
      {
        src: '/assets/doorways/vibe-blueprint.svg',
        alt: 'The playground in the Blueprint theme',
      },
    ],
  },
  {
    key: 'collaborate',
    label: 'Collaborate',
    promise: 'Ask the AI guide anything — or go straight to Joel’s inbox.',
    previews: [
      {
        src: '/assets/doorways/collaborate-guide.svg',
        alt: 'A typographic card inviting a question for the guide',
      },
    ],
  },
]
