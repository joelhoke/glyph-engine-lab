import { PHONE_MODEL_KEYS } from './phoneModelKeys'

/** Add vertices within existing keypad faces without changing their shape,
 *  UVs, or artwork. The imported mesh has too few vertices for some keys to
 *  travel independently; local subdivision gives each printed key support. */
export function refinePhoneKeypad(THREE: typeof import('three'), source: import('three').BufferGeometry) {
  const flat = source.index ? source.toNonIndexed() : source.clone()
  const names = Object.keys(flat.attributes)
  const sizes = names.map(name => flat.getAttribute(name).itemSize)
  const offsets = sizes.map((_, index) => sizes.slice(0, index).reduce((a, b) => a + b, 0))
  const uvOffset = offsets[names.indexOf('uv')]
  const output: number[][] = names.map(() => [])
  let count = 0
  const groups: { start: number; count: number; materialIndex: number }[] = []
  const emit = (vertices: number[][]) => {
    for (const vertex of vertices) names.forEach((_, index) => {
      output[index].push(...vertex.slice(offsets[index], offsets[index] + sizes[index]))
    })
    count += 3
  }
  const split = (a: number[], b: number[], c: number[], depth: number) => {
    const u = [a[uvOffset], b[uvOffset], c[uvOffset]]
    const v = [a[uvOffset + 1], b[uvOffset + 1], c[uvOffset + 1]]
    const minU = Math.min(...u), maxU = Math.max(...u), minV = Math.min(...v), maxV = Math.max(...v)
    const nearKey = PHONE_MODEL_KEYS.some(key => maxU >= key.u - key.halfWidth && minU <= key.u + key.halfWidth &&
      maxV >= key.v - key.halfHeight && minV <= key.v + key.halfHeight)
    if (!nearKey || depth === 5 || Math.max(maxU - minU, maxV - minV) <= 0.016) { emit([a, b, c]); return }
    const mid = (x: number[], y: number[]) => x.map((value, i) => (value + y[i]) / 2)
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a)
    split(a, ab, ca, depth + 1); split(ab, b, bc, depth + 1)
    split(ca, bc, c, depth + 1); split(ab, bc, ca, depth + 1)
  }
  for (let i = 0; i < flat.getAttribute('position').count; i += 3) {
    const start = count
    const vertices = [i, i + 1, i + 2].map(vertex => names.flatMap(name => {
      const attribute = flat.getAttribute(name)
      return Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(vertex, component))
    }))
    split(vertices[0], vertices[1], vertices[2], 0)
    if (flat.groups.length) {
      const materialIndex = flat.groups.find(group => i >= group.start && i < group.start + group.count)?.materialIndex ?? 0
      const previous = groups[groups.length - 1]
      if (previous?.materialIndex === materialIndex) previous.count += count - start
      else groups.push({ start, count: count - start, materialIndex })
    }
  }
  const geometry = new THREE.BufferGeometry()
  names.forEach((name, index) => geometry.setAttribute(name, new THREE.Float32BufferAttribute(output[index], sizes[index])))
  groups.forEach(group => geometry.addGroup(group.start, group.count, group.materialIndex))
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  flat.dispose()
  return geometry
}
