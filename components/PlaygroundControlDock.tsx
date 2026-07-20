'use client'

import { ReactNode, useEffect, useId, useState } from 'react'
import { BorderBeam } from 'border-beam'

type PlaygroundControlDockProps = {
  children: ReactNode
}

/**
 * Layout boundary for public creative controls.
 *
 * The positioned anchor is a plain div so BorderBeam cannot override its
 * absolute placement. BorderBeam wraps the inner content with the same beam
 * treatment used by the primary actions, while keeping the public dock
 * visually separate from the engineering tuning panel.
 */
export default function PlaygroundControlDock({ children }: PlaygroundControlDockProps) {
  const stableId = useId().replace(/:/g, '-')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!children) {
    return null
  }

  const content = (
    <div className="playground-control-dock-content">{children}</div>
  )

  return (
    <div className="playground-control-dock">
      {!mounted ? (
        content
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
          {content}
        </BorderBeam>
      )}
    </div>
  )
}
