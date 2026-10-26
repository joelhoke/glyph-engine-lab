const assert = require('node:assert/strict')
const { chromium } = require('playwright-core')
const base = process.env.GALLERY_PREVIEW_URL || 'http://127.0.0.1:8788'

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    const errors = [], models = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (request.url().includes('.glb')) models.push(request.url()) })
    await page.goto(`${base}/gallery`)
    const droplet = page.locator('main a[href="/gallery/droplet"]')
    assert.equal(await droplet.count(), 1)
    for (const link of [droplet, page.locator('main a[href="/gallery/cars"]')]) {
      await link.locator('img').evaluate(img => img.decode())
      const image = await link.locator('img').boundingBox()
      assert(Math.abs(image.width / image.height - 16 / 9) < .03, 'Preview keeps its landscape aspect ratio')
    }
    assert.equal(models.length, 0, 'Gallery cards do not load vehicle models')
    await page.screenshot({ path: '/private/tmp/jh-gallery-desktop.png', fullPage: true })
    await page.locator('main a[href="/gallery/cars"]').click()
    const ready = () => page.waitForFunction(() => {
      const next = document.querySelector('[aria-label="Next vehicle"]')
      return next && !next.disabled
    }, null, { timeout: 60000 })
    await ready()
    assert.equal(await page.locator('main canvas').count(), 1)
    assert(models.some(url => url.includes('4runner.glb')))
    assert(!models.some(url => url.includes('mclaren.glb')), 'Load the next vehicle only when requested')
    await page.getByRole('button', { name: 'Dark', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Dark', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.getByText('Vehicle controls', { exact: true }).click()
    await page.getByLabel('Headlights', { exact: true }).selectOption('off')
    assert.equal(await page.getByLabel('Headlights', { exact: true }).inputValue(), 'off')
    await page.getByRole('button', { name: 'Front', exact: true }).click()
    await page.getByRole('button', { name: 'Quarter', exact: true }).click()
    await page.getByRole('button', { name: 'Wireframe', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: 'Wireframe', exact: true }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: 'Wireframe', exact: true }).click()
    assert(await page.getByRole('button', { name: 'Auto rotate', exact: true }).isDisabled())
    await page.getByRole('button', { name: 'Next vehicle' }).click(); await ready()
    assert.match(await page.getByRole('navigation', { name: 'Choose a vehicle' }).innerText(), /McLaren MP4\/5/)
    assert(models.some(url => url.includes('mclaren.glb')))
    assert(!models.some(url => url.includes('lancia.glb')))
    await page.getByRole('button', { name: 'Previous vehicle' }).click(); await ready()
    await page.getByRole('button', { name: 'Light', exact: true }).click()
    await page.getByText('Vehicle controls', { exact: true }).click()
    await page.screenshot({ path: '/private/tmp/jh-cars-desktop.png' })
    for (const [width, height] of [[390, 844], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width, height })
      await page.waitForTimeout(200)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow')
      await page.getByRole('button', { name: 'Next vehicle' }).scrollIntoViewIfNeeded()
      assert(await page.getByRole('button', { name: 'Next vehicle' }).isVisible())
      if (width === 390) await page.screenshot({ path: '/private/tmp/jh-cars-mobile.png', fullPage: true })
    }
    await page.goto(`${base}/gallery`)
    assert.equal(await page.locator('main canvas').count(), 0)
    await page.goto(`${base}/`)
    assert(await page.locator('.home-project[href="/gallery/droplet"]').count() > 0)
    assert(await page.locator('.home-project[href="/gallery/cars"]').count() > 0)
    assert.deepEqual(errors, [])

    const failed = await browser.newPage()
    await failed.route('**/assets/about/garage/runtime.js*', route => route.abort())
    await failed.goto(`${base}/gallery/cars`)
    await failed.locator('main').getByRole('alert').waitFor()
    assert(await failed.getByRole('button', { name: 'Try again' }).isVisible())
    await failed.locator('img[alt="Toyota 4Runner in the vehicle playground"]').evaluate(img => img.decode())
    console.log('Gallery: image previews, external destination, lazy models, vehicle switching, views, lighting, wireframe, reduced motion, responsive layouts, homepage entries and failure fallback passed.')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
