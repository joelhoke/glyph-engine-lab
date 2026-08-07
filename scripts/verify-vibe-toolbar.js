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

// --- share chooser: nonmodal, accessible, four peers, PNG retained -------------------------

assert(
  toolbarSource.includes('vibe-share-chooser') &&
    toolbarSource.includes('Share image') &&
    toolbarSource.includes('CLIP_DURATION_OPTIONS_SECONDS') &&
    toolbarSource.includes('Share {seconds}s clip') &&
    toolbarSource.includes('clip.start(seconds)'),
  'share opens a chooser with four peers: "Share image" + 5/10/15s clips, each starting with its duration',
)
assert(
  toolbarSource.includes('shareImageButtonRef.current?.focus()'),
  'opening the chooser focuses "Share image"',
)
assert(
  /aria-expanded=\{isShare \? shareChooserOpen : undefined\}/.test(toolbarSource) &&
    /aria-controls=\{isShare && shareChooserOpen \? shareChooserId : undefined\}/.test(toolbarSource),
  'the Share utility carries aria-expanded/aria-controls for the chooser',
)
assert(
  /handleKeyDown[\s\S]*?Escape[\s\S]*?closeShareChooser/.test(toolbarSource) &&
    toolbarSource.includes('closeShareChooser'),
  'Escape closes the chooser and restores focus to the Share button',
)
assert(
  /utilityButtonRefs\.current\.share\?\.focus\(\)/.test(toolbarSource),
  'closing the chooser returns focus to the Share utility button',
)
assert(
  toolbarSource.includes('handleShareClick') && toolbarSource.includes('handleShare()'),
  'the PNG export path is retained behind the chooser',
)

// --- clip recording states ----------------------------------------------------------------

assert(
  toolbarSource.includes('vibe-clip-countdown') &&
    toolbarSource.includes('formatClipCountdown') &&
    toolbarSource.includes('vibe-clip-cancel'),
  'recording shows a countdown chip with Cancel',
)
assert(
  /aria-hidden="true"[\s\S]{0,120}formatClipCountdown|formatClipCountdown[\s\S]{0,200}aria-hidden/.test(toolbarSource) ||
    toolbarSource.includes('className="vibe-clip-countdown" aria-hidden="true"'),
  'the countdown is aria-hidden (no per-tick announcements)',
)
assert(
  toolbarSource.includes('role="status"') && toolbarSource.includes('clip.announcement'),
  'a restrained live-status region carries recording announcements',
)
assert(
  /disabled = clipRecordingActive/.test(toolbarSource),
  'Reset and duplicate Share disable while recording',
)
assert(
  toolbarSource.includes('transportDisabled={clipRecordingActive}'),
  'the debug Sound transport disables while recording',
)

// --- clip preview + share/download fallback -------------------------------------------------

