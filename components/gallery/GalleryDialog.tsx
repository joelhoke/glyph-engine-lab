'use client'

import { useEffect, useRef, useState } from 'react'
import type { GalleryArtwork, GalleryItem } from './galleryTypes'
import { GALLERY_PALETTES } from '../../content/galleryArtwork'
import PixelArtwork from './PixelArtwork'
import styles from './sphere.module.css'

export type GallerySelection = { artwork: GalleryArtwork } | { item: GalleryItem }
export default function GalleryDialog({ selection, onClose, trigger, reduced, visible }: {
  selection: GallerySelection; onClose: () => void; trigger: HTMLElement | null; reduced: boolean; visible: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const artwork = 'artwork' in selection ? selection.artwork : null
  const item = 'item' in selection ? selection.item : null
  const media = item?.action.kind === 'media' ? item.action.media : null
  const href = item?.action.kind === 'link' ? item.action.href : null
  const palette = artwork ? GALLERY_PALETTES[artwork.palette] : null
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = before; dialog?.close(); trigger?.focus({ preventScroll: true })
    }
  }, [trigger])
  useEffect(() => { if (!visible) videoRef.current?.pause() }, [visible])
  useEffect(() => {
    const message = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frameRef.current?.contentWindow) return
      if (event.data?.type === 'gallery:close') onClose()
      if (event.data?.type === 'gallery:escape') {
        if (expanded) setExpanded(false)
        else onClose()
      }
    }
    window.addEventListener('message', message)
    return () => { window.removeEventListener('message', message) }
  }, [onClose, expanded])
  const toggleFullscreen = () => setExpanded(value => !value)
  return <dialog className={styles.dialog} data-experience={!!href} data-expanded={expanded} ref={ref} aria-labelledby="gallery-preview-title" onCancel={e => {
    e.preventDefault(); if (expanded) void toggleFullscreen(); else onClose()
  }}
    onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <section className={styles.dialogBody}>
      <header><div><p>{artwork ? 'Generative study' : item?.category}</p>
        <h2 id="gallery-preview-title">{palette ? `${palette.name} / ${String(artwork!.seed).slice(-4)}` : item?.title}</h2></div>
        <button autoFocus type="button" onClick={onClose} aria-label="Close preview">Close <span aria-hidden="true">×</span></button>
      </header>
      <div className={styles.dialogStage}>
        {href && <>
          {!loaded && <p className={styles.viewerLoading} role="status">Opening {item?.title}…</p>}
          <iframe ref={frameRef} className={styles.experienceFrame} title={item!.title}
            src={`${href}${href.includes('?') ? '&' : '?'}gallery-embed=1`} allowFullScreen
            onLoad={() => setLoaded(true)} />
        </>}
        {artwork && <PixelArtwork artwork={artwork} active={!reduced && visible} interactive />}
        {media?.kind === 'image' && <img src={media.src} alt={media.alt} />}
        {media?.kind === 'video' && <video ref={videoRef} src={media.src} poster={media.poster} controls playsInline autoPlay={!reduced}>
          {media.captionsSrc && <track kind="captions" src={media.captionsSrc} label="English" srcLang="en" />}
        </video>}
      </div>
      <footer>
        {palette && <><p>Move or drag to bend the glyphs. Click or press Space to ripple.</p>
          <div className={styles.swatches}>{palette.colors.map(color => <span key={color} style={{ background: color }} title={color}><span className={styles.srOnly}>{color}</span></span>)}</div></>}
        {media && 'caption' in media && <p>{media.caption}</p>}
        {media && 'captionAction' in media && media.captionAction && <a href={media.captionAction.href}>{media.captionAction.label} ↗</a>}
      </footer>
      <button type="button" className={styles.fullscreenButton} onClick={() => void toggleFullscreen()}
        aria-label={expanded ? 'Exit fullscreen' : 'Enter fullscreen'} title={expanded ? 'Exit fullscreen' : 'Enter fullscreen'}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d={expanded ? 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5'} />
        </svg>
      </button>
    </section>
  </dialog>
}
