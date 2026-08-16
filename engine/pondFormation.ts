/**
 * Formation-level pond bounce (debug-only "Private Pond" experiment): an
 * aggregate wall-contact tracker that reflects the shared swimming body
 * inward when enough unique visible glyphs hit the same wall within a time
 * window — the whole formation changes course and displaced glyphs ripple
 * back into formation through the existing springs. The body's soft-boundary
 * steering stays; this is the fallback for when glyphs still reach a wall.
 *
 * Each wall runs an independent contact window: the window opens on the
 * first impact, counts each particle index at most once (generation-stamped
 * typed arrays — no allocation per particle or per frame), triggers at
 * max(1, ceil(visibleGlyphCount × thresholdPercent / 100)) unique contacts,
 * and expires unsuccessful after formationImpactWindowMs. A trigger bounces
 * the body, resets every window, and starts a global cooldown during which
 * individual glyph rebounds continue but nothing accumulates.
 *
 * Pure with injected time (ms) — verified by scripts/verify-pond.js.
 */

import { PondBody, resolvePondMaxSpeed } from './pondBody'
import { PondConfig } from './pondConfig'
import {
  POND_EDGE_BOTTOM,
  POND_EDGE_LEFT,
  POND_EDGE_RIGHT,
  POND_EDGE_TOP,
} from './pondBoundaries'

/** Wall indices matching the POND_EDGE_* bits (left/right/top/bottom). */
const WALL_LEFT = 0
const WALL_RIGHT = 1
const WALL_TOP = 2
const WALL_BOTTOM = 3
const WALL_COUNT = 4

/**
 * Per-wall contact windows. `stamps` is one flat Uint32Array (wall-major,
 * 4 × capacity) of generation markers: a particle has already counted for a
 * wall's active window iff its stamp equals the wall's current generation.
 */
export type PondFormationTracker = {
  /** Per-wall window start (ms); -1 = no active window. */
  windowStartMs: Float64Array
  /** Per-wall unique contact count for the active window. */
  counts: Uint32Array
  /** Per-wall generation, bumped on every window (re)start. */
  generations: Uint32Array
  /** Flat per-wall per-particle generation stamps (4 × capacity). */
  stamps: Uint32Array
  /** Particle-index capacity of `stamps` (grows by reallocation only). */
  capacity: number
  /** Cooldown end (ms); no accumulation and no trigger before this time. */
  cooldownUntilMs: number
  /** Torque accumulators (per wall, active window only): sum of impact-speed
   *  weights, sum of tangent contact position × weight, and sum of incoming
   *  wall-normal speeds. Cleared on window start/expiry and on every reset. */
  speedWeightSums: Float64Array
  tangentSums: Float64Array
  normalSpeedSums: Float64Array
}

/** Create an empty tracker sized for `capacity` particle indices. */
export function createPondFormationTracker(capacity: number): PondFormationTracker {
  const safeCapacity = Math.max(1, Math.floor(capacity))
  return {
    windowStartMs: new Float64Array(WALL_COUNT).fill(-1),
    counts: new Uint32Array(WALL_COUNT),
    generations: new Uint32Array(WALL_COUNT),
    stamps: new Uint32Array(WALL_COUNT * safeCapacity),
    capacity: safeCapacity,
    cooldownUntilMs: -1,
    speedWeightSums: new Float64Array(WALL_COUNT),
    tangentSums: new Float64Array(WALL_COUNT),
    normalSpeedSums: new Float64Array(WALL_COUNT),
  }
}

/** Grow the stamp storage when the glyph population exceeds the capacity. */
export function ensurePondFormationCapacity(
  tracker: PondFormationTracker,
  particleCount: number,
): void {
  if (particleCount <= tracker.capacity) return
  tracker.capacity = Math.max(1, Math.floor(particleCount))
  tracker.stamps = new Uint32Array(WALL_COUNT * tracker.capacity)
  resetPondFormationTracker(tracker)
}

/** Clear every window, the torque accumulators, and the cooldown; stamp
 *  storage stays allocated. */
export function resetPondFormationTracker(tracker: PondFormationTracker): void {
  tracker.windowStartMs.fill(-1)
  tracker.counts.fill(0)
  tracker.cooldownUntilMs = -1
  tracker.speedWeightSums.fill(0)
  tracker.tangentSums.fill(0)
  tracker.normalSpeedSums.fill(0)
}

/**
 * Hard-clamp the swimming body into the given bounds, killing any outward
 * velocity component (same semantics as stepPondBody's containment fallback).
 * Applied when a new source field becomes ready and when the mobile viewport
 * changes: the pond formation state is re-fit against the new source bounds
 * so Source mode never begins partially offscreen.
 */
export function containPondBody(body: PondBody, width: number, height: number): void {
  const maxX = Math.max(0, width)
  const maxY = Math.max(0, height)
  if (body.x < 0) {
    body.x = 0
    if (body.vx < 0) body.vx = 0
  } else if (body.x > maxX) {
    body.x = maxX
    if (body.vx > 0) body.vx = 0
  }
  if (body.y < 0) {
    body.y = 0
    if (body.vy < 0) body.vy = 0
  } else if (body.y > maxY) {
    body.y = maxY
    if (body.vy > 0) body.vy = 0
  }
}

