#!/usr/bin/env node
/**
 * Deterministic verification for system-driven light/dark themes
 * (feature/light-dark).
 *
 * Checks: the playground theme resolver (exact dark/light color tables for
 * every scene and vibe preset, deep-clone independence from the shared
 * tables), the theme-aware landing gradients, resolveThemedSourceUrl, the
 * globals.css token foundation (dark default on :root + light
 * prefers-color-scheme override with the exact core palettes, color-scheme
 * both ways, the exact 500ms transition duration, theme-ready gating, the
 * reduced-motion kill-switch), no data-theme attribute in layout.tsx, the
 * SceneCanvas cross-fade (500ms, snapshot release, reduced-motion bypass,
 * themed monogram fill + landing gradient), and that the theme effect in
 * PortfolioExperience never records vibe history nor marks the composition
 * visitor-edited.
 *
 * Compile TS to tmp-verify-theme, assert in Node — the standard idiom.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-theme')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'playgroundTheme.ts')}" "${path.join(projectRoot, 'engine', 'theme.ts')}" "${path.join(projectRoot, 'engine', 'backgroundLuminance.ts')}" "${path.join(projectRoot, 'engine', 'sceneConfig.ts')}" "${path.join(projectRoot, 'content', 'vibe.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  resolvePlaygroundConfig,
} = require(path.join(tmpDir, 'engine', 'playgroundTheme.js'))
const {
  CANVAS_THEMES,
  LANDING_CANVAS_GRADIENT,
  resolveThemedSourceUrl,
} = require(path.join(tmpDir, 'engine', 'theme.js'))
const {
  LANDING_GLYPH_GRADIENT,
  LANDING_GLYPH_GRADIENT_THEMES,
} = require(path.join(tmpDir, 'engine', 'backgroundLuminance.js'))
const {
  EXPERIENCE_SCENES,
  VIBE_THEMED_PLAYGROUND,
  WORK_THEME_COLORS,
  COLLABORATE_THEME_COLORS,
  resolveScenePlayground,
} = require(path.join(tmpDir, 'engine', 'sceneConfig.js'))
const { VIBE_PRESETS, getVibePreset } = require(path.join(tmpDir, 'content', 'vibe.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function assertColors(colors, backgroundColor1, backgroundColor2, palette, label) {
  assert(
    colors.backgroundColor1 === backgroundColor1 &&
      colors.backgroundColor2 === backgroundColor2 &&
      colors.glyphPalette.length === palette.length &&
      colors.glyphPalette.every((color, index) => color === palette[index]),
    label,
  )
}

// --- resolver: exact dark/light tables ----------------------------------------

{
  const dark = resolvePlaygroundConfig(VIBE_THEMED_PLAYGROUND, 'dark')
  assertColors(dark, '#0d0a14', '#1a1026',
    ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'],
    'vibe/signature dark table is the original composition')
  const light = resolvePlaygroundConfig(VIBE_THEMED_PLAYGROUND, 'light')
  assertColors(light, '#FAF7FF', '#E9E0F3',
    ['#E0110C', '#D07200', '#BCB200', '#0ABF1E', '#0673BE', '#7B21D4'],
    'vibe/signature light table is the midpoint ROYGBV palette')
}

assertColors(WORK_THEME_COLORS.dark, '#080b12', '#101826',
  ['#8abaff', '#bcd7ff', '#5a8fd6', '#dbe9ff'],
  'work/blueprint dark table is the original baseline')
assertColors(WORK_THEME_COLORS.light, '#E8EEF6', '#C9D8EA',
  ['#0C5E7D', '#224F7A', '#47729D', '#101826'],
  'work/blueprint light table is exact')

assertColors(COLLABORATE_THEME_COLORS.dark, '#100a0a', '#201410',
  ['#f2b28a', '#ffd9c4', '#d68a5a', '#fff0e6'],
  'collaborate/ember dark table is the original baseline')
assertColors(COLLABORATE_THEME_COLORS.light, '#FFF7F2', '#F1DDD2',
  ['#8A3F1A', '#A9562A', '#713415', '#5A2C18'],
  'collaborate/ember light table is exact')

{
  const mono = getVibePreset('mono')
  assert(!!mono && !!mono.config.dark && !!mono.config.light, 'mono preset carries themed color tables')
  assertColors(mono.config.dark, '#050505', '#141414',
    ['#f5f5f5', '#9a9a9a', '#ffffff'],
    'mono dark table is the original composition')
  assertColors(mono.config.light, '#FAFAFA', '#E5E7EB',
    ['#111827', '#4B5563', '#000000'],
    'mono light table is exact')
}

// every preset carries a complete themed config (dark + light tables)
for (const preset of VIBE_PRESETS) {
  assert(
    preset.config.dark && preset.config.light &&
      Array.isArray(preset.config.dark.glyphPalette) &&
      Array.isArray(preset.config.light.glyphPalette) &&
      typeof preset.config.glyphText === 'string' &&
      preset.config.motion && preset.config.ambient,
    `${preset.id}: preset config is themed (dark + light tables, theme-neutral rest)`,
  )
}

// signature preset mirrors the curated default composition
assert(
  getVibePreset('signature').config === VIBE_THEMED_PLAYGROUND,
  'signature preset mirrors the vibe default composition',
)

// --- resolver: deep-clone independence -----------------------------------------

{
  const themed = VIBE_THEMED_PLAYGROUND
  const paletteBefore = themed.light.glyphPalette.join(',')
  const resolved = resolvePlaygroundConfig(themed, 'light')
  resolved.glyphPalette[0] = '#000000'
  resolved.glyphPalette.push('#123456')
  resolved.motion.custom.form = 'jelly'
  resolved.motion.amount = -999
  resolved.ambient.weather.intensity = -999
  resolved.ambient.matrix.spread = -999
  assert(
    themed.light.glyphPalette.join(',') === paletteBefore &&
      themed.light.glyphPalette.length === 6,
    'mutating a resolved palette never affects the shared table',
  )
  assert(
    resolved.motion !== themed.motion &&
      resolved.motion.custom !== themed.motion.custom &&
      resolved.ambient !== themed.ambient &&
      resolved.ambient.weather !== themed.ambient.weather &&
      resolved.ambient.matrix !== themed.ambient.matrix,
    'resolved motion/ambient are clones, not shared references',
  )
  const again = resolvePlaygroundConfig(themed, 'light')
  assert(
    again.glyphPalette[0] === '#E0110C' &&
      themed.motion.amount === resolvePlaygroundConfig(themed, 'dark').motion.amount &&
      themed.motion.custom.form === resolvePlaygroundConfig(themed, 'dark').motion.custom.form,
    'shared tables are intact after a mutated resolution',
  )
}

// --- scene resolution requires a theme ------------------------------------------

{
  const workDark = resolveScenePlayground(EXPERIENCE_SCENES.work, 'dark')
  const workLight = resolveScenePlayground(EXPERIENCE_SCENES.work, 'light')
  assertColors(workDark, '#080b12', '#101826',
    ['#8abaff', '#bcd7ff', '#5a8fd6', '#dbe9ff'],
    'work scene resolves dark colors for the dark theme')
  assertColors(workLight, '#E8EEF6', '#C9D8EA',
    ['#0C5E7D', '#224F7A', '#47729D', '#101826'],
    'work scene resolves light colors for the light theme')

  const vibeDark = resolveScenePlayground(EXPERIENCE_SCENES.vibe, 'dark')
  assert(
    vibeDark.glyphPalette.join(',') === EXPERIENCE_SCENES.vibe.playground.glyphPalette.join(',') &&
      vibeDark.backgroundColor1 === EXPERIENCE_SCENES.vibe.playground.backgroundColor1,
    'dark scene resolution matches the baseline playground',
  )

  const collabLight = resolveScenePlayground(EXPERIENCE_SCENES.collaborate, 'light')
  assertColors(collabLight, '#FFF7F2', '#F1DDD2',
    ['#8A3F1A', '#A9562A', '#713415', '#5A2C18'],
    'collaborate scene resolves light colors for the light theme')

  // An authored story-level color override is theme-independent: it wins in
  // both themes.
  const overridden = {
    ...EXPERIENCE_SCENES.work,
    playground: {
      ...EXPERIENCE_SCENES.work.playground,
      glyphPalette: ['#010203'],
      backgroundColor1: '#040506',
      backgroundColor2: '#070809',
    },
  }
  const overriddenLight = resolveScenePlayground(overridden, 'light')
  assert(
    overriddenLight.glyphPalette.join(',') === '#010203' &&
      overriddenLight.backgroundColor1 === '#040506' &&
      overriddenLight.backgroundColor2 === '#070809',
    'story-level color overrides stick in the light theme',
  )
}

// --- theme-aware landing gradients -----------------------------------------------

assert(
  LANDING_GLYPH_GRADIENT.from === '#0C5E7D' && LANDING_GLYPH_GRADIENT.to === '#3B9EC8',
  'dark landing glyph gradient stays #0C5E7D → #3B9EC8',
)
assert(
  LANDING_GLYPH_GRADIENT_THEMES.dark === LANDING_GLYPH_GRADIENT,
  'the dark theme keeps the original landing gradient object',
)
assert(
  LANDING_GLYPH_GRADIENT_THEMES.light === LANDING_GLYPH_GRADIENT &&
    LANDING_GLYPH_GRADIENT_THEMES.light.from === '#0C5E7D' &&
    LANDING_GLYPH_GRADIENT_THEMES.light.to === '#3B9EC8',
  'the light theme shares the same landing gradient (#0C5E7D → #3B9EC8)',
)
assert(
  LANDING_CANVAS_GRADIENT.dark.color1 === '#090C12' &&
    LANDING_CANVAS_GRADIENT.dark.color2 === '#101826',
  'dark landing canvas gradient stays #090C12 → #101826',
)
assert(
  LANDING_CANVAS_GRADIENT.light.color1 === '#F4F6F9' &&
    LANDING_CANVAS_GRADIENT.light.color2 === '#DCE7F3',
  'light landing canvas gradient is exactly #F4F6F9 → #DCE7F3',
)
assert(
  CANVAS_THEMES.light.page === '#F4F6F9' &&
    CANVAS_THEMES.light.surface === '#FFFFFF' &&
    CANVAS_THEMES.light.text === '#101826' &&
    CANVAS_THEMES.light.textMuted === '#44536A' &&
    CANVAS_THEMES.light.border === 'rgba(16, 24, 38, 0.14)' &&
    CANVAS_THEMES.light.accent === '#0C5E7D',
  'CANVAS_THEMES light core palette is exact',
)

// --- themed source resolution ------------------------------------------------------

assert(
  resolveThemedSourceUrl('/a.svg', '/a-light.svg', 'light') === '/a-light.svg',
  'light theme prefers the light source variant',
)
assert(
  resolveThemedSourceUrl('/a.svg', '/a-light.svg', 'dark') === '/a.svg' &&
    resolveThemedSourceUrl('/a.svg', undefined, 'light') === '/a.svg' &&
    resolveThemedSourceUrl('/a.svg', null, 'light') === '/a.svg',
  'dark theme and missing variants fall back to the base source',
)

// --- globals.css token foundation ---------------------------------------------------

const globalsCss = fs.readFileSync(path.join(projectRoot, 'app', 'globals.css'), 'utf8')
const lightBlockStart = globalsCss.indexOf('@media (prefers-color-scheme: light)')
assert(lightBlockStart !== -1, 'globals.css carries a prefers-color-scheme: light override')
const lightBlock = globalsCss.slice(lightBlockStart, lightBlockStart + 4000)

assert(!/html\[data-theme=/.test(globalsCss), 'no data-theme token block remains in globals.css')
assert(
  globalsCss.includes('--theme-transition-duration: 500ms'),
  'theme transition duration is exactly 500ms',
)
assert(
  /:root\s*\{[^}]*color-scheme:\s*dark/s.test(globalsCss),
  'color-scheme: dark is set on :root',
)
assert(
  /color-scheme:\s*light/.test(lightBlock),
  'color-scheme: light is set in the light override',
)

for (const token of [
  '--color-page: #f4f6f9',
  '--color-canvas: #f4f6f9',
  '--color-surface: #ffffff',
  '--color-text: #101826',
  '--color-text-muted: #44536a',
  '--color-border: rgba(16, 24, 38, 0.14)',
  '--color-accent: #0c5e7d',
  '--color-accent-strong: #083f56',
  '--color-error: #a12a2a',
  '--color-success: #1c6b49',
  '--color-warm: #8a3f1a',
  '--color-chat-agent-surface: rgba(255, 255, 255, 0.94)',
  '--color-chat-agent-border: rgba(16, 24, 38, 0.10)',
  '--color-chat-user-surface: rgba(250, 231, 218, 0.92)',
  '--color-chat-user-border: rgba(138, 63, 26, 0.34)',
]) {
  assert(lightBlock.includes(token), `light override carries exact token "${token}"`)
}

{
  const rootStart = globalsCss.indexOf(':root')
  const rootBlock = globalsCss.slice(rootStart, rootStart + 3500)
  for (const token of [
    '--color-page: #090c12',
    '--color-canvas: #090c12',
    '--color-surface: #0e1620',
    '--color-text: #f7fbff',
    '--color-text-muted: #c5d4ea',
    '--color-border: rgba(255, 255, 255, 0.14)',
    '--color-accent: #8abaff',
    '--color-chat-agent-surface: rgba(6, 9, 14, 0.94)',
    '--color-chat-agent-border: rgba(255, 255, 255, 0.10)',
    '--color-chat-user-surface: rgba(66, 38, 29, 0.92)',
    '--color-chat-user-border: rgba(242, 178, 138, 0.36)',
  ]) {
    assert(rootBlock.includes(token), `:root dark default carries token "${token}"`)
  }
}

assert(
  globalsCss.includes('html.theme-ready'),
  'theme transitions are gated behind the theme-ready class',
)
{
  const reduceStart = globalsCss.indexOf('@media (prefers-reduced-motion: reduce)')
  assert(reduceStart !== -1, 'a prefers-reduced-motion block exists')
  const reduceBlock = globalsCss.slice(reduceStart)
  assert(
    /html\.theme-ready[\s\S]{0,1200}transition:\s*none/.test(reduceBlock),
    'the reduced-motion kill-switch disables theme transitions',
  )
}

// --- layout.tsx: no data-theme, themed fallback --------------------------------------

const layoutSrc = fs.readFileSync(path.join(projectRoot, 'app', 'layout.tsx'), 'utf8')
assert(!/data-theme/.test(layoutSrc), 'no data-theme attribute remains in layout.tsx')
assert(
  layoutSrc.includes('@media (prefers-color-scheme: light)'),
  'the inline critical fallback CSS carries a light media query',
)
assert(
  layoutSrc.includes('ThemeReady'),
  'layout mounts the ThemeReady hydration gate',
)

// --- SceneCanvas: cross-fade + themed colors -------------------------------------------

const sceneCanvasSrc = fs.readFileSync(
  path.join(projectRoot, 'components', 'SceneCanvas.tsx'),
  'utf8',
)
assert(
  sceneCanvasSrc.includes('THEME_FADE_DURATION_MS = 500'),
  'canvas cross-fade duration is exactly 500ms',
)
assert(
  sceneCanvasSrc.includes('themeFadeCanvasRef.current = null'),
  'the cross-fade snapshot is released after the fade',
)
assert(
  /if \(!reducedMotionRef\.current\) beginThemeFade\(\)/.test(sceneCanvasSrc),
  'the cross-fade is bypassed under reduced motion',
)
assert(
  sceneCanvasSrc.includes("light: '#101826'") && sceneCanvasSrc.includes('MONOGRAM_FILL[themeRef.current]'),
  'the built-in monogram renders #101826 on light (white on dark)',
)
assert(
  sceneCanvasSrc.includes('LANDING_GLYPH_GRADIENT_THEMES[themeRef.current]'),
  'the landing glyph gradient resolves per theme',
)
assert(
  /theme\?:\s*ThemeName/.test(sceneCanvasSrc),
  'SceneCanvas accepts a theme prop',
)

// --- PortfolioExperience: theme never enters vibe history -------------------------------

const parentSrc = fs.readFileSync(
  path.join(projectRoot, 'components', 'PortfolioExperience.tsx'),
  'utf8',
)
{
  const effectStart = parentSrc.indexOf('const vibeThemeAppliedRef')
  const effectEnd = parentSrc.indexOf('}, [theme])', effectStart)
  assert(effectStart !== -1 && effectEnd > effectStart, 'the theme follow-through effect exists')
  const effectSrc = parentSrc.slice(effectStart, effectEnd)
  assert(
    !/recordVibeTransaction|pushTransaction|undoTransaction|redoTransaction/.test(effectSrc),
    'the theme effect never calls vibe history record functions',
  )
  assert(
    !/vibeTouchedRef\.current\s*=\s*true/.test(effectSrc) &&
      effectSrc.includes('if (vibeTouchedRef.current) return'),
    'the theme effect never sets the visitor-edited flag and is gated by it',
  )
}
assert(
  parentSrc.includes('resolveThemedSourceUrl('),
  'work slide source resolution is theme-aware (guarded lightSourceUrl)',
)
assert(
  parentSrc.includes('theme={theme}'),
  'the resolved theme is passed to SceneCanvas',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll theme verifications passed.')
