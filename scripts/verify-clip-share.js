#!/usr/bin/env node
// =============================================================================
// Browser-level verification for 15-second vibe clip sharing.
//
// Drives the real site in headless Chrome (system install) against
// `next dev` — in production vibe mode (NO ?debug=true), proving the
// sonification hook's production enablement still never creates an
// AudioContext without a user gesture.
//
//   node scripts/verify-clip-share.js [port]
//
// Test hook: ?clipTestMs=1500 (dev-only, clamped 500–15000) shortens the
// active-time recording target so a real recording completes in ~2 seconds.
//
// Covers:
//   - chooser a11y: focus on "Share image", aria-expanded, Escape restores
//   - recording: countdown chip, canvas stays interactive, AudioContext only
//     after the Record gesture, real non-empty clip completes (decodable
//     preview, download filename by actual MIME)
//   - preview flow: Retake → Cancel, record → Close
//   - unsupported capability: captureStream/MediaRecorder deleted → the clip
//     choice disables with an explanation; image sharing stays enabled
//   - leaving Vibe mid-recording cancels (no preview, no countdown)
//   - reduced motion: recording still completes (deterministic requestFrame)
// =============================================================================

const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4741
const ORIGIN = `http://127.0.0.1:${PORT}`
const CLIP_URL = `${ORIGIN}/?clipTestMs=1500`
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
const section = (title) => console.log(`\n== ${title}`)

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

const seedConsentAndAudioCounter = (context) =>
  context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'jh.analytics-consent',
        JSON.stringify({ decision: 'denied', decidedAt: Date.now() }),
      )
    } catch {}
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

// --- helpers ------------------------------------------------------------------

async function openVibeToolbar(page) {
  await page.evaluate(() => {
    window.location.hash = '#vibe'
  })
  await page.waitForSelector('.vibe-cta', { timeout: 30000 })
  await page.click('.vibe-cta')
  await page.waitForSelector('.vibe-toolbar', { timeout: 15000 })
}

async function openShareChooser(page) {
  await page.click('button.vibe-toolbar-utility[aria-label="Share"]')
  await page.waitForSelector('.vibe-share-chooser', { timeout: 8000 })
}

/** Find an exposed canvas coordinate (the recording must not block it). */
async function findExposed(page, candidates) {
  for (const [x, y] of candidates) {
    const hit = await page.evaluate(
      ([px, py]) => {
        const el = document.elementFromPoint(px, py)
        return el?.tagName === 'CANVAS'
      },
      [x, y],
    )
    if (hit) return { x, y }
  }
  return null
}

// --- scenarios ----------------------------------------------------------------

