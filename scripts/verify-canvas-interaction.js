#!/usr/bin/env node
// =============================================================================
// Browser-level regression coverage for the shared canvas hit-testing
// contract (P0) and the chat transcript bottom buffer (P2).
//
// Drives the real site in headless Chrome (system install — no browser
// download) against `next dev` with ?debug=true, which gates the
// window.__JH_SCENE_DIAGNOSTICS__ / window.__JH_PAINT_STATUS__ test hooks
// (never populated in production builds).
//
//   node scripts/verify-canvas-interaction.js [port]
//
// Covers:
//   - exposed-canvas hit-testing (elementFromPoint === canvas) on the landing,
//     every Work slide (incl. slides after 1), Collaborate landing + chat, and
//     Vibe closed/open, at desktop and mobile widths
//   - pointer repel + click/tap impulses on exposed canvas; impulses survive
//     mode and slide transitions without a reload
//   - UI priority: nav, buttons, cards, composers, rails, and scroll panels
//     stay interactive and never produce canvas impulses
//   - Vibe paint: enable, brush-ring sync (size + erase mode), mouse stroke
//     commit, strokes leaving/re-entering the viewport, erase, clear,
//     undo/redo, no painting through UI, impulse suppression while painting,
//     and the destructive-action confirmation when leaving with paint
//   - touch: tap impulse, canvas touch drag, panel touch scrolling, touch paint
//   - reduced motion: impulses intentionally suppressed (static is not a
//     regression)
//   - P2: the final chat response keeps ≥ one response line height of clear
//     space above the prompt rail, with matching scroll-padding-bottom
// =============================================================================

const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4731
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

/** Pre-seed the analytics-consent decision so the first-visit privacy panel
 *  never intercepts pointer input mid-test. */
const seedConsent = (context) =>
  context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'jh.analytics-consent',
        JSON.stringify({ decision: 'denied', decidedAt: Date.now() }),
      )
    } catch {}
  })

/** The ?debug=true tuning panel/diagnostics are dev-only chrome, not part of
 *  the shipped hit-testing contract — hide them so they never shadow the
 *  product surfaces under test (they overlap the content column on purpose
 *  in dev). */
const hideDevChrome = (page) =>
  page.addStyleTag({ content: '.tuning-panel,.dev-diagnostics{display:none!important}' })

// --- dev server ----------------------------------------------------------------

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

const readDiag = (page) =>
  page.evaluate(() => {
    const d = window.__JH_SCENE_DIAGNOSTICS__
    return d
      ? {
          impulseCount: d.impulseCount,
          pointerActive: d.pointerActive,
          pointerType: d.pointerType,
          pointerX: d.pointerX,
          pointerY: d.pointerY,
          targetCount: d.targetCount,
          paintedTargetCount: d.paintedTargetCount,
        }
      : null
  })

const readPaint = (page) =>
  page.evaluate(() => window.__JH_PAINT_STATUS__ || null)

const hitTest = (page, x, y) =>
  page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px, py)
      if (!el) return { tag: null, cls: '', isCanvas: false }
      return {
        tag: el.tagName,
        cls: typeof el.className === 'string' ? el.className : '',
        isCanvas: el.tagName === 'CANVAS',
      }
    },
    [x, y],
  )

/** First candidate coordinate whose hit-test target is the canvas itself. */
async function findExposed(page, candidates, label) {
  for (const [x, y] of candidates) {
    const hit = await hitTest(page, x, y)
    if (hit.isCanvas) return { x, y }
  }
  throw new Error(`no exposed canvas point found for ${label}`)
}

/** Assert the canvas is hit-testable at a representative exposed coordinate. */
async function expectExposed(page, candidates, label) {
  try {
    const point = await findExposed(page, candidates, label)
    check(`canvas exposed: ${label}`, true)
    return point
  } catch (err) {
    check(`canvas exposed: ${label}`, false, err.message)
    return null
  }
}

async function impulseCount(page) {
  const diag = await readDiag(page)
  return diag ? diag.impulseCount : -1
}

/** Click/tap an exposed point and assert exactly one canvas impulse. */
async function expectImpulse(page, point, label) {
  if (!point) {
    check(`impulse: ${label}`, false, 'no exposed point')
    return
  }
  const before = await impulseCount(page)
  await page.mouse.click(point.x, point.y)
  try {
    await waitFor(async () => (await impulseCount(page)) === before + 1, {
      label: `impulse ${label}`,
      timeout: 6000,
    })
    check(`impulse: ${label}`, true)
  } catch (err) {
    check(`impulse: ${label}`, false, `count stuck at ${before}`)
  }
}

/** Move the mouse over an exposed point and assert the repel pointer follows. */
async function expectRepel(page, point, label) {
  if (!point) {
    check(`repel: ${label}`, false, 'no exposed point')
    return
  }
  await page.mouse.move(point.x, point.y, { steps: 6 })
  try {
    await waitFor(
      async () => {
        const d = await readDiag(page)
        return d && d.pointerActive && Math.abs(d.pointerX - point.x) < 60
      },
      { label: `repel ${label}`, timeout: 6000 },
    )
    check(`repel: ${label}`, true)
  } catch (err) {
    check(`repel: ${label}`, false, err.message)
  }
}

