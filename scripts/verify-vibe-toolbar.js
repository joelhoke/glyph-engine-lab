#!/usr/bin/env node
/**
 * Structural verification for the Vibe toolbar (launch items 5 + 6 wiring):
 * reads the toolbar/panel sources and asserts the required structure —
 *
 * - no <img> icon elements in VibeToolbar (icons are CSS masks)
 * - category buttons carry aria-expanded / aria-controls (and no aria-pressed,
 *   no aria-controls on the capsule)
 * - roving-tabindex arrow-key handling exists (ArrowLeft/ArrowRight/Home/End)
 * - Escape never calls a close/collapse path (no onClose prop at all)
 * - palette + color-distribution controls live in ColorStylesPanel, not
 *   TextEffectsPanel
 * - the utility row wires undo/redo/refresh(=full reset)/share
 * - the Paint popout exposes a clear-paint action
 * - share uses the canvasRef PNG export with a download fallback
 * - PortfolioExperience passes the unified-history props (canUndo/canRedo,
 *   onUndo/onRedo, onReset, canvasRef, onPaintStrokeEnd)
 */

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const toolbarSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'vibe', 'VibeToolbar.tsx'),
  'utf8',
)
const textPanelSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'vibe', 'TextEffectsPanel.tsx'),
  'utf8',
)
const colorPanelSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'vibe', 'ColorStylesPanel.tsx'),
  'utf8',
)
const paintPanelSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'vibe', 'PaintPanel.tsx'),
  'utf8',
)
const parentSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'PortfolioExperience.tsx'),
  'utf8',
)

// --- icons as CSS masks -------------------------------------------------------

assert(!/<img[\s>]/.test(toolbarSource), 'VibeToolbar contains no <img> icon elements')
assert(
  /maskImage:\s*`url\(\$\{icon\}\)`/.test(toolbarSource) && /currentColor/.test(
    fs.readFileSync(path.join(projectRoot, 'app', 'globals.css'), 'utf8'),
  ),
  'icons render as CSS masks (mask-image url) over currentColor',
)

// --- aria correctness -----------------------------------------------------------

assert(toolbarSource.includes('aria-expanded='), 'category buttons carry aria-expanded')
assert(toolbarSource.includes('aria-controls={isActive ? panelId : undefined}'), 'category buttons point aria-controls at the popout panel id only while open')
assert(!toolbarSource.includes('aria-pressed'), 'category buttons do not use aria-pressed (redundant with aria-expanded)')

const capsuleBlock = toolbarSource.slice(
  toolbarSource.indexOf('vibe-toolbar-capsule"'),
  toolbarSource.indexOf('vibe-toolbar-capsule"') + 400,
)
assert(!capsuleBlock.includes('aria-controls'), 'the capsule does not carry the misplaced aria-controls')

// --- roving arrow-key focus -------------------------------------------------------

for (const key of ["'ArrowLeft'", "'ArrowRight'", "'Home'", "'End'"]) {
  assert(toolbarSource.includes(key), `roving focus handles ${key}`)
}
assert(
  /tabIndex=\{[^}]*categoryFocusIndex/.test(toolbarSource) &&
    /tabIndex=\{[^}]*utilityFocusIndex/.test(toolbarSource),
  'roving tabindex is applied to both the category row and the utility row',
)

// --- Escape semantics --------------------------------------------------------------

assert(!/onClose/.test(toolbarSource), 'no onClose/close path remains in the toolbar (Escape only closes popouts)')
assert(
  /if \(!selectedTool\) return/.test(toolbarSource),
  'Escape with no popout open does nothing',
)

// --- no initial popout --------------------------------------------------------------

assert(
  /useState<VibeToolbarTool>\(null\)/.test(toolbarSource) &&
    /setSelectedTool\(null\)/.test(toolbarSource),
  'the toolbar activates with no popout open (selectedTool starts/resets to null)',
)

// --- panel mapping ----------------------------------------------------------------------

