import Link from 'next/link'
import Logo from '../Logo'
import styles from './gallery.module.css'

type GalleryHeaderProps = {
  /** Breadcrumb tail shown after the wordmark (e.g. 'Gallery', stack title). */
  crumb: string
}

/**
 * Minimal standalone chrome for the hosted-prototypes routes (/gallery,
 * /p/*). Deliberately NOT the SiteHeader used by the homepage experience —
 * that one is client-coupled to the canvas scenes; this is a plain static
 * lockup (avatar + logo + wordmark home link) matching the same visual
 * language. Nav integration waits for the redesign's persistent header
 * (docs/prototypes-plan.md).
 */
export default function GalleryHeader({ crumb }: GalleryHeaderProps) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="joel hoke design — back to home">
        <img
          className={styles.avatar}
          // Monogram placeholder; swap to SITE_IDENTITY.avatarSrc once
          // feature/persistent-header (content/site.ts) merges in.
          src="/JHLogo-180.png"
          alt=""
          width={28}
          height={28}
        />
        <Logo className={styles.logo} aria-hidden="true" />
        <span className={styles.wordmark}>joel hoke design</span>
      </Link>
      <span className={styles.crumb} aria-current="page">
        {crumb}
      </span>
    </header>
  )
}
