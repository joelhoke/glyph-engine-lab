import Link from 'next/link'
import { ReactNode } from 'react'
import GalleryHeader from './GalleryHeader'
import styles from './gallery.module.css'

type HostedPrototypeViewerProps = {
  title: string
  src: string
  backHref: string
  backLabel: string
  caption?: ReactNode
}

/** Shared full-window shell for gallery prototypes and work viewers. */
export default function HostedPrototypeViewer({
  title,
  src,
  backHref,
  backLabel,
  caption,
}: HostedPrototypeViewerProps) {
  return (
    <div className={styles.shell}>
      <GalleryHeader />
      <main id="main-content" className={styles.viewerMain}>
        <div className={styles.viewerBar}>
          <h1 className={styles.viewerTitle}>{title}</h1>
          <Link href={backHref} className={styles.backLink}>
            ← {backLabel}
          </Link>
        </div>
        <iframe
          className={styles.viewerFrame}
          src={src}
          sandbox="allow-scripts allow-same-origin"
          title={title}
        />
        {caption ? <p className={styles.viewerCaption}>{caption}</p> : null}
      </main>
    </div>
  )
}
