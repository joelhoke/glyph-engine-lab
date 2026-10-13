// Real React DOM reconciliation and native events; GPU scenes are replaced with lifecycle probes.
// Runs locally in jsdom without opening a browser or contacting the preview server.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const { JSDOM } = require('jsdom')
const React = require('react'), { act } = React
const { createRoot } = require('react-dom/client')
const dom = new JSDOM('<div id="test-root"></div>', { pretendToBeVisual: true, url: 'https://example.test/about' })
for (const key of ['window','document','HTMLElement','Element','Event','CustomEvent','MouseEvent','MutationObserver']) global[key] = dom.window[key]
global.IS_REACT_ACT_ENVIRONMENT = true
global.innerWidth = 1440; global.innerHeight = 1000
window.matchMedia = global.matchMedia = query => ({ get matches() { return query.includes('reduced-motion') ? reducedMotion : query.includes('max-width') ? viewportWidth<=767 || (query.includes('max-height') && viewportHeight<=500) : false }, addEventListener() {}, removeEventListener() {} })
global.getComputedStyle = window.getComputedStyle.bind(window)
const resizeCallbacks = new Set()
global.ResizeObserver = class { constructor(callback) { this.callback=callback; resizeCallbacks.add(callback) } observe() {} disconnect() { resizeCallbacks.delete(this.callback) } }
let viewportWidth=1440, viewportHeight=1000, safeBottom=0
const frames = new Map(); let frameId = 0, now = 0
window.requestAnimationFrame = global.requestAnimationFrame = callback => { frames.set(++frameId,callback); return frameId }
window.cancelAnimationFrame = global.cancelAnimationFrame = id => frames.delete(id)
HTMLElement.prototype.getBoundingClientRect = function () {
  const compact=viewportWidth<=767 || viewportHeight<=500
  const dockHeight=32+150*Math.min(1,(viewportWidth-24)/700)*1.44
  const [left,top,width,height] = this.className === 'interests' ? (compact ? [12,viewportHeight-76-safeBottom-dockHeight,viewportWidth-24,dockHeight] : [130,250,1180,520])
    : this.className === 'contentPanel' ? [72,100,1008,600] : [0,0,viewportWidth,viewportHeight]
  return { left,top,width,height,right:left+width,bottom:top+height }
}
const rootDir = path.resolve(__dirname,'..'), cache = new Map(), mounted = new Set(), warnings = []
let objectsProps, arcClearance
let reducedMotion = false
const originalError = console.error
console.error = (...args) => { warnings.push(args.join(' ')); originalError(...args) }
const empty = () => null
const css = { __esModule: true, default: new Proxy({}, { get:(_,key)=>key }) }
function dynamic(loader) {
  const name = ['InterestObjects','FamilyStickers','CreativeMedia','CarsPlayground'].find(name=>loader.toString().includes(name))
  if (name === 'InterestObjects') return props => { objectsProps=props; return null }
  assert.ok(name, 'Every lazy scene has a lifecycle probe')
  return function SceneProbe() {
    React.useEffect(() => { mounted.add(name); return () => mounted.delete(name) },[])
    return React.createElement('div', { 'data-scene': name }, `${name} content`)
  }
}
function load(file) {
  const absolute = path.resolve(rootDir,file)
  if (cache.has(absolute)) return cache.get(absolute).exports
  const module = { exports: {} }; cache.set(absolute,module)
  let source = fs.readFileSync(absolute,'utf8')
  // A supplied historical file can prove this regression test catches the original bug.
  if (file.endsWith('InterestContent.tsx') && process.env.ABOUT_CONTENT_SOURCE) source = fs.readFileSync(process.env.ABOUT_CONTENT_SOURCE,'utf8')
  const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  new Function('require','module','exports',compiled)(name => {
    if (name === 'next/dynamic') return dynamic
    if (name.endsWith('.css')) return css
    if (['../SiteHeader','../AnalyticsConsent','../lighting/LightingSurface'].includes(name)) return empty
    if (name === '../../engine/useReducedMotion') return {useReducedMotion:()=>reducedMotion}
    if (name === '../../engine/useSystemTheme') return {useSystemTheme:()=> 'dark'}
    if (name === './useCreativeMedia') return {useCreativeMedia:()=>({snapshot:{comics:[]},state:'saved',upcoming:false})}
    if (name === '../originkit/ui/fibre-arc') return {__esModule:true,default:props=>{ arcClearance=props.clearanceRef; return React.createElement('canvas') },...load('components/originkit/ui/fibreArcGeometry.ts')}
    if (name === '../originkit/useFibrePalette') return {useFibrePalette:()=>({})}
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(absolute),name)
      const target = ['','.ts','.tsx'].map(ext=>base+ext).find(file=>fs.existsSync(file))
      return load(target)
    }
    return require(name)
  },module,module.exports)
  return module.exports
}
async function main() {
  const About = load('components/about/AboutDesktop.tsx').default
  const { ABOUT } = load('content/about.ts')
  const root = createRoot(document.getElementById('test-root'))
  const settle = async () => { await act(async()=> { for(let i=0;i<160 && frames.size;i++) { now+=16; const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now)) } }) }
  try {
    await act(async()=>root.render(React.createElement(About))); await settle()
    assert.equal(document.querySelector('#interest-heading').textContent,'Family')
    for (let cycle=0;cycle<3;cycle++) for(const interest of ABOUT.interests) {
      const button=document.querySelector(`[data-interest="${interest.id}"]`)
      await act(async()=> { button.focus(); button.click() }); await settle()
      assert.equal(document.querySelectorAll('#interest-content').length,1)
      assert.equal(document.querySelectorAll('#interest-heading').length,1,'Switching must replace the heading, never append it')
      assert.equal(document.querySelector('#interest-heading').textContent,interest.title)
      assert.equal(document.querySelectorAll('#interest-content > header').length,1)
      assert.equal(document.querySelectorAll('#interest-content > .sectionBody').length,1)
      const expected = {family:'FamilyStickers',comics:'CreativeMedia',automotive:'CarsPlayground'}[interest.id]
      assert.deepEqual([...mounted],expected?[expected]:[],'Only the selected content scene remains mounted')
      assert.ok(document.querySelector('.sectionBody').textContent.trim(),'Active content must remain present')
      await act(async()=>document.getElementById('main-content').focus()); await settle()
      assert.equal(button.getAttribute('aria-pressed'),'true')
      assert.equal(button.dataset.weight,'1','Selected item stays magnified after focus leaves the dock')
      assert.equal(objectsProps.selected,interest.id,'Selected model retains its full-color/light state')
      const other=[...document.querySelectorAll('[data-interest]')].find(el=>el!==button)
      await act(async()=>other.focus()); await settle()
      assert.equal(button.dataset.weight,'1','Hovering/focusing another item does not shrink the selection')
      assert.equal(other.dataset.weight,'1','Other interests can still preview on focus')
      assert.equal(document.querySelector('#interest-heading').textContent,interest.title,'Focus alone does not switch content')
    }
    await act(async()=>document.querySelector('[data-interest="comics"]').click()); await settle()
    assert.equal(arcClearance.current.amount,.82,'The four-pile row reserves more clearance than a single hero')
    const last=document.querySelector('[data-interest="automotive"]')
    const priorTop=parseFloat(last.style.top)
    const media=document.querySelector('[data-scene="CreativeMedia"]')
    await act(async()=>media.setAttribute('data-fibre-space','collection')); await settle()
    assert.equal(arcClearance.current.amount,1,'Expanded collection clears the full row')
    assert.ok(parseFloat(last.style.top)>priorTop,'Right-hand dock follows the arc downward')
    for(const button of document.querySelectorAll('[data-interest]')) {
      assert.ok(250+parseFloat(button.style.top)+parseFloat(button.style.height)<1000,'Dock remains on screen')
    }
    assert.equal(frames.size,0,'Layout loop parks once the bend settles')
    await act(async()=>media.removeAttribute('data-fibre-space')); await settle()
    assert.equal(arcClearance.current.amount,.82)
    assert.equal(parseFloat(last.style.top),priorTop,'Closing restores the prior geometry')
    reducedMotion=true
    await act(async()=>root.render(React.createElement(About))); await settle()
    await act(async()=>media.setAttribute('data-fibre-space','collection'))
    assert.equal(arcClearance.current.amount,1,'Reduced motion applies the final geometry immediately')
    const {fibreArcBaseline,fibreArcClearanceBaseline}=load('components/originkit/ui/fibreArcGeometry.ts')
    const {INTEREST_ARC}=load('components/about/interestLayout.ts')
    for(const [width,height,safe] of [[320,568,0],[390,844,34],[526,1236,0],[700,900,20],[844,390,21]]) {
      viewportWidth=width;viewportHeight=height;safeBottom=safe
      await act(async()=>resizeCallbacks.forEach(callback=>callback()));await settle()
      const dock=document.querySelector('.interests'),bounds=dock.getBoundingClientRect()
      assert.equal(dock.dataset.layout,'compact')
      assert.equal(arcClearance.current.amount,1,'Mobile retains its shallow bottom arc in every content state')
      const buttons=[...dock.querySelectorAll('[data-interest]')]
      let previousCenter=-1
      for(const button of buttons) {
        const w=parseFloat(button.style.width),h=parseFloat(button.style.height)
        const left=bounds.left+parseFloat(button.style.left),top=bounds.top+parseFloat(button.style.top)
        const cx=left+w/2,cy=top+h/2
        assert.ok(w>=44 && h>=44,'Touch targets stay at least 44px')
        assert.ok(cx>previousCenter && left>=0 && left+w<=width,'All fan objects remain on screen in order')
        previousCenter=cx
        assert.ok(top>=bounds.top && top+h<=bounds.bottom-16,'Icons retain bottom breathing room without a label row')
        const base=fibreArcBaseline(cx,width,height,INTEREST_ARC.bundle.curve,INTEREST_ARC.apex,INTEREST_ARC.direction)
        assert.ok(Math.abs(cy-fibreArcClearanceBaseline(cx,width,height,base,arcClearance.current))<.001,'Icons stay centered on the same curve as the shader')
      }
      const positions=buttons.map(button=>button.style.top)
      await act(async()=>media.removeAttribute('data-fibre-space'));await settle()
      assert.deepEqual(buttons.map(button=>button.style.top),positions,'Opening/closing content does not move the mobile dock')
    }
    const heading=()=>document.querySelector('#interest-heading').textContent
    assert.equal(document.querySelector('[aria-label="Next section"]'),null,'Mobile dock has no carousel arrows')
    assert.equal(document.querySelector('.home-hero-mobile-label'),null,'Mobile dock has no carousel label control')
    const tap=element=>element.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}))
    await act(async()=>tap(document.querySelector('[data-interest="family"]')));await settle()
    assert.equal(heading(),'Family','First tap immediately opens the section')
    await act(async()=>tap(document.querySelector('[data-interest="comics"]')));await settle()
    assert.equal(heading(),'Creative Media','A different icon opens on the first tap')
    assert.equal(document.querySelector('[data-interest="comics"]').dataset.weight,'1','Selected icon stays magnified')
    assert.equal(document.querySelector('[data-interest="family"]').dataset.weight,'0','Previous icon returns to rest')
    const dock=document.querySelector('.interests')
    const touch=(type,x)=>{
      const event=new Event(type,{bubbles:true,cancelable:true})
      const finger={clientX:x,clientY:300,identifier:1}
      Object.assign(event,{touches:type==='touchend'?[]:[finger],changedTouches:[finger]})
      dock.dispatchEvent(event)
    }
    await act(async()=>{touch('touchstart',200);touch('touchmove',130);touch('touchend',120)});await settle()
    assert.equal(heading(),'Creative Media','Swiping does not cycle the direct-navigation dock')
    assert.equal(document.querySelector('[data-interest="comics"]').dataset.weight,'1','Swiping cannot change the active icon')
    await act(async()=>document.querySelector('[data-interest="family"]').focus());await settle()
    assert.equal(heading(),'Creative Media','Keyboard focus alone does not replace content')
    viewportWidth=1440;viewportHeight=1000;safeBottom=0
    await act(async()=>resizeCallbacks.forEach(callback=>callback()));await settle()
    assert.equal(document.querySelector('.interests').dataset.layout,'arc','Desktop composition restores on resize')
    assert.equal(arcClearance.current.amount,.82)
    assert.ok(!warnings.some(message=>/same key|unique.*key/i.test(message)),'No React key warnings')
  } finally { await act(async()=>root.unmount()); console.error=originalError; dom.window.close() }
  assert.equal(mounted.size,0)
  assert.equal(frames.size,0)
  console.log('About switching: 15 transitions, scene cleanup, persistent selection, arc/dock alignment, idle parking, reduced motion, five responsive layouts, direct mobile taps, no carousel controls, stable swipe/focus behavior and desktop restoration passed.')
}
main().catch(error=>{console.error=originalError;console.error(error);process.exitCode=1})
