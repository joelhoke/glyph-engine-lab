import type { PlaygroundEngine } from '../playground/usePlayground'

export type ShapeKind = 'sphere' | 'pyramid' | 'cube'
export type WaterSettings = {
  colors: string[]
  waves: number
  speed: number
  intensity: number
  exposure: number
  bloom: number
  radius: number
  view: string
  tool: string
  shape: ShapeKind
  lightTheme: boolean
}
export type ShapeList = { items: { id: number; kind: ShapeKind }[]; selected: number | null }
export interface WaterEngine extends PlaygroundEngine<WaterSettings> {
  cancelPending(): void
  addShape(): void
  selectShape(id: number): void
  removeShape(): void
  clearShapes(): void
}
export function createDarkWater(canvas: HTMLCanvasElement, settings: WaterSettings, fail: (message: string) => void, onShapes: (list: ShapeList) => void, record: (restore: () => void) => void): WaterEngine