async function scenarioRecordingFlow(page) {
  section('Recording flow (production vibe, ?clipTestMs=1500)')
  await page.goto(CLIP_URL, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  check(
    'no AudioContext before any gesture',
    (await audioContextCount(page)) === 0,
    `count ${await audioContextCount(page)}`,
  )

  // Chooser a11y: opens, focuses "Share image", aria-expanded, Escape restores.
  await openShareChooser(page)
  const focus = await page.evaluate(() => ({
    text: document.activeElement?.textContent?.trim(),
    expanded: document
      .querySelector('button.vibe-toolbar-utility[aria-label="Share"]')
      ?.getAttribute('aria-expanded'),
  }))
  check('opening the chooser focuses "Share image"', focus.text === 'Share image', focus.text ?? '')
  check('Share carries aria-expanded=true while open', focus.expanded === 'true')
  await page.keyboard.press('Escape')
  await sleep(250)
  const afterEscape = await page.evaluate(() => ({
    chooser: !!document.querySelector('.vibe-share-chooser'),
    label: document.activeElement?.getAttribute('aria-label'),
  }))
  check('Escape closes the chooser', !afterEscape.chooser)
  check('Escape restores focus to the Share button', afterEscape.label === 'Share', afterEscape.label ?? '')

  // Start recording.
  await openShareChooser(page)
  await page.click('.vibe-share-choice >> nth=1')
  await page.waitForSelector('.vibe-clip-status', { timeout: 8000 })
  const countdown = await page.textContent('.vibe-clip-countdown')
  check('countdown chip appears (00:0X)', /^00:0[12]$/.test(countdown ?? ''), countdown ?? '')
  await waitFor(async () => (await audioContextCount(page)) === 1, {
    label: 'AudioContext after Record',
    timeout: 8000,
  })
  check('the Record gesture creates exactly one AudioContext', true)

  // The canvas stays interactive during recording.
  const point = await findExposed(page, [[800, 120], [1400, 450], [400, 300], [800, 700]])
  check('canvas is exposed during recording', !!point)
  if (point) {
    await page.mouse.move(point.x, point.y, { steps: 5 })
    await page.mouse.click(point.x, point.y)
    await sleep(300)
    const stillRecording = await page.evaluate(() => !!document.querySelector('.vibe-clip-status'))
    check('pointer interaction does not interrupt the recording', stillRecording)
  }

  // The recording completes into a decodable, non-autoplaying preview.
  await page.waitForSelector('.vibe-clip-preview-video', { timeout: 15000 })
  const preview = await page.evaluate(async () => {
    const video = document.querySelector('.vibe-clip-preview-video')
    if (!video) return null
    if (video.readyState < 1) {
      await new Promise((resolve) => {
        video.addEventListener('loadedmetadata', resolve, { once: true })
        setTimeout(resolve, 5000)
      })
    }
    return {
      src: video.src.slice(0, 5),
      paused: video.paused,
      autoplay: video.autoplay,
      controls: video.controls,
      readyState: video.readyState,
    }
  })
  check('preview video is a blob: export', preview?.src === 'blob:', preview?.src ?? '')
  check('preview does not autoplay', preview?.paused === true && preview?.autoplay === false)
  check('preview has controls', preview?.controls === true)
  check(
    'the recorded clip is real, non-empty media (metadata decodes)',
    (preview?.readyState ?? 0) >= 1,
    `readyState ${preview?.readyState}`,
  )
  for (const action of ['Share clip', 'Download', 'Retake', 'Close']) {
    check(
      `preview action "${action}" renders`,
      (await page.locator(`.vibe-clip-action:has-text("${action}")`).count()) === 1,
    )
  }

  // Download: filename follows the actual output MIME.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.click('.vibe-clip-action:has-text("Download")'),
  ])
  const filename = download.suggestedFilename()
  check(
    'download filename matches the actual MIME',
    /^joel-hoke-vibe\.(webm|mp4)$/.test(filename),
    filename,
  )
  // The preview is retained after a download.
  check(
    'preview retained after download',
    (await page.locator('.vibe-clip-preview').count()) === 1,
  )

  // Retake → recording again → Cancel → idle.
  await page.click('.vibe-clip-action:has-text("Retake")')
  await page.waitForSelector('.vibe-clip-status', { timeout: 8000 })
  check('Retake starts a fresh recording', true)
  await page.click('.vibe-clip-cancel')
  await sleep(400)
  const afterCancel = await page.evaluate(() => ({
    chip: !!document.querySelector('.vibe-clip-status'),
    preview: !!document.querySelector('.vibe-clip-preview'),
  }))
  check('Cancel discards the recording (no chip, no preview)', !afterCancel.chip && !afterCancel.preview)

  // Record once more → ready → Close releases the preview.
  await openShareChooser(page)
  await page.click('.vibe-share-choice >> nth=1')
  await page.waitForSelector('.vibe-clip-preview-video', { timeout: 15000 })
  await page.click('.vibe-clip-action:has-text("Close")')
  await sleep(300)
  check(
    'Close releases the preview',
    (await page.locator('.vibe-clip-preview').count()) === 0,
  )
  check(
    'still exactly one AudioContext after the whole flow',
    (await audioContextCount(page)) === 1,
    `count ${await audioContextCount(page)}`,
  )
}

