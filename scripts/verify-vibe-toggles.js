#!/usr/bin/env node
// =============================================================================
// Browser-level verification for the anchored Vibe corner controls (Sound
// lower-left, Pond lower-right) after the persistent-DOM toggle refactor.
//
// Drives the real site in headless Chrome (system install — no browser
// download) against `next dev` with ?debug=true.
//
//   node scripts/verify-vibe-toggles.js [port]
//
// Covers:
//   - the circular FAB keeps fixed screen coordinates before, during (mid-
//     animation samples), and after BOTH open and close — desktop + mobile
//   - one persistent DOM tree: data-state open/closing/closed; the pill
//     stays mounted and visible during its exit; descendants go inert +
//     pointer-events:none immediately on close; hidden after the transition
//   - open (340ms) and close (280ms) animations actually run (intermediate
//     clip-path values); inner controls fade in after the shell starts
//   - both controls open simultaneously
//   - exactly 2px strokes: collapsed FAB, expanded pill shell, active badge
//   - the Sound rotor: one spinning layer (note + conic gradient), stationary
//     2px outline, 6s linear spin, pause freezes the transform, disable
//     resets the rotor only after closing completes
//   - mobile (390x844): vertical expansion order from the anchor outward
//     (Sound: Play/Pause then Direction; Pond: Source, Fish, Jelly, Ray), no
//     horizontal overflow, no overlap with the center toolbar, controls stay
//     visible when the viewport height shrinks (browser chrome)
//   - mid widths (1100x800, then 800px): the measured layout
//     (useVibeControlLayout) flips both pills to vertical expansion when
//     their horizontal footprint no longer fits beside the toolbar capsule,
//     the FAB glide (min(20vw, 50% - capsule half - FAB - gap)) engages as
//     the width shrinks, and nothing overlaps the toolbar chrome
//   - prefers-reduced-motion: expansion/retraction/spin transitions skipped
//     (state changes still apply instantly)
// =============================================================================

const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4747
const ORIGIN = `http://127.0.0.1:${PORT}`
const DEBUG_URL = `${ORIGIN}/?debug=true`
const ROOT = path.resolve(__dirname, '..')

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

// --- tiny test harness -------------------------------------------------------

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

/** Pre-seed the analytics-consent decision so the privacy panel never
 *  intercepts pointer input mid-test. */
const seedConsent = (context) =>
  context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'jh.analytics-consent',
        JSON.stringify({ decision: 'denied', decidedAt: Date.now() }),
      )
    } catch {}
  })

/** The ?debug=true tuning panel/diagnostics are dev-only chrome that
 *  intentionally overlaps product surfaces in dev — hide it so it never
 *  shadows the corner controls under test. */
const hideDevChrome = (page) =>
  page.addStyleTag({ content: '.tuning-panel,.dev-diagnostics{display:none!important}' })

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

// --- page helpers ---------------------------------------------------------------

async function openVibeToolbar(page) {
  await page.evaluate(() => {
    window.location.hash = '#vibe'
  })
  await page.waitForSelector('.vibe-cta', { timeout: 30000 })
  await page.click('.vibe-cta')
  await page.waitForSelector('.vibe-toolbar', { timeout: 15000 })
}

/** Screen rect of a control piece (JSON-rounded to kill subpixel noise). */
const rectOf = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const round = (v) => Math.round(v * 10) / 10
    return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) }
  }, selector)

const rectsEqual = (a, b) =>
  !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

const stateOf = (page, kind) =>
  page.evaluate(
    (k) => document.querySelector(`.vibe-${k}-control`)?.getAttribute('data-state') ?? null,
    kind,
  )

/** Poll a computed style while a transition runs; returns every sample. */
async function pollComputed(page, selector, prop, durationMs) {
  const start = Date.now()
  const samples = []
  while (Date.now() - start < durationMs) {
    samples.push(
      await page.evaluate(
        ({ sel, p }) => {
          const el = document.querySelector(sel)
          return el ? getComputedStyle(el)[p] : null
        },
        { sel: selector, p: prop },
      ),
    )
    await sleep(40)
  }
  return samples
}

// --- desktop scenario -----------------------------------------------------------

