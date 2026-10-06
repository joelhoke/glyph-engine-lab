/** Browser integration checks. Serve a production export first, then run:
 * node scripts/verify-progressive-loading.cjs http://127.0.0.1:4173
 */
const assert = require('node:assert/strict')
const { chromium } = require('playwright-core')
const fs = require('node:fs/promises')
const origin = process.argv[2] || 'http://127.0.0.1:4173'
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const errors = []
  await fs.mkdir('tmp-verify-progressive', { recursive: true })
  try {
    for (const width of [1440, 390, 320]) for (const colorScheme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: width > 767 ? 900 : 844 }, colorScheme, reducedMotion: 'reduce', isMobile: width < 768, hasTouch: width < 768 })
      const page = await context.newPage()
      page.on('pageerror', error => errors.push(error.message))
      let release
      const held = new Promise(resolve => { release = resolve })
      await page.route('**/*.gltf', async route => { await held; await route.continue() })
      await page.goto(origin, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => [...document.querySelectorAll('.home-hero .home-model-poster img')].length === 5 && [...document.querySelectorAll('.home-hero .home-model-poster img')].every(image => image.complete && image.naturalWidth > 0))
      const before = await page.locator('.home-hero .home-hero-three').evaluateAll(nodes => nodes.map(node => ({ width: node.clientWidth, height: node.clientHeight })))
      assert.equal(await page.locator('.home-hero [data-load-state="ready"]').count(), 0, 'no premature readiness while models are held')
      const source = await page.locator('.home-hero .home-model-poster img').first().evaluate(image => image.currentSrc)
      assert(source.endsWith(`-${colorScheme}.webp`), 'theme-matched poster is selected')
      await page.screenshot({ path: `tmp-verify-progressive/posters-${width}-${colorScheme}.png` })
      release()
      await page.waitForFunction(() => document.querySelectorAll('.home-hero [data-load-state="ready"]').length === 5, null, { timeout: 60000 })
      const after = await page.locator('.home-hero .home-hero-three').evaluateAll(nodes => nodes.map(node => ({ width: node.clientWidth, height: node.clientHeight })))
      assert.deepEqual(after, before, 'model loading preserves every local slot dimension')
      const transitions = await page.locator('.home-hero .home-model-poster').evaluateAll(nodes => nodes.map(node => ({ opacity: getComputedStyle(node).opacity, duration: getComputedStyle(node).transitionDuration })))
      assert(transitions.every(value => value.opacity === '0' && value.duration === '0s'), 'reduced motion reveals without a fade')
      await page.screenshot({ path: `tmp-verify-progressive/live-${width}-${colorScheme}.png` })
      await page.locator('.home-hero-three--work canvas').first().evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
      await page.waitForSelector('.home-hero .home-hero-three--work[data-load-state="unavailable"]')
      assert.equal(await page.locator('.home-hero .home-hero-three--work canvas').count(), 0, 'lost context is cleaned up')
      assert.equal(await page.locator('.home-hero .home-hero-three--work .home-model-poster').evaluate(node => getComputedStyle(node).opacity), '1', 'context loss restores the poster')
      await context.close()
      console.log(`PASS: ${width}px ${colorScheme}: slow load, first frame, stable slots, reduced motion, context loss`)
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return /webgl/.test(kind) ? null : getContext.call(this, kind, ...args) }
      })
      await page.goto(origin)
      await page.waitForFunction(() => document.querySelectorAll('.home-hero [data-load-state="unavailable"]').length === 5)
      assert.equal(await page.locator('.home-hero .home-model-poster').count(), 5, 'all five recognizable previews survive unavailable WebGL')
      assert.equal(await page.locator('.home-hero-slot-link[href="/#home/about"]').count(), 1, 'About navigation remains available')
      await page.close()
      console.log('PASS: unavailable WebGL retains all five previews and navigation')
    }
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/assets/about-light-study/light-study-3.json', route => route.abort())
      await page.goto(`${origin}/#home/about`)
      await page.waitForSelector('.home-about-study--error')
      await page.waitForFunction(() => { const image = document.querySelector('.home-about-study-preview img'); return image?.complete && image.naturalWidth > 0 })
      assert.equal(await page.locator('#home-about-heading span').evaluate(node => getComputedStyle(node).opacity), '1', 'HTML heading survives scene failure')
      assert(await page.locator('.home-about-study-artwork').evaluate(node => node.getBoundingClientRect().height > 0), 'About failure preserves artwork space')
      await page.screenshot({ path: `tmp-verify-progressive/about-fallback-${width}.png` })
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
      page.on('pageerror', error => errors.push(error.message))
      let release
      const held = new Promise(resolve => { release = resolve })
      await page.route('**/models/phone/scene.gltf', async route => { await held; await route.continue() })
      await page.goto(`${origin}/#home/collaborate`)
      const screen = page.locator('.home-section--collaborate .home-phone-screen')
      await screen.waitFor({ state: 'visible' })
      await screen.evaluate(node => { window.__originalChat = node })
      const draft = screen.locator('textarea')
      await draft.fill('Testing draft preservation')
      release()
      await page.waitForSelector('.home-section--collaborate [data-load-state="ready"]', { timeout: 60000 })
      assert(await screen.evaluate(node => window.__originalChat === node), 'chat DOM persists into the live phone')
      assert.equal(await draft.inputValue(), 'Testing draft preservation')
      assert(await draft.evaluate(node => document.activeElement === node), 'chat focus survives the first-frame reveal')
      await page.locator('.home-section--collaborate canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
      await page.waitForSelector('.home-section--collaborate [data-load-state="unavailable"]')
      assert(await screen.isVisible(), 'phone failure restores usable HTML chat')
      assert(await screen.evaluate(node => window.__originalChat === node), 'phone failure preserves the chat DOM')
      assert.equal(await draft.inputValue(), 'Testing draft preservation')
      await page.close()
      console.log('PASS: phone chat stays mounted through slow model loading and context loss')
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`${origin}/#home/about`)
      await page.waitForSelector('.home-about-study--ready', { timeout: 60000 })
      assert.equal(await page.locator('.home-about-study-preview').evaluate(node => getComputedStyle(node).opacity), '0')
      assert.equal(await page.locator('#home-about-heading span').evaluate(node => getComputedStyle(node).opacity), '0')
      assert(await page.evaluate(() => performance.getEntriesByName('home:section:about:first-frame').length === 1), 'About reveals on exactly one loaded-composition frame')
      await page.close()
      console.log('PASS: About deep link reveals its loaded composition on first frame')
    }
    for (const variant of ['vibe', 'gallery']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
      let release
      const held = new Promise(resolve => { release = resolve })
      await page.route('**/*.gltf', async route => { await held; await route.continue() })
      await page.goto(`${origin}/#home/${variant}`)
      const host = page.locator(`.home-section--${variant} .home-hero-three`)
      await host.scrollIntoViewIfNeeded()
      await host.locator('.home-model-poster img').evaluate(image => image.decode())
      assert.equal(await host.locator('.home-model-poster').evaluate(node => getComputedStyle(node).opacity), '1')
      release()
      await page.waitForSelector(`.home-section--${variant} [data-load-state="ready"]`, { timeout: 60000 })
      assert.equal(await host.locator('.home-model-poster').evaluate(node => getComputedStyle(node).opacity), '0')
      await page.close()
      console.log(`PASS: ${variant} section retains its own pose preview until first frame`)
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
      let release
      const held = new Promise(resolve => { release = resolve })
      await page.route('**/*.gltf', async route => { await held; await route.continue() })
      await page.goto(`${origin}/#home/work`)
      assert.equal(await page.locator('.home-work-poster').evaluate(node => getComputedStyle(node).opacity), '1')
      assert.equal(await page.locator('.home-work-iphone > img').evaluate(node => getComputedStyle(node).opacity), '1')
      release()
      await page.waitForSelector('.home-section--work .home-hero-three--work[data-load-state="ready"]', { timeout: 60000 })
      await page.waitForSelector('.home-section--work .home-hero-three--iphone[data-load-state="ready"]', { timeout: 60000 })
      assert.equal(await page.locator('.home-work-poster').evaluate(node => getComputedStyle(node).opacity), '0')
      assert.equal(await page.locator('.home-work-iphone > img').evaluate(node => getComputedStyle(node).opacity), '0')
      await page.close()
      console.log('PASS: Work retains both images through model initialization')
    }
    assert.deepEqual(errors, [], 'no uncaught browser errors')
    console.log('PASS: About deep-link failure keeps image, heading, copy and layout')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
