'use client'

import { memo } from 'react'
import ProjectThumbnail from '../ProjectThumbnail'
import type { GalleryItem } from './galleryTypes'
import styles from './sphere.module.css'

export default memo(function GalleryTileMedia({ item, active }: { item: GalleryItem; active: boolean }) {
  return <span className={styles.media}>
    <ProjectThumbnail src={item.poster} href={item.action.kind === 'link' ? item.action.href : undefined}
      preview={item.preview} active={active} title={item.title} />
  </span>
})
