#!/usr/bin/env node
// =============================================================================
// Browser-level verification for vibe clip sharing (5/10/15s durations).
//
// Drives the real site in headless Chrome (system install) against
// `next dev` — in production vibe mode (NO ?debug=true), proving the
// sonification hook's production enablement still never creates an
// AudioContext without a user gesture.
//
//   node scripts/verify-clip-share.js [port]
//
// Test hook: ?clipTestMs=1500 (dev-only, clamped 500–15000) OVERRIDES any
// chosen duration so a real recording completes in ~2 seconds; the 5s
// scenario runs WITHOUT the override to prove a non-default duration
// end-to-end.
//
// Container forensics (Task: audio-only export bug): the produced file is
// downloaded and parsed in Node — MP4 (ftyp/moov/trak/hdlr/stsz) or WebM
// (EBML Tracks/TrackEntry/Cluster/SimpleBlock) — to COUNT tracks and prove
// a video track with non-zero sample bytes, plus an in-page pixel read of
// the decoded preview proving non-black frames.
//
// REGRESSION NOTE (Safari/mp4 audio-only export): Safari's captureStream on
// a GPU-accelerated 2D canvas (the scene context is deliberately not
// willReadFrequently) records black/empty video frames — the exported file
// plays audio-only. Chrome on this machine negotiates MP4 itself (probe:
// MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2')
// === true) and records real frames from the direct capture, so the bug is
// Safari-specific. The fix routes capture through a CPU-backed staging
// canvas painted via drawImage on a rAF pump (the read-back path Safari
// handles correctly); these tests prove the video track survives that
// pipeline in both containers. Safari itself can't be automated here.
//
// Covers:
//   - chooser a11y: four peers, focus on "Share image", Escape restores
//   - recording: countdown chip, canvas stays interactive, AudioContext only
//     after the Record gesture, real non-empty clip (pixels + container)
//   - selectable durations: 5s end-to-end without the dev override
//   - forced-WebM scenario: MIME precedence falls through, EBML video track
//   - preview flow: Retake → Cancel, record → Close; download filename
//   - unsupported capability messaging; leaving Vibe cancels; reduced motion
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
const TMP_DIR = path.join(ROOT, 'tmp-verify-clip-share')

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

// --- container forensics ------------------------------------------------------
// The probe module the APP uses (engine/clipContainerProbe.ts), compiled here
// and exercised against the real recordings downloaded below.

const { execSync } = require('node:child_process')

