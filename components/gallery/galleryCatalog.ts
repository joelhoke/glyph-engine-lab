// Build-time only. Never import this module into a client component.
import { listedStacks } from '../../functions/lib/prototypesManifest'
import { GALLERY_PLAYGROUNDS } from '../../content/galleryPlaygrounds'
import { GALLERY_HIGHLIGHTS } from '../../content/galleryHighlights'
import { HOME_HIGHLIGHTS } from '../../content/homeHighlights'
import type { GalleryItem } from './galleryTypes'

const clips: Record<string, string> = {
  'three-gradient': 'three-gradient', 'joelops/demo': 'global-operations-demo',
  'type-lab/orbit-toy': 'orbit-toy', 'type-lab/glass-playground': 'glass-playground',
  'type-lab/logo-studio': 'logo-studio', 'golden-age-collectables/mild': 'golden-age-mild',
  'golden-age-collectables/medium': 'golden-age-medium',
  'october-2026': 'october-2026',
  'droplet': 'droplet', 'cars': 'cars',
}
const preview = (id: string) => clips[id] ? `/assets/gallery/previews/${clips[id]}.mp4?v=2` : undefined
const poster = (id: string, fallback: string) => clips[id] ? `/assets/gallery/previews/${clips[id]}.webp?v=2` : fallback

export function buildGalleryCatalog(): GalleryItem[] {
  const playgrounds: GalleryItem[] = [...GALLERY_PLAYGROUNDS, ...GALLERY_HIGHLIGHTS].map(p => ({
    id: p.id, title: p.title, category: 'Interactive playground', poster: poster(p.id, p.thumbnail),
    preview: preview(p.id), action: { kind: 'link', href: p.href },
  }))
  const prototypes: GalleryItem[] = listedStacks().flatMap(stack => stack.prototypes.map(p => {
    const id = `${stack.slug}/${p.slug}`
    return { id, title: stack.slug === 'golden-age-collectables' ? `${stack.title} — ${p.title}` : p.title,
      category: 'Interactive demo', poster: poster(id, p.publicThumbnail ?? `/p/${id}/${p.thumb}`),
      preview: preview(id), requiresPassword: stack.access.mode !== 'public', action: { kind: 'link' as const, href: `/p/${id}` } }
  }))
  const recaps: GalleryItem[] = HOME_HIGHLIGHTS.map(h => ({ id: h.id, title: h.title, category: 'Monthly recap',
    poster: poster(h.id, h.sources.landscape.poster), preview: preview(h.id),
    action: { kind: 'media', media: h.media === 'video' ? {
      kind: 'video', id: h.id, src: h.sources.landscape.src, poster: h.sources.landscape.poster,
      width: h.sources.landscape.width, height: h.sources.landscape.height, alt: h.alt,
      transcript: 'Visual portfolio recap. No spoken dialogue.', caption: h.caption,
    } : { kind: 'image', id: h.id, src: h.sources.landscape.src, width: h.sources.landscape.width,
      height: h.sources.landscape.height, alt: h.alt, caption: h.caption } },
  }))
  // Put a mix of work in the opening view, then the rest of the public catalog.
  return [...playgrounds, ...prototypes, ...recaps]
}
