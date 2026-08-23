import Link from 'next/link'
import type { PrototypeStack } from '../../functions/lib/prototypesManifest'
import styles from './gallery.module.css'

/**
 * Gallery index card for a listed stack (docs/prototypes-plan.md — one
 * component family, two contexts: /gallery and /p/<stack>). The thumbnail is
 * the first prototype's thumb, served through the Pages Function catch-all —
 * bundle assets never come from the static export.
 */
export default function StackCard({ stack }: { stack: PrototypeStack }) {
  const lead = stack.prototypes[0]
  return (
    <Link href={`/p/${stack.slug}`} className={styles.card}>
      {lead ? (
        <img
          className={styles.cardThumb}
          src={`/p/${stack.slug}/${lead.slug}/${lead.thumb}`}
          alt=""
          loading="lazy"
        />
      ) : null}
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{stack.title}</span>
        {stack.framing ? <span className={styles.cardSummary}>{stack.framing}</span> : null}
        <span className={styles.cardMeta}>
          {stack.prototypes.length}{' '}
          {stack.prototypes.length === 1 ? 'prototype' : 'prototypes'}
        </span>
      </span>
    </Link>
  )
}
