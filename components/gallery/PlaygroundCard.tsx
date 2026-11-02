import Link from 'next/link'
import type { GALLERY_PLAYGROUNDS } from '../../content/galleryPlaygrounds'
import styles from './gallery.module.css'

export default function PlaygroundCard({ playground }: { playground: (typeof GALLERY_PLAYGROUNDS)[number] }) {
  return <Link href={playground.href} className={styles.card}>
    <img className={`${styles.cardThumb} ${styles.playgroundThumb}`} src={playground.thumbnail} alt="" loading="lazy" />
    <span className={styles.cardBody}>
      <span className={styles.cardTitle}>{playground.title}</span>
      <span className={styles.cardSummary}>{playground.summary}</span>
      <span className={styles.cardMeta}>Interactive playground</span>
    </span>
  </Link>
}
