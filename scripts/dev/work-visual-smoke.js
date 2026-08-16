/* Visual + behavioral smoke test for the Work scroll-scrubbed expansion.
   Asserts the runtime scrub contract (expansion-range mapping, absolute
   touch-drag progress, reversal, overflow gating, mobile edge-to-edge, nav
   layering, fixed footer, inline image sizing, per-slide hero fit) and
   captures compact screenshots of all four slides for manual review. */
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4739
const URL = `http://localhost:${PORT}/?debug=true`
const ROOT = path.join(__dirname, '..', '..')
const OUT = path.join(ROOT, 'tmp-work-visual')

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

async function enterWork(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: '.tuning-panel,.dev-diagnostics{display:none!important}' })
  await page.waitForSelector('.primary-actions:not(.options-hidden):not(.options-inert)', {
    timeout: 30000,
  })
  await page.click('.primary-action-button >> text=Work')
  await page.waitForSelector('.work-experience', { timeout: 15000 })
  await sleep(1200)
}

/** Read the current scrub state from the live DOM. */
function scrubState(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.work-experience')
    const viewport = document.querySelector('.work-experience-viewport')
    const footer = document.querySelector('.bounded-scroll-footer')
    const content = document.querySelector('.work-experience-content')
    const rect = card.getBoundingClientRect()
    return {
      progress: parseFloat(getComputedStyle(card).getPropertyValue('--work-expansion')) || 0,
      position: getComputedStyle(card).position,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      scrollTop: viewport.scrollTop,
      footer: footer ? footer.getBoundingClientRect().toJSON() : null,
      contentBottom: content ? content.getBoundingClientRect().bottom : null,
      progressText: document.querySelector('.work-progress')?.textContent?.trim(),
    }
  })
}

/** The scrub denominator the card reports: (compactCardTop - expandedCardTop)
 *  — shortened to 48% on mobile — clamped like the app (safe-area insets are
 *  0 in headless Chrome). */
async function measureRangePx(page, mobile) {
  return page.evaluate((isMobile) => {
    const card = document.querySelector('.work-experience')
    const expandedTop = isMobile ? 0 : 64
    const travel = card.getBoundingClientRect().top - expandedTop
    return Math.max(travel * (isMobile ? 0.48 : 1), 96)
  }, mobile)
}

async function wheelOverCard(page, deltaY) {
  const box = await page.evaluate(() => {
    const r = document.querySelector('.work-experience-viewport').getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 200) }
  })
  await page.mouse.move(box.x, box.y)
  await page.mouse.wheel(0, deltaY)
  await sleep(250) // rAF commit + layout
}

/** A single uninterrupted touch drag upward by `distance` px over the card
 *  viewport (CDP touch events; the viewport owns the touch scrub). */
async function touchDragUp(page, distance, { steps = 10, holdMs = 60 } = {}) {
  const box = await page.evaluate(() => {
    const r = document.querySelector('.work-experience-viewport').getBoundingClientRect()
    return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom }
  })
  const startY = Math.min(box.bottom - 24, box.top + distance + 24)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x, y: startY, id: 1 }],
  })
  const points = []
  for (let i = 1; i <= steps; i += 1) {
    const y = startY - (distance * i) / steps
    points.push({ x: box.x, y, id: 1 })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x, y, id: 1 }] })
    await sleep(holdMs)
  }
  return { cdp, startY, points }
}

async function touchEnd(cdp) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await sleep(300)
}

/** Assert the active slide's hero fit + target region via the ?debug=true
 *  surface (window.__workHero), against the measured glyph stage. */
