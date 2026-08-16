#!/usr/bin/env node
/**
 * Verification for the ambient scene wipe in components/SceneCanvas.tsx:
 * the beginAmbientWipe handle method, the 650ms ease-in-out directional
 * reveal (next = right-to-left), snapshot release on completion, wipe frames
 * excluded from adaptive-quality sampling, the reduced-motion decline path
 * (returns false, onAmbientWipeEnd still fires), and the already-active
 * guard. Component wiring is asserted as source text; the quality
 * controller's `wiped` flag is asserted behaviorally on the compiled engine.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'qualityTiers.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-ambient-wipe')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${sourceFile}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const { createQualityController } = require(path.join(tmpDir, 'qualityTiers.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// (1) the controller ignores windows containing wipe frames (behavioral)
{
  const controller = createQualityController({ mobile: false, mountMs: 0 })
  // Past warm-up: two consecutive bad windows step the tier down — unless a
  // window carries a wiped frame, in which case it is ignored entirely
  // (counters untouched). One feedWindow = one full 2s evaluation window of
  // bad frames (renderMs 40); the window closes on its 11th frame.
  let t = 4000
  const feedWindow = (wipedFrames) => {
    for (let f = 0; f <= 10; f += 1) {
      controller.recordFrame({ timestampMs: t, renderMs: 40, wiped: f < wipedFrames })
      t += 200
    }
  }
  feedWindow(0) // clean bad window: consecutiveBad = 1
  feedWindow(3) // contains wipe frames: ignored, counter untouched
  assert(controller.getTier() === 0, 'windows containing wipe frames are ignored (no step-down)')
  feedWindow(0) // clean bad window: consecutiveBad = 2 → step down
  assert(controller.getTier() === 1, 'clean bad windows still step the tier down')
}

// (2) SceneCanvas wiring (source-text invariants)
{
  const src = fs.readFileSync(path.join(projectRoot, 'components', 'SceneCanvas.tsx'), 'utf8')

  assert(
    src.includes("beginAmbientWipe: (direction: 'next' | 'prev') => boolean"),
    'SceneCanvasHandle exposes beginAmbientWipe(direction) returning boolean',
  )
  assert(
    /useImperativeHandle\(ref, \(\) => \(\{[\s\S]*?beginAmbientWipe,/.test(src),
    'beginAmbientWipe is wired into the imperative handle',
  )
  assert(
    src.includes('const AMBIENT_WIPE_DURATION_MS = 650'),
    'the wipe runs over exactly 650 ms',
  )
  assert(
    src.includes('const easeInOutQuad = (t: number)') &&
      (src.match(/easeInOutQuad/g) || []).length >= 3,
    'the wipe reuses the theme fade’s ease-in-out (quadratic) helper',
  )
  // Directional reveal: 'next' clips the snapshot's right edge away first
  // (revealed edge travels right → left); 'prev' mirrors it.
  assert(
    src.includes("ambientWipeDirectionRef.current === 'next'") &&
      /ctx\.rect\(0, 0, W \* \(1 - eased\), H\)/.test(src) &&
      /ctx\.rect\(W \* eased, 0, W \* \(1 - eased\), H\)/.test(src),
    'next reveals right-to-left, prev left-to-right (shrinking snapshot clip)',
  )
  // Snapshot at CSS-pixel resolution, canvas pixels only.
  assert(
    /const W = canvas\.width \/ pixelRatio[\s\S]*?snapshotCtx\.drawImage\(canvas, 0, 0, W, H\)/.test(
      src,
    ),
    'the snapshot is captured at CSS-pixel resolution from canvas pixels',
  )
  // Released on completion (ref nulled, canvas dropped) + callback fired.
  assert(
    /wipeT >= 1 \|\| !wipeCanvas\) \{[\s\S]*?ambientWipeCanvasRef\.current = null[\s\S]*?onAmbientWipeEndRef\.current\?\.\(\)/.test(
      src,
    ),
    'the snapshot is released and onAmbientWipeEnd fires on completion',
  )
  // Quality sampling exclusion via the pending-flag idiom.
  assert(
    src.includes('qualityWipePendingRef.current = true') &&
      src.includes('wiped: qualityWipePendingRef.current'),
    'wipe frames are excluded from adaptive-quality sampling via a pending flag',
  )
  // Reduced motion: no wipe, but the callback still fires (microtask) so the
  // parent can always rely on it to unlock.
  assert(
    /if \(reducedMotionRef\.current\) \{\s*queueMicrotask\(\(\) => onAmbientWipeEndRef\.current\?\.\(\)\)\s*return false/.test(
      src,
    ),
    'reduced motion returns false and still fires onAmbientWipeEnd',
  )
  // Already active: ignored, no double snapshot, no extra callback.
  assert(
    /if \(ambientWipeCanvasRef\.current\) return false/.test(src),
    'a second beginAmbientWipe while a wipe is active is ignored',
  )
  // onAmbientWipeEnd is an optional prop mirrored into a ref.
  assert(
    src.includes('onAmbientWipeEnd?: () => void') &&
      src.includes('onAmbientWipeEndRef.current = onAmbientWipeEnd'),
    'onAmbientWipeEnd is an optional prop mirrored into a ref',
  )
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll ambient wipe checks passed')
