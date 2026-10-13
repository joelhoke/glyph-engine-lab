import assert from 'node:assert/strict'
import { MeshoptSimplifier } from 'meshoptimizer'

// Shared derivative builder: preserve nodes/materials and compact surviving attributes.
export async function optimizeGlbGeometry(doc, binary, { ratio = .35, error = .003, minVertices = 3000, transformImage = bytes => bytes } = {}) {
  await MeshoptSimplifier.ready
  assert.ok(!doc.skins?.length && !doc.animations?.length, 'Only static model geometry is supported')
  const original = structuredClone(doc)
  const chunks = []; let length = 0
  doc.bufferViews = []; doc.accessors = []
  const view = (bytes, target) => {
    const index = doc.bufferViews.length
    doc.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, ...(target ? { target } : {}) })
    chunks.push(bytes); length += bytes.length
    const padding = (4 - length % 4) % 4
    if (padding) { chunks.push(Buffer.alloc(padding)); length += padding }
    return index
  }
  const raw = index => {
    const a = original.accessors[index], v = original.bufferViews[a.bufferView]
    assert.ok(!a.sparse, 'Sparse accessor needs explicit support')
    const componentSize = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType]
    const count = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]
    assert.ok(componentSize && count)
    const stride = componentSize * count, bytes = Buffer.alloc(a.count * stride)
    for (let i = 0; i < a.count; i++) {
      const start = (v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || stride)
      binary.copy(bytes, i * stride, start, start + stride)
    }
    return { a, bytes, stride }
  }
  let trianglesBefore = 0, trianglesAfter = 0
  for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
    assert.ok(!primitive.targets && (primitive.mode ?? 4) === 4)
    const position = raw(primitive.attributes.POSITION)
    assert.equal(position.a.componentType, 5126)
    const positions = new Float32Array(position.bytes.buffer, position.bytes.byteOffset, position.bytes.length / 4)
    const sourceIndices = primitive.indices === undefined ? null : raw(primitive.indices)
    const count = sourceIndices?.a.count ?? position.a.count
    let indices = Uint32Array.from({ length: count }, (_, i) => !sourceIndices ? i :
      sourceIndices.a.componentType === 5125 ? sourceIndices.bytes.readUInt32LE(i * 4) :
      sourceIndices.a.componentType === 5123 ? sourceIndices.bytes.readUInt16LE(i * 2) : sourceIndices.bytes[i])
    trianglesBefore += indices.length / 3
    if (position.a.count > minVertices) {
      // Preserve boundaries/UV seams and limit geometric error to 0.3%.
      ;[indices] = MeshoptSimplifier.simplify(indices, positions, 3, Math.floor(indices.length * ratio / 3) * 3, error, ['LockBorder'])
    }
    trianglesAfter += indices.length / 3
    const [remap, vertices] = MeshoptSimplifier.compactMesh(indices)
    for (const [attribute, index] of Object.entries(primitive.attributes)) {
      const { a, bytes, stride } = raw(index), compact = Buffer.alloc(vertices * stride)
      for (let i = 0; i < a.count; i++) if (remap[i] < vertices) bytes.copy(compact, remap[i] * stride, i * stride, (i + 1) * stride)
      if (a.componentType === 5126 && a.min && a.max) {
        const components = stride / 4
        a.min = Array(components).fill(Infinity); a.max = Array(components).fill(-Infinity)
        for (let i = 0; i < vertices; i++) for (let c = 0; c < components; c++) {
          const value = compact.readFloatLE(i * stride + c * 4)
          a.min[c] = Math.min(a.min[c], value); a.max[c] = Math.max(a.max[c], value)
        }
      }
      primitive.attributes[attribute] = doc.accessors.length
      doc.accessors.push({ ...a, byteOffset: 0, count: vertices, bufferView: view(compact, 34962) })
    }
    primitive.indices = doc.accessors.length
    doc.accessors.push({ componentType: 5125, type: 'SCALAR', count: indices.length,
      bufferView: view(Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength), 34963) })
  }
  for (const image of doc.images ?? []) {
    const v = original.bufferViews[image.bufferView]
    const bytes = binary.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)
    const optimized = await transformImage(bytes, image)
    image.bufferView = view(optimized)
  }
  doc.buffers = [{ byteLength: length }]
  return { binary: Buffer.concat(chunks), trianglesBefore, trianglesAfter }
}
