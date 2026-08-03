#!/usr/bin/env node
/**
 * Deterministic verification for content/work.ts: the Work experience content
 * model (open-ended story collection, links[], public/protected access), the
 * slide model (exactly one intro slide + one project slide per story),
 * wrap-around slide navigation, the per-slide scene descriptor resolution
 * used to drive the canvas (including the colorMode overrides), and the
 * Microsoft brand treatment in public/assets/work/story-03.svg (the intro
 * slide's source).
 *
 * Launch-asset policy: project-slide hero sources must exist in public/
 * (asserted below — a missing source fails the suite) and must never point
 * at one of the generic story-01/02/04 placeholders (referencing a
 * placeholder instead is a FAILURE).
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-work-content')

const REQUIRED_PROJECT_ASSET = '/assets/work/building-multiple.svg'
const PLACEHOLDER_SOURCE = /\/assets\/work\/story-0[124]\.svg$/

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'content', 'work.ts')}" "${path.join(projectRoot, 'engine', 'sceneConfig.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const workModule = require(path.join(tmpDir, 'content', 'work.js'))
const {
  WORK_STORIES,
  WORK_STORY_COUNT,
  WORK_SLIDES,
  WORK_SLIDE_COUNT,
  getWorkStory,
  getWorkSlide,
  getWorkSlideId,
  getWorkSlideTitle,
  nextWorkStoryIndex,
  previousWorkStoryIndex,
  resolveWorkScene,
  resolveWorkSlideScene,
} = workModule
const { EXPERIENCE_SCENES } = require(path.join(tmpDir, 'engine', 'sceneConfig.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// WORK_INTRO is gone — its copy lives on the intro slide
assert(!('WORK_INTRO' in workModule), 'WORK_INTRO is removed (its copy lives on the intro slide)')

// any non-empty story collection is supported
assert(WORK_STORIES.length >= 1, 'work story collection is non-empty')
assert(WORK_STORY_COUNT === WORK_STORIES.length, 'WORK_STORY_COUNT matches the array')

// --- the slide model: exactly intro + one project slide per story ---------

assert(WORK_SLIDE_COUNT === WORK_SLIDES.length, 'WORK_SLIDE_COUNT matches the slide array')
assert(
  WORK_SLIDES.length === 3 &&
    WORK_SLIDES[0].kind === 'intro' &&
    WORK_SLIDES[1].kind === 'project' &&
    WORK_SLIDES[2].kind === 'project',
  'WORK_SLIDES is exactly intro + two project slides',
)

const introSlide = WORK_SLIDES.find((slide) => slide.kind === 'intro')
const projectSlides = WORK_SLIDES.filter((slide) => slide.kind === 'project')
assert(!!introSlide, 'an intro slide exists')
assert(
  !!introSlide && introSlide.id === 'microsoft' && introSlide.title === 'Microsoft',
  "intro slide carries id 'microsoft' and title 'Microsoft'",
)
assert(
  !!introSlide && introSlide.copy.includes('eight years'),
  'intro slide carries the eight-years tenure copy',
)
assert(
  !!introSlide && introSlide.sourceUrl === '/assets/work/story-03.svg',
  'intro slide samples /assets/work/story-03.svg',
)
assert(
  !!introSlide && introSlide.colorMode === 'source-colors',
  "intro slide sets colorMode 'source-colors'",
)
assert(
  projectSlides.every((slide, i) => slide.story === WORK_STORIES[i]),
  'project slides wrap the WORK_STORIES entries in order',
)

// slide ids are unique and stable
const slideIds = WORK_SLIDES.map(getWorkSlideId)
assert(new Set(slideIds).size === slideIds.length, 'slide ids are unique')

// the project slide references the required launch asset — never a placeholder
for (const slide of projectSlides) {
  assert(
    !PLACEHOLDER_SOURCE.test(slide.story.sourceUrl),
    `${slide.story.id}: project slide does not reference a story-01/02/04 placeholder`,
  )
}
const microsoftProject = projectSlides.find((slide) => slide.story.id === 'microsoft-global-operations')
assert(!!microsoftProject, 'the microsoft-global-operations project slide exists')
assert(
  !!microsoftProject && microsoftProject.story.sourceUrl === REQUIRED_PROJECT_ASSET,
  `project slide references the required asset ${REQUIRED_PROJECT_ASSET}`,
)
assert(
  !!microsoftProject && microsoftProject.story.colorMode === 'source-colors',
  "project slide keeps colorMode 'source-colors'",
)
assert(
  !!microsoftProject && (microsoftProject.story.sourceKind ?? 'svg') === 'svg',
  'microsoft-global-operations keeps the default svg sourceKind',
)

// the employee-experience project slide (raster hero source)
const employeeProject = projectSlides.find((slide) => slide.story.id === 'microsoft-employee-experience')
assert(!!employeeProject, 'the microsoft-employee-experience project slide exists')
assert(
  !!employeeProject && employeeProject.story.title === 'Global & Puget Sound Employee Experience',
  'employee-experience story carries its exact title',
)
assert(
  !!employeeProject && employeeProject.story.sourceUrl === '/assets/work/MyHubTest.png',
  'employee-experience story samples /assets/work/MyHubTest.png',
)
assert(
  !!employeeProject && employeeProject.story.sourceKind === 'raster',
  "employee-experience story sets sourceKind 'raster'",
)
assert(
  !!employeeProject && employeeProject.story.colorMode === 'source-colors',
  "employee-experience story sets colorMode 'source-colors'",
)
assert(
  !!employeeProject && employeeProject.story.access === 'public',
  'employee-experience story is public',
)
assert(
  !!employeeProject && Array.isArray(employeeProject.story.media) && employeeProject.story.media.length === 0,
  'employee-experience story ships no gallery media',
)
assert(
  !!employeeProject && employeeProject.story.links.length === 3,
  'employee-experience story carries its three external links',
)

// every slide's source asset must exist in public/ — a missing source fails
// the suite (the placeholder FAIL guard lives above)
assert(
  fs.existsSync(path.join(projectRoot, 'public', introSlide.sourceUrl)),
  `intro slide source exists in public/ (${introSlide.sourceUrl})`,
)
for (const story of WORK_STORIES) {
  assert(
    fs.existsSync(path.join(projectRoot, 'public', story.sourceUrl)),
    `${story.id}: source asset exists in public/ (${story.sourceUrl})`,
  )
}

// unique story ids
const ids = WORK_STORIES.map((story) => story.id)
assert(new Set(ids).size === ids.length, 'story ids are unique')

// every required field is present and non-empty; links[] is an array
for (const story of WORK_STORIES) {
  const strings = [story.id, story.title, story.thesis, story.role, story.context, story.outcome, story.sourceUrl]
  assert(
    strings.every((value) => typeof value === 'string' && value.trim().length > 0),
    `${story.id}: all required fields are non-empty strings`,
  )
  assert(Array.isArray(story.links), `${story.id}: links is an array`)
  assert(
    story.access === 'public' || story.access === 'protected',
    `${story.id}: access is 'public' or 'protected'`,
  )
}

// no placeholder residue anywhere in the collection
const serialized = JSON.stringify(WORK_STORIES).toLowerCase()
for (const marker of ['placeholder', 'example.com', 'lorem', 'todo(']) {
  assert(!serialized.includes(marker), `stories contain no "${marker}" marker`)
}

// sourceUrl points under public/assets/work/ (existence is asserted above;
// a placeholder reference is a FAIL)
for (const story of WORK_STORIES) {
  assert(
    story.sourceUrl.startsWith('/assets/work/'),
    `${story.id}: sourceUrl is under /assets/work/`,
  )
  assert(
    !PLACEHOLDER_SOURCE.test(story.sourceUrl),
    `${story.id}: sourceUrl is not a story-01/02/04 placeholder`,
  )
}

// links are well-formed https URLs
for (const story of WORK_STORIES) {
  for (const link of story.links) {
    let parsed = null
    try {
      parsed = new URL(link.url)
    } catch (error) {
      parsed = null
    }
    assert(
      !!parsed && parsed.protocol === 'https:' && link.label.trim().length > 0,
      `${story.id}: link "${link.label}" is a labelled, well-formed https URL`,
    )
  }
}

// protected stories expose only a teaser + opaque protected id
for (const story of WORK_STORIES) {
  if (story.access === 'protected') {
    assert(
      typeof story.protectedId === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(story.protectedId),
      `${story.id}: protected story carries an opaque protectedId`,
    )
    assert(!story.details && !story.media, `${story.id}: protected story exposes no details or media`)
  } else {
    assert(!story.protectedId, `${story.id}: public story carries no protectedId`)
  }
}

// wrap-around navigation (shared by stories and slides)
assert(nextWorkStoryIndex(0, 3) === 1, 'next from 0 is 1')
assert(nextWorkStoryIndex(2, 3) === 0, 'next wraps from last to first')
assert(previousWorkStoryIndex(0, 3) === 2, 'previous wraps from first to last')
assert(previousWorkStoryIndex(1, 3) === 0, 'previous from 1 is 0')
assert(nextWorkStoryIndex(0, 0) === 0 && previousWorkStoryIndex(0, 0) === 0, 'empty count is safe')
assert(nextWorkStoryIndex(0, 1) === 0 && previousWorkStoryIndex(0, 1) === 0, 'single-story count stays at 0')
assert(
  nextWorkStoryIndex(0, WORK_SLIDE_COUNT) === 1 &&
    nextWorkStoryIndex(WORK_SLIDE_COUNT - 1, WORK_SLIDE_COUNT) === 0,
  'slide navigation wraps across intro and project slides',
)
assert(previousWorkStoryIndex(0, WORK_SLIDE_COUNT) === WORK_SLIDE_COUNT - 1, 'previous from the intro slide wraps to the last slide')

// bounds-safe lookups
assert(getWorkStory(0) === WORK_STORIES[0], 'getWorkStory resolves in-range index')
assert(getWorkStory(99) === WORK_STORIES[0], 'getWorkStory falls back out of range')
assert(getWorkSlide(0) === WORK_SLIDES[0], 'getWorkSlide resolves the intro slide')
assert(getWorkSlide(99) === WORK_SLIDES[0], 'getWorkSlide falls back out of range')
assert(getWorkSlideTitle(WORK_SLIDES[0]) === 'Microsoft', 'intro slide title resolves')
assert(
  getWorkSlideTitle(WORK_SLIDES[1]) === WORK_STORIES[0].title,
  'project slide title resolves to the story title',
)

// per-story scene resolution
const base = EXPERIENCE_SCENES.work
for (const story of WORK_STORIES) {
  const resolved = resolveWorkScene(base, story)
  assert(resolved.sourceUrl === story.sourceUrl, `${story.id}: resolved scene uses story sourceUrl`)
  assert(
    resolved.sourceKind === (story.sourceKind ?? 'svg'),
    `${story.id}: resolved scene threads sourceKind (default 'svg')`,
  )
  if (story.palette) {
    assert(
      resolved.playground.glyphPalette === story.palette,
      `${story.id}: resolved scene uses story palette`,
    )
  }
  if (story.background) {
    assert(
      resolved.playground.backgroundColor1 === story.background.color1 &&
        resolved.playground.backgroundColor2 === story.background.color2,
      `${story.id}: resolved scene uses story background`,
    )
  }
  if (story.behavior) {
    for (const key of Object.keys(story.behavior)) {
      assert(
        resolved.behavior[key] === story.behavior[key],
        `${story.id}: resolved scene applies behavior override ${key}`,
      )
    }
  }
  assert(
    resolved.copy.heading === base.copy.heading && resolved.playground.glyphText === base.playground.glyphText,
    `${story.id}: unresolved fields fall back to the work baseline`,
  )
}

// per-slide scene resolution: both slide kinds produce a SceneDescriptor
const introScene = resolveWorkSlideScene(base, WORK_SLIDES[0])
assert(introScene.sourceUrl === '/assets/work/story-03.svg', 'intro slide scene uses the story-03 source')
assert(introScene.sourceKind === 'svg', "intro slide scene keeps the 'svg' sourceKind")
assert(
  introScene.playground.glyphColorMode === 'source-colors',
  "intro slide scene uses glyphColorMode 'source-colors'",
)
assert(
  introScene.playground.glyphText === 'culture eats strategy for breakfast ',
  'intro slide scene applies its glyphText override',
)
assert(
  introScene.copy.heading === base.copy.heading,
  'intro slide scene keeps the work baseline elsewhere',
)
const projectScene = resolveWorkSlideScene(base, WORK_SLIDES[1])
const storyScene = resolveWorkScene(base, WORK_STORIES[0])
assert(
  projectScene.sourceUrl === storyScene.sourceUrl &&
    projectScene.sourceKind === storyScene.sourceKind &&
    projectScene.playground.glyphColorMode === storyScene.playground.glyphColorMode &&
    projectScene.behavior.particleRepel === storyScene.behavior.particleRepel,
  'project slide scene resolution matches its story resolution',
)
// the raster story's slide scene carries sourceKind through
const rasterSlideScene = resolveWorkSlideScene(base, WORK_SLIDES[2])
assert(
  rasterSlideScene.sourceKind === 'raster' && rasterSlideScene.sourceUrl === '/assets/work/MyHubTest.png',
  "raster story's slide scene carries sourceKind 'raster'",
)

// resolution never mutates the baseline descriptor
const baselineSource = EXPERIENCE_SCENES.work.sourceUrl
resolveWorkScene(base, WORK_STORIES[0])
resolveWorkSlideScene(base, WORK_SLIDES[0])
assert(EXPERIENCE_SCENES.work.sourceUrl === baselineSource, 'base descriptor is not mutated')

// stories without colorMode keep the base descriptor's glyphColorMode
for (const story of WORK_STORIES) {
  if (!story.colorMode) {
    const resolved = resolveWorkScene(base, story)
    assert(
      resolved.playground.glyphColorMode === base.playground.glyphColorMode,
      `${story.id}: without colorMode, resolved scene keeps the base glyphColorMode`,
    )
  }
}

// the intro slide's Microsoft source SVG carries the brand colors and a
// white wordmark
const story03Svg = fs.readFileSync(
  path.join(projectRoot, 'public', 'assets', 'work', 'story-03.svg'),
  'utf8',
)
for (const brandColor of ['#f25022', '#7fba00', '#00a4ef', '#ffb900']) {
  assert(
    story03Svg.toLowerCase().includes(brandColor),
    `story-03.svg contains Microsoft brand color ${brandColor}`,
  )
}
assert(/fill="#ffffff"/i.test(story03Svg), 'story-03.svg wordmark group fills white (#ffffff)')
assert(!/fill="#000000"/i.test(story03Svg), 'story-03.svg has no fill="#000000" left on the logo group')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll work content verifications passed.')
