import type { Vec3 } from "./types";

export interface PointerSample {
  point: Vec3;
  time: number;
}
export const MAX_THROW_SPEED = 3.2;
export const WIPE_DURATION = 2500;
export const clamp = (v: number, low: number, high: number) =>
  Math.max(low, Math.min(high, v));

/** Only the last 100ms matters: holding still before release must cancel a fling. */
export function releaseVelocity(samples: PointerSample[], now: number): Vec3 {
  const last = samples.at(-1);
  if (!last || now - last.time > 90) return [0, 0, 0];
  const first = samples.find((s) => s.time >= now - 100);
  if (!first || last.time - first.time < 8) return [0, 0, 0];
  const dt = (last.time - first.time) / 1000;
  const v = last.point.map((p, k) => (p - first.point[k]) / dt) as Vec3;
  const scale = Math.min(
    1,
    MAX_THROW_SPEED / Math.max(0.001, Math.hypot(...v)),
  );
  return v.map((p) => p * scale) as Vec3;
}

/** Slow, independent buoyant paths. Subtract the initial phase to avoid a startup jump. */
export function floatOffset(time: number, index: number, amount: number): Vec3 {
  const phase = index * 2.39996;
  return [0.16, 0.26, 0.08].map(
    (amplitude, k) =>
      amount *
      amplitude *
      (Math.sin(time * [0.65, 0.86, 0.53][k] + phase + k) -
        Math.sin(phase + k)),
  ) as Vec3;
}

export interface LandingBody {
  center: Vec3;
  radii: Vec3;
}
const extent = (radii: Vec3, direction: Vec3) =>
  Math.hypot(...radii.map((r, k) => r * direction[k]));

/** Short-range attraction that strengthens as the surface gap closes. */
export function magneticForces(bodies: LandingBody[], amount: number): Vec3[] {
  const forces = bodies.map(() => [0, 0, 0] as Vec3);
  if (amount <= 0) return forces;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const delta = bodies[j].center.map(
        (p, k) => p - bodies[i].center[k],
      ) as Vec3;
      const distance = Math.hypot(...delta);
      if (distance < 0.001) continue;
      const direction = delta.map((p) => p / distance) as Vec3;
      const gap =
        distance -
        extent(bodies[i].radii, direction) -
        extent(bodies[j].radii, direction);
      // Strongest at contact, fading smoothly with distance. A small overlap
      // taper lets the contact solver recover without magnetic compression.
      const reach = 1.2,
        contact = 0.055,
        overlapLimit = 0.12;
      if (gap <= -overlapLimit || gap >= reach) continue;
      const proximity = 1 - clamp((gap - contact) / (reach - contact), 0, 1);
      const overlap = clamp(1 + gap / overlapLimit, 0, 1);
      const strength =
        0.72 *
        amount *
        (proximity * proximity * (3 - 2 * proximity)) *
        (overlap * overlap * (3 - 2 * overlap));
      for (let k = 0; k < 3; k++) {
        const force = direction[k] * strength;
        forces[i][k] += force;
        forces[j][k] -= force;
      }
    }
  }
  // Uniformly scale the field so dense groups stay gentle and balanced.
  const scale = Math.min(
    1,
    0.8 / Math.max(0.001, ...forces.map((f) => Math.hypot(...f))),
  );
  return forces.map((f) => f.map((v) => v * scale) as Vec3);
}

/** Local packing, not a global rearrangement: preserve the rest of the composition. */
export function landingPosition(
  body: LandingBody,
  velocity: Vec3,
  neighbors: LandingBody[],
  togetherness: number,
): Vec3 {
  const target = body.center.map((p, k) => p + velocity[k] * 0.48) as Vec3;
  const bounds = () =>
    target.forEach((p, k) => {
      target[k] = clamp(
        p,
        (k === 1 ? -1.35 : -5) + body.radii[k] + 0.08,
        5 - body.radii[k] - 0.08,
      );
    });
  // Attach only to a nearby group, so throwing into open space stays intentional.
  let nearest: LandingBody | undefined,
    nearestGap = Infinity;
  for (const other of neighbors) {
    const delta = target.map((p, k) => p - other.center[k]) as Vec3;
    const distance = Math.hypot(...delta);
    const direction = delta.map((p) => p / Math.max(distance, 0.001)) as Vec3;
    const gap =
      distance - extent(body.radii, direction) - extent(other.radii, direction);
    if (gap < nearestGap) {
      nearestGap = gap;
      nearest = other;
    }
  }
  if (nearest && nearestGap > 0 && nearestGap < 0.9 && togetherness > 0) {
    const delta = target.map((p, k) => nearest!.center[k] - p) as Vec3;
    const distance = Math.hypot(...delta);
    target.forEach(
      (_, k) =>
        (target[k] += (delta[k] / distance) * nearestGap * togetherness),
    );
  }
  // Conservative ellipsoid support gives arbitrary silhouettes room to breathe.
  // True soft-body surface contacts still resolve the moving shells each frame.
  for (let pass = 0; pass < 16; pass++) {
    for (const other of neighbors) {
      let delta = target.map((p, k) => p - other.center[k]) as Vec3;
      let distance = Math.hypot(...delta);
      if (distance < 0.001) {
        delta = [0, 1, 0];
        distance = 0.001;
      }
      let direction = delta.map((p) => p / Math.hypot(...delta)) as Vec3;
      let gap =
        extent(body.radii, direction) + extent(other.radii, direction) + 0.055;
      if (distance < gap) {
        const approach = body.center.map((p, k) => p - other.center[k]) as Vec3;
        const length = Math.hypot(...approach);
        // A look-ahead crossing the neighbor's center must not pull a shell
        // through it. Favor the approach side on the first separation pass.
        if (
          pass === 0 &&
          length > 0.001 &&
          approach.reduce((sum, p, k) => sum + p * direction[k], 0) < 0
        ) {
          direction = approach.map((p) => p / length) as Vec3;
          gap =
            extent(body.radii, direction) +
            extent(other.radii, direction) +
            0.055;
        }
        target.forEach(
          (_, k) => (target[k] = other.center[k] + direction[k] * gap),
        );
      }
    }
    bounds();
  }
  bounds();
  return target;
}
