'use client'

import { useSystemTheme } from '../../../engine/useSystemTheme'

export function useLightTheme() {
  return useSystemTheme() === 'light'
}
