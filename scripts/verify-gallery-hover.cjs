// Run against npm run dev. Requires Playwright Chromium and WebKit browsers.
const assert = require('node:assert/strict')
const { chromium, webkit } = require('playwright-core')
const base = process.env.GALLERY_PREVIEW_URL || 'http://127.0.0.1:3100'

async function checkRestingHover(page, reducedMotion, expectImage = true) {
  const track = page.locator('.home-gallery-track')
  const bounds = await track.boundingBox()
  await page.mouse.move(100, bounds.y + 80)
  await page.waitForFunction(({ reducedMotion, expectImage }) => {
    const track = document.querySelector('.home-gallery-track')
    const link = document.elementFromPoint(100, track.getBoundingClientRect().y + 80)?.closest('a')
    const image = link?.querySelector('img')
    return link?.matches(':hover') && ((!expectImage && !image) ||
      (image && getComputedStyle(image).transform === (reducedMotion ? 'none' : 'matrix(1.025, 0, 0, 1.025, 0, 0)')))
  }, { reducedMotion, expectImage })
  const samples = await track.evaluate(track => new Promise(resolve => {
    const link = document.elementFromPoint(100, track.getBoundingClientRect().y + 80)?.closest('a')
    const image = link?.querySelector('img')
    const samples = []
    const start = performance.now()
    function sample() {
      samples.push({
        scroll: track.scrollLeft,
        height: track.getBoundingClientRect().height,
        hovered: Boolean(link?.matches(':hover')),
        transform: image && getComputedStyle(image).transform,
      })
      if (performance.now() - start < 700) requestAnimationFrame(sample)
      else resolve(samples)
    }
    sample()
  }))
  assert(samples.length > 1)
  assert(samples.every(s => s.hovered), 'the same card must remain hovered with the pointer still')
  assert(Math.max(...samples.map(s => s.scroll)) - Math.min(...samples.map(s => s.scroll)) <= 1,
    'the resting carousel must not jump between duplicate copies')
  assert(samples.every(s => s.height === samples[0].height), 'hover must not change layout')
  assert(samples.every(s => (!expectImage && s.transform === null) ||
    s.transform === (reducedMotion ? 'none' : 'matrix(1.025, 0, 0, 1.025, 0, 0)')),
    `hover zoom must settle, and respect reduced motion: ${JSON.stringify([...new Set(samples.map(s => s.transform))])}`)
}

async function main() {
  for (const [name, type] of [['Chromium', chromium], ['WebKit', webkit]]) {
    const browser = await type.launch({ headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1470, height: 1000 } })
      const errors = []
      page.on('pageerror', error => {
        // The full homepage also emits this browser notification on main
        // during desktop/mobile resizing. Keep it visible without failing
        // the carousel regression; all other page errors remain failures.
        if (error.message === 'ResizeObserver loop completed with undelivered notifications.') {
          console.warn(`${name}: existing homepage resize notification: ${error.message}`)
        } else errors.push(error.message)
      })
      await page.goto(base)
      await page.evaluate(() => document.fonts.ready)
      const center = async () => {
        await page.locator('.home-gallery-heading').evaluate(el => {
          window.dispatchEvent(new WheelEvent('wheel'))
          window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 60)
        })
        await page.waitForTimeout(1000)
      }
      await center()
      await checkRestingHover(page, false)
      const track = page.locator('.home-gallery-track')
      const count = await page.locator('.home-gallery-slide:not([aria-hidden])').count()
      // Start at the first project, wrap backward, then forward to the first.
      for (const [button, index] of [['Previous projects', count - 1], ['Next projects', 0]]) {
        await page.getByRole('button', { name: button, exact: true }).click()
        await page.waitForTimeout(1000)
        const visible = await track.evaluate(track => {
          const cards = [...track.children]
          const edge = track.getBoundingClientRect().x + parseFloat(getComputedStyle(track).scrollPaddingLeft)
          const nearest = cards.reduce((a, b) => Math.abs(a.getBoundingClientRect().x - edge) < Math.abs(b.getBoundingClientRect().x - edge) ? a : b)
          return cards.indexOf(nearest)
        })
        assert.equal(visible % count, index, 'arrow wrapping must preserve project order')
        // Hosted project thumbnails may use the placeholder without the local API.
        await checkRestingHover(page, false, index === 0)
      }
      // Focus remains on a usable link, and the image edge is a stable hit target.
      const link = page.locator('.home-gallery-slide:not([aria-hidden]) .home-project').first()
      await link.focus()
      assert(await link.evaluate(el => el === document.activeElement))
      const box = await link.locator('.home-project-image').boundingBox()
      await page.mouse.move(box.x + 1, box.y + box.height / 2)
      await page.waitForTimeout(500)
      assert(await link.evaluate(el => el.matches(':hover')))
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 })
        await center()
        await checkRestingHover(page, false)
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page overflow')
      }
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await checkRestingHover(page, true)
      assert.deepEqual(errors, [])
      console.log(`${name}: stable hover, zoom, arrow wrapping, focus, card edge, resize, mobile layout and reduced motion passed.`)
    } finally {
      await browser.close()
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
