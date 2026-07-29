#!/usr/bin/env node
/**
 * Deterministic verification for content/work.ts: the Work experience content
 * model (open-ended story collection, links[], public/protected access),
 * wrap-around story navigation, the per-story scene descriptor resolution
 * used to drive the canvas (including the per-story colorMode override), and
 * the Microsoft brand treatment in public/assets/work/story-03.svg.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-work-content')

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

const {
  WORK_STORIES,
  WORK_STORY_COUNT,
  WORK_INTRO,
  getWorkStory,
  nextWorkStoryIndex,
  previousWorkStoryIndex,
  resolveWorkScene,
} = require(path.join(tmpDir, 'content', 'work.js'))
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

// any non-empty story collection is supported
assert(WORK_STORIES.length >= 1, 'work story collection is non-empty')
assert(WORK_STORY_COUNT === WORK_STORIES.length, 'WORK_STORY_COUNT matches the array')
assert(typeof WORK_INTRO === 'string' && WORK_INTRO.trim().length > 0, 'WORK_INTRO is present')

// unique ids
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

// sourceUrl points at an existing file under public/assets/work/
for (const story of WORK_STORIES) {
  assert(
    story.sourceUrl.startsWith('/assets/work/'),
    `${story.id}: sourceUrl is under /assets/work/`,
  )
  const filePath = path.join(projectRoot, 'public', story.sourceUrl)
  assert(fs.existsSync(filePath), `${story.id}: ${story.sourceUrl} exists in public/`)
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

// wrap-around navigation
assert(nextWorkStoryIndex(0, 3) === 1, 'next from 0 is 1')
assert(nextWorkStoryIndex(2, 3) === 0, 'next wraps from last to first')
assert(previousWorkStoryIndex(0, 3) === 2, 'previous wraps from first to last')
assert(previousWorkStoryIndex(1, 3) === 0, 'previous from 1 is 0')
assert(nextWorkStoryIndex(0, 0) === 0 && previousWorkStoryIndex(0, 0) === 0, 'empty count is safe')
assert(nextWorkStoryIndex(0, 1) === 0 && previousWorkStoryIndex(0, 1) === 0, 'single-story count stays at 0')

// bounds-safe lookup
assert(getWorkStory(0) === WORK_STORIES[0], 'getWorkStory resolves in-range index')
assert(getWorkStory(99) === WORK_STORIES[0], 'getWorkStory falls back out of range')

// per-story scene resolution
const base = EXPERIENCE_SCENES.work
for (const story of WORK_STORIES) {
  const resolved = resolveWorkScene(base, story)
  assert(resolved.sourceUrl === story.sourceUrl, `${story.id}: resolved scene uses story sourceUrl`)
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

// resolution never mutates the baseline descriptor
const baselineSource = EXPERIENCE_SCENES.work.sourceUrl
resolveWorkScene(base, WORK_STORIES[0])
assert(EXPERIENCE_SCENES.work.sourceUrl === baselineSource, 'base descriptor is not mutated')

// the Microsoft story takes the source colors straight from the SVG
const microsoftStory = WORK_STORIES.find((story) => story.sourceUrl === '/assets/work/story-03.svg')
assert(!!microsoftStory, 'a story references /assets/work/story-03.svg')
assert(
  !!microsoftStory && microsoftStory.colorMode === 'source-colors',
  "story-03 story sets colorMode 'source-colors'",
)
const microsoftScene = resolveWorkScene(base, microsoftStory)
assert(
  microsoftScene.playground.glyphColorMode === 'source-colors',
  "story-03 resolved scene uses glyphColorMode 'source-colors'",
)

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

// the Microsoft source SVG carries the brand colors and a white wordmark
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
