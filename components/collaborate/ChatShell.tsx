'use client'

import { FormEvent, KeyboardEvent, MouseEvent, RefObject, useEffect, useId, useRef, useState } from 'react'
import { BorderBeam } from 'border-beam'
import {
  COLLABORATE_GUIDE_ANSWERED_ANNOUNCEMENT,
  COLLABORATE_GUIDE_BACK_LABEL,
  COLLABORATE_GUIDE_COMPOSER_LABEL,
  COLLABORATE_GUIDE_COMPOSER_PLACEHOLDER,
  COLLABORATE_GUIDE_CONTACT,
  COLLABORATE_GUIDE_NAME,
  COLLABORATE_GUIDE_OPEN_FULL_LABEL,
  COLLABORATE_GUIDE_PENDING_HEADING,
  COLLABORATE_GUIDE_SEND_LABEL,
  COLLABORATE_GUIDE_VISITOR_LABEL,
} from '../../content/collaborate'
import { BackArrowIcon, CondenseIcon, ExpandIcon, LinkIcon, MinimizeIcon, SendIcon } from '../icons'
import GuideShareFlow from './GuideShareFlow'
import {
  GUIDE_MAX_MESSAGE_CHARS,
  GuideAssistantTurn,
  GuideConversationState,
  isGuideLimitReached,
  latestAssistantTurn,
} from './guideConversation'
import { isUnmodifiedPrimaryClick, resolveGuideSourceTarget } from './guideNavigation'

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
  /** Page variant only: back to the collaborate landing. */
  onBack?: () => void
  /** Where the shell is presented: the full chat page, the docked desktop
   *  companion, or the narrow-viewport modal overlay. Defaults to 'page'. */
  variant?: 'page' | 'companion' | 'modal'
  /** Upper-right presentation control: pop out (page, wide), or minimize
   *  (page narrow / companion / modal). The owner provides the label because
   *  it knows the viewport. */
  onMinimize?: () => void
  minimizeLabel?: string
  /** Companion-only control: open the full conversation page. */
  onExpand?: () => void
  /** Intentional internal Work source navigation (story id already validated
   *  against the slide list). Absent = source links keep plain anchor behavior. */
  onSourceNavigate?: (storyId: string) => void
}

function formatTurnTime(at: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(at),
  )
}

function SourceChips({
  turn,
  onSourceNavigate,
}: {
  turn: GuideAssistantTurn
  onSourceNavigate?: (storyId: string) => void
}) {
  // Only functional links are shown: pack entries without an evidenceUrl are
  // provenance metadata (model sourceIds), not destinations, so rendering
  // them would present a dead, link-looking affordance.
  const linked = turn.sourceCards.filter((card) => card.url)
  if (linked.length === 0) return null
  // Intercept only intentional (unmodified primary) clicks on curated
  // #work/<storyId> links — modified clicks, external links, and unknown ids
  // keep the native anchor behavior.
  const handleClick = (event: MouseEvent<HTMLAnchorElement>, url: string | undefined) => {
    if (!onSourceNavigate || !isUnmodifiedPrimaryClick(event)) return
    const target = resolveGuideSourceTarget(url)
    if (!target) return
    event.preventDefault()
    onSourceNavigate(target.storyId)
  }
  return (
    <div className="guide-sources" role="group" aria-label="Sources">
      {linked.map((card) => (
        <a
          key={card.id}
          className="guide-source"
          href={card.url}
          onClick={(event) => handleClick(event, card.url)}
        >
          <LinkIcon />
          {card.label}
        </a>
      ))}
    </div>
  )
}

