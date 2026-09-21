#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'tmp-verify-mobile-hero')
try {
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
    'components/home/mobileHero.ts', 'components/home/HomeHero.tsx', 'engine/homeNavigation.ts',
    '--outDir', out, '--module', 'commonjs', '--target', 'es2020', '--jsx', 'react-jsx',
    '--esModuleInterop', '--skipLibCheck',
  ], { cwd: root, stdio: 'inherit' })
  const { mobileSwipeStep, nextMobileSlot, mobileDockWeights, mobileDockScale, mobileDockSpacing, mobileCompositionScale, mobileSlotAction, createMobileCarouselClock, MOBILE_INITIAL_SLOT } = require(path.join(out, 'components/home/mobileHero.js'))
  const { HOME_CONTENT, HOME_SECTIONS } = require(path.join(out, 'content/home.js'))
  const { parseHomeSection, destinationHref, collaborateHomeRedirect } = require(path.join(out, 'engine/homeNavigation.js'))
  assert.equal(mobileSwipeStep(-60, 4), 1)
  assert.equal(mobileSwipeStep(60, 4), -1)
  for (const [x, y] of [[4, 4], [27, 1], [8, 90], [50, 70], [-50, -70]]) {
    assert.equal(mobileSwipeStep(x, y), 0, 'short, vertical and diagonal gestures must not advance')
  }
  assert.equal(MOBILE_INITIAL_SLOT, 'work')
  assert.equal(mobileDockSpacing(1.12), 1.15, 'mobile uses its saved 1.15 spacing')
  assert.equal(mobileDockSpacing(2.24), 2.3, 'spread tuner still adjusts mobile proportionally')
  let now = 0, serial = 0, currentSlot = MOBILE_INITIAL_SLOT
  const tasks = new Map()
  const visited = [currentSlot]
  const advanceTime = duration => {
    const end = now + duration
    while (true) {
      const due = [...tasks.entries()].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      now = due[1].at
      tasks.delete(due[0])
      due[1].callback()
    }
    now = end
  }
  const clock = createMobileCarouselClock(() => {
    currentSlot = nextMobileSlot(currentSlot, 1)
    visited.push(currentSlot)
  }, (callback, delay) => { tasks.set(++serial, { callback, at: now + delay }); return serial }, id => tasks.delete(id))
  advanceTime(4999)
  assert.deepEqual(visited, ['work'], 'Work remains selected for the initial five seconds')
  advanceTime(1)
  assert.equal(currentSlot, 'vibe')
  advanceTime(20000)
  assert.deepEqual(visited, ['work', 'vibe', 'intro', 'collaborate', 'gallery', 'work'])
  advanceTime(4000)
  clock.restart()
  advanceTime(4999)
  assert.equal(visited.length, 6, 'manual interaction restarts the full countdown')
  advanceTime(1)
  assert.equal(visited.length, 7)
  clock.stop()
  advanceTime(30000)
  assert.equal(visited.length, 7, 'paused/offscreen/unmounted clock has no remaining callbacks')
  assert.equal(tasks.size, 0)
  assert.equal(nextMobileSlot('gallery', 1), 'work')
  assert.equal(nextMobileSlot('work', -1), 'gallery')
  let selected = null
  const reached = new Set()
  for (let i = 0; i < 5; i++) { selected = nextMobileSlot(selected, 1); reached.add(selected) }
  assert.equal(reached.size, 5, 'every object is reachable by swipe')
  assert.deepEqual(mobileDockWeights(null), [0, 0, 0, 0, 0])
  for (const slot of HOME_CONTENT.heroSlots) {
    const scales = mobileDockWeights(slot.id).map(mobileDockScale)
    assert.equal(scales.filter(scale => scale === 1.44).length, 1)
    assert.equal(scales.filter(scale => scale === 0.9).length, 4)
    assert.equal(parseHomeSection(destinationHref({ kind: 'home', section: slot.destination }).slice(1)), slot.destination)
  }
  const click = { mobile: true, selected: null, slot: 'work', dragged: false, detail: 1, button: 0,
    metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
  assert.equal(mobileSlotAction(click), 'select', 'first tap highlights without leaving')
  assert.equal(mobileSlotAction({ ...click, selected: 'work' }), 'navigate', 'second tap opens selected section')
  assert.equal(mobileSlotAction({ ...click, selected: 'gallery' }), 'select', 'tap another object selects it')
  assert.equal(mobileSlotAction({ ...click, selected: 'work', dragged: true }), 'ignore', 'swipe ending over a link cannot navigate')
  for (const native of [{ mobile: false }, { detail: 0 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    assert.equal(mobileSlotAction({ ...click, ...native }), 'navigate', 'desktop, keyboard and modified clicks retain native navigation')
  }
  for (const width of [320, 375, 390, 430, 540, 767]) {
    const scale = mobileCompositionScale(width)
    assert(scale > 0 && scale <= 1)
    assert(700 * scale <= width - 24 + 1e-8, 'the complete composition fits within mobile gutters')
  }
  assert.equal(HOME_SECTIONS.at(-1), 'about')
  assert.equal(HOME_CONTENT.heroSlots.find(slot => slot.id === 'intro').destination, 'about')
  assert.equal(parseHomeSection('#home/ABOUT'), 'about')
  assert.equal(parseHomeSection('#home/unknown'), null)
  assert.equal(destinationHref({ kind: 'scene', key: 'collaborate' }), '/#home/collaborate')
  assert.equal(collaborateHomeRedirect('#collaborate', false), '#home/collaborate')
  assert.equal(collaborateHomeRedirect('#COLLABORATE', true), '#home/collaborate')
  assert.equal(collaborateHomeRedirect('#collaborate/chat', false), '#home/collaborate')
  assert.equal(collaborateHomeRedirect('#collaborate/chat', true), null)
  assert.equal(collaborateHomeRedirect('#work/example', false), null)
  assert.equal(collaborateHomeRedirect('#home/collaborate', false), null)

  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const HomeHero = require(path.join(out, 'components/home/HomeHero.js')).default
  const html = renderToStaticMarkup(React.createElement(HomeHero, {
    slots: HOME_CONTENT.heroSlots, renderers: {}, introduction: HOME_CONTENT.introduction, onSectionLink() {},
  }))
  assert.match(html, /href="\/#home\/about" aria-label="Introduction"/)
  const notebookLink = html.match(/<a[^>]*href="\/#home\/about"[\s\S]*?<\/a>/)[0]
  assert(!/role="button"|aria-expanded=|<button/.test(notebookLink), 'notebook link must not contain another interactive control')
  assert(!html.includes('home-hero-mobile-dots'))
  assert(!html.includes('Tap the name to explore'))
  assert.match(html, /aria-label="Previous section"/)
  assert.match(html, /aria-label="Next section"/)
  assert(!html.includes('Pause automatic carousel'))
  assert.match(html, /home-hero-mobile-label[\s\S]*?href="\/#home\/work"[\s\S]*?class="home-hero-label-pixels">Work<\/span>/)
  assert.match(html, /class="home-hero-label-timer" aria-hidden="true" data-running="false" style="animation-duration:5000ms"/,
    'timer uses the five-second interval and remains decorative and inactive before mobile hydration')

  // Parse stylesheet syntax using the same PostCSS parser bundled by Next.
  const postcss = require('postcss')
  postcss.parse(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'))
  console.log('PASS: swipe intent, wraparound, selection/navigation, 90–144% scale, mobile fit, About routing, accessible notebook and CSS syntax')
} finally {
  fs.rmSync(out, { recursive: true, force: true })
}
