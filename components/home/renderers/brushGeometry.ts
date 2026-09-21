/** A gentle Loop subdivision pass for the low-poly brush. Weld positions
 *  for smoothing, but interpolate each face's UVs separately so atlas seams
 *  stay intact. A partial blend keeps the handle and painted tip recognizable. */
export function softenBrushGeometry(THREE: typeof import('three'), source: import('three').BufferGeometry) {
  const position = source.getAttribute('position'), uv = source.getAttribute('uv')
  const vertices: import('three').Vector3[] = []
  const ids: number[] = [], byPosition = new Map<string, number>()
  for (let i = 0; i < position.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, i)
    const key = point.toArray().map(v => Math.round(v * 1e6)).join(',')
    let id = byPosition.get(key)
    if (id === undefined) { id = vertices.length; vertices.push(point); byPosition.set(key, id) }
    ids.push(id)
  }
  const neighbors = vertices.map(() => new Set<number>())
  const edges = new Map<string, { a: number; b: number; opposite: number[] }>()
  const faces: number[][] = []
  const keyFor = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`
  const count = source.index?.count ?? position.count
  for (let i = 0; i < count; i += 3) {
    const face = [0, 1, 2].map(j => source.index ? source.index.getX(i + j) : i + j)
    faces.push(face)
    for (let j = 0; j < 3; j++) {
      const a = ids[face[j]], b = ids[face[(j + 1) % 3]], c = ids[face[(j + 2) % 3]]
      neighbors[a].add(b); neighbors[b].add(a)
      const key = keyFor(a, b)
      const edge = edges.get(key) ?? { a, b, opposite: [] }
      edge.opposite.push(c)
      edges.set(key, edge)
    }
  }
  const blend = 0.4
  const smoothed = vertices.map((point, id) => {
    const adjacent = [...neighbors[id]]
    const boundary = adjacent.filter(other => edges.get(keyFor(id, other))!.opposite.length !== 2)
    let next = point.clone()
    if (boundary.length === 2) {
      next.multiplyScalar(0.75).addScaledVector(vertices[boundary[0]], 0.125).addScaledVector(vertices[boundary[1]], 0.125)
    } else if (boundary.length === 0 && adjacent.length >= 3) {
      const beta = adjacent.length === 3 ? 3 / 16 : 3 / (8 * adjacent.length)
      next.multiplyScalar(1 - adjacent.length * beta)
      adjacent.forEach(other => next.addScaledVector(vertices[other], beta))
    }
    return point.clone().lerp(next, blend)
  })
  const midpoints = new Map<string, import('three').Vector3>()
  edges.forEach((edge, key) => {
    const midpoint = vertices[edge.a].clone().add(vertices[edge.b]).multiplyScalar(0.5)
    if (edge.opposite.length === 2) {
      const next = vertices[edge.a].clone().add(vertices[edge.b]).multiplyScalar(3 / 8)
        .addScaledVector(vertices[edge.opposite[0]], 1 / 8).addScaledVector(vertices[edge.opposite[1]], 1 / 8)
      midpoint.lerp(next, blend)
    }
    midpoints.set(key, midpoint)
  })
  const positions: number[] = [], uvs: number[] = []
  for (const face of faces) {
    const points = face.map(id => smoothed[ids[id]])
    const coords = face.map(id => new THREE.Vector2(uv.getX(id), uv.getY(id)))
    for (let j = 0; j < 3; j++) {
      points.push(midpoints.get(keyFor(ids[face[j]], ids[face[(j + 1) % 3]]))!)
      coords.push(coords[j].clone().lerp(coords[(j + 1) % 3], 0.5))
    }
    for (const triangle of [[0, 3, 5], [3, 1, 4], [5, 4, 2], [3, 4, 5]]) {
      triangle.forEach(id => { positions.push(...points[id].toArray()); uvs.push(...coords[id].toArray()) })
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
