import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { STACKS, findStack } from '../../../functions/lib/prototypesManifest'
import GalleryHeader from '../../../components/gallery/GalleryHeader'
import PrototypeCard from '../../../components/gallery/PrototypeCard'
import styles from '../../../components/gallery/gallery.module.css'

type StackPageProps = {
  params: { stack: string }
}

// Static export: every stack in the manifest gets a shell. Gated stacks
// render the same full content as public ones — access control lives in the
// /p/* Pages Function catch-all, which runs before this export is served
// for EVERY /p/* request and swaps unauthenticated requests for the
// password gate (functions/p/[[path]].ts, Phase 1).
export function generateStaticParams() {
  return STACKS.map((stack) => ({ stack: stack.slug }))
}

export const dynamicParams = false

export function generateMetadata({ params }: StackPageProps): Metadata {
  const stack = findStack(params.stack)
  return {
    title: stack?.title ?? 'Shared prototypes',
    robots: { index: false, follow: false },
  }
}

/**
 * Stack page: framing note up top, then option cards (thumbnail, title, tier,
 * summary). The route is noindex; gated access control is enforced by the
 * Pages Function in front of this shell, not by the shell itself.
 */
export default function StackPage({ params }: StackPageProps) {
  const stack = findStack(params.stack)
  if (!stack) notFound()

  return (
    <div className={styles.shell}>
      <GalleryHeader />
      <main id="main-content" className={styles.main}>
        {stack.listed ? (
          <Link href="/gallery" className={styles.backLink}>
            ← Gallery
          </Link>
        ) : null}
        <h1 className={styles.title}>{stack.title}</h1>
        {stack.framing ? <p className={styles.intro}>{stack.framing}</p> : null}
        <ul className={styles.cardGrid}>
          {stack.prototypes.map((prototype) => (
            <li key={prototype.slug}>
              <PrototypeCard stack={stack} prototype={prototype} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
