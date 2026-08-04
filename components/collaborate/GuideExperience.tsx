'use client'

import { FormEvent, KeyboardEvent, RefObject, useEffect, useId, useRef, useState } from 'react'
import {
  COLLABORATE_ENERGIZING_STATEMENT,
  COLLABORATE_GUIDE_CONTACT,
  COLLABORATE_GUIDE_DISCLOSURE,
  COLLABORATE_HEADLINE,
  COLLABORATE_TOPICS,
  CONVERSATION_STARTERS,
  CollaborateTopic,
} from '../../content/collaborate'
import { AnalyticsEvent } from '../../engine/analytics'
import ContactActions from './ContactActions'

// Mirrors the server-side limits (functions/lib/collaborateShared.ts).
const MAX_MESSAGE_CHARS = 800
const MAX_VISITOR_TURNS = 12

type GuideSourceCard = { id: string; label: string; url?: string }

type GuideTurn =
  | { role: 'user'; content: string }
  | {
      role: 'assistant'
      content: string
      sourceCards: GuideSourceCard[]
      followUps: string[]
      topic: CollaborateTopic
      modelClass: string
      profileVersion: string
    }

type GuideError = 'offline' | 'generic'

type ShareStatus = 'idle' | 'sending' | 'done' | 'error'

type GuideExperienceProps = {
  /** Mode-level focus target (owned by PortfolioExperience's focus management). */
  headingRef: RefObject<HTMLHeadingElement | null>
  /** Reports the latest answer's canvas topic upward so the scene descriptor
   *  morphs to the authored per-topic treatment. */
  onGuideTopic?: (topic: CollaborateTopic | null) => void
  /** Consented, metadata-only analytics (never message text). */
  onTrackEvent?: (event: AnalyticsEvent) => void
}

const isTopic = (value: unknown): value is CollaborateTopic =>
  typeof value === 'string' && (COLLABORATE_TOPICS as readonly string[]).includes(value)

/** Bounds-safe parse of the guide response — anything unexpected throws and
 *  the caller falls back to the calm error card. */
function parseAnswer(data: unknown): Omit<Extract<GuideTurn, { role: 'assistant' }>, 'role'> {
  if (typeof data !== 'object' || data === null) throw new Error('bad response')
  const body = data as Record<string, unknown>
  if (typeof body.answer !== 'string' || !body.answer.trim()) throw new Error('bad response')
  const sourceCards: GuideSourceCard[] = Array.isArray(body.sourceCards)
    ? body.sourceCards.flatMap((card): GuideSourceCard[] => {
        if (typeof card !== 'object' || card === null) return []
        const c = card as Record<string, unknown>
        if (typeof c.id !== 'string' || typeof c.label !== 'string') return []
        return [{ id: c.id, label: c.label, ...(typeof c.url === 'string' ? { url: c.url } : {}) }]
      })
    : []
  const followUps = Array.isArray(body.followUps)
    ? body.followUps.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 2)
    : []
  return {
    content: body.answer,
    sourceCards,
    followUps,
    topic: isTopic(body.topic) ? body.topic : 'unknown',
    modelClass: typeof body.modelClass === 'string' ? body.modelClass : 'unknown',
    profileVersion: typeof body.profileVersion === 'string' ? body.profileVersion : 'unknown',
  }
}

/**
 * The conversational AI guide to Joel (preview-only, behind
 * COLLABORATE_AI_GUIDE). Session-scoped, client-side only: a fresh session id
 * per mount, the full transcript posted with each question, and nothing sent
 * to analytics but metadata. Starters submit their authored prompt; the
 * freeform input enforces the same 800-character / 12-turn limits as the
 * server. Every failure keeps the typed draft and points at the email route.
 */
