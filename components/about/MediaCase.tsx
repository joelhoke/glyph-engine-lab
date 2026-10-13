'use client'

import { useState, type CSSProperties } from 'react'
import HomeMedia from '../home/HomeMedia'
import type { MediaPick, MediaView } from '../../content/creativeMedia'
import styles from '../../app/about/about.module.css'

/** One cover/physical shell shared by the closed pile and its expanded collection. */
export default function MediaCase({ item, kind, index = 0 }: {
  item: MediaPick | null; kind: MediaView; index?: number
}) {
  const [failedSource, setFailedSource] = useState<string | undefined>()
  const image = item?.image?.src !== failedSource ? item?.image : undefined
  return <div className={styles.mediaCase} data-media-case={item?.id ?? `empty-${index}`} data-kind={kind} style={{ '--case-index': index } as CSSProperties}>
    <div className={styles.caseSpine} aria-hidden="true">{item?.title ?? 'Collection coming soon'}</div>
    <div className={styles.casePages} aria-hidden="true" />
    <div className={styles.caseFront} onErrorCapture={() => setFailedSource(item?.image?.src)}>
      {kind === 'gaming' && <span className={styles.caseBand} aria-hidden="true">Xbox</span>}
      <HomeMedia image={image} width={300} height={kind === 'comics' ? 460 : 450}
        label={item?.title ?? 'Collection coming soon'} className={styles.caseArtwork} />
      {failedSource && !image && <span className={styles.caseUnavailable}>Cover unavailable</span>}
    </div>
  </div>
}
