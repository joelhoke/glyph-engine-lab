'use client'

import { useEffect, useRef, useState } from 'react'
import JHMark from '../JHMark'

type Contour = { points: [number, number][]; holes: [number, number][][] }

/** Rasterize the actual Logo Studio silhouette into a small LCD pixel grid.
 *  One paint, no animation loop; enlarged with nearest-neighbor pixels. */
export default function PhoneStandbyMark() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/assets/home/logo-studio-shapes.json', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Logo unavailable'); return response.json() as Promise<Contour[]> })
      .then(contours => {
        const ctx = ref.current?.getContext('2d')
        if (!ctx || controller.signal.aborted) return
        ctx.clearRect(0, 0, 40, 48)
        ctx.fillStyle = '#8abaff'
        for (const contour of contours) {
          ctx.beginPath()
          for (const ring of [contour.points, ...contour.holes]) {
            ring.forEach(([x, y], i) => {
              const px = Math.round(20 + x * 36), py = Math.round(24 - y * 42)
              if (i === 0) ctx.moveTo(px, py)
              else ctx.lineTo(px, py)
            })
            ctx.closePath()
          }
          ctx.fill('evenodd')
        }
        setReady(true)
      }).catch(() => { /* The inline mark remains available if its contour file cannot load. */ })
    return () => controller.abort()
  }, [])
  return <span className="home-phone-standby-mark" role="img" aria-label="JH logo on a pixel display">
    {!ready && <JHMark aria-hidden="true" />}
    <canvas ref={ref} width={40} height={48} aria-hidden="true" style={{ opacity: ready ? 1 : 0 }} />
  </span>
}
