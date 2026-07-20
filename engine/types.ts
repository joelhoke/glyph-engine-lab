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

type Column = {
  x: number
  speed: number
  phase: number
  sway: number
  headRow: number
  rowsPerColumn: number
}

type Slot = { stream: number; row: number }

type MeshBgs = {
  clear: HTMLCanvasElement
  rain: HTMLCanvasElement
  storm: HTMLCanvasElement
  wind: HTMLCanvasElement
  fog: HTMLCanvasElement
  snow: HTMLCanvasElement
}

type ObjBounds = { cx: number; cy: number; hw: number; hh: number }

type TextPreset = 'clear' | 'rain' | 'storm' | 'snow' | 'blizzard' | 'fog' | 'wind'

type UnassignedGlyphBehavior = 'hidden' | 'parked' | 'ambient' | 'dispersed'

type ExperienceMode = 'portfolio' | 'playground'

export type {
  Column,
  ExperienceMode,
  MeshBgs,
  ObjBounds,
  ParagraphTarget,
  Particle,
  SequencePhase,
  Slot,
  TextPreset,
  UnassignedGlyphBehavior,
}
