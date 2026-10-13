/** Midpoint of the Fibre Arc shader bundle, in CSS pixels (including uDir rotation). */
export type FibreArcClearance = { amount: number; floor: number }

/** A shallow lower shelf leaves the main screen available to content. Mirrors the shader. */
export function fibreArcClearanceBaseline(x: number, width: number, height: number, baseline: number,
  clearance: FibreArcClearance) {
  const edge = 2 * x / Math.max(1, width) - 1
  return baseline + ((clearance.floor - .025 * edge * edge) * height - baseline) * clearance.amount
}

export function fibreArcBaseline(x: number, width: number, height: number, curve: number,
  apex: readonly [number, number], direction = 0) {
  if (height <= 0) return 0
  const angle = direction * Math.PI / 180
  const c = Math.cos(angle), s = Math.sin(angle), k = curve / 100 * 1.25
  const px = (x - width / 2) / height
  // q = rotate(p): q.y = apex.y - k * (q.x - apex.x)^2.
  const dx = c * px - apex[0]
  const a = k * s * s, b = c - 2 * k * s * dx
  const d = k * dx * dx + s * px - apex[1]
  const discriminant = b * b - 4 * a * d
  if (discriminant < 0) return height / 2
  const denominator = b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant)
  const py = Math.abs(denominator) > 1e-9 ? -2 * d / denominator : 0
  return height * (0.5 - py)
}
