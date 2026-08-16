#!/usr/bin/env node
/**
 * Deterministic verification for the mobile SVG-upload lifecycle hardening:
 *
 * 1. engine/sourcePromotion.ts — MIME-tolerant upload routing (empty/generic
 *    mobile MIME values with a .svg name route to the SVG sanitizer; the parse
 *    there is the real check), the exactly-once Blob-URL registry, and the
 *    transactional promote/reject decision.
 *
 * 2. engine/svgTargetSource.ts — the per-URL decode cache: concurrent callers
 *    share one in-flight decode, ResizeObserver/orientation rebuilds reuse the
 *    decoded image (no second fetch, no transient failure), failures are never
 *    cached, and sanitizer-supplied intrinsic dimensions override a collapsed
 *    (0×0 → 1×1) natural size.
 *
 * 3. engine/pondFormation.ts — containPondBody hard-clamps the swimming body
 *    into new source/viewport bounds (Source mode never begins offscreen).
 *
 * 4. components/PortfolioExperience.tsx — structural guards for the
 *    transactional wiring: routing, Blob-URL creation, probe-before-promote
 *    ordering, the request-generation stale guard, and registry release on
 *    the failure path.
 *
 * Runs against ts compiled into a tmp dir with minimal DOM mocks (Image,
 * canvas 2d); not a browser integration test.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-svg-lifecycle')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'sourcePromotion.ts')}" "${path.join(projectRoot, 'engine', 'svgTargetSource.ts')}" "${path.join(projectRoot, 'engine', 'pondFormation.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

// --- DOM mocks (installed before requiring the modules) ---------------------

const imageLoads = []
const drawCalls = []
// url → { width, height } | 'error'
let imageBehavior = {}

global.Image = class MockImage {
  constructor() {
    this.naturalWidth = 0
    this.naturalHeight = 0
    this.onload = null
    this.onerror = null
  }
  set src(url) {
    const behavior = imageBehavior[url] ?? { width: 24, height: 24 }
    imageLoads.push(url)
    setTimeout(() => {
      if (behavior === 'error') {
        if (this.onerror) this.onerror(new Error('decode failed'))
      } else {
        this.naturalWidth = behavior.width
        this.naturalHeight = behavior.height
        if (this.onload) this.onload()
      }
    }, 0)
  }
}

global.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`unexpected element: ${tag}`)
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          clearRect() {},
          drawImage(image, x, y, w, h) {
            drawCalls.push({ x, y, w, h, naturalWidth: image.naturalWidth })
          },
          getImageData(x, y, w, h) {
            // One opaque pixel at the origin, everything else transparent:
            // enough for the sampler to report exactly one visible target.
            const data = new Uint8ClampedArray(w * h * 4)
            data[3] = 255
            return { data, width: w, height: h }
          },
        }
      },
    }
  },
}

const {
  resolveUploadRoute,
  createSourceUrlRegistry,
  resolveSourcePromotion,
} = require(path.join(tmpDir, 'sourcePromotion.js'))
const {
  loadSvgTargets,
  clearStaticSourceDecodeCache,
} = require(path.join(tmpDir, 'svgTargetSource.js'))
const { containPondBody } = require(path.join(tmpDir, 'pondFormation.js'))
const {
  SVG_UNDECODABLE_ERROR,
  SVG_EMPTY_FIELD_ERROR,
  RASTER_UNDECODABLE_ERROR,
  RASTER_EMPTY_FIELD_ERROR,
} = require(path.join(tmpDir, 'visualSource.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- 1. Upload routing (MIME tolerance) --------------------------------------

assert(
  resolveUploadRoute({ name: 'art.svg', type: 'image/svg+xml' }) === 'svg',
  'declared SVG MIME routes to the SVG sanitizer',
)
assert(
  resolveUploadRoute({ name: 'art.svg', type: '' }) === 'svg',
  'empty mobile MIME + .svg name routes to the SVG sanitizer',
)
assert(
  resolveUploadRoute({ name: 'art.svg', type: 'application/octet-stream' }) === 'svg',
  'generic octet-stream MIME + .svg name routes to the SVG sanitizer',
)
assert(
  resolveUploadRoute({ name: 'ART.SVG', type: '' }) === 'svg',
  'uppercase .SVG extension routes to the SVG sanitizer',
)
assert(
  resolveUploadRoute({ name: 'art.svg', type: 'text/plain' }) === 'svg',
  'mismatched non-raster MIME + .svg name still routes to the SVG sanitizer (parse decides)',
)
assert(
  resolveUploadRoute({ name: 'photo.png', type: 'image/png' }) === 'raster',
  'declared PNG routes to the raster sniffer',
)
assert(
  resolveUploadRoute({ name: 'photo.webp', type: 'image/webp' }) === 'raster',
  'declared WebP routes to the raster sniffer',
)
assert(
  resolveUploadRoute({ name: 'archive.svg.png', type: 'image/png' }) === 'raster',
  'declared raster MIME wins over an .svg-containing name',
)
assert(
  resolveUploadRoute({ name: 'photo.png', type: '' }) === 'unsupported',
  'generic MIME without a .svg name stays rejected',
)
assert(
  resolveUploadRoute({ name: 'notes.txt', type: 'text/plain' }) === 'unsupported',
  'plain-text file stays rejected',
)
assert(
  resolveUploadRoute({ name: 'doc.pdf', type: 'application/pdf' }) === 'unsupported',
  'unsupported MIME stays rejected',
)

// --- 2. Blob-URL registry (exactly-once lifecycle) ---------------------------

{
  const revoked = []
  const registry = createSourceUrlRegistry((url) => revoked.push(url))

  registry.release('blob:never-owned')
  assert(revoked.length === 0, 'releasing a never-owned URL is a no-op')

  registry.own('https://example.com/assets/preset.svg')
  assert(
    !registry.owns('https://example.com/assets/preset.svg'),
    'non-blob URLs are never tracked (no lifecycle needed)',
  )

  registry.own('blob:a')
  registry.release('blob:a')
  registry.release('blob:a')
  assert(
    revoked.length === 1 && revoked[0] === 'blob:a',
    'a candidate URL is revoked exactly once even on double release',
  )
  assert(!registry.owns('blob:a'), 'released URL leaves the registry')

  registry.own('blob:b')
  registry.own('blob:c')
  registry.own('blob:d')
  registry.releaseOrphans(new Set(['blob:c']))
  assert(
    revoked.length === 3 && revoked.includes('blob:b') && revoked.includes('blob:d'),
    'releaseOrphans revokes every owned URL outside the retained set',
  )
  assert(registry.owns('blob:c'), 'retained URLs (live source/history) stay alive')

  registry.releaseOrphans(new Set())
  assert(
    revoked.length === 4 && revoked[3] === 'blob:c',
    'a second releaseOrphans (reset/unmount) revokes the rest, each exactly once',
  )
}

// --- 3. Transactional promotion decision -------------------------------------

{
  const good = resolveSourcePromotion({ ok: true, targetCount: 5 })
  assert(good.promote === true, 'a decode with visible targets promotes the candidate')

  const single = resolveSourcePromotion({ ok: true, targetCount: 1 })
  assert(single.promote === true, 'even one visible target promotes the candidate')

  const empty = resolveSourcePromotion({ ok: true, targetCount: 0 })
  assert(
    empty.promote === false && empty.error === SVG_EMPTY_FIELD_ERROR,
    'transparent/zero-target artwork rejects with the empty-field literal',
  )

  const undecodable = resolveSourcePromotion({ ok: false, targetCount: 0, error: 'boom' })
  assert(
    undecodable.promote === false && undecodable.error === SVG_UNDECODABLE_ERROR,
    'an undecodable candidate rejects with the decode literal',
  )

  const rasterEmpty = resolveSourcePromotion({ ok: true, targetCount: 0 }, 'raster')
  assert(
    rasterEmpty.promote === false && rasterEmpty.error === RASTER_EMPTY_FIELD_ERROR,
    'raster zero-target rejection uses the raster literal',
  )

  const rasterBad = resolveSourcePromotion({ ok: false, targetCount: 0 }, 'raster')
  assert(
    rasterBad.promote === false && rasterBad.error === RASTER_UNDECODABLE_ERROR,
    'raster decode rejection uses the raster literal',
  )
}

// --- 4. Decode cache / dedupe / intrinsic fallback (async) --------------------

async function verifyDecodeCache() {
  clearStaticSourceDecodeCache()
  imageLoads.length = 0
  drawCalls.length = 0
  imageBehavior = {
    'blob:a': { width: 40, height: 20 },
    'blob:b': { width: 30, height: 30 },
    'blob:bad': 'error',
    'blob:tiny': { width: 0, height: 0 },
  }

  // Concurrent callers (upload probe + renderer rebuild, or a resize landing
  // mid-decode) share ONE in-flight decode; each rasterizes its own bounds.
  const [first, second] = await Promise.all([
    loadSvgTargets({ url: 'blob:a', bounds: { width: 100, height: 100 } }),
    loadSvgTargets({ url: 'blob:a', bounds: { width: 200, height: 200 } }),
  ])
  assert(first.ok && second.ok, 'concurrent loads of the same URL both succeed')
  assert(
    imageLoads.filter((url) => url === 'blob:a').length === 1,
    'concurrent loads share one in-flight decode (dedupe by source identity)',
  )
  assert(drawCalls.length === 2, 'each caller still rasterizes its own bounds')

  // A later rebuild (ResizeObserver/orientation) reuses the decoded image.
  const third = await loadSvgTargets({ url: 'blob:a', bounds: { width: 300, height: 150 } })
  assert(
    third.ok && imageLoads.filter((url) => url === 'blob:a').length === 1,
    'a resize rebuild reuses the cached decode instead of decoding the URL again',
  )
  assert(third.x.length > 0, 'reused decode still produces visible targets')

  // A different source decodes independently.
  await loadSvgTargets({ url: 'blob:b', bounds: { width: 100, height: 100 } })
  assert(
    imageLoads.filter((url) => url === 'blob:b').length === 1,
    'a different source identity decodes on its own',
  )

  // Failures are never cached: a retry attempts a fresh decode.
  const badFirst = await loadSvgTargets({ url: 'blob:bad', bounds: { width: 100, height: 100 } })
  const badSecond = await loadSvgTargets({ url: 'blob:bad', bounds: { width: 100, height: 100 } })
  assert(!badFirst.ok && !badSecond.ok, 'undecodable sources report failure')
  assert(
    imageLoads.filter((url) => url === 'blob:bad').length === 2,
    'a failed decode is evicted so a later caller can retry',
  )

  // Intrinsic-dimension override: a collapsed 0×0 natural size falls back to
  // 1×1 without metadata, and to the sanitizer-resolved size with it.
  drawCalls.length = 0
  await loadSvgTargets({ url: 'blob:tiny', bounds: { width: 100, height: 100 } })
  const collapsedAspect = drawCalls[drawCalls.length - 1].w / drawCalls[drawCalls.length - 1].h
  await loadSvgTargets({
    url: 'blob:tiny',
    bounds: { width: 100, height: 100 },
    intrinsicWidth: 200,
    intrinsicHeight: 100,
  })
  const resolved = drawCalls[drawCalls.length - 1]
  const resolvedAspect = resolved.w / resolved.h
  assert(Math.abs(collapsedAspect - 1) < 0.001, '0×0 natural size still collapses without metadata')
  assert(
    Math.abs(resolvedAspect - 2) < 0.001,
    'sanitizer-resolved intrinsic dimensions override the collapsed natural size',
  )
}

// --- 5. Pond body containment -------------------------------------------------

function verifyPondContainment() {
  const mkBody = (x, y, vx, vy) => ({
    x, y, vx, vy, heading: 0, wanderPhase: 0, angularVelocity: 0, spinAngle: 0,
  })

  const left = mkBody(-10, 50, -5, 2)
  containPondBody(left, 100, 100)
  assert(left.x === 0 && left.vx === 0 && left.y === 50 && left.vy === 2,
    'a body past the left wall clamps to the edge and loses outward velocity')

  const corner = mkBody(150, -5, 3, -2)
  containPondBody(corner, 100, 100)
  assert(corner.x === 100 && corner.vx === 0 && corner.y === 0 && corner.vy === 0,
    'a body past two walls clamps both axes and kills both outward components')

  const inside = mkBody(50, 60, 1, -1)
  containPondBody(inside, 100, 100)
  assert(inside.x === 50 && inside.y === 60 && inside.vx === 1 && inside.vy === -1,
    'an in-bounds body is untouched')

  const inward = mkBody(150, 50, -3, 0)
  containPondBody(inward, 100, 100)
  assert(inward.x === 100 && inward.vx === -3,
    'a clamped body keeps inward velocity (only the outward component dies)')
}

// --- 6. PortfolioExperience transactional wiring (structural guards) ----------

function verifyPortfolioWiring() {
  const source = fs.readFileSync(
    path.join(projectRoot, 'components', 'PortfolioExperience.tsx'),
    'utf8',
  )

  assert(
    !source.includes("file.type === 'image/svg+xml'"),
    'upload routing no longer depends on an exact MIME match',
  )
  assert(
    source.includes('resolveUploadRoute('),
    'upload files route through resolveUploadRoute (MIME-tolerant)',
  )
  assert(
    source.includes('createSvgObjectUrl('),
    'the renderer URL is a Blob URL minted from sanitized markup',
  )
  assert(
    !source.includes('data:image/svg+xml;base64'),
    'no base64 data URL construction remains in the upload path',
  )
  assert(
    source.includes('resolveSourcePromotion('),
    'candidates probe through resolveSourcePromotion before promotion',
  )
  assert(
    source.indexOf('resolveSourcePromotion(') < source.indexOf("recordVibeTransaction('source'"),
    'the history transaction is recorded only after the candidate probe',
  )
  assert(
    source.includes('++uploadRequestRef.current') &&
      source.includes('requestId !== uploadRequestRef.current'),
    'a request-generation guard rejects stale upload attempts',
  )
  assert(
    source.includes('urlRegistryRef.current.release(candidateOwnedUrl)'),
    'failed/stale candidate Blob URLs are released through the registry',
  )
  assert(
    source.includes('urlRegistryRef.current.releaseOrphans(new Set())'),
    'reset/unmount releases every remaining owned URL at once',
  )
}

async function main() {
  await verifyDecodeCache()
  verifyPondContainment()
  verifyPortfolioWiring()

  if (failures > 0) {
    console.error(`\n${failures} verification(s) failed.`)
    process.exit(1)
  }
  console.log('\nAll SVG lifecycle verifications passed.')
}

main().catch((error) => {
  console.error('Verification crashed:', error)
  process.exit(1)
})
