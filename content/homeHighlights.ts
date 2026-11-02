export type HighlightSource = { src: string; poster: string; width: number; height: number }
export type HomeHighlight = {
  id: string
  title: string
  caption: string
  media: 'video' | 'image'
  alt: string
  sources: { landscape: HighlightSource; portrait: HighlightSource }
  destination?: { href: string; label: string }
}

/** Ordered features. Navigation appears automatically when there is more than one. */
export const HOME_HIGHLIGHTS: HomeHighlight[] = [{
  id: 'october-2026',
  title: 'October, by design.',
  caption: 'October 2026 · Monthly recap.',
  media: 'video',
  alt: 'A 75-second visual recap of Joel’s October design projects and experiments.',
  sources: {
    landscape: { src: '/assets/home/highlights/october-2026-landscape.mp4', poster: '/assets/home/highlights/october-2026-landscape.webp', width: 1920, height: 1080 },
    portrait: { src: '/assets/home/highlights/october-2026-portrait.mp4', poster: '/assets/home/highlights/october-2026-portrait.webp', width: 1080, height: 1920 },
  },
}]
