export type ScreenPoint = { x: number; y: number }

/** CSS homography from an untransformed DOM rectangle to a projected LCD.
 *  Corners must be in TL, TR, BR, BL order, in host-local CSS pixels. */
export function screenProjection(corners: ScreenPoint[], width: number, height: number): number[] | null {
  if (corners.length !== 4 || width <= 0 || height <= 0) return null
  if (corners.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null
  const [p0, p1, p2, p3] = corners
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y
  const dx3 = p0.x - p1.x + p2.x - p3.x
  const dy3 = p0.y - p1.y + p2.y - p3.y
  const det = dx1 * dy2 - dx2 * dy1
  if (Math.abs(det) < 0.00001) return null
  const g = (dx3 * dy2 - dx2 * dy3) / det
  const h = (dx1 * dy3 - dx3 * dy1) / det
  return [
    (p1.x - p0.x + g * p1.x) / width, (p1.y - p0.y + g * p1.y) / width, 0, g / width,
    (p3.x - p0.x + h * p3.x) / height, (p3.y - p0.y + h * p3.y) / height, 0, h / height,
    0, 0, 1, 0, p0.x, p0.y, 0, 1,
  ]
}
