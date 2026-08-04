'use client'

import { FormEvent, RefObject, useId, useState } from 'react'
import {
  COLLABORATE_ENERGIZING_STATEMENT,
  COLLABORATE_GUIDE_CONTACT,
  COLLABORATE_GUIDE_DISCLOSURE,
  COLLABORATE_GUIDE_NAME,
  COLLABORATE_GUIDE_NEW,
  COLLABORATE_GUIDE_NEW_CONFIRM_CANCEL,
  COLLABORATE_GUIDE_NEW_CONFIRM_PROMPT,
  COLLABORATE_GUIDE_NEW_CONFIRM_YES,
  COLLABORATE_GUIDE_PENDING_HEADING,
  COLLABORATE_GUIDE_PREVIEW_LABEL,
  COLLABORATE_GUIDE_RESUME,
  COLLABORATE_GUIDE_VISITOR_LABEL,
  COLLABORATE_HEADLINE,
  CONVERSATION_STARTERS,
} from '../../content/collaborate'
import ContactActions from './ContactActions'
import {
  GUIDE_MAX_MESSAGE_CHARS,
  GuideConversationState,
  hasGuideConversation,
} from './guideConversation'

type GuideExperienceProps = {
  /** Mode-level focus target (owned by PortfolioExperience's focus management). */
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Controller-owned conversation state (PortfolioExperience). */
  state: GuideConversationState
  /** Starter selected: the shell applies its canvas treatment, navigates to
   *  the chat view, and sends the starter's authored prompt. */
  onStartStarter: (starterId: string) => void
  /** Freeform question submitted from the landing: navigates to the chat
   *  view and sends it (no inline answering here). */
  onStartFreeform: (content: string) => void
  /** Resume the in-memory conversation (navigates to the chat view). */
  onResume: () => void
  /** Confirmed "start new conversation": clears the conversation, its canvas
   *  treatments, and the share state. */
  onReset: () => void
}

/**
 * The guide landing: headline, statement, disclosure, and either the
 * conversation starters + freeform input (no conversation yet) or a preview
 * card for the in-memory conversation (resume, or start over behind an inline
 * confirm). Submitting from here never answers inline — it navigates to the
 * chat view. Contact routes stay visible in both states.
 */
export default function GuideExperience({
  headingRef,
  state,
  onStartStarter,
  onStartFreeform,
  onResume,
  onReset,
}: GuideExperienceProps) {
  const [draft, setDraft] = useState('')
  const [confirmingReset, setConfirmingReset] = useState(false)
  const inputId = useId()

  const hasConversation = hasGuideConversation(state)
  const lastVisitor = [...state.turns].reverse().find((turn) => turn.role === 'user')
  const lastGuide = [...state.turns].reverse().find((turn) => turn.role === 'assistant')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const content = draft.trim().slice(0, GUIDE_MAX_MESSAGE_CHARS)
    if (!content) return
    setDraft('')
    onStartFreeform(content)
  }

  return (
    <section className="collaborate-experience collaborate-guide" aria-label="Collaborate">
      <h2
        ref={headingRef as RefObject<HTMLHeadingElement>}
        tabIndex={-1}
        className="collaborate-heading"
      >
        {COLLABORATE_HEADLINE}
      </h2>
      <p className="collaborate-statement">{COLLABORATE_ENERGIZING_STATEMENT}</p>
      <p className="guide-disclosure">{COLLABORATE_GUIDE_DISCLOSURE}</p>
      {hasConversation ? (
        <div className="guide-preview" aria-label={COLLABORATE_GUIDE_PREVIEW_LABEL}>
          <h3 className="guide-preview-heading">
            {state.heading ?? COLLABORATE_GUIDE_PENDING_HEADING}
          </h3>
          <div className="guide-preview-exchange">
            {lastVisitor && (
              <p className="guide-preview-line">
                <span className="guide-preview-label">{COLLABORATE_GUIDE_VISITOR_LABEL}</span>{' '}
                {lastVisitor.content}
              </p>
            )}
            {lastGuide && (
              <p className="guide-preview-line">
                <span className="guide-preview-label">{COLLABORATE_GUIDE_NAME}</span>{' '}
                {lastGuide.content}
              </p>
            )}
          </div>
          <div className="guide-preview-actions">
            <button type="button" className="guide-preview-resume" onClick={onResume}>
              {COLLABORATE_GUIDE_RESUME}
            </button>
            {confirmingReset ? (
              <p className="guide-preview-confirm" role="group" aria-label={COLLABORATE_GUIDE_NEW}>
                <span className="guide-preview-confirm-prompt">
                  {COLLABORATE_GUIDE_NEW_CONFIRM_PROMPT}
                </span>
                <button
                  type="button"
                  className="guide-preview-new"
                  onClick={() => {
                    setConfirmingReset(false)
                    onReset()
                  }}
                >
                  {COLLABORATE_GUIDE_NEW_CONFIRM_YES}
                </button>
                <button
                  type="button"
                  className="guide-preview-new"
                  onClick={() => setConfirmingReset(false)}
                >
                  {COLLABORATE_GUIDE_NEW_CONFIRM_CANCEL}
                </button>
              </p>
            ) : (
              <button
                type="button"
                className="guide-preview-new"
                onClick={() => setConfirmingReset(true)}
              >
                {COLLABORATE_GUIDE_NEW}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="conversation-starters" role="group" aria-label="Conversation starters">
            {CONVERSATION_STARTERS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                className="conversation-starter"
                onClick={() => onStartStarter(starter.id)}
              >
                {starter.label}
              </button>
            ))}
          </div>
          <form className="guide-input-row" onSubmit={handleSubmit}>
            <label className="guide-input-label" htmlFor={inputId}>
              Ask the guide about Joel’s work
            </label>
            <div className="guide-input-controls">
              <textarea
                id={inputId}
                className="guide-input"
                value={draft}
                maxLength={GUIDE_MAX_MESSAGE_CHARS}
                rows={2}
                placeholder="Type your question — Enter to send, Shift+Enter for a new line"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSubmit(event)
                  }
                }}
              />
              <button type="submit" className="guide-submit" disabled={!draft.trim()}>
                Ask
              </button>
            </div>
          </form>
        </>
      )}
      <ContactActions contact={COLLABORATE_GUIDE_CONTACT} />
    </section>
  )
}
