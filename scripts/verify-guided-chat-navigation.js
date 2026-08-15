#!/usr/bin/env node
// =============================================================================
// Browser-level verification for the guided chat companion (docked panel /
// minimized resume bar / narrow modal overlay) and intentional Work source
// navigation.
//
// Drives the real site in headless Chrome (system install — no browser
// download) against `next dev`, stubbing POST /api/collaborate with a canned
// answer carrying curated `#work/<storyId>` source cards.
//
//   node scripts/verify-guided-chat-navigation.js [port]
//
// Covers (1440×900, 390×844, mobile landscape):
//   - source-card navigation: exact story/hash, desktop companion vs mobile
//     minimize, transcript/draft/heading/follow-ups/share survival
//   - companion expand/minimize/resume, page pop-out, nav-away docking,
//     Back/Forward, refresh canonicalization, viewport crossing (companion →
//     minimized, never a modal; widening never reopens)
//   - modified clicks and external/no-url sources keep native anchor behavior
//   - pending → "Thinking…", answer-while-minimized → "New answer"
//   - focus: work heading after navigation, resume control after minimizing,
//     modal containment + Escape + inert background
//   - minimized chrome shows title + status only (never transcript text)
//   - exposed canvas regions keep pointer input with the dock open
// =============================================================================

const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4741
const ORIGIN = `http://127.0.0.1:${PORT}`
const ROOT = path.resolve(__dirname, '..')

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const STORY = {
  ops: 'microsoft-global-operations',
  exp: 'microsoft-employee-experience',
  comp: 'microsoft-global-compensation',
}

const STUB_ANSWER = {
  heading: 'Guided navigation test conversation',
  answer:
    'Joel has led as a hands-on lead designer, owning UX and strategy while staying in the craft ' +
    'himself — developing architectural models and interactive prototypes, presenting at conference ' +
    'level, and aligning cross-functional teams around shared patterns rather than directing from a ' +
    'distance. This canned answer exists so automated verification can exercise the source cards.',
  sourceCards: [
    { id: 'src-ops', label: 'Global operations', url: `#work/${STORY.ops}` },
    { id: 'src-exp', label: 'Employee experience', url: `#work/${STORY.exp}` },
    { id: 'src-comp', label: 'Global compensation', url: `#work/${STORY.comp}` },
    { id: 'src-ext', label: 'External reference', url: 'https://example.com/case-study' },
    { id: 'src-nolink', label: 'Provenance only' },
  ],
  followUps: ['What has Joel shipped recently?', 'How does Joel stay hands-on?'],
  topic: 'leadership',
}

// --- tiny test harness ---------------------------------------------------------

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
const count = (page, sel) => page.locator(sel).count()
const visible = (page, sel) =>
  page
    .locator(sel)
    .first()
    .isVisible()
    .catch(() => false)
const hash = (page) => page.evaluate(() => window.location.hash)
const activeInfo = (page) =>
  page.evaluate(() => {
    const el = document.activeElement
    return {
      tag: el?.tagName ?? '',
      label: el?.getAttribute?.('aria-label') ?? '',
      inWork: !!el?.closest?.('.work-layout'),
      inOverlay: !!el?.closest?.('.guide-overlay'),
      isResume: !!el?.closest?.('.guide-resume-button'),
    }
  })

const seedConsent = (context) =>
  context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'jh.analytics-consent',
        JSON.stringify({ decision: 'denied', decidedAt: Date.now() }),
      )
    } catch {}
  })

const hideDevChrome = (page) =>
  page.addStyleTag({ content: '.tuning-panel,.dev-diagnostics{display:none!important}' })

/** Stub the guide endpoint. `slowRequest` (1-based) is delayed so pending
 *  states can be exercised across navigation. */
async function stubCollaborateApi(page, { slowRequest = 0, slowMs = 1200 } = {}) {
  let requests = 0
  await page.route('**/api/collaborate', async (route) => {
    requests += 1
    if (requests === slowRequest) await sleep(slowMs)
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_ANSWER),
    })
  })
}

