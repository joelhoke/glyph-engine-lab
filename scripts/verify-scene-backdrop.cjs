// Execute the shared component with an inert canvas to verify its display policy.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }; cache.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const resolve = name => {
    if (name === './SceneCanvas') return { default: 'test-canvas' }
    if (name === './CanvasFallback') return { default: 'test-fallback' }
    if (name === 'react') return { forwardRef: render => render, useMemo: factory => factory() }
    if (!name.startsWith('.')) return require(name)
    const base = path.resolve(path.dirname(file), name)
    const target = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
    if (!target) throw new Error(`Cannot resolve ${name} from ${file}`)
    return load(target)
  }
  new Function('require', 'module', 'exports', code)(resolve, module, module.exports)
  return module.exports
}
const Backdrop = load(path.join(root, 'components/SceneBackdrop.tsx')).default
const { APPROVED_SCENE_DEFAULTS, APPROVED_SOURCE_LAYOUT_DEFAULTS } = load(path.join(root, 'engine/sceneDefaults.ts'))
const { APPROVED_PLAYGROUND_DEFAULTS } = load(path.join(root, 'engine/playgroundConfig.ts'))
const { LANDING_CANVAS_GRADIENT } = load(path.join(root, 'engine/theme.ts'))
for (const theme of ['light', 'dark']) {
  const ref = { current: null }
  const home = Backdrop({ theme, experience: 'intro', playgroundConfig: APPROVED_PLAYGROUND_DEFAULTS,
    sourceLayout: APPROVED_SOURCE_LAYOUT_DEFAULTS, ...APPROVED_SCENE_DEFAULTS }, ref)
  const alternate = Backdrop({ theme, viewportClassName: 'alternate-placement' }, ref)
  const homeCanvas = home.props.children[1], alternateCanvas = alternate.props.children[1]
  assert.deepEqual(alternateCanvas.props, homeCanvas.props, `${theme}: Wrapper placement preserves hero canvas inputs`)
  assert.deepEqual(alternateCanvas.props.source, { kind: 'responsive-landing' })
  assert.equal(alternateCanvas.props.playgroundConfig.backgroundColor2, LANDING_CANVAS_GRADIENT[theme].color2)
  assert.equal(alternateCanvas.props.playgroundConfig.glyphColorMode, 'source-colors')
  assert.equal(alternateCanvas.props.playgroundConfig.ambient.backdropOpacity, 0)
  assert.equal(alternateCanvas.props.interactionMode, 'page')
  assert.ok(home.props.className.includes('scene-viewport--landing'))
  const custom = { ...APPROVED_PLAYGROUND_DEFAULTS, glyphText: 'custom', backgroundColor1: '#123456' }
  const source = { kind: 'static', url: '/custom.svg', sourceKind: 'svg' }
  const work = Backdrop({ theme, experience: 'work', playgroundConfig: custom, source, mouseR: 123, suspended: true, interactionMode: 'canvas' }, ref)
  const workCanvas = work.props.children[1]
  assert.equal(workCanvas.type, homeCanvas.type, 'Mode switches retain the same canvas component')
  assert.equal(workCanvas.props.playgroundConfig, custom, 'Other scenes keep their authored configuration')
  assert.equal(workCanvas.props.source, source)
  assert.equal(workCanvas.props.mouseR, 123)
  assert.equal(workCanvas.props.suspended, true)
  assert.equal(workCanvas.props.interactionMode, 'canvas')
  assert.ok(!work.props.className.includes('scene-viewport--landing'))
}
console.log('Shared backdrop: light/dark parity, responsive source, interactions and scene overrides passed.')
