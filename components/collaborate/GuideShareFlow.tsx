'use client'

import { useId, useState } from 'react'
import {
  COLLABORATE_GUIDE_SHARE_BUTTON,
  COLLABORATE_GUIDE_SHARE_EMAIL_LABEL,
  COLLABORATE_GUIDE_SHARE_ERROR,
  COLLABORATE_GUIDE_SHARE_LABEL,
  COLLABORATE_GUIDE_SHARE_NOTE,
  COLLABORATE_GUIDE_SHARE_SENDING,
} from '../../content/collaborate'
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
 * The consented share control, placed directly below the composer. A native
 * checkbox styled as a switch: toggling it is purely local (NO network
 * request). When on, it reveals the retention note, the optional reply
 * email, and the explicit share button — only that button calls the share
 * endpoint. After success the switch stays on and disabled with the receipt
 * alongside. Turning the switch off preserves the typed email; all local
 * state resets only when the parent re-keys this component per conversation
 * generation (new conversation).
 */
export default function GuideShareFlow({ share, onShare }: GuideShareFlowProps) {
  const [on, setOn] = useState(false)
  const [email, setEmail] = useState('')
  const emailId = useId()

  const done = share.status === 'done'
  const switchOn = done || on

  return (
    <div className="guide-share">
      <label className="guide-share-switch">
        <input
          type="checkbox"
          checked={switchOn}
          disabled={done}
          onChange={(event) => setOn(event.target.checked)}
        />
        <span className="guide-share-switch-track" aria-hidden="true" />
        <span className="guide-share-switch-label">{COLLABORATE_GUIDE_SHARE_LABEL}</span>
      </label>
      {switchOn && !done && (
        <div className="guide-share-panel">
          <p className="guide-share-note">{COLLABORATE_GUIDE_SHARE_NOTE}</p>
          <label className="guide-share-email-label" htmlFor={emailId}>
            {COLLABORATE_GUIDE_SHARE_EMAIL_LABEL}
          </label>
          <div className="guide-share-form">
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
              {share.status === 'sending'
                ? COLLABORATE_GUIDE_SHARE_SENDING
                : COLLABORATE_GUIDE_SHARE_BUTTON}
            </button>
          </div>
          {share.status === 'error' && (
            <p className="guide-share-error" role="status">
              {COLLABORATE_GUIDE_SHARE_ERROR}
            </p>
          )}
        </div>
      )}
      {done && share.receiptId && (
        <p className="guide-share-receipt" role="status">
          Shared — thank you. Receipt ID:{' '}
          <span className="guide-share-receipt-id">{share.receiptId}</span> — save it and quote it
          anytime to request early deletion.
        </p>
      )}
    </div>
  )
}
