'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { useSystemTheme } from '../engine/useSystemTheme'
import { getProjectPreview } from '../content/projectPreviews'
import styles from './ProjectThumbnail.module.css'

/** Shared by gallery, homepage, collection cards and linked case-study teasers. */
export default memo(function ProjectThumbnail({ src, href, preview, active, alt = '', title = '', className = '', aspectRatio }: {
  src: string; href?: string; preview?: string; active?: boolean; alt?: string; title?: string; className?: string; aspectRatio?: string
}) {
  const media = getProjectPreview(href, src)
  const lightPoster = media?.poster ?? src, darkPoster = media?.darkPoster ?? lightPoster
  const theme = useSystemTheme()
  const videoSrc = theme === 'dark' && media?.darkPoster ? media.darkVideo : media?.video ?? preview
  const root = useRef<HTMLSpanElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false), [motion, setMotion] = useState(false), [pageVisible, setPageVisible] = useState(true)
  const [failedImage, setFailedImage] = useState(''), [failedVideo, setFailedVideo] = useState(''), [readyVideo, setReadyVideo] = useState('')
  const selectedPoster = theme === 'light' ? lightPoster : darkPoster
  const playing = (active ?? (hovered || focused)) && visible && motion && pageVisible

  useEffect(() => {
    const node = root.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(node)
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setMotion(!query.matches)
    const updateVisibility = () => setPageVisible(!document.hidden)
    updateMotion(); updateVisibility()
    query.addEventListener('change', updateMotion)
    document.addEventListener('visibilitychange', updateVisibility)
    // The entire link/button activates the thumbnail, including its title.
    const trigger = node.closest('a, button') ?? node
    const enter = () => setHovered(true), leave = () => setHovered(false)
    const focus = () => setFocused(true), blur = () => setFocused(false)
    if (active === undefined) {
      trigger.addEventListener('pointerenter', enter); trigger.addEventListener('pointerleave', leave)
      trigger.addEventListener('focusin', focus); trigger.addEventListener('focusout', blur)
    }
    return () => {
      observer.disconnect(); query.removeEventListener('change', updateMotion)
      document.removeEventListener('visibilitychange', updateVisibility)
      trigger.removeEventListener('pointerenter', enter); trigger.removeEventListener('pointerleave', leave)
      trigger.removeEventListener('focusin', focus); trigger.removeEventListener('focusout', blur)
    }
  }, [active === undefined])

  useEffect(() => {
    // A paused preview keeps its last decoded frame; leaving the viewport or
    // changing the media/theme releases it and restores the matching poster.
    setReadyVideo('')
  }, [videoSrc, visible, motion])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !playing || !videoSrc || failedVideo === videoSrc) return
    let live = true
    video.play().catch(() => { if (live) setFailedVideo(videoSrc) })
    return () => { live = false; video.pause() }
  }, [playing, videoSrc, failedVideo])

  return <span ref={root} className={`${styles.root} ${className} ${playing && (!videoSrc || failedVideo === videoSrc) ? styles.drift : ''}`}
    style={aspectRatio ? { aspectRatio, height: 'auto' } : undefined}>
    <span className={styles.fallback} aria-hidden="true">{title}</span>
    {failedImage !== selectedPoster && <picture>
      {lightPoster !== darkPoster && <source media="(prefers-color-scheme: light)" srcSet={lightPoster} />}
      <img src={darkPoster} alt={alt} loading="lazy" decoding="async" draggable={false} onError={() => setFailedImage(selectedPoster)} />
    </picture>}
    {visible && motion && (playing || readyVideo === videoSrc) && videoSrc && failedVideo !== videoSrc && <video key={videoSrc} ref={videoRef} src={videoSrc} muted loop playsInline preload="none"
      aria-hidden="true" onPlaying={() => setReadyVideo(videoSrc)} onError={() => setFailedVideo(videoSrc)} style={{ opacity: readyVideo === videoSrc ? 1 : 0 }} />}
  </span>
})
