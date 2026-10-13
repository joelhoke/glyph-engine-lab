// Optional browser review of the actual active-content experience. Run only when browser access is authorized.
const { chromium, webkit } = require('playwright-core')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.ABOUT_PREVIEW_URL || 'http://127.0.0.1:8790'
async function main() {
  const browser = process.env.BROWSER === 'webkit' ? await webkit.launch({ headless: true })
    : await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' })
    const page = await context.newPage(), errors = []; let requests = 0
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/comics') requests++ })
    await page.goto(`${base}/about`)
    await page.getByRole('heading', { name: 'Family', exact: true }).waitFor()
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal(await page.locator('[data-interest][aria-pressed=true]').getAttribute('data-interest'), 'family')
    const next = page.getByRole('button', { name: 'Peel to next family sticker' })
    await next.waitFor(); await page.waitForFunction(() => !document.querySelector('[aria-label="Peel to next family sticker"]').disabled)
    await next.click(); await page.getByRole('img', { name: 'Sticker peeled away' }).waitFor()
    await page.getByRole('button', { name: 'Previous family sticker' }).click()
    await page.getByRole('img', { name: 'Joel with his family' }).waitFor()
    await page.getByRole('button', { name: 'Open Creative Media', exact: true }).click()
    await page.getByRole('heading', { name: 'Creative Media', exact: true }).waitFor()
    await page.getByRole('list', { name: 'Comic pull list' }).waitFor()
    assert.equal(await page.locator('#interest-content canvas').count(),0,'Comic covers need no WebGL renderer')
    assert.equal(requests, 1, 'All comic consumers share one request')
    assert.equal(await page.getByRole('dialog').count(), 0)
    await page.getByRole('button', { name: 'Open Personal finance', exact: true }).click()
    await page.getByRole('heading', { name: 'Personal finance', exact: true }).waitFor({state:'attached'})
    await page.getByRole('button', { name: 'Open Cars & motorsport', exact: true }).click()
    await page.locator('[aria-label="My garage"] canvas').waitFor()
    const vehicleLights = page.getByRole('button', { name: 'Vehicle lights', exact: true })
    await vehicleLights.waitFor(); await page.waitForFunction(() => !document.querySelector('[aria-label="Vehicle lights"]').disabled)
    await vehicleLights.focus(); await page.keyboard.press('Enter')
    assert.equal(await vehicleLights.getAttribute('aria-pressed'),'false')
    await page.keyboard.press('Enter'); assert.equal(await vehicleLights.getAttribute('aria-pressed'),'true')
    assert.equal(await page.getByRole('button', { name: 'Next car' }).count(),0,'Shared composition has no model-reloading carousel')
    await page.locator('[aria-label="4Runner and Formula 1 car sharing the road, driving toward the left"]').waitFor()
    await page.getByRole('button', { name: 'Open Family', exact: true }).click()
    assert.equal(await page.locator('[aria-label="My garage"]').count(), 0, 'Leaving Cars releases its renderer')
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      for (const [width, height] of [[1440,1000], [390,844], [320,568], [844,390]]) {
        await page.setViewportSize({ width, height }); await page.waitForTimeout(200)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), 'Desktop fits viewport')
        for (const button of await page.locator('[data-interest]').all()) {
          const rect = await button.boundingBox(); assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height)
        }
      }
    }
    await page.getByRole('button', { name: 'Open Family', exact: true }).focus(); await page.keyboard.press('ArrowRight')
    assert.equal(await page.locator(':focus').getAttribute('data-interest'), 'comics')
    await page.keyboard.press('Enter')
    await page.getByRole('heading', { name: 'Creative Media', exact: true }).waitFor()
    const fallback = JSON.parse(fs.readFileSync(path.join(__dirname,'../content/comics-fallback.json')))
    for (const count of [0,1,3]) {
      await page.route('**/api/comics', route => route.fulfill({ json: { ...fallback, fetchedAt: new Date().toISOString(), comics: fallback.comics.slice(0,count) } }))
      await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/comics')), page.reload()]); await page.getByRole('button', { name: 'Open Creative Media', exact: true }).click()
      assert.equal(await page.locator('#interest-content li').count(), count)
      await page.unroute('**/api/comics')
    }
    assert.deepEqual(errors, [])
    console.log('About active-content review passed: default Family, peel/reverse, section navigation, comics, finance placeholder, garage lifecycle, responsive themes and reduced motion.')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
