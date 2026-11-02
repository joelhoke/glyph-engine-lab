'use client'

import { useEffect, useState } from 'react'

export function useReducedMotion() {
  // Default to still until the browser preference is known.
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}
