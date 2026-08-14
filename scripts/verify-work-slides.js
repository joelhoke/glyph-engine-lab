#!/usr/bin/env node
/**
 * Structural verification for the Work slide surfaces (launch item 4):
 *
 * 1. Analytics guard (components/PortfolioExperience.tsx): the story_view
 *    effect fires only for kind === 'project' slides — never for the intro
 *    slide — and uses the stable story id.
 * 2. The visually-hidden crawlable digest carries the intro slide's copy and
 *    each project's summary (mapped from WORK_SLIDES, protected branch kept).
 * 3. components/work/WorkExperience.tsx: the intro slide renders title+copy
 *    only, project slides keep WorkStoryView, and the progress controls use
 *    the "n / N" slide count (shown whenever slides.length > 1).
 * 4. Slide-change scroll behavior: WorkExperience never calls
 *    scrollIntoView — it resets the panel's own scrollTop and focuses the
 *    slide heading with preventScroll so the document/shell never move.
 * 5. The brand-mark model: every current slide resolves the shared Microsoft
 *    mark via getWorkSlideMark (either WorkSlide kind), both theme variants
 *    of the asset exist, the mark renders once in the shared card header row
 *    with a <picture> light swap, and marks are omittable.
 * 6. The retired building-orchestrator-live-campus asset path is referenced
 *    nowhere, and the work sceneSource threads the descriptor's sourceKind
 *    (raster heroes) instead of hardcoding 'svg'.
 * 7. Scroll-scrubbed expansion (feature/work-expanding-case-study):
 *    PortfolioExperience owns the numeric expansion progress (0..1), scrubs
 *    it from gap gestures outside the card/glyph region (gated on the
 *    reported expansion metrics), and resets on mode leave; WorkExperience
 *    runs the scroll-delta machine (the card's expansion travel = full scrub,
 *    absolute start-Y touch mapping, pinned scrollTop below 1,
 *    boundary-crossing delta preservation, reduced-motion snap) with the
 *    controls in a non-scrolling BoundedScrollPanel footer; WorkStory always
 *    renders details, dedupes inline media out of the gallery, and renders
 *    Related links last; globals.css carries the compact geometry, grid
 *    rows, and --work-expansion consumers. The per-slide hero-fit policy
 *    ('viewport' for the Microsoft intro, 'stage' for project stories)
 *    decides the canvas target region.
 * 8. The responsive-landing source variant: SceneCanvas resolves the
 *    landing hero from its own measured canvas width, and the landing
 *    gradient covers both decoded and fallback fields.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-work-slides')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'content', 'work.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const portfolioSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'PortfolioExperience.tsx'),
  'utf8',
)
const workExperienceSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'work', 'WorkExperience.tsx'),
  'utf8',
)
const workContentSource = fs.readFileSync(
  path.join(projectRoot, 'content', 'work.ts'),
  'utf8',
)
const boundedPanelSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'BoundedScrollPanel.tsx'),
  'utf8',
)
const workStorySource = fs.readFileSync(
  path.join(projectRoot, 'components', 'work', 'WorkStory.tsx'),
  'utf8',
)
const globalsCss = fs.readFileSync(path.join(projectRoot, 'app', 'globals.css'), 'utf8')

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- 1. analytics guard: story_view is project-only ------------------------

const storyViewIndex = portfolioSource.indexOf("name: 'story_view'")
assert(storyViewIndex >= 0, 'PortfolioExperience tracks story_view')
// Look at the effect body surrounding the event: it must resolve the slide
// and bail out unless the slide is a project.
const storyViewContext = portfolioSource.slice(Math.max(0, storyViewIndex - 500), storyViewIndex + 200)
assert(
  storyViewContext.includes("slide.kind !== 'project'"),
  'story_view effect returns early unless the active slide is a project (intro never tracked)',
)
assert(
  storyViewContext.includes('slide.story.id'),
  'story_view uses the stable story id as the event param',
)
assert(
  !portfolioSource.includes('getWorkStory(workStoryIndex)'),
  'the old story-index tracking path is gone',
)

// --- 2. digest: intro copy + project summaries ------------------------------

assert(
  portfolioSource.includes('WORK_SLIDES.map'),
  'the crawlable digest maps WORK_SLIDES',
)
assert(
  portfolioSource.includes('slide.copy'),
  'the digest carries the intro slide copy',
)
assert(
  portfolioSource.includes("slide.kind === 'intro'"),
  'the digest branches on the intro slide kind',
)
assert(
  portfolioSource.includes("slide.story.access === 'protected'"),
  'the digest keeps the protected-story branch',
)
assert(
  !portfolioSource.includes('WORK_INTRO'),
  'WORK_INTRO is no longer referenced anywhere in PortfolioExperience',
)

// --- 3. WorkExperience: slide rendering + progress --------------------------

assert(
  workExperienceSource.includes("slide.kind === 'intro'"),
  'WorkExperience branches on the intro slide kind',
)
assert(
  workExperienceSource.includes('{slide.title}') && workExperienceSource.includes('{slide.copy}'),
  'the intro slide renders its title and copy only',
)
assert(
  workExperienceSource.includes('WorkStoryView'),
  'project slides keep the WorkStoryView (expansion, gallery, lightbox)',
)
assert(
  workExperienceSource.includes('slides.length > 1'),
  'the prev/next controls render whenever more than one slide exists',
)
assert(
  workExperienceSource.includes('{activeIndex + 1} / {slides.length}'),
  'the progress readout shows the 1-based slide position over the slide count',
)
assert(
  workExperienceSource.includes('slideHeadingRef'),
  'slide changes move focus to the slide heading',
)
assert(
  !workExperienceSource.includes('WORK_INTRO'),
  'WORK_INTRO is no longer referenced in WorkExperience',
)

// --- 4. slide-change scroll behavior ----------------------------------------

assert(
  !workExperienceSource.includes('scrollIntoView'),
  'WorkExperience never calls scrollIntoView (the document/shell must not move)',
)
assert(
  workExperienceSource.includes('scrollTop'),
  "slide changes reset the Work panel's own scrollTop",
)
assert(
  workExperienceSource.includes('preventScroll: true'),
  'slide heading focus keeps preventScroll: true',
)
assert(
  workExperienceSource.includes('getWorkSlideMark(slide)'),
  'the brand mark resolves for either WorkSlide kind (not intro-only)',
)
assert(
  workExperienceSource.includes('work-card-header'),
  'the mark renders once in the shared Work card header row',
)
assert(
  workExperienceSource.includes('prefers-color-scheme: light'),
  'the mark swaps its light variant via a <picture> media query',
)

// --- 5. brand-mark model ------------------------------------------------------

const { MICROSOFT_BRAND_MARK, WORK_SLIDES, getWorkSlideMark } = require(
  path.join(tmpDir, 'content', 'work.js'),
)

for (const slide of WORK_SLIDES) {
  const resolved = getWorkSlideMark(slide)
  assert(
    resolved === MICROSOFT_BRAND_MARK,
    `${slide.kind === 'project' ? slide.story.id : slide.id}: resolves the shared Microsoft mark`,
  )
}

// Both theme variants of the Microsoft mark exist in public/.
for (const asset of [MICROSOFT_BRAND_MARK.src, MICROSOFT_BRAND_MARK.lightSrc]) {
  assert(
    !!asset && fs.existsSync(path.join(projectRoot, 'public', asset)),
    `brand-mark asset exists: ${asset}`,
  )
}

// A slide may override or omit the mark.
const bare = getWorkSlideMark({ kind: 'intro', id: 'x', title: 'x', copy: 'x', sourceUrl: '/assets/work/story-01.svg' })
assert(bare === null, 'an intro slide without a mark resolves null (omittable)')

// --- 6. retired asset path + sourceKind threading -----------------------------

for (const [label, source] of [
  ['PortfolioExperience.tsx', portfolioSource],
  ['WorkExperience.tsx', workExperienceSource],
  ['content/work.ts', workContentSource],
]) {
  assert(
    !source.includes('building-orchestrator-live-campus'),
    `building-orchestrator-live-campus is no longer referenced in ${label}`,
  )
}
assert(
  /sourceKind:\s*workDescriptor\.sourceKind \?\? 'svg'/.test(portfolioSource),
  "the work sceneSource threads the descriptor's sourceKind (raster heroes reach SceneCanvas)",
)

// --- 7. controlled expansion progress (PortfolioExperience) -----------------

assert(
  portfolioSource.includes('const [workExpansionProgress, setWorkExpansionProgress] = useState(0)'),
  'PortfolioExperience owns the controlled expansion progress (numeric 0..1)',
)
assert(
  portfolioSource.includes('expansionProgress={workExpansionProgress}') &&
    portfolioSource.includes('onExpansionProgressChange={setWorkExpansionProgress}'),
  'PortfolioExperience passes expansionProgress + onExpansionProgressChange into WorkExperience',
)
assert(
  portfolioSource.includes('onExpansionMetricsChange'),
  'WorkExperience reports expansion metrics up (gap gestures are gated on them)',
)
assert(
  portfolioSource.includes('workOverflowEligibleRef.current = metrics.eligible'),
  'gap gestures cannot modify progress for a non-scrollable slide',
)
assert(
  portfolioSource.includes('workExpansionRangeRef.current = metrics.rangePx'),
  'the reported expansion range is cached for gap gestures (same mapping as the card)',
)
assert(
  portfolioSource.includes('className="work-glyph-stage"') &&
    portfolioSource.includes('ref={glyphStageRef}'),
  'the glyph stage renders (desktop and mobile) with its measuring ref',
)
assert(
  portfolioSource.includes("window.addEventListener('wheel'"),
  'gap wheel gestures are observed at the window level (gaps are pointer-transparent)',
)
assert(
  portfolioSource.includes('isInGlyphRegion') &&
    portfolioSource.includes('glyphStageRef.current?.getBoundingClientRect()'),
  'gap gestures are checked against the measured glyph region (glyph stays canvas-dedicated)',
)
assert(
  portfolioSource.includes("target.closest('.work-experience')"),
  'gap gestures ignore gestures inside the card (the card handles its own)',
)
assert(
  portfolioSource.includes('setWorkExpansionProgress(0)'),
  'leaving Work resets the expansion progress to compact',
)
assert(
  portfolioSource.includes('deltaPx / gapRangePx()'),
  'gap wheel input accumulates against the reported expansion range',
)
assert(
  portfolioSource.includes('touch.startProgress + dy / gapRangePx()'),
  'gap touch progress is computed from the gesture start Y and start progress',
)

// --- 7b. per-slide hero fit (PortfolioExperience + content/work) ------------

assert(
  workContentSource.includes(
    "export type WorkHeroFit = 'viewport' | 'stage' | 'balanced'",
  ) && workContentSource.includes('getWorkSlideHeroFit'),
  'content/work.ts declares the Work hero-fit policy (including balanced) and resolver',
)
assert(
  workContentSource.includes("heroFit: 'viewport'"),
  'the Microsoft intro explicitly opts into the viewport hero fit',
)
assert(
  /slide\.kind === 'intro' \? \(slide\.heroFit \?\? 'balanced'\) : 'balanced'/.test(
    workContentSource,
  ),
  "project stories always use 'balanced' fit (future case studies never inherit 'viewport')",
)
assert(
  portfolioSource.includes('getWorkSlideHeroFit(getWorkSlide(workSlideIndex))') &&
    portfolioSource.includes("workHeroFit === 'viewport'"),
  'PortfolioExperience resolves the active slide hero fit and branches the target region on it',
)
assert(
  /x:\s*rect\.left \+ rect\.width \/ 2 - vw \/ 2/.test(portfolioSource),
  "'viewport' fit keeps viewport-sized sampling bounds centered on the glyph stage",
)
assert(
  portfolioSource.includes(
    'const stageBounds = { x: rect.left, y: rect.top, width: rect.width, height: rect.height }',
  ),
  "'stage' fit passes the measured stage rectangle directly to SceneCanvas",
)
assert(
  /width:\s*\(stageBounds\.width \+ viewportBounds\.width\) \/ 2/.test(portfolioSource) &&
    /height:\s*\(stageBounds\.height \+ viewportBounds\.height\) \/ 2/.test(portfolioSource),
  "'balanced' fit interpolates halfway between stage and viewport bounds",
)

// --- 8. WorkExperience: the scroll-scrub machine ----------------------------

assert(
  workExperienceSource.includes('expansionProgress: number') &&
    workExperienceSource.includes('onExpansionProgressChange: (progress: number) => void'),
  'WorkExperience receives the controlled numeric expansion progress',
)
assert(
  workExperienceSource.includes('onExpansionMetricsChange?: (metrics: WorkExpansionMetrics) => void') &&
    workExperienceSource.includes('eligible: boolean') &&
    workExperienceSource.includes('rangePx: number'),
  'WorkExperience reports { eligible, rangePx } expansion metrics',
)
assert(
  workExperienceSource.includes('MIN_EXPANSION_RANGE_PX') &&
    workExperienceSource.includes('rect.top - expandedRect().top'),
  'the scrub denominator is the card expansion travel (compactCardTop - expandedCardTop), clamped positive',
)
assert(
  workExperienceSource.includes('MOBILE_SCRUB_RANGE_FACTOR = 0.48') &&
    workExperienceSource.includes('travel * (mobile ? MOBILE_SCRUB_RANGE_FACTOR : 1)'),
  'mobile shortens the scrub distance to 48% of the expansion travel (desktop unchanged)',
)
assert(
  workExperienceSource.includes("querySelector('.work-story-section')") &&
    workExperienceSource.includes('card.style.maxHeight'),
  'the compact card clips below the meta so Outcome starts at/below the fold',
)
assert(
  workExperienceSource.includes('touch.startProgress + dy / range') &&
    workExperienceSource.includes('startProgress: progressRef.current'),
  'touch progress is computed from the gesture start Y and start progress (reversal-safe)',
)
assert(
  workExperienceSource.includes("touch.mode = 'scrub'") &&
    workExperienceSource.includes('touch.startY = y'),
  'an upward native content scroll that reaches the top rebases into scrub mode',
)
assert(
  workExperienceSource.includes('requestAnimationFrame'),
  'progress commits are coalesced through requestAnimationFrame',
)
assert(
  workExperienceSource.includes("addEventListener('wheel', handleWheel, { passive: false })") &&
    workExperienceSource.includes("addEventListener('touchmove', handleTouchMove, { passive: false })"),
  'wheel/touchmove listeners are non-passive (iOS cannot scroll while the gesture drives expansion)',
)
assert(
  workExperienceSource.includes('viewport.scrollTop = 0') &&
    workExperienceSource.includes('viewport.scrollTop = excess'),
  'scrollTop stays pinned at 0 below full expansion; unused delta scrolls content at 1',
)
assert(
  workExperienceSource.includes('scrollTop - up <= TOP_EPSILON'),
  'upward input crossing the top boundary preserves the unused delta for contraction',
)
assert(
  workExperienceSource.includes('OVERFLOW_TOLERANCE_PX') &&
    workExperienceSource.includes('measureCompact') &&
    workExperienceSource.includes('content.scrollHeight'),
  'overflow eligibility is measured from the compact content wrapper vs the compact viewport',
)
assert(
  workExperienceSource.includes('if (!viewport || !content || progressRef.current > 0) return'),
  'eligibility is cached from compact geometry (mid-transition changes never disable it)',
)
assert(
  workExperienceSource.includes('document.fonts?.ready') &&
    workExperienceSource.includes("addEventListener('orientationchange'"),
  'eligibility recalculates on font readiness, resize, and orientation changes',
)
assert(
  workExperienceSource.includes('(prefers-reduced-motion: reduce)'),
  'reduced motion snaps between compact and expanded instead of scrubbing',
)
assert(
  workExperienceSource.includes('Math.min(960, vw - 64)'),
  'desktop expanded width interpolates to min(60rem, 100vw - 4rem)',
)
assert(
  workExperienceSource.includes("card.style.position = 'fixed'") &&
    workExperienceSource.includes("card.style.setProperty('--work-expansion'"),
  'the scrub interpolates measured compact → expanded rect inline and exposes --work-expansion',
)
assert(
  workExperienceSource.includes('progressChangeRef.current(0)'),
  'slide changes reset progress (with scrollTop, title, and preventScroll focus)',
)
assert(
  workExperienceSource.includes('footer={') &&
    workExperienceSource.indexOf('footer={') < workExperienceSource.indexOf('work-controls'),
  'the prev/next controls live in the non-scrolling panel footer',
)

// --- 9. BoundedScrollPanel: footer + viewport callbacks ---------------------

assert(
  boundedPanelSource.includes('footer?: ReactNode') &&
    boundedPanelSource.includes('bounded-scroll-footer'),
  'BoundedScrollPanel supports an optional non-scrolling footer',
)
assert(
  boundedPanelSource.includes('onViewportScroll?:') &&
    boundedPanelSource.includes('onViewportWheel?:') &&
    boundedPanelSource.includes('onViewportTouchStart?:') &&
    boundedPanelSource.includes('onViewportTouchMove?:'),
  'BoundedScrollPanel exposes optional viewport scroll/input callbacks',
)
assert(
  boundedPanelSource.includes('{footer && <div className="bounded-scroll-footer">{footer}</div>}'),
  'the footer renders only when provided (Collaborate is unchanged)',
)

// --- 10. WorkStory: always-rendered details, dedupe, Related links ----------

assert(
  !workStorySource.includes('work-story-disclosure') &&
    !workStorySource.includes('Read the case study') &&
    !workStorySource.includes('aria-expanded'),
  'the Read/Close disclosure is gone — details render immediately',
)
assert(
  workStorySource.includes('inlineIds') && workStorySource.includes('galleryMedia'),
  'inline media (mediaIds) is deduplicated out of the gallery',
)
assert(
  workStorySource.includes('work-inline-media-button'),
  'inline images open the existing lightbox',
)
assert(
  workStorySource.includes('Related links') &&
    workStorySource.indexOf('work-story-related') > workStorySource.indexOf('work-gallery'),
  'Related links render after the narrative and gallery (final story content)',
)
assert(
  workStorySource.includes('trackOutbound'),
  'outbound analytics on related links are preserved',
)

// --- 11. layout CSS: compact hero, scrubbed expansion, fixed footer ---------

assert(
  globalsCss.includes('grid-template-rows: minmax(0, 1fr) auto'),
  'the Work card is grid rows minmax(0, 1fr) auto: viewport scrolls, footer pinned',
)
assert(
  globalsCss.includes('width: min(60rem, calc(100vw - 4rem))'),
  'the desktop compact card rests at the expanded width/position (expansion interpolates top+height only)',
)
assert(
  /@media \(max-width: 760px\) \{[\s\S]*?\.work-experience \{\s*width: 100%;/.test(globalsCss),
  'mobile keeps the available-width compact card (width-to-full-width interpolation preserved)',
)
assert(
  globalsCss.includes('--work-expansion'),
  'globals.css consumes the scrubbed --work-expansion custom property',
)
assert(
  globalsCss.includes('calc(100% - 60% * var(--work-expansion, 0))'),
  'desktop inline images scrub toward 40% of the content width',
)
assert(
  !globalsCss.includes('.work-experience--expanded'),
  'the binary expanded class is gone (geometry is scrubbed inline, no CSS transition)',
)
const workCardBlock = globalsCss.slice(
  globalsCss.indexOf('.work-experience {'),
  globalsCss.indexOf('}', globalsCss.indexOf('.work-experience {')),
)
assert(
  !workCardBlock.includes('transition'),
  'no CSS transition on the card — input scrubs geometry without easing or snapping',
)
assert(
  globalsCss.includes('.bounded-scroll-footer') &&
    globalsCss.includes('env(safe-area-inset-bottom, 0px)'),
  'the non-scrolling footer is styled and carries the bottom safe-area inset',
)
const glyphStageBlock = globalsCss.slice(
  globalsCss.indexOf('.work-glyph-stage {'),
  globalsCss.indexOf('}', globalsCss.indexOf('.work-glyph-stage {')),
)
assert(
  glyphStageBlock.length > 0 && !glyphStageBlock.includes('display: none'),
  'the glyph stage is shown (never display:none) so it can be measured on desktop and mobile',
)
assert(
  globalsCss.includes('prefers-reduced-motion'),
  'reduced-motion behavior is preserved',
)

// --- 12. responsive landing source (mobile landing race) --------------------

const sceneCanvasSource = fs.readFileSync(
  path.join(projectRoot, 'components', 'SceneCanvas.tsx'),
  'utf8',
)
const animatedSourceTypes = fs.readFileSync(
  path.join(projectRoot, 'engine', 'animatedSource.ts'),
  'utf8',
)
assert(
  animatedSourceTypes.includes("| { kind: 'responsive-landing' }"),
  'SceneSourceSelection carries the stable responsive-landing variant',
)
assert(
  portfolioSource.includes("return { kind: 'responsive-landing' }"),
  'PortfolioExperience passes the responsive landing source on every landing render',
)
assert(
  !portfolioSource.includes('viewportWidth'),
  "the parent's effect-driven viewport-width source switch is gone",
)
assert(
  sceneCanvasSource.includes("selection.kind === 'responsive-landing' && !isMobileViewport(W)"),
  'SceneCanvas resolves logotype vs monogram at build time from its measured canvas width',
)
assert(
  sceneCanvasSource.includes("window.addEventListener('orientationchange', handleViewportChange)") &&
    sceneCanvasSource.includes("window.visualViewport?.addEventListener('resize', handleViewportChange)"),
  'orientation changes and mobile browser-chrome viewport changes rebuild the field',
)
assert(
  (sceneCanvasSource.match(/applyHorizontalGlyphGradient\(/g) ?? []).length >= 2,
  'the landing gradient applies to both the decoded hero AND the fallback field (never raw white glyphs)',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll work slide verifications passed.')
