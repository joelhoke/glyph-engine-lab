import type { Metadata } from 'next'
import GalleryHeader from '../../../components/gallery/GalleryHeader'
import CreationsGallery from '../../../components/gallery/CreationsGallery'
import styles from '../../../components/gallery/gallery.module.css'

export const metadata: Metadata = {
  title: 'Playground creations',
  robots: { index: false, follow: false },
}

/**
 * Creations stack page (feature/vibe-creations). A static shell — the grid is
 * client-fetched from /api/creations inside CreationsGallery, so unlisted
 * creations never reach the export and new saves appear without a rebuild.
 */
export default function CreationsPage() {
  return (
    <div className={styles.shell}>
      <GalleryHeader />
      <main id="main-content" className={styles.main}>
        <CreationsGallery />
      </main>
    </div>
  )
}
