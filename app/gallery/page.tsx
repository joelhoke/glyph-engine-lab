import type { Metadata } from 'next'
import { listedStacks } from '../../functions/lib/prototypesManifest'
import GalleryHeader from '../../components/gallery/GalleryHeader'
import StackCard from '../../components/gallery/StackCard'
import styles from '../../components/gallery/gallery.module.css'

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'Public explorations and experiments — self-contained interactive prototypes by Joel Hoke.',
}

/**
 * Public Gallery index (docs/prototypes-plan.md, Phase 0). Renders listed
 * stacks as cards at build time — the manifest is imported directly and
 * filtered here, so unlisted stacks never reach the export. No client-side
 * data fetching.
 */
export default function GalleryPage() {
  const stacks = listedStacks()
  return (
    <div className={styles.shell}>
      <GalleryHeader crumb="Gallery" />
      <main id="main-content" className={styles.main}>
        <h1 className={styles.title}>Gallery</h1>
        <p className={styles.intro}>
          Explorations and experiments — small interactive prototypes, hosted here and
          played in place.
        </p>
        <ul className={styles.cardGrid}>
          {stacks.map((stack) => (
            <li key={stack.slug}>
              <StackCard stack={stack} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