async function checkHeroFit(page, name, slideLabel, expectedFit) {
  const info = await page.evaluate(() => {
    const hero = window.__workHero
    const s = document.querySelector('.work-glyph-stage').getBoundingClientRect()
    return {
      hero,
      stage: { left: s.left, top: s.top, width: s.width, height: s.height },
      vw: window.visualViewport?.width ?? window.innerWidth,
      vh: window.visualViewport?.height ?? window.innerHeight,
    }
  })
  check(
    `${name}: ${slideLabel} uses ${expectedFit} hero fit`,
    !!info.hero && info.hero.fit === expectedFit,
    JSON.stringify(info.hero),
  )
  const region = info.hero && info.hero.region
  if (!region) {
    check(`${name}: ${slideLabel} has a measured target region`, false, 'region=null')
    return
  }
  if (expectedFit === 'viewport') {
    const expected = {
      x: info.stage.left + info.stage.width / 2 - info.vw / 2,
      y: info.stage.top + info.stage.height / 2 - info.vh / 2,
    }
    check(
      `${name}: ${slideLabel} keeps viewport-sized bounds centered on the stage`,
      Math.abs(region.width - info.vw) < 2 &&
        Math.abs(region.height - info.vh) < 2 &&
        Math.abs(region.x - expected.x) < 2 &&
        Math.abs(region.y - expected.y) < 2,
      JSON.stringify({ region, expected, vw: info.vw, vh: info.vh }),
    )
  } else if (expectedFit === 'balanced') {
    const vp = {
      x: info.stage.left + info.stage.width / 2 - info.vw / 2,
      y: info.stage.top + info.stage.height / 2 - info.vh / 2,
    }
    const expected = {
      x: (info.stage.left + vp.x) / 2,
      y: (info.stage.top + vp.y) / 2,
      width: (info.stage.width + info.vw) / 2,
      height: (info.stage.height + info.vh) / 2,
    }
    check(
      `${name}: ${slideLabel} balanced bounds sit halfway between stage and viewport`,
      Math.abs(region.x - expected.x) < 2 &&
        Math.abs(region.y - expected.y) < 2 &&
        Math.abs(region.width - expected.width) < 2 &&
        Math.abs(region.height - expected.height) < 2,
      JSON.stringify({ region, expected }),
    )
    check(
      `${name}: ${slideLabel} hero is larger than stage fit, smaller than viewport fit`,
      region.height > info.stage.height + 4 && region.height < info.vh - 4,
      `height=${region.height} stage=${info.stage.height} viewport=${info.vh}`,
    )
  } else {
    check(
      `${name}: ${slideLabel} target region is the measured stage rect`,
      Math.abs(region.x - info.stage.left) < 2 &&
        Math.abs(region.y - info.stage.top) < 2 &&
        Math.abs(region.width - info.stage.width) < 2 &&
        Math.abs(region.height - info.stage.height) < 2,
      JSON.stringify({ region, stage: info.stage }),
    )
  }
}

/** Compact screenshots of all four slides (+ hero-fit assertions). Navigates
 *  forward from the intro; the caller must be on slide 0 at progress 0. */
async function captureCompactSlides(page, name) {
  const fits = ['viewport', 'balanced', 'balanced', 'balanced']
  const labels = ['Microsoft intro', 'Global Operations', 'Employee Experience', 'Global Compensation']
  for (let i = 0; i < 4; i += 1) {
    await checkHeroFit(page, name, labels[i], fits[i])
    await page.screenshot({ path: path.join(OUT, `${name}-slide-${i}-compact.png`) })
    if (i < 3) {
      await page.click('button[aria-label="Next slide"]')
      await sleep(1200)
    }
  }
}

