'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import SiteHeader from '../../SiteHeader'
import { useGalleryEmbed } from '../useGalleryEmbed'
import styles from './playground.module.css'

export default function PlaygroundShell({ title, description, controls, children, onMenuOpenChange }: { title: string; description: string; controls: ReactNode; children: ReactNode; onMenuOpenChange(open: boolean): void }) {
  const embedded = useGalleryEmbed()
  return <div className={styles.shell} data-embedded={embedded}>
    {!embedded && <SiteHeader active="gallery" onMenuOpenChange={onMenuOpenChange} />}
    <main id="main-content" className={styles.main}>
      <header className={styles.heading}>
        <Link href="/gallery" className={styles.back}>← Gallery</Link>
        <p className={styles.eyebrow}>A study in color and motion</p>
        <h1>{title}</h1><p>{description}</p>
      </header>
      <section className={styles.workspace} data-playground-workspace aria-label={`${title} playground`}>
        <aside className={styles.controls} aria-label="Playground controls">{controls}</aside>
        <div className={styles.track}><div className={styles.stage}>{children}</div></div>
      </section>
      <footer className={styles.footer}>A little color, a little curiosity. <Link href="/gallery">Keep exploring the gallery →</Link></footer>
    </main>
  </div>
}
