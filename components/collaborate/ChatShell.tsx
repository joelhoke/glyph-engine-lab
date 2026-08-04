'use client'

import { FormEvent, KeyboardEvent, RefObject, useEffect, useId, useRef, useState } from 'react'
import {
  COLLABORATE_GUIDE_ANSWERED_ANNOUNCEMENT,
  COLLABORATE_GUIDE_BACK_LABEL,
  COLLABORATE_GUIDE_COMPOSER_LABEL,
  COLLABORATE_GUIDE_COMPOSER_PLACEHOLDER,
  COLLABORATE_GUIDE_CONTACT,
  COLLABORATE_GUIDE_DETAILS,
  COLLABORATE_GUIDE_NAME,
  COLLABORATE_GUIDE_PENDING_HEADING,
  COLLABORATE_GUIDE_SEND_LABEL,
  COLLABORATE_GUIDE_VISITOR_LABEL,
} from '../../content/collaborate'
import { BackArrowIcon, LinkIcon, SendIcon } from '../icons'
import ContactActions from './ContactActions'
import GuideShareFlow from './GuideShareFlow'
import {
  GUIDE_MAX_MESSAGE_CHARS,
  GuideAssistantTurn,
  GuideConversationState,
  isGuideLimitReached,
  latestAssistantTurn,
} from './guideConversation'

/** The composer's auto-grow ceiling (px) — bounded so long drafts never push
 *  the rail/transcript out of reach. */
const COMPOSER_MAX_HEIGHT_PX = 128

type ChatShellProps = {
  /** Locked conversation title (null until the first answer arrives). */
  heading: string | null
  /** Controller-owned conversation state (PortfolioExperience). */
  state: GuideConversationState
  /** Focus target for entering/resuming the chat (shell focus management). */
  headingRef: RefObject<HTMLHeadingElement | null>
  onSend: (content: string) => void
  onRetry: () => void
  onDraftChange: (draft: string) => void
  onShare: (replyEmail: string) => void
  onBack: () => void
}

function formatTurnTime(at: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(at),
  )
}

function SourceChips({ turn }: { turn: GuideAssistantTurn }) {
  if (turn.sourceCards.length === 0) return null
  return (
    <div className="guide-sources" role="group" aria-label="Sources">
      {turn.sourceCards.map((card) =>
        card.url ? (
          <a key={card.id} className="guide-source" href={card.url}>
            <LinkIcon />
            {card.label}
          </a>
        ) : (
          <span key={card.id} className="guide-source">
            <LinkIcon />
            {card.label}
          </span>
        ),
      )}
    </div>
  )
}

/**
 * The dedicated chat view: a header (back + generated heading), an
 * independently scrolling transcript, and a fixed bottom area (the latest
 * answer's source chips + follow-ups in a rail above the composer). Each
 * answer also keeps its own source chips attached — the rail mirrors only the
 * LATEST answer.
 *
 * Accessibility: turn timestamps are client-only presentation (never sent to
 * any endpoint or analytics); newly arrived answers are announced by a single
 * visually-hidden polite status node without moving focus; the share flow and
 * direct-email actions live in a native <details> footer.
 */
