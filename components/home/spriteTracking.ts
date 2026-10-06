// Direction selection from SpriteSamples/demo/components/tracking.ts.
// Viewer-relative angles and hysteresis keep adjacent photos from chattering.
export const SPRITE_DIRECTIONS = [
  'right', 'lower-right', 'down', 'lower-left',
  'left', 'upper-left', 'up', 'upper-right',
] as const
export type SpriteDirection = 'center' | (typeof SPRITE_DIRECTIONS)[number]

export function spriteDirection(x: number, y: number, previous: SpriteDirection = 'center'): SpriteDirection {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'center'
  if (Math.hypot(x, y) < (previous === 'center' ? 0.19 : 0.14)) return 'center'
  const tau = Math.PI * 2
  const sector = Math.PI / 4
  const angle = (Math.atan2(y, x) + tau) % tau
  if (previous !== 'center') {
    const oldAngle = SPRITE_DIRECTIONS.indexOf(previous) * sector
    const difference = Math.abs(((angle - oldAngle + Math.PI + tau) % tau) - Math.PI)
    if (difference < sector / 2 + (8 * Math.PI) / 180) return previous
  }
  return SPRITE_DIRECTIONS[Math.round(angle / sector) % 8]
}