/** Assert a real click on a UI element lands on it and never fires an impulse. */
async function expectUiClickNoImpulse(page, selector, label) {
  const before = await impulseCount(page)
  await page.click(selector)
  await sleep(500)
  const after = await impulseCount(page)
  check(`UI click fires no canvas impulse: ${label}`, before === after, `${before} → ${after}`)
}

async function touchDrag(page, points, { holdMs = 40 } = {}) {
  const cdp = await page.context().newCDPSession(page)
  const [start, ...rest] = points
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start[0], y: start[1], id: 1 }],
  })
  for (const [x, y] of rest) {
    await sleep(holdMs)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 1 }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

const STUB_ANSWER = {
  heading: 'Canvas interaction test conversation',
  answer:
    'Joel has led as a hands-on lead designer, owning UX and strategy while staying in the craft himself. ' +
    'He develops architectural models and interactive prototypes, presents at conference level, and aligns ' +
    'cross-functional teams around shared patterns rather than directing from a distance. This canned answer ' +
    'exists so the transcript grows long enough to scroll during automated verification.',
  sourceCards: [{ id: 'leadership-craft', label: 'Leadership in craft' }],
  followUps: ['How does Joel stay hands-on?', 'What has Joel shipped recently?'],
  topic: 'leadership',
}

async function stubCollaborateApi(page) {
  await page.route('**/api/collaborate', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_ANSWER),
    })
  })
}

async function waitForCanvasReady(page) {
  await waitFor(
    async () => {
      const d = await readDiag(page)
      return d && d.targetCount > 0
    },
    { label: 'canvas diagnostics hook', timeout: 60000 },
  )
}

/** Static contract: structural wrappers are pointer-transparent, surfaces own input. */
async function expectPointerContract(page, checks, label) {
  const actual = await page.evaluate((selectors) => {
    const out = {}
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      out[sel] = el ? getComputedStyle(el).pointerEvents : null
    }
    return out
  }, checks.map(([sel]) => sel))
  for (const [sel, expected] of checks) {
    check(
      `hit-testing contract (${label}): ${sel} is ${expected}`,
      actual[sel] === expected,
      `got ${actual[sel]}`,
    )
  }
}

// --- scenarios -----------------------------------------------------------------

