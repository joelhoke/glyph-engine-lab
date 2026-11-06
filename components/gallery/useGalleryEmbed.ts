'use client'

import { useEffect, useState } from 'react'

/** Keep direct URLs intact while allowing their content to live in the gallery window. */
export function useGalleryEmbed() {
  const [embedded, setEmbedded] = useState(false)
  useEffect(() => {
    if (window.parent === window || new URLSearchParams(location.search).get('gallery-embed') !== '1') return
    setEmbedded(true)
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        window.parent.postMessage({ type: 'gallery:escape' }, location.origin)
      }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  return embedded
}

/** Hosted same-origin demos have one additional frame; let Escape reach the window. */
export function bridgePrototypeEscape(frame: HTMLIFrameElement) {
  try {
    frame.contentWindow?.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.defaultPrevented && window.parent !== window) {
        window.parent.postMessage({ type: 'gallery:escape' }, location.origin)
      }
    })
  } catch { /* External previews retain their own keyboard controls. */ }
}
