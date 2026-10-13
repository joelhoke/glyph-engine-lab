/** Shared continuous magnification; use fixed centers to avoid chasing moving targets. */
export function magnificationWeights(position: number | null, count: number, reach = 1.75): number[] {
  return Array.from({ length: count }, (_, index) => {
    if (position === null) return 0
    const distance = Math.abs(index - position)
    return distance >= reach ? 0 : Math.cos(distance / reach * Math.PI / 2) ** 2
  })
}
export function magnificationPosition(clientX: number, centerX: number, gap: number, count: number): number {
  return Math.max(0, Math.min(count - 1, (count - 1) / 2 + (clientX - centerX) / Math.max(1, gap)))
}