export default function GuideExperience({
  headingRef,
  onGuideTopic,
  onTrackEvent,
}: GuideExperienceProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [turns, setTurns] = useState<GuideTurn[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<GuideError | null>(null)
  const [shareConsent, setShareConsent] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle')
  const [receiptId, setReceiptId] = useState<string | null>(null)

  const lastAttemptRef = useRef('')
  const latestAnswerRef = useRef<HTMLElement | null>(null)
  const inputId = useId()
  const emailId = useId()

  // Session id is generated once per mount, lazily in an effect, so the
  // server-rendered markup never depends on it (no hydration mismatch).
  useEffect(() => {
    setSessionId(
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    )
  }, [])

  const visitorTurns = turns.filter((turn) => turn.role === 'user').length
  const limitReached = visitorTurns >= MAX_VISITOR_TURNS
  const hasAnswer = turns.some((turn) => turn.role === 'assistant')

  // On answer arrival, move focus to the new answer card (without scrolling)
  // so keyboard and screen-reader visitors land on it; the log's polite live
  // region announces it too.
  useEffect(() => {
    if (turns.length > 0 && turns[turns.length - 1].role === 'assistant') {
      latestAnswerRef.current?.focus({ preventScroll: true })
    }
  }, [turns])

  const send = async (raw: string) => {
    const content = raw.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!content || loading || limitReached || !sessionId) return
    lastAttemptRef.current = content
    const history = [
      ...turns.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content },
    ]
    setTurns((prev) => [...prev, { role: 'user', content }])
    setDraft('')
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/collaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: history }),
      })
      const data: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setError(res.status === 503 ? 'offline' : 'generic')
        throw new Error('request failed')
      }
      const answer = parseAnswer(data)
      setTurns((prev) => [...prev, { role: 'assistant', ...answer }])
      onGuideTopic?.(answer.topic)
      onTrackEvent?.({
        name: 'collaborate_guide_answered',
        params: { topic: answer.topic, model_class: answer.modelClass },
      })
    } catch {
      // Roll the optimistic visitor turn back so nothing is lost; the typed
      // draft is restored and the error card offers retry + email.
      setTurns((prev) => prev.slice(0, -1))
      setDraft((prev) => (prev.trim() ? prev : content))
      setError((prev) => prev ?? 'generic')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void send(draft)
  }

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send(draft)
    }
  }

  const handleShare = async () => {
    if (shareStatus === 'sending' || shareStatus === 'done') return
    setShareStatus('sending')
    try {
      const lastAssistant = [...turns].reverse().find((turn) => turn.role === 'assistant')
      const res = await fetch('/api/collaborate/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: turns.map((turn) => ({ role: turn.role, content: turn.content })),
          consentVersion: 'v1',
          // The reply email goes only to the share endpoint — never to the
          // guide endpoint or analytics.
          ...(shareEmail.trim() ? { replyEmail: shareEmail.trim() } : {}),
          ...(lastAssistant && lastAssistant.role === 'assistant'
            ? {
                modelRoute: {
                  modelClass: lastAssistant.modelClass,
                  profileVersion: lastAssistant.profileVersion,
                },
              }
            : {}),
        }),
      })
      const data: unknown = await res.json().catch(() => null)
      const body = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
      if (!res.ok || body.ok !== true || typeof body.receiptId !== 'string') {
        throw new Error('share failed')
      }
      setReceiptId(body.receiptId)
      setShareStatus('done')
    } catch {
      setShareStatus('error')
    }
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
      <div className="conversation-starters" role="group" aria-label="Conversation starters">
        {CONVERSATION_STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            className="conversation-starter"
            disabled={loading || limitReached}
            onClick={() => void send(starter.prompt)}
          >
            {starter.label}
          </button>
        ))}
      </div>
      {turns.length > 0 && (
        <div className="guide-log" aria-live="polite">
          {turns.map((turn, index) =>
            turn.role === 'user' ? (
              <p key={index} className="guide-turn-user">
                <span className="guide-turn-label">You</span>
                {turn.content}
              </p>
            ) : (
              <article
                key={index}
                className="guide-answer"
                tabIndex={-1}
                ref={index === turns.length - 1 ? latestAnswerRef : undefined}
              >
                <p className="guide-answer-text">{turn.content}</p>
                {turn.sourceCards.length > 0 && (
                  <div className="guide-sources" role="group" aria-label="Sources">
                    {turn.sourceCards.map((card) =>
                      card.url ? (
                        <a key={card.id} className="guide-source" href={card.url}>
                          {card.label}
                        </a>
                      ) : (
                        <span key={card.id} className="guide-source">
                          {card.label}
                        </span>
                      ),
                    )}
                  </div>
                )}
                {turn.followUps.length > 0 && !limitReached && (
                  <div className="guide-followups" role="group" aria-label="Follow-up questions">
                    {turn.followUps.map((question) => (
                      <button
                        key={question}
                        type="button"
                        className="guide-followup"
                        disabled={loading}
                        onClick={() => void send(question)}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ),
          )}
        </div>
      )}
      {loading && (
        <p className="guide-loading" role="status">
          Thinking…
        </p>
      )}
      {error && (
        <div className="guide-error" role="alert">
          <p>
            {error === 'offline'
              ? 'The AI guide is offline right now.'
              : 'The guide couldn’t answer that just now.'}{' '}
            <a href={COLLABORATE_GUIDE_CONTACT.mailtoUrl}>Email Joel directly</a> — he’d love to
            hear from you.
          </p>
          <button
            type="button"
            className="guide-retry"
            disabled={loading}
            onClick={() => void send(lastAttemptRef.current)}
          >
            Try again
          </button>
        </div>
      )}
      {limitReached ? (
        <p className="guide-limit" role="status">
          This conversation has reached its session limit — Joel is happy to continue by email.
        </p>
      ) : (
        <form className="guide-input-row" onSubmit={handleSubmit}>
          <label className="guide-input-label" htmlFor={inputId}>
            Ask the guide about Joel’s work
          </label>
          <div className="guide-input-controls">
            <textarea
              id={inputId}
              className="guide-input"
              value={draft}
              maxLength={MAX_MESSAGE_CHARS}
              rows={2}
              disabled={loading || !sessionId}
              placeholder="Type your question — Enter to send, Shift+Enter for a new line"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
            />
            <button
              type="submit"
              className="guide-submit"
              disabled={loading || !sessionId || !draft.trim()}
            >
              Ask
            </button>
          </div>
        </form>
      )}
      {hasAnswer && (
        <div className="guide-share">
          <label className="guide-share-consent">
            <input
              type="checkbox"
              checked={shareConsent}
              disabled={shareStatus === 'done'}
              onChange={(event) => setShareConsent(event.target.checked)}
            />
            Share this conversation with Joel
          </label>
          <p className="guide-share-note">
            Shared transcripts are kept for 180 days, then deleted. You’ll get a receipt ID you can
            quote to request earlier deletion.
          </p>
          {shareConsent && shareStatus !== 'done' && (
            <div className="guide-share-form">
              <label className="guide-share-email-label" htmlFor={emailId}>
                Optional: your email, so Joel can reply
              </label>
              <input
                id={emailId}
                className="guide-share-email"
                type="email"
                value={shareEmail}
                onChange={(event) => setShareEmail(event.target.value)}
              />
              <button
                type="button"
                className="guide-share-button"
                disabled={shareStatus === 'sending'}
                onClick={() => void handleShare()}
              >
                {shareStatus === 'sending' ? 'Sharing…' : 'Share conversation'}
              </button>
              {shareStatus === 'error' && (
                <p className="guide-share-error" role="status">
                  Sharing didn’t go through — try again, or use the email route below.
                </p>
              )}
            </div>
          )}
          {shareStatus === 'done' && receiptId && (
            <p className="guide-share-receipt" role="status">
              Shared — thank you. Receipt ID:{' '}
              <span className="guide-share-receipt-id">{receiptId}</span> — save it and quote it
              anytime to request early deletion.
            </p>
          )}
        </div>
      )}
      <ContactActions contact={COLLABORATE_GUIDE_CONTACT} />
    </section>
  )
}