/**
 * The conversation surface, in three presentations: the dedicated full chat
 * page (header back button + pop-out/minimize control), the docked desktop
 * companion, and the narrow-viewport modal overlay. All variants share the
 * controller-owned state (transcript, composer, follow-ups, sources, share
 * flow, error and session-limit states), an independently scrolling
 * transcript, and a fixed bottom area — the latest answer's follow-up pills
 * in a rail above the composer, with the consented share control directly
 * below it. Each answer keeps its own source chips attached (they never
 * duplicate into the rail).
 *
 * Accessibility: turn timestamps are client-only presentation (never sent to
 * any endpoint or analytics); newly arrived answers are announced by a single
 * visually-hidden polite status node without moving focus; direct-email
 * links remain in the genuine offline/error/session-limit states.
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
  variant = 'page',
  onMinimize,
  minimizeLabel,
  onExpand,
  onSourceNavigate,
}: ChatShellProps) {
  const inputId = useId()
  const beamId = useId().replace(/:/g, '-')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const shellRef = useRef<HTMLElement | null>(null)
  const headerElRef = useRef<HTMLElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  // The BorderBeam is client-only (it measures and animates post-mount); the
  // composer renders plain for the first paint, exactly like the vibe card.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Full-length scroll: the transcript scrolls beneath the header and bottom
  // overlay layers. Measure both overlays and feed their heights to the
  // transcript's scroll padding (--chat-top-h / --chat-bottom-h in
  // globals.css) so the first/last turns always scroll fully clear — across
  // heading wraps, rail appearance, composer auto-grow, and share-panel
  // expansion.
  useEffect(() => {
    const shell = shellRef.current
    if (!shell || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const header = headerElRef.current
      const bottom = bottomRef.current
      if (header) {
        shell.style.setProperty(
          '--chat-top-h',
          `${Math.ceil(header.getBoundingClientRect().height)}px`,
        )
      }
      if (bottom) {
        shell.style.setProperty(
          '--chat-bottom-h',
          `${Math.ceil(bottom.getBoundingClientRect().height)}px`,
        )
      }
    }
    update()
    const observer = new ResizeObserver(update)
    if (headerElRef.current) observer.observe(headerElRef.current)
    if (bottomRef.current) observer.observe(bottomRef.current)
    return () => observer.disconnect()
  }, [])

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

  // Anchor to the start of the newest exchange: when the visitor sends a
  // message (and again when the answer lands), scroll so their latest message
  // sits at the top of the viewport — never pinned to the bottom of a long
  // answer. A manual scroll disables this until the visitor sends another
  // message. Instant scroll — no JS animation, so reduced motion needs
  // nothing extra.
  const lastVisitorRef = useRef<HTMLLIElement | null>(null)
  const autoScrollRef = useRef(true)
  const targetScrollRef = useRef<number | null>(null)
  const lastVisitorIndex = state.turns.reduce(
    (last, turn, index) => (turn.role === 'user' ? index : last),
    -1,
  )
  // Only the newest answer animates in (see .chat-answer-new in globals.css).
  const lastAssistantIndex = state.turns.reduce(
    (last, turn, index) => (turn.role === 'assistant' ? index : last),
    -1,
  )
  useEffect(() => {
    const node = transcriptRef.current
    const anchor = lastVisitorRef.current
    if (!node || !anchor) return
    // A newly sent visitor message re-arms auto-scroll after a manual scroll.
    if (state.turns[state.turns.length - 1]?.role === 'user') autoScrollRef.current = true
    if (!autoScrollRef.current) return
    // Transcript-scoped scroll — NOT scrollIntoView, which scrolls every
    // scrollable ancestor (including the page) and can leave the visitor's
    // message stranded outside the bounded transcript's reach. Pin the
    // visitor's latest message just below the header overlay instead.
    const topPad = parseFloat(getComputedStyle(node).scrollPaddingTop) || 0
    node.scrollTo({ top: Math.max(anchor.offsetTop - topPad, 0) })
    targetScrollRef.current = node.scrollTop
  }, [state.turns, pending])

  const handleTranscriptScroll = () => {
    const node = transcriptRef.current
    if (!node) return
    // Ignore the scroll event our own anchor scroll fires; anything else is
    // the visitor taking over.
    if (targetScrollRef.current !== null && Math.abs(node.scrollTop - targetScrollRef.current) < 2)
      return
    autoScrollRef.current = false
  }

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
    <section
      className={`chat-shell${variant === 'page' ? '' : ` chat-shell--${variant}`}`}
      aria-label="Conversation with Joel’s guide"
      ref={shellRef}
    >
      <header className="chat-header" ref={headerElRef}>
        {variant === 'page' && onBack && (
          <button
            type="button"
            className="chat-back"
            aria-label={COLLABORATE_GUIDE_BACK_LABEL}
            onClick={onBack}
          >
            <BackArrowIcon />
          </button>
        )}
        <h2 ref={headingRef as RefObject<HTMLHeadingElement>} tabIndex={-1} className="chat-heading">
          {heading ?? COLLABORATE_GUIDE_PENDING_HEADING}
        </h2>
        {(onMinimize || onExpand) && (
          <div className="chat-present">
            {onExpand && (
              <button
                type="button"
                className="chat-expand"
                aria-label={COLLABORATE_GUIDE_OPEN_FULL_LABEL}
                title={COLLABORATE_GUIDE_OPEN_FULL_LABEL}
                onClick={onExpand}
              >
                <ExpandIcon />
              </button>
            )}
            {onMinimize && (
              <button
                type="button"
                className="chat-popout"
                aria-label={minimizeLabel}
                title={minimizeLabel}
                onClick={onMinimize}
              >
                {variant === 'page' ? <CondenseIcon /> : <MinimizeIcon />}
              </button>
            )}
          </div>
        )}
      </header>
      <div className="chat-transcript" ref={transcriptRef} onScroll={handleTranscriptScroll}>
        <ol className="chat-turns">
          {state.turns.map((turn, index) =>
            turn.role === 'user' ? (
              <li
                key={index}
                className="chat-turn chat-turn-visitor"
                ref={index === lastVisitorIndex ? lastVisitorRef : null}
              >
                <div className="chat-visitor-card">
                  <p className="chat-turn-meta chat-visitor-meta">
                    {COLLABORATE_GUIDE_VISITOR_LABEL} | {formatTurnTime(turn.at)}
                  </p>
                  <p className="chat-visitor-text">{turn.content}</p>
                </div>
              </li>
            ) : (
              <li key={index} className="chat-turn">
                <article
                  className={
                    index === lastAssistantIndex ? 'chat-answer chat-answer-new' : 'chat-answer'
                  }
                >
                  <p className="chat-turn-meta">
                    {COLLABORATE_GUIDE_NAME} | {formatTurnTime(turn.at)}
                  </p>
                  <p className="chat-answer-text">{turn.content}</p>
                  <SourceChips turn={turn} onSourceNavigate={onSourceNavigate} />
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
            This conversation has reached its session limit — Joel is happy to{' '}
            <a href={COLLABORATE_GUIDE_CONTACT.mailtoUrl}>continue by email</a>.
          </p>
        )}
      </div>
      <div className="chat-bottom" ref={bottomRef}>
        {latestAnswer && latestAnswer.followUps.length > 0 && !limitReached && (
          <div className="chat-rail">
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
          </div>
        )}
        {!limitReached &&
          (() => {
            const composer = (
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
            )
            return mounted ? (
              <BorderBeam
                size="md"
                colorVariant="colorful"
                staticColors
                hueRange={0}
                theme="auto"
                strength={0.45}
                className="chat-composer-beam"
                id={beamId}
              >
                {composer}
              </BorderBeam>
            ) : (
              composer
            )
          })()}
        {latestAnswer && (
          <GuideShareFlow key={state.generation} share={state.share} onShare={onShare} />
        )}
      </div>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </section>
  )
}
