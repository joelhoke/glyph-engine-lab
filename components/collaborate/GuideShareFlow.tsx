'use client'

import { useId, useState } from 'react'
import { GuideShareState } from './guideConversation'

type GuideShareFlowProps = {
  /** Controller-owned share state (idle → sending → done/error). */
  share: GuideShareState
  /** Submits the transcript to POST /api/collaborate/share. The optional
   *  reply email goes only to that endpoint — never to the guide endpoint
   *  or analytics. */
  onShare: (replyEmail: string) => void
}

/**
 * The consented share flow: an unchecked opt-in checkbox, an optional reply
 * email, the submit, and the receipt / early-deletion note. Local form state
 * (consent, email) resets when the parent re-keys this component per
 * conversation generation.
 */
export default function GuideShareFlow({ share, onShare }: GuideShareFlowProps) {
  const [consent, setConsent] = useState(false)
  const [email, setEmail] = useState('')
  const emailId = useId()

  return (
    <div className="guide-share">
      <label className="guide-share-consent">
        <input
          type="checkbox"
          checked={consent}
          disabled={share.status === 'done'}
          onChange={(event) => setConsent(event.target.checked)}
        />
        Share this conversation with Joel
      </label>
      <p className="guide-share-note">
        Shared transcripts are kept for 180 days, then deleted. You’ll get a receipt ID you can
        quote to request earlier deletion.
      </p>
      {consent && share.status !== 'done' && (
        <div className="guide-share-form">
          <label className="guide-share-email-label" htmlFor={emailId}>
            Optional: your email, so Joel can reply
          </label>
          <input
            id={emailId}
            className="guide-share-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            type="button"
            className="guide-share-button"
            disabled={share.status === 'sending'}
            onClick={() => onShare(email)}
          >
            {share.status === 'sending' ? 'Sharing…' : 'Share conversation'}
          </button>
          {share.status === 'error' && (
            <p className="guide-share-error" role="status">
              Sharing didn’t go through — try again, or use the email route below.
            </p>
          )}
        </div>
      )}
      {share.status === 'done' && share.receiptId && (
        <p className="guide-share-receipt" role="status">
          Shared — thank you. Receipt ID:{' '}
          <span className="guide-share-receipt-id">{share.receiptId}</span> — save it and quote it
          anytime to request early deletion.
        </p>
      )}
    </div>
  )
}
