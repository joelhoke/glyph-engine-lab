/**
 * Pond target transform (debug-only "Private Pond" experiment): maps the
 * freshly computed target field onto the swimming body's pose.
 *
 * Every source follows the body's position, and impact-driven torque spins
 * the whole field around the anchor:
 *
 * - Creatures with `locomotion` metadata rotate by (body heading - resting
 *   forward + spin angle) around their declared anchor, then translate the
 *   anchor onto the body position.
 * - Every other source (JH logo, text, uploads, presets, organic-flow,
 *   motion-off) rotates by the spin angle alone around the viewport center
 *   and glides with the body — spin is impact-driven only; the body never
 *   twists text by its heading.
 *
 * Everything here is pure, in place, allocation-free, and bounded O(count),
 * matching the frame-path contract documented in engine/motion.ts.
 *
 * Verified by scripts/verify-pond.js.
 */

import { CreatureLocomotion } from './motion'

/** A resolved body pose: position (px), world-space facing, and field spin. */
export type PondPose = {
  x: number
  y: number
  heading: number
  /** Impact-driven field orientation (radians), composed on top of facing. */
  spinAngle: number
}

/** The transform applied to one frame of targets. `angle` 0 = no rotation. */
export type PondTransform = {
  /** Rotation around the anchor (radians); 0 for translation-only drift. */
  angle: number
  /** Local-space pivot (px) the rotation turns around / the drift offsets from. */
  anchorPx: number
  anchorPy: number
  /** Post-rotation translation landing the anchor on the pose position. */
  translateX: number
  translateY: number
}

/**
 * Resolve the transform for one frame. With locomotion metadata the pose
 * rotates around the creature's declared anchor by (heading - resting
 * forward + spin); without it the transform rotates any source by the spin
 * alone around the viewport center. Heading and spin stay independent —
 * torque never steers the body. A centered pose at the resting heading with
 * zero spin resolves to the identity.
 */
export function resolvePondTransform(
  locomotion: CreatureLocomotion | null,
  pose: PondPose,
  width: number,
  height: number,
): PondTransform {
  const anchorPx = width * (locomotion ? locomotion.anchorX : 0.5)
  const anchorPy = height * (locomotion ? locomotion.anchorY : 0.5)
  const restingHeading = locomotion ? Math.atan2(locomotion.forwardY, locomotion.forwardX) : 0
  return {
    angle: pose.spinAngle + (locomotion ? pose.heading - restingHeading : 0),
    anchorPx,
    anchorPy,
    translateX: pose.x - anchorPx,
    translateY: pose.y - anchorPy,
  }
}

/** Identity transforms leave the targets untouched (skippable). */
export function isIdentityPondTransform(transform: PondTransform): boolean {
  return transform.angle === 0 && transform.translateX === 0 && transform.translateY === 0
}

/**
 * Apply the transform to `count` targets in place. The rotation branch is
 * one bounded pass; translation-only drift is the same or cheaper. Never
 * allocates.
 */
export function applyPondTransform(
  outX: Float32Array,
  outY: Float32Array,
  count: number,
  transform: PondTransform,
): void {
  if (isIdentityPondTransform(transform)) return
  const { angle, anchorPx, anchorPy, translateX, translateY } = transform
  if (angle === 0) {
    for (let i = 0; i < count; i += 1) {
      outX[i] += translateX
      outY[i] += translateY
    }
    return
  }
  const cosA = Math.cos(angle)
  const sinA = Math.sin(angle)
  const x = anchorPx + translateX
  const y = anchorPy + translateY
  for (let i = 0; i < count; i += 1) {
    const dx = outX[i] - anchorPx
    const dy = outY[i] - anchorPy
    outX[i] = x + dx * cosA - dy * sinA
    outY[i] = y + dx * sinA + dy * cosA
  }
}

/**
 * Copy the immutable base field into the pond drift buffers (Motion Off
 * routing): the base arrays are read-only, so the drift transform always
 * lands in caller-owned buffers and the base field stays byte-identical.
 */
export function copyBaseIntoPondBuffers(
  baseX: Float32Array,
  baseY: Float32Array,
  outX: Float32Array,
  outY: Float32Array,
  count: number,
): void {
  outX.set(baseX.subarray(0, count))
  outY.set(baseY.subarray(0, count))
}
