'use client'

import { useEffect, type RefObject } from 'react'
import { listenForOutsidePointer } from './outsidePointer'

/** Shared top-layer presentation and outside dismissal for scene detail panels. */
export function useDetailPopover(selection: string | null, active: boolean, panel: RefObject<HTMLElement | null>,
  inside: () => readonly (Node | null | undefined)[], dismiss: () => void) {
  useEffect(() => {
    const element = panel.current
    if (!selection || !active || !element) return
    element.showPopover?.()
    element.focus({ preventScroll: true })
    return () => {
      if (element.isConnected && element.hidePopover && element.matches(':popover-open')) element.hidePopover()
    }
  }, [selection, active, panel])
  useEffect(() => {
    if (!selection || !active) return
    return listenForOutsidePointer(() => [panel.current, ...inside()], dismiss)
  }, [selection, active, panel, inside, dismiss])
}
