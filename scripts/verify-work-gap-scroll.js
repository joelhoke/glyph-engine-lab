#!/usr/bin/env node
/* Runtime verification for the Work-section GAP-scroll handoff
   (PortfolioExperience): wheel/touch gestures landing outside the card scrub
   the expansion first, then scroll the card content once expansion
   saturates; upward gestures scroll the content back to its top before
   contracting. Covers both directions, touch, and the reduced-motion snap
   path. Complements scripts/dev/work-visual-smoke.js (which covers the
   in-card machine). */
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4741
const URL = `http://localhost:${PORT}/`
const ROOT = path.join(__dirname, '..')

let failures = 0
function check(label, condition, detail = '') {
  if (condition) console.log(`PASS  ${label}`)
  else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
    failures += 1
  }
}

const server = process.env.SKIP_SERVER
  ? null
  : spawn('npx', ['next', 'dev', '-p', String(PORT)], {
      cwd: ROOT,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

function waitForServer(timeoutMs = 180000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(URL, (res) => {
          res.resume()
          resolve()
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) reject(new Error('server timeout'))
          else setTimeout(tick, 1000)
        })
    }
    tick()
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The consent banner overlays the stacked landing actions on narrow
// viewports and would intercept Playwright's clicks — pre-seed a "denied"
// decision (engine/analytics CONSENT_STORAGE_KEY format) so it never shows.
async function seedConsentDenied(context) {
  await context.addInitScript(() => {
    window.localStorage.setItem(
      'jh.analytics-consent',
      JSON.stringify({ decision: 'denied', decidedAt: Date.now() }),
    )
  })
}

async function enterWork(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.primary-actions:not(.options-hidden):not(.options-inert)', {
    timeout: 30000,
  })
  // The Work entry point is a pill on main and a doorway card on the
  // redesign branch — either way it's the first button in the actions group.
  await page.click('.primary-actions button:has-text("Work")')
  await page.waitForSelector('.work-experience', { timeout: 15000 })
  await sleep(1200)
  // Slide 1 (Global Operations) is overflow-eligible; the intro is not.
  await page.click('button[aria-label="Next slide"]')
  await sleep(1200)
}

function scrubState(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.work-experience')
    const viewport = document.querySelector('.work-experience-viewport')
    return {
      progress: parseFloat(getComputedStyle(card).getPropertyValue('--work-expansion')) || 0,
      scrollTop: viewport.scrollTop,
    }
  })
}

/** The scrub denominator the card reports (see work-visual-smoke.js). */
async function measureRangePx(page, mobile) {
  return page.evaluate((isMobile) => {
    const card = document.querySelector('.work-experience')
    const expandedTop = isMobile ? 0 : 64
    const travel = card.getBoundingClientRect().top - expandedTop
    return Math.max(travel * (isMobile ? 0.48 : 1), 96)
  }, mobile)
}

/** A gap point outside the card and the glyph region (bottom-left corner). */
async function gapWheel(page, deltaY, vh) {
  await page.mouse.move(20, vh - 20)
  await page.mouse.wheel(0, deltaY)
  await sleep(300) // rAF commit + layout
}

// --- desktop wheel -----------------------------------------------------------