assert(
  toolbarSource.includes('vibe-clip-preview-video') &&
    toolbarSource.includes('playsInline') &&
    toolbarSource.includes('controls') &&
    !/autoPlay/.test(toolbarSource),
  'the preview is a non-autoplaying <video controls playsInline>',
)
for (const action of ['Share clip', 'Download', 'Retake', 'Close']) {
  assert(toolbarSource.includes(action), `preview exposes "${action}"`)
}
assert(
  /handleShareClip[\s\S]*?navigator\.canShare[\s\S]*?navigator\.share/.test(toolbarSource),
  'clip share tries the native sheet from the completed-state button',
)
assert(
  /catch \(err\)[\s\S]*?AbortError[\s\S]*?downloadClip\(\)/.test(toolbarSource) ||
    /else \{\s*downloadClip\(\)/.test(toolbarSource),
  'clip share falls back to download when sharing is unsupported or fails',
)
assert(
  toolbarSource.includes('clip.releasePreview()'),
  'a successful clip share releases the preview',
)

// --- clip container validation + diagnostics UI -----------------------------------------------

const clipCoreSource = fs.readFileSync(
  path.join(projectRoot, 'engine', 'clipRecorder.ts'),
  'utf8',
)
assert(
  clipCoreSource.includes('probeClipContainer') &&
    clipCoreSource.includes('produced no picture'),
  'the recorder core validates the finished container and rejects audio-only files',
)
assert(
  fs.existsSync(path.join(projectRoot, 'engine', 'clipContainerProbe.ts')),
  'the container probe is a pure engine module (browser + Node testable)',
)
assert(
  toolbarSource.includes('vibe-clip-diagnostics') &&
    /debugMode && clip\.diagnostics/.test(toolbarSource) &&
    /clip\.diagnostics && \(/.test(toolbarSource),
  'the diagnostics block renders in the failure state always and under debugMode otherwise',
)
assert(
  toolbarSource.includes('onError={(event) =>') && toolbarSource.includes('reportPreviewError'),
  'preview video decode errors surface into the visible error state',
)
assert(
  /vibe-clip-error[\s\S]*?Retake[\s\S]*?Close/.test(toolbarSource),
  'the failure state offers Retake/Close instead of an audio-only preview',
)

// --- clip capture pipeline (hook) ------------------------------------------------------------

const clipHookSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'vibe', 'useClipRecorder.ts'),
  'utf8',
)
assert(
  /durationSeconds \? durationSeconds \* 1000 : CLIP_DURATION_DEFAULT_MS/.test(clipHookSource),
  'the chosen duration flows into the active-time target (default 15s)',
)
assert(
  clipHookSource.includes('overrideRef.current ??'),
  'the dev-only ?clipTestMs= override takes precedence over chosen durations',
)
assert(
  clipHookSource.includes('staging.captureStream(30)') &&
    clipHookSource.includes('stagingCtx.drawImage(canvas, 0, 0') &&
    clipHookSource.includes('requestAnimationFrame(pump)') &&
    clipHookSource.includes('resolveClipCaptureSize'),
  'capture routes through a resolution-capped CPU staging canvas on a rAF drawImage pump (Safari/mp4 fixes)',
)
assert(
  clipHookSource.includes('GPU-accelerated') && clipHookSource.includes('audio-only'),
  'the Safari/mp4 audio-only root cause is documented at the fix site',
)
assert(
  clipHookSource.includes('.captureStream(30)'),
  'the clip captures ONLY canvas pixels via captureStream(30) (DOM chrome can never appear)',
)
assert(
  clipHookSource.includes(".getAudioTracks()[0]?.clone()"),
  'a CLONED audio track is recorded (the original keeps feeding the speakers)',
)
assert(
  clipHookSource.includes('beginCapture()') &&
    clipHookSource.includes('CLIP_AUDIO_FAILURE_MESSAGE'),
  'a missing audio capture stream fails visibly instead of exporting silent video',
)
assert(
  clipHookSource.includes('URL.createObjectURL') && clipHookSource.includes('URL.revokeObjectURL'),
  'preview object URLs are created and revoked through the recorder core',
)
assert(
  clipHookSource.includes('createClipRecorder') &&
    clipHookSource.includes('getCanvasSize'),
  'the pure recorder core runs with a canvas backing-size guard',
)
assert(
  clipHookSource.includes('reduced motion'),
  'reduced-motion recordings get deterministic frames from the rAF staging pump',
)
assert(
  clipHookSource.includes('preferPlainContainers') && /safari/i.test(clipHookSource),
  'Safari (UA-detected) prefers plain container MIMEs over codecs-parameterized ones',
)
assert(
  clipHookSource.includes('frameFlow') && clipHookSource.includes('isFlowing') &&
    clipHookSource.includes('framesPumpedRef') && clipHookSource.includes("addEventListener('unmute'"),
  'a frame-flow watchdog fails a frameless recording within ~1s of active time',
)
assert(
  clipHookSource.includes('collectDiagnostics') && clipHookSource.includes('reportPreviewError'),
  'the hook collects Safari-readable diagnostics and surfaces preview decode errors',
)

// --- parent wiring (clip) ---------------------------------------------------------------------

assert(
  parentSource.includes('clip={clipRecorder}'),
  'PortfolioExperience passes the clip recorder controls to the toolbar',
)
assert(
  parentSource.includes('useClipRecorder({') &&
    parentSource.includes('beginCapture: sonification.beginCapture'),
  'PortfolioExperience wires sonification beginCapture into the clip recorder',
)
assert(
  parentSource.includes("enabled: displayed === 'vibe'"),
  'the sonification hook is enabled throughout Vibe Mode (production clip recording)',
)
assert(
  parentSource.includes('clipTestMs'),
  'the dev-only ?clipTestMs= test hook is wired',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll vibe toolbar verifications passed.')
