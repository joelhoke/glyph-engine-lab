'use client'

import { ReactNode, useEffect, useId, useState } from 'react'
import { BorderBeam } from 'border-beam'

type PlaygroundControlDockProps = {
  children: ReactNode
}

/**
 * Layout boundary for future public creative controls.
 *
 * In this milestone it is intentionally empty: it renders nothing when no
 * children are provided, so it does not introduce an empty placeholder or
 * affect the current composition. When controls are added, it will wrap them
 * with the same BorderBeam treatment used by the primary actions, while
 * keeping the public dock visually separate from the engineering tuning panel.
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

  if (!mounted) {
    return <div className="playground-control-dock">{children}</div>
  }

  return (
    <BorderBeam
      size="md"
      colorVariant="colorful"
      staticColors
      hueRange={0}
      theme="auto"
      strength={0.45}
      className="playground-control-dock"
      id={stableId}
    >
      {children}
    </BorderBeam>
  )
}
