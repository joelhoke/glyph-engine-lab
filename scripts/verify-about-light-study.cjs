// Math/asset integration checks; no browser or GPU is needed.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const THREE = require('three')
const Module = require('node:module')
const filename = path.resolve('components/home/light-study/layout.ts')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const layoutModule = new Module(filename, module)
layoutModule.filename = filename
layoutModule.paths = module.paths
layoutModule._compile(compiled, filename)
const { fitToRect, projectedBounds } = layoutModule.exports

async function main() {
  const { FontLoader } = await import('three/addons/loaders/FontLoader.js')
  const { TextGeometry } = await import('three/addons/geometries/TextGeometry.js')
  const data = JSON.parse(fs.readFileSync('public/assets/about-light-study/fonts/cabin_bold.typeface.json'))
  assert.equal(data.familyName, 'Cabin Bold')
  assert.equal(data.original_font_information.axes.wght, 700)
  const font = new FontLoader().parse(data)
  assert.equal(font.generateShapes('o', 1)[0].holes.length, 1, 'Cabin counters must remain holes')
  const geometry = new TextGeometry("Hi, I'm Joel.", { font, size: 0.06, depth: 0.01, curveSegments: 6, bevelEnabled: false })
  geometry.computeBoundingBox()
  const center = geometry.boundingBox.getCenter(new THREE.Vector3())
  geometry.translate(-center.x, -center.y, 0)
  const heading = new THREE.Group()
  heading.position.z = 0.011
  heading.add(new THREE.Mesh(geometry))
  const wall = new THREE.Group()
  wall.position.z = -0.35
  wall.add(heading)
  const positions = geometry.getAttribute('position')
  const points = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i))
  for (const [width, height, target] of [
    [1440, 800, { left: 752, top: 130, width: 560, height: 54 }],
    [1920, 800, { left: 992, top: 130, width: 560, height: 54 }],
    [768, 980, { left: 400, top: 130, width: 344, height: 35 }],
    [390, 1100, { left: 24, top: 420, width: 342, height: 35 }],
    [320, 1300, { left: 24, top: 370, width: 272, height: 35 }],
    // Return to desktop on the same objects to catch accumulated transforms.
    [1440, 800, { left: 752, top: 130, width: 560, height: 54 }],
  ]) {
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 30)
    camera.position.z = 1.45
    fitToRect(heading, points, target, camera, width, height, 'left')
    const bounds = projectedBounds(heading, points, camera, width, height)
    assert.ok(Math.abs(bounds.min.x - target.left) < 0.5, `Heading alignment at ${width}px: ${bounds.min.x}`)
    assert.ok(bounds.max.x <= target.left + target.width + 0.5, `Heading overflows at ${width}px`)
    assert.ok(bounds.min.y >= target.top - 0.5 && bounds.max.y <= target.top + target.height + 0.5, `Heading height at ${width}px`)
    console.log(`PASS: Cabin 3D heading aligns with the CSS column at ${width}px`)
  }
  const project = JSON.parse(fs.readFileSync('public/assets/about-light-study/light-study-3.json'))
  const text = project.items.filter(item => item.kind === 'text')
  assert.equal(text.length, 1)
  assert.equal(text[0].treatment, 'solid')
  assert.equal(project.items.filter(item => item.kind === 'image').length, 2)
  const copy = JSON.parse(fs.readFileSync('content/aboutLightStudy.json'))
  assert.equal(text[0].text, copy.heading)
  assert.equal(copy.paragraphs.length, 3)
  console.log('PASS: only the greeting remains in 3D; the body copy and artwork assets are intact')
  geometry.dispose()
}
main().catch(error => { console.error(error); process.exitCode = 1 })
