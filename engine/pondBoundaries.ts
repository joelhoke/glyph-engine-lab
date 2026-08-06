/**
 * Pond hard viewport boundaries (debug-only "Private Pond" experiment):
 * while the pond is enabled, every visible, spring-tethered main glyph
 * center stays inside the CSS-pixel canvas bounds and rebounds inward off
 * the edges, scaled by the incoming wall-normal speed. Ambient weather /
 * matrix particles are never touched.
 *
 * Each axis resolves independently: an escaped position clamps to the
 * boundary (glyph centers may reach the exact edge), and only an outward-
 * moving velocity component reflects — with the inward sign, tangential
 * component preserved. Corners resolve both axes; inward-moving particles at
 * an edge are clamped but never reflected. Velocities are px/frame, matching
 * the per-frame SPRING/DAMP integration of the main particle loop. The
 * returned edge bitmask feeds the formation-level bounce tracker
 * (engine/pondFormation.ts).
 *
 * Pure and allocation-free — verified by scripts/verify-pond.js.
 */

import { PondConfig } from './pondConfig'

/** The mutable slice of a main glyph particle the boundary pass touches. */
export type PondBoundaryParticle = {
  x: number
  y: number
  vx: number
  vy: number
}

/** Edge bitmask bits reported by applyPondBoundary (wall indices 0–3). */
export const POND_EDGE_LEFT = 1
export const POND_EDGE_RIGHT = 2
export const POND_EDGE_TOP = 4
export const POND_EDGE_BOTTOM = 8

/** Rebound speed (px/frame) for an incoming wall-normal impact speed:
 * `t = clamp(impact / fullBounceImpact, 0, 1)`, then lerp min → max by `t`.
 * Impact speeds beyond the full-bounce threshold saturate at the max.
 */
export function resolvePondBoundaryRebound(
  impactSpeed: number,
  minBounceSpeed: number,
  maxBounceSpeed: number,
  fullBounceImpactSpeed: number,
): number {
  const raw = impactSpeed / fullBounceImpactSpeed
  const t = !Number.isFinite(raw) ? 1 : Math.min(1, Math.max(0, raw))
  return minBounceSpeed + (maxBounceSpeed - minBounceSpeed) * t
}

/**
 * Clamp one particle's center into [0, width] × [0, height] and reflect any
 * outward-moving velocity component inward. A zero component never reflects,
 * so reduced-motion containment (velocity held at zero) falls out of the
 * same call: centers clamp, velocity stays zero, no rebound animation.
 *
 * Returns an allocation-free edge bitmask (POND_EDGE_*) of ACTUAL outward
 * impacts — the edges whose velocity component reflected. Clamping an
 * inward-moving or zero-velocity glyph reports nothing.
 */
export function applyPondBoundary(
  p: PondBoundaryParticle,
  width: number,
  height: number,
  config: PondConfig,
): number {
  const minBounce = config.boundaryMinBounceSpeed
  const maxBounce = config.boundaryMaxBounceSpeed
  const fullImpact = config.boundaryFullBounceImpactSpeed
  let mask = 0
  if (p.x < 0) {
    p.x = 0
    if (p.vx < 0) {
      p.vx = resolvePondBoundaryRebound(-p.vx, minBounce, maxBounce, fullImpact)
      mask |= POND_EDGE_LEFT
    }
  } else if (p.x > width) {
    p.x = width
    if (p.vx > 0) {
      p.vx = -resolvePondBoundaryRebound(p.vx, minBounce, maxBounce, fullImpact)
      mask |= POND_EDGE_RIGHT
    }
  }
  if (p.y < 0) {
    p.y = 0
    if (p.vy < 0) {
      p.vy = resolvePondBoundaryRebound(-p.vy, minBounce, maxBounce, fullImpact)
      mask |= POND_EDGE_TOP
    }
  } else if (p.y > height) {
    p.y = height
    if (p.vy > 0) {
      p.vy = -resolvePondBoundaryRebound(p.vy, minBounce, maxBounce, fullImpact)
      mask |= POND_EDGE_BOTTOM
    }
  }
  return mask
}
