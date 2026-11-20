import { makeMesh, transformPositions, volume, center } from "./geometry";
import type { Balloon, SceneDocument, Vec3, ViewportWall } from "./types";
import { bounceInViewport, containInViewport } from "./bounds";
import {
  clamp,
  floatOffset,
  landingPosition,
  magneticForces,
  MAX_THROW_SPEED,
} from "./motion";

type Edge = {
  a: number;
  b: number;
  length: number;
  bend: boolean;
  lambda: number;
};
export class Body {
  id: string;
  p: Float32Array;
  previous: Float32Array;
  rest: Float32Array;
  velocity: Float32Array;
  triangles: Uint32Array;
  edges: Edge[] = [];
  gradients: Float32Array;
  restVolume: number;
  volumeLambda = 0;
  origin: Vec3;
  radius: number;
  radii: Vec3 = [0, 0, 0];
  placedAt = -Infinity;
  constructor(balloon: Balloon) {
    this.id = balloon.id;
    const mesh = makeMesh(balloon.outline, balloon.inflation);
    this.p = transformPositions(mesh.positions, balloon);
    this.previous = this.p.slice();
    this.rest = this.p.slice();
    this.velocity = new Float32Array(this.p.length);
    this.gradients = new Float32Array(this.p.length);
    this.triangles = mesh.indices;
    this.restVolume = volume(this.p, this.triangles);
    this.origin = center(this.p);
    this.radius = 0;
    for (let i = 0; i < this.p.length; i++)
      this.radii[i % 3] = Math.max(
        this.radii[i % 3],
        Math.abs(this.p[i] - this.origin[i % 3]),
      );
    for (let i = 0; i < this.p.length; i += 3)
      this.radius = Math.max(
        this.radius,
        Math.hypot(
          this.p[i] - this.origin[0],
          this.p[i + 1] - this.origin[1],
          this.p[i + 2] - this.origin[2],
        ),
      );
    const edges = new Map<string, { a: number; b: number; other: number[] }>();
    for (let t = 0; t < mesh.indices.length; t += 3)
      for (let k = 0; k < 3; k++) {
        const a = mesh.indices[t + k],
          b = mesh.indices[t + ((k + 1) % 3)],
          c = mesh.indices[t + ((k + 2) % 3)];
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (!edges.has(key)) edges.set(key, { a, b, other: [] });
        edges.get(key)!.other.push(c);
      }
    const addEdge = (a: number, b: number, bend: boolean) =>
      this.edges.push({
        a: a * 3,
        b: b * 3,
        length: Math.hypot(
          ...[0, 1, 2].map((k) => this.p[a * 3 + k] - this.p[b * 3 + k]),
        ),
        bend,
        lambda: 0,
      });
    edges.forEach((e) => {
      addEdge(e.a, e.b, false);
      if (e.other.length === 2) addEdge(e.other[0], e.other[1], true);
    });
  }
  constrain(dt: number, softness: number) {
    for (const edge of this.edges) {
      const { a, b } = edge;
      const dx = this.p[a] - this.p[b],
        dy = this.p[a + 1] - this.p[b + 1],
        dz = this.p[a + 2] - this.p[b + 2];
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-8) continue;
      const alpha =
        (edge.bend
          ? 0.00008 + softness * 0.001
          : 0.0000003 + softness * 0.000012) /
        (dt * dt);
      const dl = (-(len - edge.length) - alpha * edge.lambda) / (2 + alpha);
      edge.lambda += dl;
      const n = dl / len;
      this.p[a] += n * dx;
      this.p[b] -= n * dx;
      this.p[a + 1] += n * dy;
      this.p[b + 1] -= n * dy;
      this.p[a + 2] += n * dz;
      this.p[b + 2] -= n * dz;
    }
    this.gradients.fill(0);
    const p = this.p,
      g = this.gradients;
    for (let t = 0; t < this.triangles.length; t += 3) {
      const ids = [
        this.triangles[t] * 3,
        this.triangles[t + 1] * 3,
        this.triangles[t + 2] * 3,
      ];
      for (let k = 0; k < 3; k++) {
        const a = ids[k],
          b = ids[(k + 1) % 3],
          c = ids[(k + 2) % 3];
        g[a] += (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) / 6;
        g[a + 1] += (p[b + 2] * p[c] - p[b] * p[c + 2]) / 6;
        g[a + 2] += (p[b] * p[c + 1] - p[b + 1] * p[c]) / 6;
      }
    }
    let norm = 0;
    for (const v of g) norm += v * v;
    const alpha = 0.000001 / (dt * dt);
    const dl =
      (-(volume(p, this.triangles) - this.restVolume) -
        alpha * this.volumeLambda) /
      (norm + alpha);
    this.volumeLambda += dl;
    for (let i = 0; i < p.length; i++) p[i] += g[i] * dl;
  }
}
// Ericson's closest-point regions return barycentric weights for contact response.
function closest(p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const sub = (x: Vec3, y: Vec3): Vec3 => [
    x[0] - y[0],
    x[1] - y[1],
    x[2] - y[2],
  ];
  const dot = (x: Vec3, y: Vec3) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  const ab = sub(b, a),
    ac = sub(c, a),
    ap = sub(p, a);
  const d1 = dot(ab, ap),
    d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return [1, 0, 0];
  const bp = sub(p, b),
    d3 = dot(ab, bp),
    d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return [0, 1, 0];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return [1 - v, v, 0];
  }
  const cp = sub(p, c),
    d5 = dot(ab, cp),
    d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return [0, 0, 1];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return [1 - w, 0, w];
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + d5 - d6);
    return [0, 1 - w, w];
  }
  const den = 1 / (va + vb + vc || 1);
  return [1 - vb * den - vc * den, vb * den, vc * den];
}
const CELL = 0.32,
  SKIN = 0.035;
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function triangleHash(body: Body) {
  const hash = new Map<string, number[]>(),
    p = body.p;
  for (let t = 0; t < body.triangles.length; t += 3) {
    const a = body.triangles[t] * 3,
      b = body.triangles[t + 1] * 3,
      c = body.triangles[t + 2] * 3;
    const lo = [0, 1, 2].map((k) =>
      Math.floor((Math.min(p[a + k], p[b + k], p[c + k]) - 0.13) / CELL),
    );
    const hi = [0, 1, 2].map((k) =>
      Math.floor((Math.max(p[a + k], p[b + k], p[c + k]) + 0.13) / CELL),
    );
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let z = lo[2]; z <= hi[2]; z++) {
          const k = key(x, y, z);
          if (!hash.has(k)) hash.set(k, []);
          hash.get(k)!.push(t);
        }
  }
  return hash;
}
function collide(a: Body, b: Body, hash: Map<string, number[]>) {
  for (let i = 0; i < a.p.length; i += 3) {
    const p: Vec3 = [a.p[i], a.p[i + 1], a.p[i + 2]];
    const candidates = hash.get(
      key(...(p.map((v) => Math.floor(v / CELL)) as Vec3)),
    );
    if (!candidates) continue;
    let best = 0.13,
      hit: { ids: number[]; bary: Vec3; normal: Vec3; signed: number } | null =
        null;
    for (const t of candidates) {
      const ids = [
        b.triangles[t] * 3,
        b.triangles[t + 1] * 3,
        b.triangles[t + 2] * 3,
      ];
      const [v0, v1, v2] = ids.map(
        (j) => [b.p[j], b.p[j + 1], b.p[j + 2]] as Vec3,
      );
      const bary = closest(p, v0, v1, v2);
      const q = [0, 1, 2].map(
        (k) => v0[k] * bary[0] + v1[k] * bary[1] + v2[k] * bary[2],
      );
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (d >= best) continue;
      const u = v1.map((v, k) => v - v0[k]),
        v = v2.map((v, k) => v - v0[k]);
      const n: Vec3 = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      const len = Math.hypot(...n);
      if (len < 1e-9) continue;
      n.forEach((_, k) => (n[k] /= len));
      const signed = n.reduce((s, v, k) => s + v * (p[k] - q[k]), 0);
      best = d;
      hit = { ids, bary, normal: n, signed };
    }
    if (!hit || hit.signed >= SKIN) continue;
    const correction =
      Math.min(0.065, SKIN - hit.signed) /
      (1 + hit.bary.reduce((s, v) => s + v * v, 0));
    for (let k = 0; k < 3; k++) {
      a.p[i + k] += hit.normal[k] * correction;
      for (let j = 0; j < 3; j++)
        b.p[hit.ids[j] + k] -= hit.normal[k] * correction * hit.bary[j];
    }
  }
}
export class Simulation {
  bodies: Body[];
  walls: ViewportWall[] = [];
  time = 0;
  drag: { id: string; vertex: number; point: Vec3 } | null = null;
  grab: { id: string; point: Vec3 } | null = null;
  constructor(
    balloons: Balloon[],
    public settings: SceneDocument["physics"],
  ) {
    this.bodies = balloons.map((b) => new Body(b));
  }
  release(velocity: Vec3 = [0, 0, 0]) {
    this.drag = null;
    const b = this.bodies.find((b) => b.id === this.grab?.id);
    const point = this.grab?.point;
    this.grab = null;
    if (!b) return null;
    // A release can arrive between physics frames. Honor the final pointer target.
    const current = center(b.p);
    if (point)
      for (let i = 0; i < b.p.length; i++)
        b.p[i] += point[i % 3] - current[i % 3];
    const speed = Math.hypot(...velocity);
    const v = velocity.map((p) =>
      Number.isFinite(p)
        ? p * Math.min(1, MAX_THROW_SPEED / Math.max(0.001, speed))
        : 0,
    ) as Vec3;
    const oldOrigin = [...b.origin] as Vec3;
    b.origin = landingPosition(
      { center: center(b.p), radii: b.radii },
      v,
      this.bodies
        .filter((other) => other !== b)
        .map((other) => ({ center: center(other.p), radii: other.radii })),
      this.settings.attraction,
    );
    this.containAnchor(b);
    b.placedAt = this.time;
    for (let i = 0; i < b.velocity.length; i++) b.velocity[i] = v[i % 3];
    return {
      id: b.id,
      delta: b.origin.map((p, k) => p - oldOrigin[k]) as Vec3,
    };
  }
  private containAnchor(b: Body) {
    if (!this.walls.length) return;
    const c = center(b.p);
    const correction = containInViewport(
      b.p,
      this.walls,
      b.origin.map((v, k) => v - c[k]) as Vec3,
    );
    b.origin = b.origin.map((v, k) => v + correction[k]) as Vec3;
  }
  step(dt = 1 / 120) {
    this.time += dt;
    const magnets = magneticForces(
      this.bodies.map((b) => ({ center: center(b.p), radii: b.radii })),
      this.settings.attraction,
    );
    this.bodies.forEach((b, index) => {
      this.containAnchor(b);
      b.previous.set(b.p);
      b.volumeLambda = 0;
      b.edges.forEach((e) => (e.lambda = 0));
      const c = center(b.p);
      const held = this.grab?.id === b.id;
      const settleWeight = clamp(1 - (this.time - b.placedAt) / 3, 0, 1);
      // Surface contacts cannot reliably untangle a shell dropped deep inside
      // another. A bounded whole-body escape preserves volume while contacts
      // recover. Only a recently thrown body receives this assistance.
      const escape: Vec3 = [0, 0, 0];
      if (settleWeight > 0 && !held) {
        for (const other of this.bodies) {
          if (other === b) continue;
          const otherCenter = center(other.p);
          const delta = c.map((v, k) => v - otherCenter[k]) as Vec3;
          const distance = Math.hypot(...delta);
          const direction = b.origin.map((v, k) => v - c[k]) as Vec3;
          const length = Math.hypot(...direction);
          if (length < 0.05) continue;
          const axis = delta.map((v) => v / Math.max(distance, 0.001));
          const span = Math.hypot(
            ...b.radii.map((r, k) => (r + other.radii[k]) * axis[k]),
          );
          if (distance < span * 0.9 || distance < 0.001)
            for (let k = 0; k < 3; k++)
              escape[k] += (direction[k] / length) * Math.min(3.6 * dt, length);
        }
      }
      const offset = floatOffset(
        this.time,
        index,
        this.settings.drift * (1 - settleWeight * 0.8),
      );
      for (let i = 0; i < b.p.length; i += 3)
        for (let k = 0; k < 3; k++) {
          const restoring =
            (b.origin[k] + offset[k] - c[k]) * (2.8 + settleWeight * 2.7);
          b.velocity[i + k] =
            (b.velocity[i + k] + (restoring + magnets[index][k]) * dt) *
            Math.exp(-(2 + settleWeight * 1.4) * dt);
          b.p[i + k] += held
            ? clamp((this.grab!.point[k] - c[k]) * 0.75, -0.45, 0.45)
            : b.velocity[i + k] * dt + clamp(escape[k], -3.6 * dt, 3.6 * dt);
        }
    });
    for (let iteration = 0; iteration < 4; iteration++) {
      this.bodies.forEach((b) => b.constrain(dt, this.settings.softness));
      if (this.drag) {
        const b = this.bodies.find((b) => b.id === this.drag!.id);
        if (b) {
          const v = Math.min(b.p.length / 3 - 1, this.drag.vertex) * 3;
          for (let k = 0; k < 3; k++)
            b.p[v + k] += Math.max(
              -0.035,
              Math.min(0.035, (this.drag.point[k] - b.p[v + k]) * 0.35),
            );
        }
      }
    }
    const centers = this.bodies.map((b) => center(b.p));
    const hashes = new Map<Body, Map<string, number[]>>();
    for (let i = 0; i < this.bodies.length; i++)
      for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i],
          b = this.bodies[j];
        if (
          Math.hypot(...centers[i].map((v, k) => v - centers[j][k])) >
          a.radius + b.radius + 0.2
        )
          continue;
        for (const body of [a, b])
          if (!hashes.has(body)) hashes.set(body, triangleHash(body));
        collide(a, b, hashes.get(b)!);
        collide(b, a, hashes.get(a)!);
      }
    for (const b of this.bodies) {
      for (let i = 0; i < b.p.length; i++) {
        const min = i % 3 === 1 ? -1.35 : -5,
          max = 5;
        if (!this.walls.length) b.p[i] = Math.max(min, Math.min(max, b.p[i]));
        b.velocity[i] = Math.max(
          -MAX_THROW_SPEED,
          Math.min(MAX_THROW_SPEED, (b.p[i] - b.previous[i]) / dt),
        );
        if (!Number.isFinite(b.p[i])) {
          b.p.set(b.rest);
          b.velocity.fill(0);
          break;
        }
      }
      if (this.walls.length) bounceInViewport(b.p, b.velocity, this.walls);
    }
  }
}
