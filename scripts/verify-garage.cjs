// Exercise the actual generated-source adapter without WebGL or a browser.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript'), THREE = require('three')
const transpile = file => ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020} }).outputText
function load(file) { const module={exports:{}};new Function('require','module','exports',transpile(file))(require,module,module.exports);return module.exports }
const {createGarageWelcome} = load('scripts/garage/welcome.mjs')
const sourceRoot = process.argv[2]
assert.ok(sourceRoot, 'Pass the original vehicle project to verify its real lighting controller')
const {createVehicleLighting} = load(`${sourceRoot}/outputs/playground/source/vehicle-lighting.js`)
const root = new THREE.Group()
for (const channel of ['signal','low','fog','accent']) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial())
  mesh.userData={lightRole:'emitter',lightChannel:channel,lightSide:'driver'}; root.add(mesh)
}
const lighting=createVehicleLighting(root), welcome=createGarageWelcome()
welcome.start(lighting,false)
let flashes=1, wasOn=true
for (let i=0;i<180;i++) {
  welcome.update(1/30)
  const on=lighting.getDiagnostics().activeEmitters.some(e=>e.channel==='signal')
  if (on&&!wasOn) flashes++
  wasOn=on
}
assert.equal(flashes,5,'Exactly five complete visible hazard flashes')
assert.equal(lighting.getState().signals,'off')
assert.equal(lighting.getState().beams,'low');assert.equal(lighting.getState().accent,true);assert.equal(lighting.getState().fog,true)
welcome.start(lighting,false);assert.equal(lighting.getState().signals,'off','No replay when cycling back')
createGarageWelcome().start(lighting,true);assert.equal(lighting.getState().signals,'off','Reduced motion keeps steady lamps')
welcome.toggle(); assert.equal(lighting.getState().beams,'off'); assert.equal(lighting.getState().accent,false);assert.equal(lighting.getState().fog,false)
welcome.toggle(); assert.equal(lighting.getState().beams,'low'); assert.equal(lighting.getState().accent,true);assert.equal(lighting.getState().fog,true)
lighting.dispose()
const {createStudioRig}=load('components/lighting/studioRig.ts')
const scene=new THREE.Scene(), rig=createStudioRig(THREE,scene,{studioFill:false})
const illumination=[{color:'#ff007f',intensity:3,position:{x:.8,y:.8}}]
rig.apply(illumination,{left:0,top:0,width:100,height:100},{left:0,top:0,width:70,height:70})
const source=scene.children.find(o=>o.isPointLight)
assert.equal(source.intensity,3);assert.equal(source.color.getHexString(),'ff007f')
assert.equal(scene.children.filter(o=>!o.isPointLight).length,0,'No unused zero-intensity fill lights enter car shaders')
async function sharedComposition(gallery = false) {
  const {GARAGE_COMPOSITION,placeGarageVehicle}=load('scripts/garage/composition.mjs')
  const {createGarageRoad}=load('scripts/garage/road.mjs')
  const {createGarageSequence}=load('scripts/garage/sequence.mjs')
  const {createVehicleWheels}=load('scripts/garage/wheels.mjs')
  let options, activeFrames=0, prepared=false, disposedLights=0, disposedScene=0
  const loads=[], states=[], scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera()
  const properties=new Map();
  const noop=()=>{}, mount={querySelector:()=>null,style:{setProperty:(key,value)=>properties.set(key,value)},getBoundingClientRect:()=>({left:0,top:0,width:700,height:500})}
  const adapter=fs.readFileSync('scripts/garage/runtime.js','utf8')
  let release
  const api=new Function('THREE','createGarageWelcome','createGarageSequence','createGarageRoad','mode','GARAGE_COMPOSITION','placeGarageVehicle','createVehicleWheels','prepareGarageVehicle','onState','createRig','createFrameLoop','scene','mount','document','innerWidth','innerHeight','renderer','camera','cameraTarget','ResizeObserver','view','renderFrame','dispose','grid','environmentTarget','spare','status','loads','makeLights', `
    let night=false,wire=false; const DEFAULT_LIGHT_STATE={beams:'off'}; const controls=mode==='gallery'?{autoRotate:false,update(){},addEventListener(){},removeEventListener(){},dispose(){}}:null; function setNight(value){night=value;}
    const composer=mode==='gallery'?{setSize(){},passes:[],dispose(){}}:null,postTarget=mode==='gallery'?{dispose(){}}:null;
    const catalog={lighting:{},mclaren:{},lancia:{}};
    let lighting=null,vehicle=null,cameraFit=1,token=0;
    async function load(id) { loads.push(id);vehicle=new THREE.Group();vehicle.name=id;vehicle.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,4),new THREE.MeshStandardMaterial()));scene.add(vehicle);lighting=id==='lighting'?makeLights():null;return true; }
    ${adapter}`)(THREE,createGarageWelcome,createGarageSequence,createGarageRoad,gallery?'gallery':'composition',GARAGE_COMPOSITION,placeGarageVehicle,createVehicleWheels,
    async()=>{prepared=true;await new Promise(resolve=>release=resolve)},state=>states.push(state),()=>{assert.equal(gallery,false,'Gallery must not instantiate page accent lights');return{apply:noop}},o=>{options=o;return{renderOnce:noop,resume:noop,park:noop,dispose:noop}},scene,mount,
    {hidden:false,addEventListener:noop,removeEventListener:noop},1000,800,{setSize:noop,dispose:noop,forceContextLoss:noop,domElement:{remove:noop,addEventListener:noop,removeEventListener:noop}},camera,new THREE.Vector3(),class{observe(){} disconnect(){}},noop,()=>activeFrames++,()=>disposedScene++,{geometry:{dispose:noop},material:{dispose:noop}},{dispose:noop},new Map(),{},loads,
    ()=>{let state={beams:'off'};return{setState:s=>Object.assign(state,s),getState:()=>state,update:noop,dispose:()=>disposedLights++}})
  const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
  await flush()
  assert.deepEqual(loads,['lighting'],'Load the first car before requesting the second')
  assert.equal(prepared,true);options.frame(10);assert.equal(activeFrames,0,'No partially prepared cars appear')
  release();await flush()
  for(let i=1;i<=20;i++)options.frame(10+i*50)
  await flush()
  if (gallery) {
    assert.deepEqual(loads,['lighting']); assert.equal(states.at(-1).busy,false)
    api.setNight(true); assert.equal(states.at(-1).night,true)
    api.setLights({beams:'high',fog:true,signals:'left'}); assert.equal(states.at(-1).lamps.beams,'high'); assert.equal(states.at(-1).lamps.fog,true)
    api.setOrbit(true); assert.equal(states.at(-1).orbit,true)
    api.setWire(true); assert.equal(scene.children.find(item=>item.name==='lighting').children[0].material.wireframe,true)
    assert.equal(api.load('mclaren'),true); assert.equal(api.load('lancia'),false,'Busy carousel locks navigation')
    for(let i=21;i<=36;i++)options.frame(10+i*50)
    await flush(); assert.deepEqual(loads,['lighting','mclaren']); release(); await flush()
    for(let i=37;i<=60;i++)options.frame(10+i*50)
    await flush()
    assert.equal(states.at(-1).night,true,'Model switching preserves selected environment')
    assert.equal(states.at(-1).hasLights,false); assert.equal(states.at(-1).busy,false)
    api.dispose();assert.equal(disposedLights,1)
    console.log('Gallery controls: original lighting modes, individual lamps, orbit, wireframe, carousel lock and cleanup passed.')
    return
  }
  assert.deepEqual(loads,['lighting','mclaren'],'Second car begins after the first drive-in')
  const cars=scene.children.filter(item=>['lighting','mclaren'].includes(item.name))
  assert.equal(cars.length,2,'Both cars use the same scene')
  release();await flush()
  for(let i=21;i<=42;i++)options.frame(10+i*50)
  await flush()
  assert.ok(cars[0].position.z<cars[1].position.z,'4Runner settles farther up the shared road')
  assert.equal(states.at(-1).busy,false)
  assert.deepEqual(states.at(-1).vehicles,['lighting','mclaren'],'Only fully arrived cars expose story controls')
  for(const id of ['lighting','mclaren']) for(const dimension of ['left','top','width','height']) assert.ok(properties.has(`--vehicle-${id}-${dimension}`),'Each car owns a projected hit area')
  camera.fov=37;camera.aspect=700/500;camera.position.set(5.8,2.8,6.2);camera.lookAt(0,.65,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const lampsBefore=states.at(-1).lightsOn
  for(const car of cars) {
    const center=new THREE.Box3().setFromObject(car).getCenter(new THREE.Vector3()).project(camera)
    assert.equal(api.pickVehicle({x:(center.x+1)*350,y:(1-center.y)*250}),car.name,'Click selects the correct model on the shared road')
  }
  assert.equal(api.pickVehicle({x:-10000,y:-10000}),null,'Empty-space clicks do not select a story')
  assert.equal(states.at(-1).lightsOn,lampsBefore,'Story selection does not change vehicle lamps')
  api.toggleLights();assert.equal(states.at(-1).lightsOn,false)
  api.toggleLights();assert.equal(states.at(-1).lightsOn,true)
  assert.equal(api.load('mclaren'),false,'Composition mode cannot invoke the single-car carousel')
  api.setActive(true,true);assert.equal(options.keepRunning(),false)
  api.setActive(false,false);assert.equal(options.isParked(),true)
  api.dispose();assert.equal(disposedLights,1);assert.equal(disposedScene,3)
  console.log('Shared garage: one scene/track, load once, complete readiness, light clicks, reduced motion and cleanup passed.')
}
Promise.all([sharedComposition(),sharedComposition(true)]).catch(error=>{console.error(error);process.exitCode=1})

const {publishPageIllumination,currentPageIllumination}=load('components/lighting/pageIllumination.ts')
const page=new EventTarget(), publisher=new EventTarget();publisher.closest=()=>page
publishPageIllumination(publisher,illumination)
assert.equal(currentPageIllumination(page),illumination,'Late-mounted hero receives the parked scene lighting')
publishPageIllumination(publisher,[]);assert.deepEqual(currentPageIllumination(page),[])

const roadCamera = new THREE.PerspectiveCamera(37,1.75,.02,100)
roadCamera.position.set(5.8,2.8,6.2);roadCamera.lookAt(0,.65,0);roadCamera.updateMatrixWorld()
const parked = new THREE.Vector3(0,0,0).project(roadCamera)
const incoming = new THREE.Vector3(0,0,-11.9).project(roadCamera)
const outgoing = new THREE.Vector3(0,0,5).project(roadCamera)
assert.ok(incoming.x>parked.x && incoming.y>parked.y,'Arrival follows the road from upper right')
assert.ok(outgoing.x<parked.x && outgoing.y<parked.y,'Departure follows the road toward lower left')
const apparentHeight = z => new THREE.Vector3(0,2,z).project(roadCamera).y-new THREE.Vector3(0,0,z).project(roadCamera).y
assert.ok(apparentHeight(-11.9)<apparentHeight(0),'Perspective alone makes the distant incoming vehicle smaller')

const {transparentGarageRendering,fixedGarageTrack}=load('scripts/garage/rendering.mjs')
const originalRenderer=fs.readFileSync(`${sourceRoot}/outputs/playground/source/playground.js`,'utf8')
const adaptedRenderer=transparentGarageRendering(originalRenderer)
// Execute the adapted setup: About must not allocate an intermediate target,
// while the gallery still owns the original multisampled HDR pipeline.
const pipelineSource=adaptedRenderer.slice(adaptedRenderer.indexOf('let postTarget = null'), adaptedRenderer.indexOf('function renderFrame() {'))
for (const mode of ['composition','gallery']) {
  let targets=0
  const mockTHREE={HalfFloatType:THREE.HalfFloatType,Vector2:THREE.Vector2,WebGLRenderTarget:class {constructor(){targets++}}}
  const Composer=class {constructor(renderer,target){this.target=target;this.passes=[]} addPass(pass){this.passes.push(pass)}}
  const Pass=class {}
  const result=new Function('mode','THREE','renderer','scene','camera','EffectComposer','RenderPass','UnrealBloomPass','OutputPass',`${pipelineSource};return {postTarget,composer,bloom}`)(mode,mockTHREE,{},{},{},Composer,Pass,Pass,Pass)
  assert.equal(targets,mode==='gallery'?1:0)
  if(mode==='gallery') {assert.equal(result.postTarget.samples,4);assert.equal(result.composer.passes.length,3)}
  else {assert.equal(result.composer,null);assert.equal(result.bloom,null)}
}
const renderSource=adaptedRenderer.match(/function renderFrame\(\) \{[\s\S]*?\n(?=function setNight)/)[0]
for (const mode of ['composition','gallery']) for (const lampState of [null,{beams:'off'},{beams:'low',fog:true}]) {
  let direct=0,hdr=0
  new Function('mode','renderer','composer','bloom','night','scene','camera','lighting',`${renderSource};renderFrame()`)(
    mode,{render:()=>direct++},mode==='gallery'?{render:()=>hdr++}:null,mode==='gallery'?{}:null,false,{}, {},lampState ? {getState:()=>lampState} : null)
  assert.equal(hdr,mode==='gallery'&&lampState?1:0)
  assert.equal(direct,mode==='composition'||!lampState?1:0)
}
const daySource=adaptedRenderer.match(/function setNight\(value\) \{[\s\S]*?\n\}/)[0]
const originalScene={background:{set(){} }}, originalHemi={},originalKey={}
new Function('scene','hemi','key','floor','grid','document',`let night=false;${daySource};setNight(false);`)(
 originalScene,originalHemi,originalKey,{material:{color:{set(){}}}},{},{querySelector:()=>({setAttribute(){}})})
assert.equal(originalScene.environmentIntensity,1);assert.equal(originalHemi.intensity,2);assert.equal(originalKey.intensity,2.4)
console.log('Garage rendering: direct About canvas with lamps on/off, gallery-only MSAA/HDR allocation, and original day lighting passed.')

async function readiness() {
  const {prepareGarageVehicle}=load('scripts/garage/readiness.mjs')
  const texture=new THREE.Texture(), group=new THREE.Group(), material=new THREE.MeshStandardMaterial({map:texture,normalMap:texture})
  group.add(new THREE.Mesh(new THREE.BoxGeometry(),material),new THREE.Mesh(new THREE.BoxGeometry(),material))
  let finish, ready=false; const uploads=[]
  const preparation=prepareGarageVehicle({initTexture:t=>uploads.push(t),compileAsync:()=>new Promise(resolve=>finish=resolve)},group,roadCamera,group).then(()=>ready=true)
  assert.deepEqual(uploads,[texture],'Shared maps upload once')
  await Promise.resolve();assert.equal(ready,false,'Do not show the model while compilation is pending')
  finish();await preparation;assert.equal(ready,true)
  console.log('Garage readiness: texture uploads deduplicated and arrival waits for shader compilation.')
}
readiness().catch(error=>{console.error(error);process.exitCode=1})

// Run the canonical view and load-time framing for vehicles of different heights.
const fixedSource=fixedGarageTrack(originalRenderer)
const canonicalView=fixedSource.match(/function view\(name\) \{[\s\S]*?\n\}/)[0]
const framing=fixedSource.slice(fixedSource.indexOf('scene.add(vehicle);')+'scene.add(vehicle);'.length,fixedSource.indexOf('let tris = 0;'))
const trackCamera=new THREE.PerspectiveCamera(37,1.75,.02,100), target=new THREE.Vector3()
const controls={target,update(){trackCamera.lookAt(target);trackCamera.updateMatrixWorld()}}
const reframe=new Function('camera','controls','document',`let targetY=.65,cameraFit=1;${canonicalView};return height=>{const b={min:{y:0},max:{y:height}};${framing};view('hero');}`)(trackCamera,controls,{querySelector:()=>({setAttribute(){}}),querySelectorAll:()=>[]})
const projections=[.8,2.3,1.2].map(height=>{reframe(height);return new THREE.Vector3(2.1,0,4).project(trackCamera).toArray()})
assert.deepEqual(projections[0],projections[1]);assert.deepEqual(projections[1],projections[2])
console.log('Shared track: road stripe screen positions stay identical across vehicle heights.')

const darkScene={background:{set(value){this.value=value}}},darkHemi={},darkKey={},darkFloor={material:{color:{set(value){this.value=value}}}},darkGrid={}
new Function('scene','hemi','key','floor','grid','document',`let night=false;${daySource};setNight(true);`)(darkScene,darkHemi,darkKey,darkFloor,darkGrid,{querySelector:()=>({setAttribute(){}})})
assert.equal(darkScene.environmentIntensity,.2);assert.equal(darkHemi.intensity,.35);assert.equal(darkKey.intensity,.22);assert.equal(darkScene.background.value,791328);assert.equal(darkGrid.visible,false)
console.log('Gallery dark mode: original environment, hemisphere, key, background and grid settings passed.')
