// Reproducible embedded derivative of the user's existing vehicle playground.
// node scripts/prepare-about-garage.mjs /path/to/can
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import sharp from 'sharp'
import { transparentGarageRendering, fixedGarageTrack } from './garage/rendering.mjs'
const root = process.argv[2]
if (!root) throw new Error('Pass the car project root containing outputs/playground and work/viewer-build.')
const requireSource = createRequire(path.join(root, 'work/viewer-build/package.json'))
const { build } = requireSource('esbuild')
const dest = new URL('../public/assets/about/garage/', import.meta.url)
await fs.mkdir(dest, { recursive: true })
const assetRevisions = {}
// Preserve named nodes, materials, wheels and lighting metadata. Build web geometry
// without geometry simplification; bound textures for delivery.
for (const [name, file] of Object.entries({
  '4runner': '4runner-v13/4runner-clean-underbody.glb',
  'mclaren': 'references/mclaren/mclaren_mp45__formula_1.glb',
  'lancia': 'references/lancia-stratos-1974/Lancia_Stratos_1974.glb',
})) {
  const input = await fs.readFile(path.join(root, 'outputs', file))
  const jsonSize = input.readUInt32LE(12), doc = JSON.parse(input.subarray(20, 20 + jsonSize))
  let binary = input.subarray(28 + jsonSize)
  const chunks = []; let length = 0
  for (let i = 0; i < doc.bufferViews.length; i++) {
    const view = doc.bufferViews[i], image = doc.images?.find(image => image.bufferView === i)
    let data = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength)
    if (image) {
      const resize = sharp(data).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      data = await (image.mimeType === 'image/jpeg' ? resize.jpeg({ quality: 85 }) : resize.png()).toBuffer()
    }
    view.byteOffset = length; view.byteLength = data.length
    chunks.push(data); length += data.length
    const padding = (4 - length % 4) % 4; chunks.push(Buffer.alloc(padding)); length += padding
  }
  doc.buffers = [{ byteLength: length }]
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.concat([json, Buffer.alloc((4-json.length%4)%4,32)])
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2,4); header.writeUInt32LE(28+padded.length+length,8)
  header.writeUInt32LE(padded.length,12); header.writeUInt32LE(0x4e4f534a,16)
  binHeader.writeUInt32LE(length); binHeader.writeUInt32LE(0x004e4942,4)
  const output = Buffer.concat([header,padded,binHeader,...chunks])
  await fs.writeFile(new URL(`${name}.glb`,dest),output)
  assetRevisions[name] = createHash('sha256').update(output).digest('hex').slice(0,12)
  console.log(`${name}: ${(input.length/1e6).toFixed(1)} → ${(output.length/1e6).toFixed(1)} MB`)
}
let source = transparentGarageRendering(await fs.readFile(path.join(root,'outputs/playground/source/playground.js'),'utf8'))
const catalogSource = source.match(/const catalog = (.+);\nconst host/)[1]
const catalog = Function('return ('+catalogSource+')')()
const files = { lighting:'4runner', mclaren:'mclaren', lancia:'lancia' }
const entries = Object.keys(files).map(id => ({ id, name: catalog[id].title.replace(/^Your /,'') }))
for (const [id,file] of Object.entries(files)) catalog[id].url = `/assets/about/garage/${file}.glb?v=${assetRevisions[file]}`
await fs.writeFile(new URL('catalog.json',dest), JSON.stringify(entries,null,2)+'\n')
source = source.slice(0,source.indexOf('document.querySelector("#model").addEventListener'))
let imports = source.slice(0,source.indexOf('const catalog ='))
source = source.slice(source.indexOf('const catalog ='))
source = source.replace(/const catalog = .+;\nconst host/, 'const catalog = '+JSON.stringify(Object.fromEntries(entries.map(({id}) => [id,catalog[id]])))+';\nconst host')
source = source.replaceAll('document.querySelector', 'ui.querySelector')
source = source.replace('scene.background = new THREE.Color(13160143);',"scene.background = mode === 'gallery' ? new THREE.Color(13160143) : null;")
source = source.replace('scene.background.set(value ? 791328 : 13160143);','scene.background?.set(value ? 791328 : 13160143);')
source = source.replace('{ antialias: true, preserveDrawingBuffer: true }', '{ alpha: true, antialias: true }')
source = source.replace('Math.min(devicePixelRatio, 2)', 'Math.min(devicePixelRatio, 1)')
source = source.replace('key.shadow.mapSize.set(2048, 2048)', "key.shadow.mapSize.set(mode === 'gallery' ? 2048 : 1024, mode === 'gallery' ? 2048 : 1024)")
source = source.replace('scene.environment = pmrem.fromScene(room, 0.04).texture;', 'const environmentTarget = pmrem.fromScene(room, 0.04); scene.environment = environmentTarget.texture;')
source = source.replace('scene.add(floor);', "floor.visible = mode === 'gallery'; scene.add(floor);")
source = source.replace('scene.add(grid);', "grid.visible = mode === 'gallery'; scene.add(grid);").replace('grid.visible = !value;', "grid.visible = mode === 'gallery' && !value;")
source = source.replace('document.body.dataset.ready = id;', 'invalidate(); return true;')
source = source.replace('console.error(e);', 'console.error(e); return false;')
source = fixedGarageTrack(source)
source = source.replace('hero: [4.7, 3, 6]', 'hero: [5.8, 2.8, 6.2]')
// The gallery uses the canonical OrbitControls setup; About keeps a locked camera.
const controlsBlock = source.match(/const controls = new OrbitControls[\s\S]*?controls.autoRotateSpeed = 0.7;/)[0]
source = source.replace(controlsBlock, `const cameraTarget = new THREE.Vector3();
let controls = null;
if (mode === 'gallery') {
${controlsBlock.replace('const controls =', 'controls =')}
controls.target = cameraTarget;
}`)
source = source.replaceAll('controls.target', 'cameraTarget').replace('cameraTarget = cameraTarget;', 'controls.target = cameraTarget;')
source = source.replaceAll('controls.update();', 'if (controls) controls.update(); else camera.lookAt(cameraTarget);')
source = source.replace('controls.autoRotate = false;', 'if (controls) controls.autoRotate = false;')
source = source.replace('renderer.shadowMap.enabled = true;', "renderer.shadowMap.enabled = mode === 'gallery';")
source = source.replace('setNight(false);', "setNight(mode === 'gallery' ? night : false);")
source = source.replace('createVehicleLighting(gltf.scene)', "createGarageLighting(gltf.scene, createVehicleLighting, mode === 'gallery')")
imports += `import { createGarageWelcome } from ${JSON.stringify(new URL('./garage/welcome.mjs', import.meta.url).pathname)};\n`;
imports += `import { createVehicleWheels } from ${JSON.stringify(new URL('./garage/wheels.mjs', import.meta.url).pathname)};\n`;
imports += `import { prepareGarageVehicle } from ${JSON.stringify(new URL('./garage/readiness.mjs', import.meta.url).pathname)};\n`;
imports += `import { GARAGE_COMPOSITION, placeGarageVehicle } from ${JSON.stringify(new URL('./garage/composition.mjs', import.meta.url).pathname)};\n`;
imports += `import { createGarageSequence } from ${JSON.stringify(new URL('./garage/sequence.mjs', import.meta.url).pathname)};\n`;
imports += `import { createGarageRoad } from ${JSON.stringify(new URL('./garage/road.mjs', import.meta.url).pathname)};\n`;
imports += `import { createGarageLighting } from ${JSON.stringify(new URL('./garage/lighting.mjs', import.meta.url).pathname)};\n`;
const adapter = await fs.readFile(new URL('./garage/runtime.js', import.meta.url),'utf8')
const prefix = `export function mountGarage(mount, statusElement, createRig, createFrameLoop, onState = () => {}, mode = 'composition') {
  const spare = new Map();
  const ui = { querySelector(selector) { if (selector === '#stage') return mount; if (selector === '#status') return statusElement;
    if (!spare.has(selector)) spare.set(selector, document.createElement('div')); return spare.get(selector); }, querySelectorAll() { return []; } };
`
await build({ stdin: { contents: imports + prefix + source + adapter + '\n}', resolveDir:path.join(root,'outputs/playground/source'), sourcefile:'site-garage.js' }, bundle:true, format:'esm', minify:true, outfile:new URL('runtime.js',dest).pathname, nodePaths:[path.join(root,'work/viewer-build/node_modules')], legalComments:'linked' })
const revision = createHash('sha256').update(await fs.readFile(new URL('runtime.js',dest))).digest('hex').slice(0,12)
await fs.writeFile(new URL('revision.json',dest), JSON.stringify({revision})+'\n')
for (const old of ['index.html','playground.js','playground.js.LEGAL.txt']) await fs.rm(new URL(old,dest),{force:true})
await fs.writeFile(new URL('SOURCE.txt',dest),'Generated from the existing vehicle playground source and original vehicle GLBs.\nRebuild: node scripts/prepare-about-garage.mjs /path/to/can\nThe source renderer owns loading, model corrections, vehicle lighting, and camera framing.\nOriginal 4Runner geometry, materials, wheel nodes and lamp emitters are retained without simplification. All authored lamp metadata is retained; About omits unused high-beam sources at runtime. Gallery exposes the original light controls.\nThe site adapter adds transparent composition, a locked camera, capped road motion, shared lighting, a five-flash welcome, and lifecycle cleanup.\n')

const credits = JSON.parse(await fs.readFile(new URL('./garage/credits.json',import.meta.url),'utf8'))
await fs.writeFile(new URL('credits.json',dest), JSON.stringify(credits,null,2)+'\n')
await fs.writeFile(new URL('ATTRIBUTIONS.txt',dest), credits.map(c=>`${c.title} by ${c.author} (${c.authorUrl})\nSource: ${c.sourceUrl}\nLicense: ${c.licenseLabel} (${c.licenseUrl})\nChanges: ${c.modifications}`).join('\n\n')+'\n')
await fs.copyFile(path.join(root,'work/viewer-build/node_modules/three/LICENSE'),new URL('THREE-LICENSE.txt',dest))
