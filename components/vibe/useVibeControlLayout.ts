'use client'

/**
 * Vibe floating-control layout: keeps the Sound (lower-left) and Pond
 * (lower-right) controls clear of the centered vibe toolbar capsule at every
 * viewport width — the "object awareness" layer the fixed 20vw anchors can't
 * provide on their own.
 *
 * Published on <html>, consumed by globals.css:
 *
 *   --vibe-capsule-half        Half the measured toolbar capsule width (px).
 *
 *   --vibe-sound-pill-w / --vibe-pond-pill-w
 *                              Each pill's natural HORIZONTAL width (px). On
 *                              web the FAB rests at its 20vw anchor; on open
 *                              the control pushes itself outward (animated)
 *                              until the pill keeps a ~48px gap to the
 *                              capsule:
 *                                min(20vw, 50% − capsule half − pill w − 48px)
 *
 *   data-vibe-sound-layout / data-vibe-pond-layout = "horizontal" | "vertical"
 *                              Vertical expansion (the ≤640px mobile idiom) is
 *                              the last resort on web: it applies only when
 *                              the pill would not fit horizontally even with
 *                              the FAB pushed to the corner floor:
 *                                12px + pill w + 48px > 50vw − capsule half
 *                              The sound pill is much narrower than the pond
 *                              pill, so the sides are decided independently.
 *
 * Pill widths are measured ONCE while the default (horizontal) styles apply
 * and cached for the session: measuring a vertically-expanded pill would
 * return its 66px column width and flip-flop the decision. Pill content is
 * static per control, so a cached natural width stays valid.
 *
 * No-op unless `active` (the vibe surface with its controls is mounted);
 * cleanup removes the vars + attributes so a remount starts fresh.
 */

import { useEffect } from 'react'

/* Corner floor (0.75rem) + the minimum gap the open pill keeps to the
   capsule (matches the 3rem in the open-state anchor rules in globals.css). */
const EDGE_INSET_PX = 12
const PILL_CAPSULE_GAP_PX = 48

export function useVibeControlLayout(active: boolean) {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    const capsule = document.querySelector('.vibe-toolbar-capsule-wrapper')
    const soundPill = document.querySelector('.vibe-sound-pill')
    const pondPill = document.querySelector('.vibe-pond-pill')
    /* Natural horizontal pill widths, captured before any vertical layout
       attribute is applied (see the header note on flip-flop). */
    const naturalPillWidth = (pill: Element | null) =>
      pill ? pill.getBoundingClientRect().width : 0
    const soundPillWidth = naturalPillWidth(soundPill)
    const pondPillWidth = naturalPillWidth(pondPill)
    root.style.setProperty('--vibe-sound-pill-w', `${Math.round(soundPillWidth)}px`)
    root.style.setProperty('--vibe-pond-pill-w', `${Math.round(pondPillWidth)}px`)

    const apply = () => {
      const vw = window.visualViewport?.width ?? window.innerWidth
      const capsuleHalf = capsule ? capsule.getBoundingClientRect().width / 2 : 0
      root.style.setProperty('--vibe-capsule-half', `${Math.round(capsuleHalf)}px`)
      /* Horizontal whenever the pill fits beside the capsule even with the
         FAB pushed to the corner floor — the open-state CSS anchor pushes
         the FAB out to make that room. Vertical only when no horizontal
         position can fit the pill. */
      const horizontalFits = (pillWidth: number) =>
        pillWidth + EDGE_INSET_PX + PILL_CAPSULE_GAP_PX <= vw / 2 - capsuleHalf
      root.dataset.vibeSoundLayout = horizontalFits(soundPillWidth) ? 'horizontal' : 'vertical'
      root.dataset.vibePondLayout = horizontalFits(pondPillWidth) ? 'horizontal' : 'vertical'
    }

    apply()
    /* Debug mode adds categories to the capsule without a viewport resize —
       observe the capsule itself, not just the window. */
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && capsule) {
      observer = new ResizeObserver(apply)
      observer.observe(capsule)
    }
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      root.style.removeProperty('--vibe-capsule-half')
      root.style.removeProperty('--vibe-sound-pill-w')
      root.style.removeProperty('--vibe-pond-pill-w')
      delete root.dataset.vibeSoundLayout
      delete root.dataset.vibePondLayout
    }
  }, [active])
}
