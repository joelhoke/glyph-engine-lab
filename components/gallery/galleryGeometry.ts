import type { GalleryArtwork, GalleryLayout } from './galleryTypes'
import { GALLERY_PALETTES } from '../../content/galleryArtwork'

export type Point = { x: number; y: number }
export type GallerySlot = { id: string; x: number; y: number; w: number; h: number; itemIndex?: number; artwork?: GalleryArtwork }
export type GalleryPattern = { width: number; height: number; slots: GallerySlot[] }
export const wrap = (value: number, period: number) => ((value % period) + period) % period

/** A 4 × 3 motif, tiled without holes. The first tile spans four cells. */
const mixed = [[0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 1], [2, 1, 1, 1], [3, 1, 1, 1],
  [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1], [3, 2, 1, 1]]

export function galleryPattern(count: number, layout: GalleryLayout): GalleryPattern {
  const columns = layout === 'regular' ? 6 : 8
  const blockSize = layout === 'regular' ? 6 : 18
  const total = Math.ceil(Math.max(24, count * 2) / blockSize) * blockSize
  let artworkIndex = 0
  const slots: GallerySlot[] = Array.from({ length: total }, (_, i) => {
    let x: number, y: number, w: number, h: number
    if (layout === 'regular') { x = i % columns; y = Math.floor(i / columns); w = h = 1 }
    else {
      const motif = mixed[i % mixed.length]
      x = motif[0] + (Math.floor(i / 9) % 2) * 4
      y = motif[1] + Math.floor(i / 18) * 3
      w = motif[2]; h = motif[3]
    }
    // Distribute the work across the entire period, including its wrap seam.
    const itemIndex = Math.floor(i * count / total)
    const real = count > 0 && itemIndex !== Math.floor((i - 1) * count / total)
    return { id: `slot-${i}`, x, y, w, h, ...(real ? { itemIndex } : {
      artwork: { seed: 104729 + i * 7919, palette: artworkIndex++ % GALLERY_PALETTES.length },
    }) }
  })
  return { width: columns, height: layout === 'regular' ? total / columns : total / 18 * 3, slots }
}

export function galleryMetrics(width: number, layout: GalleryLayout) {
  const cell = layout === 'regular' ? Math.max(210, Math.min(310, width / 4.3)) : Math.max(150, Math.min(215, width / 6))
  return { cellX: cell, cellY: cell * 0.75, gap: width < 600 ? 14 : 24 }
}

/** One continuous sphere cap, including perspective. Shared coordinates keep
 * neighbouring corners on the same surface instead of overlapping tangent cards. */
export function projectTile(x: number, y: number, width: number, height: number) {
  const radius = Math.max(900, width * 1.2, height * 1.4)
  const depth = radius / Math.hypot(radius, x, y)
  const z = radius * (depth - 1)
  const perspective = 1600 / (1600 - z)
  return { x: x * depth * perspective, y: y * depth * perspective, z }
}

export function projectedCorners(x: number, y: number, w: number, h: number, width: number, height: number) {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) =>
    projectTile(x + sx * w / 2, y + sy * h / 2, width, height))
}

/** Homography from the HTML rectangle to its four projected surface corners.
 * CSS applies this once; adding another perspective would distort the gaps. */
export function tileTransform(x: number, y: number, w: number, h: number, width: number, height: number) {
  const [a, b, c, d] = projectedCorners(x, y, w, h, width, height)
  const dx1 = b.x - c.x, dx2 = d.x - c.x, dx3 = a.x - b.x + c.x - d.x
  const dy1 = b.y - c.y, dy2 = d.y - c.y, dy3 = a.y - b.y + c.y - d.y
  const determinant = dx1 * dy2 - dx2 * dy1
  const g = (dx3 * dy2 - dx2 * dy3) / determinant
  const k = (dx1 * dy3 - dx3 * dy1) / determinant
  return `matrix3d(${[(b.x - a.x + g * b.x) / w, (b.y - a.y + g * b.y) / w, 0, g / w,
    (d.x - a.x + k * d.x) / h, (d.y - a.y + k * d.y) / h, 0, k / h,
    0, 0, 1, 0, a.x, a.y, 0, 1].join(',')})`
}

