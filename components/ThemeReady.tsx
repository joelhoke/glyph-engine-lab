'use client'

import { useEffect } from 'react'

/**
 * Gates theme transitions (feature/light-dark): adds `theme-ready` to <html>
 * AFTER hydration, so the first paint never animates — only live
 * system-theme changes fade through the globals.css `html.theme-ready`
 * transition rules. Renders nothing.
 */
export default function ThemeReady() {
  useEffect(() => {
    document.documentElement.classList.add('theme-ready')
  }, [])
  return null
}
