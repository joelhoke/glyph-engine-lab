/**
 * Pond target transform (debug-only "Private Pond" experiment): maps the
 * freshly computed target field onto the swimming body's pose.
 *
 * Every source — JH logo, text, uploads, presets, organic-flow, motion-off,
 * parametric creatures — translates with the body and spins by the
 * impact-driven torque around the viewport center. Creatures keep their
 * fixed upright resting orientation: the body's heading steers its travel
 * but never rotates the field (no flip).
 *
 * Everything here is pure, in place, allocation-free, and bounded O(count),
 * matching the frame-path contract documented in engine/motion.ts.
 *
 * Verified by scripts/verify-pond.js.
 */

/** A resolved body pose: position (px), world-space facing, and field spin. */
export type PondPose = {
  x: number
  y: number
  heading: number
  /** Impact-driven field orientation (radians); the only rotation applied. */
  spinAngle: number
}

/** The transform applied to one frame of targets. `angle` 0 = no rotation. */
export type PondTransform = {
  /** Rotation around the anchor (radians); the impact-driven spin. */
  angle: number
  /** Local-space pivot (px) the rotation turns around / the drift offsets from. */
  anchorPx: number
  anchorPy: number
  /** Post-rotation translation landing the anchor on the pose position. */
  translateX: number
  translateY: number
}

/**
 * Resolve the transform for one frame: rotate by the impact-driven spin
 * around the viewport center, then translate the center onto the body
 * position. A centered pose with zero spin resolves to the identity.
 */
export function resolvePondTransform(
  pose: PondPose,
  width: number,
  height: number,
): PondTransform {
  const anchorPx = width * 0.5
  const anchorPy = height * 0.5
  return {
    angle: pose.spinAngle,
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
