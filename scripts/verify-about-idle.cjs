async function main() {
// Exercise the actual object-renderer lifecycle without a browser or GPU.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const THREE = await import('three')
const root = path.resolve(__dirname, '..')
const frames = new Map(), events = new Map(), effects = [], cleanups = [], amounts = new Map(), lightColors = new Map()
let themeChanged, captures = 0
let nextFrame = 0, boundsReads = 0, renders = 0, clears = 0, ready = 0
const rect = { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 }
const slots = load('content/about.ts', require).ABOUT.interests.map(({ id }) => ({
  dataset: { interestObject: id }, parentElement: { dataset: { weight: '0' } },
  getBoundingClientRect() { boundsReads++; return rect },
  querySelector: () => ({ style: {}, decode: () => Promise.resolve(), removeAttribute() {} }),
}))
const host = { getBoundingClientRect: () => rect, querySelectorAll: () => slots,
  addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) }
const canvas = { addEventListener() {}, removeEventListener() {} }
global.matchMedia = () => ({ addEventListener(_name, fn) { themeChanged = fn }, removeEventListener() {} })
global.getComputedStyle = () => ({ getPropertyValue: () => '#8abaff' })
global.window = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} }
global.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => { captures++; return "data:image/png;base64,test" } }), hidden: false, addEventListener() {}, removeEventListener() {} }
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
global.MutationObserver = class { observe() {} disconnect() {} }
global.requestAnimationFrame = fn => { frames.set(++nextFrame, fn); return nextFrame }
global.cancelAnimationFrame = id => frames.delete(id)
class Renderer {
  getPixelRatio() { return 1 } setPixelRatio() {} setClearColor() {} setSize() {} setScissorTest() {}
  setViewport() {} setScissor() {} clearDepth() {} dispose() {}
  clear() { clears++ } render() { renders++ }
}
function load(file, requireModule) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(requireModule, module, module.exports)
  return module.exports
}
const frameLoop = load('engine/frameLoop.ts', require)
const accents = load('components/about/interestAccents.ts', name => name === 'three' ? THREE : require(name))
const celebration = accents.createPodiumCelebration()
let refIndex = 0
const component = load('components/about/InterestObjects.tsx', name => {
  if (name === 'react') return { useRef: value => ({ current: refIndex++ === 0 ? canvas : value }), useEffect: fn => effects.push(fn) }
  if (name === 'react/jsx-runtime') return { jsx() {} }
  if (name === 'three') return { ...THREE, WebGLRenderer: Renderer }
  if (name.endsWith('/frameLoop')) return frameLoop
  if (name.endsWith('/studioRig')) return { createStudioRig: () => ({ apply() {} }) }
  if (name === './dockPreview') return load('components/about/dockPreview.ts', require)
  if (name === './interestModels') return { createInterestModel: id => ({ object: new THREE.Group().add(new THREE.Group()), pose: [0, 0, 0], animate: id === 'automotive' ? celebration.animate : undefined, update(amount) { amounts.set(id, amount) }, setLightColor(color) { lightColors.set(id, color) }, dispose() {} }) }
  if (name.endsWith('.css')) return { default: {} }
  throw new Error(`Unexpected import: ${name}`)
}).default
const props = { host: { current: host }, comics: [], highlighted: null, selected: null, active: true, reducedMotion: false,
  onReady() { ready++ }, onUnavailable() { throw new Error('Unexpected renderer failure') } }