fs.rmSync(TMP_DIR, { recursive: true, force: true })
fs.mkdirSync(TMP_DIR, { recursive: true })
try {
  execSync(
    `npx tsc "${path.join(ROOT, 'engine', 'clipContainerProbe.ts')}" "${path.join(ROOT, 'engine', 'clipRecorder.ts')}" --outDir "${TMP_DIR}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: ROOT },
  )
} catch (error) {
  console.error('probe compilation failed:', error)
  process.exit(1)
}
const { probeClipContainer } = require(path.join(TMP_DIR, 'clipContainerProbe.js'))
const { resolveClipCaptureSize, CLIP_CAPTURE_MAX_LONG_EDGE } = require(
  path.join(TMP_DIR, 'clipRecorder.js'),
)

function parseContainer(buffer, filename) {
  void filename
  return probeClipContainer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
}

/** In-page proof: the decoded preview paints non-black pixels. */
async function assertPreviewPixels(page, label) {
  const pixels = await page.evaluate(async () => {
    const video = document.querySelector('.vibe-clip-preview-video')
    if (!video) return null
    video.muted = true
    try {
      await video.play()
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 800))
    video.pause()
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 36
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, 64, 36)
    const data = ctx.getImageData(0, 0, 64, 36).data
    let lit = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 24) lit += 1
    }
    return { lit, total: 64 * 36, width: video.videoWidth, height: video.videoHeight }
  })
  check(`${label}: preview has real video dimensions`, !!pixels && pixels.width > 0, JSON.stringify(pixels))
  check(
    `${label}: decoded frames are non-black (pixel read)`,
    !!pixels && pixels.lit > pixels.total * 0.005,
    pixels ? `lit ${pixels.lit}/${pixels.total}` : 'no preview',
  )
}

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

/** Record a clip from the chooser and wait for the preview. */
async function recordClip(page, durationLabel, timeoutMs) {
  await openShareChooser(page)
  await page.click(`.vibe-share-choice:has-text("${durationLabel}")`)
  await page.waitForSelector('.vibe-clip-preview-video', { timeout: timeoutMs })
}

/** Download the finished clip into TMP_DIR and probe its container. */
async function downloadAndParse(page, tag) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.click('.vibe-clip-action:has-text("Download")'),
  ])
  const filename = download.suggestedFilename()
  const filePath = path.join(TMP_DIR, `${tag}-${filename}`)
  await download.saveAs(filePath)
  const info = parseContainer(fs.readFileSync(filePath), filename)
  return { filename, info }
}

// --- scenarios ----------------------------------------------------------------

async function scenarioRecordingFlow(page) {
  section('Recording flow (production vibe, ?clipTestMs=1500 override)')
  await page.goto(CLIP_URL, { waitUntil: 'domcontentloaded' })
  // Probe + log the MIME reality of this Chrome (informational).
  const probe = await page.evaluate(() =>
    [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].map((mime) => `${mime}=${MediaRecorder.isTypeSupported(mime)}`).join(' '),
  )
  console.log(`   probe: ${probe}`)
  await openVibeToolbar(page)
  check(
    'no AudioContext before any gesture',
    (await audioContextCount(page)) === 0,
    `count ${await audioContextCount(page)}`,
  )

  // Chooser a11y: four peers, focus on "Share image", Escape restores.
  await openShareChooser(page)
  const chooser = await page.evaluate(() => ({
    choices: [...document.querySelectorAll('.vibe-share-choice')].map((b) => b.textContent.trim()),
    focusText: document.activeElement?.textContent?.trim(),
    expanded: document
      .querySelector('button.vibe-toolbar-utility[aria-label="Share"]')
      ?.getAttribute('aria-expanded'),
  }))
  check(
    'chooser has four peers: image + 5/10/15s clips',
    chooser.choices.length === 4 &&
      chooser.choices[0] === 'Share image' &&
      chooser.choices[1] === 'Share 5s clip' &&
      chooser.choices[2] === 'Share 10s clip' &&
      chooser.choices[3] === 'Share 15s clip',
    JSON.stringify(chooser.choices),
  )
  check('opening the chooser focuses "Share image"', chooser.focusText === 'Share image')
  check('Share carries aria-expanded=true while open', chooser.expanded === 'true')
  await page.keyboard.press('Escape')
  await sleep(250)
  const afterEscape = await page.evaluate(() => ({
    chooser: !!document.querySelector('.vibe-share-chooser'),
    label: document.activeElement?.getAttribute('aria-label'),
  }))
  check('Escape closes the chooser', !afterEscape.chooser)
  check('Escape restores focus to the Share button', afterEscape.label === 'Share', afterEscape.label ?? '')

  // Start recording (15s choice; the dev override shortens it to 1.5s).
  await openShareChooser(page)
  await page.click('.vibe-share-choice:has-text("Share 15s clip")')
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

  // Pixel-level proof: decoded frames are non-black.
  await assertPreviewPixels(page, 'default-flow')

  // Container forensics on the downloaded file (via the app's own probe).
  const { filename, info } = await downloadAndParse(page, 'default')
  check('download filename matches the actual MIME', /^joel-hoke-vibe\.(webm|mp4)$/.test(filename), filename)
  console.log(`   probe(${info?.containerKind}): ${JSON.stringify(info)}`)
  check('the app probe parses the produced container', info !== null, filename)
  check(
    `container (${info?.containerKind}) has a video track`,
    info?.hasVideoTrack === true,
    JSON.stringify(info),
  )
  check(
    `container (${info?.containerKind}) has an audio track`,
    info?.hasAudioTrack === true,
    JSON.stringify(info),
  )
  check(
    `container (${info?.containerKind}) video track has non-zero sample bytes`,
    (info?.videoSampleBytes ?? 0) > 1000,
    `videoSampleBytes ${info?.videoSampleBytes}`,
  )
  check(
    `container (${info?.containerKind}) declares video dimensions`,
    (info?.videoWidth ?? 0) > 0 && (info?.videoHeight ?? 0) > 0,
    `${info?.videoWidth}×${info?.videoHeight}`,
  )
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
  await recordClip(page, 'Share 15s clip', 15000)
  await page.click('.vibe-clip-action:has-text("Close")')
  await sleep(300)
  check('Close releases the preview', (await page.locator('.vibe-clip-preview').count()) === 0)
  check(
    'still exactly one AudioContext after the whole flow',
    (await audioContextCount(page)) === 1,
    `count ${await audioContextCount(page)}`,
  )
}

async function scenarioFiveSeconds(page) {
  section('Selectable duration: 5s clip end-to-end (no dev override)')
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  await openShareChooser(page)
  await page.click('.vibe-share-choice:has-text("Share 5s clip")')
  await page.waitForSelector('.vibe-clip-status', { timeout: 8000 })
  const countdown = await page.textContent('.vibe-clip-countdown')
  check('countdown starts at the chosen duration (00:05)', countdown === '00:05', countdown ?? '')
  // 5s of ACTIVE time; give wall-clock slack for scheduling jitter.
  await page.waitForSelector('.vibe-clip-preview-video', { timeout: 15000 })
  check('the 5s recording completes', true)
  await assertPreviewPixels(page, '5s-flow')
  const { info } = await downloadAndParse(page, 'five')
  console.log(`   probe(${info?.containerKind}): ${JSON.stringify(info)}`)
  check(
    'the 5s container carries a video track with real samples',
    info?.hasVideoTrack === true && (info?.videoSampleBytes ?? 0) > 1000,
    JSON.stringify(info),
  )
  await page.click('.vibe-clip-action:has-text("Close")')
}

async function scenarioForcedWebm(browser) {
  section('Forced WebM (MIME precedence fall-through + EBML parse)')
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await seedConsentAndAudioCounter(context)
  await context.addInitScript(() => {
    // Claim MP4 is unsupported: the precedence chain must fall to WebM.
    const original = MediaRecorder.isTypeSupported.bind(MediaRecorder)
    MediaRecorder.isTypeSupported = (mime) => !/mp4/i.test(mime) && original(mime)
  })
  const page = await context.newPage()
  await page.goto(CLIP_URL, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  await recordClip(page, 'Share 15s clip', 15000)
  const { filename, info } = await downloadAndParse(page, 'webm')
  console.log(`   probe(${info?.containerKind}): ${JSON.stringify(info)}`)
  check('WebM produced when MP4 is unavailable', filename === 'joel-hoke-vibe.webm', filename)
  check('the app probe parses the WebM container', info?.containerKind === 'webm', JSON.stringify(info))
  check('EBML has a video track', info?.hasVideoTrack === true, JSON.stringify(info))
  check('EBML has an audio track', info?.hasAudioTrack === true, JSON.stringify(info))
  check(
    'EBML video track has non-empty frame samples',
    (info?.videoSampleBytes ?? 0) > 1000,
    `videoSampleBytes ${info?.videoSampleBytes}`,
  )
  await context.close()
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
      clipsDisabled: buttons.slice(1).every((b) => b.disabled),
      note: document.querySelector('.vibe-share-chooser-note')?.textContent ?? null,
    }
  })
  check('image sharing stays enabled', state.imageEnabled === true)
  check('all three clip choices disable', state.clipsDisabled === true)
  check(
    'an explanation renders next to the disabled choices',
    !!state.note && state.note.length > 10,
    state.note ?? '',
  )
  await context.close()
}

async function scenarioNoFrames(browser) {
  section('Frame-flow watchdog (captureStream yields a dead video track)')
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await seedConsentAndAudioCounter(context)
  await context.addInitScript(() => {
    // Simulate Safari's silent failure class: captureStream returns a stream
    // from a NEVER-PAINTED canvas, so the video track never delivers a frame
    // (stays muted) while the staging pump keeps running.
    const original = HTMLCanvasElement.prototype.captureStream
    HTMLCanvasElement.prototype.captureStream = function (frameRate) {
      const dead = document.createElement('canvas')
      dead.width = 320
      dead.height = 240
      return original.call(dead, frameRate)
    }
  })
  const page = await context.newPage()
  await page.goto(CLIP_URL, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  await openShareChooser(page)
  await page.click('.vibe-share-choice:has-text("Share 15s clip")')
  await page.waitForSelector('.vibe-clip-status', { timeout: 8000 })
  // The watchdog needs ~1s of ACTIVE time; the failure must arrive long
  // before the (overridden) 1.5s total… give it room. Either guard may fire
  // first: the frame-flow watchdog ("no frames") or the container probe
  // ("no picture") — Chrome reports muted=false on a dead track, so here the
  // probe is the one that catches the audio-only file.
  await page.waitForSelector('.vibe-clip-error', { timeout: 10000 })
  const errorText = await page.textContent('.vibe-clip-error-text')
  check(
    'a frameless recording fails visibly with a specific reason',
    !!errorText && /no frames|no picture/.test(errorText),
    errorText ?? '',
  )
  const diag = await page.textContent('.vibe-clip-diagnostics pre')
  check('failure state shows the diagnostics block', !!diag && diag.length > 20)
  const diagData = diag ? JSON.parse(diag) : {}
  check(
    'diagnostics show frames pumped but none observed',
    diagData.framesPumped > 0 && diagData.framesObservedViaUnmute === 0,
    JSON.stringify({ pumped: diagData.framesPumped, observed: diagData.framesObservedViaUnmute }),
  )
  check(
    'diagnostics carry the container probe that rejected the file',
    !!diagData.containerProbe &&
      (diagData.containerProbe.hasVideoTrack === false ||
        diagData.containerProbe.videoSampleBytes === 0),
    JSON.stringify(diagData.containerProbe ?? null),
  )
  check(
    'failure state offers Retake and Close (no audio-only preview)',
    (await page.locator('.vibe-clip-error .vibe-clip-action:has-text("Retake")').count()) === 1 &&
      (await page.locator('.vibe-clip-error .vibe-clip-action:has-text("Close")').count()) === 1 &&
      (await page.locator('.vibe-clip-preview').count()) === 0,
  )
  await page.click('.vibe-clip-error .vibe-clip-action:has-text("Close")')
  await sleep(300)
  check(
    'Close dismisses the failure state',
    (await page.locator('.vibe-clip-error').count()) === 0,
  )
  await context.close()
}

async function scenarioDebugDiagnostics(page) {
  section('Debug diagnostics (?debug=true)')
  await page.goto(`${ORIGIN}/?debug=true&clipTestMs=1500`, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  await recordClip(page, 'Share 15s clip', 15000)
  const diag = await page.textContent('.vibe-clip-preview .vibe-clip-diagnostics pre')
  check('the preview exposes diagnostics under debugMode', !!diag && diag.length > 20)
  const diagData = diag ? JSON.parse(diag) : {}
  check(
    'diagnostics include the recorder MIME and container probe',
    typeof diagData.recorderMime === 'string' &&
      diagData.recorderMime.length > 0 &&
      diagData.containerProbe?.hasVideoTrack === true &&
      diagData.containerProbe?.videoSampleBytes > 0,
    JSON.stringify({ recorderMime: diagData.recorderMime, probe: diagData.containerProbe }),
  )
  check(
    'diagnostics include frames pumped/observed and UA',
    diagData.framesPumped > 0 && typeof diagData.userAgent === 'string',
  )
  check(
    'diagnostics include the capture size block (source vs staging)',
    !!diagData.capture &&
      diagData.capture.sourceWidth > 0 &&
      diagData.capture.stagingWidth > 0 &&
      diagData.capture.stagingWidth <= CLIP_CAPTURE_MAX_LONG_EDGE &&
      diagData.capture.stagingWidth <= diagData.capture.sourceWidth,
    JSON.stringify(diagData.capture ?? null),
  )
  check(
    'a sub-cap source is not upscaled (scale 1)',
    diagData.capture?.scale === 1,
    JSON.stringify(diagData.capture ?? null),
  )
  await page.click('.vibe-clip-action:has-text("Close")')
}

async function scenarioLargeDpr(browser) {
  section('Retina capture cap (deviceScaleFactor 3, 2400×1400)')
  const context = await browser.newContext({
    viewport: { width: 2400, height: 1400 },
    deviceScaleFactor: 3,
  })
  await seedConsentAndAudioCounter(context)
  const page = await context.newPage()
  await page.goto(CLIP_URL, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  // Read the source canvas backing size to compute the expected cap.
  const source = await page.evaluate(() => {
    const canvas = document.querySelector('.scene-root canvas')
    return canvas ? { width: canvas.width, height: canvas.height } : null
  })
  check('source canvas backing size readable', !!source && source.width > 2400, JSON.stringify(source))
  const expected = resolveClipCaptureSize(source?.width ?? 0, source?.height ?? 0)
  console.log(`   source ${source?.width}×${source?.height} → expected staging ${expected.width}×${expected.height}`)
  await recordClip(page, 'Share 15s clip', 20000)
  await assertPreviewPixels(page, 'retina-flow')
  const { info } = await downloadAndParse(page, 'retina')
  console.log(`   probe(${info?.containerKind}): ${JSON.stringify(info)}`)
  check(
    'the recorded video track honors the 1920 long-edge cap',
    info !== null &&
      info.videoWidth === expected.width &&
      info.videoHeight === expected.height &&
      Math.max(info.videoWidth ?? 0, info.videoHeight ?? 0) <= CLIP_CAPTURE_MAX_LONG_EDGE,
    `probed ${info?.videoWidth}×${info?.videoHeight}, expected ${expected.width}×${expected.height}`,
  )
  check(
    'recorded dimensions are even (H.264 mod-2)',
    (info?.videoWidth ?? 1) % 2 === 0 && (info?.videoHeight ?? 1) % 2 === 0,
  )
  check(
    'the capped recording still has a real video track with samples',
    info?.hasVideoTrack === true && (info?.videoSampleBytes ?? 0) > 1000,
  )
  await context.close()
}

async function scenarioLeaveVibeCancels(page) {
  section('Leaving Vibe mid-recording cancels')
  await page.goto(CLIP_URL, { waitUntil: 'domcontentloaded' })
  await openVibeToolbar(page)
  await openShareChooser(page)
  await page.click('.vibe-share-choice:has-text("Share 15s clip")')
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
  await recordClip(page, 'Share 15s clip', 20000)
  check('reduced-motion recording completes (rAF staging pump)', true)
  await assertPreviewPixels(page, 'reduced-motion')
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
    await scenarioFiveSeconds(page)
    await scenarioForcedWebm(browser)
    await scenarioLargeDpr(browser)
    await scenarioUnsupported(browser)
    await scenarioNoFrames(browser)
    await scenarioDebugDiagnostics(page)
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
