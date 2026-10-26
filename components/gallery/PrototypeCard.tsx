import type { PrototypeEntry, PrototypeStack } from '../../functions/lib/prototypesManifest'
import GalleryCard from './GalleryCard'

/**
 * Option card on a stack page: thumbnail, title, tier label, one-line
 * summary. Links into the sandboxed viewer at /p/<stack>/<slug>.
 */
export default function PrototypeCard({
  stack,
  prototype,
}: {
  stack: PrototypeStack
  prototype: PrototypeEntry
}) {
  return <GalleryCard href={`/p/${stack.slug}/${prototype.slug}`} title={prototype.title}
    summary={prototype.summary} tier={prototype.tier}
    thumbnail={prototype.publicThumbnail ?? `/p/${stack.slug}/${prototype.slug}/${prototype.thumb}`} />
}
