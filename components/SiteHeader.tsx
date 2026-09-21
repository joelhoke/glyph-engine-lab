'use client'

import { useRef, useState } from 'react'
import { SiteDestination } from '../engine/homeNavigation'
import { NavigationItem } from './navigation/navigation'
import SiteMenu from './navigation/SiteMenu'
import JHMark from './JHMark'

export type SiteHeaderProps = {
  /** The settled destination — 'home' on the landing, the scene key inside a
   *  mode, 'gallery' on gallery routes. */
  active: NavigationItem['id']
  /** The navigation coordinator (homepage experience). Undefined on gallery
   *  routes: the home mark and every menu link stay plain anchors. */
  onNavigate?: (target: SiteDestination) => void
  /** Reports menu open state so the shell can suspend canvas/parallax work. */
  onMenuOpenChange?: (open: boolean) => void
}

/** True when another modal surface (guide overlay, paint confirmation) is
 *  open — the menu trigger stays inert rather than competing for focus. */
const anotherModalOpen = () =>
  typeof document !== 'undefined' && !!document.querySelector('[aria-modal="true"]')

/**
 * Persistent site frame (homepage-redesign phase 5): the JH home mark plus a
 * single "Menu" trigger opening the shared full-screen menu (SiteMenu) —
 * section tabs and the phone-only recruiter bar are gone; recruiter links
 * live in the menu and the homepage footer. Always rendered, on the landing
 * and inside every section. Sits above the canvas and the foreground layer;
 * the menu itself renders in the native top layer.
 *
 * The home mark and menu links are real anchors: the prerendered output
 * carries plain links, and modified clicks (cmd/ctrl/middle) work natively.
 * Only unmodified primary clicks route through the coordinator.
 */
export default function SiteHeader({ active, onNavigate, onMenuOpenChange }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const setMenuOpenReported = (open: boolean) => {
    setMenuOpen(open)
    onMenuOpenChange?.(open)
  }

  const handleHomeClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) return
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate({ kind: 'home' })
  }

  return (
    <>
      {/* data-scene tints the dissolving surface toward the active scene's
          canvas palette (globals.css --header-surface-*); unset on the home
          landing and gallery routes, so it keeps the neutral panel tone. */}
      <header
        className="site-header"
        data-scene={
          active === 'work' || active === 'vibe' || active === 'collaborate' ? active : undefined
        }
      >
        <a
          href="/"
          className="site-header-home"
          onClick={handleHomeClick}
          aria-label="joel hoke design — back to home"
        >
          {/* The monogram is the whole lockup: inlined with currentColor so
              the theme sets it (near-white on dark, near-black on light). */}
          <JHMark className="site-header-mark" aria-hidden="true" />
        </a>
        <button
          type="button"
          className="site-header-menu-button"
          ref={triggerRef}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          aria-haspopup="dialog"
          onClick={() => {
            if (menuOpen) {
              setMenuOpenReported(false)
              return
            }
            // Another modal (guide overlay, paint confirmation) owns focus —
            // the trigger stays inert until it's dismissed.
            if (anotherModalOpen()) return
            setMenuOpenReported(true)
          }}
        >
          <svg
            className="site-header-menu-icon"
            viewBox="0 0 18 12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M1 1h16M1 6h16M1 11h16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Menu
        </button>
      </header>
      <SiteMenu
        open={menuOpen}
        active={active}
        onNavigate={onNavigate}
        onRequestClose={() => setMenuOpenReported(false)}
        triggerRef={triggerRef}
      />
    </>
  )
}