assert(
  colorPanelSource.includes('glyphPalette') && colorPanelSource.includes('glyphColorMode'),
  'glyph palette and color distribution controls live in ColorStylesPanel',
)
assert(
  colorPanelSource.includes('backgroundColor1') && colorPanelSource.includes('backgroundColor2'),
  'background colors stay in ColorStylesPanel',
)
assert(
  !textPanelSource.includes('glyphPalette') && !textPanelSource.includes('glyphColorMode'),
  'TextEffectsPanel no longer carries palette/distribution controls',
)
assert(
  textPanelSource.includes('glyphText') &&
    textPanelSource.includes('glyphFont') &&
    textPanelSource.includes('glyphSizePt'),
  'TextEffectsPanel keeps glyph text, font, and size',
)
assert(
  textPanelSource.includes('GLYPH_POINT_SIZE_OPTIONS') &&
    textPanelSource.includes("'glyphSizePt'"),
  'glyph size is a select over the six point-size options, recorded under the glyphSizePt history key',
)
assert(
  textPanelSource.includes('onCommitText') && textPanelSource.includes('onBlur={commitGlyphText}'),
  'glyph text commits once per editing session (onCommitText on blur)',
)

// --- utility row mapping -----------------------------------------------------------------

assert(
  /case 'undo':[\s\S]*?onClick = onUndo/.test(toolbarSource),
  'utility undo calls the unified onUndo',
)
assert(
  /case 'redo':[\s\S]*?onClick = onRedo/.test(toolbarSource),
  'utility redo calls the unified onRedo',
)
assert(
  /case 'refresh':[\s\S]*?onClick = onReset/.test(toolbarSource),
  'utility refresh calls the full curated reset (onReset), not clear-paint',
)
assert(
  toolbarSource.includes('disabled = !canUndo') && toolbarSource.includes('disabled = !canRedo'),
  'undo/redo buttons disable from the unified canUndo/canRedo flags',
)
assert(!/onUndoPaint|onRedoPaint/.test(toolbarSource), 'paint-only undo/redo props are gone from the toolbar')

// --- paint popout clear-paint --------------------------------------------------------------

assert(
  paintPanelSource.includes('onClearPaint') && paintPanelSource.includes('Clear paint'),
  'the Paint popout exposes a Clear paint action',
)
assert(
  paintPanelSource.includes('clearDisabled') &&
    /clearDisabled=\{!paintStatus \|\| paintStatus\.strokeCount === 0\}/.test(toolbarSource),
  'Clear paint disables when nothing is painted (paintStatus.strokeCount)',
)

// --- share: native first, PNG download fallback -----------------------------------------------

assert(toolbarSource.includes('canvasRef'), 'the toolbar receives the canvasRef prop for sharing')
assert(
  toolbarSource.includes("canvas.toBlob") && toolbarSource.includes("'image/png'"),
  'share exports the canvas as a PNG blob',
)
assert(
  toolbarSource.includes('navigator.share') && toolbarSource.includes('navigator.canShare'),
  'share tries the native share sheet first',
)
assert(
  toolbarSource.includes("link.download = 'joel-hoke-vibe.png'") ||
    /link\.download = '[^']+\.png'/.test(toolbarSource),
  'share falls back to a PNG download',
)

// --- parent wiring ------------------------------------------------------------------------------

assert(
  parentSource.includes('canUndo={vibeCanUndo}') &&
    parentSource.includes('canRedo={vibeCanRedo}') &&
    parentSource.includes('onUndo={handleUndoVibe}') &&
    parentSource.includes('onRedo={handleRedoVibe}') &&
    parentSource.includes('onReset={handleResetPlaygroundConfig}') &&
    parentSource.includes('canvasRef={sceneCanvasRef}'),
  'PortfolioExperience passes the unified-history props to the toolbar',
)
assert(
  parentSource.includes('onPaintStrokeEnd={handlePaintStrokeEnd}'),
  'PortfolioExperience wires onPaintStrokeEnd into the canvas',
)
assert(!/onClose=/.test(parentSource), 'PortfolioExperience no longer passes onClose')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll vibe toolbar verifications passed.')
