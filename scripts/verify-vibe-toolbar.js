#!/usr/bin/env node
/**
 * Structural verification for the Vibe toolbar (launch items 5 + 6 wiring and
 * the control-simplification pass): reads the toolbar/panel sources and
 * asserts the required structure —
 *
 * - the center toolbar is exactly the four simplified categories
 *   (upload/text/colorStyles/paint) — no motion/ambient/pond/sound, no
 *   debug-only category filtering
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
const toolbarConfigSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'vibe', 'toolbarConfig.ts'),
  'utf8',
)
const parentSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'PortfolioExperience.tsx'),
  'utf8',
)

// --- simplified four-category toolbar -------------------------------------------

assert(
  ["'upload'", "'text'", "'colorStyles'", "'paint'"].every((id) =>
    toolbarConfigSource.includes(id),
  ) &&
    !["'motion'", "'ambient'", "'pond'", "'sound'"].some((id) =>
      toolbarConfigSource.includes(id),
    ),
  'the toolbar categories are exactly upload/text/colorStyles/paint (no motion/ambient/pond/sound)',
)
assert(
  !toolbarConfigSource.includes('DEBUG_ONLY_CATEGORIES') &&
    !toolbarSource.includes('DEBUG_ONLY_CATEGORIES'),
  'debug-only category filtering is gone (no DEBUG_ONLY_CATEGORIES anywhere)',
)
for (const panel of ['MotionEffectsPanel', 'AmbientPanel', 'PondPanel', 'SoundPanel']) {
  assert(
    !toolbarSource.includes(panel),
    `VibeToolbar no longer imports or renders ${panel}`,
  )
}
assert(
  !/pond\??:|onPondChange|sound\??:|onSoundConfigChange|onSoundPlay|onSoundPause/.test(
    toolbarSource,
  ),
  'the pond/sound props are gone from the toolbar (the promoted controls own them)',
)
assert(
  !fs.existsSync(path.join(projectRoot, 'components', 'vibe', 'MotionEffectsPanel.tsx')) &&
    !fs.existsSync(path.join(projectRoot, 'components', 'vibe', 'AmbientPanel.tsx')) &&
    !fs.existsSync(path.join(projectRoot, 'components', 'vibe', 'SoundPanel.tsx')),
  'the motion/ambient/sound panel files are deleted',
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
  !toolbarSource.includes('transportDisabled'),
  'the toolbar no longer carries a sound transport (the Sound control owns it)',
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

// --- promoted controls: ambient carousel, pond, sound (parent wiring) -----------

assert(
  /displayed === 'vibe' && vibeControlsOpen && \([\s\S]*?<AmbientCarousel[\s\S]*?<PondControl[\s\S]*?<SoundControl/.test(
    parentSource,
  ),
  'AmbientCarousel, PondControl, and SoundControl mount under the vibe controls gate',
)
assert(
  parentSource.includes('onPrevious={() => handleAmbientNavigate(\'prev\')}') &&
    parentSource.includes('onNext={() => handleAmbientNavigate(\'next\')}') &&
    parentSource.includes('disabled={ambientWipeActive}') &&
    parentSource.includes('label={ambientSceneLabel}'),
  'the ambient carousel is wired to handleAmbientNavigate with the wipe lock and label',
)
assert(
  parentSource.includes(
    "handlePlaygroundConfigChange({ ambient: buildSceneAmbientConfig(next) }, 'ambient.scene')",
  ),
  'carousel navigation applies the scene through the history transaction (key ambient.scene)',
)
assert(
  /beginAmbientWipe\(direction\)[\s\S]*?setAmbientWipeActive\(true\)/.test(parentSource) &&
    parentSource.includes('onAmbientWipeEnd={handleAmbientWipeEnd}'),
  'the canvas wipe is captured before applying the scene and the end callback unlocks the nav',
)
assert(
  /resolveAmbientSceneId\(playgroundConfigRef\.current\.ambient\)/.test(parentSource) &&
    /nextAmbientSceneId\(current, direction\)/.test(parentSource),
  'the carousel resolves the current scene from the live config and wraps via nextAmbientSceneId',
)
assert(
  parentSource.includes('enabled={pondEnabled}') &&
    parentSource.includes('character={pondCharacter}') &&
    parentSource.includes('onToggle={() => setPondEnabled((prev) => !prev)}') &&
    parentSource.includes('onSelect={setPondCharacter}'),
  'the pond control drives session-only enabled/character state',
)
assert(
  parentSource.includes(
    "pond={displayed === 'vibe' && pondEnabled ? activePondConfig : undefined}",
  ) &&
    /activePondConfig = useMemo<PondConfig>\(\s*\(\) => \(\{ \.\.\.pondConfig, enabled: true \}\)/.test(
      parentSource,
    ) &&
    parentSource.includes('pondCharacter={pondCharacter}'),
  'SceneCanvas receives an ENABLED pond config only while toggled on in vibe, plus the character override',
)
assert(
  parentSource.includes('expanded={soundExpanded}') &&
    parentSource.includes('playback={sonification.playback}') &&
    parentSource.includes('direction={sonification.config.direction}') &&
    parentSource.includes('onDisable={handleSoundDisable}') &&
    parentSource.includes('onPlay={handleSoundPlay}') &&
    parentSource.includes('onPause={handleSoundPause}') &&
    parentSource.includes('onCycleDirection={handleSoundCycleDirection}'),
  'the sound control wires expansion, playback, and direction from useSonification',
)
assert(
  /handleSoundDisable = \(\) => \{[\s\S]*?sonification\.stop\(\)[\s\S]*?setSoundExpanded\(false\)/.test(
    parentSource,
  ),
  'disabling sound stops playback and collapses the control',
)
assert(
  /clipRecordingActive[\s\S]*?if \(clipRecordingActive\) return[\s\S]*?sonification\.play\(\)/.test(
    parentSource,
  ),
  'the sound transport locks out while a clip recording is active',
)
assert(
  /SOUND_DIRECTION_CYCLE[\s\S]*?'left-to-right'[\s\S]*?'top-to-bottom'[\s\S]*?'right-to-left'[\s\S]*?'bottom-to-top'/.test(
    parentSource,
  ) && parentSource.includes('sonification.updateConfig({ direction: next })'),
  'the direction button cycles right → down → left → up via updateConfig',
)
assert(
  !/tuningMode && displayed === 'vibe' && \(\s*<SonificationOverlay/.test(parentSource) &&
    /displayed === 'vibe' && \(\s*<SonificationOverlay/.test(parentSource),
  'the scan-line overlay shows whenever sound plays in vibe (no longer debug-gated)',
)

// --- paint enablement: off→on selects both targets --------------------------------

assert(
  /patch\.enabled === true && !paintToolRef\.current\.enabled/.test(parentSource) &&
    /glyphColor: PAINT_DEFAULT_GLYPH_COLOR,[\s\S]*?backgroundColor: PAINT_DEFAULT_BACKGROUND_COLOR,/.test(
      parentSource,
    ),
  'enabling paint (off→on) forces both targets to the shared defaults',
)
assert(
  paintPanelSource.includes('export const PAINT_DEFAULT_GLYPH_COLOR') &&
    paintPanelSource.includes('export const PAINT_DEFAULT_BACKGROUND_COLOR') &&
    parentSource.includes(
      "import { PAINT_DEFAULT_BACKGROUND_COLOR, PAINT_DEFAULT_GLYPH_COLOR } from './vibe/PaintPanel'",
    ),
  'PaintPanel exports the defaults both sides agree on',
)
assert(
  !/handlePaintToolChange[\s\S]{0,400}?clearPaint\(\)/.test(parentSource),
  'enabling paint never clears the existing paint overlay',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll vibe toolbar verifications passed.')
