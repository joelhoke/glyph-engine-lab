#!/usr/bin/env node
/**
 * Seed the creations gallery with five sample pieces against a running local
 * preview (`wrangler pages dev`, default http://127.0.0.1:8788). Local dev
 * tooling only — never part of the deployed site.
 *
 * Pieces: three preset-based compositions (Blueprint, Ember, Signature —
 * each ≥7 authored edits from its base), a Matrix-ambient piece, and a
 * DVD-screensaver piece whose glyph source is a DVD logo SVG shrunk to half
 * scale (default path ~/Downloads/DVD_logo.svg, override with DVD_SVG_PATH).
 *
 * Two-phase run: pieces are posted and promoted, then real canvas thumbnails
 * are captured from the live playground via headless Chrome (puppeteer-core
 * in tmp-thumb-capture + system Chrome — the same pixels the visitor's own
 * screenshot export produces) and the pieces are re-posted with them. Without
 * Chrome/puppeteer the procedural placeholder thumbs stay. Rows end listed=1.
 *
 * Usage: node scripts/dev/seed-creations.js [origin]
 */

const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')

const projectRoot = path.resolve(__dirname, '..', '..')
const tmpDir = path.join(projectRoot, 'tmp-seed-creations')
const origin = process.argv[2] ?? 'http://127.0.0.1:8788'
const dvdSvgPath = process.env.DVD_SVG_PATH ?? path.join(os.homedir(), 'Downloads', 'DVD_logo.svg')

// --- Compile the TS graph (same idiom as scripts/verify-*.js) ----------------