component(props)
for (const effect of effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup) }
let now = 0
function flush() {
  const pending = [...frames.values()]; frames.clear(); now += 16
  for (const frame of pending) frame(now)
}
flush()
assert.equal(ready, 1)
assert.equal(renders, slots.length, 'Every resting icon is drawn at startup')
await Promise.resolve(); await Promise.resolve(); flush()
const initialReads = boundsReads, initialClears = clears
for (let i = 0; i < 120; i++) events.get('study-illumination')({ detail: [] })
assert.equal(frames.size, 0, 'Resting blue icons do not redraw for background color cycles')
assert.equal(boundsReads, initialReads, 'Idle lighting does not remeasure slots')
assert.equal(clears, initialClears, 'Idle lighting preserves the visible icons')
props.highlighted = slots[0].dataset.interestObject
slots[0].parentElement.dataset.weight = '1'
events.get('study-illumination')({ detail: [{ color: '#d73d79', intensity: 8.4, position: { x: 0.2, y: 1 } }] })
events.get('interest-layout')(); flush()
assert.equal(lightColors.get(props.highlighted), '#d73d79', 'Only the live model receives background color changes')
assert.equal(renders, slots.length + 1, 'Magnification renders only the active object; the other four are PNGs')
assert.equal(boundsReads - initialReads, slots.length, 'Layout changes refresh cached viewport bounds')
const afterLayout = boundsReads
for (let i = 0; i < 120; i++) events.get('study-illumination')({ detail: [] })
assert.ok(frames.size <= 1, 'Lighting events coalesce into one pending frame')
flush()
assert.equal(boundsReads, afterLayout, 'Relighting uses cached bounds')
props.highlighted = null
slots[0].parentElement.dataset.weight = '0'
events.get('interest-layout')(); flush()
const afterRest = renders
for (let i = 0; i < 120; i++) events.get('study-illumination')({ detail: [] })
assert.equal(frames.size, 0, 'Renderer parks after returning to half-size blue icons')
assert.equal(renders, afterRest)
const beforeTheme = captures
themeChanged(); flush()
assert.equal(captures-beforeTheme, slots.length, 'Theme changes regenerate all resting PNGs from the original models')
await Promise.resolve(); await Promise.resolve(); flush()
const afterTheme = renders
events.get('interest-layout')(); flush()
assert.equal(renders, afterTheme, 'Repositioning ready PNG slots does not redraw inactive models')
const beforeResize = captures
slots[0].getBoundingClientRect = () => ({ ...rect, width: 80, height: 80, right: 80, bottom: 80 })
events.get('interest-layout')(); flush()
assert.equal(captures, beforeResize + 1, 'A changed responsive icon size regenerates its PNG instead of retaining a stale capture')
await Promise.resolve(); await Promise.resolve(); flush()
const carsSlot = slots.find(slot => slot.dataset.interestObject === 'automotive')
props.highlighted = 'automotive'; carsSlot.parentElement.dataset.weight = '1'
events.get('interest-layout')(); flush()
assert.equal(frames.size, 1, 'Active celebration keeps the existing render loop alive')
const animationReads = boundsReads
flush()
assert.equal(boundsReads, animationReads, 'Accent animation reuses cached layout bounds')
for (let i = 0; i < 160; i++) flush()
assert.equal(frames.size, 0, 'The one-shot celebration finishes without a continuous loop')
props.reducedMotion = true; events.get('interest-layout')(); flush()
assert.equal(frames.size, 0, 'Reduced motion parks the accent animation')
props.reducedMotion = false; props.highlighted = null; carsSlot.parentElement.dataset.weight = '0'
events.get('interest-layout')(); flush()
assert.equal(frames.size, 0, 'Leaving the scene returns to idle')
props.selected = 'smart-home'; props.active = false
effects[0]()
assert.ok(renders > afterRest, 'Click paints the selected state once before parking behind its modal')
assert.equal(frames.size, 0, 'A selected object does not run a loop under the modal')
assert.equal(amounts.get('smart-home'), 1, 'Click fully illuminates the smart-home bulb even before hover settles')
assert.equal(ready, 1, 'Readiness is announced only once')
for (const cleanup of cleanups.reverse()) cleanup()
assert.equal(frames.size, 0)
celebration.dispose()
console.log('About PNG/live renderer: resting icons, magnification, cached relighting, click snapshot and cleanup checks passed.')

}
main().catch(error => { console.error(error); process.exitCode = 1 })
