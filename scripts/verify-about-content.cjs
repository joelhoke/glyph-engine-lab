// Headless integration checks; no browser or network access.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const root = path.resolve(__dirname,'..')
const modules = new Map()
function load(file, overrides = {}) {
  const absolute = path.resolve(root,file)
  if (modules.has(absolute)) return modules.get(absolute)
  const module = { exports:{} }
  const source = ts.transpileModule(fs.readFileSync(absolute,'utf8'), { compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true } }).outputText
  new Function('require','module','exports',source)(name => {
    if (overrides[name]) return overrides[name]
    if (name.endsWith('.css')) return { default:{} }
    if (name.startsWith('.')) { const p=path.resolve(path.dirname(absolute),name); return name.endsWith('.json') ? require(p) : load(p+'.ts',overrides) }
    return require(name)
  },module,module.exports)
  modules.set(absolute,module.exports); return module.exports
}
const { INTEREST_ARC, interestArcRange, interestArcX } = load('components/about/interestLayout.ts')
const { fibreArcBaseline } = load('components/originkit/ui/fibreArcGeometry.ts')
assert.equal(INTEREST_ARC.direction,163)
for (const width of [320,600,1180]) {
  const range=interestArcRange(width,176)
  assert.equal(interestArcX(range,0,5),width*5/12)
  assert.equal(interestArcX(range,4,5),width*11/12)
}
const {MODEL_CREDITS,OTHER_CREDITS}=load('content/site.ts')
const credits=[...MODEL_CREDITS,...OTHER_CREDITS]
assert.equal(new Set(credits.map(c=>c.title)).size,credits.length)
for (const credit of credits) {
  assert.ok(credit.title && credit.author && credit.modifications && credit.usedFor)
  if (credit.licenseUrl?.startsWith('/')) assert.ok(fs.existsSync(path.join(root,'public',credit.licenseUrl)))
}
for (const name of ['McLaren MP4/5 || Formula 1','SUV Niva — roof rack','Fibre Arc','Departure Mono','Cabin']) assert.ok(credits.some(c=>c.title===name))
assert.equal(credits.find(c=>c.title==='Lancia Stratos 1974').licenseUrl,undefined,'Never assign an unverified CC license')
for (const file of ['4runner','mclaren','lancia']) {
  const bytes=fs.readFileSync(path.join(root,`public/assets/about/garage/${file}.glb`))
  assert.equal(bytes.readUInt32LE(8),bytes.length)
  assert.ok(bytes.length<=25*1024*1024,'Each web asset fits the host size limit')
  const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)))
  assert.ok(doc.meshes.length && doc.materials.length)
  for (const view of doc.bufferViews) assert.ok((view.byteOffset||0)+view.byteLength<=doc.buffers[0].byteLength)
  if (file==='mclaren') assert.match(doc.asset.extras.license,/CC-BY-4.0/)
}
assert.ok(!fs.existsSync(path.join(root,'public/assets/about/garage/index.html')),'No framed playground remains')
const THREE = require('three'), camera = new THREE.PerspectiveCamera(37,1,.02,100)
camera.position.set(5.8,2.8,6.2);camera.lookAt(0,.65,0);camera.updateMatrixWorld()
assert.ok(new THREE.Vector3(0,.65,1).project(camera).x<new THREE.Vector3(0,.65,0).project(camera).x,'Front points left in the default quarter view')
console.log('About content: unchanged dock span, attribution coverage, asset integrity and left-facing driving view passed.')
