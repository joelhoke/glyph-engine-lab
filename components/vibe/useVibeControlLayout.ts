'use client'

/**
 * Vibe floating-control layout: keeps the Sound (lower-left) and Pond
 * (lower-right) controls clear of the centered vibe toolbar capsule at every
 * viewport width — the "object awareness" layer the fixed 20vw anchors can't
 * provide on their own.
 *
 * Two published signals, both set on <html> and consumed by globals.css:
 *
 *   --vibe-capsule-half      Half the measured toolbar capsule width (px).
 *                            The CSS FAB anchors glide toward the corners via
 *                            min(20vw, 50% - half - FAB - gap), so the FABs
 *                            never touch the capsule no matter how wide it is
 *                            (clamps, wrapping, debug-only categories).
 *
 *   data-vibe-sound-layout / data-vibe-pond-layout = "horizontal" | "vertical"
 *                            Per side: a pill may keep its desktop horizontal
 *                            inward expansion only while it fully fits between
 *                            its 20vw anchor and the capsule edge. The pill is
 *                            anchored AT the FAB's edge (it grows out from
 *                            behind the FAB), so its far edge is anchor +
 *                            pill width:
 *                              20vw + pill width + 12px clearance
 *                                ≤ 50vw − capsule half
 *                            Otherwise the pill expands vertically upward from
 *                            the FAB (same idiom as the ≤640px media query).
 *                            The sound pill is much narrower than the pond
 *                            pill, so the sides are decided independently.
 *
 * Pill widths are measured ONCE while the default (horizontal) styles apply
 * and cached for the session: measuring a vertically-expanded pill would
 * return its 66px column width and flip-flop the decision. Pill content is
 * static per control, so a cached natural width stays valid.
 *
 * No-op unless `active` (the vibe surface with its controls is mounted);
 * cleanup removes the var + attributes so a remount starts fresh.
 */

import { useEffect } from 'react'

const FAB_CAPSULE_GAP_PX = 12
const HORIZONTAL_ANCHOR_VW = 20

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

    const apply = () => {
      const vw = window.visualViewport?.width ?? window.innerWidth
      const capsuleHalf = capsule ? capsule.getBoundingClientRect().width / 2 : 0
      root.style.setProperty('--vibe-capsule-half', `${Math.round(capsuleHalf)}px`)
      /* The pill grows out from behind the FAB (its anchor edge IS the FAB's
         edge), so the horizontal footprint is anchor + pill width — the FAB
         itself is not extra width. */
      const horizontalFits = (pillWidth: number) =>
        (HORIZONTAL_ANCHOR_VW / 100) * vw + pillWidth + FAB_CAPSULE_GAP_PX <=
        vw / 2 - capsuleHalf
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
      delete root.dataset.vibeSoundLayout
      delete root.dataset.vibePondLayout
    }
  }, [active])
}
