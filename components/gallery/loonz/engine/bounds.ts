import type { Vec3, ViewportWall } from "./types";

const SKIN = 0.012;
export const WALL_RESTITUTION = 0.68;

/** Extract the four screen-edge planes from a column-major view-projection matrix. */
export function viewportWalls(m: ArrayLike<number>): ViewportWall[] {
  return (
    [
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
    ] as const
  ).map(([row, sign]) => {
    const n = [0, 4, 8].map(
      (column) => m[column + 3] + sign * m[column + row],
    ) as Vec3;
    const length = Math.hypot(...n);
    return {
      normal: n.map((v) => v / length) as Vec3,
      constant: (m[15] + sign * m[12 + row]) / length,
    };
  });
}

/** Translate the whole shell, preserving volume rather than clipping its vertices. */
export function containInViewport(
  positions: Float32Array,
  walls: ViewportWall[],
  offset: Vec3 = [0, 0, 0],
  onContact?: (normal: Vec3) => void,
): Vec3 {
  const shift = [...offset] as Vec3;
  // Revisit adjacent walls for corner contacts and camera changes. Frustum walls
  // widen with depth, so even a shape larger than the frame can move back to fit.
  for (let pass = 0; pass < 12; pass++) {
    let corrected = false;
    for (const { normal: n, constant } of walls) {
      let distance = Infinity;
      for (let i = 0; i < positions.length; i += 3)
        distance = Math.min(
          distance,
          constant +
            n[0] * (positions[i] + shift[0]) +
            n[1] * (positions[i + 1] + shift[1]) +
            n[2] * (positions[i + 2] + shift[2]),
        );
      if (distance >= SKIN - 1e-6) continue;
      for (let k = 0; k < 3; k++) shift[k] += n[k] * (SKIN - distance);
      onContact?.(n);
      corrected = true;
    }
    if (!corrected) break;
  }
  // A very tight zoom can leave opposite walls in conflict. Retreat into the
  // widening frustum in one bounded solve instead of iterating indefinitely.
  const retreat = walls.reduce<Vec3>(
    (sum, wall) => sum.map((v, k) => v + wall.normal[k]) as Vec3,
    [0, 0, 0],
  );
  const length = Math.hypot(...retreat);
  if (length > 1e-6) {
    for (let k = 0; k < 3; k++) retreat[k] /= length;
    let travel = 0;
    for (const wall of walls) {
      const gain = wall.normal.reduce((sum, n, k) => sum + n * retreat[k], 0);
      if (gain <= 1e-6) continue;
      for (let i = 0; i < positions.length; i += 3) {
        const distance =
          wall.constant +
          wall.normal.reduce(
            (sum, n, k) => sum + n * (positions[i + k] + shift[k]),
            0,
          );
        travel = Math.max(travel, (SKIN - distance) / gain);
      }
    }
    for (let k = 0; k < 3; k++) shift[k] += retreat[k] * travel;
  }
  return shift.map((v, k) => v - offset[k]) as Vec3;
}

export function bounceInViewport(
  positions: Float32Array,
  velocity: Float32Array,
  walls: ViewportWall[],
) {
  const shift = containInViewport(positions, walls, [0, 0, 0], (n) => {
    let incoming = 0;
    for (let i = 0; i < velocity.length; i += 3)
      incoming +=
        velocity[i] * n[0] + velocity[i + 1] * n[1] + velocity[i + 2] * n[2];
    incoming /= velocity.length / 3;
    if (incoming >= 0) return;
    // Reflect only bulk motion, keeping local deformation and tangential motion.
    const impulse = -(1 + WALL_RESTITUTION) * incoming;
    for (let i = 0; i < velocity.length; i++) velocity[i] += n[i % 3] * impulse;
  });
  for (let i = 0; i < positions.length; i++) positions[i] += shift[i % 3];
}
