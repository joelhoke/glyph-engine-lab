'use client'

type PointerState = {
  x: number
  y: number
  active: boolean
}

const pointerState: PointerState = {
  x: -9999,
  y: -9999,
  active: false,
}

const setPointer = (x: number, y: number) => {
  pointerState.x = x
  pointerState.y = y
  pointerState.active = true
}

const clearPointer = () => {
  pointerState.x = -9999
  pointerState.y = -9999
  pointerState.active = false
}

const getPointer = () => ({
  x: pointerState.x,
  y: pointerState.y,
  active: pointerState.active,
})

const createPointerListeners = (options?: {
  onMove?: (event: PointerEvent) => void
  onClear?: () => void
}) => {
  const pointerMove = (event: PointerEvent) => {
    setPointer(event.clientX, event.clientY)
    options?.onMove?.(event)
  }

  const clear = () => {
    clearPointer()
    options?.onClear?.()
  }

  const visibilityChange = () => {
    if (document.visibilityState !== 'visible') clear()
  }

  const addListeners = () => {
    window.addEventListener('pointermove', pointerMove)
    window.addEventListener('pointerleave', clear)
    window.addEventListener('pointercancel', clear)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', visibilityChange)
  }

  const removeListeners = () => {
    window.removeEventListener('pointermove', pointerMove)
    window.removeEventListener('pointerleave', clear)
    window.removeEventListener('pointercancel', clear)
    window.removeEventListener('blur', clear)
    document.removeEventListener('visibilitychange', visibilityChange)
  }

  return {
    addListeners,
    removeListeners,
    getPointer,
    setPointer,
    clearPointer,
  }
}

export type { PointerState }
export { createPointerListeners, getPointer, setPointer, clearPointer }
