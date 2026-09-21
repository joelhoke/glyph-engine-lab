'use client'

import { forwardRef, useEffect, useState } from 'react'

const decoded = new Set<string>()
const pending = new Map<string, Promise<void>>()

/** Share decoded frames between gaze tracking and the crossfade layers. */
export function decodeSpriteFrame(src: string): Promise<void> {
  if (decoded.has(src)) return Promise.resolve()
  if (pending.has(src)) return pending.get(src)!
  const image = new Image()
  image.src = src
  const ready = image.decode().then(() => { decoded.add(src) }).finally(() => { pending.delete(src) })
  pending.set(src, ready)
  return ready
}

/** One motion wrapper keeps both appearances on exactly the same pose. */
const HomeSpriteFrame = forwardRef<HTMLSpanElement, {
  src: string; watercolorSrc?: string; alt: string; width: number; height: number
  className: string; fetchPriority?: 'high' | 'low' | 'auto'
  'data-direction'?: string; 'data-pose'?: string
}>(function HomeSpriteFrame({ src, watercolorSrc, alt, width, height, fetchPriority, ...props }, ref) {
  const [readySource, setReadySource] = useState<string | null>(null)
  useEffect(() => {
    if (!watercolorSrc) return
    let cancelled = false
    void decodeSpriteFrame(watercolorSrc).then(() => {
      if (!cancelled) setReadySource(watercolorSrc)
    }).catch(() => { /* Keep the monotone image when watercolor is unavailable. */ })
    return () => { cancelled = true }
  }, [watercolorSrc])
  const ready = Boolean(watercolorSrc && (readySource === watercolorSrc || decoded.has(watercolorSrc)))
  return <span {...props} ref={ref} role={alt ? 'img' : undefined} aria-label={alt || undefined} data-watercolor-ready={ready}>
    <img className="home-sprite-base" src={src} width={width} height={height} alt="" draggable={false} fetchPriority={fetchPriority} />
    {watercolorSrc && <img className="home-sprite-watercolor" src={watercolorSrc} width={width} height={height} alt="" draggable={false} />}
  </span>
})

export default HomeSpriteFrame
