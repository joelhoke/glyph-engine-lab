/** PNGs come from the exact live renderer, including theme and current covers.
 * One small bitmap per slot replaces inactive WebGL draws; no second asset catalog.
 */
export function createDockPreview(image: HTMLImageElement | null, invalidate: () => void) {
  let generation = 0, disposed = false
  const preview = {
    dirty: true, ready: false,
    show(visible: boolean) { if (image) image.style.opacity = visible ? '1' : '0' },
    capture(source: HTMLCanvasElement, rect: { left: number; top: number; width: number; height: number }, pixelRatio: number) {
      preview.dirty = false; preview.ready = false
      if (!image) return
      const version = ++generation
      const bitmap = document.createElement('canvas')
      bitmap.width = Math.max(1, Math.round(rect.width * pixelRatio))
      bitmap.height = Math.max(1, Math.round(rect.height * pixelRatio))
      const context = bitmap.getContext('2d')
      if (!context) return
      try {
      context.drawImage(source, rect.left * pixelRatio, rect.top * pixelRatio,
        rect.width * pixelRatio, rect.height * pixelRatio, 0, 0, bitmap.width, bitmap.height)
      image.src = bitmap.toDataURL('image/png')
      } catch { return } // A failed capture keeps the live renderer as fallback.
      void image.decode().then(() => {
        if (disposed || version !== generation) return
        preview.ready = true; invalidate()
      }).catch(() => { /* Keep the live fallback if PNG decoding fails. */ })
    },
    dispose() { disposed = true; generation++; if (image) { image.removeAttribute('src'); image.style.opacity = '0' } },
  }
  return preview
}
