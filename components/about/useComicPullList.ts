'use client'

import { useEffect, useState } from 'react'
import fallback from '../../content/comics-fallback.json'
import { isComicSnapshot, upcomingWednesday, type ComicSnapshot } from '../../lib/comics.mjs'

export function useComicPullList() {
  const [snapshot, setSnapshot] = useState<ComicSnapshot>(fallback)
  const [state, setState] = useState<'saved' | 'fresh' | 'unavailable'>('saved')
  const [currentDate, setCurrentDate] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    setCurrentDate(upcomingWednesday())
    void fetch('/api/comics', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Pull list unavailable')
      const data: unknown = await response.json()
      if (!isComicSnapshot(data) || !data.fetchedAt) throw new Error('Invalid pull list')
      if (mounted) { setSnapshot(data); setState('fresh') }
    }).catch(() => { if (mounted) setState('unavailable') }).finally(() => clearTimeout(timeout))
    return () => { mounted = false; controller.abort(); clearTimeout(timeout) }
  }, [])

  return { snapshot, state, upcoming: state === 'fresh' && snapshot.releaseDate === currentDate }
}
export type ComicPullListData = ReturnType<typeof useComicPullList>
