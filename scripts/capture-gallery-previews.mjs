// Capture real project screens, then create the shared 16:9 gallery artwork.
// node scripts/capture-gallery-previews.mjs droplet|cars
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import sharp from 'sharp'

const target = process.argv[2]
if (!['droplet', 'cars'].includes(target)) throw new Error('Choose droplet or cars.')
const directory = new URL('../public/assets/gallery/', import.meta.url)
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: target === 'cars' ? 874 : 810 }, deviceScaleFactor: 1 })
  await page.goto(target === 'droplet' ? 'https://droplet.digital/' : `${process.env.GALLERY_PREVIEW_URL || 'http://127.0.0.1:8788'}/gallery/cars`, { waitUntil: 'domcontentloaded' })
  if (target === 'droplet') {
    await page.getByRole('button', { name: 'Campaign', exact: true }).waitFor()
    await page.waitForTimeout(5000)
  } else {
    await page.waitForFunction(() => {
      const next = document.querySelector('[aria-label="Next vehicle"]')
      return next && !next.disabled
    }, null, { timeout: 60000 })
    await page.waitForTimeout(1000)
  }
  const buffer = target === 'droplet' ? await page.screenshot()
    : await page.locator('[role="region"] canvas').screenshot({ style: 'header, [data-gallery-ui], .privacy-settings-button { visibility: hidden !important; }' })
  const name = target === 'droplet' ? 'droplet-home.webp' : 'vehicle-playground.webp'
  await sharp(buffer).resize(1200, 675, { fit: 'cover' }).webp({ quality: 85 }).toFile(fileURLToPath(new URL(name, directory)))
  console.log(`Captured ${name}`)
} finally { await browser.close() }
