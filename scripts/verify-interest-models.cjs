// Validate the actual model builders and local GLBs without a browser/GPU.
async function main() {
  const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
  const ts = require('typescript'), sharp = require('sharp')
  const THREE = await import('three')
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
  const rounded = await import('three/addons/geometries/RoundedBoxGeometry.js')
  const comics = await import('../lib/comics.mjs')
  const root = path.resolve(__dirname, '..'), requests = [], resources = []
  global.ProgressEvent = class { constructor(type, props) { Object.assign(this, props) } }
  class LocalLoader extends GLTFLoader {
    constructor() {
      super()
      // Decode textures separately with sharp; only the DOM image upload is stubbed.
      this.register(() => ({ name: 'LOCAL_TEST_TEXTURES', loadTexture: async () => new THREE.Texture() }))
    }
    async loadAsync(url) {
      assert.ok(url.startsWith('/assets/'))
      requests.push(url)
      const file = path.join(root, 'public', url), bytes = fs.readFileSync(file)
      let document, binary
      if (url.endsWith('.glb')) {
        assert.equal(bytes.readUInt32LE(8), bytes.length)
        const length = bytes.readUInt32LE(12)
        document = JSON.parse(bytes.subarray(20, 20 + length)); binary = bytes.subarray(28 + length)
        for (const image of document.images ?? []) {
          const view = document.bufferViews[image.bufferView]
          const metadata = await sharp(binary.subarray(view.byteOffset, view.byteOffset + view.byteLength)).metadata()
          const edge = 512
          assert.ok(metadata.width <= edge && metadata.height <= edge)
        }
      } else {
        document = JSON.parse(bytes)
        binary = fs.readFileSync(path.join(path.dirname(file), document.buffers[0].uri))
      }
      document.buffers[0].uri = 'data:application/octet-stream;base64,' + binary.toString('base64')
      const model = await this.parseAsync(JSON.stringify(document), '')
      model.scene.traverse(node => {
        if (!node.isMesh) return
        const positions = node.geometry.attributes.position, indices = node.geometry.index
        for (let i = 0; i < (indices?.count ?? 0); i++) assert.ok(indices.getX(i) < positions.count, 'compacted indices remain valid')
        let disposed = false; node.geometry.addEventListener('dispose', () => { disposed = true })
        resources.push(() => disposed)
      })
      return model
    }
  }
  const photoRequests = []
  class LocalPhotoLoader {
    setCrossOrigin() { return this }
    load(url, onLoad) {
      photoRequests.push(url)
      const texture = new THREE.Texture()
      queueMicrotask(() => onLoad(texture))
      return texture
    }
  }
  const modules = new Map()
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports
    const module = { exports: {} }; modules.set(file, module)
    const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    new Function('require', 'module', 'exports', code)(name => {
      if (name === 'three') return { ...THREE, TextureLoader: LocalPhotoLoader }
      if (name.endsWith('/GLTFLoader.js')) return { GLTFLoader: LocalLoader }
      if (name.endsWith('/RoundedBoxGeometry.js')) return rounded
      if (name.endsWith('comics.mjs')) return comics
      if (name.endsWith('.json')) return require(path.resolve(root, path.dirname(file), name))
      if (name.startsWith('.')) return load(path.normalize(path.join(path.dirname(file), name + '.ts')))
      return require(name)
    }, module, module.exports)
    return module.exports
  }
  const assetUrls = require('../public/assets/about/models/asset-urls.json')
  for (const url of Object.values(assetUrls)) {
    const bytes = fs.readFileSync(path.join(root, 'public', url))
    const hash = require('node:crypto').createHash('sha256').update(bytes).digest('hex').slice(0, 12)
    assert.ok(url.endsWith(`.${hash}.glb`), 'Asset URLs change with content to avoid cached old geometry')
  }
  const { createInterestModel } = load('components/about/interestModels.ts')
  let invalidations = 0
  const ids = ['automotive', 'comics', 'options', 'smart-home']
  const previewComics = Array.from({ length: 3 }, (_, index) => ({ name: `Book ${index + 1}`, publisher: 'Preview', url: `https://example.com/comic/${index}`, cover: null }))
  const models = ids.map(id => createInterestModel(id, id === 'comics' ? previewComics : [], () => invalidations++))
  assert.equal(requests.length, 0, 'GLB props wait for the first render')
  models[ids.indexOf('smart-home')].setTheme('#8abaff', 'light')
  models.forEach(model => model.update(1))
  for (let attempts = 0; invalidations < 8 && attempts < 200; attempts++) await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(invalidations, 8, 'all eight props load and request a frame')
  assert.equal(requests.filter(url => url.includes('edison')).length, 1, 'smart home uses the canonical Edison asset')
  for (const model of models) {
    model.object.rotation.set(...model.pose); model.object.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(model.object)
    assert.ok(bounds.min.x > -1.4 && bounds.max.x < 1.4 && bounds.min.y > -1.4 && bounds.max.y < 1.4, 'composition stays within its hover viewport')
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 50); camera.position.z = 4.7; camera.updateMatrixWorld()
    model.object.scale.setScalar(1); model.object.updateMatrixWorld(true)
    model.object.traverse(node => {
      if (!node.isMesh || !node.visible) return
      const position = node.geometry.attributes.position
      for (let i = 0; i < position.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld).project(camera)
        assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1, `magnified ${ids[models.indexOf(model)]}/${node.name}: ${point.x}, ${point.y}`)
      }
    })
    model.update(1)
  }
  assert.equal(requests.length, 8, 'updates reuse loaded models')
  const cars = models[ids.indexOf('automotive')]
  assert.equal(cars.object.getObjectByName('motorsport-flag'), undefined, 'Old flag is removed')
  const cork = cars.object.getObjectByName('celebration-cork')
  const pieces = []; cars.object.traverse(node => { if (node.name === 'celebration-confetti') pieces.push(node) })
  assert.equal(pieces.length, 24, 'Burst has a fixed small particle budget')
  cars.animate(0, 0, true)
  assert.ok(cork.visible && pieces.every(piece => !piece.visible))
  const bottle = cars.object.getObjectByName('celebration-bottle')
  for (let i = 0; i < 14; i++) cars.animate(1 / 60, 1, true)
  assert.ok(pieces.some(piece => piece.visible), 'Pop starts within a quarter second')
  assert.ok(bottle.position.y < -0.83, 'The pop pushes the bottle downward')
  for (let i = 0; i < 16; i++) cars.animate(1 / 60, 1, true)
  assert.ok(pieces.some(piece => piece.visible), 'Activation pops the cork and emits confetti')
  assert.ok(cork.position.y > 1.055)
  for (let i = 0; i < 180; i++) cars.animate(1 / 60, 1, true)
  assert.equal(cars.animate(1 / 60, 1, true), false, 'Celebration finishes and parks')
  assert.ok(!cork.visible && pieces.every(piece => !piece.visible), 'Bottle stays open without repeating the burst')
  assert.equal(bottle.position.y, -0.75, 'Recoil eases back to the bottle resting position')
  cars.animate(0, 0, true)
  cars.animate(0, 1, false)
  assert.ok(!cork.visible && pieces.filter(piece => piece.visible).length === 6, 'Reduced motion gets an open bottle and static confetti')
  const still = pieces.map(piece => piece.position.toArray())
  cars.animate(10, 1, false)
  assert.deepEqual(pieces.map(piece => piece.position.toArray()), still)
  const creative = models[ids.indexOf('comics')]
  assert.equal(creative.object.getObjectByName('nintendo-cable'), undefined)
  const books = [0, 1, 2].map(index => creative.object.getObjectByName(`comic-book-${index}`))
  for (const amount of [0, 0.25, 0.5, 0.75, 1]) {
    creative.update(amount)
    const bounds = books.map(book => {
      book.updateMatrixWorld(true)
      // Measure in their shared parent space, independent of the scene's camera tilt.
      const result = new THREE.Box3()
      book.traverse(node => {
        if (!node.isMesh) return
        node.geometry.computeBoundingBox()
        const matrix = new THREE.Matrix4().copy(book.parent.matrixWorld).invert().multiply(node.matrixWorld)
        result.union(node.geometry.boundingBox.clone().applyMatrix4(matrix))
      })
      return result
    })
    for (let index = 0; index < 3; index++) {
      assert.equal(books[index].scale.x, books[0].scale.x, 'All covers retain the same physical scale')
      assert.equal(books[index].rotation.y, 0, 'Fan avoids opposing depth rotations that cut covers through each other')
      if (index) {
        assert.ok(bounds[index].min.x < bounds[index - 1].max.x, 'Covers overlap into a tight fan')
        assert.ok(bounds[index].min.z > bounds[index - 1].max.z, 'Overlapping covers keep separated depth layers')
      }
    }
  }
  const impact = creative.object.getObjectByName('comic-impact')
  creative.update(0); const closedImpact = impact.scale.x
  creative.update(1); assert.ok(impact.scale.x > closedImpact, 'Comic impact expands with magnification')
  assert.ok(impact.position.z < -1 && impact.rotation.z < -0.25, 'Impact sits diagonally behind the fan like the floor plan')
  assert.ok(creative.object.getObjectByName('comic-halftone').geometry.attributes.position.count > 1000, 'Pronounced halftone is batched into one mesh')
  const smartHome = models[ids.indexOf('smart-home')]
  const visibleInTree = node => {
    for (let current = node; current; current = current.parent) if (!current.visible) return false
    return true
  }
  const black = smartHome.object.getObjectByName('Black_0'), white = smartHome.object.getObjectByName('White_1')
  assert.ok(black && white, 'The original asset retains both authored HomePods')
  assert.ok(!visibleInTree(black) && visibleInTree(white), 'Theme selected before async loading is honored')
  const homepodBounds = []
  for (const theme of ['dark', 'light', 'dark']) {
    smartHome.setTheme('#8abaff', theme)
    assert.equal(visibleInTree(black), theme === 'dark')
    assert.equal(visibleInTree(white), theme === 'light')
    smartHome.object.updateMatrixWorld(true)
    homepodBounds.push(new THREE.Box3().setFromObject(theme === 'dark' ? black : white))
  }
  assert.ok(homepodBounds[0].getCenter(new THREE.Vector3()).distanceTo(homepodBounds[1].getCenter(new THREE.Vector3())) < 0.02, 'Theme variants keep the same centered placement')
  assert.equal(requests.filter(url => url.includes('homepod')).length, 1, 'Theme changes reuse the loaded asset')
  const stocks = models[ids.indexOf('options')]
  const chart = stocks.object.getObjectByName('stocks-candlestick-backdrop')
  assert.ok(chart && chart.position.z < -0.3, 'Candles sit behind the stock props')
  const coin = stocks.object.getObjectByName('Cylinder_Bitcoin_Mat_0')
  stocks.update(1)
  assert.equal(coin.material.color.getHexString(), 'ffe5a6', 'Full magnification restores the bright gold face')
  assert.equal(coin.material.metalness, 0.72)
  assert.equal(coin.material.roughness, 0.23)
  stocks.update(0)
  assert.equal(coin.material.emissiveIntensity, 0, 'Gold fill does not leak into the resting blue treatment')
  stocks.update(1)
  const bulbLight = smartHome.object.getObjectByName('interest-bulb-light')
  const coils = []
  smartHome.object.traverse(node => { if (node.isMesh && node.material.name === 'glow') coils.push(node) })
  assert.ok(bulbLight && coils.length, 'Canonical bulb provides a light source and physical coil')
  for (const amount of [0, 0.5, 1, 0]) {
    smartHome.update(amount)
    assert.equal(bulbLight.intensity, 2.4 * amount)
    for (const coil of coils) {
      assert.ok(coil.visible && coil.material.visible && coil.material.opacity === 1, 'Coil stays physically visible when switched off')
      assert.equal(coil.material.emissiveIntensity > 0, amount > 0, 'Filament emits only during hover or selection')
    }
  }
  smartHome.update(1)
  const floorPlan = smartHome.object.getObjectByName('smart-home-floor-plan')
  assert.ok(floorPlan)
  smartHome.update(0)
  const restingTilt = floorPlan.rotation.x, restingDiagonal = floorPlan.rotation.z
  for (const amount of [0.25, 0.5, 0.75, 1]) {
    smartHome.update(amount)
    assert.ok(floorPlan.rotation.x < restingTilt, 'Plan turns toward the viewer as it activates')
    assert.ok(floorPlan.rotation.z < restingDiagonal, 'Plan rotates into a diagonal view')
    smartHome.object.updateMatrixWorld(true)
    const extent = new THREE.Box3().setFromObject(floorPlan)
    assert.ok(extent.min.x > -1.4 && extent.max.x < 1.4 && extent.max.y < 1.4, 'Plan fits while turning')
  }
  assert.equal(floorPlan.getObjectByName('floor-plan-sheet').material.opacity, 1)
  assert.equal(smartHome.animate, undefined, 'Floor plan reuses magnification easing without a continuous loop')
  const sheet = floorPlan.getObjectByName('floor-plan-sheet')
  smartHome.object.updateMatrixWorld(true)
  const lightPosition = bulbLight.getWorldPosition(new THREE.Vector3())
  const sheetPosition = sheet.getWorldPosition(new THREE.Vector3())
  const towardLight = lightPosition.clone().sub(sheetPosition)
  const sheetNormal = new THREE.Vector3(0, 0, 1).transformDirection(sheet.matrixWorld)
  const wash = bulbLight.intensity / towardLight.lengthSq() * Math.max(0, sheetNormal.dot(towardLight.normalize()))
  assert.ok(sheet.material.isMeshStandardMaterial && wash > 0.4, 'Physical bulb light faces the blueprint and supplies a visible local wash')
  for (const color of ['#27c4ec', '#d73d79', '#e6a738']) {
    smartHome.setLightColor(color)
    assert.equal(bulbLight.color.getHexString(), color.slice(1), 'Bulb source follows the background color')
    for (const coil of coils) assert.equal(coil.material.emissive.getHexString(), color.slice(1), 'Filament shares the same live color')
  }
  smartHome.update(0)
  smartHome.setLightColor('#1e76b6')
  assert.equal(bulbLight.intensity, 0, 'Color updates do not turn an inactive bulb on')
  smartHome.update(1)
  const family = createInterestModel('family', [], () => {})
  await Promise.resolve()
  const prints = family.object.children.filter(node => node.name === 'family-memory-print')
  assert.equal(prints.length, 2)
  family.update(0); const restPrints = prints.map(print => print.rotation.z)
  family.update(1)
  assert.ok(prints.every((print, index) => Math.abs(print.rotation.z) > Math.abs(restPrints[index])), 'Photo prints fan out on activation')
  const photos = []; family.object.traverse(node => { if (node.isMesh && node.material.map) photos.push(node.material.map) })
  assert.equal(photos.length, 3); assert.equal(new Set(photos).size, 1, 'All three views reuse the same photo texture')
  assert.equal(photoRequests.length, 1, 'Family photo loads once')
  ids.push('family'); models.push(family)
  for (const model of models) { model.object.rotation.set(...model.pose); model.object.updateMatrixWorld(true) }
  if (process.argv.includes('--preview')) {
    // Orthographic clay contact sheet checks orientation/composition, not browser lighting.
    const paths = []
    for (const [index, model] of models.entries()) {
      const faces = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
      model.object.traverse(node => {
        if (!node.isMesh || !visibleInTree(node)) return
        const material = Array.isArray(node.material) ? node.material[0] : node.material
        if (material.transparent && material.opacity < 0.5) return
        const p = node.geometry.attributes.position, indices = node.geometry.index
        for (let i = 0; i < (indices?.count ?? p.count); i += 3) {
          const vertices = [a,b,c].map((v,j) => v.fromBufferAttribute(p, indices ? indices.getX(i+j) : i+j).applyMatrix4(node.matrixWorld).clone())
          const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize()
          const shade = .45 + .55 * Math.abs(normal.dot(new THREE.Vector3(.3,.5,1).normalize()))
          const color = (material.color ?? new THREE.Color('#9db2d0')).clone().multiplyScalar(shade)
          const texel = material.map?.image
          if (texel?.width === 1 && texel?.height === 1 && texel.data) color.multiply(new THREE.Color().setRGB(texel.data[0] / 255, texel.data[1] / 255, texel.data[2] / 255, THREE.SRGBColorSpace))
          faces.push({ z: vertices.reduce((z,v) => z+v.z,0), path: `<path fill="#${color.getHexString()}" d="M${vertices.map(v => `${index*400+200+v.x*125},${200-v.y*125}`).join(' L')} Z"/>` })
        }
      })
      paths.push(...faces.sort((a,b) => a.z-b.z).map(face => face.path))
      paths.push(`<text x="${index*400+200}" y="385" fill="white" text-anchor="middle">${ids[index]}</text>`)
    }
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${models.length * 400}" height="410"><rect width="100%" height="100%" fill="#243248"/>${paths.join('')}</svg>`)).png().toFile('/tmp/about-interest-models.png')
  }
  models.forEach(model => model.dispose())
  assert.ok(resources.every(disposed => disposed()), 'all loaded geometry is disposed')
  console.log('Interest assets: queued loading, texture sizes, indices, framing, theme variants, gold finish, chart, one-shot accents, photo reuse, bulb illumination and disposal passed.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
