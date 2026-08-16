#!/usr/bin/env node
// =============================================================================
// Browser-level gating verification for the promoted vibe controls (ambient
// carousel, Private Pond, Visual Sonification) after the toolbar
// simplification.
//
// Drives the real site in headless Chrome (system install) against
// `next dev`.
//
//   node scripts/verify-debug-gating.js [port]
//
// Covers:
//   - the center toolbar is exactly the four simplified categories
//     (Upload/Text Effects/Color Styles/Paint) — with AND without ?debug=true;
//     no Pond/Sound categories or debug panels exist in either mode
//   - the Pond and Sound controls render for production visitors (no longer
//     debug-gated); expanding Sound never starts audio
//   - no AudioContext exists until the visitor presses Play in the Sound
//     control; Play creates exactly one; the scan-line overlay appears
//     (pointer-transparent, aria-hidden); Pause keeps the single context
//   - Disable collapses the control and stops playback; leaving Vibe stops
//     playback too (Play required again after returning)
// =============================================================================

const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4737
const ORIGIN = `http://127.0.0.1:${PORT}`
const ROOT = path.resolve(__dirname, '..')

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const results = []
let failed = 0
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`)
}

async function waitFor(fn, { timeout = 15000, interval = 120, label = 'condition' } = {}) {
  const start = Date.now()
  let lastError
  for (;;) {
    try {
      const value = await fn()
      if (value) return value
    } catch (err) {
      lastError = err
    }
    if (Date.now() - start > timeout) {
      throw new Error(`Timed out waiting for ${label}${lastError ? ` (${lastError.message})` : ''}`)
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Pre-seed the analytics-consent decision so the privacy panel never
 *  intercepts pointer input mid-test. */
const seedConsentAndAudioCounter = (context) =>
  context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'jh.analytics-consent',
        JSON.stringify({ decision: 'denied', decidedAt: Date.now() }),
      )
    } catch {}
    // Count every AudioContext construction: the contract is that NONE exists
    // until the visitor presses Play in the Sound control.
    window.__JH_AC_COUNT__ = 0
    const wrap = (Ctor) =>
      Ctor
        ? new Proxy(Ctor, {
            construct(Target, args) {
              window.__JH_AC_COUNT__ += 1
              return new Target(...args)
            },
          })
        : Ctor
    window.AudioContext = wrap(window.AudioContext)
    window.webkitAudioContext = wrap(window.webkitAudioContext)
  })

const hideDevChrome = (page) =>
  page.addStyleTag({ content: '.tuning-panel,.dev-diagnostics{display:none!important}' })

const audioContextCount = (page) => page.evaluate(() => window.__JH_AC_COUNT__ ?? -1)

// --- dev server ---------------------------------------------------------------

function startDevServer() {
  const child = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stderr.on('data', () => {})
  child.stdout.on('data', () => {})
  return child
}

function httpGet(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode || 0)
    })
    req.on('error', () => resolve(0))
    req.setTimeout(5000, () => {
      req.destroy()
      resolve(0)
    })
  })
}

async function waitForServer(timeoutMs = 180000) {
  const start = Date.now()
  for (;;) {
    const status = await httpGet(ORIGIN)
    if (status === 200) return
    if (Date.now() - start > timeoutMs) throw new Error('dev server never came up')
    await sleep(750)
  }
}

// --- scenarios ----------------------------------------------------------------

async function openVibeToolbar(page) {
  await page.evaluate(() => {
    window.location.hash = '#vibe'
  })
  await page.waitForSelector('.vibe-cta', { timeout: 30000 })
  await page.click('.vibe-cta')
  await page.waitForSelector('.vibe-toolbar', { timeout: 15000 })
}

/** The simplified toolbar contract: production shows the four categories;
 *  debug (?debug=true) additionally reveals Motion/Ambient/Pond/Sound. */
async function checkSimplifiedToolbar(page, modeLabel, { debug = false } = {}) {
  const counts = await page.evaluate(() => ({
    categories: Array.from(document.querySelectorAll('button.vibe-toolbar-category')).map(
      (button) => button.getAttribute('aria-label'),
    ),
    debugPanels: document.querySelectorAll('.vibe-sound-panel,.vibe-pond-panel').length,
    pondToggle: document.querySelectorAll('button.vibe-pond-toggle').length,
    soundToggle: document.querySelectorAll('button.vibe-sound-toggle').length,
    overlay: document.querySelectorAll('.sonification-scan-overlay').length,
  }))
  const expected = debug
    ? [
        'Upload',
        'Text Effects',
        'Color Styles',
        'Paint',
        'Motion Effects',
        'Ambient',
        'Pond',
        'Sound',
      ]
    : ['Upload', 'Text Effects', 'Color Styles', 'Paint']
  check(
    `${modeLabel}: toolbar categories are ${debug ? 'the four simplified + four debug-only' : 'exactly the four simplified'}`,
    JSON.stringify(counts.categories) === JSON.stringify(expected),
    JSON.stringify(counts.categories),
  )
  check(
    `${modeLabel}: no pond/sound settings panels rendered before their category opens`,
    counts.debugPanels === 0,
    `got ${counts.debugPanels}`,
  )
  check(`${modeLabel}: Pond control renders (promoted, not debug-only)`, counts.pondToggle === 1)
  check(`${modeLabel}: Sound control renders (promoted, not debug-only)`, counts.soundToggle === 1)
  check(`${modeLabel}: no scan-line overlay before Play`, counts.overlay === 0)
}

async function scenarioProduction(page) {
  console.log('\n== Production (no ?debug=true)')
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  await checkSimplifiedToolbar(page, 'production')
  check(
    'production: no AudioContext is ever created',
    (await audioContextCount(page)) === 0,
    `count ${await audioContextCount(page)}`,
  )

  // Pond: the toggle expands the character pill (session-only, no audio).
  await page.click('button.vibe-pond-toggle')
  await page.waitForSelector('.vibe-pond-pill', { timeout: 8000 })
  const pond = await page.evaluate(() => ({
    choices: Array.from(document.querySelectorAll('.vibe-pond-pill [role="radio"]')).map(
      (button) => button.textContent,
    ),
    sourceChecked: document
      .querySelector('.vibe-pond-pill [role="radio"]')
      ?.getAttribute('aria-checked'),
  }))
  check(
    'production: pond pill offers Source/Fish/Jelly/Ray with Source selected',
    JSON.stringify(pond.choices) === JSON.stringify(['Source', 'Fish', 'Jelly', 'Ray']) &&
      pond.sourceChecked === 'true',
    JSON.stringify(pond),
  )
  await page.click('.vibe-pond-pill [role="radio"]:has-text("Jelly")')
  const jellyChecked = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('.vibe-pond-pill [role="radio"]')).find(
        (button) => button.textContent === 'Jelly',
      )?.getAttribute('aria-checked') === 'true',
  )
  check('production: selecting a pond character updates the radiogroup', jellyChecked)

  // Sound: expanding never starts audio.
  await page.click('button.vibe-sound-toggle')
  await page.waitForSelector('.vibe-sound-pill', { timeout: 8000 })
  check(
    'production: expanding Sound still creates no AudioContext',
    (await audioContextCount(page)) === 0,
    `count ${await audioContextCount(page)}`,
  )

  // Play: exactly one AudioContext, scan-line overlay appears.
  await page.click('button.vibe-sound-transport[aria-label="Play sound"]')
  await waitFor(async () => (await audioContextCount(page)) === 1, {
    label: 'AudioContext after Play',
    timeout: 8000,
  })
  check('production: Play creates exactly one AudioContext', true)

  await page.waitForSelector('.sonification-scan-overlay', { timeout: 8000 })
  const overlay = await page.evaluate(() => {
    const el = document.querySelector('.sonification-scan-overlay')
    if (!el) return null
    return {
      pointerEvents: getComputedStyle(el).pointerEvents,
      ariaHidden: el.getAttribute('aria-hidden'),
      ariaLive: el.getAttribute('aria-live'),
    }
  })
  check(
    'production: scan-line overlay is pointer-transparent and aria-hidden',
    !!overlay && overlay.pointerEvents === 'none' && overlay.ariaHidden === 'true',
    JSON.stringify(overlay),
  )
  check('production: scan-line overlay has no aria-live', !!overlay && overlay.ariaLive === null)

  // Direction cycles right → down.
  const directionLabel = () =>
    page.evaluate(
      () => document.querySelector('button.vibe-sound-direction')?.getAttribute('aria-label'),
    )
  const before = await directionLabel()
  await page.click('button.vibe-sound-direction')
  const after = await directionLabel()
  check(
    'production: direction button cycles the sweep direction',
    before === 'Sweep direction: right' && after === 'Sweep direction: down',
    JSON.stringify({ before, after }),
  )

  // Pause keeps the single context.
  await page.waitForSelector('button.vibe-sound-transport[aria-label="Pause sound"]', {
    timeout: 8000,
  })
  await page.click('button.vibe-sound-transport[aria-label="Pause sound"]')
  await sleep(300)
  check(
    'production: Pause keeps the single AudioContext',
    (await audioContextCount(page)) === 1,
    `count ${await audioContextCount(page)}`,
  )

  // Disable collapses the control and stops playback.
  await page.click('button.vibe-sound-badge[aria-label="Turn sound off"]')
  await page.waitForSelector('button.vibe-sound-toggle', { timeout: 8000 })
  const disabled = await page.evaluate(() => ({
    pill: document.querySelectorAll('.vibe-sound-pill').length,
    overlay: document.querySelectorAll('.sonification-scan-overlay').length,
  }))
  check('production: Disable collapses the pill', disabled.pill === 0)
  check('production: Disable removes the scan line', disabled.overlay === 0)

  // Leaving Vibe stops playback; returning requires Play again.
  await page.click('button.vibe-sound-toggle')
  await page.waitForSelector('button.vibe-sound-transport[aria-label="Play sound"]', {
    timeout: 8000,
  })
  await page.click('button.vibe-sound-transport[aria-label="Play sound"]')
  await page.waitForSelector('button.vibe-sound-transport[aria-label="Pause sound"]', {
    timeout: 8000,
  })
  await page.click('.experience-nav-button >> text=Work')
  await page.waitForSelector('.work-experience', { timeout: 15000 })
  await page.evaluate(() => {
    window.location.hash = '#vibe'
  })
  await page.waitForSelector('.vibe-cta', { timeout: 15000 })
  await page.click('.vibe-cta')
  await page.waitForSelector('.vibe-toolbar', { timeout: 15000 })
  const replay = await page.evaluate(() => ({
    collapsed: document.querySelectorAll('button.vibe-sound-toggle').length,
    expandedPill: document.querySelectorAll('.vibe-sound-pill').length,
    overlay: document.querySelectorAll('.sonification-scan-overlay').length,
  }))
  check(
    'production: leaving Vibe stops playback (control collapsed, Play required again)',
    replay.collapsed === 1 && replay.expandedPill === 0,
    JSON.stringify(replay),
  )
  check('production: scan line gone after leaving Vibe', replay.overlay === 0)
  check(
    'production: still exactly one AudioContext after the round trip',
    (await audioContextCount(page)) === 1,
    `count ${await audioContextCount(page)}`,
  )
}

async function scenarioDebug(page) {
  console.log('\n== Debug (?debug=true)')
  await page.goto(`${ORIGIN}/?debug=true`, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await openVibeToolbar(page)
  await checkSimplifiedToolbar(page, 'debug', { debug: true })
  check(
    'debug: no AudioContext before Play (unchanged gating)',
    (await audioContextCount(page)) === 0,
    `count ${await audioContextCount(page)}`,
  )

  // The debug Pond settings panel opens from the toolbar and edits the live
  // physics config (sliders render once the pond is enabled).
  await page.click('button.vibe-toolbar-category[aria-label="Pond"]')
  await page.waitForSelector('.vibe-pond-panel', { timeout: 8000 })
  await page.click('.vibe-pond-panel input[type="checkbox"]')
  await page.waitForSelector('.vibe-pond-panel input[type="range"]', { timeout: 8000 })
  const pondPanel = await page.evaluate(() => {
    const panel = document.querySelector('.vibe-pond-panel')
    return {
      labels: panel ? panel.textContent : '',
      sliders: panel ? panel.querySelectorAll('input[type="range"],input[type="number"]').length : 0,
    }
  })
  check(
    'debug: Pond panel exposes the physics controls once enabled',
    !!pondPanel.labels &&
      pondPanel.labels.includes('Min bounce') &&
      pondPanel.labels.includes('Impact torque') &&
      pondPanel.sliders > 0,
    JSON.stringify(pondPanel.sliders),
  )

  // The debug Sound settings panel opens from the toolbar.
  await page.click('button.vibe-toolbar-category[aria-label="Sound"]')
  await page.waitForSelector('.vibe-sound-panel', { timeout: 8000 })
  check(
    'debug: Sound panel exposes the sonification settings',
    await page.evaluate(() => {
      const panel = document.querySelector('.vibe-sound-panel')
      return !!panel && panel.textContent.length > 20
    }),
  )
  check(
    'debug: opening the Sound settings panel still creates no AudioContext',
    (await audioContextCount(page)) === 0,
    `count ${await audioContextCount(page)}`,
  )
}

// --- main ---------------------------------------------------------------------

async function main() {
  const server = startDevServer()
  let browser
  try {
    await waitForServer()
    const executablePath = CHROME_CANDIDATES.find((candidate) =>
      require('node:fs').existsSync(candidate),
    )
    if (!executablePath) throw new Error('no system Chrome/Chromium found')
    browser = await chromium.launch({ executablePath, headless: true })

    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await seedConsentAndAudioCounter(context)
    const page = await context.newPage()

    await scenarioProduction(page)
    await scenarioDebug(page)
  } finally {
    if (browser) await browser.close()
    server.kill()
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed.`)
  if (failed > 0) {
    console.error(`${failed} check(s) failed.`)
    process.exit(1)
  }
  console.log('All debug-gating verifications passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
