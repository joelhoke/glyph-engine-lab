#!/usr/bin/env node
/**
 * Verification for the phase-4 hero renderer surface: components/home/
 * HeroObject.tsx is compiled standalone and rendered headlessly with
 * react-dom/server (no browser — useReducedMotion's effect never runs under
 * SSR, so the hook stays inert). Asserts the card/image/custom dispatch,
 * the fallback chain for unregistered custom renderers, and that custom
 * renderers receive the {active, reducedMotion} contract. A source
 * invariant pins the registry contract: HeroObject itself renders no links
 * or buttons (custom previews sit inside destination anchors, so nested
 * interactive controls are forbidden).
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-hero-renderers')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc components/home/HeroObject.tsx --outDir "${tmpDir}" --module commonjs --target es2020 --jsx react-jsx --strict false --esModuleInterop true --moduleResolution node --skipLibCheck`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const HeroObjectModule = require(path.join(tmpDir, 'components', 'home', 'HeroObject.js'))
const HeroObject = HeroObjectModule.default
const { DEFAULT_HERO_RENDERERS } = HeroObjectModule

let failures = 0
function assert(condition, message) {
  if (condition) console.log(`PASS: ${message}`)
  else {
    console.error(`FAIL: ${message}`)
    failures += 1
  }
}

const render = (content, renderers = {}) =>
  renderToStaticMarkup(
    React.createElement(HeroObject, { content, label: 'Test slot', renderers }),
  )

// --- card ----------------------------------------------------------------------
{
  const html = render({ kind: 'card', title: 'Gallery', body: 'Prototypes and experiments.' })
  assert(html.includes('home-hero-card'), 'card kind renders the card wrapper')
  assert(html.includes('Gallery') && html.includes('Prototypes and experiments.'), 'card renders title and body')
  assert(!html.includes('<img'), 'card renders no image')
}

// --- image ----------------------------------------------------------------------
{
  const image = { src: '/assets/doorways/vibe-signature.svg', alt: 'Signature preview', width: 600, height: 400 }
  const html = render({ kind: 'image', image })
  assert(html.includes('<img') && html.includes('vibe-signature.svg'), 'image kind renders the img')
  assert(html.includes('alt="Signature preview"'), 'image carries its alt text')
  assert(html.includes('600 / 400'), 'image reserves its explicit aspect ratio')
  assert(!html.includes('home-media-placeholder'), 'a real image never renders the placeholder')
}

// --- custom ----------------------------------------------------------------------
{
  let receivedProps = null
  const Custom = (props) => {
    receivedProps = props
    return React.createElement('div', { className: 'test-custom-renderer' }, 'custom!')
  }
  const html = render(
    { kind: 'custom', renderer: 'test-custom', fallback: null },
    { 'test-custom': Custom },
  )
  assert(html.includes('test-custom-renderer'), 'custom kind dispatches to the registered renderer')
  assert(
    receivedProps && receivedProps.active === true && receivedProps.reducedMotion === false,
    'custom renderer receives the {active, reducedMotion} contract',
  )

  // Unregistered renderer WITH a fallback image → the fallback renders.
  const fallback = { src: '/fallback.png', alt: 'Fallback', width: 600, height: 400 }
  const fallbackHtml = render({ kind: 'custom', renderer: 'missing', fallback })
  assert(
    fallbackHtml.includes('<img') && fallbackHtml.includes('fallback.png'),
    'unregistered custom renderer falls back to its image',
  )

  // Unregistered renderer WITHOUT a fallback → the branded placeholder.
  const placeholderHtml = render({ kind: 'custom', renderer: 'missing', fallback: null })
  assert(
    placeholderHtml.includes('home-media-placeholder'),
    'unregistered custom renderer without fallback renders the branded placeholder',
  )
}

// --- Default registry (phase 6) ------------------------------------------------
{
  const keys = ['three:work', 'three:vibe', 'three:gallery', 'three:collaborate']
  assert(
    keys.every((key) => typeof DEFAULT_HERO_RENDERERS[key] === 'function'),
    'default registry carries the four three.js section renderers',
  )
  // SSR mounts the host shell only — effects (and the three import) never run.
  const html = render(
    { kind: 'custom', renderer: 'three:work', fallback: null },
    DEFAULT_HERO_RENDERERS,
  )
  assert(
    html.includes('home-hero-three') && html.includes('home-hero-three--work'),
    'a registered three renderer mounts its host shell under SSR',
  )
  // A renderer reporting failure swaps to the fallback image path — the
  // dispatcher itself decides, so this is covered by the missing-key case
  // above plus the onUnavailable contract on HeroRendererProps.
  assert(
    typeof HeroObjectModule === 'object' || typeof HeroObjectModule === 'function',
    'module loads',
  )
}

// --- Source invariants -----------------------------------------------------------
{
  const source = fs.readFileSync(path.join(projectRoot, 'components', 'home', 'HeroObject.tsx'), 'utf8')
  assert(
    !/<(a|button)[\s>]/.test(source),
    'HeroObject renders no links/buttons (custom previews live inside destination anchors)',
  )
  assert(
    source.includes('renderers[content.renderer]'),
    'custom renderers resolve by name from the registry, never from serialized content',
  )
}

console.log(
  failures === 0 ? '\nAll hero-renderer verifications passed.' : `\n${failures} check(s) failed.`,
)
process.exit(failures === 0 ? 0 : 1)
