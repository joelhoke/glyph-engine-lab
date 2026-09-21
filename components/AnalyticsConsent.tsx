'use client'

import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import {
  AnalyticsClient,
  ConsentRecord,
  createAnalyticsClient,
  readConsent,
} from '../engine/analytics'
import { MODEL_CREDITS, PORTRAIT_CREDIT } from '../content/site'
import './AnalyticsConsent.css'

type AnalyticsConsentProps = {
  /** Called with the client once mounted so the experience can track events. */
  onClient: (client: AnalyticsClient) => void
}

type PanelView = 'privacy' | 'feedback' | 'credits'

const PANEL_VIEWS: PanelView[] = ['privacy', 'feedback', 'credits']

const MESSAGE_MIN = 10
const MESSAGE_MAX = 2000
const EMAIL_MAX = 254
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/

/**
 * Feedback form. Deliberately independent of the analytics client: nothing
 * here may emit analytics events, regardless of the consent decision.
 * Submissions go to POST /api/feedback and are stored server-side for
 * 180 days (see docs/deployment.md).
 */
function FeedbackForm() {
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const trimmedMessage = message.trim()
  const trimmedEmail = email.trim()
  const messageInvalid =
    trimmedMessage.length < MESSAGE_MIN || trimmedMessage.length > MESSAGE_MAX
  const emailInvalid =
    trimmedEmail !== '' &&
    (trimmedEmail.length > EMAIL_MAX || !EMAIL_PATTERN.test(trimmedEmail))
  const canSubmit = !pending && !messageInvalid && !emailInvalid

  const messageHint = !messageInvalid
    ? ''
    : trimmedMessage.length === 0
      ? `Please write at least ${MESSAGE_MIN} characters — a sentence or two is plenty.`
      : trimmedMessage.length < MESSAGE_MIN
        ? `A little more, please — at least ${MESSAGE_MIN} characters (currently ${trimmedMessage.length}).`
        : `That's a bit long — please keep it under ${MESSAGE_MAX} characters (currently ${trimmedMessage.length}).`

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setPending(true)
    setStatus('idle')
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedMessage,
          email: trimmedEmail === '' ? undefined : trimmedEmail,
          company,
        }),
      })
      if (!response.ok) throw new Error(`feedback failed: ${response.status}`)
      setMessage('')
      setEmail('')
      setCompany('')
      setStatus('success')
    } catch {
      // Recoverable failure: keep the entered text so nothing is lost.
      setStatus('error')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="feedback-form" onSubmit={onSubmit} noValidate>
      <p className="consent-copy">
        Feedback is optional and independent of analytics. It is stored
        server-side for 180 days, then deleted. Include a reply email only if
        you would like an answer.
      </p>
      <div className="feedback-field">
        <label className="feedback-label" htmlFor="feedback-message">
          Message
        </label>
        <textarea
          id="feedback-message"
          className="feedback-textarea"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value)
            if (status !== 'idle') setStatus('idle')
          }}
          rows={5}
          maxLength={MESSAGE_MAX * 2}
          required
          aria-describedby="feedback-message-hint"
        />
        <p id="feedback-message-hint" className="feedback-hint" aria-live="polite">
          {messageHint}
        </p>
      </div>
      <div className="feedback-field">
        <label className="feedback-label" htmlFor="feedback-email">
          Reply email (optional)
        </label>
        <input
          id="feedback-email"
          className="feedback-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={EMAIL_MAX}
          autoComplete="email"
          aria-describedby="feedback-email-hint"
        />
        <p id="feedback-email-hint" className="feedback-hint" aria-live="polite">
          {emailInvalid ? "That email doesn't look quite right." : ''}
        </p>
      </div>
      {/* Honeypot: never filled by humans; bots that fill it are dropped
          server-side without storing anything. */}
      <div className="feedback-honeypot visually-hidden" aria-hidden="true">
        <label htmlFor="feedback-company">Company</label>
        <input
          id="feedback-company"
          name="company"
          type="text"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="consent-actions">
        <button type="submit" className="consent-allow" disabled={!canSubmit}>
          {pending ? 'Sending…' : 'Send feedback'}
        </button>
      </div>
      {status === 'success' && (
        <p className="feedback-status" role="status">
          Thank you — your feedback was sent.
        </p>
      )}
      {status === 'error' && (
        <p className="feedback-error" role="alert">
          Something went wrong while sending. Your message is still here —
          please try again.
        </p>
      )}
    </form>
  )
}

