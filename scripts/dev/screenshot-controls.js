// One-off visual check: screenshot the new vibe controls against the static
// preview server (http://127.0.0.1:4173). Not part of the verify suite.
const { chromium } = require('playwright-core')

const ORIGIN = 'http://127.0.0.1:4173'
const OUT = 'tmp-media/controls-check.png'

async function main() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'jh.analytics-consent',
        JSON.stringify({ decision: 'denied', decidedAt: Date.now() }),
      )
    } catch {}
  })
  const page = await context.newPage()
  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    window.location.hash = '#vibe'
  })
  await page.waitForSelector('.vibe-cta', { timeout: 30000 })
  await page.click('.vibe-cta')
  await page.waitForSelector('.vibe-toolbar', { timeout: 15000 })
  // Expand sound and pond
  await page.click('.vibe-sound-toggle')
  await page.waitForSelector('.vibe-sound-pill')
  await page.click('.vibe-pond-toggle')
  await page.waitForSelector('.vibe-pond-pill')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: OUT, fullPage: false })
  // Zoomed crops of the two controls
  const sound = await page.locator('.vibe-sound-control').boundingBox()
  const pond = await page.locator('.vibe-pond-control').boundingBox()
  if (sound) {
    await page.screenshot({
      path: 'tmp-media/controls-sound.png',
      clip: {
        x: Math.max(0, sound.x - 12),
        y: Math.max(0, sound.y - 12),
        width: sound.width + 24,
        height: sound.height + 24,
      },
    })
  }
  if (pond) {
    await page.screenshot({
      path: 'tmp-media/controls-pond.png',
      clip: {
        x: Math.max(0, pond.x - 12),
        y: Math.max(0, pond.y - 12),
        width: pond.width + 24,
        height: pond.height + 24,
      },
    })
  }
  // sanity: is the pond actually enabled in the canvas? check body class or
  // just report that the pill rendered
  console.log('sound box', sound)
  console.log('pond box', pond)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
