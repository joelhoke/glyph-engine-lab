/** Section-specific resting poses use the same vertical field of view as the
 * hero. object-fit: cover preserves that projection at other viewport ratios. */
const { chromium } = require('playwright-core')
const sharp = require('sharp')
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  try {
    for (const colorScheme of ['dark', 'light']) for (const variant of ['vibe', 'gallery']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme, reducedMotion: 'reduce' })
      await page.goto(`${process.argv[2] || 'http://127.0.0.1:4173'}/#home/${variant}`)
      const selector = `.home-section--${variant} .home-hero-three`
      await page.waitForSelector(`${selector}[data-load-state="ready"]`, { timeout: 60000 })
      await page.addStyleTag({ content: `${selector} { width: 600px !important; height: 400px !important; }` })
      await page.waitForTimeout(250)
      const data = await page.locator(`${selector} canvas`).evaluate(canvas => canvas.toDataURL('image/png'))
      const filename = `public/assets/home/hero-posters/${variant}-section-${colorScheme}.webp`
      await sharp(Buffer.from(data.split(',')[1], 'base64')).resize(600, 400).webp({ quality: 88, alphaQuality: 100 }).toFile(filename)
      console.log(filename)
      await page.close()
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