async function scenarioUnsupported(browser) {
  section('Unsupported capability (captureStream/MediaRecorder deleted)')
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'jh.analytics-consent',
        JSON.stringify({ decision: 'denied', decidedAt: Date.now() }),
      )
    } catch {}
    delete HTMLCanvasElement.prototype.captureStream
    delete window.MediaRecorder
  })
  const page = await context.newPage()
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  await openShareChooser(page)
  const state = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.vibe-share-choice')]
    return {
      imageEnabled: buttons[0] && !buttons[0].disabled,
      clipDisabled: buttons[1]?.disabled === true,
      note: document.querySelector('.vibe-share-chooser-note')?.textContent ?? null,
    }
  })
  check('image sharing stays enabled', state.imageEnabled === true)
  check('the clip choice disables', state.clipDisabled === true)
  check(
    'an explanation renders next to the disabled choice',
    !!state.note && state.note.length > 10,
    state.note ?? '',
  )
  await context.close()
}

async function scenarioLeaveVibeCancels(page) {
  section('Leaving Vibe mid-recording cancels')
  await page.goto(CLIP_URL, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  await openShareChooser(page)
  await page.click('.vibe-share-choice >> nth=1')
  await page.waitForSelector('.vibe-clip-status', { timeout: 8000 })
  await page.click('.experience-nav-button >> text=Work')
  await page.waitForSelector('.work-experience', { timeout: 15000 })
  await sleep(300)
  const duringWork = await page.evaluate(() => ({
    chip: !!document.querySelector('.vibe-clip-status'),
    preview: !!document.querySelector('.vibe-clip-preview'),
  }))
  check('leaving Vibe removes the countdown chip', !duringWork.chip)
  await page.evaluate(() => {
    window.location.hash = '#vibe'
  })
  await page.waitForSelector('.vibe-cta', { timeout: 15000 })
  await page.click('.vibe-cta')
  await page.waitForSelector('.vibe-toolbar', { timeout: 15000 })
  await sleep(300)
  check(
    'no preview after returning (recording was discarded)',
    (await page.locator('.vibe-clip-preview').count()) === 0,
  )
}

async function scenarioReducedMotion(browser) {
  section('Reduced motion')
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    reducedMotion: 'reduce',
  })
  await seedConsentAndAudioCounter(context)
  const page = await context.newPage()
  await page.goto(CLIP_URL, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  await openShareChooser(page)
  await page.click('.vibe-share-choice >> nth=1')
  await page.waitForSelector('.vibe-clip-preview-video', { timeout: 20000 })
  const ready = await page.evaluate(async () => {
    const video = document.querySelector('.vibe-clip-preview-video')
    if (!video) return 0
    if (video.readyState < 1) {
      await new Promise((resolve) => {
        video.addEventListener('loadedmetadata', resolve, { once: true })
        setTimeout(resolve, 5000)
      })
    }
    return video.readyState
  })
  check(
    'reduced-motion recording completes with decodable media (requested frames)',
    ready >= 1,
    `readyState ${ready}`,
  )
  await context.close()
}

// --- main ---------------------------------------------------------------------

async function main() {
  const server = startDevServer()
  let browser
  try {
    await waitForServer()
    const executablePath = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate))
    if (!executablePath) throw new Error('no system Chrome/Chromium found')
    browser = await chromium.launch({ executablePath, headless: true })

    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await seedConsentAndAudioCounter(context)
    const page = await context.newPage()

    await scenarioRecordingFlow(page)
    await scenarioUnsupported(browser)
    await scenarioLeaveVibeCancels(page)
    await scenarioReducedMotion(browser)
  } finally {
    if (browser) await browser.close()
    server.kill()
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed.`)
  if (failed > 0) {
    console.error(`${failed} check(s) failed.`)
    process.exit(1)
  }
  console.log('All clip share verifications passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
