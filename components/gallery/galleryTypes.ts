import type { WorkMedia } from '../../content/work'

export type GalleryPalette = { id: string; name: string; colors: readonly string[] }
export type GalleryArtwork = { seed: number; palette: number }
export type GalleryItem = {
  id: string
  title: string
  category: string
  poster: string
  preview?: string
  requiresPassword?: boolean
  action: { kind: 'link'; href: string } | { kind: 'media'; media: Extract<WorkMedia, { kind: 'image' | 'video' }> }
}
export type GalleryLayout = 'regular' | 'mixed'
