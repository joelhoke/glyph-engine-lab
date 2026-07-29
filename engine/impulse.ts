/**
 * One-shot radial impulse for click/tap blasts.
 *
 * Applies an instantaneous velocity kick to every particle within a radius,
 * pushing them away from the impact point with the same linear falloff the
 * hover repulsion uses (maximal at the center, zero at the edge). The
 * existing spring+damp integration then settles the field back on its own —
 * the impulse runs once per pointerdown, adds no per-frame work, and keeps
 * the simulation deterministic (no DOM, no randomness).
 */

type ImpulseParticle = {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Kicks every particle with `0 < dist < radius` away from (cx, cy).
 * Particles exactly at the center are skipped (no direction to push along).
 * Returns the number of affected particles.
 */
export function applyRadialImpulse(
  particles: ImpulseParticle[],
  cx: number,
  cy: number,
  radius: number,
  force: number,
): number {
  if (radius <= 0 || force === 0) return 0
  let affected = 0
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i]
    const dx = p.x - cx
    const dy = p.y - cy
    const distSq = dx * dx + dy * dy
    if (distSq <= 0 || distSq >= radius * radius) continue
    const dist = Math.sqrt(distSq)
    const kick = (1 - dist / radius) * force
    p.vx += (dx / dist) * kick
    p.vy += (dy / dist) * kick
    affected += 1
  }
  return affected
}
