#!/usr/bin/env node
// =============================================================================
// Browser-level regression coverage for the Privacy and Feedback panel
// auto-open regression:
//
//   The panel must NEVER open automatically — not on a first visit, not when
//   the stored consent record is missing, malformed, expired, denied, or
//   granted. Only an explicit Privacy FAB action opens it (defaulting to the
//   Privacy tab and moving focus there). Analytics stay blocked unless a
//   valid stored grant exists or the user explicitly grants.
//
// Drives the real landing page in headless Chrome (system install — no
// browser download) against `next dev`.
//
//   node scripts/verify-privacy-first-load.js [port]
// =============================================================================

const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4739
const ORIGIN = `http://127.0.0.1:${PORT}`
const ROOT = path.resolve(__dirname, '..')

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const CONSENT_KEY = 'jh.analytics-consent'
const CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000

const results = []
let failed = 0
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`)
}
const section = (title) => console.log(`\n== ${title}`)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

// --- page state helpers ---------------------------------------------------------

/** Snapshot of the privacy surface: panel presence, focus location, FAB. */
const readPrivacyState = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector('.privacy-panel')
    const fab = document.querySelector('.privacy-settings-button')
    const active = document.activeElement
    return {
      panelPresent: !!panel,
      focusInPanel: !!panel && !!active && panel.contains(active),
      activeTag: active ? active.tagName : null,
      activeClass:
        active && typeof active.className === 'string' ? active.className : '',
      fabPresent: !!fab,
      fabExpanded: fab ? fab.getAttribute('aria-expanded') : null,
      gtagLoaded: !!document.querySelector('script[src*="googletagmanager"]'),
    }
  })

async function expectClosedLanding(page, label) {
  // Give the client mount effect time to (incorrectly) auto-open if it would.
  await sleep(1200)
  const state = await readPrivacyState(page)
  check(`${label}: panel never opens automatically`, !state.panelPresent)
  check(`${label}: focus never moves into the panel`, !state.focusInPanel)
  check(`${label}: privacy FAB stays visible`, state.fabPresent)
  check(
    `${label}: FAB reports collapsed`,
    state.fabExpanded === 'false',
    `aria-expanded=${state.fabExpanded}`,
  )
  check(`${label}: no gtag script loaded`, !state.gtagLoaded)
  return state
}

// --- scenarios -----------------------------------------------------------------

async function scenarioFreshStorage(browser) {
  section('Fresh / cleared localStorage (first visit)')
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.privacy-settings-button', { timeout: 30000 })
  await expectClosedLanding(page, 'fresh storage')
  await context.close()
}

async function scenarioStoredRecords(browser) {
  section('Stored consent records never auto-open the panel')
  const cases = [
    ['denied', { decision: 'denied', decidedAt: Date.now() }],
    ['granted', { decision: 'granted', decidedAt: Date.now() }],
    [
      'expired',
      { decision: 'granted', decidedAt: Date.now() - CONSENT_TTL_MS - 1000 },
    ],
  ]
  for (const [label, record] of cases) {
    const context = await browser.newContext()
    await context.addInitScript(
      ([key, value]) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(value))
        } catch {}
      },
      [CONSENT_KEY, record],
    )
    const page = await context.newPage()
    await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.privacy-settings-button', { timeout: 30000 })
    await expectClosedLanding(page, `stored ${label}`)
    await context.close()
  }
}

async function scenarioFabOpensPanel(browser) {
  section('Explicit FAB action opens the panel on the Privacy tab')
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.privacy-settings-button', { timeout: 30000 })
  await sleep(1200)

  await page.click('.privacy-settings-button')
  await page.waitForSelector('.privacy-panel', { timeout: 8000 })
  const opened = await page.evaluate(() => {
    const panel = document.querySelector('.privacy-panel')
    const privacyTab = panel?.querySelector('[role="tab"][aria-selected="true"]')
    const active = document.activeElement
    return {
      panelPresent: !!panel,
      privacyTabSelected: !!privacyTab && privacyTab.textContent?.trim() === 'Privacy',
      focusOnPrivacyTab:
        !!active && active.getAttribute('role') === 'tab' && active.getAttribute('aria-selected') === 'true',
      fabExpanded: document.querySelector('.privacy-settings-button')?.getAttribute('aria-expanded'),
    }
  })
  check('FAB opens the panel', opened.panelPresent)
  check('FAB open defaults to the Privacy tab', opened.privacyTabSelected)
  check('opening moves focus to the Privacy tab', opened.focusOnPrivacyTab)
  check('FAB reports expanded while open', opened.fabExpanded === 'true')

  // Escape closes the panel and returns focus to the FAB.
  await page.keyboard.press('Escape')
  await page.waitForSelector('.privacy-panel', { state: 'detached', timeout: 8000 })
  const afterEscape = await readPrivacyState(page)
  check('Escape closes the panel', !afterEscape.panelPresent)
  check(
    'Escape returns focus to the FAB',
    afterEscape.activeClass.includes('privacy-settings-button'),
    afterEscape.activeClass,
  )
  await context.close()
}

// --- main ----------------------------------------------------------------------

async function main() {
  const fs = require('node:fs')
  const chromePath = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate))
  if (!chromePath) {
    console.error('No system Chrome/Chromium found for playwright-core.')
    process.exit(1)
  }

  const server = startDevServer()
  let browser
  try {
    await waitForServer()
    browser = await chromium.launch({ executablePath: chromePath, headless: true })
    await scenarioFreshStorage(browser)
    await scenarioStoredRecords(browser)
    await scenarioFabOpensPanel(browser)
  } catch (error) {
    check('suite completed without a thrown error', false, error.message)
  } finally {
    if (browser) await browser.close()
    server.kill()
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed.`)
  if (failed > 0) process.exit(1)
  console.log('All privacy first-load verifications passed.')
}

main()
