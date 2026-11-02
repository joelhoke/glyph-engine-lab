#!/usr/bin/env node
// Geometry/gradient endpoint contracts and asynchronous playback intent.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'tmp-verify-home-feature/unit')
execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
  'components/home/flower/geometry.ts', 'content/statementFlower.ts', 'components/home/highlightPlayback.ts',
  '--outDir', out, '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck',
], {cwd:root, stdio:'inherit'})
const THREE = require('three')
const { Flower } = require(path.join(out, 'components/home/flower/geometry.js'))
const { petalCorrespondence } = require(path.join(out, 'components/home/flower/petal-mapping.js'))
const { flowerProgress, STATEMENT_FLOWER } = require(path.join(out, 'content/statementFlower.js'))
const { HighlightPlayback } = require(path.join(out, 'components/home/highlightPlayback.js'))
for (const [p, index, amount] of [[0,0,0],[.1,0,0],[.45,0,1],[.49,0,1],[.5,1,0],[.55,1,0],[.9,1,1],[1,1,1]]) assert.deepEqual(flowerProgress(p), {index,amount})
for (const [a,b] of [[5,24],[24,30]]) {
  const patches=petalCorrespondence(a,b)
  for(const [key,count] of [['from',a],['to',b]])for(let petal=0;petal<count;petal++) {
    const coverage=patches.filter(p=>p[key]===petal).reduce((n,p)=>n+p[key+'Range'][1]-p[key+'Range'][0],0)
    assert(Math.abs(coverage-1)<1e-9, 'every petal must preserve its entire surface')
  }
}
const flowers=[new Flower({...STATEMENT_FLOWER.geometry,variety:'plumeria',target:'rose'}),new Flower({...STATEMENT_FLOWER.geometry,variety:'rose',target:'daisy'})]
// Shared surface coordinates at the Rose handoff must agree in world-space,
// element-gradient coordinates and palette phase, despite different patch counts.
function endpoint(flower, amount, key) {
 flower.update(2.5,amount);flower.root.updateMatrixWorld(true)
 const samples=new Map()
 for(const mesh of flower.petalMeshes){
  const patch=mesh.userData.petalPatch,range=patch[key+'Range'],attribute=mesh.geometry.getAttribute(key==='to'?'elementGradientTarget':'elementGradientPosition')
  for(let side=0;side<2;side++)for(let row=1;row<36;row++)for(let j=0;j<=12;j++){
   const v=range[0]+(range[1]-range[0])*j/12,index=side*37*13+row*13+j
   const position=mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)
   samples.set(`${patch[key]}:${side}:${row}:${v.toFixed(7)}`,{position,gradient:new THREE.Vector3().fromBufferAttribute(attribute,index),phase:mesh.userData.gradientPhaseUniform.value})
  }
 }
 return samples
}
const incoming=endpoint(flowers[0],1,'to'),outgoing=endpoint(flowers[1],0,'from')
let matched=0
for(const [key,a] of incoming){const b=outgoing.get(key);if(!b)continue;matched++;assert(a.position.distanceTo(b.position)<1e-6);assert(a.gradient.distanceTo(b.gradient)<1e-6);assert(Math.abs(a.phase-b.phase)<1e-10)}
assert(matched>1000)
for(const flower of flowers){
 const before=endpoint(flower,.37,'from')
 flower.update(2.5,.8);flower.update(2.5,.1)
 const after=endpoint(flower,.37,'from')
 for(const [key,a]of before)assert(a.position.distanceTo(after.get(key).position)<1e-10,'reverse scrolling must be history-independent')
 flower.update(2.5,.5)
 const widths=flower.petalMeshes.map(mesh=>{const points=Array.from({length:13},(_,j)=>mesh.getVertexPosition(18*13+j,new THREE.Vector3()).z);return Math.max(...points)-Math.min(...points)})
 assert(Math.max(...widths)-Math.min(...widths)<1e-6,'intermediate petals retain uniform widths')
}
class Video {
 readyState=1;currentTime=0;duration=75;paused=true;events={};requests=[];src=''
 addEventListener(n,f){this.events[n]=f} removeEventListener(n){delete this.events[n]}
 pause(){this.paused=true} load(){this.readyState=0} removeAttribute(){this.src=''}
 play(){this.paused=false;return new Promise((resolve,reject)=>this.requests.push({resolve,reject}))}
}
const flush=async()=>{await Promise.resolve();await Promise.resolve()}
async function playbackTests(){
 const video=new Video(),blocked=[],player=new HighlightPlayback(video,v=>blocked.push(v))
 player.setSource('landscape');player.configure(true,false)
 const pending=video.requests.shift();player.configure(false,false);pending.resolve();await flush();assert(video.paused)
 player.configure(true,false);video.requests.shift().resolve();await flush();assert(!video.paused)
 player.pause();player.configure(false,false);player.configure(true,false);assert(video.paused,'manual pause survives visibility')
 video.readyState=1;video.currentTime=23.5;player.setSource('portrait');video.readyState=1;video.events.loadedmetadata();assert.equal(video.currentTime,23.5);assert(video.paused,'orientation preserves pause')
 player.play();video.requests.shift().reject(new DOMException('Blocked','NotAllowedError'));await flush();assert.equal(blocked.at(-1),true)
 player.configure(false,false);player.configure(true,false);assert.equal(video.requests.length,0,'blocked autoplay must not retry without a gesture')
 player.play();video.requests.shift().resolve();await flush();assert(!video.paused)
 player.configure(true,true);assert(video.paused,'new reduced-motion preference pauses playback')
 player.play();video.requests.shift().resolve();await flush();assert(!video.paused,'explicit play overrides reduced motion')
 player.configure(false,true);assert(video.paused)
 player.configure(true,true);const late=video.requests.shift();player.dispose();late.resolve();await flush();assert(video.paused);assert.equal(video.src,'')
 console.log(`PASS: ${matched} Rose geometry/gradient samples; morph holds, reversal and uniform bridges; playback interruption, manual pause, orientation, blocked autoplay, reduced motion and disposal`)
}
playbackTests().catch(e=>{console.error(e);process.exitCode=1})
