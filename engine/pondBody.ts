/**
 * Pond body simulation (debug-only "Private Pond" experiment): one swimming
 * body with lightweight steering physics — cruise toward the current heading,
 * a seeded deterministic wander, drag via velocity relaxation, a pointer-
 * driven local current, click ripples, soft boundary steering, and a hard
 * containment fallback. No collisions, boids, schooling, or extra bodies.
 *
 * Everything is pure with an injected clock (dt passed in) and a seeded
 * initial phase (engine/random), so the same seed and input sequence always
 * produce the same trajectory and Node verification can run it headlessly.
 *
 * Verified by scripts/verify-pond.js.
 */

import { PondConfig } from './pondConfig'
import { createSeededRandom } from './random'

const TAU = Math.PI * 2

/** One swimming body: position, velocity, facing, spin, and the wander phase. */
export type PondBody = {
  x: number
  y: number
  vx: number
  vy: number
  /** World-space facing in radians (0 = +X): the cruise/wander steering
   *  direction. It never rotates the field — visual spin comes from
   *  impact-driven torque (spinAngle) only. */
  heading: number
  /** Visual field orientation in radians (impact-driven torque; independent
   *  of heading — torque never steers the body). */
  spinAngle: number
  /** Angular velocity in rad/s, dragged toward zero by the spin half-life. */
  angularVelocity: number
  /** Seeded wander oscillator phase — the only stochastic-looking state. */
  wanderPhase: number
}

/** Pointer snapshot for the local-current force (px, px/s). */
export type PondPointer = {
  x: number
  y: number
  active: boolean
  vx: number
  vy: number
}

export type PondStepParams = {
  /** Clamped pond config (engine/pondConfig). */
  config: PondConfig
  /** Containment bounds in CSS pixels. */
  width: number
  height: number
  /** Pointer state for the local current; null = no pointer. */
  pointer: PondPointer | null
  /** Freeze integration (paint gesture): the pose is held exactly. */
  frozen: boolean
}

/** Deterministic seed for the wander phase (independent of the glyph seed). */
export const POND_BODY_SEED = 0x90bd

/** Wander oscillator speed (rad/s) and turn rate at full strength (rad/s). */
export const POND_WANDER_FREQUENCY = 0.9
export const POND_WANDER_TURN_RATE = 1.6

/** Velocity relaxation rate toward the cruise vector (1/s): this is both the
 *  thrust and the drag — external impulses decay back to the cruise. */
export const POND_CRUISE_RESPONSE = 1.5

/** How fast the heading relaxes toward the velocity direction (1/s), so a
 *  ripple visibly redirects the fish instead of it sliding sideways. */
export const POND_HEADING_ALIGN = 2

/** Hard speed clamp: cruise × multiplier + impulse headroom (px/s). */
export const POND_MAX_SPEED_MULTIPLIER = 2.5
export const POND_SPEED_HEADROOM = 240

/** Spin drag snaps negligible angular velocities (rad/s) to zero. */
export const POND_SPIN_SNAP = 0.001

/** Pointer current: falloff radius (px) and coupling gain (fraction of the
 *  pointer velocity transferred per second at strength 1, zero distance). */
export const POND_CURRENT_RADIUS = 220
export const POND_CURRENT_GAIN = 0.6

/** Click ripple: outward impulse (px/s) at strength 1. */
export const POND_RIPPLE_SPEED = 220
/** Absolute safety ceiling for any impulse-built velocity (px/s). */
export const POND_ABSOLUTE_MAX_SPEED = 900

/** Soft boundary: steering margin (px) and inward push (px/s²) at the edge. */
export const POND_BOUNDARY_MARGIN = 90
export const POND_BOUNDARY_PUSH = 400

/** The speed the body may never exceed after a step (beyond float epsilon). */
export function resolvePondMaxSpeed(config: PondConfig): number {
  return config.cruiseSpeed * POND_MAX_SPEED_MULTIPLIER + POND_SPEED_HEADROOM
}

