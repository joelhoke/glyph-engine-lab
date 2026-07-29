'use client'

import { RefObject, useEffect, useState } from 'react'
import {
  COLLABORATE_CONTACT,
  COLLABORATE_ENERGIZING_STATEMENT,
  COLLABORATE_HEADLINE,
  CONVERSATION_STARTERS,
  getCollaborateStarter,
} from '../../content/collaborate'
import ConversationStarter from './ConversationStarter'

type CollaborateExperienceProps = {
  /** Controlled starter selection (owned by PortfolioExperience so the same
   *  state also drives the canvas descriptor's glyph phrase). */
  selectedStarterId: string | null
  onSelectStarter: (id: string) => void
  /** Mode-level focus target (owned by PortfolioExperience's focus management). */
  headingRef: RefObject<HTMLHeadingElement | null>
}

type CopyState = 'idle' | 'success' | 'failure'

/**
 * Conversation invitation surface: a headline, a statement about energizing
 * collaboration, three keyboard-accessible starters, and two contact routes.
 * Starter selection only announces its reply via aria-live — focus stays
 * where the user put it. The primary action is a plain mailto: link (works
 * without JavaScript); copy-to-clipboard is progressive enhancement, falling
 * back to the address as selectable text when the Clipboard API is missing
 * or the write fails. Everything here is readable with the canvas disabled.
 */
export default function CollaborateExperience({
  selectedStarterId,
  onSelectStarter,
  headingRef,
}: CollaborateExperienceProps) {
  const selectedStarter = getCollaborateStarter(selectedStarterId)
  const [copyState, setCopyState] = useState<CopyState>('idle')

  // Clipboard availability is only known on the client, after hydration —
  // detecting it in an effect keeps the SSR/no-JS render (selectable address
  // text) free of hydration mismatches.
  const [clipboardAvailable, setClipboardAvailable] = useState(false)
  useEffect(() => {
    setClipboardAvailable(
      typeof navigator !== 'undefined' &&
        typeof navigator.clipboard?.writeText === 'function',
    )
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(COLLABORATE_CONTACT.email)
      setCopyState('success')
    } catch {
      setCopyState('failure')
    }
  }

  const showAddressText = !clipboardAvailable || copyState === 'failure'
  const copyFeedback =
    copyState === 'success'
      ? COLLABORATE_CONTACT.copySuccessMessage
      : copyState === 'failure'
        ? COLLABORATE_CONTACT.copyFailureMessage
        : ''

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
      <div className="collaborate-contact">
        <a className="collaborate-primary-action" href={COLLABORATE_CONTACT.mailtoUrl}>
          {COLLABORATE_CONTACT.primaryLabel}
        </a>
        {clipboardAvailable && (
          <button type="button" className="collaborate-copy-button" onClick={handleCopy}>
            {COLLABORATE_CONTACT.copyLabel}
          </button>
        )}
      </div>
      <p className="collaborate-copy-feedback" role="status">
        {copyFeedback}
      </p>
      {showAddressText && (
        <p className="collaborate-address">
          <span className="collaborate-address-value">{COLLABORATE_CONTACT.email}</span>
        </p>
      )}
    </section>
  )
}