/** Unique-contact threshold for the current visible glyph population. */
export function pondFormationContactThreshold(
  visibleGlyphCount: number,
  config: PondConfig,
): number {
  return Math.max(
    1,
    Math.ceil((visibleGlyphCount * config.formationContactThresholdPercent) / 100),
  )
}

/**
 * Accumulate one particle's edge bitmask (from applyPondBoundary) into the
 * per-wall windows, with the clamped contact position and the incoming
 * (pre-boundary) velocity for the torque accumulators. A particle counts at
 * most once per wall per window — duplicates add nothing; the first impact
 * of a window opens it. No-op during the bounce cooldown.
 */
export function recordPondWallImpacts(
  tracker: PondFormationTracker,
  particleIndex: number,
  edgeMask: number,
  contactX: number,
  contactY: number,
  incomingVx: number,
  incomingVy: number,
  nowMs: number,
): void {
  if (edgeMask === 0 || particleIndex < 0 || particleIndex >= tracker.capacity) return
  if (nowMs < tracker.cooldownUntilMs) return
  for (let wall = 0; wall < WALL_COUNT; wall += 1) {
    if ((edgeMask & (1 << wall)) === 0) continue
    if (tracker.windowStartMs[wall] < 0) {
      tracker.windowStartMs[wall] = nowMs
      tracker.generations[wall] = (tracker.generations[wall] + 1) >>> 0
      tracker.counts[wall] = 0
      tracker.speedWeightSums[wall] = 0
      tracker.tangentSums[wall] = 0
      tracker.normalSpeedSums[wall] = 0
    }
    const stampIndex = wall * tracker.capacity + particleIndex
    if (tracker.stamps[stampIndex] !== tracker.generations[wall]) {
      tracker.stamps[stampIndex] = tracker.generations[wall]
      tracker.counts[wall] += 1
      const horizontal = wall === WALL_LEFT || wall === WALL_RIGHT
      const weight = Math.hypot(incomingVx, incomingVy)
      tracker.speedWeightSums[wall] += weight
      tracker.tangentSums[wall] += (horizontal ? contactY : contactX) * weight
      tracker.normalSpeedSums[wall] += horizontal ? Math.abs(incomingVx) : Math.abs(incomingVy)
    }
  }
}

/**
 * Reflect the body's wall-normal velocity inward off the given walls,
 * preserving the tangential component. The inward normal speed is
 * max(|incoming| × restitution, cruiseSpeed × minInwardRatio); the result is
 * clamped to the body's hard speed ceiling and the heading aligns with the
 * resulting travel vector (wanderPhase untouched).
 */
export function bouncePondBodyOffWalls(
  body: PondBody,
  walls: number,
  config: PondConfig,
): void {
  const minInward = config.cruiseSpeed * config.formationMinInwardSpeedRatio
  const restitution = config.formationBounceRestitution
  if ((walls & POND_EDGE_LEFT) !== 0 && body.vx < 0) {
    body.vx = Math.max(-body.vx * restitution, minInward)
  }
  if ((walls & POND_EDGE_RIGHT) !== 0 && body.vx > 0) {
    body.vx = -Math.max(body.vx * restitution, minInward)
  }
  if ((walls & POND_EDGE_TOP) !== 0 && body.vy < 0) {
    body.vy = Math.max(-body.vy * restitution, minInward)
  }
  if ((walls & POND_EDGE_BOTTOM) !== 0 && body.vy > 0) {
    body.vy = -Math.max(body.vy * restitution, minInward)
  }
  // Respect the existing max-speed safety clamp.
  const maxSpeed = resolvePondMaxSpeed(config)
  const speedSq = body.vx * body.vx + body.vy * body.vy
  if (speedSq > maxSpeed * maxSpeed) {
    const scale = maxSpeed / Math.sqrt(speedSq)
    body.vx *= scale
    body.vy *= scale
  }
  // Align the heading with the resulting travel vector.
  if (body.vx !== 0 || body.vy !== 0) {
    body.heading = Math.atan2(body.vy, body.vx)
  }
}

/** Opposing-wall resolution: more contacts wins; ties break by the body's
 *  velocity direction, then its heading. `wallA` is the negative-direction
 *  wall (left/top), `wallB` the positive-direction one (right/bottom). */
function resolveOpposingWalls(
  triggered: number,
  wallA: number,
  wallB: number,
  countA: number,
  countB: number,
  normalVelocity: number,
  headingComponent: number,
): number {
  const a = (triggered & wallA) !== 0
  const b = (triggered & wallB) !== 0
  if (a && b) {
    if (countA !== countB) return countA > countB ? wallA : wallB
    if (normalVelocity !== 0) return normalVelocity < 0 ? wallA : wallB
    return headingComponent < 0 ? wallA : wallB
  }
  if (a) return wallA
  if (b) return wallB
  return 0
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value))
}

