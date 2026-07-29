'use client'

import { cloneElement, isValidElement, ReactElement, ReactNode, useEffect, useId, useRef, useState } from 'react'
import { BorderBeam } from 'border-beam'
import { VibeSurfaceStatus } from './vibe/VibeExperience'

type PlaygroundControlDockProps = {
  /** Controlled open state; the parent owns the card ⇄ dock exclusivity. */
  open: boolean
  onClose: () => void
  controls: ReactElement<any>
  /** Quiet one-line nudge shown inside the open dock. */
  invitation?: ReactNode
  /** Source-lifecycle status: the active status presentation while open. */
  status?: VibeSurfaceStatus | null
  /** id for the controls region (the card CTA's aria-controls target). */
  paneId?: string
}

/**
 * Public creative-control dock, rendered only in its open state.
 *
 * The parent (PortfolioExperience) owns the open/closed state so the closed
 * presentation — the invitation card — can live in the mode surface and
 * unmount entirely while this dock is on screen. The positioned anchor is a
 * plain div so BorderBeam cannot override its absolute placement; BorderBeam
 * wraps the inner content with the same beam treatment used by the primary
 * actions and stays mounted across state changes.
 */
export default function PlaygroundControlDock({
  open,
  onClose,
  controls,
  invitation,
  status,
  paneId,
}: PlaygroundControlDockProps) {
  const stableId = useId().replace(/:/g, '-')
  const [mounted, setMounted] = useState(false)
  const firstControlRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Opening the dock moves keyboard focus to its first control.
  useEffect(() => {
    if (open) {
      firstControlRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  const content = (
    <div className="playground-control-dock-content">
      <PlaygroundControlsPane onClose={onClose} invitation={invitation} status={status} paneId={paneId}>
        {isValidElement(controls)
          ? cloneElement(controls, { ref: firstControlRef } as any)
          : controls}
      </PlaygroundControlsPane>
    </div>
  )

  return (
    <div className="playground-control-dock playground-control-dock-workspace">
      {mounted ? (
        <BorderBeam
          size="md"
          colorVariant="colorful"
          staticColors
          hueRange={0}
          theme="auto"
          strength={0.45}
          className="playground-control-dock-beam"
          id={stableId}
        >
          {content}
        </BorderBeam>
      ) : (
        content
      )}
    </div>
  )
}

type PlaygroundControlsPaneProps = {
  children: ReactNode
  onClose: () => void
  invitation?: ReactNode
  status?: VibeSurfaceStatus | null
  paneId?: string
}

function PlaygroundControlsPane({ children, onClose, invitation, status, paneId }: PlaygroundControlsPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const target = event.target as HTMLElement | null
        const tagName = target?.tagName.toLowerCase()
        const isComposing = (event as any).isComposing === true
        if (!isComposing && tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') {
          onClose()
        }
      }
    }

    const pane = paneRef.current
    if (!pane) return
    pane.addEventListener('keydown', handleKeyDown)
    return () => pane.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      ref={paneRef}
      id={paneId}
      className="playground-controls-pane"
      role="region"
      aria-label="Playground controls"
    >
      <div className="playground-controls-pane-header">
        <span className="playground-controls-pane-title">Customize</span>
        <button
          type="button"
          className="playground-hide-button"
          onClick={onClose}
          aria-label="Hide customization controls"
        >
          <svg
            className="playground-hide-icon"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M1 4l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Hide
        </button>
      </div>
      {invitation && <p className="playground-dock-nudge">{invitation}</p>}
      {status && (
        <p
          className={[
            'vibe-status',
            status.state === 'error' && 'vibe-status-error',
          ].filter(Boolean).join(' ')}
          role="status"
          aria-live="polite"
        >
          {status.message}
        </p>
      )}
      {children}
    </div>
  )
}
