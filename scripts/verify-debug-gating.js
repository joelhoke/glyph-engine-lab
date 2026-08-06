#!/usr/bin/env node
// =============================================================================
// Browser-level gating verification for the debug-only toolbar experiments
// (Private Pond + Visual Sonification).
//
// Drives the real site in headless Chrome (system install) against
// `next dev` — isTuningMode() requires NODE_ENV development AND ?debug=true,
// so a dev server is the honest environment for this contract.
//
//   node scripts/verify-debug-gating.js [port]
//
// Covers:
//   - without ?debug=true: no Pond/Sound category renders, and no
//     AudioContext is ever constructed
//   - with ?debug=true: both categories render; still no AudioContext until
//     the visitor presses Play in the Sound panel
//   - Play creates exactly one AudioContext; the scan-line overlay appears
//     (pointer-transparent, aria-hidden); Pause keeps the single context
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
    // Count every AudioContext construction: the production contract is that
    // NONE exists until a debug-mode visitor presses Play.
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

async function scenarioProduction(page) {
  console.log('\n== Production (no ?debug=true)')
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  const counts = await page.evaluate(() => ({
    pond: document.querySelectorAll('button.vibe-toolbar-category[aria-label="Pond"]').length,
    sound: document.querySelectorAll('button.vibe-toolbar-category[aria-label="Sound"]').length,
    panels: document.querySelectorAll('.vibe-sound-panel,.vibe-pond-panel').length,
    overlay: document.querySelectorAll('.sonification-scan-overlay').length,
  }))
  check('production: Pond category is absent', counts.pond === 0, `got ${counts.pond}`)
  check('production: Sound category is absent', counts.sound === 0, `got ${counts.sound}`)
  check('production: no debug panels rendered', counts.panels === 0)
  check('production: no scan-line overlay rendered', counts.overlay === 0)
  check(
    'production: no AudioContext is ever created',
    (await audioContextCount(page)) === 0,
    `count ${await audioContextCount(page)}`,
  )
}

async function scenarioDebug(page) {
  console.log('\n== Debug (?debug=true)')
  await page.goto(`${ORIGIN}/?debug=true`, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await openVibeToolbar(page)

  await waitFor(
    async () =>
      (await page.locator('button.vibe-toolbar-category[aria-label="Pond"]').count()) === 1,
    { label: 'Pond category', timeout: 10000 },
  )
  check('debug: Pond category renders', true)
  await waitFor(
    async () =>
      (await page.locator('button.vibe-toolbar-category[aria-label="Sound"]').count()) === 1,
    { label: 'Sound category', timeout: 10000 },
  )
  check('debug: Sound category renders', true)
  check(
    'debug: no AudioContext before Play',
    (await audioContextCount(page)) === 0,
    `count ${await audioContextCount(page)}`,
  )

  await page.click('button.vibe-toolbar-category[aria-label="Sound"]')
  await page.waitForSelector('.vibe-sound-panel', { timeout: 10000 })
  check('debug: Sound panel opens', true)
  check(
    'debug: opening the panel still creates no AudioContext',
    (await audioContextCount(page)) === 0,
    `count ${await audioContextCount(page)}`,
  )

  // Panel controls: direction select, duration, volume, Play.
  const controls = await page.evaluate(() => ({
    play: !!document.querySelector('button.vibe-sound-play[aria-label="Play sound"]'),
    direction: !!document.querySelector('.vibe-sound-select'),
    overlayBefore: document.querySelectorAll('.sonification-scan-overlay').length,
  }))
  check('debug: Play button is keyboard-accessible with a label', controls.play)
  check('debug: direction select renders', controls.direction)
  check('debug: no scan line before Play', controls.overlayBefore === 0)

  await page.click('button.vibe-sound-play[aria-label="Play sound"]')
  await waitFor(async () => (await audioContextCount(page)) === 1, {
    label: 'AudioContext after Play',
    timeout: 8000,
  })
  check('debug: Play creates exactly one AudioContext', true)

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
    'debug: scan-line overlay is pointer-transparent and aria-hidden',
    !!overlay && overlay.pointerEvents === 'none' && overlay.ariaHidden === 'true',
    JSON.stringify(overlay),
  )
  check('debug: scan-line overlay has no aria-live', !!overlay && overlay.ariaLive === null)

  await page.waitForSelector('button.vibe-sound-play[aria-label="Pause sound"]', { timeout: 8000 })
  await page.click('button.vibe-sound-play[aria-label="Pause sound"]')
  await sleep(300)
  check(
    'debug: Pause keeps the single AudioContext',
    (await audioContextCount(page)) === 1,
    `count ${await audioContextCount(page)}`,
  )

  // Leaving Vibe stops playback; returning requires Play again.
  await page.click('button.vibe-sound-play[aria-label="Play sound"]')
  await page.waitForSelector('button.vibe-sound-play[aria-label="Pause sound"]', { timeout: 8000 })
  await page.click('.experience-nav-button >> text=Work')
  await page.waitForSelector('.work-experience', { timeout: 15000 })
  await page.evaluate(() => {
    window.location.hash = '#vibe'
  })
  await page.waitForSelector('.vibe-cta', { timeout: 15000 })
  await page.click('.vibe-cta')
  await page.waitForSelector('.vibe-toolbar', { timeout: 15000 })
  await page.click('button.vibe-toolbar-category[aria-label="Sound"]')
  await page.waitForSelector('.vibe-sound-panel', { timeout: 10000 })
  const replay = await page.evaluate(() => ({
    playVisible: !!document.querySelector('button.vibe-sound-play[aria-label="Play sound"]'),
    overlay: document.querySelectorAll('.sonification-scan-overlay').length,
  }))
  check('debug: leaving Vibe stops playback (Play required again)', replay.playVisible)
  check('debug: scan line gone after leaving Vibe', replay.overlay === 0)
  check(
    'debug: still exactly one AudioContext after the round trip',
    (await audioContextCount(page)) === 1,
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
