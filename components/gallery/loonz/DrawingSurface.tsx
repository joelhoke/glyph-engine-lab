import { useRef, useState, type PointerEvent } from 'react'
import type { Vec2 } from './engine/types'
import styles from '../playground/playground.module.css'

interface Props {
  color: string
  onFinish(points: Vec2[]): void
}

export default function DrawingSurface({ color, onFinish }: Props) {
  const gesture = useRef<{ pointer: number; points: Vec2[] } | null>(null)
  const [line, setLine] = useState('')

  function sample(event: PointerEvent<SVGSVGElement>) {
    const stroke = gesture.current
    if (!stroke || stroke.pointer !== event.pointerId) return

    const rect = event.currentTarget.getBoundingClientRect()
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? []
    for (const point of [...samples, event.nativeEvent]) {
      const x = Math.max(0, Math.min(1, (point.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (point.clientY - rect.top) / rect.height))
      const last = stroke.points.at(-1)
      if (!last || Math.hypot((x - last[0]) * rect.width, (y - last[1]) * rect.height) >= 2) {
        stroke.points.push([x, y])
      }
    }
    if (stroke.points.length > 2000) {
      stroke.points = stroke.points.filter((_, index) => index % 2 === 0 || index === stroke.points.length - 1)
    }
    setLine(stroke.points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' '))
  }

  function clear() {
    gesture.current = null
    setLine('')
  }

  return <svg className={styles.drawing} viewBox="0 0 1000 1000" preserveAspectRatio="none"
    aria-label="Draw a balloon outline"
    onPointerDown={event => {
      if (event.button !== 0 || gesture.current) return
      event.currentTarget.setPointerCapture(event.pointerId)
      gesture.current = { pointer: event.pointerId, points: [] }
      sample(event)
    }}
    onPointerMove={sample}
    onPointerUp={event => {
      if (gesture.current?.pointer !== event.pointerId) return
      sample(event)
      const { points } = gesture.current
      clear()
      onFinish(points)
    }}
    onPointerCancel={event => { if (gesture.current?.pointer === event.pointerId) clear() }}
    onLostPointerCapture={event => { if (gesture.current?.pointer === event.pointerId) clear() }}
  >
    <polygon points={line} fill={color} fillOpacity=".24"/>
    <polyline points={line} fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    <polyline points={line} fill="none" stroke="#372951" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
  </svg>
}
