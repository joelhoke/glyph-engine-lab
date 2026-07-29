type Particle = {
  char: string
  tx: number
  ty: number
  x: number
  y: number
  vx: number
  vy: number
  hue: number
  row: number
  head: boolean
  homeX?: number
  homeY?: number
  speed?: number
  drift?: number
  alpha?: number
  sway?: number
  swaySpeed?: number
  swayAmp?: number
  phase?: number
  size?: number
  streak?: number
}

type ParagraphTarget = {
  char: string
  tx: number
  ty: number
  row: number
  hue: number
}

type SequencePhase = 'logo' | 'hold' | 'release' | 'ambient'

type MeshBgs = {
  clear: HTMLCanvasElement
  rain: HTMLCanvasElement
  storm: HTMLCanvasElement
  wind: HTMLCanvasElement
  fog: HTMLCanvasElement
  snow: HTMLCanvasElement
}

type UnassignedGlyphBehavior = 'hidden' | 'parked' | 'ambient' | 'dispersed'

type ExperienceSceneKey = 'work' | 'vibe' | 'collaborate'

type ExperienceMode = 'intro' | ExperienceSceneKey

export type {
  ExperienceMode,
  ExperienceSceneKey,
  MeshBgs,
  ParagraphTarget,
  Particle,
  SequencePhase,
  UnassignedGlyphBehavior,
}
