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

// Static export: every stack in the manifest gets a shell. Public stacks
// render their option cards directly; non-public stacks render only the
// generic gate placeholder below — no stack content enters the export
// (Phase 1 swaps the placeholder for the password/magic-link gate UI).
export function generateStaticParams() {
  return STACKS.map((stack) => ({ stack: stack.slug }))
}

export const dynamicParams = false

export function generateMetadata({ params }: StackPageProps): Metadata {
  const stack = findStack(params.stack)
  const isPublic = stack?.access.mode === 'public'
  return {
    title: isPublic ? stack.title : 'Shared prototypes',
    robots: { index: false, follow: false },
  }
}

/**
 * Stack page: framing note up top, then option cards (thumbnail, title, tier,
 * summary). The route is noindex; gated access control is enforced by the
 * Pages Function serving the bundle files, not by this shell.
 */
export default function StackPage({ params }: StackPageProps) {
  const stack = findStack(params.stack)
  if (!stack) notFound()

  if (stack.access.mode !== 'public') {
    // Phase 1 seam: the gate UI (password form / expired-link state) lands
    // here, backed by the /s/<stack> Functions. Until then the placeholder
    // says nothing about the stack itself.
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
