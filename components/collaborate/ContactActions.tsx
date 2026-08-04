'use client'

import { useEffect, useState } from 'react'
import { CollaborateContact } from '../../content/collaborate'

type CopyState = 'idle' | 'success' | 'failure'

/**
 * The two contact routes shared by every collaborate experience variant: a
 * plain mailto: link (works without JavaScript) and copy-to-clipboard as
 * progressive enhancement, falling back to the address as selectable text
 * when the Clipboard API is missing or the write fails. Clipboard
 * availability is only detected in an effect so the SSR/no-JS render (the
 * selectable address) is free of hydration mismatches.
 */
export default function ContactActions({ contact }: { contact: CollaborateContact }) {
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [clipboardAvailable, setClipboardAvailable] = useState(false)
  useEffect(() => {
    setClipboardAvailable(
      typeof navigator !== 'undefined' &&
        typeof navigator.clipboard?.writeText === 'function',
    )
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contact.email)
      setCopyState('success')
    } catch {
      setCopyState('failure')
    }
  }

  const showAddressText = !clipboardAvailable || copyState === 'failure'
  const copyFeedback =
    copyState === 'success'
      ? contact.copySuccessMessage
      : copyState === 'failure'
        ? contact.copyFailureMessage
        : ''

  return (
    <>
      <div className="collaborate-contact">
        <a className="collaborate-primary-action" href={contact.mailtoUrl}>
          {contact.primaryLabel}
        </a>
        {clipboardAvailable && (
          <button type="button" className="collaborate-copy-button" onClick={handleCopy}>
            {contact.copyLabel}
          </button>
        )}
      </div>
      <p className="collaborate-copy-feedback" role="status">
        {copyFeedback}
      </p>
      {showAddressText && (
        <p className="collaborate-address">
          <span className="collaborate-address-value">{contact.email}</span>
        </p>
      )}
    </>
  )
}