/** Landing → start a conversation via the first starter → full chat page. */
async function startConversation(page) {
  await page.goto(`${ORIGIN}/#collaborate`, { waitUntil: 'domcontentloaded' })
  await hideDevChrome(page)
  await waitFor(async () => (await count(page, '.conversation-starter')) > 0, {
    label: 'conversation starters',
  })
  await page.locator('.conversation-starter').first().click()
  await waitFor(async () => (await visible(page, '.foreground-content-chat .chat-shell')), {
    label: 'chat page',
  })
  await waitFor(async () => (await count(page, '.guide-source')) === 4, {
    label: 'answer source cards (no-url card dropped)',
  })
}

const clickSource = (page, label, scope = '') =>
  page.locator(`${scope} .guide-source`, { hasText: label }).first().click()

// --- dev server -----------------------------------------------------------------

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

// --- scenarios --------------------------------------------------------------------

async function scenarioDesktop(browser) {
  section('Desktop 1440×900 — companion + source navigation')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await seedConsent(context)
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`))
  await stubCollaborateApi(page)
  await startConversation(page)

  check('chat page: 4 linked source cards (no-url card not rendered)', (await count(page, '.guide-source')) === 4)
  check(
    'chat page: header control is "Pop chat out"',
    (await page.locator('.chat-popout').getAttribute('aria-label')) === 'Pop chat out',
  )
  const pageHeading = await page.locator('.chat-heading').first().textContent()

  // Type a draft, then navigate via the Employee experience source card.
  await page.locator('.chat-input').fill('a draft that must survive')
  await clickSource(page, 'Employee experience')
  await waitFor(async () => (await hash(page)) === `#work/${STORY.exp}`, { label: 'work story hash' })
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion dock' })

  check('source navigation: hash is the exact story deep link', (await hash(page)) === `#work/${STORY.exp}`)
  check('source navigation: docked companion opens at ≥960px', await visible(page, '.guide-companion'))
  check('companion is a nonmodal complementary region', (await count(page, 'aside.guide-companion[role="complementary"]')) === 1)
  check('companion: heading survives', (await page.locator('.guide-companion .chat-heading').textContent()) === pageHeading)
  check('companion: transcript survives', (await count(page, '.guide-companion .chat-turn')) === 2)
  check(
    'companion: draft survives',
    (await page.locator('.guide-companion .chat-input').inputValue()) === 'a draft that must survive',
  )
  check('companion: follow-ups survive', (await count(page, '.guide-companion .guide-followup')) === 2)
  check('companion: share flow survives', (await count(page, '.guide-companion .guide-share')) === 1)
  check('minimized chrome stays hidden while docked', !(await visible(page, '.guide-resume')))
  check('focus moved into the Work surface after navigation', (await activeInfo(page)).inWork)
  check('companion width inside the 22–30rem dock contract', await page.evaluate(() => {
    const w = document.querySelector('.guide-companion').getBoundingClientRect().width
    return w >= 22 * 16 - 1 && w <= 30 * 16 + 1
  }))

  // Canvas: exposed regions still receive pointer input; the dock owns its bounds.
  const hit = await page.evaluate(() => {
    const exposed = document.elementFromPoint(200, 450)
    const dock = document.querySelector('.guide-companion').getBoundingClientRect()
    const covered = document.elementFromPoint(dock.left + dock.width / 2, dock.top + dock.height / 2)
    return {
      exposedCanvas: exposed?.tagName === 'CANVAS',
      coveredCanvas: covered?.tagName === 'CANVAS',
    }
  })
  check('exposed canvas region still receives pointer input', hit.exposedCanvas)
  check('canvas beneath the dock is covered by the dock', !hit.coveredCanvas)

  // Expand → full conversation; then pop out again via the header control.
  await page.locator('.guide-companion .chat-expand').click()
  await waitFor(async () => (await hash(page)) === '#collaborate/chat', { label: 'full chat hash' })
  await waitFor(async () => await visible(page, '.foreground-content-chat .chat-shell'), {
    label: 'full chat shell',
  })
  check('"Open full conversation" returns to #collaborate/chat', (await hash(page)) === '#collaborate/chat')
  check('full chat: transcript survives expand', (await count(page, '.foreground-content-chat .chat-turn')) === 2)
  const padBeforePopout = await page.evaluate(
    () => getComputedStyle(document.querySelector('.foreground-layer')).paddingRight,
  )
  await page.locator('.foreground-content-chat .chat-popout').click()
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion after pop-out' })
  check(
    '"Pop chat out" returns to the collaborate landing, docked',
    (await hash(page)) === '#collaborate' && (await visible(page, '.guide-companion')),
  )
  check(
    'companion overlaps content (no layout push)',
    (await page.evaluate(
      () => getComputedStyle(document.querySelector('.foreground-layer')).paddingRight,
    )) === padBeforePopout,
  )
  check(
    'companion animates down into place',
    (await page.evaluate(
      () => getComputedStyle(document.querySelector('.guide-companion')).animationName,
    )) === 'guide-companion-in',
  )

  // Minimize → compact pill with focus restored; resume reopens the dock.
  await page.locator('.guide-companion .chat-popout').click()
  await waitFor(async () => await visible(page, '.guide-resume'), { label: 'resume pill' })
  check('companion "Minimize" collapses to the resume pill', !(await visible(page, '.guide-companion')) && (await visible(page, '.guide-resume')))
  check('focus restored to the resume control after minimizing', (await activeInfo(page)).isResume)
  await page.locator('.guide-resume-button').click()
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion resumed' })
  check('resume pill reopens the docked companion on desktop', await visible(page, '.guide-companion'))

  // Viewport crossing: below 960px the dock minimizes (never a modal);
  // widening does not reopen it.
  await page.setViewportSize({ width: 900, height: 844 })
  await waitFor(async () => await visible(page, '.guide-resume'), { label: 'minimized after crossing' })
  check('crossing below 960px minimizes the open companion', !(await visible(page, '.guide-companion')))
  check('crossing below 960px never opens the modal', !(await visible(page, '.guide-overlay')))
  await page.setViewportSize({ width: 1440, height: 900 })
  await sleep(400)
  check('widening does not reopen a minimized chat', !(await visible(page, '.guide-companion')) && (await visible(page, '.guide-resume')))

  // Back from Work restores the full chat page; Forward returns to Work
  // without resurrecting the dock on its own.
  await page.locator('.guide-resume-button').click()
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion resumed (pre-expand)' })
  await page.locator('.guide-companion .chat-expand').click()
  await waitFor(async () => (await hash(page)) === '#collaborate/chat', { label: 'chat hash (pre-back)' })
  await clickSource(page, 'Global operations', '.foreground-content-chat')
  await waitFor(async () => (await hash(page)) === `#work/${STORY.ops}`, { label: 'ops story hash' })
  await page.goBack()
  await waitFor(async () => (await hash(page)) === '#collaborate/chat', { label: 'back to chat' })
  check('Back from Work restores the full chat page', await visible(page, '.foreground-content-chat .chat-shell') && !(await visible(page, '.guide-companion')))
  await page.goForward()
  await waitFor(async () => (await hash(page)) === `#work/${STORY.ops}`, { label: 'forward to work' })
  await waitFor(async () => await visible(page, '.work-experience'), { label: 'work surface after forward' })
  check('Forward returns to the Work story', true)

  // Leaving the full chat via the top nav docks the companion (desktop).
  await page.goBack()
  await waitFor(async () => await visible(page, '.foreground-content-chat .chat-shell'), { label: 'chat page (pre-nav)' })
  await page.locator('.experience-nav-button', { hasText: 'Work' }).click()
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion after nav-away' })
  check('leaving full chat via navigation retains the companion', (await hash(page)) === '#work' && (await visible(page, '.guide-companion')))

  // Refresh on #collaborate/chat canonicalizes to the landing (page memory only).
  await page.locator('.guide-companion .chat-expand').click()
  await waitFor(async () => (await hash(page)) === '#collaborate/chat', { label: 'chat hash (pre-reload)' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitFor(async () => (await hash(page)) === '#collaborate', { label: 'canonicalized hash' })
  await waitFor(async () => await visible(page, '.collaborate-experience'), {
    label: 'landing after canonicalization',
  })
  check('refresh on #collaborate/chat canonicalizes to #collaborate', true)
  check('landing shows after canonicalization (no in-memory turns)', true)

  await context.close()
}

async function scenarioCollaborateTabKeepsDock(browser) {
  section('Desktop — collaborate tab keeps the dock open')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await seedConsent(context)
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`))
  await stubCollaborateApi(page)
  await startConversation(page)

  // Dock over Work first, then press the Collaborate tab.
  await clickSource(page, 'Employee experience')
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion over work' })
  await page.locator('.experience-nav-button', { hasText: 'Collaborate' }).click()
  await waitFor(async () => (await hash(page)) === '#collaborate', { label: 'collaborate hash' })
  check('collaborate tab keeps the dock open', await visible(page, '.guide-companion'))
  await waitFor(async () => await visible(page, '.guide-preview'), { label: 'landing resume view' })
  check('landing shows the resume conversation view', true)
  check(
    'resume view carries the conversation heading',
    (await page.locator('.guide-preview-heading').textContent()) === 'Guided navigation test conversation',
  )

  // Continue interacting via the dock — sends stay docked over the landing.
  await page.locator('.guide-companion .chat-input').fill('still docked?')
  await page.locator('.guide-companion .chat-send').click()
  await waitFor(async () => (await count(page, '.guide-companion .chat-turn')) === 4, {
    label: 'docked answer over the landing',
  })
  check(
    'companion interaction continues over the landing',
    (await hash(page)) === '#collaborate' && (await visible(page, '.guide-companion')),
  )

  // Go full screen from the landing's resume control.
  await page.locator('.guide-preview-resume').click()
  await waitFor(async () => (await hash(page)) === '#collaborate/chat', { label: 'chat hash from landing resume' })
  check(
    'landing resume opens the full conversation',
    await visible(page, '.foreground-content-chat .chat-shell'),
  )

  // Dock again, then start a new chat from the landing: dock closes with it.
  await page.locator('.foreground-content-chat .chat-popout').click()
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion re-docked over landing' })
  await page.locator('button.guide-preview-new', { hasText: 'Start new conversation' }).click()
  await page.locator('button.guide-preview-new', { hasText: 'Yes, start new' }).click()
  await waitFor(async () => !(await visible(page, '.guide-preview')), { label: 'preview cleared' })
  check('start new closes the dock', !(await visible(page, '.guide-companion')))
  check('start new clears the resume view', true)

  await context.close()
}

async function scenarioModifiedAndExternal(browser) {
  section('Desktop — modified clicks / external sources stay native')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await seedConsent(context)
  const page = await context.newPage()
  await stubCollaborateApi(page)
  await startConversation(page)

  // Modified (cmd) click: the intercept must decline, leaving the anchor's
  // native behavior (a new tab, which headless suppresses) — so no in-app
  // navigation, no dock, no bar. dispatchEvent reports preventDefault.
  const modified = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.guide-source')].find((a) =>
      a.getAttribute('href')?.startsWith('#work/'),
    )
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true })
    card.dispatchEvent(ev)
    return { prevented: ev.defaultPrevented }
  })
  check('modified click: intercept declines (default not prevented)', modified.prevented === false)
  await sleep(500)
  check('modified click: no in-app navigation occurs', (await hash(page)) === '#collaborate/chat')
  check('modified click: no companion docks', !(await visible(page, '.guide-companion')))
  check('modified click: no minimized bar appears', !(await visible(page, '.guide-resume')))

  // Unmodified synthetic click: the intercept claims it (default prevented)
  // and drives the in-app navigation itself.
  const plain = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.guide-source')].find((a) =>
      a.getAttribute('href')?.startsWith('#work/'),
    )
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    card.dispatchEvent(ev)
    return { prevented: ev.defaultPrevented, href: card.getAttribute('href') }
  })
  check('unmodified click: intercept claims the navigation', plain.prevented === true)
  await waitFor(async () => (await hash(page)) === plain.href, { label: 'intercepted navigation' })
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion after intercept' })
  check('unmodified click: navigates to the story and docks', true)

  // External card: rendered with its href untouched.
  const external = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.guide-source')].find((a) =>
      a.getAttribute('href')?.startsWith('https://'),
    )
    return card ? card.getAttribute('href') : null
  })
  check('external source link rendered with href intact', external === 'https://example.com/case-study')
  await context.close()
}

async function scenarioPendingAndUnseen(browser) {
  section('Desktop — pending survives navigation; unseen answer flags the pill')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await seedConsent(context)
  const page = await context.newPage()
  await stubCollaborateApi(page, { slowRequest: 2, slowMs: 1500 })
  await startConversation(page)

  await clickSource(page, 'Global compensation')
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion dock' })
  check('pending flow: first answer docked with the companion', (await count(page, '.guide-companion .chat-turn')) === 2)

  // Send from the companion, then minimize while the (slow) answer is in flight.
  await page.locator('.guide-companion .chat-input').fill('a follow-up while docked')
  await page.locator('.guide-companion .chat-send').click()
  check('pending request visible inside the companion', await visible(page, '.guide-companion .guide-loading'))
  await page.locator('.guide-companion .chat-popout').click()
  await waitFor(async () => await visible(page, '.guide-resume'), { label: 'pill while pending' })
  check('minimized chrome shows pending status', (await page.locator('.guide-resume-status').textContent()) === 'Thinking…')

  await waitFor(async () => (await page.locator('.guide-resume-status').textContent()) === 'New answer', {
    label: 'unseen answer status',
    timeout: 20000,
  })
  check('answer arriving while minimized flags "New answer"', true)
  check('minimized chrome never shows transcript text', await page.evaluate(() => {
    const bar = document.querySelector('.guide-resume')
    return !!bar && !bar.textContent.includes('hands-on lead designer')
  }))

  await page.locator('.guide-resume-button').click()
  await waitFor(async () => await visible(page, '.guide-companion'), { label: 'companion after unseen' })
  check('reopened companion carries both exchanges', (await count(page, '.guide-companion .chat-turn')) === 4)
  check('status cleared after resume', (await count(page, '.guide-resume')) === 0)
  await context.close()
}

async function scenarioMobile(browser) {
  section('Mobile 390×844 — minimized bar + modal overlay')
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  await seedConsent(context)
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`))
  await stubCollaborateApi(page)
  await startConversation(page)

  check(
    'chat page: header control is "Minimize chat" on narrow screens',
    (await page.locator('.chat-popout').getAttribute('aria-label')) === 'Minimize chat',
  )

  // Minimize from the page, then open the modal from the bar.
  await page.locator('.chat-input').fill('mobile draft')
  await page.locator('.chat-popout').click()
  await waitFor(async () => await visible(page, '.guide-resume'), { label: 'resume bar' })
  check('minimize on narrow screens shows the bottom resume bar', (await hash(page)) === '#collaborate' && (await visible(page, '.guide-resume')))
  check('no modal opens unexpectedly on minimize', !(await visible(page, '.guide-overlay')))
  check('resume bar shows the guide title', (await page.locator('.guide-resume-title').textContent()) === 'Guided navigation test conversation')

  await page.locator('.guide-resume-button').tap()
  await waitFor(async () => await visible(page, '.guide-overlay'), { label: 'modal overlay' })
  check('resume bar tap opens the full-viewport modal', await visible(page, '.guide-overlay'))
  check('modal is an accessible dialog', (await count(page, '.guide-overlay[role="dialog"][aria-modal="true"]')) === 1)
  check('modal opens without changing the hash', (await hash(page)) === '#collaborate')
  check('modal preserves the draft', (await page.locator('.guide-overlay .chat-input').inputValue()) === 'mobile draft')
  check('background content is inert while the modal is open', await page.evaluate(
    () => document.getElementById('main-content')?.hasAttribute('inert') === true,
  ))

  // Focus containment: Tab never leaves the dialog. Wait for the overlay's
  // mount effect to place focus inside first (it also attaches the trap).
  await waitFor(async () => (await activeInfo(page)).inOverlay, { label: 'overlay initial focus' })
  let contained = true
  for (let i = 0; i < 18; i += 1) {
    await page.keyboard.press('Tab')
    if (!(await activeInfo(page)).inOverlay) contained = false
  }
  for (let i = 0; i < 18; i += 1) {
    await page.keyboard.press('Shift+Tab')
    if (!(await activeInfo(page)).inOverlay) contained = false
  }
  check('modal contains focus (Tab and Shift+Tab cycle inside)', contained)

  // Escape restores the bar and focus.
  await page.keyboard.press('Escape')
  await waitFor(async () => await visible(page, '.guide-resume'), { label: 'bar after Escape' })
  check('Escape restores the resume bar', !(await visible(page, '.guide-overlay')))
  check('Escape restores focus to the resume control', (await activeInfo(page)).isResume)
  check('background inert removed after Escape', await page.evaluate(
    () => document.getElementById('main-content')?.hasAttribute('inert') === false,
  ))

  // Source click from the overlay navigates and minimizes again.
  await page.locator('.guide-resume-button').tap()
  await waitFor(async () => await visible(page, '.guide-overlay'), { label: 'modal reopened' })
  await clickSource(page, 'Global compensation', '.guide-overlay')
  await waitFor(async () => (await hash(page)) === `#work/${STORY.comp}`, { label: 'story hash from overlay' })
  check('overlay source click navigates to the exact story', true)
  check('overlay source click minimizes back to the bar', !(await visible(page, '.guide-overlay')) && (await visible(page, '.guide-resume')))

  // The bar stays inside the viewport (safe-area-aware bottom band).
  const box = await page.locator('.guide-resume').boundingBox()
  check('resume bar sits inside the viewport bottom band', !!box && box.y + box.height <= 844 && box.y > 844 - 120)

  await context.close()
}

