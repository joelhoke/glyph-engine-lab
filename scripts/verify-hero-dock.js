#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const THREE = require('three')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'tmp-verify-hero-dock')
execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
  'components/home/heroDock.ts', 'components/home/renderers/phoneHinge.ts',
  'components/home/renderers/crtPower.ts', 'components/home/renderers/screenSurface.ts',
  'components/home/renderers/gltfModel.ts',
  'components/home/renderers/phoneScreenGeometry.ts',
  'components/home/renderers/phoneSectionPose.ts',
  'components/home/renderers/phoneModelKeys.ts',
  'components/home/renderers/phoneKeyFeedback.ts',
  'components/home/renderers/screenProjection.ts',
  '--outDir', out, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
], { cwd: root, stdio: 'inherit' })
const { dockWeights, dockPosition } = require(path.join(out, 'components/home/heroDock.js'))
const { createPhoneHinge } = require(path.join(out, 'components/home/renderers/phoneHinge.js'))
const { crtPower } = require(path.join(out, 'components/home/renderers/crtPower.js'))
const { applyScreenSurface } = require(path.join(out, 'components/home/renderers/screenSurface.js'))
const { normalizeModel } = require(path.join(out, 'components/home/renderers/gltfModel.js'))
const { createPhoneKeyFeedback } = require(path.join(out, 'components/home/renderers/phoneKeyFeedback.js'))
const { phoneModelKeyAtUv, PHONE_MODEL_KEYS } = require(path.join(out, 'components/home/renderers/phoneModelKeys.js'))
const { phoneScreenCorners } = require(path.join(out, 'components/home/renderers/phoneScreenGeometry.js'))
const { screenProjection } = require(path.join(out, 'components/home/renderers/screenProjection.js'))
const { PHONE_SECTION_POSES } = require(path.join(out, 'components/home/renderers/phoneSectionPose.js'))
assert.deepEqual(dockWeights(null), [0, 0, 0, 0, 0])
assert.equal(dockPosition(640, 640, 120), 2)
assert.equal(dockPosition(-10000, 640, 120), 0)
assert.equal(dockPosition(10000, 640, 120), 4)
for (let position = 0; position <= 4; position += 0.02) {
  const weights = dockWeights(position)
  assert(weights.every(w => w >= 0 && w <= 1))
  assert(weights[Math.round(position)] >= Math.max(...weights) - 1e-9)
  const next = dockWeights(position + 0.001)
  assert(weights.every((w, i) => Math.abs(w - next[i]) < 0.002), 'magnification must remain continuous')
}
assert.deepEqual(crtPower(0, true), { picture: 0, pulse: 0 })
assert.deepEqual(crtPower(1, true), { picture: 1, pulse: 0 }, 'reduced motion must skip the blink')
assert(crtPower(0.23, true).pulse > 0.99)
assert.deepEqual(crtPower(0.45, true), { picture: 0, pulse: 0 })
assert.deepEqual(crtPower(0.4, false), { picture: 0.4, pulse: 0 }, 'shutdown must not blink backwards')
console.log('PASS: continuous dock magnification and CRT startup/shutdown states')

