'use client'

/**
 * Playground creations (feature/vibe-creations): the gallery-index card for
 * the creations stack, client-fetched from /api/creations on mount. Like the
 * manifest-driven StackCards it sits beside, it links into a stack page
 * (/gallery/creations). Loading, empty, and error states render NOTHING —
 * the static export carries no placeholder, so the card simply never shifts
 * the gallery layout (and unlisted creations stay server-side).
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { fetchListedCreations, ListedCreation } from '../../engine/creationClient'
import styles from './gallery.module.css'

export default function CreationsStackCard() {
  const [creations, setCreations] = useState<ListedCreation[] | null>(null)

  useEffect(() => {
    let canceled = false
    fetchListedCreations().then((list) => {
      if (!canceled) setCreations(list)
    })
    return () => {
      canceled = true
    }
  }, [])

  if (!creations || creations.length === 0) return null

  const lead = creations[0]
  return (
    <Link href="/gallery/creations" className={styles.card}>
      {lead.thumbUrl ? (
        <img className={styles.cardThumb} src={lead.thumbUrl} alt="" loading="lazy" />
      ) : null}
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>Playground creations</span>
        <span className={styles.cardSummary}>
          Screenshots and clips saved from the vibe playground — preview each piece, then
          open it back in the playground and remix it yourself.
        </span>
        <span className={styles.cardMeta}>
          {creations.length} {creations.length === 1 ? 'creation' : 'creations'}
        </span>
      </span>
    </Link>
  )
}
