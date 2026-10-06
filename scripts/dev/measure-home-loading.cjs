/** Supplementary cold-load lab measurements, not a field Core Web Vitals audit.
 * node scripts/dev/measure-home-loading.cjs [origin] [output.json]
 */
const { chromium } = require('playwright-core')
const fs = require('node:fs/promises')
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const results = []
  try {
    for (const mobile of (process.argv[4] === '--desktop' ? [false] : [false, true])) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark', isMobile: mobile, hasTouch: mobile })
      const page = await context.newPage()
      const failures = []
      page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }))
      page.on('pageerror', error => failures.push({ error: error.message }))
      page.on('console', message => { if (message.type() === 'error') failures.push({ error: message.text() }) })
      await page.addInitScript(() => {
        window.__load = { lcp: 0, cls: 0, frames: {} }
        new PerformanceObserver(list => list.getEntries().forEach(entry => { window.__load.lcp = entry.startTime })).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver(list => list.getEntries().forEach(entry => { if (!entry.hadRecentInput) window.__load.cls += entry.value })).observe({ type: 'layout-shift', buffered: true })
        for (const method of ['drawElements', 'drawArrays']) {
          const original = WebGL2RenderingContext.prototype[method]
          WebGL2RenderingContext.prototype[method] = function (...args) {
            const result = original.apply(this, args)
            const host = this.canvas.closest('.home-hero-three')
            if (host) window.__load.frames[host.className] ??= performance.now()
            return result
          }
        }
      })
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 5 * 1024 * 1024 / 8, uploadThroughput: 1024 * 1024 / 8 })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.goto(process.argv[2] || 'http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(45000)
      const result = await page.evaluate(() => ({
        ...window.__load,
        models: [...document.querySelectorAll('.home-hero-three')].map(node => ({ variant: node.className, state: node.dataset.loadState })),
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        marks: performance.getEntriesByType('mark').filter(entry => entry.name.startsWith('home:')).map(entry => ({ name: entry.name, start: entry.startTime })),
        resources: performance.getEntriesByType('resource').map(entry => ({ name: entry.name.replace(location.origin, ''), transfer: entry.transferSize, duration: entry.duration, start: entry.startTime })),
        viewport: { width: innerWidth, height: innerHeight },
      }))
      results.push({ ...result, failures, browser: browser.version(), profile: { downloadMbps: 5, uploadMbps: 1, latencyMs: 40, cpuSlowdown: 4, cache: 'disabled', observationSeconds: 45 } })
      await fs.writeFile(process.argv[3] || 'tmp-verify-progressive/after.json', JSON.stringify(results, null, 2))
      console.log(JSON.stringify({ mobile, failures, models: result.models, lcp: result.lcp, fcp: result.fcp, cls: result.cls, frames: result.frames, transfer: result.resources.reduce((total, resource) => total + resource.transfer, 0) }))
      await context.close()
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