/** Create a centered body at rest, facing the resting heading, with a seeded
 *  wander phase. Same seed → same body. */
export function createPondBody(
  width: number,
  height: number,
  restingHeading: number,
  seed: number = POND_BODY_SEED,
): PondBody {
  const random = createSeededRandom(seed)
  return {
    x: width * 0.5,
    y: height * 0.5,
    vx: 0,
    vy: 0,
    heading: restingHeading,
    spinAngle: 0,
    angularVelocity: 0,
    wanderPhase: random() * TAU,
  }
}

/** Deterministic centered static pose for reduced motion: no integration, no
 *  wander, no spin — the fish holds its resting heading in the middle of the
 *  pond. */
export function pondStaticPose(
  width: number,
  height: number,
  restingHeading: number,
): { x: number; y: number; heading: number; spinAngle: number } {
  return { x: width * 0.5, y: height * 0.5, heading: restingHeading, spinAngle: 0 }
}

function wrapAngle(angle: number): number {
  let a = angle % TAU
  if (a > Math.PI) a -= TAU
  else if (a < -Math.PI) a += TAU
  return a
}

function clampSpeed(body: PondBody, maxSpeed: number): void {
  const speedSq = body.vx * body.vx + body.vy * body.vy
  if (speedSq > maxSpeed * maxSpeed) {
    const scale = maxSpeed / Math.sqrt(speedSq)
    body.vx *= scale
    body.vy *= scale
  }
}

/**
 * Advance the body by `dt` seconds. Frozen or non-positive dt holds the pose
 * exactly. All inputs are clamped, so a fixed input sequence is deterministic
 * and every value stays finite and bounded.
 */
