import Link from 'next/link'
import type { PrototypeEntry, PrototypeStack } from '../../functions/lib/prototypesManifest'
import styles from './gallery.module.css'

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
  return (
    <Link href={`/p/${stack.slug}/${prototype.slug}`} className={styles.card}>
      <img
        className={styles.cardThumb}
        src={`/p/${stack.slug}/${prototype.slug}/${prototype.thumb}`}
        alt=""
        loading="lazy"
      />
      <span className={styles.cardBody}>
        {prototype.tier ? <span className={styles.cardTier}>{prototype.tier}</span> : null}
        <span className={styles.cardTitle}>{prototype.title}</span>
        <span className={styles.cardSummary}>{prototype.summary}</span>
      </span>
    </Link>
  )
}
