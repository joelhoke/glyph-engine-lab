'use client'

import { MouseEvent, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

type ViewerBackLinkProps = {
  href: string
  className?: string
  children: ReactNode
}

/**
 * Viewer back control that returns to the previous in-site screen via browser
 * history (restoring its exact view and scroll position) when the visitor
 * arrived from this site; direct visits fall through to the plain href.
 */
export default function ViewerBackLink({ href, className, children }: ViewerBackLinkProps) {
  const router = useRouter()

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    const fromSameSite =
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin)
    if (fromSameSite) {
      event.preventDefault()
      router.back()
    }
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  )
}