// Reconstruct the shipped phone geometry and node transforms, without a
// browser or textures, to verify the actual lid rather than a substitute box.
const modelDir = path.join(root, 'public/assets/home/models/phone')
const gltf = JSON.parse(fs.readFileSync(path.join(modelDir, 'scene.gltf'), 'utf8'))
const buffers = gltf.buffers.map(buffer => fs.readFileSync(path.join(modelDir, buffer.uri)))
function attribute(index) {
  const accessor = gltf.accessors[index]
  const view = gltf.bufferViews[accessor.bufferView]
  assert.equal(accessor.componentType, 5126)
  const size = { VEC2: 2, VEC3: 3 }[accessor.type]
  const values = []
  for (let i = 0; i < accessor.count; i++) for (let j = 0; j < size; j++) {
    values.push(buffers[view.buffer].readFloatLE((view.byteOffset || 0) + (accessor.byteOffset || 0) +
      i * (view.byteStride || size * 4) + j * 4))
  }
  return new THREE.Float32BufferAttribute(values, size)
}
const nodes = gltf.nodes.map(node => {
  const object = new THREE.Group()
  if (node.matrix) object.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix))
  if (node.mesh !== undefined) {
    const primitive = gltf.meshes[node.mesh].primitives[0]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', attribute(primitive.attributes.POSITION))
    geometry.setAttribute('uv', attribute(primitive.attributes.TEXCOORD_0))
    const indices = gltf.accessors[primitive.indices]
    const indexView = gltf.bufferViews[indices.bufferView]
    assert.equal(indices.componentType, 5125)
    geometry.setIndex(Array.from({ length: indices.count }, (_, i) => buffers[indexView.buffer].readUInt32LE(
      (indexView.byteOffset || 0) + (indices.byteOffset || 0) + i * 4)))
    object.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()))
  }
  return object
})
gltf.nodes.forEach((node, i) => (node.children || []).forEach(child => nodes[i].add(nodes[child])))
const scene = new THREE.Group()
gltf.scenes[0].nodes.forEach(index => scene.add(nodes[index]))
const model = normalizeModel(THREE, scene, 1.9)
model.updateMatrixWorld(true)
const meshes = []
model.traverse(node => { if (node.isMesh) meshes.push(node) })
const originalMatrices = meshes.map(mesh => mesh.matrixWorld.clone())
const rig = createPhoneHinge(THREE, model)
rig.setOpen(1)
model.updateMatrixWorld(true)
meshes.forEach((mesh, i) => assert(mesh.matrixWorld.elements.every((v, j) => Math.abs(v - originalMatrices[i].elements[j]) < 1e-7),
  'open rig must preserve original model placement'))
const surface = applyScreenSurface(THREE, model, {
  matchMesh: mesh => mesh === rig.lid, texture: new THREE.Texture(),
  uvAxes: ['x', 'y'], recess: 0.004, original: 'keep', transparent: true,
})
assert(surface)
const screen = rig.hinge.children.find(child => child !== rig.lid)
const base = meshes.find(mesh => mesh !== rig.lid)
for (const amount of [0, 0.25, 0.5, 0.75, 1]) {
  rig.setOpen(amount)
  model.rotation.set(0.471 + amount * 0.38, 0.035 - amount * 0.38, 0)
  model.updateMatrixWorld(true)
  assert(screen.matrixWorld.elements.every((v, i) => Math.abs(v - rig.lid.matrixWorld.elements[i]) < 1e-7),
    'screen must stay registered to the hinged lid through opening and pointer tilt')
}
model.rotation.set(0, 0, 0)
rig.setOpen(0)
model.updateMatrixWorld(true)
const closed = new THREE.Box3().setFromObject(rig.lid)
const keypad = new THREE.Box3().setFromObject(base)
assert(closed.min.y > keypad.max.y, 'closed lid must sit above the keypad without intersection')
assert(closed.max.z <= keypad.max.z + 0.03 && closed.min.z >= keypad.min.z - 0.03,
  'closed lid must fold onto the keypad footprint')
surface.dispose()
console.log('PASS: shipped phone closes above keypad; screen tracks hinge and tilt without drift')

