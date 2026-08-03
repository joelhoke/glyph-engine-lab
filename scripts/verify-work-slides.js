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

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll work slide verifications passed.')
