'use client'

import { KeyboardEvent, ReactNode, RefObject, TouchEvent, UIEvent, WheelEvent } from 'react'

type BoundedScrollPanelProps = {
  /** Accessible name for the scrollable region (the frame's aria-label). */
  label: string
  /** Frame classes: the consumer owns border, radius, background, backdrop
   *  treatment, and height constraints — the shared component carries NO
   *  surface-specific colors or dimensions of its own. */
  className?: string
  /** Inner viewport classes (the surface's padding/content layout). */
  viewportClassName?: string
  /** Ref to the INNER scrolling viewport, for consumers that drive it
   *  imperatively (Work resets scrollTop on slide change). */
  viewportRef?: RefObject<HTMLDivElement | null>
  /** Keyboard handlers attach to the frame (e.g. Work's arrow navigation). */
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  /** Optional non-scrolling footer, rendered below the viewport inside the
   *  frame (Work's prev/next controls). The viewport keeps the remaining
   *  height, so footer controls never cover scrolling content. */
  footer?: ReactNode
  /** Optional viewport scroll/input callbacks (Work's expansion state
   *  machine). All optional: consumers that omit them get the exact same
   *  behavior as before (Collaborate). */
  onViewportScroll?: (event: UIEvent<HTMLDivElement>) => void
  onViewportWheel?: (event: WheelEvent<HTMLDivElement>) => void
  onViewportTouchStart?: (event: TouchEvent<HTMLDivElement>) => void
  onViewportTouchMove?: (event: TouchEvent<HTMLDivElement>) => void
  children: ReactNode
}

/**
 * Fixed-frame + inner-scroller shell: the outer frame stays stationary while
 * the inner viewport owns vertical scrolling (bounded height, overscroll
 * containment, stable scrollbar gutter, momentum touch scrolling). Swiping
 * inside scrolls only the viewport; reaching either end never chains into
 * the page or drags the frame. An optional footer sits outside the viewport
 * so it never scrolls away. Used by the Work case-study card and the
 * Collaborate landing card.
 */
export default function BoundedScrollPanel({
  label,
  className,
  viewportClassName,
  viewportRef,
  onKeyDown,
  footer,
  onViewportScroll,
  onViewportWheel,
  onViewportTouchStart,
  onViewportTouchMove,
  children,
}: BoundedScrollPanelProps) {
  return (
    <section className={className} aria-label={label} onKeyDown={onKeyDown}>
      <div
        className={`bounded-scroll-viewport${viewportClassName ? ` ${viewportClassName}` : ''}`}
        ref={viewportRef as RefObject<HTMLDivElement>}
        onScroll={onViewportScroll}
        onWheel={onViewportWheel}
        onTouchStart={onViewportTouchStart}
        onTouchMove={onViewportTouchMove}
      >
        {children}
      </div>
      {footer && <div className="bounded-scroll-footer">{footer}</div>}
    </section>
  )
}
