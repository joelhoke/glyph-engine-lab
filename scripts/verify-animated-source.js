#!/usr/bin/env node
/**
 * Deterministic verification for the animated-source lifecycle (Stage 3):
 * engine/animatedSource.ts — the internal provider contract
 * (start/resize/renderFrame/setPaused/stop), the Black hole frame math, and
 * the tier-sized staging bounds.
 *
 * The DOM canvas factory is injected, so the whole lifecycle runs in Node
 * against a recording 2D-context stub: call order and idempotence,
 * deterministic frames (same seed + time → identical draw calls), pause
 * gating, error recovery (a failed frame returns false without destroying
 * the last valid frame; a provider that can never start reports its error),
 * and staging-surface size bounds.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-animated-source')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'animatedSource.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  BLACK_HOLE_REDUCED_POSE_TIME,
  buildBlackHoleModel,
  createBlackHoleProvider,
  renderBlackHoleFrame,
  resolveAnimatedStagingSize,
} = require(path.join(tmpDir, 'animatedSource.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- recording 2D-context stub ----------------------------------------------

function createStubContext() {
  const ops = []
  const ctx = {
    fillStyle: null,
    strokeStyle: null,
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    ops,
    clearRect: (...a) => ops.push(['clearRect', ...a]),
    beginPath: () => ops.push(['beginPath']),
    moveTo: (x, y) => ops.push(['moveTo', x, y]),
    lineTo: (x, y) => ops.push(['lineTo', x, y]),
    stroke: () => ops.push(['stroke', ctx.strokeStyle, ctx.lineWidth]),
    arc: (...a) => ops.push(['arc', ...a]),
    ellipse: (...a) => ops.push(['ellipse', ...a]),
    fill: () => ops.push(['fill', ctx.fillStyle, ctx.globalCompositeOperation]),
    createRadialGradient: (...a) => {
      ops.push(['createRadialGradient', ...a])
      return { addColorStop: () => {} }
    },
  }
  return ctx
}

function createStubFactory(ctx) {
  const canvases = []
  return {
    canvases,
    createCanvas: (w, h) => {
      const canvas = { width: w, height: h, getContext: () => ctx }
      canvases.push(canvas)
      return canvas
    },
  }
}

// --- lifecycle: call order and idempotence -----------------------------------

{
  const ctx = createStubContext()
  const factory = createStubFactory(ctx)
  const provider = createBlackHoleProvider({ createCanvas: factory.createCanvas })

  assert(provider.renderFrame(1) === false, 'renderFrame before start is a no-op (false)')
  assert(provider.isRunning() === false, 'provider is not running before start')

  provider.resize(800, 600)
  assert(factory.canvases.length === 0, 'resize before start is a no-op (no canvas allocated)')

  assert(provider.start({ width: 800, height: 600 }) === true, 'start succeeds with a 2D context')
  assert(provider.isRunning() === true, 'provider is running after start')
  assert(provider.start({ width: 400, height: 300 }) === true, 'start while running is idempotent')
  assert(factory.canvases.length === 1, 'idempotent start does not reallocate the canvas')

  assert(provider.renderFrame(1) === true, 'renderFrame succeeds after start')
  assert(ctx.ops.length > 0, 'a rendered frame issues draw calls')

  provider.setPaused(true)
  const opsBeforePause = ctx.ops.length
  assert(provider.renderFrame(2) === false, 'renderFrame while paused returns false')
  assert(ctx.ops.length === opsBeforePause, 'a paused frame issues no draw calls')
  provider.setPaused(false)
  assert(provider.renderFrame(2) === true, 'renderFrame resumes after unpause')

  provider.resize(1024, 768)
  assert(
    factory.canvases[0].width === 1024 && factory.canvases[0].height === 768,
    'resize after start re-sizes the owned canvas',
  )
  provider.resize(1024, 768)
  assert(provider.renderFrame(3) === true, 'same-size resize is a no-op and rendering continues')

  provider.stop()
  assert(provider.isRunning() === false, 'provider stops')
  assert(provider.renderFrame(4) === false, 'renderFrame after stop returns false')
  provider.stop()
  assert(provider.isRunning() === false, 'stop is idempotent')

  assert(provider.start({ width: 640, height: 480 }) === true, 'start works again after stop')
  assert(provider.renderFrame(4) === true, 'rendering works after a stop/start cycle')
  provider.stop()
}

// --- provider creation failure -------------------------------------------------

{
  const provider = createBlackHoleProvider({ createCanvas: () => null })
  assert(provider.start({ width: 100, height: 100 }) === false, 'start fails without a canvas')
  assert(
    typeof provider.getLastError() === 'string' && provider.getLastError().length > 0,
    'a failed start reports its error (no valid frame can ever exist)',
  )
  assert(provider.renderFrame(1) === false, 'renderFrame stays false after a failed start')
}

{
  const noCtxCanvas = { width: 10, height: 10, getContext: () => null }
  const provider = createBlackHoleProvider({ createCanvas: () => noCtxCanvas })
  assert(provider.start({ width: 100, height: 100 }) === false, 'start fails without a 2D context')
  assert(provider.getLastError() !== null, 'missing 2D context reports its error')
}

// --- frame error recovery: last valid frame is preserved ------------------------

{
  const ctx = createStubContext()
  const factory = createStubFactory(ctx)
  const provider = createBlackHoleProvider({ createCanvas: factory.createCanvas })
  provider.start({ width: 400, height: 400 })
  assert(provider.renderFrame(1) === true, 'healthy frame renders')
  const validOps = ctx.ops.length

  const originalStroke = ctx.stroke
  ctx.stroke = () => {
    throw new Error('stub draw failure')
  }
  assert(provider.renderFrame(2) === false, 'a throwing frame returns false instead of throwing')
  assert(
    provider.getLastError() === 'stub draw failure',
    'the failed frame records its error detail',
  )
  assert(
    ctx.ops.length >= validOps,
    'a failed frame never destroys previously drawn content (last valid frame preserved)',
  )

  ctx.stroke = originalStroke
  assert(provider.renderFrame(3) === true, 'the provider recovers on the next healthy frame')
  assert(provider.getLastError() === null, 'a healthy frame clears the recorded error')
  provider.stop()
}

// --- deterministic frame math ---------------------------------------------------

{
  const modelA = buildBlackHoleModel()
  const modelB = buildBlackHoleModel()
  assert(
    Buffer.from(modelA.orbitT.buffer).equals(Buffer.from(modelB.orbitT.buffer)) &&
      Buffer.from(modelA.angle0.buffer).equals(Buffer.from(modelB.angle0.buffer)),
    'the black-hole model is seed-deterministic',
  )

  const ctxA = createStubContext()
  const ctxB = createStubContext()
  const ctxC = createStubContext()
  renderBlackHoleFrame(ctxA, modelA, 800, 600, BLACK_HOLE_REDUCED_POSE_TIME)
  renderBlackHoleFrame(ctxB, modelA, 800, 600, BLACK_HOLE_REDUCED_POSE_TIME)
  renderBlackHoleFrame(ctxC, modelA, 800, 600, BLACK_HOLE_REDUCED_POSE_TIME + 0.25)
  assert(
    JSON.stringify(ctxA.ops) === JSON.stringify(ctxB.ops),
    'same time → identical draw calls (deterministic reduced-motion frame)',
  )
  assert(
    JSON.stringify(ctxA.ops) !== JSON.stringify(ctxC.ops),
    'different time → different frame (the disk actually rotates)',
  )

  // The frame samples into a readable glyph field: star trails, a photon
  // ring, and a destination-out event horizon.
  const ops = ctxA.ops
  assert(ops.filter((op) => op[0] === 'stroke').length > 100, 'the disk draws many star trails')
  assert(ops.some((op) => op[0] === 'ellipse'), 'a photon ring ellipse is drawn')
  assert(
    ops.some((op) => op[0] === 'fill' && op[2] === 'destination-out'),
    'the event horizon is punched out with destination-out compositing',
  )
  for (const op of ops) {
    for (let i = 1; i < op.length; i += 1) {
      if (typeof op[i] === 'number') {
        assert(Number.isFinite(op[i]), `draw call argument is finite (${op[0]})`)
        break
      }
    }
  }
}

// --- staging surface bounds ------------------------------------------------------

{
  const t0 = resolveAnimatedStagingSize(1920, 1080, 0)
  assert(t0.width === 720 && t0.height === 405, 'T0 staging caps the long edge at 720 and keeps aspect')
  const t2 = resolveAnimatedStagingSize(1920, 1080, 2)
  const t3 = resolveAnimatedStagingSize(1920, 1080, 3)
  assert(
    t0.width > t2.width && t2.width > t3.width,
    'staging size shrinks with the quality tier',
  )
  const small = resolveAnimatedStagingSize(300, 200, 0)
  assert(small.width === 300 && small.height === 200, 'small viewports are never upscaled')
  const degenerate = resolveAnimatedStagingSize(0, 0, 3)
  assert(
    degenerate.width >= 1 && degenerate.height >= 1,
    'staging dims are always ≥ 1 (getImageData-safe)',
  )
}

// --- no network in the animated-source module -------------------------------------

{
  const source = fs.readFileSync(path.join(projectRoot, 'engine', 'animatedSource.ts'), 'utf8')
  assert(
    !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket/.test(source),
    'animatedSource.ts contains no network APIs',
  )
}

// --- launch: the provider is retained but never selectable in production UI -------

{
  const controls = fs.readFileSync(path.join(projectRoot, 'components', 'vibe', 'VibeToolbar.tsx'), 'utf8')
  assert(
    !/black-hole|blackHole|BlackHole/.test(controls),
    'the Vibe toolbar exposes no black-hole option',
  )
  const parent = fs.readFileSync(path.join(projectRoot, 'components', 'PortfolioExperience.tsx'), 'utf8')
  assert(
    !/black-hole|blackHole|BlackHole|vibeBlackHole/.test(parent.replace(/retained in engine\/animatedSource\.ts|animated\s*\n?\s*\/{0,2}\s*Black-hole provider is retained/g, '')),
    'PortfolioExperience has no black-hole selection state or animated-source branch',
  )
  assert(
    !/kind:\s*'animated'/.test(parent),
    'no production code path constructs an animated source selection',
  )
  const analytics = fs.readFileSync(path.join(projectRoot, 'engine', 'analytics.ts'), 'utf8')
  assert(
    !/black-hole/.test(analytics),
    'analytics no longer references black-hole as a source option',
  )
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll animated-source verifications passed.')
