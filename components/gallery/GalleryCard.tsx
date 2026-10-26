import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './gallery.module.css'

/** One card shell for hosted prototypes, standalone experiences and external projects. */
export default function GalleryCard({ href, thumbnail, title, summary, tier, meta }: {
  href: string; thumbnail?: string; title: string; summary?: string; tier?: string; meta?: ReactNode
}) {
  const body = <>
    {thumbnail && <img className={styles.cardThumb} src={thumbnail} alt="" loading="lazy" width={1200} height={675} />}
    <span className={styles.cardBody}>
      {tier && <span className={styles.cardTier}>{tier}</span>}
      <span className={styles.cardTitle}>{title}</span>
      {summary && <span className={styles.cardSummary}>{summary}</span>}
      {meta && <span className={styles.cardMeta}>{meta}</span>}
    </span>
  </>
  return href.startsWith('https://')
    ? <a href={href} className={styles.card}>{body}</a>
    : <Link href={href} className={styles.card} prefetch={false}>{body}</Link>
}
