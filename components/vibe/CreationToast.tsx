'use client'

/**
 * Creation toast (feature/vibe-creations): a transient bottom-center chip
 * confirming a qualified vibe composition was archived to the gallery. It
 * auto-dismisses after ~4s and also carries an explicit dismiss button. A
 * polite live region announces the message; the toast never steals focus.
 *
 * Styled with global classes in app/globals.css alongside the rest of the
 * vibe chrome (vibe-toolbar, vibe-share-chooser).
 */

import { useEffect, useRef } from 'react'

export type CreationToastProps = {
  open: boolean
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 4000

export default function CreationToast({ open, onDismiss }: CreationToastProps) {
  /* The parent passes an inline onDismiss; keeping it in a ref means the
     auto-dismiss clock only restarts when `open` flips, not on every parent
     render. */
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timeout)
  }, [open])

  if (!open) return null

  return (
    <div className="vibe-creation-toast" role="status" aria-live="polite">
      <span className="vibe-creation-toast-text">Saved to the gallery archive</span>
      <button
        type="button"
        className="vibe-creation-toast-dismiss"
        aria-label="Dismiss"
        onClick={() => onDismissRef.current()}
      >
        ×
      </button>
    </div>
  )
}
