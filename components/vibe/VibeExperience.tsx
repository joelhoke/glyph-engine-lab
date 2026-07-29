'use client'

import { RefObject, useEffect, useId, useState } from 'react'
import { BorderBeam } from 'border-beam'
import { EXPERIENCE_SCENES } from '../../engine/sceneConfig'
import { VIBE_INVITATION, VIBE_MAKE_IT_YOURS_LABEL } from '../../content/vibe'

/** Subtle surface-level status for the source lifecycle. */
export type VibeSurfaceStatus = {
  state: 'processing' | 'error'
  message: string
}

type VibeExperienceProps = {
  /** Mode-level focus target (owned by PortfolioExperience's focus management). */
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Upload lifecycle status surfaced inside the closed card. */
  status: VibeSurfaceStatus | null
  /** When true, the card unmounts entirely and only the control dock shows. */
  controlsOpen: boolean
  onOpenControls: () => void
  /** Focus target restored when the dock closes (PortfolioExperience owns it). */
  ctaRef: RefObject<HTMLButtonElement | null>
  /** id of the control dock region, for aria-controls. */
  controlsId: string
}

/**
 * Vibe surface (Stage 3): a single bordered, blurred, colorful-beam card
 * holding the heading, the invitation, the status line, and the "Make it
 * yours" entry point. It is mutually exclusive with the control dock — when
 * the dock opens this card unmounts entirely, and closing the dock restores
 * both the card and focus on its CTA.
 */
export default function VibeExperience({
  headingRef,
  status,
  controlsOpen,
  onOpenControls,
  ctaRef,
  controlsId,
}: VibeExperienceProps) {
  const scene = EXPERIENCE_SCENES.vibe
  const stableId = useId().replace(/:/g, '-')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (controlsOpen) return null

  const card = (
    <div className="vibe-invitation-card">
      <h2
        ref={headingRef as RefObject<HTMLHeadingElement>}
        tabIndex={-1}
        className="vibe-heading"
      >
        {scene.copy.heading}
      </h2>
      <p className="vibe-invitation">{VIBE_INVITATION}</p>
      {status && (
        <p
          className={[
            'vibe-status',
            status.state === 'error' && 'vibe-status-error',
          ].filter(Boolean).join(' ')}
          role="status"
          aria-live="polite"
        >
          {status.message}
        </p>
      )}
      <button
        ref={ctaRef as RefObject<HTMLButtonElement>}
        type="button"
        className="vibe-cta"
        onClick={onOpenControls}
        aria-expanded={controlsOpen}
        aria-controls={controlsId}
      >
        {VIBE_MAKE_IT_YOURS_LABEL} →
      </button>
    </div>
  )

  return (
    <section className="vibe-experience" aria-label="Vibe">
      {mounted ? (
        <BorderBeam
          size="md"
          colorVariant="colorful"
          staticColors
          hueRange={0}
          theme="auto"
          strength={0.45}
          className="vibe-card-beam"
          id={stableId}
        >
          {card}
        </BorderBeam>
      ) : (
        card
      )}
    </section>
  )
}