/**
 * Signed screen-space torque ([-1, 1]) from the accumulated wall contacts of
 * the triggered walls: per wall, the speed-weighted contact centroid gives a
 * clamped lever arm around the body (vertical position for left/right walls,
 * horizontal for top/bottom), the average incoming normal speed scales the
 * impact strength (saturating at boundaryFullBounceImpactSpeed), and the
 * inward wall force sets the sign (Left −leverY, Right +leverY, Top +leverX,
 * Bottom −leverX). Corner contributions sum; centered impacts → ~zero.
 */
export function resolvePondFormationTorque(
  tracker: PondFormationTracker,
  walls: number,
  body: PondBody,
  width: number,
  height: number,
  config: PondConfig,
): number {
  const halfW = width * 0.5 || 1
  const halfH = height * 0.5 || 1
  let torque = 0
  for (let wall = 0; wall < WALL_COUNT; wall += 1) {
    if ((walls & (1 << wall)) === 0) continue
    const weight = tracker.speedWeightSums[wall]
    const count = tracker.counts[wall]
    if (weight <= 0 || count <= 0) continue
    const centroid = tracker.tangentSums[wall] / weight
    const avgNormalSpeed = tracker.normalSpeedSums[wall] / count
    const strength = Math.min(
      1,
      Math.max(0, avgNormalSpeed / config.boundaryFullBounceImpactSpeed),
    )
    let lever = 0
    let sign = 0
    if (wall === WALL_LEFT) {
      lever = clampUnit((centroid - body.y) / halfH)
      sign = -1
    } else if (wall === WALL_RIGHT) {
      lever = clampUnit((centroid - body.y) / halfH)
      sign = 1
    } else if (wall === WALL_TOP) {
      lever = clampUnit((centroid - body.x) / halfW)
      sign = 1
    } else {
      lever = clampUnit((centroid - body.x) / halfW)
      sign = -1
    }
    torque += sign * lever * strength
  }
  return clampUnit(torque)
}

/**
 * deterministically. On trigger the body rebounds inward, the accumulated
 * impact torque spins the whole glyph field (angular velocity, dragged by a
 * half-life — never a spring back), all windows reset, and the cooldown
 * begins. Returns the bounced wall mask (0 = none). Spin is independent of
 * travel heading: the bounce still changes course; torque only spins.
 */
export function resolvePondFormationBounce(
  tracker: PondFormationTracker,
  body: PondBody | null,
  visibleGlyphCount: number,
  config: PondConfig,
  nowMs: number,
  width: number,
  height: number,
): number {
  // Expire unsuccessful windows.
  for (let wall = 0; wall < WALL_COUNT; wall += 1) {
    if (
      tracker.windowStartMs[wall] >= 0 &&
      nowMs - tracker.windowStartMs[wall] > config.formationImpactWindowMs
    ) {
      tracker.windowStartMs[wall] = -1
      tracker.counts[wall] = 0
      tracker.speedWeightSums[wall] = 0
      tracker.tangentSums[wall] = 0
      tracker.normalSpeedSums[wall] = 0
    }
  }
  if (!body || nowMs < tracker.cooldownUntilMs) return 0

  const threshold = pondFormationContactThreshold(visibleGlyphCount, config)
  let triggered = 0
  for (let wall = 0; wall < WALL_COUNT; wall += 1) {
    if (tracker.windowStartMs[wall] >= 0 && tracker.counts[wall] >= threshold) {
      triggered |= 1 << wall
    }
  }
  if (triggered === 0) return 0

  const walls =
    resolveOpposingWalls(
      triggered,
      POND_EDGE_LEFT,
      POND_EDGE_RIGHT,
      tracker.counts[WALL_LEFT],
      tracker.counts[WALL_RIGHT],
      body.vx,
      Math.cos(body.heading),
    ) |
    resolveOpposingWalls(
      triggered,
      POND_EDGE_TOP,
      POND_EDGE_BOTTOM,
      tracker.counts[WALL_TOP],
      tracker.counts[WALL_BOTTOM],
      body.vy,
      Math.sin(body.heading),
    )
  bouncePondBodyOffWalls(body, walls, config)
  // Impact torque: spin the whole field from the contact geometry BEFORE the
  // accumulators reset. Zero impulse strength adds nothing; zero max speed
  // clamps the result away — both disable new rotational impulses.
  const torque = resolvePondFormationTorque(tracker, walls, body, width, height, config)
  if (torque !== 0) {
    const maxSpin = config.formationMaxAngularSpeed
    body.angularVelocity = Math.min(
      maxSpin,
      Math.max(-maxSpin, body.angularVelocity + torque * config.formationAngularImpulseStrength),
    )
  }
  resetPondFormationTracker(tracker)
  tracker.cooldownUntilMs = nowMs + config.formationBounceCooldownMs
  return walls
}
