#!/usr/bin/env node
/**
 * Deterministic verification for the field reveal module
 * (engine/introReveal.ts): per-order stagger-delay tables (bounds, ordering,
 * determinism), the per-glyph fade curve (clamps, endpoints, spread), and the
 * per-mode shipped defaults (landing center-out, work left-right, vibe
 * shuffle, collaborate uniform).
 *
 * Compile TS to tmp-verify-intro-reveal, assert in Node — the standard idiom.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-intro-reveal')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'introReveal.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  FIELD_REVEAL_DEFAULTS,
  REVEAL_STAGGER_ORDERS,
  buildStaggerDelays,
  isRevealStaggerOrder,
  revealEase,
  revealGlyphFade,
} = require(path.join(tmpDir, 'introReveal.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// A 4-point synthetic field: corners of the unit square.
const normX = Float32Array.from([0, 1, 0, 1])
const normY = Float32Array.from([0, 0, 1, 1])

// --- Shipped defaults: the vibe animation (shuffle) on every mode ---

for (const mode of ['landing', 'work', 'vibe', 'collaborate']) {
  const cfg = FIELD_REVEAL_DEFAULTS[mode]
  assert(cfg.staggerOrder === 'shuffle', `${mode} defaults to shuffle (the vibe animation)`)
  assert(
    cfg.riseOffsetPx === 48 && cfg.staggerPortion === 0.55 && cfg.durationMs === 900,
    `${mode} default: 48px rise, 0.55 spread, 900ms`,
  )
}

// --- Stagger delay tables ---

{
  const uniform = buildStaggerDelays('uniform', normX, normY)
  assert(uniform.length === 4 && [...uniform].every((d) => d === 0), 'uniform: all-zero delays')

  const lr = buildStaggerDelays('left-right', normX, normY)
  assert(lr[0] === 0 && lr[2] === 0 && lr[1] === 1 && lr[3] === 1, 'left-right: delay tracks normX')

  const co = buildStaggerDelays('center-out', normX, normY)
  // Unit-square corners are equidistant from the centroid: all delays equal,
  // and the farthest point normalizes to 1.
  assert(
    [...co].every((d) => Math.abs(d - 1) < 1e-6),
    'center-out: equidistant points share delay 1 (normalized)',
  )

  const ei = buildStaggerDelays('edges-in', normX, normY)
  assert(
    [...ei].every((d) => Math.abs(d) < 1e-6),
    'edges-in: inverse of center-out (farthest points start at 0)',
  )

  // A field with a clear center point: center-out starts nearest the centroid.
  const cx = Float32Array.from([0.5, 0, 1])
  const cy = Float32Array.from([0.5, 0, 0])
  const coCenter = buildStaggerDelays('center-out', cx, cy)
  assert(coCenter[1] === 1 && coCenter[2] === 1, 'center-out: farthest glyphs get delay 1')
  assert(coCenter[0] < coCenter[1], 'center-out: the centroid-nearest glyph fades first')

  const shuffled = buildStaggerDelays('shuffle', normX, normY)
  assert(shuffled.length === 4 && [...shuffled].every((d) => d >= 0 && d < 1), 'shuffle: delays within [0, 1)')
  const again = buildStaggerDelays('shuffle', normX, normY)
  assert([...shuffled].every((d, i) => d === again[i]), 'shuffle: deterministic across rebuilds')
  assert(new Set([...shuffled]).size > 1, 'shuffle: delays actually vary')

  const empty = buildStaggerDelays('left-right', new Float32Array(0), new Float32Array(0))
  assert(empty.length === 0, 'empty field yields an empty table')
}

// --- Fade curve ---

assert(revealGlyphFade(0, 0, 0.55) === 0, 'fade starts at 0 for the first glyph')
assert(revealGlyphFade(1, 1, 0.55) === 1, 'last glyph completes exactly at progress 1')
assert(revealGlyphFade(1, 0, 0.55) === 1, 'first glyph is fully in at progress 1')
assert(revealGlyphFade(0.5, 1, 0.55) === 0, 'last glyph has not started at progress 0.5')
assert(revealGlyphFade(-0.5, 0, 0.55) === 0, 'negative progress clamps to 0')
assert(revealGlyphFade(2, 1, 0.55) === 1, 'over-1 progress clamps to 1')
{
  const noStagger = revealGlyphFade(0.5, 0.9, 0)
  assert(noStagger > 0.8 && noStagger < 1, 'zero spread: delay is ignored, pure eased progress')
}

// --- Easing + order validation ---

assert(revealEase(0) === 0 && revealEase(1) === 1, 'ease endpoints are 0 and 1')
assert(revealEase(0.5) > 0.5, 'ease-out runs ahead of linear mid-way')
assert(isRevealStaggerOrder('shuffle') && !isRevealStaggerOrder('random'), 'stagger order guard')
assert(REVEAL_STAGGER_ORDERS.length === 5, 'exactly five stagger orders')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}
console.log('\nAll field reveal verifications passed.')
