#!/usr/bin/env node
/* Throwaway runtime check for the "Read the case study" button: visible in
   the compact fold on an overflowing public slide, click eases the card to
   full expansion, button unmounts there, focus lands on the story heading.
   Covers the reduced-motion snap path too. */
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4799
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

const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
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

async function enterWorkSlide(context) {
  await context.addInitScript(() => {
    window.localStorage.setItem(
      'jh.analytics-consent',
      JSON.stringify({ decision: 'denied', decidedAt: Date.now() }),
    )
  })
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.primary-actions:not(.options-hidden):not(.options-inert)', {
    timeout: 30000,
  })
  await page.click('.primary-actions button:has-text("Work")')
  await page.waitForSelector('.work-experience', { timeout: 15000 })
  await sleep(1200)
  // Slide 1 (a project case study) is overflow-eligible; the intro is not.
  await page.click('button[aria-label="Next slide"]')
  await sleep(1200)
  return page
}

async function expansion(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.work-experience')
    return parseFloat(getComputedStyle(card).getPropertyValue('--work-expansion')) || 0
  })
}

async function run(browser, { reducedMotion = false } = {}) {
  const name = reducedMotion ? 'reduced-motion' : 'default'
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  })
  const page = await enterWorkSlide(context)

  const button = page.locator('.work-story-read')
  check(`${name}: button renders in the compact fold`, (await button.count()) === 1)
  check(`${name}: button is visible above the fold`, await button.isVisible())
  const label = await button.textContent()
  check(`${name}: button label`, /read the case study/i.test(label ?? ''), label)

  await button.click()
  await sleep(900) // 420ms ease + commit + settle
  const progress = await expansion(page)
  check(`${name}: click opens full expansion`, progress >= 0.99, `progress=${progress}`)
  check(`${name}: button unmounts at full expansion`, (await button.count()) === 0)
  const focused = await page.evaluate(() =>
    document.activeElement?.classList.contains('work-story-title'),
  )
  check(`${name}: focus moves to the story heading`, focused)

  await context.close()
}

async function main() {
  await waitForServer()
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    await run(browser)
    await run(browser, { reducedMotion: true })
  } finally {
    await browser.close()
    server.kill('SIGTERM')
  }
  console.log(failures === 0 ? '\nAll read-button checks passed.' : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  server.kill('SIGTERM')
  process.exit(1)
})
