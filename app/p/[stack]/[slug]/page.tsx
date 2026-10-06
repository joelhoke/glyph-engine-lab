import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { STACKS, findPrototype, findStack } from '../../../../functions/lib/prototypesManifest'
import HostedPrototypeViewer from '../../../../components/gallery/HostedPrototypeViewer'

type ViewerPageProps = {
  params: Promise<{ stack: string; slug: string }>
}

// Static export: one viewer shell per prototype. Like the stack page, gated
// stacks render the full viewer — the /p/* Function gates the request before
// this export is ever served (and the bundle files themselves 404 without
// the access cookie regardless).
export function generateStaticParams() {
  return STACKS.flatMap((stack) =>
    stack.prototypes.map((prototype) => ({ stack: stack.slug, slug: prototype.slug })),
  )
}

export const dynamicParams = false

export async function generateMetadata({ params }: ViewerPageProps): Promise<Metadata> {
  const resolved = await params
  const stack = findStack(resolved.stack)
  const prototype = stack ? findPrototype(stack, resolved.slug) : null
  return {
    title: stack && prototype ? `${prototype.title} — ${stack.title}` : 'Shared prototypes',
    robots: { index: false, follow: false },
  }
}

/**
 * Prototype viewer: a sandboxed iframe playing the self-contained bundle,
 * served file-by-file from R2 through the /p/* Pages Function catch-all.
 * `allow-same-origin` is safe here because the bundle is same-origin by
 * design and the sandbox still blocks top-window navigation, popups, and
 * storage access outside the frame.
 */
export default async function ViewerPage({ params }: ViewerPageProps) {
  const resolved = await params
  const stack = findStack(resolved.stack)
  if (!stack) notFound()
  const prototype = findPrototype(stack, resolved.slug)
  if (!prototype) notFound()

  const solo = stack.prototypes.length === 1 && stack.listed
  return (
    <HostedPrototypeViewer
      title={`${prototype.title} — interactive prototype`}
      src={`/p/${stack.slug}/${prototype.slug}/index.html`}
      backHref={solo ? '/gallery' : `/p/${stack.slug}`}
      backLabel={solo ? 'Back to gallery' : 'Back to options'}
    />
  )
}