fs.rmSync(tmpDir, { recursive: true, force: true })
fs.mkdirSync(tmpDir, { recursive: true })
execSync(
  `npx tsc "${path.join(projectRoot, 'content', 'vibe.ts')}" "${path.join(projectRoot, 'engine', 'vibeMemento.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
  { stdio: 'inherit', cwd: projectRoot },
)

const { VIBE_PRESETS } = require(path.join(tmpDir, 'content', 'vibe.js'))
const { resolvePlaygroundConfig } = require(path.join(tmpDir, 'engine', 'playgroundTheme.js'))
const { buildVibeMemento, mementoConfigHash } = require(path.join(tmpDir, 'engine', 'vibeMemento.js'))

// --- Minimal PNG encoder (RGB8, filter 0) -------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [128, 128, 128]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** Gradient thumb from the piece's own colors. motif 'disc' adds a filled
 *  ellipse (the DVD piece); otherwise three palette glyph-bars. */
function renderThumb(config, motif) {
  const width = 640
  const height = 400
  const top = hexToRgb(config.backgroundColor1)
  const bottom = hexToRgb(config.backgroundColor2)
  const palette = config.glyphPalette.map(hexToRgb)
  const rgb = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y += 1) {
    const t = y / (height - 1)
    const row = top.map((c, i) => Math.round(c + (bottom[i] - c) * t))
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 3
      rgb[o] = row[0]
      rgb[o + 1] = row[1]
      rgb[o + 2] = row[2]
    }
  }
  const fill = (x0, y0, x1, y1, color) => {
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y += 1) {
      for (let x = Math.max(0, x0); x < Math.min(width, x1); x += 1) {
        const o = (y * width + x) * 3
        rgb[o] = color[0]
        rgb[o + 1] = color[1]
        rgb[o + 2] = color[2]
      }
    }
  }
  if (motif === 'disc') {
    // Half-scale DVD disc (matches the 50%-shrunk playground source).
    const cx = width / 2
    const cy = height / 2
    const rx = 95
    const ry = 41
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy <= 1) {
          const o = (y * width + x) * 3
          const c = palette[0]
          rgb[o] = c[0]
          rgb[o + 1] = c[1]
          rgb[o + 2] = c[2]
        }
      }
    }
    fill(cx - 60, cy - 9, cx + 60, cy + 9, hexToRgb(config.backgroundColor1))
  } else {
    palette.slice(0, 3).forEach((color, i) => {
      fill(70, 130 + i * 60, 70 + 360 - i * 90, 158 + i * 60, color)
    })
  }
  return encodePng(width, height, rgb)
}

// --- Piece definitions ---------------------------------------------------------

const BASE_PAINT_TOOL = {
  enabled: true,
  tool: 'paint',
  glyphColor: '#8abaff',
  backgroundColor: 'none',
  brushDiameter: 48,
}

function presetSnapshot(presetId, { patch = {}, strokes = [] } = {}) {
  const preset = VIBE_PRESETS.find((p) => p.id === presetId)
  if (!preset) throw new Error(`Unknown preset ${presetId}`)
  const base = resolvePlaygroundConfig(preset.config, 'dark')
  const config = {
    ...base,
    ...patch,
    motion: { ...base.motion, ...(patch.motion ?? {}) },
    ambient: {
      ...base.ambient,
      ...(patch.ambient ?? {}),
      weather: { ...base.ambient.weather, ...(patch.ambient?.weather ?? {}) },
      matrix: { ...base.ambient.matrix, ...(patch.ambient?.matrix ?? {}) },
    },
  }
  return {
    config,
    paintTool: { ...BASE_PAINT_TOOL, enabled: strokes.length > 0 },
    paint: { strokes, redoStrokes: [] },
    upload: preset.sourceUrl
      ? { kind: 'svg', url: preset.sourceUrl, filename: preset.sourceUrl.split('/').pop() }
      : null,
  }
}

function stroke(points, radiusNorm = 0.045) {
  return {
    tool: 'paint',
    glyphColor: null,
    backgroundColor: null,
    radiusNorm,
    points: Float32Array.from(points),
  }
}

function sweep(x0, y0, x1, y1, n = 24) {
  const pts = []
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1)
    pts.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
  }
  return pts
}

// Each preset-based piece diverges from its base by at least 7 authored edits
// (noted per piece) — the seeds should read as real visitor compositions that
// showcase the playground's range, not as preset demos.
const pieces = [
  {
    // Blueprint base. Edits: 1 text, 2 size 12→16, 3 colorMode rows→word-cycle,
    // 4 palette, 5 background, 6 motion organic-flow (amount/speed), 7 ambient
    // weather/wind, 8 paint stroke.
    name: 'blueprint',
    kind: 'auto',
    snapshot: presetSnapshot('blueprint', {
      patch: {
        glyphText: 'measure twice · cut once · ',
        glyphSizePt: 16,
        glyphColorMode: 'word-cycle',
        glyphPalette: ['#7fd4ff', '#3d7ea6', '#e8f4ff'],
        backgroundColor1: '#04121f',
        backgroundColor2: '#0a2338',
        motion: { mode: 'organic-flow', amount: 55, speed: 0.6 },
        ambient: { mode: 'weather', weather: { preset: 'wind', intensity: 60 } },
      },
      strokes: [stroke(sweep(0.15, 0.75, 0.85, 0.25))],
    }),
    motif: 'stripes',
  },
  {
    // Ember base. Edits: 1 text, 2 font Georgia→Times, 3 size 16→24, 4
    // colorMode word-cycle→glyph-cycle, 5 palette, 6 background, 7 motion
    // amount/speed, 8 ambient weather/fog, 9 two paint strokes.
    name: 'ember',
    kind: 'auto',
    snapshot: presetSnapshot('ember', {
      patch: {
        glyphText: 'slow fire · keep it burning · ',
        glyphFont: "'Times New Roman', serif",
        glyphSizePt: 24,
        glyphColorMode: 'glyph-cycle',
        glyphPalette: ['#ff9a3d', '#e5484d', '#ffd7a8'],
        backgroundColor1: '#12040a',
        backgroundColor2: '#2a0d12',
        motion: { mode: 'organic-flow', amount: 20, speed: 0.5 },
        ambient: { mode: 'weather', weather: { preset: 'fog', intensity: 45 } },
      },
      strokes: [stroke(sweep(0.25, 0.3, 0.7, 0.65)), stroke(sweep(0.7, 0.25, 0.3, 0.7))],
    }),
    motif: 'stripes',
  },
  {
    // No preset base — builtin monogram source, and the only piece using the
    // matrix ambient mode: dense green glyphs over falling streams.
    name: 'matrix-rain',
    kind: 'auto',
    snapshot: {
      config: {
        glyphText: 'wake up · the field has you · ',
        glyphPalette: ['#4ade80', '#16a34a', '#bbf7d0'],
        backgroundColor1: '#000000',
        backgroundColor2: '#031007',
        glyphFont: "'Courier New', monospace",
        glyphColorMode: 'glyph-cycle',
        glyphSizePt: 12,
        motion: { ...resolvePlaygroundConfig(VIBE_PRESETS[0].config, 'dark').motion },
        ambient: {
          ...resolvePlaygroundConfig(VIBE_PRESETS[0].config, 'dark').ambient,
          mode: 'matrix',
          matrix: {
            ...resolvePlaygroundConfig(VIBE_PRESETS[0].config, 'dark').ambient.matrix,
            speed: 150,
            trailStrength: 70,
          },
        },
      },
      paintTool: { ...BASE_PAINT_TOOL, enabled: false },
      paint: { strokes: [], redoStrokes: [] },
      upload: null,
    },
    motif: 'stripes',
  },
  {
    // Signature base (the curated default; builtin source). Edits: 1 text, 2
    // font, 3 size, 4 colorMode, 5 palette, 6 background, 7 motion
    // organic-flow, 8 ambient weather/rain, 9 paint stroke.
    name: 'signature-variation',
    kind: 'auto',
    snapshot: presetSnapshot('signature', {
      patch: {
        glyphText: 'make it yours · then make it again · ',
        glyphFont: "'Georgia', serif",
        glyphSizePt: 16,
        glyphColorMode: 'word-cycle',
        glyphPalette: ['#4fd1c5', '#f687b3', '#faf089'],
        backgroundColor1: '#04110d',
        backgroundColor2: '#0d2420',
        motion: { mode: 'organic-flow', speed: 0.8 },
        ambient: { mode: 'weather', weather: { preset: 'rain', intensity: 35 } },
      },
      strokes: [stroke(sweep(0.3, 0.7, 0.7, 0.35))],
    }),
    motif: 'stripes',
  },
]

// --- DVD screensaver piece -------------------------------------------------------

function dvdPiece() {
  if (!fs.existsSync(dvdSvgPath)) {
    throw new Error(`DVD SVG not found at ${dvdSvgPath} (set DVD_SVG_PATH)`)
  }
  const rawSvg = fs.readFileSync(dvdSvgPath, 'utf8')
  // Shrink the rendered logo 50%: the playground lays sources out contain-fit
  // with a fixed margin (APPROVED_SOURCE_LAYOUT_DEFAULTS — not part of the
  // memento), so the only way to make it smaller is a bigger canvas. Doubling
  // the viewBox and centering the artwork halves the drawn logo with no crop.
  const svg = rawSvg
    .replace('width="153" height="67" viewBox="0 0 153 67"', 'width="306" height="134" viewBox="0 0 306 134"')
    .replace('<rect width="153" height="67"', '<rect width="153" height="67" transform="translate(76.5 33.5)"')
  if (!svg.includes('viewBox="0 0 306 134"') || !svg.includes('translate(76.5 33.5)')) {
    throw new Error('DVD SVG layout changed — update the half-scale rewrite in dvdPiece()')
  }
  const svgBytes = Buffer.from(svg, 'utf8')
  if (svgBytes.byteLength > 5 * 1024 * 1024) throw new Error('DVD SVG exceeds the 5 MB source cap')
  const config = {
    glyphText: 'DVD · VIDEO · ',
    glyphPalette: ['#ff5a4e', '#4ecbff', '#ffd84e', '#6eff8a', '#c86eff'],
    backgroundColor1: '#000000',
    backgroundColor2: '#05050a',
    glyphFont: "'Courier New', monospace",
    // Default image-gradient coloring: the glyphs take their colors from the
    // DVD logo source itself instead of the palette.
    glyphColorMode: 'image-gradient',
    glyphSizePt: 18,
    motion: resolvePlaygroundConfig(VIBE_PRESETS[0].config, 'dark').motion,
    ambient: resolvePlaygroundConfig(VIBE_PRESETS[0].config, 'dark').ambient,
  }
  return {
    name: 'dvd-screensaver',
    kind: 'image',
    snapshot: {
      config,
      paintTool: { ...BASE_PAINT_TOOL, enabled: false },
      paint: { strokes: [], redoStrokes: [] },
      upload: { kind: 'svg', url: 'blob:dvd-logo', filename: 'DVD_logo.svg' },
    },
    // Saved with the ambient pond on — the piece reopens with the logo swimming.
    pond: { enabled: true, character: 'source' },
    motif: 'disc',
    source: { bytes: svgBytes, type: 'image/svg+xml', filename: 'DVD_logo.svg' },
  }
}

// --- POST through the real API -----------------------------------------------------

async function postPiece(piece, thumb, thumbType) {
  const memento = buildVibeMemento(piece.snapshot, { pond: piece.pond })
  const configHash = await mementoConfigHash(memento)
  const form = new FormData()
  form.append('state', JSON.stringify(memento))
  form.append('configHash', configHash)
  form.append('kind', piece.kind)
  form.append('thumb', new Blob([thumb], { type: thumbType }), thumbType === 'image/png' ? 'thumb.png' : 'thumb.jpg')
  if (piece.source) {
    form.append('source', new Blob([piece.source.bytes], { type: piece.source.type }), piece.source.filename)
  }
  const response = await fetch(`${origin}/api/creations`, { method: 'POST', body: form })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.ok) {
    throw new Error(`POST ${piece.name} failed: ${response.status} ${JSON.stringify(body)}`)
  }
  console.log(`OK   ${piece.name} → ${body.id}${body.duplicate ? ' (duplicate)' : ''}`)
  return body.id
}

function d1Local(sql) {
  execSync(`npx wrangler d1 execute jh-creations --local --command "${sql}"`, {
    cwd: projectRoot,
    stdio: 'pipe',
  })
}

// --- Real canvas thumbnails (headless Chrome, optional) ---------------------------

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function loadPuppeteer() {
  try {
    return require(path.join(projectRoot, 'tmp-thumb-capture', 'node_modules', 'puppeteer-core'))
  } catch {
    return null
  }
}

/** Capture the live playground canvas for each posted+listed creation — the
 *  EXACT pixels the visitor's own screenshot export produces: the share flow
 *  toBlobs this canvas, we toDataURL it (DOM chrome — header, dock, corner
 *  controls — never enters the bitmap). Requires the rows to be listed: the
 *  restore endpoint only serves listed creations. */
async function captureCanvasThumbs(puppeteer, ids) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    timeout: 60000,
    args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio'],
  })
  const thumbs = new Map()
  try {
    for (const id of ids) {
      const page = await browser.newPage()
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
      await page.goto(`${origin}/?memento=${id}#vibe`, { waitUntil: 'networkidle0', timeout: 45000 })
      await page.waitForSelector('canvas', { timeout: 15000 })
      // The memento restore pushes #vibe only after the state is applied.
      await page.waitForFunction("location.hash === '#vibe'", { timeout: 15000, polling: 'raf' })
      // Let the field settle: source fetch/decode + a few rendered frames.
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const dataUrl = await page.evaluate(() => {
        const canvas = document.querySelector('canvas')
        return canvas ? canvas.toDataURL('image/jpeg', 0.85) : null
      })
      if (!dataUrl) throw new Error(`no canvas for ${id}`)
      thumbs.set(id, Buffer.from(dataUrl.split(',')[1], 'base64'))
      await page.close()
      console.log(`captured canvas thumb for ${id.slice(0, 8)}`)
    }
  } finally {
    await browser.close()
  }
  return thumbs
}