// The section's real HTML composer must register to the LCD at both phone
// and desktop sizes. Check CSS homogeneous division, not just its matrix.
for (const [width, height] of [[320, 780], [375, 780], [640, 900]]) {
 for (const tilt of [-0.18, 0, 0.18, PHONE_SECTION_POSES.mobile.x * Math.PI / 180]) {
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 50)
  camera.position.set(0, 0, 4.6)
  camera.updateMatrixWorld(true)
  rig.setOpen(1)
  model.rotation.set(tilt, tilt === PHONE_SECTION_POSES.mobile.x * Math.PI / 180 ? 0 : -tilt, 0)
  model.updateMatrixWorld(true)
  const corners = phoneScreenCorners(THREE, rig.lid).map(point => {
    point.project(camera)
    return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 }
  })
  assert(corners.every(p => p.x > 0 && p.x < width && p.y > 0 && p.y < height), 'LCD stays inside the visible canvas')
  assert(corners[1].x - corners[0].x >= 175, 'the mobile composer must remain readable')
  const matrix = screenProjection(corners, 240, 320)
  assert(matrix)
  ;[[0, 0], [240, 0], [240, 320], [0, 320]].forEach(([x, y], i) => {
    const w = matrix[3] * x + matrix[7] * y + matrix[15]
    const projectedX = (matrix[0] * x + matrix[4] * y + matrix[12]) / w
    const projectedY = (matrix[1] * x + matrix[5] * y + matrix[13]) / w
    assert(Math.abs(projectedX - corners[i].x) < 1e-6)
    assert(Math.abs(projectedY - corners[i].y) < 1e-6)
  })
 }
}
// Raycast actual indexed phone triangles at printed key positions. The UV
// interpolation is independent of the hit-region lookup and honors occlusion.
function pointAtUv(mesh, target) {
  const { position, uv } = mesh.geometry.attributes
  const indices = mesh.geometry.index
  for (let i = 0; i < indices.count; i += 3) {
    const ids = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)]
    const points = ids.map(id => new THREE.Vector3(uv.getX(id), uv.getY(id), 0))
    const weights = THREE.Triangle.getBarycoord(new THREE.Vector3(target.x, target.y, 0), ...points, new THREE.Vector3())
    if (!weights || Math.min(weights.x, weights.y, weights.z) < -1e-6) continue
    const local = ids.reduce((v, id, j) => v.addScaledVector(new THREE.Vector3().fromBufferAttribute(position, id), weights.getComponent(j)), new THREE.Vector3())
    return mesh.localToWorld(local)
  }
  return null
}
const keyCamera = new THREE.PerspectiveCamera(32, 640 / 900, 0.1, 50)
keyCamera.position.set(0, 0, 4.6)
keyCamera.updateMatrixWorld(true)
const raycaster = new THREE.Raycaster()
let picked = new Set()
for (const x of [0, 0.12, 0.18]) {
  model.rotation.set(x, 0, 0)
  rig.setOpen(1)
  model.updateMatrixWorld(true)
  for (const region of PHONE_MODEL_KEYS) {
    const uv = { x: region.u, y: region.v }
    assert.equal(phoneModelKeyAtUv(uv), region.key)
    const world = pointAtUv(rig.base, uv)
    assert(world, `printed ${region.key} region must exist on the actual base mesh`)
    const projected = world.clone().project(keyCamera)
    raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), keyCamera)
    const hit = raycaster.intersectObject(model, true)[0]
    if (hit?.object !== rig.base || hit.point.distanceTo(world) > 0.01) continue // physically occluded
    assert.equal(phoneModelKeyAtUv(hit.uv), region.key, `visible ${region.key} key is picked through its real UVs`)
    picked.add(region.key)
  }
}
assert([...('123456789*0#')].every(key => picked.has(key)), 'every number/symbol key is discoverable at the original pose or normal pointer tilt')
model.rotation.set(PHONE_SECTION_POSES.mobile.x * Math.PI / 180, PHONE_SECTION_POSES.mobile.y * Math.PI / 180, 0)
model.updateMatrixWorld(true)
for (const width of [288, 320, 375, 430]) {
  keyCamera.aspect = width / 780
  keyCamera.updateProjectionMatrix()
  for (const region of PHONE_MODEL_KEYS) {
    const world = pointAtUv(rig.base, { x: region.u, y: region.v })
    const projected = world.clone().project(keyCamera)
    assert(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, `mobile ${region.key} stays in the viewport`)
    raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), keyCamera)
    const hit = raycaster.intersectObject(model, true)[0]
    assert(hit?.object === rig.base && hit.point.distanceTo(world) < 0.01, `mobile ${region.key} remains exposed`)
    assert.equal(phoneModelKeyAtUv(hit.uv), region.key)
  }
}
console.log('PASS: mobile phone pose exposes every real keypad control at narrow widths')
assert.equal(phoneModelKeyAtUv({ x: 0.2, y: 0.4 }), null, 'screen/back atlas regions do not type')
assert.equal(phoneModelKeyAtUv({ x: 0.469, y: 0.70 }), null, 'gaps between keys do not type')
console.log('PASS: original model keys raycast correctly; hidden surfaces and gaps are not button overlays')
const sourceKeyGeometry = rig.base.geometry
const sourceKeyBounds = sourceKeyGeometry.boundingBox.clone()
let feedbackTime = 0
const feedback = createPhoneKeyFeedback(THREE, rig.base, () => feedbackTime)
assert(rig.base.geometry.boundingBox.equals(sourceKeyBounds), 'keypad refinement preserves the model silhouette')
const keyPositions = rig.base.geometry.getAttribute('position')
const originalKeyPositions = Array.from(keyPositions.array)
const shader = { uniforms: {}, fragmentShader: '#include <emissivemap_fragment>' }
rig.base.material.onBeforeCompile(shader, {})
assert(shader.fragmentShader.includes('texture2D(map, vMapUv)'), 'backlight follows the original printed legends')
for (const key of PHONE_MODEL_KEYS) {
  feedback.setHover(key)
  feedback.setPressed(key)
  feedback.step(16, true)
  assert(keyPositions.array.some((value, i) => value !== originalKeyPositions[i]), `${key.key} deforms the existing key geometry`)
  assert(shader.uniforms.phoneHoverLight.value > 0 && shader.uniforms.phonePressLight.value > 0)
  feedback.setPressed(null)
  feedback.setHover(null)
  feedback.step(16, true)
  assert.deepEqual(Array.from(keyPositions.array), originalKeyPositions, 'release restores the original model exactly')
  assert.equal(feedback.needsFrames(), false, 'reduced-motion release settles immediately')
}
feedback.setPressed(PHONE_MODEL_KEYS[1])
feedback.setPressed(null) // click faster than one display frame
feedback.step(16, false)
assert(feedback.needsFrames(), 'quick clicks still have visible press feedback')
assert(keyPositions.array.some((value, i) => value !== originalKeyPositions[i]))
for (let i = 0; i < 100; i++) { feedbackTime += 16; feedback.step(16, false) }
assert.equal(feedback.needsFrames(), false, 'idle feedback parks its animation loop')
assert.deepEqual(Array.from(keyPositions.array), originalKeyPositions)
feedback.dispose()
assert.equal(rig.base.geometry, sourceKeyGeometry, 'feedback cleanup restores the original geometry')
console.log('PASS: original key legends illuminate, every key depresses and restores, quick clicks register, and idle feedback parks')

const skew = [{ x: 20, y: 50 }, { x: 210, y: 10 }, { x: 290, y: 380 }, { x: 10, y: 290 }]
const matrix = screenProjection(skew, 240, 320)
;[[0, 0], [240, 0], [240, 320], [0, 320]].forEach(([x, y], i) => {
  const w = matrix[3] * x + matrix[7] * y + matrix[15]
  assert(Math.abs((matrix[0] * x + matrix[4] * y + matrix[12]) / w - skew[i].x) < 1e-6)
  assert(Math.abs((matrix[1] * x + matrix[5] * y + matrix[13]) / w - skew[i].y) < 1e-6)
})
assert.equal(screenProjection(Array(4).fill({ x: 0, y: 0 }), 240, 320), null)
console.log('PASS: native chat fits the shipped LCD at section tilt extremes; perspective projection has no corner drift')
