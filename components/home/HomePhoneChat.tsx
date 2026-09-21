'use client'

import { useEffect, useRef } from 'react'
import { COLLABORATE_GUIDE_CONTACT } from '../../content/collaborate'
import { GUIDE_MAX_MESSAGE_CHARS, GuideConversationState, isGuideLimitReached } from '../collaborate/guideConversation'
import PopOutIcon from '../icons/PopOutIcon'
import PhoneStandbyMark from './PhoneStandbyMark'

export type HomeGuideBridge = {
  state: GuideConversationState | null
  /** Native model-key events need the latest draft, even before React renders. */
  getState: () => GuideConversationState | null
  inline: boolean
  onSend: (message: string) => void
  onStartStarter: (starterId: string) => void
  onRetry: () => void
  onDraftChange: (draft: string) => void
  onExpand: () => void
  onPopOut: () => void
  onReturn: () => void
}

export default function HomePhoneChat({ guide }: { guide: HomeGuideBridge }) {
  const { state } = guide
  const transcriptRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wasInline = useRef(guide.inline)
  useEffect(() => {
    const transcript = transcriptRef.current
    if (transcript) transcript.scrollTop = transcript.scrollHeight
  }, [state?.turns.length, state?.status])
  useEffect(() => {
    if (guide.inline && !wasInline.current) inputRef.current?.focus({ preventScroll: true })
    wasInline.current = guide.inline
  }, [guide.inline])
  if (!guide.inline) return <div className="home-phone-chat home-phone-standby">
    <span className="home-phone-standby-status">JH · CONNECTED</span>
    <PhoneStandbyMark />
    <button type="button" onClick={guide.onReturn}>Bring chat back</button>
  </div>
  const pending = state?.status === 'pending'
  const limited = state ? isGuideLimitReached(state) : false
  return <div className="home-phone-chat">
    <div className="home-phone-chat-header">
      <div><strong>Let’s chat</strong><span>AI guide to Joel</span></div>
      <button type="button" className="home-phone-pop-out" aria-label="Pop chat out" title="Pop chat out" onClick={guide.onPopOut}>
        <PopOutIcon />
      </button>
    </div>
    <div className="home-phone-transcript" ref={transcriptRef} tabIndex={0} role="log" aria-label="Conversation with Joel’s AI guide" aria-live="polite" aria-relevant="additions text">
      {!state?.turns.length && state?.status !== 'error' && <div className="home-phone-welcome">
        <p>Curious about the work, the process, or a possible fit?</p>
        <button type="button" disabled={!state} onClick={() => guide.onSend('How does Joel approach a new project?')}>What’s Joel’s approach?</button>
      </div>}
      {state?.turns.map((turn, i) => <div key={`${turn.at}-${i}`} className={`home-phone-turn home-phone-turn--${turn.role}`}>
        <span>{turn.role === 'user' ? 'You' : 'AI guide'}</span>
        <p>{turn.content}</p>
        {turn.role === 'assistant' && turn.sourceCards.some(card => card.url) && <button type="button" onClick={guide.onExpand}>Read sources</button>}
      </div>)}
      {pending && <p className="home-phone-status" role="status">Thinking…</p>}
      {state?.status === 'error' && <div className="home-phone-status" role="alert">
        <p>{state.error === 'offline' ? 'The guide is offline right now.' : 'That message didn’t go through.'} Your draft is saved.</p>
        <button type="button" onClick={guide.onRetry}>Try again</button>{' · '}
        <a href={COLLABORATE_GUIDE_CONTACT.mailtoUrl}>Email Joel</a>
      </div>}
      {limited && !pending && <p>Ready to take it further? <a href={COLLABORATE_GUIDE_CONTACT.mailtoUrl}>Email Joel</a>.</p>}
    </div>
    <form className="home-phone-composer" onSubmit={event => { event.preventDefault(); if (state) guide.onSend(state.draft) }}>
      <div className="home-phone-composer-input" data-empty={!state?.draft}>
      <textarea ref={inputRef} aria-label="Message Joel’s AI guide" placeholder="Ask a question…" rows={2}
        maxLength={GUIDE_MAX_MESSAGE_CHARS} value={state?.draft ?? ''} disabled={!state || pending || limited}
        onChange={event => guide.onDraftChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            if (state && !pending && !limited) guide.onSend(state.draft)
          }
        }} />
      {!state?.draft && <span className="home-phone-input-placeholder" aria-hidden="true">Ask a question…</span>}
      </div>
      <button type="submit" aria-label="Send message" disabled={!state?.draft.trim() || pending || limited}>↑</button>
    </form>
  </div>
}
