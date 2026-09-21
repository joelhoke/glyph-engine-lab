'use client'

import { useEffect, useRef, useState } from 'react'

/** Load nearby models once; animate only while visible and the page is open. */
export function useSectionVisibility(enabled: boolean) {
  const ref = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  const [visible, setVisible] = useState(false)
  const [documentVisible, setDocumentVisible] = useState(true)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const preload = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); preload.disconnect() }
    }, { rootMargin: '200px' })
    const visibility = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    const onVisibility = () => setDocumentVisible(!document.hidden)
    preload.observe(element)
    visibility.observe(element)
    document.addEventListener('visibilitychange', onVisibility)
    onVisibility()
    return () => {
      preload.disconnect(); visibility.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return { ref, near, active: enabled && visible && documentVisible }
}
