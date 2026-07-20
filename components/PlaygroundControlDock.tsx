'use client'

import { cloneElement, isValidElement, ReactElement, ReactNode, useEffect, useId, useRef, useState } from 'react'
import { BorderBeam } from 'border-beam'

type PlaygroundDockState = 'invitation' | 'controls'

type PlaygroundControlDockProps = {
  invitation: ReactNode
  controls: ReactElement<any>
}

/**
 * Public creative-control dock with two presentation states.
 *
 * The positioned anchor is a plain div so BorderBeam cannot override its
 * absolute placement. BorderBeam wraps the inner content with the same beam
 * treatment used by the primary actions and stays mounted across state changes.
 */
export default function PlaygroundControlDock({ invitation, controls }: PlaygroundControlDockProps) {
  const stableId = useId().replace(/:/g, '-')
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<PlaygroundDockState>('invitation')
  const startCreatingRef = useRef<HTMLButtonElement>(null)
  const firstControlRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (state === 'controls') {
      firstControlRef.current?.focus()
    } else {
      startCreatingRef.current?.focus()
    }
  }, [state])

  const handleOpen = () => setState('controls')
  const handleClose = () => setState('invitation')

  return (
    <div
      className={[
        'playground-control-dock',
        state === 'controls' && 'playground-control-dock-workspace',
      ].filter(Boolean).join(' ')}
    >
      {!mounted ? (
        <div className="playground-control-dock-content">
          <PlaygroundInvitation
            startCreatingRef={startCreatingRef}
            onOpen={handleOpen}
          >
            {invitation}
          </PlaygroundInvitation>
        </div>
      ) : (
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
          <div className="playground-control-dock-content">
            {state === 'invitation' ? (
              <PlaygroundInvitation
                startCreatingRef={startCreatingRef}
                onOpen={handleOpen}
              >
                {invitation}
              </PlaygroundInvitation>
            ) : (
              <PlaygroundControlsPane onClose={handleClose}>
                {isValidElement(controls)
                  ? cloneElement(controls, { ref: firstControlRef } as any)
                  : controls}
              </PlaygroundControlsPane>
            )}
          </div>
        </BorderBeam>
      )}
    </div>
  )
}

type PlaygroundInvitationProps = {
  children: ReactNode
  startCreatingRef: React.RefObject<HTMLButtonElement>
  onOpen: () => void
}

function PlaygroundInvitation({ children, startCreatingRef, onOpen }: PlaygroundInvitationProps) {
  return (
    <div className="playground-invitation">
      <p className="playground-invitation-copy">{children}</p>
      <button
        ref={startCreatingRef}
        type="button"
        className="playground-start-button"
        onClick={onOpen}
      >
        Start creating →
      </button>
    </div>
  )
}

type PlaygroundControlsPaneProps = {
  children: ReactNode
  onClose: () => void
}

function PlaygroundControlsPane({ children, onClose }: PlaygroundControlsPaneProps) {
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
      {children}
    </div>
  )
}
