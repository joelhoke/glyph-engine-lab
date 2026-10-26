const assert = require('node:assert/strict')
const { chromium } = require('playwright-core')
const base = process.env.GALLERY_PREVIEW_URL || 'http://127.0.0.1:8788'
const droplet = process.env.DROPLET_PREVIEW_ORIGIN || 'http://127.0.0.1:4174'

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const ready = scope => scope.waitForFunction(() => document.body.dataset.playerScreen === 'home', null, { timeout: 60000 })
    const visit = async () => {
      await page.goto(`${base}/gallery/droplet`)
      const frame = await (await page.locator('iframe').elementHandle()).contentFrame()
      await ready(frame)
      return frame
    }
    await page.goto(`${base}/gallery`)
    await page.locator('main a[href="/gallery/droplet"]').click()
    let frame = await (await page.locator('iframe').elementHandle()).contentFrame()
    await ready(frame)
    assert.equal(new URL(frame.url()).origin, droplet)
    const previewHeaders = (await page.request.get(`${droplet}/preview`)).headers()
    assert.equal(previewHeaders['x-frame-options'], undefined)
    assert.match(previewHeaders['content-security-policy'], /https:\/\/joelhoke.me/)
    assert.equal(previewHeaders['x-robots-tag'], 'noindex')
    const homeHeaders = (await page.request.get(droplet)).headers()
    assert.equal(homeHeaders['x-frame-options'], 'SAMEORIGIN')
    assert.match(homeHeaders['content-security-policy'], /frame-ancestors 'self'/)
    await page.waitForTimeout(3000)
    await page.screenshot({ path: '/private/tmp/jh-droplet-desktop.png', fullPage: true })
    await page.getByRole('link', { name: 'Back to gallery' }).click()
    await page.waitForURL(`${base}/gallery`)

    for (const [screen, selector, expected] of [
      ['campaign', '#intro-mode', 'levels'],
      ['endurance', '#endurance-mode', 'planning'],
      ['continue', '#continue', 'planning'],
      ['records', '#open-records', 'records'],
      ['settings', '[data-screen="home"] [data-action="settings"]', 'settings'],
      ['customize', '#endurance-droplet-preview', 'home'],
    ]) {
      frame = await visit()
      const control = frame.locator(selector)
      if (screen === 'settings') { await control.focus(); await control.press('Enter') }
      else await control.click()
      await page.waitForURL(`${droplet}/?screen=${screen}`)
      assert.equal(await page.locator('iframe').count(), 0, 'The full game replaces the portfolio, not just its iframe')
      await page.waitForFunction(screen => document.body.dataset.playerScreen === screen, expected, { timeout: 60000 })
      if (screen === 'customize') assert(await page.locator('#droplet-popover').isVisible())
      if (screen === 'endurance') assert.match(await page.locator('.world-details').innerText(), /World 1/)
      console.log(`PASS: ${screen} opens its matching full-site screen`)
    }
    await page.goto(`${droplet}/?screen=https://example.com`)
    await ready(page)
    assert.equal(new URL(page.url()).origin, droplet, 'Unknown screen is ignored')
    await page.setViewportSize({ width: 390, height: 844 })
    frame = await visit()
    await page.waitForTimeout(3000)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert(await frame.locator('button[aria-label="Multiplayer — coming soon"]').isDisabled())
    await page.screenshot({ path: '/private/tmp/jh-droplet-mobile.png', fullPage: true })
    assert.deepEqual(errors, [])
    // Existing hosted demos retain their original sandbox permissions.
    await page.goto(`${base}/p/type-lab/glass-playground`)
    assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts allow-same-origin')
    console.log('PASS: shared viewer, headers, keyboard navigation, responsive preview and existing demo sandbox')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
