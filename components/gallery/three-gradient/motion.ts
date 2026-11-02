import { GRADIENT_PLAYGROUND } from '../../../content/gradientPlayground'

export type AnimationMode = 'time' | 'scroll'

const clamp = (value: number) => Math.max(0, Math.min(1, value))

/** Normal document scroll across the distance available to the sticky stage. */
export function scrollFlowerProgress(trackTop: number, trackHeight: number, stageHeight: number, stickyTop: number) {
  return clamp((stickyTop - trackTop) / Math.max(1, trackHeight - stageHeight))
}

/** A reflected 0→1→0 timeline keeps the final flower continuous at each turn-around. */
export function advanceFlowerProgress(progress: number, direction: 1 | -1, delta: number, seconds: number) {
  const phase = direction === 1 ? progress : 2 - progress
  const next = ((phase + Math.max(0, delta) / Math.max(1, seconds)) % 2 + 2) % 2
  return { progress: next <= 1 ? next : 2 - next, direction: (next < 1 ? 1 : -1) as 1 | -1 }
}

export function playgroundFlowerProgress(progress: number) {
  const segments = GRADIENT_PLAYGROUND.sequence.length - 1
  const scaled = clamp(progress) * segments
  const index = Math.min(segments - 1, Math.floor(scaled))
  const hold = GRADIENT_PLAYGROUND.segmentHold
  const t = clamp((scaled - index - hold) / (1 - hold * 2))
  return { index, amount: t * t * (3 - 2 * t) }
}

export function flowerPositionLabel(progress: number) {
  const { index, amount } = playgroundFlowerProgress(progress)
  const labels = GRADIENT_PLAYGROUND.flowerLabels
  if (amount === 0) return labels[index]
  if (amount === 1) return labels[index + 1]
  return `${labels[index]} → ${labels[index + 1]}`
}
