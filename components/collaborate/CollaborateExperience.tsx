'use client'

import { RefObject } from 'react'
import {
  COLLABORATE_AI_GUIDE,
  COLLABORATE_CONTACT,
  COLLABORATE_ENERGIZING_STATEMENT,
  COLLABORATE_GUIDE_CONTACT,
  COLLABORATE_GUIDE_DISCLOSURE,
  COLLABORATE_HEADLINE,
  COLLABORATE_SHOW_STARTERS,
  CONVERSATION_STARTERS,
  getCollaborateStarter,
} from '../../content/collaborate'
import ConversationStarter from './ConversationStarter'
import ContactActions from './ContactActions'
import BoundedScrollPanel from '../BoundedScrollPanel'
import ChatShell from './ChatShell'
import GuideExperience from './GuideExperience'
import { GuideConversationState } from './guideConversation'

/** Everything the guide (preview, behind COLLABORATE_AI_GUIDE) needs from the
 *  shell: the two collaborate views and the controller-owned conversation
 *  state + actions. Canvas starter/topic treatments and analytics stay in
 *  PortfolioExperience. */
export type CollaborateGuideProps = {
  view: 'landing' | 'chat'
  state: GuideConversationState
  /** Focus target for the chat heading (entering/resuming the chat). */
  chatHeadingRef: RefObject<HTMLHeadingElement | null>
  /** Send a visitor message; a starter id also applies its canvas treatment. */
  onSend: (content: string, starterId?: string) => void
  onRetry: () => void
  onReset: () => void
  onShare: (replyEmail: string) => void
  onDraftChange: (draft: string) => void
  onNavigateToChat: () => void
  onNavigateToLanding: () => void
}

type CollaborateExperienceProps = {
  /** Controlled starter selection (owned by PortfolioExperience so the same
   *  state also drives the canvas descriptor's glyph phrase). */
  selectedStarterId: string | null
  onSelectStarter: (id: string) => void
  /** Mode-level focus target (owned by PortfolioExperience's focus management). */
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Guide mode only: view + conversation state + actions. Undefined until
   *  the shell has created its session (pre-hydration). */
  guide?: CollaborateGuideProps
}

/**
 * Conversation invitation surface. Two variants behind content flags:
 *
 * - COLLABORATE_AI_GUIDE on: the conversational AI guide — a landing
 *   (GuideExperience) and a chat view (ChatShell), switched by guide.view.
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
  guide,
}: CollaborateExperienceProps) {
  if (COLLABORATE_AI_GUIDE) {
    if (!guide) {
      // Pre-session render (SSR / first paint): the static invitation only —
      // no interactive controls that would depend on the session id.
      return (
        <BoundedScrollPanel
          className="collaborate-experience collaborate-guide"
          viewportClassName="collaborate-experience-viewport"
          label="Collaborate"
        >
          <h2
            ref={headingRef as RefObject<HTMLHeadingElement>}
            tabIndex={-1}
            className="collaborate-heading"
          >
            {COLLABORATE_HEADLINE}
          </h2>
          <p className="guide-disclosure">{COLLABORATE_GUIDE_DISCLOSURE}</p>
          <ContactActions contact={COLLABORATE_GUIDE_CONTACT} />
        </BoundedScrollPanel>
      )
    }
    if (guide.view === 'chat') {
      return (
        <ChatShell
          heading={guide.state.heading}
          state={guide.state}
          headingRef={guide.chatHeadingRef}
          onSend={(content) => guide.onSend(content)}
          onRetry={guide.onRetry}
          onDraftChange={guide.onDraftChange}
          onShare={guide.onShare}
          onBack={guide.onNavigateToLanding}
        />
      )
    }
    return (
      <GuideExperience
        headingRef={headingRef}
        state={guide.state}
        onStartStarter={(starterId) => {
          const starter = getCollaborateStarter(starterId)
          if (starter) guide.onSend(starter.prompt, starter.id)
        }}
        onStartFreeform={(content) => guide.onSend(content)}
        onResume={guide.onNavigateToChat}
        onReset={guide.onReset}
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
    <BoundedScrollPanel
      className="collaborate-experience"
      viewportClassName="collaborate-experience-viewport"
      label="Collaborate"
    >
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
    </BoundedScrollPanel>
  )
}
