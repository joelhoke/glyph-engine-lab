import poly2tri from "poly2tri";
import type { Balloon, MeshData, Vec2, Vec3 } from "./types";

export function area(p: Vec2[]) {
  return (
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2
  );
}
const distance = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function pointSegment(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function inside(p: Vec2, polygon: Vec2[]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
export function boundaryDistance(p: Vec2, polygon: Vec2[]) {
  return Math.min(
    ...polygon.map((a, i) =>
      pointSegment(p, a, polygon[(i + 1) % polygon.length]),
    ),
  );
}
function intersects(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
  const cross = (p: Vec2, q: Vec2, r: Vec2) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const x = cross(a, b, c),
    y = cross(a, b, d),
    z = cross(c, d, a),
    w = cross(c, d, b);
  if (x * y < -1e-12 && z * w < -1e-12) return true;
  return (
    (Math.abs(x) < 1e-8 && pointSegment(c, a, b) < 1e-7) ||
    (Math.abs(y) < 1e-8 && pointSegment(d, a, b) < 1e-7)
  );
}
export function validateOutline(p: Vec2[]) {
  if (
    p.length < 5 ||
    p.length > 256 ||
    p.some(
      (a) =>
        a.length !== 2 || a.some((x) => !Number.isFinite(x) || Math.abs(x) > 5),
    )
  )
    throw new Error("Draw a larger, closed shape.");
  if (Math.abs(area(p)) < 0.035)
    throw new Error(
      "This shape is too thin to inflate. Try giving it a little more room.",
    );
  for (let i = 0; i < p.length; i++)
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) continue;
      if (intersects(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length]))
        throw new Error(
          "Your outline crosses itself. Draw one shape without crossing the line.",
        );
    }
}
export function prepareOutline(raw: Vec2[]): Vec2[] {
  const clean = raw.filter(
    (p, i) => i === 0 || distance(p, raw[i - 1]) > 0.006,
  );
  if (clean.length > 1 && distance(clean[0], clean[clean.length - 1]) < 0.025)
    clean.pop();
  if (clean.length < 5)
    throw new Error("Draw a larger shape before inflating.");
  // Arc-length resampling avoids densely sampled slow pointer motion.
  const lengths = clean.map((p, i) =>
    distance(p, clean[(i + 1) % clean.length]),
  );
  const perimeter = lengths.reduce((s, n) => s + n, 0);
  const count = Math.min(128, Math.max(32, Math.round(perimeter / 0.07)));
  const out: Vec2[] = [];
  let segment = 0,
    start = 0;
  for (let k = 0; k < count; k++) {
    const d = (k / count) * perimeter;
    while (segment < lengths.length - 1 && start + lengths[segment] < d)
      start += lengths[segment++];
    const a = clean[segment],
      b = clean[(segment + 1) % clean.length],
      t = (d - start) / (lengths[segment] || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  const smooth = out.map((p, i): Vec2 => {
    const a = out[(i + out.length - 1) % out.length],
      b = out[(i + 1) % out.length];
    return [p[0] * 0.8 + (a[0] + b[0]) * 0.1, p[1] * 0.8 + (a[1] + b[1]) * 0.1];
  });
  validateOutline(smooth);
  if (area(smooth) < 0) smooth.reverse();
  return smooth;
}
export function makeMesh(outline: Vec2[], inflation: number): MeshData {
  validateOutline(outline);
  const poly = area(outline) < 0 ? [...outline].reverse() : outline;
  const contour = poly.map((p) => new poly2tri.Point(p[0], p[1]));
  let triangulation = new poly2tri.SweepContext(contour, { cloneArrays: true });
  const minX = Math.min(...poly.map((p) => p[0])),
    maxX = Math.max(...poly.map((p) => p[0]));
  const minY = Math.min(...poly.map((p) => p[1])),
    maxY = Math.max(...poly.map((p) => p[1]));
  const spacing = Math.max(0.085, Math.sqrt(Math.abs(area(poly)) / 110));
  const all = [...contour];
  let row = 0;
  for (let y = minY + spacing * 0.65; y < maxY; y += spacing * 0.866) {
    for (let x = minX + spacing * (row % 2 ? 1 : 0.5); x < maxX; x += spacing) {
      if (
        inside([x, y], poly) &&
        boundaryDistance([x, y], poly) > spacing * 0.37
      ) {
        const p = new poly2tri.Point(x, y);
        all.push(p);
        triangulation.addPoint(p);
      }
    }
    row++;
  }
  if (all.length === contour.length)
    throw new Error(
      "This shape is too narrow to inflate. Try a wider outline.",
    );
  triangulation.triangulate();
  // A diagonal between boundary vertices would weld front and back internally.
  // Split those diagonals with interior points before mirroring the surface.
  const boundaryIds = new Map<poly2tri.IPointLike, number>(
    contour.map((p, i) => [p, i]),
  );
  for (let pass = 0; pass < 3; pass++) {
    const extra = new Map<string, poly2tri.Point>();
    for (const triangle of triangulation.getTriangles()) {
      const points = triangle.getPoints();
      for (let k = 0; k < 3; k++) {
        const a = points[k],
          b = points[(k + 1) % 3],
          ai = boundaryIds.get(a),
          bi = boundaryIds.get(b);
        if (
          ai === undefined ||
          bi === undefined ||
          Math.abs(ai - bi) === 1 ||
          Math.abs(ai - bi) === contour.length - 1
        )
          continue;
        const x = (a.x + b.x) / 2,
          y = (a.y + b.y) / 2;
        extra.set(
          `${x.toFixed(10)},${y.toFixed(10)}`,
          new poly2tri.Point(x, y),
        );
      }
    }
    if (!extra.size) break;
    all.push(...extra.values());
    triangulation = new poly2tri.SweepContext(contour, { cloneArrays: true });
    triangulation.addPoints(all.slice(contour.length));
    triangulation.triangulate();
  }
  const ids = new Map<poly2tri.IPointLike, number>(all.map((p, i) => [p, i]));
  const positions: number[] = [],
    seams: number[] = [];
  const n = contour.length,
    N = all.length;
  const distances = all.map((p) => boundaryDistance([p.x, p.y], poly));
  const maxD = Math.max(...distances, 0.05);
  const height = (i: number) =>
    inflation *
    Math.min(0.62, maxD * 0.8) *
    Math.sqrt(Math.max(0, 1 - Math.pow(1 - distances[i] / maxD, 2)));
  all.forEach((p, i) => {
    positions.push(p.x, p.y, i < n ? 0 : height(i));
    seams.push(distances[i]);
  });
  all.slice(n).forEach((p, j) => {
    positions.push(p.x, p.y, -height(j + n));
    seams.push(distances[j + n]);
  });
  const back = (i: number) => (i < n ? i : i + N - n);
  const indices: number[] = [];
  for (const triangle of triangulation.getTriangles()) {
    let [a, b, c] = triangle.getPoints().map((p) => ids.get(p)!);
    const p = all[a],
      q = all[b],
      r = all[c];
    if ((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) < 0)
      [b, c] = [c, b];
    indices.push(a, b, c, back(c), back(b), back(a));
  }
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    boundary: Array.from({ length: n }, (_, i) => i),
    seam: new Float32Array(seams),
  };
}
export function transformPositions(positions: Float32Array, b: Balloon) {
  const p = positions.slice();
  const [rx, ry, rz] = b.rotation.map((x) => (x * Math.PI) / 180);
  // Euler XYZ, matching Three.js: rotate Z, then Y, then X.
  for (let i = 0; i < p.length; i += 3) {
    let x = p[i] * b.scale,
      y = p[i + 1] * b.scale,
      z = p[i + 2] * b.scale;
    [x, y] = [
      x * Math.cos(rz) - y * Math.sin(rz),
      x * Math.sin(rz) + y * Math.cos(rz),
    ];
    [x, z] = [
      x * Math.cos(ry) + z * Math.sin(ry),
      -x * Math.sin(ry) + z * Math.cos(ry),
    ];
    [y, z] = [
      y * Math.cos(rx) - z * Math.sin(rx),
      y * Math.sin(rx) + z * Math.cos(rx),
    ];
    p[i] = x + b.position[0];
    p[i + 1] = y + b.position[1];
    p[i + 2] = z + b.position[2];
  }
  return p;
}
export function volume(p: Float32Array, triangles: Uint32Array) {
  let v = 0;
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t] * 3,
      b = triangles[t + 1] * 3,
      c = triangles[t + 2] * 3;
    v +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) +
      p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return v / 6;
}
export type Weight = [number, number][];
// One Loop subdivision pass expressed as weights over the simulation vertices.
export function subdivision(
  mesh: MeshData,
  levels = 2,
): { weights: Weight[]; indices: number[]; seam: number[] } {
  const neighbors: Set<number>[] = Array.from(
    { length: mesh.positions.length / 3 },
    () => new Set(),
  );
  const edges = new Map<
    string,
    { a: number; b: number; opposite: number[]; index: number }
  >();
  const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const tri = Array.from(mesh.indices.slice(t, t + 3));
    for (let k = 0; k < 3; k++) {
      const a = tri[k],
        b = tri[(k + 1) % 3],
        c = tri[(k + 2) % 3],
        key = edgeKey(a, b);
      neighbors[a].add(b);
      neighbors[b].add(a);
      if (!edges.has(key)) edges.set(key, { a, b, opposite: [], index: 0 });
      edges.get(key)!.opposite.push(c);
    }
  }
  const seamVertices = new Set(mesh.boundary);
  const weights: Weight[] = neighbors.map((ns, i) => {
    if (seamVertices.has(i)) {
      const seamNeighbors = Array.from(ns).filter((n) => seamVertices.has(n));
      if (seamNeighbors.length === 2)
        return [
          [i, 0.75],
          [seamNeighbors[0], 0.125],
          [seamNeighbors[1], 0.125],
        ];
    }
    const beta = ns.size === 3 ? 3 / 16 : 3 / (8 * ns.size);
    return [
      [i, 1 - ns.size * beta],
      ...Array.from(ns).map((n): [number, number] => [n, beta]),
    ];
  });
  for (const edge of edges.values()) {
    edge.index = weights.length;
    if (seamVertices.has(edge.a) && seamVertices.has(edge.b))
      weights.push([
        [edge.a, 0.5],
        [edge.b, 0.5],
      ]);
    else
      weights.push([
        [edge.a, 3 / 8],
        [edge.b, 3 / 8],
        ...edge.opposite.map((n): [number, number] => [n, 1 / 8]),
      ]);
  }
  const indices: number[] = [];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = Array.from(mesh.indices.slice(t, t + 3));
    const ab = edges.get(edgeKey(a, b))!.index,
      bc = edges.get(edgeKey(b, c))!.index,
      ca = edges.get(edgeKey(c, a))!.index;
    indices.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
  }
  const seam = weights.map((w) =>
    w.reduce((s, [i, k]) => s + mesh.seam[i] * k, 0),
  );
  if (levels > 1) {
    const positions = new Float32Array(weights.length * 3);
    applyWeights(mesh.positions, weights, positions);
    const next = subdivision(
      {
        positions,
        indices: new Uint32Array(indices),
        seam: new Float32Array(seam),
        boundary: [
          ...mesh.boundary,
          ...Array.from(edges.values())
            .filter((e) => seamVertices.has(e.a) && seamVertices.has(e.b))
            .map((e) => e.index),
        ],
      },
      levels - 1,
    );
    const combined = next.weights.map((w) => {
      const totals = new Map<number, number>();
      for (const [j, factor] of w)
        for (const [i, value] of weights[j])
          totals.set(i, (totals.get(i) || 0) + factor * value);
      return Array.from(totals.entries());
    });
    return { weights: combined, indices: next.indices, seam: next.seam };
  }
  return { weights, indices, seam };
}
export function applyWeights(
  coarse: Float32Array,
  weights: Weight[],
  target: Float32Array,
) {
  weights.forEach((w, j) => {
    for (let a = 0; a < 3; a++)
      target[j * 3 + a] = w.reduce((v, [i, k]) => v + coarse[i * 3 + a] * k, 0);
  });
}
export function center(p: Float32Array): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (let i = 0; i < p.length; i++) c[i % 3] += p[i] / (p.length / 3);
  return c;
}