/**
 * Privacy, feedback, and credits (Stage 5 + feedback + asset attribution).
 * Nothing loads before an explicit decision: the Privacy view offers
 * "Allow analytics" / "No thanks", the decision is stored for 180 days, and
 * a persistent top-right control reopens the panel. The panel never appears
 * on the protected viewer (it doesn't mount there). The Feedback view is
 * fully independent of analytics consent. The Credits view lists the CC-BY
 * 3D models used in the homepage hero (content/site.ts MODEL_CREDITS).
 */
export default function AnalyticsConsent({ onClient }: AnalyticsConsentProps) {
  const clientRef = useRef<AnalyticsClient | null>(null)
  const [mounted, setMounted] = useState(false)
  const [record, setRecord] = useState<ConsentRecord | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [view, setView] = useState<PanelView>('privacy')
  const fabRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const privacyTabRef = useRef<HTMLButtonElement | null>(null)
  const feedbackTabRef = useRef<HTMLButtonElement | null>(null)
  const creditsTabRef = useRef<HTMLButtonElement | null>(null)

  const baseId = useId()
  const panelId = `${baseId}-panel`
  const privacyTabId = `${baseId}-tab-privacy`
  const feedbackTabId = `${baseId}-tab-feedback`
  const creditsTabId = `${baseId}-tab-credits`
  const privacyPanelId = `${baseId}-panel-privacy`
  const feedbackPanelId = `${baseId}-panel-feedback`
  const creditsPanelId = `${baseId}-panel-credits`

  useEffect(() => {
    const client = createAnalyticsClient({
      measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      storage: window.localStorage,
    })
    clientRef.current = client
    onClient(client)
    const stored = readConsent(window.localStorage, Date.now())
    setRecord(stored)
    // The panel never opens automatically — not on a first visit, not when
    // consent is missing, expired, denied, or granted. Only the explicit
    // Privacy FAB opens it. Analytics stay blocked unless a valid stored
    // grant exists (or the user explicitly grants from the panel).
    if (stored?.decision === 'granted') client.grant()
    setMounted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (!panelOpen) return
    const tab =
      view === 'privacy'
        ? privacyTabRef.current
        : view === 'feedback'
          ? feedbackTabRef.current
          : creditsTabRef.current
    tab?.focus()
  }, [panelOpen, view])

  if (!mounted) return null

  const closePanel = (focusFab = true) => {
    setPanelOpen(false)
    if (focusFab) fabRef.current?.focus()
  }

  const togglePanel = () => {
    if (panelOpen) {
      closePanel(false)
    } else {
      // FAB opens always default to the Privacy view.
      setView('privacy')
      setPanelOpen(true)
    }
  }

  const decide = (decision: 'granted' | 'denied') => {
    const client = clientRef.current
    if (decision === 'granted') client?.grant()
    else client?.deny()
    setRecord({ decision, decidedAt: Date.now() })
    closePanel()
  }

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      closePanel()
      return
    }
    // Arrow-key support across the tab list (roving tabindex).
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const target = event.target as HTMLElement
      if (target.getAttribute('role') !== 'tab') return
      event.preventDefault()
      const index = PANEL_VIEWS.indexOf(view)
      const step = event.key === 'ArrowRight' ? 1 : -1
      const next = PANEL_VIEWS[(index + step + PANEL_VIEWS.length) % PANEL_VIEWS.length]
      setView(next)
    }
  }

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className="privacy-settings-button"
        onClick={togglePanel}
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        aria-controls={panelId}
        aria-label="Privacy, feedback, and credits"
      >
        ?
      </button>
      {panelOpen && (
        <div
          ref={panelRef}
          id={panelId}
          className="privacy-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Privacy, feedback, and credits"
          onKeyDown={onPanelKeyDown}
        >
          <div className="privacy-panel-header">
            <div className="privacy-tabs" role="tablist" aria-label="Privacy, feedback, and credits views">
              <button
                ref={privacyTabRef}
                id={privacyTabId}
                type="button"
                role="tab"
                className="privacy-tab"
                aria-selected={view === 'privacy'}
                aria-controls={privacyPanelId}
                tabIndex={view === 'privacy' ? 0 : -1}
                onClick={() => setView('privacy')}
              >
                Privacy
              </button>
              <button
                ref={feedbackTabRef}
                id={feedbackTabId}
                type="button"
                role="tab"
                className="privacy-tab"
                aria-selected={view === 'feedback'}
                aria-controls={feedbackPanelId}
                tabIndex={view === 'feedback' ? 0 : -1}
                onClick={() => setView('feedback')}
              >
                Feedback
              </button>
              <button
                ref={creditsTabRef}
                id={creditsTabId}
                type="button"
                role="tab"
                className="privacy-tab"
                aria-selected={view === 'credits'}
                aria-controls={creditsPanelId}
                tabIndex={view === 'credits' ? 0 : -1}
                onClick={() => setView('credits')}
              >
                Credits
              </button>
            </div>
            <button
              type="button"
              className="privacy-panel-close"
              onClick={() => closePanel()}
              aria-label="Close panel"
            >
              ×
            </button>
          </div>
          {view === 'privacy' && (
            <div
              id={privacyPanelId}
              role="tabpanel"
              aria-labelledby={privacyTabId}
              className="privacy-tabpanel"
            >
              <p className="consent-copy">
                Optional analytics count page and feature use only after you
                allow them. “No thanks” also withdraws an earlier choice.
                Feedback and explicitly shared chats are stored separately
                and expire after 180 days.
              </p>
              <p className="consent-copy">
                Vibe automatically saves qualifying creations, including
                previews, settings, and eligible uploaded source images.
                Creations can be reviewed for the public gallery. Only upload
                material you have permission to share.
              </p>
              <p className="consent-copy">
                AI guide messages go to the server and the configured provider
                (OpenAI, DeepSeek, or Moonshot/Kimi, sometimes through Cloudflare
                AI Gateway). Please don’t submit confidential information.
                See the <a href="/privacy">privacy policy</a> and{' '}
                <a href="/terms">terms of use</a> for details.
              </p>
              <div className="consent-actions">
                <button
                  type="button"
                  className="consent-allow"
                  onClick={() => decide('granted')}
                >
                  Allow analytics
                </button>
                <button
                  type="button"
                  className="consent-decline"
                  onClick={() => decide('denied')}
                >
                  No thanks
                </button>
              </div>
              {record && (
                <p className="consent-current" role="status">
                  Analytics are currently {record.decision === 'granted' ? 'on' : 'off'}.
                </p>
              )}
            </div>
          )}
          {view === 'feedback' && (
            <div
              id={feedbackPanelId}
              role="tabpanel"
              aria-labelledby={feedbackTabId}
              className="privacy-tabpanel"
            >
              <FeedbackForm />
            </div>
          )}
          {view === 'credits' && (
            <div
              id={creditsPanelId}
              role="tabpanel"
              aria-labelledby={creditsTabId}
              className="privacy-tabpanel"
            >
              <p className="consent-copy">
                The homepage hero uses these CC-BY-4.0 3D models — thanks to
                their authors for sharing them.
              </p>
              <ul className="credits-list">
                {MODEL_CREDITS.map((credit) => (
                  <li key={credit.title}>
                    <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {credit.title}
                    </a>{' '}
                    by{' '}
                    <a href={credit.authorUrl} target="_blank" rel="noopener noreferrer">
                      {credit.author}
                    </a>{' '}
                    ·{' '}
                    <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
                      CC-BY-4.0
                    </a>{' '}
                    · {credit.usedFor}
                    <div className="credits-modifications">Adapted for this site: {credit.modifications}</div>
                  </li>
                ))}
              </ul>
              <p className="consent-copy">{PORTRAIT_CREDIT}</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