async function scenarioDesktop(browser) {
  /* Wide viewport: BOTH pills fit horizontally from their 20vw anchors beside
     the (debug-widened) toolbar capsule — the horizontal-expansion assertions
     below assume that regime. Mid widths (where useVibeControlLayout flips a
     side to vertical expansion) are covered by scenarioMidWidth. */
  section('Desktop 2560x1080: anchored FAB, persistent pill, 2px strokes, rotor')
  const context = await browser.newContext({ viewport: { width: 2560, height: 1080 } })
  await seedConsent(context)
  const page = await context.newPage()
  await page.goto(DEBUG_URL, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await openVibeToolbar(page)

  // Both controls render, collapsed, exactly one FAB each.
  check('desktop: Sound control renders closed', (await stateOf(page, 'sound')) === 'closed')
  check('desktop: Pond control renders closed', (await stateOf(page, 'pond')) === 'closed')

  // Collapsed FAB strokes are exactly 2px.
  const collapsedBorders = await page.evaluate(() => ({
    sound: getComputedStyle(document.querySelector('.vibe-sound-toggle')).borderTopWidth,
    pond: getComputedStyle(document.querySelector('.vibe-pond-toggle')).borderTopWidth,
  }))
  check(
    'desktop: collapsed FAB strokes are exactly 2px',
    collapsedBorders.sound === '2px' && collapsedBorders.pond === '2px',
    JSON.stringify(collapsedBorders),
  )

  // --- Sound open: FAB fixed before/during/after; clip-path animates --------
  const soundFabBefore = await rectOf(page, '.vibe-sound-toggle')
  const soundPillClosedClip = (
    await pollComputed(page, '.vibe-sound-pill', 'clipPath', 60)
  ).pop()
  await page.click('button.vibe-sound-toggle')
  await sleep(150) // mid-animation sample (open runs 340ms)
  const soundFabMidOpen = await rectOf(page, '.vibe-sound-toggle')
  const openClipSamples = await pollComputed(page, '.vibe-sound-pill', 'clipPath', 500)
  await waitFor(async () => (await stateOf(page, 'sound')) === 'open', { label: 'sound open' })
  await sleep(300) // inner fade-in finishes after the shell (140ms + 260ms)
  const soundFabAfterOpen = await rectOf(page, '.vibe-sound-toggle')
  const soundPillOpenClip = (
    await pollComputed(page, '.vibe-sound-pill', 'clipPath', 60)
  ).pop()

  check(
    'desktop: Sound FAB is fixed before/during/after open',
    rectsEqual(soundFabBefore, soundFabMidOpen) && rectsEqual(soundFabBefore, soundFabAfterOpen),
    JSON.stringify({ soundFabBefore, soundFabMidOpen, soundFabAfterOpen }),
  )
  check(
    'desktop: Sound open animation runs (intermediate clip-path values)',
    openClipSamples.some(
      (v) => v && v !== soundPillClosedClip && v !== soundPillOpenClip,
    ) && soundPillClosedClip !== soundPillOpenClip,
    JSON.stringify({ closed: soundPillClosedClip, open: soundPillOpenClip }),
  )
  const innerAfterOpen = await page.evaluate(() => {
    const el = document.querySelector('.vibe-sound-pill-inner')
    const cs = getComputedStyle(el)
    return { opacity: cs.opacity, transform: cs.transform }
  })
  check(
    'desktop: Sound inner controls are fully faded in after the shell opens',
    innerAfterOpen.opacity === '1' && innerAfterOpen.transform === 'none',
    JSON.stringify(innerAfterOpen),
  )

  // Expanded shell + active badge strokes are exactly 2px.
  const expandedBorders = await page.evaluate(() => ({
    pill: getComputedStyle(document.querySelector('.vibe-sound-pill')).borderTopWidth,
    badge: getComputedStyle(document.querySelector('.vibe-sound-toggle')).borderTopWidth,
  }))
  check(
    'desktop: expanded shell + active badge strokes are exactly 2px',
    expandedBorders.pill === '2px' && expandedBorders.badge === '2px',
    JSON.stringify(expandedBorders),
  )
  // Expanded control height stays 66px (the anchor never resizes).
  check(
    'desktop: expanded Sound control stays 66px tall',
    (await rectOf(page, '.vibe-sound-pill'))?.h === 66 &&
      (await rectOf(page, '.vibe-sound-control'))?.h === 66,
  )

  // --- Rotor: one spinning layer (note + gradient), stationary ring ---------
  const rotorInfo = await page.evaluate(() => {
    const rotor = document.querySelector('.vibe-sound-rotor')
    if (!rotor) return null
    const cs = getComputedStyle(rotor)
    return {
      hasNote: !!rotor.querySelector('img.vibe-sound-note'),
      gradient: cs.backgroundImage.includes('conic-gradient'),
      animationName: cs.animationName,
      duration: cs.animationDuration,
      timing: cs.animationTimingFunction,
      playState: cs.animationPlayState,
    }
  })
  check(
    'desktop: rotor is one layer holding the note over a conic gradient, 6s linear, paused before Play',
    !!rotorInfo &&
      rotorInfo.hasNote &&
      rotorInfo.gradient &&
      rotorInfo.animationName === 'vibe-sound-rotor-spin' &&
      rotorInfo.duration === '6s' &&
      rotorInfo.timing === 'linear' &&
      rotorInfo.playState === 'paused',
    JSON.stringify(rotorInfo),
  )

  await page.click('button.vibe-sound-transport[aria-label="Play sound"]')
  await waitFor(
    async () =>
      page.evaluate(() =>
        document.querySelector('.vibe-sound-control')?.classList.contains('is-playing'),
      ),
    { label: 'is-playing after Play', timeout: 10000 },
  )
  check('desktop: Play drives the control into is-playing', true)
  const spinning = await page.evaluate(() => ({
    playState: getComputedStyle(document.querySelector('.vibe-sound-rotor')).animationPlayState,
    outlineTransform: getComputedStyle(document.querySelector('.vibe-sound-toggle')).transform,
  }))
  const spinSample1 = await page.evaluate(
    () => getComputedStyle(document.querySelector('.vibe-sound-rotor')).transform,
  )
  await sleep(400)
  const spinSample2 = await page.evaluate(
    () => getComputedStyle(document.querySelector('.vibe-sound-rotor')).transform,
  )
  check(
    'desktop: rotor spins while playing (transform advances); the outline element stays stationary',
    spinning.playState === 'running' &&
      spinSample1 !== spinSample2 &&
      spinning.outlineTransform === 'none',
    JSON.stringify({ ...spinning, spinSample1, spinSample2 }),
  )

  // Pause freezes note+gradient at the current angle.
  await page.click('button.vibe-sound-transport[aria-label="Pause sound"]')
  await sleep(150)
  const pausedState = await page.evaluate(() => ({
    playState: getComputedStyle(document.querySelector('.vibe-sound-rotor')).animationPlayState,
    isPlaying: document.querySelector('.vibe-sound-control')?.classList.contains('is-playing'),
  }))
  const frozen1 = await page.evaluate(
    () => getComputedStyle(document.querySelector('.vibe-sound-rotor')).transform,
  )
  await sleep(400)
  const frozen2 = await page.evaluate(
    () => getComputedStyle(document.querySelector('.vibe-sound-rotor')).transform,
  )
  check(
    'desktop: pausing freezes the rotor mid-rotation (paused, non-identity frozen transform)',
    pausedState.playState === 'paused' &&
      pausedState.isPlaying === false &&
      frozen1 === frozen2 &&
      frozen1 !== 'none',
    JSON.stringify({ ...pausedState, frozen1, frozen2 }),
  )

  // --- Sound close: visible exit, inert descendants, hidden after -----------
  await page.click('button.vibe-sound-toggle[aria-label="Turn sound off"]')
  await sleep(120) // mid-exit sample (close runs 280ms after a 60ms delay)
  const midClose = await page.evaluate(() => {
    const control = document.querySelector('.vibe-sound-control')
    const pill = document.querySelector('.vibe-sound-pill')
    const cs = getComputedStyle(pill)
    return {
      state: control?.getAttribute('data-state'),
      visibility: cs.visibility,
      pointerEvents: cs.pointerEvents,
      inert: pill.hasAttribute('inert'),
      ariaHidden: pill.getAttribute('aria-hidden'),
      rotorPresent: !!document.querySelector('.vibe-sound-rotor'),
      fabRect: (() => {
        const r = document.querySelector('.vibe-sound-toggle').getBoundingClientRect()
        return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10 }
      })(),
    }
  })
  const closeClipSamples = await pollComputed(page, '.vibe-sound-pill', 'clipPath', 450)
  check(
    'desktop: close starts as "closing" with the pill still visible but descendants inert',
    midClose.state === 'closing' &&
      midClose.visibility === 'visible' &&
      midClose.pointerEvents === 'none' &&
      midClose.inert === true &&
      midClose.ariaHidden === 'true',
    JSON.stringify(midClose),
  )
  check(
    'desktop: the rotor survives the close (reset only after closing completes)',
    midClose.rotorPresent === true,
  )
  check(
    'desktop: Sound FAB is fixed during close',
    midClose.fabRect.x === soundFabBefore.x && midClose.fabRect.y === soundFabBefore.y,
    JSON.stringify({ mid: midClose.fabRect, before: soundFabBefore }),
  )
  await waitFor(
    async () =>
      (await stateOf(page, 'sound')) === 'closed' &&
      (await page.evaluate(
        () => getComputedStyle(document.querySelector('.vibe-sound-pill')).visibility === 'hidden',
      )),
    { label: 'sound closed + pill hidden', timeout: 5000 },
  )
  const afterClose = await page.evaluate(() => {
    const pill = document.querySelector('.vibe-sound-pill')
    return {
      visibility: getComputedStyle(pill).visibility,
      clip: getComputedStyle(pill).clipPath,
      rotorPresent: !!document.querySelector('.vibe-sound-rotor'),
    }
  })
  check(
    'desktop: close animation runs (intermediate clip-path) and the pill hides after it',
    closeClipSamples.some((v) => v && v !== soundPillOpenClip && v !== afterClose.clip) &&
      afterClose.visibility === 'hidden',
    JSON.stringify({ final: afterClose.clip, visibility: afterClose.visibility }),
  )
  check(
    'desktop: the rotor resets once closing completes (unmounted while hidden)',
    afterClose.rotorPresent === false,
  )
  check(
    'desktop: Sound FAB is back at its exact collapsed position after close',
    rectsEqual(await rectOf(page, '.vibe-sound-toggle'), soundFabBefore),
  )

  // --- Both controls open simultaneously; Pond mirrors -----------------------
  const pondFabBefore = await rectOf(page, '.vibe-pond-toggle')
  await page.click('button.vibe-pond-toggle')
  await page.click('button.vibe-sound-toggle')
  await waitFor(
    async () =>
      (await stateOf(page, 'pond')) === 'open' && (await stateOf(page, 'sound')) === 'open',
    { label: 'both open' },
  )
  check('desktop: Sound and Pond stay open simultaneously', true)
  // Pond grows leftward from behind its FAB: pill right edge meets the FAB.
  const pondGeometry = await page.evaluate(() => {
    const pill = document.querySelector('.vibe-pond-pill').getBoundingClientRect()
    const fab = document.querySelector('.vibe-pond-toggle').getBoundingClientRect()
    return { pillRight: pill.right, fabRight: fab.right, pillLeft: pill.left, fabLeft: fab.left }
  })
  check(
    'desktop: Pond pill expands inward to the left from behind the FAB',
    Math.abs(pondGeometry.pillRight - pondGeometry.fabRight) < 1 &&
      pondGeometry.pillLeft < pondGeometry.fabLeft,
    JSON.stringify(pondGeometry),
  )
  const pondPillBorder = await page.evaluate(
    () => getComputedStyle(document.querySelector('.vibe-pond-pill')).borderTopWidth,
  )
  check('desktop: Pond expanded shell stroke is exactly 2px', pondPillBorder === '2px')

  // Pond close: FAB fixed, pill hidden after the exit.
  await page.click('button.vibe-pond-toggle[aria-label="Turn pond off"]')
  await sleep(120)
  const pondFabMidClose = await rectOf(page, '.vibe-pond-toggle')
  await waitFor(
    async () =>
      (await stateOf(page, 'pond')) === 'closed' &&
      (await page.evaluate(
        () => getComputedStyle(document.querySelector('.vibe-pond-pill')).visibility === 'hidden',
      )),
    { label: 'pond closed + pill hidden', timeout: 5000 },
  )
  const pondFabAfterClose = await rectOf(page, '.vibe-pond-toggle')
  check(
    'desktop: Pond FAB is fixed through close; pill hidden after the exit',
    rectsEqual(pondFabBefore, pondFabMidClose) && rectsEqual(pondFabBefore, pondFabAfterClose),
    JSON.stringify({ pondFabBefore, pondFabMidClose, pondFabAfterClose }),
  )

  await context.close()
}

