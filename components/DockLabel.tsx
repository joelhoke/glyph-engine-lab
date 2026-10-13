'use client'

import { useEffect, useState } from 'react'

/** Shared pixel label for object docks. Controls supply their own accessible name. */
export default function DockLabel({ children, visible, hoverOnly = false }: {
  children: string; visible: boolean; hoverOnly?: boolean
}) {
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    setDismissed(false)
    if (!visible) return
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setDismissed(true) }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [visible])
  return <span className="home-hero-label" aria-hidden="true"
    data-hover-only={hoverOnly} data-visible={visible && !dismissed}>
    <span className="home-hero-label-pixels">{children}</span>
  </span>
}
