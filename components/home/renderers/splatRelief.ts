/** Trace the PNG's alpha contour into shallow side walls. Marching squares
 *  interpolates the edge between pixels, preserving splashes and holes
 *  without a stack of transparent planes or per-frame work. */
export function splatSidePositions(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  size: number,
  depth: number,
  threshold = 0.18,
): number[] {
  const positions: number[] = []
  const alpha = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : rgba[(y * width + x) * 4 + 3] / 255
  // Corners clockwise from top-left; edges top, right, bottom, left.
  const pairs: Record<number, number[][]> = {
    1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]],
    5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]],
    8: [[2, 3]], 9: [[2, 0]], 10: [[0, 1], [2, 3]],
    11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]],
  }
  for (let y = -1; y < height; y += 1) {
    for (let x = -1; x < width; x += 1) {
      const values = [alpha(x, y), alpha(x + 1, y), alpha(x + 1, y + 1), alpha(x, y + 1)]
      const mask = values.reduce((bits, value, corner) => bits | (value >= threshold ? 1 << corner : 0), 0)
      const segments = pairs[mask]
      if (!segments) continue
      const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]
      const point = (edge: number) => {
        const next = (edge + 1) % 4
        const t = (threshold - values[edge]) / (values[next] - values[edge])
        const px = corners[edge][0] + (corners[next][0] - corners[edge][0]) * t
        const py = corners[edge][1] + (corners[next][1] - corners[edge][1]) * t
        return [((px + 0.5) / width - 0.5) * size, (0.5 - (py + 0.5) / height) * size]
      }
      for (const [from, to] of segments) {
        const [ax, ay] = point(from)
        const [bx, by] = point(to)
        positions.push(
          ax, ay, 0, bx, by, 0, ax, ay, -depth,
          bx, by, 0, bx, by, -depth, ax, ay, -depth,
        )
      }
    }
  }
  return positions
}