// --- mobile scenario ------------------------------------------------------------

async function scenarioMobile(browser) {
  section('Mobile 390x844 (touch): vertical expansion, order, overflow, viewport shrink')
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  await seedConsent(context)
  const page = await context.newPage()
  /* Production (no ?debug): the debug toolbar's eight wrapped category
     buttons are dev-only chrome and reach into the corners; the shipped
     four-category toolbar is what the overlap contract applies to. */
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await openVibeToolbar(page)

  const soundFabBefore = await rectOf(page, '.vibe-sound-toggle')
  const pondFabBefore = await rectOf(page, '.vibe-pond-toggle')

  // Open Sound (tap) — FAB fixed mid/after open.
  await page.tap('button.vibe-sound-toggle')
  await sleep(150)
  const soundFabMid = await rectOf(page, '.vibe-sound-toggle')
  await waitFor(async () => (await stateOf(page, 'sound')) === 'open', { label: 'sound open' })
  await sleep(300)
  check(
    'mobile: Sound FAB is fixed before/during/after open',
    rectsEqual(soundFabBefore, soundFabMid) &&
      rectsEqual(soundFabBefore, await rectOf(page, '.vibe-sound-toggle')),
  )

  // Open Pond too — both open at once.
  await page.tap('button.vibe-pond-toggle')
  await sleep(150)
  const pondFabMid = await rectOf(page, '.vibe-pond-toggle')
  await waitFor(async () => (await stateOf(page, 'pond')) === 'open', { label: 'pond open' })
  await sleep(300)
  check(
    'mobile: Pond FAB is fixed before/during/after open; both controls open',
    rectsEqual(pondFabBefore, pondFabMid) &&
      rectsEqual(pondFabBefore, await rectOf(page, '.vibe-pond-toggle')) &&
      (await stateOf(page, 'sound')) === 'open',
  )

  // No horizontal overflow; every expanded piece inside the viewport.
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    const rects = {}
    for (const sel of [
      '.vibe-sound-control',
      '.vibe-sound-pill',
      '.vibe-pond-control',
      '.vibe-pond-pill',
    ]) {
      const r = document.querySelector(sel).getBoundingClientRect()
      rects[sel] = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      innerWidth: window.innerWidth,
      rects,
    }
  })
  const piecesInside = Object.values(overflow.rects).every(
    (r) => r.left >= -0.5 && r.right <= overflow.innerWidth + 0.5,
  )
  check(
    'mobile: no horizontal overflow; expanded controls stay inside the viewport',
    overflow.scrollWidth <= overflow.clientWidth + 1 && piecesInside,
    JSON.stringify(overflow),
  )

  // No overlap with the center toolbar chrome (capsule + utility tray).
  const overlap = await page.evaluate(() => {
    const intersects = (a, b) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    const chrome = ['.vibe-toolbar-capsule', '.vibe-toolbar-utility-tray']
      .map((sel) => document.querySelector(sel)?.getBoundingClientRect())
      .filter(Boolean)
    const pills = ['.vibe-sound-pill', '.vibe-pond-pill'].map((sel) =>
      document.querySelector(sel).getBoundingClientRect(),
    )
    return pills.some((pill) => chrome.some((c) => intersects(pill, c)))
  })
  check('mobile: expanded pills do not overlap the center toolbar chrome', !overlap)

  // Open toolbar dialog stacks above the edge chevrons (ambient carousel):
  // at the chevron's center, the topmost element must belong to the panel.
  await page.click('button.vibe-toolbar-category[aria-label="Paint"]')
  await page.waitForSelector('.vibe-toolbar-panel', { timeout: 10000 })
  const stacking = await page.evaluate(() => {
    const panel = document.querySelector('.vibe-toolbar-panel')
    const chevron = document.querySelector('.vibe-ambient-nav-button-prev')
    if (!panel || !chevron) return null
    const p = panel.getBoundingClientRect()
    const c = chevron.getBoundingClientRect()
    const cx = c.left + c.width / 2
    const cy = c.top + c.height / 2
    const hit = document.elementFromPoint(cx, cy)
    return {
      covers:
        cx >= p.left && cx <= p.right && cy >= p.top && cy <= p.bottom,
      hitIsChevron: !!hit && (hit === chevron || chevron.contains(hit)),
      toolbarZ: getComputedStyle(document.querySelector('.vibe-toolbar')).zIndex,
      navZ: getComputedStyle(document.querySelector('.vibe-ambient-nav')).zIndex,
    }
  })
  check(
    'mobile: open toolbar dialog covers the ambient chevrons',
    !!stacking &&
      stacking.covers &&
      !stacking.hitIsChevron &&
      Number(stacking.toolbarZ) > Number(stacking.navZ),
    JSON.stringify(stacking),
  )
  await page.keyboard.press('Escape')
  await sleep(200)

  // Visual viewport shrink (browser chrome): controls remain fully visible.
  await page.setViewportSize({ width: 390, height: 600 })
  await sleep(200)
  const afterShrink = await page.evaluate(() => {
    const rects = {}
    for (const sel of ['.vibe-sound-toggle', '.vibe-pond-toggle', '.vibe-sound-pill', '.vibe-pond-pill']) {
      const r = document.querySelector(sel).getBoundingClientRect()
      rects[sel] = { top: r.top, bottom: r.bottom }
    }
    return { innerHeight: window.innerHeight, rects }
  })
  const visibleAfterShrink = Object.values(afterShrink.rects).every(
    (r) => r.top >= -0.5 && r.bottom <= afterShrink.innerHeight + 0.5,
  )
  check(
    'mobile: controls remain visible after the viewport height shrinks',
    visibleAfterShrink,
    JSON.stringify(afterShrink),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await sleep(200)

  // Vertical expansion order from the anchor (FAB) outward.
  const order = await page.evaluate(() => {
    const cy = (el) => {
      const r = el.getBoundingClientRect()
      return r.top + r.height / 2
    }
    const soundFabTop = document.querySelector('.vibe-sound-toggle').getBoundingClientRect().top
    const pondFabTop = document.querySelector('.vibe-pond-toggle').getBoundingClientRect().top
    const transport = cy(document.querySelector('.vibe-sound-transport'))
    const direction = cy(document.querySelector('.vibe-sound-direction'))
    const pondChoices = Array.from(
      document.querySelectorAll('.vibe-pond-pill [role="radio"]'),
    ).map((button) => ({ label: button.textContent, y: cy(button) }))
    return { soundFabTop, pondFabTop, transport, direction, pondChoices }
  })
  // Sound: Play/Pause nearest the FAB (larger y), Direction above it.
  check(
    'mobile: Sound expands upward — Play/Pause then Direction from the anchor outward',
    order.transport > order.direction &&
      order.transport > order.soundFabTop - 66 &&
      order.direction < order.soundFabTop,
    JSON.stringify(order),
  )
  // Pond: Source, Fish, Jelly, Ray from the anchor outward (strictly upward).
  const pondYs = order.pondChoices.map((c) => c.y)
  const pondLabels = order.pondChoices.map((c) => c.label).join(',')
  check(
    'mobile: Pond expands upward — Source, Fish, Jelly, Ray from the anchor outward',
    pondLabels === 'Source,Fish,Jelly,Ray' &&
      pondYs[0] > pondYs[1] &&
      pondYs[1] > pondYs[2] &&
      pondYs[2] > pondYs[3] &&
      pondYs[3] < order.pondFabTop,
    JSON.stringify(order.pondChoices),
  )

  // Close both: FABs fixed through the close as well.
  await page.tap('button.vibe-sound-toggle[aria-label="Turn sound off"]')
  await page.tap('button.vibe-pond-toggle[aria-label="Turn pond off"]')
  await sleep(120)
  const soundFabMidClose = await rectOf(page, '.vibe-sound-toggle')
  const pondFabMidClose = await rectOf(page, '.vibe-pond-toggle')
  await waitFor(
    async () =>
      (await stateOf(page, 'sound')) === 'closed' && (await stateOf(page, 'pond')) === 'closed',
    { label: 'both closed' },
  )
  check(
    'mobile: FABs fixed during and after close',
    rectsEqual(soundFabBefore, soundFabMidClose) &&
      rectsEqual(pondFabBefore, pondFabMidClose) &&
      rectsEqual(soundFabBefore, await rectOf(page, '.vibe-sound-toggle')) &&
      rectsEqual(pondFabBefore, await rectOf(page, '.vibe-pond-toggle')),
  )

  await context.close()
}