export default function ChatShell({
  heading,
  state,
  headingRef,
  onSend,
  onRetry,
  onDraftChange,
  onShare,
  onBack,
}: ChatShellProps) {
  const inputId = useId()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)

  const pending = state.status === 'pending'
  const limitReached = isGuideLimitReached(state)
  const latestAnswer = latestAssistantTurn(state.turns)
  const answerCount = state.turns.reduce(
    (count, turn) => (turn.role === 'assistant' ? count + 1 : count),
    0,
  )

  // One dedicated polite status node announces newly arrived guide answers;
  // focus deliberately stays where the visitor put it.
  const [announcement, setAnnouncement] = useState('')
  const announcedCountRef = useRef(0)
  useEffect(() => {
    if (answerCount > announcedCountRef.current) {
      setAnnouncement(COLLABORATE_GUIDE_ANSWERED_ANNOUNCEMENT)
    }
    announcedCountRef.current = answerCount
  }, [answerCount])

  // Keep the transcript pinned to the latest turn (instant scroll — no JS
  // animation, so reduced motion needs nothing extra).
  useEffect(() => {
    const node = transcriptRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [state.turns.length, pending])

  // Auto-growing composer, bounded to a max height.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`
  }, [state.draft])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSend(state.draft)
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend(state.draft)
    }
  }

  return (
    <section className="chat-shell" aria-label="Conversation with Joel’s guide">
      <header className="chat-header">
        <button
          type="button"
          className="chat-back"
          aria-label={COLLABORATE_GUIDE_BACK_LABEL}
          onClick={onBack}
        >
          <BackArrowIcon />
        </button>
        <h2 ref={headingRef as RefObject<HTMLHeadingElement>} tabIndex={-1} className="chat-heading">
          {heading ?? COLLABORATE_GUIDE_PENDING_HEADING}
        </h2>
      </header>
      <div className="chat-transcript" ref={transcriptRef}>
        <ol className="chat-turns">
          {state.turns.map((turn, index) =>
            turn.role === 'user' ? (
              <li key={index} className="chat-turn chat-turn-visitor">
                <p className="chat-turn-meta">
                  {COLLABORATE_GUIDE_VISITOR_LABEL} | {formatTurnTime(turn.at)}
                </p>
                <p className="chat-visitor-card">{turn.content}</p>
              </li>
            ) : (
              <li key={index} className="chat-turn">
                <article className="chat-answer">
                  <p className="chat-turn-meta">
                    {COLLABORATE_GUIDE_NAME} | {formatTurnTime(turn.at)}
                  </p>
                  <p className="chat-answer-text">{turn.content}</p>
                  <SourceChips turn={turn} />
                </article>
              </li>
            ),
          )}
          {pending && (
            <li className="chat-turn">
              <p className="guide-loading" role="status">
                Thinking…
              </p>
            </li>
          )}
        </ol>
        {state.status === 'error' && state.error && (
          <div className="guide-error" role="alert">
            <p>
              {state.error === 'offline'
                ? 'The AI guide is offline right now.'
                : 'The guide couldn’t answer that just now.'}{' '}
              <a href={COLLABORATE_GUIDE_CONTACT.mailtoUrl}>Email Joel directly</a> — he’d love to
              hear from you.
            </p>
            <button
              type="button"
              className="guide-retry"
              disabled={pending}
              onClick={onRetry}
            >
              Try again
            </button>
          </div>
        )}
        {limitReached && (
          <p className="guide-limit" role="status">
            This conversation has reached its session limit — Joel is happy to continue by email.
          </p>
        )}
        {latestAnswer && (
          <details className="chat-details">
            <summary>{COLLABORATE_GUIDE_DETAILS}</summary>
            <div className="chat-details-body">
              <GuideShareFlow key={state.generation} share={state.share} onShare={onShare} />
              <ContactActions contact={COLLABORATE_GUIDE_CONTACT} />
            </div>
          </details>
        )}
      </div>
      <div className="chat-bottom">
        {latestAnswer && (latestAnswer.sourceCards.length > 0 || latestAnswer.followUps.length > 0) && (
          <div className="chat-rail">
            <SourceChips turn={latestAnswer} />
            {latestAnswer.followUps.length > 0 && !limitReached && (
              <div className="guide-followups" role="group" aria-label="Follow-up questions">
                {latestAnswer.followUps.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="guide-followup"
                    disabled={pending}
                    onClick={() => onSend(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!limitReached && (
          <form className="chat-composer" onSubmit={handleSubmit}>
            <label className="visually-hidden" htmlFor={inputId}>
              {COLLABORATE_GUIDE_COMPOSER_LABEL}
            </label>
            <textarea
              id={inputId}
              ref={textareaRef}
              className="chat-input"
              value={state.draft}
              maxLength={GUIDE_MAX_MESSAGE_CHARS}
              rows={1}
              disabled={pending}
              placeholder={COLLABORATE_GUIDE_COMPOSER_PLACEHOLDER}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <button
              type="submit"
              className="chat-send"
              disabled={pending || !state.draft.trim()}
              aria-label={COLLABORATE_GUIDE_SEND_LABEL}
            >
              <SendIcon />
            </button>
          </form>
        )}
      </div>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </section>
  )
}