async function scenarioLanding(page) {
  section('Landing (intro)')
  await page.goto(DEBUG_URL, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await waitForCanvasReady(page)
  await expectPointerContract(
    page,
    [
      ['.foreground-layer', 'none'],
      ['.experience-transition', 'none'],
      ['.foreground-content', 'none'],
      ['.scene-root canvas', 'auto'],
    ],
    'landing',
  )
  const right = await expectExposed(page, [[1500, 450], [1480, 700], [1420, 250]], 'landing right margin')
  const top = await expectExposed(page, [[800, 120], [800, 160], [640, 120]], 'landing top gap')
  const bottom = await expectExposed(page, [[800, 780], [860, 810], [720, 780]], 'landing bottom gap')
  await expectRepel(page, right, 'landing')
  await expectImpulse(page, top, 'landing top')
  await expectImpulse(page, bottom, 'landing bottom')

  // UI priority: the primary action buttons never fire canvas impulses, and
  // they navigate. Wait out the intro reveal first.
  await page.waitForSelector('.primary-actions:not(.options-hidden):not(.options-inert)', {
    timeout: 30000,
  })
  await expectPointerContract(page, [['.primary-action-button', 'auto']], 'landing')
  const buttonRadius = await page.evaluate(
    () => getComputedStyle(document.querySelector('.primary-action-button')).borderRadius,
  )
  check('landing buttons are fully rounded pills', buttonRadius === '999px', buttonRadius)
  await expectUiClickNoImpulse(page, '.primary-action-button >> text=Work', 'primary action “Work”')
  await page.waitForSelector('.work-experience', { timeout: 15000 })
}

async function scenarioWork(page) {
  section('Work slides')
  const progress = await page.textContent('.work-progress')
  const total = Number((progress || '').split('/')[1]) || 0
  check('work slide count readable', total > 1, progress || '')
  for (let index = 0; index < total; index += 1) {
    const label = `work slide ${index + 1}${index === 0 ? '' : ' (after slide 1)'}`
    const point = await expectExposed(
      page,
      [[800, 70], [1400, 450], [1300, 820], [800, 870], [1350, 130]],
      label,
    )
    await expectImpulse(page, point, label)
    if (index < total - 1) {
      await expectUiClickNoImpulse(page, 'button[aria-label="Next slide"]', `work Next (slide ${index + 1})`)
      await waitFor(
        async () => (await page.textContent('.work-progress'))?.startsWith(`${index + 2} /`),
        { label: 'slide advance' },
      )
    }
  }
  // The card itself owns interaction — its center never falls through.
  const cardHit = await page.evaluate(() => {
    const card = document.querySelector('.work-experience')
    if (!card) return null
    const r = card.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return el ? !!el.closest('.work-experience') : false
  })
  check('work card owns its pointer input (no fall-through)', cardHit === true)
}

async function scenarioCollaborateLanding(page) {
  section('Collaborate landing')
  await expectUiClickNoImpulse(page, '.experience-nav-button >> text=Collaborate', 'nav “Collaborate”')
  await page.waitForSelector('.collaborate-experience', { timeout: 15000 })
  const point = await expectExposed(
    page,
    [[800, 60], [1400, 450], [1350, 750], [370, 450]],
    'collaborate landing',
  )
  await expectImpulse(page, point, 'collaborate landing')
  const cardHit = await page.evaluate(() => {
    const card = document.querySelector('.collaborate-experience')
    if (!card) return null
    const r = card.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return el ? !!el.closest('.collaborate-experience') : false
  })
  check('collaborate card owns its pointer input', cardHit === true)
}

async function scenarioChat(page) {
  section('Collaborate chat')
  await stubCollaborateApi(page)
  await page.fill('.guide-input', 'How does Joel lead teams?')
  await page.click('.guide-submit')
  await page.waitForSelector('.chat-answer', { timeout: 15000 })

  // Grow the transcript until it actually scrolls.
  await waitFor(
    async () =>
      page.evaluate(() => {
        const t = document.querySelector('.chat-transcript')
        return t && t.scrollHeight > t.clientHeight + 4
      }),
    { label: 'transcript overflow', timeout: 3000 },
  ).catch(async () => {
    for (let i = 0; i < 4; i += 1) {
      await page.fill('.chat-input', `Follow-up message number ${i + 2} for the scrolling test?`)
      await page.click('.chat-send')
      await waitFor(
        async () =>
          (await page.locator('.chat-answer').count()) >= i + 2,
        { label: 'answer arrival' },
      )
    }
  })

  await expectPointerContract(
    page,
    [
      ['.chat-shell', 'none'],
      ['.chat-transcript', 'auto'],
      ['.chat-composer', 'auto'],
    ],
    'chat',
  )
  const point = await expectExposed(
    page,
    [[370, 450], [1400, 450], [1350, 200], [370, 700], [1450, 700]],
    'chat side margin',
  )
  await expectImpulse(page, point, 'chat exposed margin')

  // Transcript owns its region: a point inside it never reaches the canvas.
  const transcriptHit = await page.evaluate(() => {
    const t = document.querySelector('.chat-transcript')
    if (!t) return null
    const r = t.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return el ? !!el.closest('.chat-transcript') : false
  })
  check('chat transcript owns its pointer input', transcriptHit === true)

  // The suggested-prompt rail stays interactive and impulse-free.
  await expectUiClickNoImpulse(page, '.chat-rail .guide-followup >> nth=0', 'suggested-prompt rail')
  await waitFor(async () => (await page.locator('.chat-answer').count()) >= 2, {
    label: 'rail answer',
  })

  // Composer: text entry never activates the canvas.
  const before = await impulseCount(page)
  await page.click('.chat-input')
  await page.keyboard.type('Typing in the composer must not paint or blast the canvas')
  await sleep(400)
  check(
    'composer text entry fires no canvas impulse',
    (await impulseCount(page)) === before,
  )

  await assertVisitorLaneOffset(page, 'desktop')
  await assertChatBottomBuffer(page, 'desktop')
  await assertChatOverlayLayout(page, 'desktop')
}

/** Full-length scroll layout: the transcript spans the shell's full height
 *  while header and bottom cluster float above it; the final card still
 *  clears the prompt rail by a full response line at the pinned end. */
async function assertChatOverlayLayout(page, label) {
  const layout = await page.evaluate(() => {
    const shell = document.querySelector('.chat-shell')
    const t = document.querySelector('.chat-transcript')
    if (!shell || !t) return null
    t.scrollTop = t.scrollHeight
    const shellRect = shell.getBoundingClientRect()
    const tRect = t.getBoundingClientRect()
    const rail = document.querySelector('.chat-rail')
    const answers = t.querySelectorAll('.chat-answer')
    const last = answers[answers.length - 1]
    const text = last?.querySelector('.chat-answer-text')
    const lineHeight = text ? parseFloat(getComputedStyle(text).lineHeight) : 0
    const beam = document.querySelector('.chat-bottom [data-beam]')
    return {
      headerPos: getComputedStyle(document.querySelector('.chat-header')).position,
      bottomPos: getComputedStyle(document.querySelector('.chat-bottom')).position,
      fullHeight: Math.abs(tRect.height - shellRect.height) < 2,
      topAligned: Math.abs(tRect.top - shellRect.top) < 2,
      railClearance:
        rail && last ? rail.getBoundingClientRect().top - last.getBoundingClientRect().bottom : null,
      lineHeight,
      beam: !!beam && !!beam.querySelector('.chat-composer'),
      masked: (getComputedStyle(t).maskImage || getComputedStyle(t).webkitMaskImage || '').includes(
        'linear-gradient',
      ),
    }
  })
  if (!layout) {
    check(`chat overlay layout (${label})`, false, 'no shell/transcript found')
    return
  }
  check(`chat overlay layout (${label}): header floats above the transcript`, layout.headerPos === 'absolute')
  check(
    `chat overlay layout (${label}): bottom cluster floats above the transcript`,
    layout.bottomPos === 'absolute',
  )
  check(
    `chat overlay layout (${label}): transcript scrolls the full shell height beneath`,
    layout.fullHeight && layout.topAligned,
  )
  check(
    `chat overlay layout (${label}): transcript fades out beneath the overlays`,
    layout.masked,
  )
  check(
    `chat overlay layout (${label}): final card clears the prompt rail by ≥ one response line`,
    layout.railClearance === null || layout.railClearance >= layout.lineHeight - 0.5,
    layout.railClearance === null
      ? 'no rail'
      : `clearance ${layout.railClearance.toFixed(1)}px vs line ${layout.lineHeight.toFixed(1)}px`,
  )
  check(`chat overlay layout (${label}): composer carries the border beam`, layout.beam)
}

async function assertChatBottomBuffer(page, label) {
  // Natural pin first: measure exactly what the visitor sees after the last
  // answer, WITHOUT touching scrollTop. The pin effect must land the end
  // position on its own (brief settle window for the post-render effect).
  let natural = null
  try {
    natural = await waitFor(
      async () => {
        const m = await page.evaluate(() => {
          const t = document.querySelector('.chat-transcript')
          if (!t) return null
          return { remainder: t.scrollHeight - t.clientHeight - t.scrollTop }
        })
        return m && m.remainder <= 2 ? m : false
      },
      { label: 'natural pin settle', timeout: 5000 },
    )
  } catch {
    natural = { remainder: Number.NaN }
  }
  const metrics = await page.evaluate(() => {
    const t = document.querySelector('.chat-transcript')
    if (!t) return null
    const answers = t.querySelectorAll('.chat-answer')
    const last = answers[answers.length - 1]
    if (!last) return null
    const text = last.querySelector('.chat-answer-text')
    const lineHeight = text ? parseFloat(getComputedStyle(text).lineHeight) : 0
    // Geometry of the pinned end position (forced to the floor to measure
    // the buffer independent of where the natural pin landed).
    t.scrollTop = t.scrollHeight
    const tRect = t.getBoundingClientRect()
    const cRect = last.getBoundingClientRect()
    return {
      gap: tRect.bottom - cRect.bottom,
      lineHeight,
      scrollPaddingBottom: getComputedStyle(t).scrollPaddingBottom,
      paddingBottom: getComputedStyle(t).paddingBottom,
    }
  })
  if (!metrics || !natural) {
    check(`chat bottom buffer (${label})`, false, 'no transcript/answer found')
    return
  }
  check(
    `chat bottom buffer (${label}): natural pin lands at the end after the last answer`,
    natural.remainder <= 2,
    `remainder ${natural.remainder.toFixed(1)}px`,
  )
  check(
    `chat bottom buffer (${label}): final card clears the boundary by ≥ one response line`,
    metrics.gap >= metrics.lineHeight - 0.5,
    `gap ${metrics.gap.toFixed(1)}px vs line ${metrics.lineHeight.toFixed(1)}px`,
  )
  check(
    `chat bottom buffer (${label}): scroll-padding-bottom matches the buffer`,
    Math.abs(parseFloat(metrics.scrollPaddingBottom) - parseFloat(metrics.paddingBottom)) < 0.5 &&
      parseFloat(metrics.scrollPaddingBottom) >= metrics.lineHeight,
    `scroll-padding ${metrics.scrollPaddingBottom} vs padding ${metrics.paddingBottom}`,
  )
}

/** Long visitor messages: the visitor lane mirrors the guide lane — the card
 *  stops one lane-offset short of the stage's left edge, matching the guide
 *  cards' right margin. */
async function assertVisitorLaneOffset(page, label) {
  const longMessage =
    'This is a deliberately long visitor message designed to test how the visitor bubble behaves when it has to wrap across many lines inside the chat stage. '.repeat(
      6,
    ).slice(0, 780)
  const answersBefore = await page.locator('.chat-answer').count()
  await page.fill('.chat-input', longMessage)
  await page.click('.chat-send')
  await waitFor(async () => (await page.locator('.chat-answer').count()) > answersBefore, {
    label: 'long-message answer',
  })
  const lanes = await page.evaluate(() => {
    const t = document.querySelector('.chat-transcript')
    const tRect = t.getBoundingClientRect()
    const pad = parseFloat(getComputedStyle(t).paddingLeft)
    const cards = document.querySelectorAll('.chat-visitor-card')
    const visitor = cards[cards.length - 1].getBoundingClientRect()
    const answers = document.querySelectorAll('.chat-answer')
    const guide = answers[answers.length - 1].getBoundingClientRect()
    return {
      visitorLeftGap: visitor.left - (tRect.left + pad),
      guideRightGap: tRect.right - pad - guide.right,
      visitorRightGap: tRect.right - pad - visitor.right,
    }
  })
  check(
    `visitor lane (${label}): left margin mirrors the guide lane's right margin`,
    Math.abs(lanes.visitorLeftGap - lanes.guideRightGap) < 2,
    `visitor left ${lanes.visitorLeftGap.toFixed(1)}px vs guide right ${lanes.guideRightGap.toFixed(1)}px`,
  )
  check(
    `visitor lane (${label}): lane offset stays open at desktop width`,
    lanes.visitorLeftGap > 100,
    `left gap ${lanes.visitorLeftGap.toFixed(1)}px`,
  )
  check(
    `visitor lane (${label}): right edge stays pinned to the stage`,
    lanes.visitorRightGap < 6,
    `right gap ${lanes.visitorRightGap.toFixed(1)}px`,
  )
}

async function scenarioVibeClosed(page) {
  section('Vibe (closed)')
  await page.evaluate(() => {
    window.location.hash = '#vibe'
  })
  await page.waitForSelector('.vibe-cta', { timeout: 15000 })
  const point = await expectExposed(
    page,
    [[800, 120], [1400, 450], [800, 790], [400, 300]],
    'vibe closed',
  )
  await expectImpulse(page, point, 'vibe closed')
  await expectUiClickNoImpulse(page, '.vibe-cta', 'vibe “Make it yours” CTA')
  await page.waitForSelector('.vibe-toolbar', { timeout: 15000 })
}

async function scenarioVibePaint(page) {
  section('Vibe paint (mouse)')
  const open = await expectExposed(
    page,
    [[800, 120], [1400, 300], [1400, 650], [400, 250]],
    'vibe open',
  )
  await expectImpulse(page, open, 'vibe open (paint disabled)')

  // Enable paint through the toolbar UI.
  await page.click('button.vibe-toolbar-category[aria-label="Paint"]')
  await page.waitForSelector('.vibe-paint-panel', { timeout: 10000 })
  await page.click('label:has-text("Enable painting")')
  await page.waitForSelector('.paint-brush-ring', { timeout: 10000 })

  // Brush ring tracks the pointer and mirrors the configured diameter.
  const ringAt = await findExposed(page, [[1400, 300], [1300, 350], [1450, 250]], 'brush ring')
  await page.mouse.move(ringAt.x, ringAt.y, { steps: 4 })
  const ring = await page.evaluate(() => {
    const el = document.querySelector('.paint-brush-ring')
    return el ? { width: el.style.width, opacity: el.style.opacity, erase: el.classList.contains('paint-brush-ring-erase') } : null
  })
  check('brush ring visible over exposed canvas', !!ring && ring.opacity === '1', JSON.stringify(ring))
  check('brush ring matches the default brush diameter', !!ring && ring.width === '48px', ring?.width || '')

  // [ / ] resize the brush; the ring follows.
  await page.evaluate(() => {
    const active = document.activeElement
    if (active && active.blur) active.blur()
  })
  await page.keyboard.press(']')
  try {
    await waitFor(
      async () =>
        (await page.evaluate(() => document.querySelector('.paint-brush-ring')?.style.width)) ===
        '52px',
      { label: 'brush ring resize', timeout: 4000 },
    )
    check('brush ring tracks brush-size changes', true)
  } catch {
    check('brush ring tracks brush-size changes', false, 'ring width did not follow “]”')
  }
  await page.keyboard.press('[')

  // Gesture lifecycle: down begins + captures, moves mark continuously, up
  // commits. The drag crosses the glyph-dense center of the vibe field so
  // the glyph-channel count provably moves.
  const strokeStart = [680, 430]
  const strokeEnd = [950, 480]
  await page.mouse.move(strokeStart[0], strokeStart[1])
  await page.mouse.down()
  await page.mouse.move(strokeEnd[0], strokeEnd[1], { steps: 14 })
  await page.mouse.up()
  try {
    await waitFor(
      async () => {
        const p = await readPaint(page)
        return p && p.strokeCount === 1 && !p.active && p.paintedTargetCount > 0
      },
      { label: 'committed stroke', timeout: 6000 },
    )
    check('paint stroke commits on pointer up (glyph channel)', true)
  } catch (err) {
    check('paint stroke commits on pointer up (glyph channel)', false, err.message)
  }

  // Stroke leaves and re-enters the viewport; capture keeps it one stroke.
  await page.mouse.move(1400, 260)
  await page.mouse.down()
  await page.mouse.move(1400, -80, { steps: 6 }) // out through the top edge
  await page.mouse.move(1300, 330, { steps: 8 }) // back in
  await page.mouse.up()
  try {
    await waitFor(
      async () => (await readPaint(page))?.strokeCount === 2,
      { label: 're-entrant stroke', timeout: 6000 },
    )
    check('stroke leaving and re-entering the canvas stays one stroke', true)
  } catch (err) {
    check('stroke leaving and re-entering the canvas stays one stroke', false, err.message)
  }

  // Paint mode never fires click impulses; a click paints a dot instead.
  const impulses = await impulseCount(page)
  await page.mouse.click(1450, 600)
  await sleep(500)
  check(
    'paint mode suppresses click impulses',
    (await impulseCount(page)) === impulses,
  )
  try {
    await waitFor(async () => (await readPaint(page))?.strokeCount === 3, {
      label: 'dot stroke',
      timeout: 4000,
    })
    check('click in paint mode commits a dot stroke', true)
  } catch {
    check('click in paint mode commits a dot stroke', false)
  }

  // No painting through interactive UI: a drag across the toolbar starts nothing.
  const toolbarRect = await page.evaluate(() => {
    const bar = document.querySelector('.vibe-toolbar')
    if (!bar) return null
    const r = bar.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await page.mouse.move(toolbarRect.x - 60, toolbarRect.y)
  await page.mouse.down()
  await page.mouse.move(toolbarRect.x + 60, toolbarRect.y, { steps: 6 })
  await page.mouse.up()
  await sleep(400)
  check(
    'no painting through the toolbar',
    (await readPaint(page))?.strokeCount === 3,
    `strokeCount ${(await readPaint(page))?.strokeCount}`,
  )

  // Undo / redo through the unified history.
  await page.click('button.vibe-toolbar-utility[aria-label="Undo"]')
  await waitFor(async () => (await readPaint(page))?.strokeCount === 2, { label: 'undo' })
  await page.click('button.vibe-toolbar-utility[aria-label="Redo"]')
  await waitFor(async () => (await readPaint(page))?.strokeCount === 3, { label: 'redo' })
  check('paint undo/redo restore committed strokes', true)

  // Background-channel paint: enable the background color, drag, and confirm
  // a background stroke commits (its own channel, separate from glyph paint).
  await page.click('button.vibe-toolbar-category[aria-label="Paint"]')
  await page.waitForSelector('.vibe-paint-panel', { timeout: 10000 })
  await page.click('label:has-text("Background color")')
  await page.mouse.move(1400, 420)
  await page.mouse.down()
  await page.mouse.move(1300, 520, { steps: 8 })
  await page.mouse.up()
  try {
    await waitFor(
      async () => {
        const p = await readPaint(page)
        return p && p.strokeCount === 4 && p.backgroundStrokeCount === 1
      },
      { label: 'background paint stroke', timeout: 6000 },
    )
    check('background paint stroke commits (background channel)', true)
  } catch (err) {
    check('background paint stroke commits (background channel)', false, err.message)
  }

  // Erase mode: ring restyles, stroke commits. (A canvas pointerdown closed
  // the popout — the tool state lives in the shell — so re-open it first.)
  await page.click('button.vibe-toolbar-category[aria-label="Paint"]')
  await page.waitForSelector('.vibe-paint-panel', { timeout: 10000 })
  await page.click('.vibe-paint-tool:has-text("Erase")')
  await page.mouse.move(1300, 420)
  await page.mouse.down()
  await page.mouse.move(1220, 470, { steps: 8 })
  await page.mouse.up()
  const eraseRing = await page.evaluate(() =>
    document.querySelector('.paint-brush-ring')?.classList.contains('paint-brush-ring-erase'),
  )
  check('brush ring reflects erase mode', eraseRing === true)
  try {
    await waitFor(async () => (await readPaint(page))?.strokeCount === 5, {
      label: 'erase stroke',
      timeout: 4000,
    })
    check('erase stroke commits', true)
  } catch {
    check('erase stroke commits', false)
  }

  // Clear wipes the overlay (undoable transaction, no dialog). The erase
  // stroke's pointerdown closed the popout again — re-open it.
  await page.click('button.vibe-toolbar-category[aria-label="Paint"]')
  await page.waitForSelector('.vibe-paint-panel', { timeout: 10000 })
  await page.click('button.vibe-paint-clear')
  await waitFor(async () => (await readPaint(page))?.strokeCount === 0, { label: 'clear' })
  check('clear paint empties the overlay', true)

  // Destructive confirmation: leaving vibe with paint asks first.
  await page.mouse.move(1400, 300)
  await page.mouse.down()
  await page.mouse.move(1300, 420, { steps: 8 })
  await page.mouse.up()
  await waitFor(async () => (await readPaint(page))?.strokeCount === 1, { label: 'repaint' })
  await page.click('.experience-nav-button >> text=Work')
  await page.waitForSelector('.paint-confirm-overlay', { timeout: 8000 })
  check('leaving vibe with paint shows the discard confirmation', true)
  await page.click('.paint-confirm-button:has-text("Keep painting")')
  await sleep(400)
  const stillVibe = await page.evaluate(() => window.location.hash === '#vibe')
  check('cancel keeps painting and stays in vibe', stillVibe && (await readPaint(page))?.strokeCount === 1)
  await page.click('.experience-nav-button >> text=Work')
  await page.waitForSelector('.paint-confirm-overlay', { timeout: 8000 })
  await page.click('.paint-confirm-button:has-text("Discard and continue")')
  await page.waitForSelector('.work-experience', { timeout: 15000 })
  check('confirm discards paint and navigates', (await readPaint(page))?.strokeCount === 0)
}

async function scenarioListenersSurvive(page) {
  section('Listener persistence')
  // After the full intro → work → collaborate → chat → vibe → work cycle on
  // ONE page load, the canvas listeners must still be mounted: a fresh
  // impulse lands without any reload.
  const point = await expectExposed(
    page,
    [[800, 70], [1400, 450], [1300, 820]],
    'work after the full navigation cycle',
  )
  await expectImpulse(page, point, 'after intro → work → collaborate → chat → vibe → work (no reload)')
}

async function scenarioTouch(browser) {
  section('Touch (mobile viewport)')
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  await seedConsent(context)
  const page = await context.newPage()
  await page.goto(DEBUG_URL, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await waitForCanvasReady(page)

  const point = await expectExposed(
    page,
    [[195, 300], [195, 650], [40, 400], [350, 400]],
    'mobile landing',
  )
  if (point) {
    const before = await impulseCount(page)
    await page.touchscreen.tap(point.x, point.y)
    try {
      await waitFor(async () => (await impulseCount(page)) === before + 1, {
        label: 'tap impulse',
        timeout: 6000,
      })
      check('tap fires a canvas impulse', true)
    } catch {
      check('tap fires a canvas impulse', false)
    }
  }

  // Touch drag on exposed canvas drives the touch pointer (no cancellation).
  if (point) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x, y: point.y, id: 1 }],
    })
    for (let i = 1; i <= 6; i += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: point.x, y: point.y + i * 12, id: 1 }],
      })
      await sleep(90)
    }
    const during = await readDiag(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
    check(
      'touch drag on canvas drives the touch pointer without cancellation',
      !!during && during.pointerActive && during.pointerType === 'touch',
      JSON.stringify(during),
    )
  }

  // Work: a touch drag on the card scrolls the panel, never the canvas.
  await page.evaluate(() => {
    window.location.hash = '#work'
  })
  await page.waitForSelector('.work-experience', { timeout: 15000 })
  await page.click('button[aria-label="Next slide"]')
  await sleep(600)
  const scrollInfo = await page.evaluate(() => {
    const v = document.querySelector('.work-experience-viewport')
    if (!v) return null
    const r = v.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, overflow: v.scrollHeight > v.clientHeight + 4 }
  })
  if (scrollInfo) {
    const before = await impulseCount(page)
    await touchDrag(
      page,
      [
        [scrollInfo.x, scrollInfo.y + 120],
        [scrollInfo.x, scrollInfo.y + 80],
        [scrollInfo.x, scrollInfo.y + 40],
        [scrollInfo.x, scrollInfo.y],
        [scrollInfo.x, scrollInfo.y - 50],
        [scrollInfo.x, scrollInfo.y - 100],
      ],
      { holdMs: 110 },
    )
    await sleep(600)
    const after = await impulseCount(page)
    const scrollTop = await page.evaluate(
      () => document.querySelector('.work-experience-viewport')?.scrollTop ?? -1,
    )
    check('touch drag on the Work panel fires no canvas impulse', before === after)
    if (scrollInfo.overflow) {
      check('touch drag scrolls the Work panel', scrollTop > 0, `scrollTop ${scrollTop}`)
    }
  }

  // Vibe: touch paints.
  await stubCollaborateApi(page)
  await page.evaluate(() => {
    window.location.hash = '#vibe'
  })
  await page.waitForSelector('.vibe-cta', { timeout: 15000 })
  await page.click('.vibe-cta')
  await page.waitForSelector('.vibe-toolbar', { timeout: 15000 })
  await page.click('button.vibe-toolbar-category[aria-label="Paint"]')
  await page.waitForSelector('.vibe-paint-panel', { timeout: 10000 })
  await page.click('label:has-text("Enable painting")')
  await page.waitForSelector('.paint-brush-ring', { timeout: 10000 })
  const touchPaintAt = await findExposed(page, [[195, 260], [150, 320], [240, 220]], 'mobile paint')
  await touchDrag(page, [
    [touchPaintAt.x, touchPaintAt.y],
    [touchPaintAt.x, touchPaintAt.y + 90],
    [touchPaintAt.x - 6, touchPaintAt.y + 170],
  ])
  try {
    await waitFor(
      async () => {
        const p = await readPaint(page)
        return p && p.strokeCount === 1 && !p.active
      },
      { label: 'touch paint stroke', timeout: 6000 },
    )
    check('touch stroke commits on touch end', true)
  } catch (err) {
    check('touch stroke commits on touch end', false, err.message)
  }

  // Mobile chat: bottom buffer holds at phone widths too.
  await page.evaluate(() => {
    window.location.hash = '#collaborate'
  })
  await page.waitForSelector('.collaborate-experience', { timeout: 15000 })
  await page.fill('.guide-input', 'How does Joel lead teams?')
  await page.click('.guide-submit')
  await page.waitForSelector('.chat-answer', { timeout: 15000 })
  for (let i = 0; i < 3; i += 1) {
    await page.fill('.chat-input', `Another mobile transcript growth question ${i + 2}?`)
    await page.click('.chat-send')
    await waitFor(async () => (await page.locator('.chat-answer').count()) >= i + 2, {
      label: 'mobile answer',
    })
  }
  await assertChatBottomBuffer(page, 'mobile')
  await assertChatOverlayLayout(page, 'mobile')
  const chatExposed = await expectExposed(
    page,
    [[8, 400], [8, 220], [382, 400], [195, 60]],
    'mobile chat margin',
  )
  if (chatExposed) {
    const before = await impulseCount(page)
    await page.touchscreen.tap(chatExposed.x, chatExposed.y)
    try {
      await waitFor(async () => (await impulseCount(page)) === before + 1, {
        label: 'mobile chat tap impulse',
        timeout: 6000,
      })
      check('tap impulse works beside the mobile chat', true)
    } catch {
      check('tap impulse works beside the mobile chat', false)
    }
  }
  await context.close()
}

