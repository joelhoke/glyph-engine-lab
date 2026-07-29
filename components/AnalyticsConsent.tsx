'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AnalyticsClient,
  ConsentRecord,
  createAnalyticsClient,
  readConsent,
} from '../engine/analytics'

type AnalyticsConsentProps = {
  /** Called with the client once mounted so the experience can track events. */
  onClient: (client: AnalyticsClient) => void
}

/**
 * Analytics consent (Stage 5). Nothing loads before an explicit decision:
 * the banner offers "Allow analytics" / "No thanks", the decision is stored
 * for 180 days, and a persistent "Privacy settings" control reopens it.
 * The banner never appears on the protected viewer (it doesn't mount there).
 */
export default function AnalyticsConsent({ onClient }: AnalyticsConsentProps) {
  const clientRef = useRef<AnalyticsClient | null>(null)
  const [mounted, setMounted] = useState(false)
  const [record, setRecord] = useState<ConsentRecord | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const allowRef = useRef<HTMLButtonElement | null>(null)
  const settingsRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const client = createAnalyticsClient({
      measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      storage: window.localStorage,
    })
    clientRef.current = client
    onClient(client)
    const stored = readConsent(window.localStorage, Date.now())
    setRecord(stored)
    if (!stored) setPromptOpen(true)
    if (stored?.decision === 'granted') client.grant()
    setMounted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (promptOpen) allowRef.current?.focus()
  }, [promptOpen])

  if (!mounted) return null

  const decide = (decision: 'granted' | 'denied') => {
    const client = clientRef.current
    if (decision === 'granted') client?.grant()
    else client?.deny()
    setRecord({ decision, decidedAt: Date.now() })
    setPromptOpen(false)
    settingsRef.current?.focus()
  }

  return (
    <>
      <button
        ref={settingsRef}
        type="button"
        className="privacy-settings-button"
        onClick={() => setPromptOpen(true)}
        aria-haspopup="dialog"
      >
        Privacy settings
      </button>
      {promptOpen && (
        <div
          className="consent-banner"
          role="dialog"
          aria-modal="false"
          aria-label="Privacy settings"
        >
          <p className="consent-copy">
            Uploads are processed entirely in your browser and never leave your
            device. The landing atmosphere is a seasonal mood from your local
            date — no location or weather services. Confidential work is
            authenticated separately and never tracked. Optional analytics
            (GA4) count page and feature use only after you allow them.
          </p>
          <div className="consent-actions">
            <button
              ref={allowRef}
              type="button"
              className="consent-allow"
              onClick={() => decide('granted')}
            >
              Allow analytics
            </button>
            <button type="button" className="consent-decline" onClick={() => decide('denied')}>
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
    </>
  )
}
