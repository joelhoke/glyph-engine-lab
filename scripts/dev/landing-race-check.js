/* Landing-race check: cold mobile loads must build the monogram directly
   (never the desktop logotype), the hero must never render raw-white glyphs,
   and orientation/viewport changes must re-resolve from current geometry. */
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const { chromium } = require('playwright-core')

const PORT = Number(process.argv[2]) || 4741
const URL = `http://localhost:${PORT}/?debug=true`
const ROOT = path.join(__dirname, '..', '..')

let failures = 0
function check(label, condition, detail = '') {
  if (condition) console.log(`PASS  ${label}`)
  else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
    failures += 1
  }
}

const server = process.env.SKIP_SERVER
  ? null
  : spawn('npx', ['next', 'dev', '-p', String(PORT)], {
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

const LOGOTYPE = 'JH-Logotype.svg'
const MONOGRAM = 'test-source.svg'

async function diag(page) {
  return page.evaluate(() => window.__JH_SCENE_DIAGNOSTICS__ ?? null)
}

/** Cold load: poll diagnostics from the earliest moment for 2.5s; the
 *  desktop logotype must NEVER be the active source at mobile width. */
async function coldLoad(page, label) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  const seen = new Set()
  const start = Date.now()
  while (Date.now() - start < 2500) {
    const d = await diag(page)
    if (d?.sourceId) seen.add(d.sourceId)
    await sleep(50)
  }
  check(
    `${label}: logotype never selected at 390px`,
    ![...seen].some((id) => id.includes(LOGOTYPE)),
    [...seen].join(','),
  )
  check(
    `${label}: monogram built and ready`,
    [...seen].some((id) => id.includes(MONOGRAM)),
    [...seen].join(','),
  )
}

/** Near-white pixel census over the canvas (dark theme: the raw fallback
 *  monogram would be #fff; the landing gradient never is). */
async function whiteGlyphs(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.scene-root canvas')
    if (!canvas) return -1
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let white = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240 && data[i + 3] > 200) white += 1
    }
    return white / (width * height)
  })
}

async function main() {
  if (server) await waitForServer()
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      hasTouch: true,
    })
    const page = await context.newPage()
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`))

    for (let i = 1; i <= 3; i += 1) {
      await coldLoad(page, `cold load ${i}`)
      const white = await whiteGlyphs(page)
      check(`cold load ${i}: no white glyph field`, white >= 0 && white < 0.002, `white=${(white * 100).toFixed(3)}%`)
      if (i < 3) await page.reload({ waitUntil: 'domcontentloaded' })
    }

    // Orientation change: rotate to landscape (844px wide → logotype), then
    // back to portrait (monogram again).
    await page.setViewportSize({ width: 844, height: 390 })
    await sleep(1500)
    let d = await diag(page)
    check('landscape: logotype selected at 844px', !!d?.sourceId?.includes(LOGOTYPE), d?.sourceId)
    await page.setViewportSize({ width: 390, height: 844 })
    await sleep(1500)
    d = await diag(page)
    check('back to portrait: monogram re-selected', !!d?.sourceId?.includes(MONOGRAM), d?.sourceId)
    const white = await whiteGlyphs(page)
    check('after orientation cycle: no white glyph field', white >= 0 && white < 0.002, `white=${(white * 100).toFixed(3)}%`)

    // Simulated browser-chrome contraction (height-only change).
    await page.setViewportSize({ width: 390, height: 700 })
    await sleep(1500)
    d = await diag(page)
    check('chrome-height change: monogram kept, field rebuilt', !!d?.sourceId?.includes(MONOGRAM), d?.sourceId)

    await context.close()
  } finally {
    await browser.close()
    server?.kill('SIGTERM')
  }
  console.log(failures === 0 ? '\nAll landing-race checks passed.' : `\n${failures} landing-race check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  server?.kill('SIGTERM')
  process.exit(1)
})