export function diagonalWheel(deltaX: number, deltaY: number, mode: number, height: number) {
  const pixels = (deltaY !== 0 ? deltaY : deltaX) * (mode === 1 ? 16 : mode === 2 ? height : 1)
  // Preserve the ratio and direction, while bounding pathological devices/events.
  const distance = Math.max(-600, Math.min(600, pixels)) / Math.SQRT2
  return { x: distance, y: distance }
}

/** WheelEvent has no portable device identity. Recognize two-axis/precision
 * pixel input and remember it so a trackpad's later vertical-only swipes and
 * momentum tail do not suddenly switch to diagonal navigation. Discrete
 * vertical wheels (including line/page units) retain the diagonal shortcut. */
export function createGalleryWheelInput() {
  let directionalPixels = false
  return (deltaX: number, deltaY: number, mode: number, height: number): Point => {
    if (!deltaX && !deltaY) return { x: 0, y: 0 }
    if (mode !== 0) directionalPixels = false
    else if (deltaX !== 0 || Math.abs(deltaY) < 40 || !Number.isInteger(deltaY)) directionalPixels = true
    if (deltaX === 0 && !directionalPixels) return diagonalWheel(deltaX, deltaY, mode, height)
    const unit = mode === 1 ? 16 : mode === 2 ? height : 1
    const x = deltaX * unit, y = deltaY * unit
    // Bound pathological input without changing the swipe's angle.
    const scale = Math.min(1, 600 / Math.hypot(x, y))
    return { x: x * scale, y: y * scale }
  }
}

/** Invert the same projective plane used by CSS, so edge-tile pointer hits stay aligned. */
export function unprojectTilePoint(m: readonly number[], x: number, y: number) {
  const a = m[0] - x * m[3], b = m[4] - x * m[7]
  const c = m[1] - y * m[3], d = m[5] - y * m[7]
  const u = x * m[15] - m[12], v = y * m[15] - m[13]
  const determinant = a * d - b * c
  return { x: (u * d - b * v) / determinant, y: (a * v - u * c) / determinant }
}

export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296 }
}

export function visibleTiles(pattern: GalleryPattern, position: Point, width: number, height: number, layout: GalleryLayout) {
  const { cellX, cellY, gap } = galleryMetrics(width, layout)
  const periodX = pattern.width * cellX, periodY = pattern.height * cellY
  const tiles: (GallerySlot & { key: string; left: number; top: number; width: number; height: number; distance: number })[] = []
  const px = wrap(position.x, periodX), py = wrap(position.y, periodY)
  // Coordinates wrap for precision; identity follows the unwrapped world.
  // Recycling local cycle keys at zero otherwise swaps every visible tile.
  const cycleX = Math.round((position.x - px) / periodX), cycleY = Math.round((position.y - py) / periodY)
  const marginX = width * 0.8 + cellX * 2, marginY = height * 0.8 + cellY * 2
  for (const slot of pattern.slots) {
    const centerX = (slot.x + slot.w / 2) * cellX - cellX / 2
    const centerY = (slot.y + slot.h / 2) * cellY - cellY / 2
    const minX = Math.ceil((px - marginX - centerX) / periodX), maxX = Math.floor((px + marginX - centerX) / periodX)
    const minY = Math.ceil((py - marginY - centerY) / periodY), maxY = Math.floor((py + marginY - centerY) / periodY)
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
      const left = centerX + cx * periodX - px, top = centerY + cy * periodY - py
      tiles.push({ ...slot, key: `${slot.id}:${cx + cycleX}:${cy + cycleY}`, left, top, width: slot.w * cellX - gap,
        height: slot.h * cellY - gap, distance: Math.hypot(left, top) })
    }
  }
  return tiles
}