/** Two-phase seed: post every piece with a procedural placeholder thumb and
 *  promote, capture the REAL rendered canvas for each via headless Chrome,
 *  then wipe and re-post with the real thumbs and promote again. Without
 *  puppeteer-core/Chrome the procedural thumbs stay (pieces still seed). */
async function main() {
  const all = [...pieces, dvdPiece()]
  const firstIds = []
  for (const piece of all) {
    firstIds.push(await postPiece(piece, renderThumb(piece.snapshot.config, piece.motif), 'image/png'))
  }
  d1Local('UPDATE creations SET listed = 1')

  const puppeteer = loadPuppeteer()
  if (!puppeteer || !fs.existsSync(CHROME_PATH)) {
    console.log('\npuppeteer-core/Chrome unavailable — procedural thumbs kept.')
    console.log('For real canvas thumbs: npm install --prefix tmp-thumb-capture puppeteer-core')
    return
  }
  const thumbs = await captureCanvasThumbs(puppeteer, firstIds)

  d1Local('DELETE FROM creations')
  const finalIds = []
  for (let i = 0; i < all.length; i += 1) {
    finalIds.push(await postPiece(all[i], thumbs.get(firstIds[i]), 'image/jpeg'))
    // Distinct created_at seconds keep the gallery ordering deterministic.
    await new Promise((resolve) => setTimeout(resolve, 1100))
  }
  d1Local('UPDATE creations SET listed = 1')
  console.log(`\nSeeded ${finalIds.length} pieces with real canvas thumbs (listed = 1).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
