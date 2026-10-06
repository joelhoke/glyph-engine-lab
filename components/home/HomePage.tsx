'use client'

import './HomeSections.css'
import { Ref } from 'react'
import { HOME_CONTENT, HOME_SECTIONS, HomeSectionId } from '../../content/home'
import { RECRUITER_LINKS, SITE_IDENTITY } from '../../content/site'
import HomeHero from './HomeHero'
import HomeSection from './HomeSection'
import { DEFAULT_HERO_RENDERERS, HeroRenderers } from './HeroObject'
import type { HomeGalleryProject } from './galleryProjects'
import type { HomeGuideBridge } from './HomePhoneChat'

type HomePageProps = {
  galleryProjects: HomeGalleryProject[]
  guide: HomeGuideBridge
  sectionsEnabled: boolean
  /** Navigation callbacks and conversation state come from the shell. */
  onSectionLink: (event: React.MouseEvent<HTMLAnchorElement>, section: HomeSectionId) => void
  /** Reports the hero element so the shell can size the canvas viewport to it
   *  (ResizeObserver) and track its visibility (IntersectionObserver). */
  heroRef?: Ref<HTMLElement>
  /** Shell gate for the hero parallax loop (hero onscreen on Home; phase 5
   *  will AND in menu-covered). Defaults to enabled. */
  heroParallaxEnabled?: boolean
  /** Per-slot 3D rest orientations in degrees (tuning panel Hero section) —
   *  keyed by slot id; forwarded to the custom renderers/notebook. */
  heroRotations?: Record<string, { x: number; y: number }>
  /** Custom hero preview renderers (empty this phase). */
  renderers?: HeroRenderers
}

/**
 * The homepage: hero fan, oversized statement, five destination
 * sections, and a normal-flow footer with the recruiter
 * links. Replaces the doorway-card landing (PrimaryActions); its content and
 * navigation are available immediately — nothing here is gated on the intro
 * reveal, which runs independently on the canvas behind the hero.
 */
export default function HomePage({
  onSectionLink,
  heroRef,
  heroParallaxEnabled,
  heroRotations,
  renderers,
  galleryProjects,
  guide,
  sectionsEnabled,
}: HomePageProps) {
  const content = HOME_CONTENT
  return (
    <div className="home-page">
      <HomeHero
        slots={content.heroSlots}
        portrait={content.portrait}
        renderers={{ ...DEFAULT_HERO_RENDERERS, ...(renderers ?? {}) }}
        introduction={content.introduction}
        onSectionLink={onSectionLink}
        heroRef={heroRef}
        parallaxEnabled={heroParallaxEnabled}
        slotRotations={heroRotations}
      />
      {/* Oversized Cabin statement directly below the hero; emphasis spans use
          the theme accent/warm tokens (editable in content/home.ts). */}
      <p className="home-statement">
        {content.statement.map((part, index) => (
          <span
            key={index}
            className={part.tone && part.tone !== 'default' ? `home-statement-${part.tone}` : undefined}
          >
            {part.text}{' '}
          </span>
        ))}
      </p>
      {HOME_SECTIONS.map((id) => (
        <HomeSection key={id} id={id} section={content.sections[id]} enabled={sectionsEnabled}
          galleryProjects={galleryProjects} guide={guide} />
      ))}
      {/* Normal-flow homepage footer (the menu phase also carries these
          links). Distinct from the phone-only fixed bar in SiteHeader. */}
      <footer className="home-footer">
        <p className="home-footer-identity">
          {SITE_IDENTITY.name} — {SITE_IDENTITY.role}
        </p>
        <nav className="home-footer-links" aria-label="Contact and site information">
          <a href={RECRUITER_LINKS.resume.url} target="_blank" rel="noopener noreferrer">
            {RECRUITER_LINKS.resume.label}
          </a>
          <a href={RECRUITER_LINKS.linkedin.url} target="_blank" rel="noopener noreferrer">
            {RECRUITER_LINKS.linkedin.label}
            <span aria-hidden="true"> ↗</span>
          </a>
          <a href={RECRUITER_LINKS.email.url}>{RECRUITER_LINKS.email.label}</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </footer>
    </div>
  )
}
