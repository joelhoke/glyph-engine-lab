#!/usr/bin/env node
// Geometry regressions for relief contours plus material isolation checks.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const THREE = require('three')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'tmp-verify-hero-finishes')
execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
  'components/home/renderers/splatRelief.ts', 'components/home/renderers/blueFinish.ts',
  '--outDir', out, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
], { cwd: root, stdio: 'inherit' })
const { splatSidePositions } = require(path.join(out, 'splatRelief.js'))
const { createBlueFinish } = require(path.join(out, 'blueFinish.js'))

function trace(rows) {
  const pixels = new Uint8ClampedArray(rows.length * rows[0].length * 4)
  rows.flat().forEach((value, i) => { pixels[i * 4 + 3] = value * 255 })
  return splatSidePositions(pixels, rows[0].length, rows.length, 2.6, 0.12)
}
function checkClosed(positions) {
  const degree = new Map()
  for (let i = 0; i < positions.length; i += 18) {
    const a = positions.slice(i, i + 2).map(v => v.toFixed(8)).join(',')
    const b = positions.slice(i + 3, i + 5).map(v => v.toFixed(8)).join(',')
    assert.notEqual(a, b, 'side triangles must have nonzero area')
    for (const key of [a, b]) degree.set(key, (degree.get(key) || 0) + 1)
  }
  assert([...degree.values()].every(n => n === 2), 'each contour must close without gaps or branches')
  assert(positions.every(Number.isFinite), 'all positions must be finite')
  assert(positions.filter((_, i) => i % 3 === 2).every(z => z === 0 || z === -0.12))
}
assert.equal(trace([[0, 0], [0, 0]]).length, 0, 'transparent regions must not create walls')
for (const rows of [
  [[1]], // image-edge padding must close the contour
  [[1, 0], [0, 1]], // ambiguous diagonal cells remain separate droplets
  [[0, 1], [1, 0]],
  [[1, 1, 1], [1, 0, 1], [1, 1, 1]], // interior hole
  [[0, 0.4, 0], [0.4, 1, 0.4], [0, 0.4, 0]], // antialiased edge
]) checkClosed(trace(rows))
const ring = trace([[1, 1, 1], [1, 0, 1], [1, 1, 1]])
assert(ring.some((v, i) => i % 18 === 0 && Math.abs(v) < 0.5 && Math.abs(ring[i + 1]) < 0.5),
  'interior holes need their own side walls')
console.log('PASS: relief contours close around edges, droplets and holes with the requested depth')

const group = new THREE.Group()
const shell = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), normalMap: new THREE.Texture() })
const glass = new THREE.MeshStandardMaterial({ name: 'monitor_glass' })
group.add(new THREE.Mesh(new THREE.BoxGeometry(), shell), new THREE.Mesh(new THREE.PlaneGeometry(), glass))
const oldMap = shell.map
const oldNormals = shell.normalMap
const oldGlassHook = glass.onBeforeCompile
const tint = createBlueFinish(THREE, group, { roughness: 0.5, metalness: 0.1 })
const screen = new THREE.MeshStandardMaterial()
group.add(new THREE.Mesh(new THREE.PlaneGeometry(), screen))
tint('#8abaff')
assert.equal(shell.color.getHexString(), '8abaff')
assert.equal(shell.map, oldMap)
assert.equal(shell.normalMap, oldNormals)
assert.equal(glass.color.getHexString(), 'ffffff')
assert.equal(glass.onBeforeCompile, oldGlassHook)
assert.equal(screen.color.getHexString(), 'ffffff', 'composed screen content must keep its colors')
const shader = { fragmentShader: '#include <map_fragment>' }
shell.onBeforeCompile(shader)
assert(shader.fragmentShader.includes('float heroLuminance'), 'installed three.js chunk must accept recoloring')
assert(shader.fragmentShader.includes('diffuseColor *= sampledDiffuseColor;'), 'texture alpha must remain intact')
tint('#528ed1')
assert.equal(shell.color.getHexString(), '528ed1', 'theme updates must set, rather than accumulate, tint')
console.log('PASS: blue finishes preserve texture detail and isolate glass and screen artwork')
