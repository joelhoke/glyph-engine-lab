#!/usr/bin/env node
/**
 * Verification for the ambient render-performance work: the heavy-scene
 * classification, reduced-resolution layer scale, and physics cadence caps in
 * engine/ambientField.ts (behavioral, compiled), plus the SceneCanvas draw
 * path invariants (source text): fog sprites from a bounded cache instead of
 * per-particle gradients, rain/storm streaks batched per alpha bucket,
 * snow/blizzard font/fillStyle batched per (size, alpha) bucket, heavy scenes
 * composited from the reduced-resolution layer with smoothing, the heavy tick
 * clamp applied in updateAmbient, and off mode allocating/stepping nothing.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'ambientField.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify-ambient-render')

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

const {
  HEAVY_WEATHER_PRESETS,
  isHeavyWeatherPreset,
  resolveHeavyAmbientLayerScale,
  resolveHeavyAmbientTickCap,
} = require(path.join(tmpDir, 'ambientField.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// (1) heavy-scene classification (behavioral)
assert(
  JSON.stringify(HEAVY_WEATHER_PRESETS) ===
    JSON.stringify(['rain', 'storm', 'snow', 'blizzard', 'fog']),
  'heavy presets are exactly rain, storm, snow, blizzard, fog',
)
for (const preset of ['rain', 'storm', 'snow', 'blizzard', 'fog']) {
  assert(isHeavyWeatherPreset(preset), `${preset} is a heavy scene`)
}
for (const preset of ['clear', 'wind']) {
  assert(!isHeavyWeatherPreset(preset), `${preset} stays on the direct full-res path`)
}

// (2) reduced-resolution layer scale (behavioral)
assert(resolveHeavyAmbientLayerScale(0) === 0.5, 'T0 heavy layer renders at 0.5')
assert(resolveHeavyAmbientLayerScale(1) === 0.5, 'T1 heavy layer renders at 0.5')
assert(resolveHeavyAmbientLayerScale(2) === 0.4, 'T2 heavy layer renders at 0.4')
assert(resolveHeavyAmbientLayerScale(3) === 0.4, 'T3 heavy layer renders at 0.4')

// (3) heavy-scene physics cadence caps (behavioral)
assert(resolveHeavyAmbientTickCap(0) === 20, 'T0 heavy scenes cap at 20 Hz')
assert(resolveHeavyAmbientTickCap(1) === 20, 'T1 heavy scenes cap at 20 Hz')
assert(resolveHeavyAmbientTickCap(2) === 15, 'T2 heavy scenes cap at 15 Hz')
assert(resolveHeavyAmbientTickCap(3) === 15, 'T3 heavy scenes cap at 15 Hz')

// (4) SceneCanvas draw path (source-text invariants)
{
  const src = fs.readFileSync(path.join(projectRoot, 'components', 'SceneCanvas.tsx'), 'utf8')

  // Fog: prerendered sprites keyed by quantized (hue, alpha, radius); the
  // per-particle createRadialGradient in the draw loop is gone.
  assert(
    src.includes('const getFogSprite = (hue: number, alpha: number, radius: number)') &&
      src.includes('fogSpriteCacheRef'),
    'fog renders from a prerendered sprite cache',
  )
  {
    const fogBranch = src.match(/if \(preset === 'fog'\) \{[\s\S]*?\} else if \(precipitation/)
    assert(
      fogBranch !== null && !fogBranch[0].includes('createRadialGradient'),
      'the fog draw loop creates no per-particle gradients',
    )
  }
  assert(
    /if \(cache\.size >= 64\) cache\.clear\(\)/.test(src),
    'the fog sprite cache is bounded (64 entries, cleared on overflow)',
  )
  assert(
    /fogSpriteCacheRef\.current\.clear\(\)/.test(src),
    'the fog sprite cache is cleared on ambient rebuild',
  )

  // Rain/storm: streaks batched per quantized alpha bucket — one
  // beginPath/stroke per bucket, not per particle.
  assert(
    /target\.lineWidth = 1[\s\S]*?for \(let b = 0; b < AMBIENT_ALPHA_BUCKETS[\s\S]*?target\.beginPath\(\)[\s\S]*?if \(open\) target\.stroke\(\)/.test(
      src,
    ),
    'rain/storm streaks batch into one beginPath/stroke per alpha bucket',
  )
  assert(
    !/strokeStyle = `hsla\(\$\{hue\}, 60%, 70%/.test(src),
    'no per-particle streak strokeStyle remains',
  )

  // Snow/blizzard: fonts/fillStyles batched per quantized (size, alpha)
  // bucket; no per-particle font reset.
  assert(
    /sizeKey \* AMBIENT_ALPHA_BUCKETS \+ alphaKey/.test(src) &&
      /getScaledAmbientFont\(\(Math\.floor\(b \/ AMBIENT_ALPHA_BUCKETS\) \+ 1\) \/ 2\)/.test(src),
    'snow/blizzard flakes batch font/fillStyle per (size, alpha) bucket',
  )
  assert(
    !/ctx\.font = getScaledAmbientFont\(field\.size\[i\]\)/.test(src),
    'no per-particle ambient font change remains',
  )

  // Reduced-resolution heavy layer with smoothed upscale composite.
  assert(
    src.includes('const ensureAmbientWeatherLayer = (W: number, H: number, scale: number)') &&
      src.includes('resolveHeavyAmbientLayerScale(qualityBudgetRef.current.tier)') &&
      /ctx\.imageSmoothingEnabled = true[\s\S]*?ctx\.drawImage\(layer, 0, 0, W, H\)/.test(src),
    'heavy scenes render into a tier-scaled layer composited with smoothing',
  )
  assert(
    /ambientWeatherCanvasRef\.current = null/.test(src),
    'the heavy weather layer is dropped on ambient rebuild',
  )

  // Heavy-scene cadence clamp applied in updateAmbient on top of the tier
  // budget (qualityTiers.ts budgets themselves unchanged).
  assert(
    /isHeavyWeatherPreset\(config\.weather\.preset\)[\s\S]*?Math\.min\(budgetTickHz, resolveHeavyAmbientTickCap\(qualityBudgetRef\.current\.tier\)\)/.test(
      src,
    ),
    'updateAmbient clamps heavy scenes to 20/15 Hz by tier',
  )

  // Off mode: no pool, no grid, no layer, no stepping.
  assert(
    /config\.mode === 'off'\) \{[\s\S]*?ambientFieldRef\.current = null[\s\S]*?ambientGridRef\.current = null[\s\S]*?return/.test(
      src,
    ),
    'off mode allocates nothing (pool, grid, and layers all released)',
  )
  assert(
    /const updateAmbient = \(now: number\) => \{\s*const field = ambientFieldRef\.current\s*if \(!field\) return/.test(
      src,
    ),
    'off mode steps nothing (updateAmbient returns without a field)',
  )

  // Matrix trail layer and reduced-motion static pose are preserved.
  assert(
    src.includes("actx.globalCompositeOperation = 'destination-out'") &&
      src.includes('AMBIENT_REDUCED_POSE_TICKS'),
    'the matrix trail layer and the reduced-motion static pose are preserved',
  )
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll ambient render-performance checks passed')
