import Link from 'next/link'
import type { GALLERY_PLAYGROUNDS } from '../../content/galleryPlaygrounds'
import styles from './gallery.module.css'
import ProjectThumbnail from '../ProjectThumbnail'

export default function PlaygroundCard({ playground }: { playground: (typeof GALLERY_PLAYGROUNDS)[number] }) {
  return <Link href={playground.href} className={styles.card}>
    <ProjectThumbnail className={`${styles.cardThumb} ${styles.playgroundThumb}`} src={playground.thumbnail} href={playground.href} title={playground.title} aspectRatio="16 / 9" />
    <span className={styles.cardBody}>
      <span className={styles.cardTitle}>{playground.title}</span>
      <span className={styles.cardSummary}>{playground.summary}</span>
      <span className={styles.cardMeta}>Interactive playground</span>
    </span>
  </Link>
}