async function scenarioMobileLandscape(browser) {
  section('Mobile landscape 844×390 — minimized, never a dock')
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  })
  await seedConsent(context)
  const page = await context.newPage()
  await stubCollaborateApi(page)
  await startConversation(page)

  await clickSource(page, 'Global operations', '.foreground-content-chat')
  await waitFor(async () => (await hash(page)) === `#work/${STORY.ops}`, { label: 'story hash (landscape)' })
  await waitFor(async () => await visible(page, '.guide-resume'), { label: 'bar after landscape navigation' })
  check('landscape (<960px): source navigation minimizes', true)
  check('landscape: no docked companion below the breakpoint', !(await visible(page, '.guide-companion')))
  await page.locator('.guide-resume-button').tap()
  await waitFor(async () => await visible(page, '.guide-overlay'), { label: 'landscape modal' })
  check('landscape: resume opens the modal overlay', true)
  await page.keyboard.press('Escape')
  await waitFor(async () => await visible(page, '.guide-resume'), { label: 'landscape bar after Escape' })
  check('landscape: Escape restores the bar', true)
  await context.close()
}

async function scenarioThemeAndMotionSmoke(browser) {
  section('Light theme + reduced motion smoke')
  for (const [name, overrides] of [
    ['light theme', { colorScheme: 'light' }],
    ['reduced motion', { reducedMotion: 'reduce' }],
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...overrides })
    await seedConsent(context)
    const page = await context.newPage()
    await stubCollaborateApi(page)
    try {
      await startConversation(page)
      await clickSource(page, 'Employee experience')
      await waitFor(async () => await visible(page, '.guide-companion'), { label: `${name} companion` })
      await page.locator('.guide-companion .chat-popout').click()
      await waitFor(async () => await visible(page, '.guide-resume'), { label: `${name} pill` })
      await page.locator('.guide-resume-button').click()
      await waitFor(async () => await visible(page, '.guide-companion'), { label: `${name} resume` })
      check(`${name}: navigate → minimize → resume cycle works`, true)
    } catch (err) {
      check(`${name}: navigate → minimize → resume cycle works`, false, err.message)
    }
    await context.close()
  }
}

// --- main -------------------------------------------------------------------------

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

    const scenarios = [
      ['desktop companion', scenarioDesktop],
      ['collaborate tab keeps dock', scenarioCollaborateTabKeepsDock],
      ['modified/external sources', scenarioModifiedAndExternal],
      ['pending/unseen', scenarioPendingAndUnseen],
      ['mobile modal', scenarioMobile],
      ['mobile landscape', scenarioMobileLandscape],
      ['theme/motion smoke', scenarioThemeAndMotionSmoke],
    ]
    for (const [name, run] of scenarios) {
      try {
        await run(browser)
      } catch (err) {
        check(`scenario “${name}” completed`, false, err.message)
      }
    }
  } catch (err) {
    check('suite ran to completion', false, err.message)
  } finally {
    if (browser) await browser.close()
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  await cleanup(failed === 0 ? 0 : 1)
}

main()
