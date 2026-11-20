'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Each entry reverses one user edit. Continuous inputs keep their starting value. */
export function useUndoHistory() {
  const entries = useRef<(() => void)[]>([])
  const activeGroup = useRef<string | undefined>(undefined)
  const [canUndo, setCanUndo] = useState(false)

  const record = useCallback((restore: () => void, group?: string) => {
    if (group !== undefined && activeGroup.current === group) return
    activeGroup.current = group
    entries.current.push(restore)
    if (entries.current.length > 100) entries.current.shift()
    setCanUndo(true)
  }, [])

  const undo = useCallback(() => {
    activeGroup.current = undefined
    const restore = entries.current.pop()
    setCanUndo(entries.current.length > 0)
    restore?.()
  }, [])

  const clear = useCallback(() => {
    entries.current.length = 0
    activeGroup.current = undefined
    setCanUndo(false)
  }, [])

  useEffect(() => {
    const beginInteraction = () => { activeGroup.current = undefined }
    let interactionTarget: EventTarget | null = null
    const pointerDown = (event: PointerEvent) => {
      interactionTarget = event.target
      beginInteraction()
    }
    const focusIn = (event: FocusEvent) => {
      // A slider can emit its first change on pointerdown before receiving focus.
      if (event.target !== interactionTarget) beginInteraction()
      interactionTarget = event.target
    }
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (event.defaultPrevented || event.isComposing || !(target instanceof HTMLElement)) return
      if (target !== document.body && target !== document.documentElement && !target.closest('[data-playground-workspace]')) return
      if (target.isContentEditable || document.querySelector('[aria-modal="true"], dialog[open]')) return

      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        if (entries.current.length) {
          event.preventDefault()
          undo()
        }
      } else if (!event.repeat && target instanceof HTMLInputElement && (target.type === 'range' || target.type === 'color')) {
        beginInteraction()
      }
    }
    document.addEventListener('pointerdown', pointerDown, true)
    document.addEventListener('focusin', focusIn, true)
    document.addEventListener('keydown', keyDown)
    return () => {
      document.removeEventListener('pointerdown', pointerDown, true)
      document.removeEventListener('focusin', focusIn, true)
      document.removeEventListener('keydown', keyDown)
    }
  }, [undo])

  return { record, undo, canUndo, clear }
}