// --- mid-width scenario ---------------------------------------------------------

async function scenarioMidWidth(browser) {
  section('Mid width 1100x800 → 800px: measured layout, vertical pills, FAB glide')
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } })
  await seedConsent(context)
  const page = await context.newPage()
  await page.goto(DEBUG_URL, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await openVibeToolbar(page)

  // useVibeControlLayout publishes the capsule half-width (for the FAB glide)
  // and the per-side pill layout decision on <html>.
  const layout = await page.evaluate(() => ({
    capsuleHalf: document.documentElement.style.getPropertyValue('--vibe-capsule-half'),
    sound: document.documentElement.dataset.vibeSoundLayout,
    pond: document.documentElement.dataset.vibePondLayout,
  }))
  check(
    'mid: capsule half-width is published for the FAB glide',
    /^\d+px$/.test(layout.capsuleHalf) && parseInt(layout.capsuleHalf, 10) > 0,
    layout.capsuleHalf,
  )
  check(
    'mid: both pills flip to vertical expansion when horizontal no longer fits',
    layout.sound === 'vertical' && layout.pond === 'vertical',
    JSON.stringify(layout),
  )

  const soundFabBefore = await rectOf(page, '.vibe-sound-toggle')
  const pondFabBefore = await rectOf(page, '.vibe-pond-toggle')
  await page.click('button.vibe-sound-toggle')
  await page.click('button.vibe-pond-toggle')
  await waitFor(
    async () =>
      (await stateOf(page, 'sound')) === 'open' && (await stateOf(page, 'pond')) === 'open',
    { label: 'both open (mid width)' },
  )
  await sleep(500) // open transitions settle (340ms shell + 140ms-delayed inner fade)
  check(
    'mid: FABs are fixed through open',
    rectsEqual(soundFabBefore, await rectOf(page, '.vibe-sound-toggle')) &&
      rectsEqual(pondFabBefore, await rectOf(page, '.vibe-pond-toggle')),
  )

  // Vertical expansion: each pill rises from behind its FAB (shared bottom).
  const geometry = await page.evaluate(() => {
    const pair = (pillSel, fabSel) => {
      const p = document.querySelector(pillSel).getBoundingClientRect()
      const f = document.querySelector(fabSel).getBoundingClientRect()
      return { pillTop: p.top, pillBottom: p.bottom, fabTop: f.top, fabBottom: f.bottom }
    }
    return {
      sound: pair('.vibe-sound-pill', '.vibe-sound-toggle'),
      pond: pair('.vibe-pond-pill', '.vibe-pond-toggle'),
    }
  })
  const expandsUpward = (g) =>
    Math.abs(g.pillBottom - g.fabBottom) < 1 && g.pillTop < g.fabTop
  check(
    'mid: both pills expand vertically upward from behind their FABs',
    expandsUpward(geometry.sound) && expandsUpward(geometry.pond),
    JSON.stringify(geometry),
  )

  // Nothing overlaps the centered toolbar chrome (the original bug: the open
  // pond pill slid under the capsule and clipped behind it).
  const overlap = await page.evaluate(() => {
    const intersects = (a, b) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    const chrome = ['.vibe-toolbar-capsule', '.vibe-toolbar-utility-tray']
      .map((sel) => document.querySelector(sel)?.getBoundingClientRect())
      .filter(Boolean)
    const pieces = [
      '.vibe-sound-pill',
      '.vibe-pond-pill',
      '.vibe-sound-toggle',
      '.vibe-pond-toggle',
    ].map((sel) => document.querySelector(sel).getBoundingClientRect())
    return pieces.some((piece) => chrome.some((c) => intersects(piece, c)))
  })
  check('mid: expanded controls do not overlap the center toolbar chrome', !overlap)

  // Narrower still (800px): the FAB glide engages — the FABs leave their 20vw
  // anchors, pull cornerward, and still clear the capsule.
  await page.setViewportSize({ width: 800, height: 800 })
  await sleep(250)
  const glide = await page.evaluate(() => {
    const rect = (sel) => document.querySelector(sel).getBoundingClientRect()
    const soundFab = rect('.vibe-sound-toggle')
    const pondFab = rect('.vibe-pond-toggle')
    const capsule = rect('.vibe-toolbar-capsule')
    return {
      vw: window.innerWidth,
      soundFabLeft: soundFab.left,
      soundFabRight: soundFab.right,
      pondFabLeft: pondFab.left,
      pondFabRight: pondFab.right,
      capsuleLeft: capsule.left,
      capsuleRight: capsule.right,
    }
  })
  check(
    'mid: FAB glide engages — FABs pull cornerward and clear the capsule',
    glide.soundFabLeft < glide.vw * 0.2 - 1 &&
      glide.soundFabRight <= glide.capsuleLeft + 0.5 &&
      glide.pondFabRight > glide.vw * 0.8 + 1 &&
      glide.pondFabLeft >= glide.capsuleRight - 0.5,
    JSON.stringify(glide),
  )

  await context.close()
}

