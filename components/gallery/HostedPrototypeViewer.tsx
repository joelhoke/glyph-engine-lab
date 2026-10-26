import Link from 'next/link'
import { ReactNode } from 'react'
import GalleryHeader from './GalleryHeader'
import ViewerBackLink from './ViewerBackLink'
import styles from './gallery.module.css'

type HostedPrototypeViewerProps = {
  title: string
  src: string
  backHref: string
  backLabel: string
  caption?: ReactNode
  /** Trusted external previews may leave the frame after a visitor clicks. */
  allowExternalNavigation?: boolean
  /** Back returns to the previous in-site screen via browser history when one
      exists (restoring its exact view and scroll position); backHref remains
      the fallback for direct visits. */
  backViaHistory?: boolean
}

/** Shared full-window shell for gallery prototypes and work viewers. */
export default function HostedPrototypeViewer({
  title,
  src,
  backHref,
  backLabel,
  caption,
  allowExternalNavigation = false,
  backViaHistory = false,
}: HostedPrototypeViewerProps) {
  return (
    <div className={styles.shell}>
      <GalleryHeader />
      <main id="main-content" className={styles.viewerMain}>
        <div className={styles.viewerBar}>
          <h1 className={styles.viewerTitle}>{title}</h1>
          {backViaHistory ? (
            <ViewerBackLink href={backHref} className={styles.backLink}>
              ← {backLabel}
            </ViewerBackLink>
          ) : (
            <Link href={backHref} className={styles.backLink}>
              ← {backLabel}
            </Link>
          )}
        </div>
        <iframe
          className={styles.viewerFrame}
          src={src}
          sandbox={allowExternalNavigation
            ? 'allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox'
            : 'allow-scripts allow-same-origin'}
          title={title}
        />
        {caption ? <p className={styles.viewerCaption}>{caption}</p> : null}
      </main>
    </div>
  )
}
