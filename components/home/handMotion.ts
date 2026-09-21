// Original SpriteSamples drift, local repulsion, tilt and flex hysteresis.
export type HandPoint = { x: number; y: number }
export type HandPose = HandPoint & { tilt: number }

export function handPose(pointer: HandPoint | null, center: HandPoint, gaze: HandPoint, radius: number, side: -1 | 1): HandPose {
  if (!pointer) return { x: 0, y: 0, tilt: 0 }
  const strength = 0.8
  const magnitude = Math.max(1, Math.hypot(gaze.x, gaze.y))
  const dx = center.x - pointer.x, dy = center.y - pointer.y
  const distance = Math.hypot(dx, dy)
  const influence = Math.pow(Math.max(0, 1 - distance / radius), 2)
  const x = distance > 0.01 ? dx / distance : side
  const y = distance > 0.01 ? dy / distance : 0
  return {
    x: gaze.x / magnitude * 4 * strength + x * 8 * influence * strength,
    y: gaze.y / magnitude * 4 * strength + y * 8 * influence * strength,
    tilt: Math.max(-7, Math.min(7, gaze.x * 2 + x * influence * 5)) * strength,
  }
}

export function handIsFlexed(pointer: HandPoint | null, center: HandPoint, radius: number, previous: boolean): boolean {
  return pointer !== null && Math.hypot(pointer.x - center.x, pointer.y - center.y) < radius * (previous ? 0.8 : 0.6)
}

export function stepHandMotion(current: number, target: number, elapsedMs: number): number {
  const next = current + (target - current) * (1 - Math.exp(-Math.max(0, Math.min(elapsedMs, 64)) / 95))
  return Math.abs(target - next) < 0.005 ? target : next
}