// --- reduced-motion scenario ------------------------------------------------------

async function scenarioReducedMotion(browser) {
  section('prefers-reduced-motion: expansion/retraction/spin transitions skipped')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await seedConsent(context)
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(DEBUG_URL, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await openVibeToolbar(page)

  const pillBefore = await page.evaluate(() => {
    const pill = document.querySelector('.vibe-sound-pill')
    const cs = getComputedStyle(pill)
    return { transitionDuration: cs.transitionDuration, visibility: cs.visibility }
  })
  check(
    'reduced motion: pill transitions are removed (0s) while closed',
    pillBefore.transitionDuration.split(',').every((d) => d.trim() === '0s'),
    JSON.stringify(pillBefore),
  )

  await page.click('button.vibe-sound-toggle')
  await sleep(80)
  const opened = await page.evaluate(() => {
    const control = document.querySelector('.vibe-sound-control')
    const pill = document.querySelector('.vibe-sound-pill')
    const inner = document.querySelector('.vibe-sound-pill-inner')
    const rotor = document.querySelector('.vibe-sound-rotor')
    return {
      state: control?.getAttribute('data-state'),
      visibility: getComputedStyle(pill).visibility,
      innerOpacity: getComputedStyle(inner).opacity,
      rotorAnimation: rotor ? getComputedStyle(rotor).animationName : null,
    }
  })
  check(
    'reduced motion: open applies instantly (visible, opacity 1, no intermediate states)',
    opened.state === 'open' && opened.visibility === 'visible' && opened.innerOpacity === '1',
    JSON.stringify(opened),
  )
  check(
    'reduced motion: the rotor spin animation is disabled entirely',
    opened.rotorAnimation === 'none',
    JSON.stringify(opened),
  )

  await page.click('button.vibe-sound-toggle[aria-label="Turn sound off"]')
  await waitFor(async () => (await stateOf(page, 'sound')) === 'closed', {
    label: 'sound closed (reduced motion)',
    timeout: 3000,
  })
  const closed = await page.evaluate(() => ({
    visibility: getComputedStyle(document.querySelector('.vibe-sound-pill')).visibility,
    rotorPresent: !!document.querySelector('.vibe-sound-rotor'),
  }))
  check(
    'reduced motion: close applies instantly (pill hidden, rotor reset)',
    closed.visibility === 'hidden' && closed.rotorPresent === false,
    JSON.stringify(closed),
  )

  await context.close()
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

    await scenarioDesktop(browser)
    await scenarioMidWidth(browser)
    await scenarioMobile(browser)
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
  console.log('All vibe toggle verifications passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