/** Light-mode chat surfaces: every card/pill over the canvas must blur its
 *  backdrop and be effectively opaque, or the animated canvas bleeds through
 *  the text (the legibility regression from the 12%-alpha visitor tint). */
async function scenarioLightModeChat(browser) {
  section('Light mode chat legibility')
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  })
  await seedConsent(context)
  const page = await context.newPage()
  await stubCollaborateApi(page)
  await page.goto(`${DEBUG_URL}#collaborate`, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await page.waitForSelector('.guide-input', { timeout: 30000 })
  await page.fill('.guide-input', 'How does Joel lead teams?')
  await page.click('.guide-submit')
  await page.waitForSelector('.chat-answer', { timeout: 30000 })
  const surfaces = await page.evaluate(() => {
    const read = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const cs = getComputedStyle(el)
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/)
      const alpha = m ? parseFloat(m[1].split(',').pop()) : 1
      return { backdrop: cs.backdropFilter, alpha }
    }
    return {
      'visitor card': read('.chat-visitor-card'),
      'guide answer card': read('.chat-answer'),
      composer: read('.chat-composer'),
      'follow-up pill': read('.guide-followup'),
    }
  })
  for (const [name, surface] of Object.entries(surfaces)) {
    check(
      `light mode: ${name} blurs its canvas backdrop`,
      !!surface && surface.backdrop.includes('blur'),
      surface ? `backdrop-filter: ${surface.backdrop}` : 'element missing',
    )
    check(
      `light mode: ${name} surface is effectively opaque`,
      !!surface && surface.alpha >= 0.9,
      surface ? `alpha ${surface.alpha}` : 'element missing',
    )
  }
  await context.close()
}

