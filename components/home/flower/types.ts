export type FlowerVariety = 'original' | 'plumeria' | 'rose' | 'daisy' | 'cherry'
export type FlowerSettings = {
  variety: FlowerVariety
  target: FlowerVariety
  petals: number
  length: number
  bend: number
}

export type FlowerGradientSettings = {
  palette: readonly string[]
  mode: 'bands' | 'radial' | 'noise'
  scope: 'element' | 'object'
  scale: number
  softness: number
  direction: number
  phase: number
  speed: number
  noise: number
}
