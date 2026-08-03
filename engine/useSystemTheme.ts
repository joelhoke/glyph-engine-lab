'use client'

/**
 * System theme (feature/light-dark): the single reactive reader for
 * `prefers-color-scheme`. The CSS side of the theme lives in app/globals.css
 * (`:root` dark tokens + a light media-query override); this module mirrors
 * the same media query for the canvas engine and any imperative consumer.
 *
 * SSR-safe: the server render and the first client paint report 'dark' (the
 * default theme), the real preference is read in an effect after hydration,
 * and live system changes are subscribed to. There is no toggle and no
 * persistence — the system preference is the only input.
 */

import { useEffect, useState } from 'react'
import { ThemeName } from './theme'

const LIGHT_QUERY = '(prefers-color-scheme: light)'

/** Imperative reader: the current system theme ('dark' off-browser). */
export function getSystemTheme(): ThemeName {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark'
  }
  return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark'
}

/**
 * Reactive system theme: 'dark' on the server and the first paint (matching
 * the CSS default), the true preference after hydration, and live updates
 * while the visitor flips their OS setting.
 */
export function useSystemTheme(): ThemeName {
  const [theme, setTheme] = useState<ThemeName>('dark')
  useEffect(() => {
    const query = window.matchMedia(LIGHT_QUERY)
    const update = () => setTheme(query.matches ? 'light' : 'dark')
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return theme
}
