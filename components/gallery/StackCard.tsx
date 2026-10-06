import Link from 'next/link'
import type { PrototypeStack } from '../../functions/lib/prototypesManifest'
import styles from './gallery.module.css'

/**
 * Gallery index card for a listed stack (docs/prototypes-plan.md — one
 * component family, two contexts: /gallery and /p/<stack>). The thumbnail is
 * the first prototype's public artwork override, or its bundle thumb served
 * through the Pages Function catch-all. A single-prototype stack
 * has no intermediate page worth visiting, so the card links straight to the
 * viewer (gated stacks land on the password gate there instead).
 */
export default function StackCard({ stack }: { stack: PrototypeStack }) {
  const lead = stack.prototypes[0]
  const href = stack.prototypes.length === 1 && lead ? `/p/${stack.slug}/${lead.slug}` : `/p/${stack.slug}`
  return (
    <Link href={href} className={styles.card}>
      {lead ? (
        <img
          className={styles.cardThumb}
          src={lead.publicThumbnail ?? `/p/${stack.slug}/${lead.slug}/${lead.thumb}`}
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
