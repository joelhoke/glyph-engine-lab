'use client'

import { RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { WorkMedia } from '../../content/work'

type WorkMediaLightboxProps = {
  /** Full ordered media collection for the story. */
  media: WorkMedia[]
  /** Index of the item shown first. */
  startIndex: number
  /** Story title — used to label the dialog. */
  storyTitle: string
  onClose: () => void
  /** Element that opened the dialog; focus returns to it on close. */
  triggerRef: RefObject<HTMLElement | null>
}

const EMBED_SRC: Record<'youtube' | 'vimeo', (videoId: string) => string> = {
  youtube: (videoId) => `https://www.youtube-nocookie.com/embed/${videoId}`,
  vimeo: (videoId) => `https://player.vimeo.com/video/${videoId}`,
}

/**
 * Accessible full-screen media dialog: focus-trapped, Escape closes,
 * previous/next via buttons and arrow keys, trigger focus restored on close,
 * and hosted video pauses/resets whenever it leaves view. Third-party embeds
 * load their iframe only after an explicit click.
 */
export default function WorkMediaLightbox({
  media,
  startIndex,
  storyTitle,
  onClose,
  triggerRef,
}: WorkMediaLightboxProps) {
  const [index, setIndex] = useState(startIndex)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const item = media[index]

  const resetVideo = useCallback(() => {
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
    }
  }, [])

  const goTo = useCallback(
    (next: number) => {
      if (media.length === 0) return
      resetVideo()
      setIndex(((next % media.length) + media.length) % media.length)
    },
    [media.length, resetVideo],
  )

  const handleClose = useCallback(() => {
    resetVideo()
    onClose()
  }, [onClose, resetVideo])

  // Initial focus into the dialog; trigger focus restored on unmount.
  useEffect(() => {
    closeButtonRef.current?.focus()
    const trigger = triggerRef.current
    return () => {
      trigger?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard: Escape, arrows, and a Tab focus trap scoped to the dialog.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
        return
      }
      if (event.key === 'ArrowLeft' && media.length > 1) {
        event.preventDefault()
        goTo(index - 1)
        return
      }
      if (event.key === 'ArrowRight' && media.length > 1) {
        event.preventDefault()
        goTo(index + 1)
        return
      }
      if (event.key === 'Tab') {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], video[controls], iframe, [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    dialog.addEventListener('keydown', handleKeyDown)
    return () => dialog.removeEventListener('keydown', handleKeyDown)
  }, [goTo, handleClose, index, media.length])

  if (!item) return null

  // Portal to document.body: rendered inline, the fixed backdrop would be
  // trapped by .work-experience's backdrop-filter (any ancestor filter/
  // backdrop-filter/transform becomes the containing block for fixed
  // descendants), binding the overlay to the slide instead of the viewport.
  return createPortal(
    <div className="work-lightbox-backdrop" onClick={handleClose}>
      <div
        ref={dialogRef}
        className="work-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={`${storyTitle} media ${index + 1} of ${media.length}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="work-lightbox-header">
          <p className="work-lightbox-progress" aria-live="polite">
            {index + 1} / {media.length}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            className="work-lightbox-close"
            onClick={handleClose}
            aria-label="Close media viewer"
          >
            ✕
          </button>
        </div>
        <div className="work-lightbox-stage">
          <LightboxItem key={item.id} item={item} videoRef={videoRef} />
        </div>
        {item.caption && <p className="work-lightbox-caption">{item.caption}</p>}
        {media.length > 1 && (
          <div className="work-lightbox-controls">
            <button
              type="button"
              className="work-nav-button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous media"
            >
              <span aria-hidden="true">←</span> Prev
            </button>
            <button
              type="button"
              className="work-nav-button"
              onClick={() => goTo(index + 1)}
              aria-label="Next media"
            >
              Next <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function LightboxItem({
  item,
  videoRef,
}: {
  item: WorkMedia
  videoRef: RefObject<HTMLVideoElement | null>
}) {
  const [embedActive, setEmbedActive] = useState(false)

  if (item.kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="work-lightbox-media"
        src={item.src}
        width={item.width}
        height={item.height}
        alt={item.alt}
        loading="lazy"
      />
    )
  }

  if (item.kind === 'video') {
    return (
      <video
        ref={videoRef as RefObject<HTMLVideoElement>}
        className="work-lightbox-media"
        src={item.src}
        poster={item.poster}
        width={item.width}
        height={item.height}
        controls
        preload="none"
        aria-label={item.alt}
      >
        {item.captionsSrc && (
          <track kind="captions" src={item.captionsSrc} label="English captions" default />
        )}
      </video>
    )
  }

  // Third-party embed: facade first, iframe only after explicit interaction.
  if (!embedActive) {
    return (
      <button
        type="button"
        className="work-embed-facade"
        onClick={() => setEmbedActive(true)}
        aria-label={`Play ${item.title} on ${item.provider === 'youtube' ? 'YouTube' : 'Vimeo'}`}
      >
        <span aria-hidden="true">▶</span> Load {item.title}
      </button>
    )
  }
  return (
    <iframe
      className="work-lightbox-embed"
      src={EMBED_SRC[item.provider](item.videoId)}
      title={item.title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  )
}
