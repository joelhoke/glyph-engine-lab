'use client'

import { useState } from 'react'
import { useReducedMotion } from './HeroObject'
import { HeroNotebookModel } from './renderers/HeroThreeObject'

type HomeNotebookProps = {
  /** Cover labeling ("Joel Hoke" / role line) — used by the CSS fallback
   *  cover when the notebook model can't load. */
  coverTitle: string
  coverBody?: string
  /** The introduction text (content/home.ts). In model mode it's baked onto
   *  the 3D page texture and kept in the DOM as a visually-hidden copy; in
   *  the CSS fallback it's the revealed page. */
  blurb: string
  /** Hero onscreen and not menu-covered (parallaxEnabled from HomeHero):
   *  parks the model's animation while false. */
  active: boolean
  /** Live rest-orientation override in degrees (tuning panel Hero section). */
  rotationOverride?: { x: number; y: number }
  highlighted?: boolean
  /** The hero's destination anchor owns activation and keyboard focus. */
  decorative?: boolean
}

/**
 * The intro slot's notebook (homepage-redesign hero). The notebook asset
 * itself opens: the GLTF base plus a composed kraft cover hinged around the
 * spiral edge (components/home/renderers/HeroThreeObject.tsx — the GLTF is a
 * single merged mesh, so the cover is procedural), revealing the
 * introduction baked onto the page. Hover (fine pointer), keyboard focus,
 * or tap (toggle) opens it; reduced motion snaps instantly. The blurb stays
 * in the DOM for assistive tech regardless. Opening never shifts layout;
 * only the notebook's own box takes pointer events. A model failure falls
 * back to the CSS-3D stage with the labeled cover.
 */
export default function HomeNotebook({
  coverTitle,
  coverBody,
  blurb,
  active,
  rotationOverride,
  highlighted = false,
  decorative = false,
}: HomeNotebookProps) {
  const [toggled, setToggled] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [modelFailed, setModelFailed] = useState(false)
  const reducedMotion = useReducedMotion()
  const open = toggled || hovered || focused || highlighted
  const sharedProps = decorative ? {} : {
    role: 'button' as const,
    tabIndex: 0,
    'aria-expanded': open,
    'aria-label': `${coverTitle} — introduction notebook. Activate to ${open ? 'close' : 'open'}.`,
    onClick: () => setToggled((current) => !current),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setToggled((current) => !current)
      }
    },
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  }

  if (!modelFailed) {
    return (
      <div className="home-hero-notebook home-hero-notebook--model" {...sharedProps}>
        <HeroNotebookModel
          active={active}
          reducedMotion={reducedMotion}
          blurb={blurb}
          open={open}
          rotationOverride={rotationOverride}
          onUnavailable={() => setModelFailed(true)}
        />
        {/* The blurb's visual form is the 3D page texture; this copy keeps it
            in the DOM for assistive tech and text selection. */}
        <span className="visually-hidden">{blurb}</span>
      </div>
    )
  }

  // CSS-3D fallback stage (model unavailable): the labeled cover hinges open
  // over the blurb page — same interaction contract.
  return (
    <div className={`home-hero-notebook${open ? ' is-open' : ''}`} {...sharedProps}>
      <div className="home-hero-notebook-inner">
        <div className="home-hero-notebook-page">
          <p className="home-hero-notebook-blurb">{blurb}</p>
        </div>
        <div className="home-hero-notebook-cover" aria-hidden="true">
          <span className="home-hero-notebook-cover-title">{coverTitle}</span>
          {coverBody ? <span className="home-hero-notebook-cover-role">{coverBody}</span> : null}
        </div>
      </div>
    </div>
  )
}
