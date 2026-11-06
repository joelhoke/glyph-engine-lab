import { DAMP, SPRING } from './constants'

export type GlyphParticle = { x: number; y: number; tx: number; ty: number; vx: number; vy: number }
export type GlyphPointer = { x: number; y: number; active: boolean; influence: number }

/** Shared hero / case-study spring and hover response. Units and integration order are unchanged. */
export function stepGlyphParticle(p: GlyphParticle, pointer: GlyphPointer | null, radius: number, repel: number) {
  if (pointer?.active && pointer.influence > 0) {
    const dx = p.x - pointer.x, dy = p.y - pointer.y
    const distSq = dx * dx + dy * dy
    if (distSq > 0 && distSq < radius * radius) {
      const dist = Math.sqrt(distSq)
      const strength = (1 - dist / radius) * repel * pointer.influence
      p.vx += (dx / dist) * strength
      p.vy += (dy / dist) * strength
    }
  }
  p.vx += (p.tx - p.x) * SPRING
  p.vy += (p.ty - p.y) * SPRING
  p.vx *= DAMP
  p.vy *= DAMP
  p.x += p.vx
  p.y += p.vy
}
