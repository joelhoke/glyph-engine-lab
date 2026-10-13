'use client'

import type { CSSProperties } from 'react'
import MediaCase from './MediaCase'
import DockLabel from '../DockLabel'
import type { MediaPick, MediaView } from '../../content/creativeMedia'
import styles from '../../app/about/about.module.css'

/** Three lightweight physical cases; the full collection reuses the same images. */
export default function MediaPile({ kind, label, items, expanded, controls, onOpen, index = 0 }: {
  index?: number
  kind: MediaView; label: string; items: readonly MediaPick[]; expanded: boolean; controls: string
  onOpen: (button: HTMLButtonElement) => void
}) {
  const previews = items.slice(0, 3)
  // Empty cases represent an unconnected collection, never invented game titles.
  const cases: (MediaPick | null)[] = previews.length ? previews : [null, null, null]
  return <button type="button" className={styles.mediaPile} data-media-pile={kind} style={{ '--pile-index': index } as CSSProperties}
    aria-label={`Open ${label}`} aria-expanded={expanded} aria-controls={controls}
    onClick={event => onOpen(event.currentTarget)}>
    <div className={styles.pileStage} aria-hidden="true">
      <div className={styles.pileLayers}>
        {cases.map((item, index) => <MediaCase key={item?.id ?? index} item={item} kind={kind} index={index} />)}
      </div>
    </div>
    <span className={styles.pileCaption}><DockLabel visible>{label}</DockLabel></span>
  </button>
}