async function runDesktopWheel(browser, { reducedMotion = false } = {}) {
  const name = reducedMotion ? 'desktop-reduced' : 'desktop'
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  })
  await seedConsentDenied(context)
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`))
  const vh = 900

  await enterWork(page)
  const rangePx = await measureRangePx(page, false)

  // (a) Wheel in the gap past full expansion → the excess scrolls content.
  await gapWheel(page, rangePx * 1.4, vh)
  let state = await scrubState(page)
  check(`${name}: gap wheel expands to 1`, state.progress === 1, `progress=${state.progress}`)
  if (reducedMotion) {
    check(
      `${name}: the snap consumes the first gesture (no content scroll yet)`,
      state.scrollTop <= 1,
      `scrollTop=${state.scrollTop}`,
    )
    await gapWheel(page, rangePx * 0.4, vh)
    state = await scrubState(page)
  }
  check(
    `${name}: gap wheel past saturation scrolls the card content`,
    state.progress === 1 && state.scrollTop > 1,
    `progress=${state.progress} scrollTop=${state.scrollTop}`,
  )
  const scrolled = state.scrollTop

  // More gap wheeling keeps scrolling the content.
  await gapWheel(page, 120, vh)
  state = await scrubState(page)
  check(
    `${name}: continued gap wheeling accumulates content scroll`,
    state.progress === 1 && state.scrollTop > scrolled,
    `scrollTop=${state.scrollTop} was=${scrolled}`,
  )

  // (b) Wheel up in the gap: content scrolls back first, then contraction.
  await gapWheel(page, -state.scrollTop / 2, vh)
  state = await scrubState(page)
  check(
    `${name}: upward gap wheel scrolls content before contracting`,
    state.progress === 1 && state.scrollTop > 1,
    `progress=${state.progress} scrollTop=${state.scrollTop}`,
  )
  await gapWheel(page, -(state.scrollTop + rangePx * 0.3), vh)
  state = await scrubState(page)
  if (reducedMotion) {
    check(
      `${name}: crossing the content top snaps shut`,
      state.scrollTop <= 1 && state.progress === 0,
      `progress=${state.progress} scrollTop=${state.scrollTop}`,
    )
  } else {
    check(
      `${name}: crossing the content top contracts with the remainder`,
      state.scrollTop <= 1 && state.progress < 1 && state.progress > 0,
      `progress=${state.progress} scrollTop=${state.scrollTop}`,
    )
    check(
      `${name}: contraction consumed ≈0.3 of the range`,
      Math.abs(state.progress - 0.7) < 0.08,
      `progress=${state.progress}`,
    )
  }

  // Full reverse returns to compact.
  await gapWheel(page, -rangePx * 1.2, vh)
  state = await scrubState(page)
  check(
    `${name}: full reverse returns to compact`,
    state.progress === 0 && state.scrollTop <= 1,
    `progress=${state.progress} scrollTop=${state.scrollTop}`,
  )

  await context.close()
}

// --- mobile touch ------------------------------------------------------------

async function runMobileTouch(browser) {
  const name = 'mobile-touch'
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  await seedConsentDenied(context)
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`))

  await enterWork(page)
  const rangePx = await measureRangePx(page, true)

  // (c) One uninterrupted gap drag: expansion completes, then the remaining
  // distance scrolls the card content; reversing the SAME gesture scrolls
  // back to the top and contracts.
  const start = { x: 20, y: 824 }
  const distance = rangePx * 1.5
  const steps = 12
  const cdp = await page.context().newCDPSession(page)
  const dispatch = (type, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: start.x, y, id: 1 }],
    })
  await dispatch('touchStart', start.y)
  for (let i = 1; i <= steps; i += 1) {
    await dispatch('touchMove', start.y - (distance * i) / steps)
    await sleep(50)
  }
  await sleep(300)
  let state = await scrubState(page)
  check(
    `${name}: gap drag past full expansion scrolls the content`,
    state.progress === 1 && state.scrollTop > 1,
    `progress=${state.progress} scrollTop=${state.scrollTop} range=${rangePx}`,
  )

  // Reverse within the same gesture, but only partway through the scrolled
  // portion (dy stays beyond the expansion range): the content scrolls back
  // while progress holds at 1.
  await dispatch('touchMove', start.y - rangePx * 1.25)
  await sleep(300)
  state = await scrubState(page)
  check(
    `${name}: reversing the gesture scrolls content back (progress stays 1)`,
    state.progress === 1 && state.scrollTop > 1,
    `progress=${state.progress} scrollTop=${state.scrollTop}`,
  )

  // Reverse all the way to the gesture start: top reached, then compact.
  for (let i = 1; i <= steps; i += 1) {
    await dispatch('touchMove', start.y - rangePx * 1.25 + (rangePx * 1.25 * i) / steps)
    await sleep(50)
  }
  await sleep(300)
  state = await scrubState(page)
  check(
    `${name}: full reverse returns to the gesture-start state (compact)`,
    state.progress < 0.05 && state.scrollTop <= 1,
    `progress=${state.progress} scrollTop=${state.scrollTop}`,
  )
  await dispatch('touchEnd')
  await sleep(300)

  await context.close()
}

async function main() {
  if (server) await waitForServer()
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    await runDesktopWheel(browser)
    await runDesktopWheel(browser, { reducedMotion: true })
    await runMobileTouch(browser)
  } finally {
    await browser.close()
    server?.kill('SIGTERM')
  }
  console.log(failures === 0 ? '\nAll gap-scroll checks passed.' : `\n${failures} gap-scroll check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  server?.kill('SIGTERM')
  process.exit(1)
})
