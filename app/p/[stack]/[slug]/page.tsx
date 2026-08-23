import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { STACKS, findPrototype, findStack } from '../../../../functions/lib/prototypesManifest'
import GalleryHeader from '../../../../components/gallery/GalleryHeader'
import styles from '../../../../components/gallery/gallery.module.css'

type ViewerPageProps = {
  params: { stack: string; slug: string }
}

// Static export: one viewer shell per prototype. For non-public stacks the
// shell carries no prototype content — the gate seam mirrors the stack page
// (Phase 1/2); Phase 0 only has the public dummy anyway.
export function generateStaticParams() {
  return STACKS.flatMap((stack) =>
    stack.prototypes.map((prototype) => ({ stack: stack.slug, slug: prototype.slug })),
  )
}

export const dynamicParams = false

export function generateMetadata({ params }: ViewerPageProps): Metadata {
  const stack = findStack(params.stack)
  const prototype = stack ? findPrototype(stack, params.slug) : null
  const isPublic = stack?.access.mode === 'public'
  return {
    title: isPublic && prototype ? `${prototype.title} — ${stack.title}` : 'Shared prototypes',
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

  if (stack.access.mode !== 'public') {
    // Phase 1/2 seam: without a valid access cookie the bundle files 404, so
    // rendering the iframe would be pointless — the gate UI lands here.
    return (
      <div className={styles.shell}>
        <GalleryHeader crumb="Shared prototypes" />
        <main id="main-content" className={styles.main}>
          <h1 className={styles.title}>Shared prototypes</h1>
          <p className={styles.gate}>
            This stack is shared privately. Open it through the link you were sent, or ask
            Joel for a fresh one.
          </p>
        </main>
      </div>
    )
  }

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
