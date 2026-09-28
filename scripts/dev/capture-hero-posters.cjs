/** Render actual shipped hero objects to transparent, theme-matched previews.
 * Run against a production or dev preview: node scripts/dev/capture-hero-posters.cjs [origin]
 */
const { chromium } = require('playwright-core')
const sharp = require('sharp')
const fs = require('node:fs/promises')
const path = require('node:path')

async function main() {
  const origin = process.argv[2] || 'http://127.0.0.1:4173'
  const directory = path.resolve('public/assets/home/hero-posters')
  await fs.mkdir(directory, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  try {
    for (const colorScheme of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme, reducedMotion: 'reduce' })
      await page.goto(origin, { waitUntil: 'networkidle' })
      // Fix projection and remove outer DOM transforms, never the object's own
      // 3D pose. Desktop and mobile use the same 3:2 model viewport.
      await page.addStyleTag({ content: `
        .home-hero-slot-position, .home-hero-slot-motion, .home-hero-slot-link,
        .home-hero-custom, .home-hero-notebook { transform: none !important; }
        .home-hero-three { width: 600px !important; height: 400px !important;
          margin: 0 !important; aspect-ratio: 3/2 !important; }
      ` })
      await page.waitForFunction(() => document.querySelectorAll('.home-hero .home-hero-three canvas').length === 5)
      await page.waitForTimeout(500)
      for (const variant of ['work', 'vibe', 'notebook', 'collaborate', 'gallery']) {
        const data = await page.locator(`.home-hero .home-hero-three--${variant} canvas`).evaluate(canvas => canvas.toDataURL('image/png'))
        const output = path.join(directory, `${variant}-${colorScheme}.webp`)
        await sharp(Buffer.from(data.split(',')[1], 'base64')).resize(600, 400).webp({ quality: 88, alphaQuality: 100 }).toFile(output)
        const { size } = await fs.stat(output)
        console.log(`${path.basename(output)}: ${(size / 1024).toFixed(1)} KiB`)
      }
      await page.close()
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
