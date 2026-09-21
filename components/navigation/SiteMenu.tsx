'use client'

import { RefObject, useEffect, useRef } from 'react'
import { RECRUITER_LINKS } from '../../content/site'
import { SiteDestination, destinationHref } from '../../engine/homeNavigation'
import { NavigationItem, SITE_MENU_ORDER, SITE_NAVIGATION } from './navigation'

type SiteMenuProps = {
  /** Controlled open state (owned by SiteHeader). The native dialog is only
   *  ever driven from effects — showModal/close are never called during
   *  render. */
  open: boolean
  active: NavigationItem['id']
  /** The navigation coordinator (homepage experience). Undefined on gallery
   *  routes, where every link is a plain full-page anchor. */
  onNavigate?: (target: SiteDestination) => void
  /** Close request (Escape, backdrop, navigation) — the owner flips `open`. */
  onRequestClose: () => void
  /** Focus restores here on normal dismissal (not after navigation — the
   *  coordinator moves focus to the destination heading). */
  triggerRef: RefObject<HTMLButtonElement | null>
}

/** True when another modal surface (guide overlay, paint confirmation) is
 *  already open — the menu never stacks a competing focus trap on top. */
const anotherModalOpen = () =>
  typeof document !== 'undefined' && !!document.querySelector('[aria-modal="true"]')

/**
 * The shared full-screen menu (homepage-redesign phase 5): a native <dialog>
 * driven with showModal(), so top-layer rendering sidesteps every existing
 * z-index contract (header, guide chrome, tuning panel). Large Cabin links
 * for the five destinations with active-destination indication; recruiter
 * links secondary in Departure Mono. All items are real anchors — modified
 * clicks (cmd/ctrl/middle) work natively; only unmodified primary clicks
 * route through the coordinator. Scroll locking preserves the exact previous
 * position and styles, restored on dismissal.
 */
export default function SiteMenu({
  open,
  active,
  onNavigate,
  onRequestClose,
  triggerRef,
}: SiteMenuProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  // A link click that initiated navigation: dismissal then leaves focus to
  // the coordinator (destination heading) instead of the trigger.
  const navigatedRef = useRef(false)
  // The latest close request, stable for the dialog event handlers.
  const requestCloseRef = useRef(onRequestClose)
  useEffect(() => {
    requestCloseRef.current = onRequestClose
  }, [onRequestClose])

  // Drive the native dialog from the controlled prop (effects only), and
  // lock document scroll while open — exact position and styles restored on
  // dismissal.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!open) {
      if (dialog.open) dialog.close()
      return
    }
    // Never stack on an open modal (guide overlay / paint confirmation):
    // decline the open and hand the state back to the owner.
    if (anotherModalOpen()) {
      requestCloseRef.current()
      return
    }
    if (!dialog.open) {
      navigatedRef.current = false
      dialog.showModal()
    }
    const scrollY = window.scrollY
    const body = document.body
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    return () => {
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.width = previous.width
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' })
    }
  }, [open])

  // Native close (Escape, or programmatic close): sync the owner and restore
  // focus to the trigger unless a navigation took it.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => {
      requestCloseRef.current()
      if (!navigatedRef.current) {
        triggerRef.current?.focus({ preventScroll: true })
      }
      navigatedRef.current = false
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [triggerRef])

  const handleLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    item: NavigationItem,
  ) => {
    // Plain anchors: modified clicks (cmd/ctrl/middle) stay native; without
    // a coordinator (gallery routes) everything is a normal navigation.
    if (!onNavigate) return
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (item.destination.kind === 'route') {
      // Full-page route (/gallery): let the anchor navigate natively; close
      // the menu so a bfcache restore never revives it open.
      navigatedRef.current = true
      onRequestClose()
      return
    }
    event.preventDefault()
    navigatedRef.current = true
    onNavigate(item.destination)
    onRequestClose()
  }

  const orderedItems = SITE_MENU_ORDER.map(
    (id) => SITE_NAVIGATION.find((item) => item.id === id) as NavigationItem,
  )

  return (
    <dialog
      ref={dialogRef}
      id="site-menu"
      className="site-menu"
      aria-label="Site menu"
      onClick={(event) => {
        // Backdrop click (the dialog element itself, not its content) closes.
        if (event.target === dialogRef.current) onRequestClose()
      }}
    >
      <div className="site-menu-inner">
        <button
          type="button"
          className="site-menu-close"
          onClick={onRequestClose}
          aria-label="Close menu"
        >
          <span aria-hidden="true">×</span>
        </button>
        <nav className="site-menu-nav" aria-label="Site">
          <ul className="site-menu-list">
            {orderedItems.map((item) => (
              <li key={item.id}>
                <a
                  href={destinationHref(item.destination)}
                  className="site-menu-link"
                  aria-current={active === item.id ? 'page' : undefined}
                  onClick={(event) => handleLinkClick(event, item)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-menu-secondary">
          <a href={RECRUITER_LINKS.resume.url} target="_blank" rel="noopener noreferrer">
            {RECRUITER_LINKS.resume.label}
          </a>
          <a href={RECRUITER_LINKS.linkedin.url} target="_blank" rel="noopener noreferrer">
            {RECRUITER_LINKS.linkedin.label}
            <span aria-hidden="true"> ↗</span>
          </a>
          <a href={RECRUITER_LINKS.email.url}>{RECRUITER_LINKS.email.label}</a>
        </div>
      </div>
    </dialog>
  )
}
