#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

async function main() {
  const THREE = await import('three')
  const { toCreasedNormals } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')
  const root = path.resolve(__dirname, '..')
  const out = path.join(root, 'tmp-verify-hero-brush')
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
    'components/home/renderers/brushGeometry.ts', 'components/home/renderers/brushFinish.ts',
    '--outDir', out, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
  ], { cwd: root, stdio: 'inherit' })
  const { softenBrushGeometry } = require(path.join(out, 'brushGeometry.js'))
  const { createBrushFinish } = require(path.join(out, 'brushFinish.js'))
  const modelDir = path.join(root, 'public/assets/home/models/brush')
  const gltf = JSON.parse(fs.readFileSync(path.join(modelDir, 'scene.gltf'), 'utf8'))
  const buffers = gltf.buffers.map(buffer => fs.readFileSync(path.join(modelDir, buffer.uri)))
  for (const image of gltf.images) assert(fs.existsSync(path.join(modelDir, image.uri)), 'all texture assets must ship')
  assert(fs.readFileSync(path.join(modelDir, 'license.txt'), 'utf8').includes('NotThatGuy'))
  function attribute(index) {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView]
    const size = { VEC2: 2, VEC3: 3, SCALAR: 1 }[accessor.type]
    const values = []
    for (let i = 0; i < accessor.count; i++) for (let j = 0; j < size; j++) {
      const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0) + i * (view.byteStride || size * 4) + j * 4
      values.push(accessor.componentType === 5126 ? buffers[view.buffer].readFloatLE(offset) : buffers[view.buffer].readUInt32LE(offset))
    }
    return accessor.componentType === 5126 ? new THREE.Float32BufferAttribute(values, size) : new THREE.Uint32BufferAttribute(values, size)
  }
  const primitive = gltf.meshes[0].primitives[0]
  const source = new THREE.BufferGeometry()
  source.setAttribute('position', attribute(primitive.attributes.POSITION))
  source.setAttribute('uv', attribute(primitive.attributes.TEXCOORD_0))
  source.setIndex(attribute(primitive.indices))
  source.computeBoundingBox()
  const original = source.attributes.position.array.slice()
  const result = toCreasedNormals(softenBrushGeometry(THREE, source), Math.PI / 2)
  assert.equal(result.attributes.position.count, source.index.count * 4, 'one bounded subdivision pass')
  assert.deepEqual(source.attributes.position.array, original, 'source model must stay untouched')
  const sourceSize = source.boundingBox.getSize(new THREE.Vector3())
  const resultSize = result.boundingBox.getSize(new THREE.Vector3())
  for (const axis of ['x', 'y', 'z']) assert(resultSize[axis] / sourceSize[axis] > 0.9 && resultSize[axis] / sourceSize[axis] <= 1.001,
    'smoothing must preserve the brush proportions')
  for (const attribute of Object.values(result.attributes)) assert([...attribute.array].every(Number.isFinite))
  const p = result.attributes.position, n = result.attributes.normal
  let smoothCorners = 0
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i)
    const b = new THREE.Vector3().fromBufferAttribute(p, i + 1)
    const c = new THREE.Vector3().fromBufferAttribute(p, i + 2)
    const face = b.sub(a).cross(c.sub(a))
    assert(face.length() > 1e-10, 'smoothing must not collapse triangles')
    face.normalize()
    for (let j = 0; j < 3; j++) {
      const normal = new THREE.Vector3().fromBufferAttribute(n, i + j)
      assert(Math.abs(normal.length() - 1) < 1e-5, 'shading normals must remain normalized')
      if (normal.dot(face) < 0.999) smoothCorners++
    }
  }
  assert(smoothCorners > p.count / 2, 'most corners must shade smoothly rather than as flat triangles')
  const originalUv = source.attributes.uv, smoothedUv = result.attributes.uv
  for (const axis of ['getX', 'getY']) {
    const values = Array.from({ length: originalUv.count }, (_, i) => originalUv[axis](i))
    const low = Math.min(...values), high = Math.max(...values)
    for (let i = 0; i < smoothedUv.count; i++) assert(smoothedUv[axis](i) >= low - 1e-7 && smoothedUv[axis](i) <= high + 1e-7,
      'UVs must stay within the original brush atlas region')
  }
  const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() })
  const mesh = new THREE.Mesh(result, material)
  const originalMap = material.map
  const tint = createBrushFinish(THREE, mesh)
  const shader = { uniforms: {}, fragmentShader: '#include <map_fragment>' }
  material.onBeforeCompile(shader)
  assert(shader.fragmentShader.includes('float pigment'))
  assert(shader.fragmentShader.includes('diffuseColor *= sampledDiffuseColor;'))
  assert.equal(material.map, originalMap, 'tip treatment must preserve the handle texture')
  tint('#8abaff')
  assert.equal(shader.uniforms.brushTipColor.value.getHexString(), '8abaff')
  tint('#528ed1')
  assert.equal(shader.uniforms.brushTipColor.value.getHexString(), '528ed1', 'theme tint must update the existing shader')
  console.log(`PASS: brush assets, ${p.count / 3} valid smoothed triangles, preserved proportions/UVs, smooth normals and live tip tint`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
