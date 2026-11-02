import { STATEMENT_FLOWER } from './statementFlower'
import type { FlowerGradientSettings } from '../components/home/flower/types'

export const GRADIENT_PLAYGROUND = {
  sequence: ['plumeria', 'rose', 'daisy', 'cherry'] as const,
  flowerLabels: ['Plumeria', 'Rose', 'Daisy', 'Cherry blossom'],
  segmentHold: 0.15, // Hold each end for 15% of its segment; morph through the middle 70%.
  gradient: { ...STATEMENT_FLOWER.gradient, palette: [...STATEMENT_FLOWER.palette] } satisfies FlowerGradientSettings,
  travelSeconds: 16, // One direction; the return takes another 16 seconds.
  viewHeight: 4.8,
  minViewWidth: 3.6,
  target: [0, 0, 0] as const,
}

export const GRADIENT_TYPES = [
  { value: 'bands', label: 'Bands' },
  { value: 'radial', label: 'Radial' },
  { value: 'noise', label: 'Noise' },
] as const
