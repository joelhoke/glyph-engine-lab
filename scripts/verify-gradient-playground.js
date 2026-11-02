#!/usr/bin/env node
// CPU-side renderer contracts, using the installed Three shader templates.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'tmp-verify-gradient-playground')
execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
  'components/gallery/three-gradient/motion.ts', 'components/home/flower/geometry.ts',
  'components/home/flower/gradient.ts', 'content/gradientPlayground.ts',
  '--outDir', out, '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck',
], {cwd:root, stdio:'inherit'})
const { advanceFlowerProgress: advance, scrollFlowerProgress: scroll, flowerPositionLabel: label, playgroundFlowerProgress: segment } = require(path.join(out, 'components/gallery/three-gradient/motion.js'))
const { GRADIENT_PLAYGROUND: defaults } = require(path.join(out, 'content/gradientPlayground.js'))
const { STATEMENT_FLOWER: home } = require(path.join(out, 'content/statementFlower.js'))
const { gradientUniforms, setGradientUniforms, applyGradient } = require(path.join(out, 'components/home/flower/gradient.js'))
const { Flower } = require(path.join(out, 'components/home/flower/geometry.js'))
const THREE = require('three')
const close = (a,b) => assert(Math.abs(a-b)<1e-9, `${a} ≠ ${b}`)
close(advance(0,1,16,16).progress,1)
close(advance(1,-1,16,16).progress,0)
close(advance(.99,1,.32,16).progress,.99)
assert.equal(advance(.99,1,.32,16).direction,-1)
close(advance(.01,-1,.32,16).progress,.01)
assert.equal(advance(.01,-1,.32,16).direction,1)
close(advance(.4,-1,0,16).progress,.4)
let p={progress:0,direction:1}
for(let i=0;i<1200;i++)p=advance(p.progress,p.direction,1/60,16)
close(p.progress,advance(0,1,20,16).progress)
for(const [top,expected] of [[300,0],[88,0],[-412,.5],[-912,1],[-2000,1],[-412,.5],[88,0]])close(scroll(top,1600,600,88),expected)
for(const [p,expected]of [[0,'Plumeria'],[1/3,'Rose'],[2/3,'Daisy'],[1,'Cherry blossom']])assert.equal(label(p),expected)
assert.deepEqual(segment(0),{index:0,amount:0})
assert.deepEqual(segment(1),{index:2,amount:1})
for(const handoff of [1/3,2/3]) {
 assert.equal(segment(handoff-.001).amount,1)
 assert.equal(segment(handoff+.001).amount,0)
 assert.equal(label(handoff-.001),label(handoff+.001))
}

// Adding Cherry must preserve the Daisy handoff, then reach the source's
// exact five-petal blossom with its visible stamens and matching gradients.
function samples(flower,amount,key) {
 flower.update(2.5,amount);flower.root.updateMatrixWorld(true)
 const result=new Map()
 for(const mesh of flower.petalMeshes) {
  const patch=mesh.userData.petalPatch,range=patch[key+'Range']
  const gradient=mesh.geometry.getAttribute(key==='to'?'elementGradientTarget':'elementGradientPosition')
  for(let j=0;j<=12;j++) {
   const i=18*13+j,v=range[0]+(range[1]-range[0])*j/12
   result.set(`${patch[key]}:${v.toFixed(7)}`,{
    position:mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld),
    gradient:new THREE.Vector3().fromBufferAttribute(gradient,i),phase:mesh.userData.gradientPhaseUniform.value,
   })
  }
 }
 return result
}
function compare(a,b) {
 let matched=0
 for(const [key,first]of a){const second=b.get(key);if(!second)continue;matched++;
  assert(first.position.distanceTo(second.position)<1e-6)
  assert(first.gradient.distanceTo(second.gradient)<1e-6)
  close(first.phase,second.phase)
 }
 assert(matched>=60)
}
const incomingDaisy=new Flower({...home.geometry,variety:'rose',target:'daisy'})
const cherry=new Flower({...home.geometry,variety:'daisy',target:'cherry'})
const pureCherry=new Flower({...home.geometry,variety:'cherry',target:'cherry'})
compare(samples(incomingDaisy,1,'to'),samples(cherry,0,'from'))
compare(samples(cherry,1,'to'),samples(pureCherry,0,'from'))
assert(cherry.stamens.visible);assert.equal(cherry.stamens.children.length,15)
cherry.update(2.5,0);assert.equal(cherry.stamens.visible,false)
assert.deepEqual(home.sequence,['plumeria','rose','daisy'],'homepage sequence stays unchanged')

const u=gradientUniforms()
setGradientUniforms(u,defaults.gradient)
assert.equal(u.uElementScope.value,1)
const flower=new Flower({...home.geometry,variety:'plumeria',target:'rose'})
applyGradient(flower.root,u)
const mesh=flower.petalMeshes[0],material=mesh.material,geometry=mesh.geometry
const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader}
material.onBeforeCompile(shader,{})
assert(shader.vertexShader.includes('vGradientPosition = (uAssetInv * modelMatrix * gradientVertex).xyz'))
assert(shader.vertexShader.includes('mix(mix(elementGradientPosition,elementGradientTarget,uPetalMorph),elementGradientBridge,uPetalBridge)'))
assert(shader.fragmentShader.includes('vec3 p=mix(vGradientPosition,vElementPosition,uElementScope)'))
assert(shader.fragmentShader.includes('diffuseColor.rgb=palette(coord+phase)'))
const colors=shader.uniforms.uColors.value
for(const [i,mode] of ['bands','radial','noise'].entries())for(const scope of ['element','object']){
 setGradientUniforms(u,{...defaults.gradient,mode,scope,palette:['#ff0000','#00ff00','#0000ff'],direction:90})
 assert.equal(shader.uniforms.uMode.value,i)
 assert.equal(shader.uniforms.uElementScope.value,scope==='element'?1:0)
 assert.equal(shader.uniforms.uCount.value,3)
 assert.equal(shader.uniforms.uColors.value,colors,'palette edits update existing shader uniforms')
 assert.equal(colors[0].getHexString(),'ff0000')
 assert(Math.abs(shader.uniforms.uStops.value[1]-1/3)<1e-7)
 close(shader.uniforms.uAngle.value,Math.PI/2)
 assert.equal(mesh.material,material);assert.equal(mesh.geometry,geometry)
}
setGradientUniforms(u,defaults.gradient)
assert.equal(colors[0].getHexString(),home.palette[0].slice(1).toLowerCase())
assert.equal(u.uMode.value,2);assert.equal(u.uElementScope.value,1)
assert.equal(defaults.gradient.mode,home.gradient.mode)
console.log('PASS: four-flower sequence, Daisy handoff and Cherry geometry/gradient/stamens; time and scroll reversal; every gradient/application combination; live palette edits; installed Three shader hooks; homepage defaults')