export function stepPondBody(body: PondBody, params: PondStepParams, dt: number): void {
  if (params.frozen || !(dt > 0)) return
  const { config, width, height, pointer } = params
  const step = Math.min(0.1, dt)

  // Wander: a seeded two-tone oscillator steers the heading, bounded by the
  // configured strength (0 = straight cruising).
  body.wanderPhase += step * POND_WANDER_FREQUENCY
  const p = body.wanderPhase
  const turn =
    config.wanderStrength * (Math.sin(p) + 0.6 * Math.sin(2.3 * p + 1.7))
  body.heading = wrapAngle(body.heading + turn * POND_WANDER_TURN_RATE * step)

  // Cruise: relax the velocity toward the heading-direction cruise vector.
  const response = Math.min(1, POND_CRUISE_RESPONSE * step)
  body.vx += (Math.cos(body.heading) * config.cruiseSpeed - body.vx) * response
  body.vy += (Math.sin(body.heading) * config.cruiseSpeed - body.vy) * response

  // Pointer current: a moving pointer drags the body along its own velocity,
  // falling off to zero at POND_CURRENT_RADIUS.
  if (pointer && pointer.active && config.pointerCurrentStrength > 0) {
    const dx = body.x - pointer.x
    const dy = body.y - pointer.y
    const distSq = dx * dx + dy * dy
    if (distSq < POND_CURRENT_RADIUS * POND_CURRENT_RADIUS) {
      const falloff = 1 - Math.sqrt(distSq) / POND_CURRENT_RADIUS
      const gain = config.pointerCurrentStrength * POND_CURRENT_GAIN * falloff * step
      body.vx += pointer.vx * gain
      body.vy += pointer.vy * gain
    }
  }

  // Soft boundary steering: push back inward inside the margin.
  const margin = Math.min(POND_BOUNDARY_MARGIN, Math.min(width, height) * 0.25)
  if (margin > 0) {
    if (body.x < margin) body.vx += (1 - body.x / margin) * POND_BOUNDARY_PUSH * step
    else if (body.x > width - margin) body.vx -= (1 - (width - body.x) / margin) * POND_BOUNDARY_PUSH * step
    if (body.y < margin) body.vy += (1 - body.y / margin) * POND_BOUNDARY_PUSH * step
    else if (body.y > height - margin) body.vy -= (1 - (height - body.y) / margin) * POND_BOUNDARY_PUSH * step
  }

  // Cruise-speed clamping: the body never exceeds the hard clamp after a step.
  clampSpeed(body, resolvePondMaxSpeed(config))

  body.x += body.vx * step
  body.y += body.vy * step

  // Hard containment fallback: if anything still escapes (huge impulse, tiny
  // viewport), pin the body inside and kill the outward velocity component.
  if (body.x < 0) {
    body.x = 0
    if (body.vx < 0) body.vx = 0
  } else if (body.x > width) {
    body.x = width
    if (body.vx > 0) body.vx = 0
  }
  if (body.y < 0) {
    body.y = 0
    if (body.vy < 0) body.vy = 0
  } else if (body.y > height) {
    body.y = height
    if (body.vy > 0) body.vy = 0
  }

  // Heading follows the actual travel direction, so ripples redirect the fish.
  const speedSq = body.vx * body.vx + body.vy * body.vy
  if (speedSq > 1) {
    const travel = Math.atan2(body.vy, body.vx)
    body.heading = wrapAngle(
      body.heading + wrapAngle(travel - body.heading) * Math.min(1, POND_HEADING_ALIGN * step),
    )
  }

  // Field spin: integrate the impact-driven angular velocity, wrap the angle,
  // and decay by the configured half-life — pure drag, never a spring back to
  // zero, so the field keeps whatever orientation it spins into. Frozen
  // steps (paint gestures) skip this with the rest of the integration.
  if (body.angularVelocity !== 0 || body.spinAngle !== 0) {
    body.spinAngle = wrapAngle(body.spinAngle + body.angularVelocity * step)
    const halfLifeMs = config.formationSpinHalfLifeMs
    body.angularVelocity *= halfLifeMs > 0 ? 2 ** (-(step * 1000) / halfLifeMs) : 0
    const maxSpin = config.formationMaxAngularSpeed
    if (body.angularVelocity > maxSpin) body.angularVelocity = maxSpin
    else if (body.angularVelocity < -maxSpin) body.angularVelocity = -maxSpin
    if (Math.abs(body.angularVelocity) < POND_SPIN_SNAP) body.angularVelocity = 0
    if (!Number.isFinite(body.spinAngle)) body.spinAngle = 0
    if (!Number.isFinite(body.angularVelocity)) body.angularVelocity = 0
  }
}

/**
 * Click/tap ripple: a one-shot outward velocity impulse away from the point.
 * A near-exact hit (no direction) pushes along the current heading instead.
 * The resulting velocity is capped by the absolute safety ceiling; the next
 * step relaxes it back under the cruise-based clamp.
 */
export function applyRipple(body: PondBody, x: number, y: number, strength: number): void {
  const clampedStrength = Math.min(2, Math.max(0, Number.isFinite(strength) ? strength : 0))
  if (clampedStrength <= 0) return
  let dx = body.x - x
  let dy = body.y - y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist < 1) {
    dx = Math.cos(body.heading)
    dy = Math.sin(body.heading)
  } else {
    dx /= dist
    dy /= dist
  }
  const impulse = clampedStrength * POND_RIPPLE_SPEED
  body.vx += dx * impulse
  body.vy += dy * impulse
  clampSpeed(body, POND_ABSOLUTE_MAX_SPEED)
}

/**
 * Re-fit the body after a viewport change: scale the position by the bounds
 * ratio (first call with unknown old bounds only clamps) and contain the body
 * inside the new bounds.
 */
export function normalizeAfterResize(
  body: PondBody,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
): void {
  if (oldWidth > 0 && oldHeight > 0) {
    body.x *= newWidth / oldWidth
    body.y *= newHeight / oldHeight
  }
  body.x = Math.min(Math.max(body.x, 0), Math.max(0, newWidth))
  body.y = Math.min(Math.max(body.y, 0), Math.max(0, newHeight))
}
