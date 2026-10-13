'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { ThemeName } from '../../engine/theme'

/** Resolve the shared Fibre Arc colors from the site's theme tokens. */
export function useFibrePalette(host: RefObject<HTMLElement | null>, theme: ThemeName) {
  const [palette, setPalette] = useState({ baseColor: '', accentColor: '', highlight: '' })
  useEffect(() => {
    if (!host.current) return
    const css = getComputedStyle(host.current)
    const token = (name: string) => css.getPropertyValue(name).trim()
    setPalette({ baseColor: token('--color-hero-blue-edge'), accentColor: token('--color-accent'), highlight: token('--color-hero-blue-light') })
  }, [host, theme])
  return palette
}
