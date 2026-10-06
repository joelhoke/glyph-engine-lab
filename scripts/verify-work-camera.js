#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const THREE = require('three')
const dir = 'public/assets/home/models/crt'
const gltf = JSON.parse(fs.readFileSync(path.join(dir, 'scene.gltf')))
const buffers = gltf.buffers.map(b => fs.readFileSync(path.join(dir, b.uri)))
const nodes = gltf.nodes.map(node => {
  const object = new THREE.Group()
  if (node.matrix) object.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix))
  if (node.translation) object.position.fromArray(node.translation)
  if (node.rotation) object.quaternion.fromArray(node.rotation)
  if (node.scale) object.scale.fromArray(node.scale)
  for (const primitive of gltf.meshes[node.mesh]?.primitives ?? []) {
    const a = gltf.accessors[primitive.attributes.POSITION]
    const view = gltf.bufferViews[a.bufferView]
    assert.equal(a.componentType, 5126)
    const positions = new Float32Array(a.count * 3)
    for (let i = 0; i < a.count; i++) for (let axis = 0; axis < 3; axis++) {
      positions[i * 3 + axis] = buffers[view.buffer].readFloatLE((view.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (view.byteStride ?? 12) + axis * 4)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    object.add(new THREE.Mesh(geometry))
  }
  return object
})
gltf.nodes.forEach((node, i) => node.children?.forEach(child => nodes[i].add(nodes[child])))
const model = new THREE.Group()
gltf.scenes[gltf.scene ?? 0].nodes.forEach(i => model.add(nodes[i]))
const original = new THREE.Box3().setFromObject(model)
model.position.copy(original.getCenter(new THREE.Vector3())).negate()
const wrapper = new THREE.Group()
wrapper.add(model)
const size = original.getSize(new THREE.Vector3())
wrapper.scale.setScalar(2 / Math.max(size.x, size.y, size.z))
const bounds = new THREE.Box3().setFromObject(wrapper)
const corners = []
for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z))
for (const width of [288, 360, 600, 900]) {
  const height = width / 1.2
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 50)
  camera.position.z = 4.6
  camera.updateMatrixWorld(true)
  const originalCamera = camera.clone()
  camera.setViewOffset(width, height, -width * 0.2, -height * 0.2, width * 1.4, height * 1.4)
  camera.updateProjectionMatrix()
  for (let dx = -0.18; dx <= 0.181; dx += 0.03) for (let dy = -0.18; dy <= 0.181; dy += 0.03) {
    const rotation = new THREE.Euler(10 * Math.PI / 180 + dx, -12 * Math.PI / 180 + dy, 0)
    for (const corner of corners) {
      const point = corner.clone().applyEuler(rotation)
      const before = point.clone().project(originalCamera)
      const after = point.clone().project(camera)
      assert(Math.abs(after.x) < 1 && Math.abs(after.y) < 1, 'entire CRT and stand fit the expanded canvas through cursor tilt')
      const beforePixel = [(before.x + 1) * width / 2, (1 - before.y) * height / 2]
      const afterPixel = [(after.x + 1) * width * 1.4 / 2 - width * 0.2, (1 - after.y) * height * 1.4 / 2 - height * 0.2]
      assert(beforePixel.every((v, i) => Math.abs(v - afterPixel[i]) < 1e-8), 'expanded canvas preserves the original pixel size and placement')
    }
  }
}
console.log('PASS: CRT keeps its original pixel size and fits the expanded canvas at every cursor tilt')
