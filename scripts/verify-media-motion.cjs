// Exercise measured stack-to-row motion without a browser or GPU.
const assert = require('node:assert/strict')
const fs = require('node:fs'), ts = require('typescript')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<div id="pile"></div><ul id="track"></ul>')
global.window = dom.window
const moduleUnderTest = { exports: {} }
new Function('module','exports',ts.transpileModule(fs.readFileSync('components/about/mediaMotion.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText)(moduleUnderTest,moduleUnderTest.exports)
const {captureMediaPile,unfoldMediaCases} = moduleUnderTest.exports
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height})
const pile=window.document.getElementById('pile'),track=window.document.getElementById('track')
const sourceBounds=[rect(600,450,140,210),rect(620,440,140,210),rect(640,430,140,210)]
sourceBounds.forEach((bounds,index)=>{
  const item=window.document.createElement('div');item.dataset.mediaCase=String(index)
  item.getBoundingClientRect=()=>bounds;pile.append(item)
})
const source=captureMediaPile(pile),animations=[]
track.getBoundingClientRect=()=>rect(80,180,740,500)
track.animate=()=>{}
for(let index=0;index<5;index++){
  const stand=window.document.createElement('div'),item=window.document.createElement('div')
  item.dataset.mediaCase=String(index)
  const target=rect(110+index*210,220,180,270),container=rect(100+index*210,200,200,300)
  item.getBoundingClientRect=()=>target;stand.getBoundingClientRect=()=>container
  stand.animate=(frames,options)=>{
    const animation={frames,options,canceled:0,cancel(){this.canceled++},onfinish:null,target,container,index}
    animations.push(animation);return animation
  }
  stand.append(item);track.append(stand)
}
const dispose=unfoldMediaCases(track,source)
assert.equal(animations.length,4,'Only cases visible in the row animate')
for(const animation of animations){
  const {frames,target,container,index}=animation
  const [dx,dy,sx,sy]=frames[0].transform.match(/-?\d+(?:\.\d+)?/g).map(Number)
  const original=sourceBounds[Math.min(index,2)]
  assert.ok(Math.abs(container.left+dx+sx*(target.left-container.left)-original.left)<.001)
  assert.ok(Math.abs(container.top+dy+sy*(target.top-container.top)-original.top)<.001)
  assert.ok(Math.abs(target.width*sx-original.width)<.001)
  assert.equal(frames[0].opacity,index<3?1:0,'The original three covers never fade away')
  assert.equal(frames[1].transform,'translate(0px, 0px) scale(1, 1)')
}
animations[0].onfinish();assert.equal(animations[0].canceled,1,'Finished effects release their compositing layer')
track.dispatchEvent(new window.Event('wheel'));assert.ok(animations.every(a=>a.canceled>0),'Scrolling cancels motion')
dispose();const counts=animations.map(a=>a.canceled)
window.dispatchEvent(new window.Event('resize'));track.dispatchEvent(new window.Event('keydown'))
assert.deepEqual(animations.map(a=>a.canceled),counts,'Cleanup removes interaction listeners')
assert.doesNotThrow(()=>unfoldMediaCases(track,new Map())())
dom.window.close()
console.log('Media motion passed: exact source bounds, persistent cover visibility, visible-only animation, interaction cancellation and cleanup.')