async function scenarioReducedMotion(browser) {  section('Reduced motion')
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    reducedMotion: 'reduce',
  })
  await seedConsent(context)
  const page = await context.newPage()
  await page.goto(DEBUG_URL, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await waitForCanvasReady(page)
  const point = await findExposed(page, [[1500, 450], [800, 120]], 'reduced-motion landing')
  const before = await impulseCount(page)
  await page.mouse.click(point.x, point.y)
  await sleep(700)
  check(
    'reduced motion: click impulses intentionally suppressed (static pose kept)',
    (await impulseCount(page)) === before,
  )
  await context.close()
}

// --- main ------------------------------------------------------------------------

async function main() {
  console.log(`Starting dev server on ${ORIGIN} …`)
  const server = startDevServer()
  const cleanup = async (code) => {
    try {
      server.kill('SIGTERM')
    } catch {}
    process.exit(code)
  }
  process.on('SIGINT', () => cleanup(2))
  process.on('SIGTERM', () => cleanup(2))

  let browser = null
  try {
    await waitForServer()
    const executablePath = CHROME_CANDIDATES.find((candidate) =>
      require('node:fs').existsSync(candidate),
    )
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : { channel: 'chrome' }),
    })
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    await seedConsent(context)
    const page = await context.newPage()
    page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`))

    const scenarios = [
      ['landing', () => scenarioLanding(page)],
      ['work', () => scenarioWork(page)],
      ['collaborate landing', () => scenarioCollaborateLanding(page)],
      ['chat', () => scenarioChat(page)],
      ['vibe closed', () => scenarioVibeClosed(page)],
      ['vibe paint', () => scenarioVibePaint(page)],
      ['listener persistence', () => scenarioListenersSurvive(page)],
      ['touch', () => scenarioTouch(browser)],
      ['light mode chat', () => scenarioLightModeChat(browser)],
      ['reduced motion', () => scenarioReducedMotion(browser)],
    ]
    for (const [name, run] of scenarios) {
      try {
        await run()
      } catch (err) {
        check(`scenario “${name}” completed`, false, err.message)
      }
    }
    await context.close()
  } catch (err) {
    check('suite ran to completion', false, err.message)
  } finally {
    if (browser) await browser.close()
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  await cleanup(failed === 0 ? 0 : 1)
}

main()
