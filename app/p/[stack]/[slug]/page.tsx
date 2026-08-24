import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { STACKS, findPrototype, findStack } from '../../../../functions/lib/prototypesManifest'
import GalleryHeader from '../../../../components/gallery/GalleryHeader'
import styles from '../../../../components/gallery/gallery.module.css'

type ViewerPageProps = {
  params: { stack: string; slug: string }
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

export function generateMetadata({ params }: ViewerPageProps): Metadata {
  const stack = findStack(params.stack)
  const prototype = stack ? findPrototype(stack, params.slug) : null
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
export default function ViewerPage({ params }: ViewerPageProps) {
  const stack = findStack(params.stack)
  if (!stack) notFound()
  const prototype = findPrototype(stack, params.slug)
  if (!prototype) notFound()

  return (
    <div className={styles.shell}>
      <GalleryHeader crumb={stack.title} />
      <main id="main-content" className={styles.viewerMain}>
        <div className={styles.viewerBar}>
          <h1 className={styles.viewerTitle}>{prototype.title}</h1>
          <Link href={`/p/${stack.slug}`} className={styles.backLink}>
            ← Back to options
          </Link>
        </div>
        <iframe
          className={styles.viewerFrame}
          src={`/p/${stack.slug}/${prototype.slug}/index.html`}
          sandbox="allow-scripts allow-same-origin"
          title={`${prototype.title} — interactive prototype`}
        />
      </main>
    </div>
  )
}