async function runViewport(browser, name, viewport, mobile, { compactOnly = false } = {}) {
  const context = await browser.newContext(
    mobile ? { viewport, hasTouch: true, isMobile: true } : { viewport },
  )
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`))
  const vh = viewport.height

  await enterWork(page)

  // --- intro slide is not expandable: progress pinned to 0 ----------------
  await wheelOverCard(page, vh)
  let state = await scrubState(page)
  check(`${name}: Microsoft intro stays at 0 (not overflow-eligible)`, state.progress === 0 && state.position !== 'fixed', `progress=${state.progress} pos=${state.position}`)

  if (compactOnly) {
    await captureCompactSlides(page, name)
    await context.close()
    return
  }

  // --- first case study: compact baseline + range measurement -------------
  await checkHeroFit(page, name, 'Microsoft intro', 'viewport')
  await page.screenshot({ path: path.join(OUT, `${name}-slide-0-compact.png`) })
  await page.click('button[aria-label="Next slide"]')
  await sleep(1200)
  state = await scrubState(page)
  const compact = state.rect
  check(`${name}: slide change resets progress`, state.progress === 0, `progress=${state.progress}`)
  await checkHeroFit(page, name, 'Global Operations', 'balanced')
  await page.screenshot({ path: path.join(OUT, `${name}-slide-1-compact.png`) })
  // Compact fold: the Outcome section starts at/below the visible content
  // edge — the compact card shows title + thesis + meta only.
  const fold = await page.evaluate(() => {
    const section = document.querySelector('.work-story-section')
    const viewport = document.querySelector('.work-experience-viewport')
    if (!section || !viewport) return null
    return {
      sectionTop: section.getBoundingClientRect().top,
      foldY: viewport.getBoundingClientRect().bottom,
    }
  })
  check(
    `${name}: compact state pushes Outcome below the fold`,
    !!fold && fold.sectionTop >= fold.foldY - 1,
    JSON.stringify(fold),
  )
  const rangePx = await measureRangePx(page, mobile)

  // --- half the range → ≈0.5, no content scroll ---------------------------
  await wheelOverCard(page, rangePx * 0.5)
  state = await scrubState(page)
  const targetWidth = mobile ? viewport.width : Math.min(960, viewport.width - 64)
  check(`${name}: half-range input → progress ≈ 0.5`, Math.abs(state.progress - 0.5) < 0.08, `progress=${state.progress} range=${rangePx}`)
  if (mobile) {
    check(
      `${name}: intermediate width between compact and expanded`,
      state.rect.width > compact.width + 2 && state.rect.width < targetWidth - 2,
      `width=${state.rect.width} compact=${compact.width} target=${targetWidth}`,
    )
  } else {
    check(
      `${name}: desktop width/position unchanged at 50% (only top+height interpolate)`,
      Math.abs(state.rect.width - compact.width) < 2 &&
        Math.abs(state.rect.left - compact.left) < 2 &&
        state.rect.top < compact.top - 2 &&
        state.rect.height > compact.height + 2,
      JSON.stringify({ rect: state.rect, compact }),
    )
  }
  check(`${name}: content does not scroll until expansion completes`, state.scrollTop <= 1, `scrollTop=${state.scrollTop}`)
  await page.screenshot({ path: path.join(OUT, `${name}-scrub-50.png`) })

  // --- reversing the input reverses progress directly ----------------------
  await wheelOverCard(page, -rangePx * 0.5)
  state = await scrubState(page)
  check(`${name}: reversing half the range returns to compact`, state.progress === 0 && state.position !== 'fixed', `progress=${state.progress}`)

  // --- one range of accumulated input maps 0 → 1 exactly -------------------
  await wheelOverCard(page, rangePx)
  state = await scrubState(page)
  check(`${name}: one expansion range of input maps 0 → 1`, state.progress >= 0.99, `progress=${state.progress} range=${rangePx}`)
  check(`${name}: exact-range input leaves no excess scroll`, state.scrollTop <= 1, `scrollTop=${state.scrollTop}`)
  const expanded = state.rect
  if (mobile) {
    check(
      `${name}: mobile expansion reaches the viewport edges`,
      Math.abs(state.rect.left) < 1 &&
        Math.abs(state.rect.top) < 1 &&
        Math.abs(state.rect.width - viewport.width) < 2 &&
        Math.abs(state.rect.height - viewport.height) < 2,
      JSON.stringify(state.rect),
    )
  } else {
    check(
      `${name}: desktop expansion reaches min(60rem, 100vw-4rem)`,
      Math.abs(state.rect.width - Math.min(960, viewport.width - 64)) < 2,
      `width=${state.rect.width}`,
    )
    check(
      `${name}: desktop width/position identical at 0% and 100%`,
      Math.abs(state.rect.width - compact.width) < 2 && Math.abs(state.rect.left - compact.left) < 2,
      JSON.stringify({ rect: state.rect, compact }),
    )
  }

  // --- input past 100% scrolls the content ---------------------------------
  await wheelOverCard(page, rangePx * 0.4)
  state = await scrubState(page)
  check(`${name}: unused delta scrolled content after completion`, state.progress === 1 && state.scrollTop > 1, `progress=${state.progress} scrollTop=${state.scrollTop}`)
  await page.screenshot({ path: path.join(OUT, `${name}-expanded.png`) })

  // --- navigation stays layered above the expanded panel -------------------
  const navHit = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.experience-nav-button')]
    const button = buttons[Math.floor(buttons.length / 2)]
    if (!button) return null
    const r = button.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { visible: r.width > 0 && r.height > 0, onTop: !!el && !!el.closest('.experience-nav') }
  })
  check(
    `${name}: navigation renders above the expanded card`,
    !!navHit && navHit.visible && navHit.onTop,
    JSON.stringify(navHit),
  )

  // --- footer: visible, pinned, never covering final content ---------------
  let footerOk = state.footer && state.footer.bottom <= state.rect.bottom + 1 && state.footer.top >= state.rect.top
  check(`${name}: footer visible inside card while expanded+scrolled`, !!footerOk, JSON.stringify(state.footer))
  await page.evaluate(() => {
    const v = document.querySelector('.work-experience-viewport')
    v.scrollTop = v.scrollHeight
  })
  await sleep(400)
  state = await scrubState(page)
  check(
    `${name}: footer still visible at story bottom; final content clears it`,
    !!state.footer &&
      state.footer.bottom <= state.rect.bottom + 1 &&
      state.contentBottom <= state.footer.top + 1,
    `footer=${JSON.stringify(state.footer)} contentBottom=${state.contentBottom}`,
  )
  await page.screenshot({ path: path.join(OUT, `${name}-expanded-bottom.png`) })

  // --- upward input scrolls content first, then contracts ------------------
  await wheelOverCard(page, -rangePx * 0.3)
  state = await scrubState(page)
  check(`${name}: upward input scrolls content (progress stays 1)`, state.progress === 1, `progress=${state.progress} scrollTop=${state.scrollTop}`)
  await page.evaluate(() => {
    document.querySelector('.work-experience-viewport').scrollTop = 0
  })
  await sleep(200)
  await wheelOverCard(page, -rangePx * 0.4)
  state = await scrubState(page)
  check(`${name}: at top, upward input contracts (progress ≈ 0.6)`, Math.abs(state.progress - 0.6) < 0.08, `progress=${state.progress}`)
  check(
    `${name}: contraction reverses geometry smoothly`,
    mobile
      ? state.rect.width < targetWidth - 10 && state.rect.width > compact.width + 10
      : state.rect.height < expanded.height - 10 && state.rect.height > compact.height + 10,
    JSON.stringify({ rect: state.rect, compact, expanded }),
  )
  await wheelOverCard(page, -rangePx)
  state = await scrubState(page)
  check(`${name}: full reverse returns to compact`, state.progress === 0 && state.position !== 'fixed', `progress=${state.progress}`)

  // --- viewport changes recompute geometry without resetting progress ------
  await wheelOverCard(page, rangePx * 1.2) // expand again (over-input clamps to exactly 1)
  await page.evaluate(() => {
    document.querySelector('.work-experience-viewport').scrollTop = 0
  })
  await sleep(200)
  state = await scrubState(page)
  check(`${name}: re-expanded before viewport change`, state.progress === 1, `progress=${state.progress}`)
  if (mobile) {
    // Browser-chrome collapse: shorter viewport, progress must survive.
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 160 })
    await sleep(500)
    state = await scrubState(page)
    check(
      `${name}: browser-chrome change keeps progress and recomputes edges`,
      state.progress === 1 && Math.abs(state.rect.height - (viewport.height - 160)) < 3,
      `progress=${state.progress} height=${state.rect.height}`,
    )
    await page.setViewportSize({ width: viewport.height, height: viewport.width }) // landscape
    await sleep(500)
    state = await scrubState(page)
    check(
      `${name}: orientation change keeps progress and recomputes geometry`,
      state.progress === 1 && Math.abs(state.rect.width - Math.min(960, viewport.height - 64)) < 3,
      `progress=${state.progress} width=${state.rect.width}`,
    )
    await page.setViewportSize(viewport) // restore portrait mobile
    await sleep(500)
  } else {
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 200 })
    await sleep(500)
    state = await scrubState(page)
    const expectedWidth = Math.min(960, viewport.width - 64)
    check(
      `${name}: viewport resize keeps progress and recomputes geometry`,
      state.progress === 1 && Math.abs(state.rect.width - expectedWidth) < 3,
      `progress=${state.progress} width=${state.rect.width}`,
    )
    await page.setViewportSize(viewport)
    await sleep(500)
  }
  // Back to compact for the remaining checks.
  await page.evaluate(() => {
    document.querySelector('.work-experience-viewport').scrollTop = 0
  })
  await wheelOverCard(page, -rangePx * 1.2)
  state = await scrubState(page)
  check(`${name}: compact again after viewport-change checks`, state.progress === 0, `progress=${state.progress}`)

  // --- gap + glyph-region gestures (tested at compact, where the stage is
  // exposed — a grown card legitimately covers it) --------------------------
  const stageBox = await page.evaluate(() => {
    const r = document.querySelector('.work-glyph-stage').getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await page.mouse.move(stageBox.x, stageBox.y)
  await page.mouse.wheel(0, rangePx * 0.5)
  await sleep(300)
  state = await scrubState(page)
  check(`${name}: wheel over glyph region does not scrub (stays compact)`, state.progress === 0, `progress=${state.progress}`)

  await page.mouse.move(20, viewport.height - 20)
  await page.mouse.wheel(0, rangePx * 0.5)
  await sleep(300)
  state = await scrubState(page)
  check(`${name}: gap wheel scrubs against the same range (≈0.5)`, Math.abs(state.progress - 0.5) < 0.1, `progress=${state.progress}`)
  await page.mouse.wheel(0, -rangePx * 0.5)
  await sleep(300)

  // --- touch: one uninterrupted drag across the range scrubs 0 → 1 ---------
  if (mobile) {
    await page.evaluate(() => {
      document.querySelector('.work-experience-viewport').scrollTop = 0
    })
    await wheelOverCard(page, -rangePx) // ensure compact
    const drag = await touchDragUp(page, rangePx)
    state = await scrubState(page)
    check(
      `${name}: one uninterrupted drag of 48% travel maps 0 → 1`,
      state.progress >= 0.99 && state.scrollTop <= 1,
      `progress=${state.progress} scrollTop=${state.scrollTop}`,
    )
    // Reverse inside the SAME gesture: back to the start point → compact.
    for (let i = drag.points.length - 1; i >= 0; i -= 1) {
      const p = drag.points[i]
      await drag.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] })
      await sleep(40)
    }
    await drag.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: drag.points[0].x, y: drag.startY, id: 1 }],
    })
    await sleep(300)
    state = await scrubState(page)
    check(
      `${name}: reversing mid-gesture reverses progress (back to ≈0)`,
      state.progress < 0.05,
      `progress=${state.progress}`,
    )
    await touchEnd(drag.cdp)
    // Half-range drag (= 32% of travel on mobile) → ≈0.5.
    const half = await touchDragUp(page, rangePx * 0.5)
    state = await scrubState(page)
    check(`${name}: half-range drag → progress ≈ 0.5`, Math.abs(state.progress - 0.5) < 0.08, `progress=${state.progress}`)
    await touchEnd(half.cdp)
    // A fresh drag from the half-expanded state continues from 0.5 → 1.
    const rest = await touchDragUp(page, rangePx * 0.6)
    state = await scrubState(page)
    check(
      `${name}: a new drag resumes from the gesture-start progress (→ 1)`,
      state.progress >= 0.99,
      `progress=${state.progress}`,
    )
    await touchEnd(rest.cdp)
    await page.evaluate(() => {
      document.querySelector('.work-experience-viewport').scrollTop = 0
    })
    await wheelOverCard(page, -rangePx * 1.2) // compact for the slide loop
    await sleep(200)
  }

  // --- inline image sizing (Employee Experience slide has images) ----------
  await page.click('button[aria-label="Next slide"]') // → Employee Experience
  await sleep(1200)
  await checkHeroFit(page, name, 'Employee Experience', 'balanced')
  await page.screenshot({ path: path.join(OUT, `${name}-slide-2-compact.png`) })
  const rangePx2 = await measureRangePx(page, mobile)
  await wheelOverCard(page, rangePx2 * 0.5)
  await page.screenshot({ path: path.join(OUT, `${name}-slide-2-half.png`) })
  await wheelOverCard(page, rangePx2 * 0.7) // fully expand
  const imageWidth = await page.evaluate(() => {
    const figure = document.querySelector('.work-inline-media--image')
    const content = document.querySelector('.work-experience-content')
    if (!figure || !content) return null
    return figure.getBoundingClientRect().width / content.getBoundingClientRect().width
  })
  if (mobile) {
    check(`${name}: mobile inline image uses full content width`, imageWidth !== null && imageWidth > 0.95, `ratio=${imageWidth}`)
  } else {
    check(`${name}: desktop inline image ≈ 40% of content width`, imageWidth !== null && Math.abs(imageWidth - 0.4) < 0.03, `ratio=${imageWidth}`)
  }
  await page.screenshot({ path: path.join(OUT, `${name}-images.png`) })

  // --- final slide: compact/half/expanded captures + balanced fit ----------
  await page.evaluate(() => {
    document.querySelector('.work-experience-viewport').scrollTop = 0
  })
  await wheelOverCard(page, -rangePx2 * 1.2)
  await page.click('button[aria-label="Next slide"]') // → Global Compensation
  await sleep(1200)
  await checkHeroFit(page, name, 'Global Compensation', 'balanced')
  await page.screenshot({ path: path.join(OUT, `${name}-slide-3-compact.png`) })
  const rangePx3 = await measureRangePx(page, mobile)
  await wheelOverCard(page, rangePx3 * 0.5)
  await page.screenshot({ path: path.join(OUT, `${name}-slide-3-half.png`) })
  await wheelOverCard(page, rangePx3 * 0.7)
  await page.screenshot({ path: path.join(OUT, `${name}-slide-3-expanded.png`) })

  await context.close()
}

async function main() {
  require('node:fs').rmSync(OUT, { recursive: true, force: true })
  require('node:fs').mkdirSync(OUT, { recursive: true })
  if (server) await waitForServer()
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    await runViewport(browser, 'desktop', { width: 1440, height: 900 }, false)
    await runViewport(browser, 'mobile', { width: 390, height: 844 }, true)
    await runViewport(browser, 'mobile-tall', { width: 430, height: 932 }, true, {
      compactOnly: true,
    })
  } finally {
    await browser.close()
    server?.kill('SIGTERM')
  }
  console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} smoke check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  server?.kill('SIGTERM')
  process.exit(1)
})
