// Decode the real supplied GLB without image/GPU allocation; retain its geometry,
// hierarchy, transforms and light metadata to verify the actual emitter bindings.
import fs from 'node:fs'
import * as THREE from 'three'
import { createGarageLighting } from './garage/lighting.mjs'
import { garageRoadBounds } from './garage/road.mjs'
import { GARAGE_COMPOSITION, placeGarageVehicle } from './garage/composition.mjs'
import { createVehicleWheels } from './garage/wheels.mjs'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const require = createRequire(import.meta.url), ts = require('typescript')
const sourceRoot = process.argv[2]
assert.ok(sourceRoot,'Pass the original vehicle project root')
const module = {exports:{}}
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(`${sourceRoot}/outputs/playground/source/vehicle-lighting.js`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(require,module,module.exports)
async function readVehicle(file) {
const bytes = fs.readFileSync(new URL(`../public/assets/about/garage/${file}.glb`,import.meta.url))
const size=bytes.readUInt32LE(12), doc=JSON.parse(bytes.subarray(20,20+size))
doc.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+size).toString('base64')}`
doc.images=[];doc.textures=[];doc.samplers=[]
doc.materials=doc.materials.map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]}}))
globalThis.ProgressEvent ??= class { constructor(type,props) {Object.assign(this,{type},props)} }
return (await new GLTFLoader().parseAsync(JSON.stringify(doc),'')).scene
}
const webBytes=fs.readFileSync(new URL('../public/assets/about/garage/4runner.glb',import.meta.url))
const webDoc=JSON.parse(webBytes.subarray(20,20+webBytes.readUInt32LE(12)))
const triangles=webDoc.meshes.reduce((sum,mesh)=>sum+mesh.primitives.reduce((n,p)=>n+webDoc.accessors[p.indices].count/3,0),0)
assert.equal(triangles,764780,'Restore the full original 4Runner geometry')
const originalBytes=fs.readFileSync(`${sourceRoot}/outputs/4runner-v13/4runner-clean-underbody.glb`)
const originalDoc=JSON.parse(originalBytes.subarray(20,20+originalBytes.readUInt32LE(12)))
assert.deepEqual(webDoc.meshes,originalDoc.meshes,'Original mesh topology retained')
assert.deepEqual(webDoc.materials,originalDoc.materials,'Original materials retained')
assert.deepEqual(webBytes.subarray(28+webBytes.readUInt32LE(12)),originalBytes.subarray(28+originalBytes.readUInt32LE(12)),'Every original geometry byte retained')
const scene=await readVehicle('4runner')
const lights=module.exports.createVehicleLighting(scene)
lights.setState({beams:'low',fog:true,accent:true,tails:true})
const on=lights.getDiagnostics()
assert.equal(on.beams,6,'Original low, high and fog beam pairs are retained for the gallery')
assert.equal(on.activeBeams,4,'Both low and fog beam pairs are active')
for (const side of ['driver','passenger']) for (const channel of ['low','fog','accent']) assert.ok(on.activeEmitters.some(e=>e.side===side&&e.channel===channel),`${side} ${channel} emitter bound`)
scene.traverse(node=>{
  if(!node.isMesh||node.userData.lightChannel!=='fog')return
  const material=node.material
  assert.deepEqual(material.emissive.toArray(),[1,.32,.008],'Fog emitters preserve the authored amber color')
  assert.equal(material.emissiveIntensity,4.5,'Fog emission uses the original controller brightness')
})
lights.setState({beams:'off',fog:false,accent:false,tails:false})
assert.equal(lights.getDiagnostics().activeBeams,0);assert.equal(lights.getDiagnostics().activeEmitters.length,0)
lights.dispose()
const aboutLights=createGarageLighting(scene,module.exports.createVehicleLighting,false)
assert.equal(aboutLights.getDiagnostics().beams,4,'About omits high beam sources only')
aboutLights.dispose()
console.log(`Actual 4Runner GLB: ${on.emitters} emitters bound; low beams, fog lights and accents switch on/off correctly.`)

const placements=[]
for (const [file,id,count] of [['4runner','lighting',4],['mclaren','mclaren',2],['lancia','lancia',2]]) {
  const original=file==='4runner'?scene:await readVehicle(file)
  // Include the Lancia's actual duplicate glass pass in the wheel hierarchy check.
  if (id==='lancia') {
    const layers=[]
    original.traverse(node=>{if(node.isMesh){const glass=node.clone(false);glass.userData.lanciaGlass=true;layers.push([node.parent,glass])}})
    layers.forEach(([parent,glass])=>parent.add(glass))
  }
  const vehicle=new THREE.Group();vehicle.add(original)
  const box=new THREE.Box3().setFromObject(vehicle),size=box.getSize(new THREE.Vector3())
  if(size.x>size.z)vehicle.rotation.y=Math.PI/2
  vehicle.updateMatrixWorld(true);box.setFromObject(vehicle);box.getSize(size)
  vehicle.scale.setScalar(4.8/Math.max(size.x,size.z));vehicle.updateMatrixWorld(true);box.setFromObject(vehicle)
  const center=box.getCenter(new THREE.Vector3());vehicle.position.set(-center.x,-box.min.y,-center.z);vehicle.updateMatrixWorld(true)
  const meshTransforms=new Map();vehicle.traverse(node=>{if(node.isMesh)meshTransforms.set(node,node.matrixWorld.clone())})
  const wheels=createVehicleWheels(THREE,vehicle,id);assert.equal(wheels.count,count,`${file} wheel assembly count`)
  vehicle.updateMatrixWorld(true)
  for(const [mesh,matrix] of meshTransforms) assert.ok(matrix.elements.every((value,i)=>Math.abs(value-mesh.matrixWorld.elements[i])<1e-6),'Binding preserves the supplied mesh placement')
  const pivots=[];vehicle.traverse(node=>{if(node.name.startsWith('Rolling axle:'))pivots.push({node,center:node.getWorldPosition(new THREE.Vector3()),rotation:node.quaternion.clone()})})
  wheels.advance(0);assert.ok(pivots.every(({node,rotation})=>node.quaternion.equals(rotation)),'Stationary wheels do not rotate')
  wheels.advance(.1);vehicle.updateMatrixWorld(true)
  for(const {node,center,rotation} of pivots){assert.ok(!node.quaternion.equals(rotation),'Wheel rotates with distance');assert.ok(node.getWorldPosition(new THREE.Vector3()).distanceTo(center)<1e-6,'Axle stays on the road')}
  for(const [mesh,matrix] of meshTransforms){let ancestor=mesh,rolling=false;while(ancestor){if(ancestor.name.startsWith('Rolling axle:'))rolling=true;ancestor=ancestor.parent}if(!rolling)assert.ok(matrix.elements.every((value,i)=>Math.abs(value-mesh.matrixWorld.elements[i])<1e-6),'Body and suspension remain fixed')}
  const entry=GARAGE_COMPOSITION.find(entry=>entry.id===id)
  if(entry) {
    const beforeGround=new THREE.Box3().setFromObject(vehicle).min.y
    placeGarageVehicle(vehicle,entry)
    const bounds=new THREE.Box3().setFromObject(vehicle)
    assert.ok(Math.abs(bounds.min.y-beforeGround*entry.scale)<1e-6,'Shared composition preserves each car ground offset')
    const camera=new THREE.PerspectiveCamera(37,1204/680,.02,100)
    camera.position.set(5.8,2.8,6.2);camera.lookAt(0,.65,0);camera.setViewOffset(1204,680,1204*.12,680*.02,1204,680);camera.updateMatrixWorld()
    const center=bounds.getCenter(new THREE.Vector3()).project(camera)
    const road=garageRoadBounds(GARAGE_COMPOSITION)
    assert.ok(bounds.min.x>road.left && bounds.max.x<road.right,'Track edges enclose the actual car geometry')
    assert.ok(bounds.min.z-14>road.far && bounds.max.z+14*1.35<road.near,'Markings cover the complete arrival/departure path')
    placements.push({id,x:center.x,y:center.y})
    console.log(`${id} shared scene center: ${Math.round((center.x+1)*602)}, ${Math.round((1-center.y)*340)}`)
  }
  console.log(`${file}: authored wheels roll about fixed axles; body, geometry and initial placement preserved.`)
}

assert.equal(placements.length,2)
const [runner,f1]=placements
assert.ok(runner.x>f1.x && runner.y>f1.y,'4Runner appears to the right and slightly higher than F1 as in the reference')
assert.ok(placements.every(({x,y})=>Math.abs(x)<.9&&Math.abs(y)<.9),'Both car centers remain inside the shared scene')

assert.ok(Math.abs(runner.y-f1.y)<.2,'Cars sit beside each other rather than far apart vertically')
