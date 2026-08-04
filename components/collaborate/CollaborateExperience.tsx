'use client'

import { RefObject } from 'react'
import {
  COLLABORATE_AI_GUIDE,
  COLLABORATE_CONTACT,
  COLLABORATE_ENERGIZING_STATEMENT,
  COLLABORATE_HEADLINE,
  COLLABORATE_SHOW_STARTERS,
  CONVERSATION_STARTERS,
  CollaborateTopic,
  getCollaborateStarter,
} from '../../content/collaborate'
import { AnalyticsEvent } from '../../engine/analytics'
import ConversationStarter from './ConversationStarter'
import ContactActions from './ContactActions'
import GuideExperience from './GuideExperience'

type CollaborateExperienceProps = {
  /** Controlled starter selection (owned by PortfolioExperience so the same
   *  state also drives the canvas descriptor's glyph phrase). */
  selectedStarterId: string | null
  onSelectStarter: (id: string) => void
  /** Mode-level focus target (owned by PortfolioExperience's focus management). */
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Guide mode only: reports the latest answer's canvas topic upward. */
  onGuideTopic?: (topic: CollaborateTopic | null) => void
  /** Guide mode only: consented, metadata-only analytics. */
  onTrackEvent?: (event: AnalyticsEvent) => void
}

/**
 * Conversation invitation surface. Two variants behind content flags:
 *
 * - COLLABORATE_AI_GUIDE on: the conversational AI guide (GuideExperience).
 * - Otherwise (production today): a headline, a statement about energizing
 *   collaboration, the scripted starters (gated by COLLABORATE_SHOW_STARTERS),
 *   and the two contact routes. Starter selection only announces its reply
 *   via aria-live — focus stays where the user put it.
 *
 * Everything here is readable with the canvas disabled.
 */
export default function CollaborateExperience({
  selectedStarterId,
  onSelectStarter,
  headingRef,
  onGuideTopic,
  onTrackEvent,
}: CollaborateExperienceProps) {
  if (COLLABORATE_AI_GUIDE) {
    return (
      <GuideExperience
        headingRef={headingRef}
        onGuideTopic={onGuideTopic}
        onTrackEvent={onTrackEvent}
      />
    )
  }
  return (
    <ScriptedInvitation
      selectedStarterId={selectedStarterId}
      onSelectStarter={onSelectStarter}
      headingRef={headingRef}
    />
  )
}

type ScriptedInvitationProps = {
  selectedStarterId: string | null
  onSelectStarter: (id: string) => void
  headingRef: RefObject<HTMLHeadingElement | null>
}

/** The original scripted experience — unchanged while the guide is gated. */
function ScriptedInvitation({
  selectedStarterId,
  onSelectStarter,
  headingRef,
}: ScriptedInvitationProps) {
  const selectedStarter = getCollaborateStarter(selectedStarterId)

  return (
    <section className="collaborate-experience" aria-label="Collaborate">
      <h2
        ref={headingRef as RefObject<HTMLHeadingElement>}
        tabIndex={-1}
        className="collaborate-heading"
      >
        {COLLABORATE_HEADLINE}
      </h2>
      <p className="collaborate-statement">{COLLABORATE_ENERGIZING_STATEMENT}</p>
      {COLLABORATE_SHOW_STARTERS && (
        <>
          <div className="conversation-starters" role="group" aria-label="Conversation starters">
            {CONVERSATION_STARTERS.map((starter) => (
              <ConversationStarter
                key={starter.id}
                starter={starter}
                selected={starter.id === selectedStarterId}
                onSelect={onSelectStarter}
              />
            ))}
          </div>
          <p className="conversation-response" aria-live="polite">
            {selectedStarter ? selectedStarter.response : ''}
          </p>
        </>
      )}
      <ContactActions contact={COLLABORATE_CONTACT} />
    </section>
  )
}
