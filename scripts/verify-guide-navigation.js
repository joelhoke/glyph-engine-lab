#!/usr/bin/env node
/**
 * Deterministic verification for components/collaborate/guideNavigation.ts:
 * the pure decisions behind the guided chat companion — internal Work source
 * resolution (valid, invalid, unknown, external, nested), the unmodified
 * primary-click predicate (modified clicks keep native anchor behavior), exit
 * presentation at/under the 960px breakpoint, viewport-crossing rules (an open
 * companion minimizes; widening never reopens a minimized chat), and the
 * minimized-chrome status (pending / unseen answer only — never transcript).
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-guide-navigation')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'components', 'collaborate', 'guideNavigation.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  GUIDE_COMPANION_MIN_WIDTH_PX,
  resolveGuideSourceTarget,
  isUnmodifiedPrimaryClick,
  resolveGuideExitPresentation,
  resolveGuideViewportCrossing,
  resolveGuideMinimizedStatus,
} = require(path.join(tmpDir, 'components', 'collaborate', 'guideNavigation.js'))
const { WORK_SLIDES } = require(path.join(tmpDir, 'content', 'work.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const projectIds = WORK_SLIDES.filter((s) => s.kind === 'project').map((s) => s.story.id)
const firstStory = projectIds[0]
const firstIndex = WORK_SLIDES.findIndex((s) => s.kind === 'project' && s.story.id === firstStory)

// --- Source target resolution ------------------------------------------------

assert(projectIds.length >= 3, `fixture: at least three project slides (found ${projectIds.length})`)

const valid = resolveGuideSourceTarget(`#work/${firstStory}`)
assert(
  valid && valid.storyId === firstStory && valid.slideIndex === firstIndex,
  `valid #work/${firstStory} resolves to story + slide index ${firstIndex}`,
)

assert(
  projectIds.every((id) => resolveGuideSourceTarget(`#work/${id}`)?.storyId === id),
  'every project story resolves as a source destination',
)

assert(
  resolveGuideSourceTarget('#work/no-such-story') === null,
  'unknown story id returns null (native anchor behavior)',
)
assert(resolveGuideSourceTarget('#work/') === null, 'empty story id returns null')
assert(resolveGuideSourceTarget('#work') === null, 'bare #work returns null (no story segment)')
assert(
  resolveGuideSourceTarget(`#work/${firstStory}/extra`) === null,
  'nested path under a story id returns null',
)
assert(
  resolveGuideSourceTarget('https://example.com/story') === null,
  'external https URL returns null',
)
assert(
  resolveGuideSourceTarget('https://joelhoke.com/#work/' + firstStory) === null,
  'absolute URL with a work fragment returns null (only same-page hashes navigate)',
)
assert(resolveGuideSourceTarget('/protected-work?story=x') === null, 'protected route returns null')
assert(resolveGuideSourceTarget('') === null, 'empty url returns null')
assert(resolveGuideSourceTarget(undefined) === null, 'missing url (non-link source) returns null')

assert(
  resolveGuideSourceTarget(`#WORK/${firstStory.toUpperCase()}`)?.storyId === firstStory,
  'resolution is case-insensitive like the hash router',
)

// --- Primary-click predicate ---------------------------------------------------

const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }
assert(isUnmodifiedPrimaryClick(plain), 'plain primary click is intentional')
assert(!isUnmodifiedPrimaryClick({ ...plain, metaKey: true }), 'cmd-click stays native (new tab)')
assert(!isUnmodifiedPrimaryClick({ ...plain, ctrlKey: true }), 'ctrl-click stays native')
assert(!isUnmodifiedPrimaryClick({ ...plain, shiftKey: true }), 'shift-click stays native (new window)')
assert(!isUnmodifiedPrimaryClick({ ...plain, altKey: true }), 'alt-click stays native (download)')
assert(!isUnmodifiedPrimaryClick({ ...plain, button: 1 }), 'middle click stays native')
assert(!isUnmodifiedPrimaryClick({ ...plain, button: 2 }), 'secondary click stays native')
assert(!isUnmodifiedPrimaryClick({ ...plain, defaultPrevented: true }), 'already-handled click stays native')

// --- Exit presentation ---------------------------------------------------------

assert(GUIDE_COMPANION_MIN_WIDTH_PX === 960, 'companion breakpoint is 960px')
assert(resolveGuideExitPresentation(1440) === 'companion', '1440px exits to the docked companion')
assert(resolveGuideExitPresentation(960) === 'companion', '960px boundary exits to the companion')
assert(resolveGuideExitPresentation(959) === 'minimized', '959px exits to minimized')
assert(resolveGuideExitPresentation(390) === 'minimized', '390px exits to minimized')

// --- Viewport crossing -----------------------------------------------------------

assert(
  resolveGuideViewportCrossing('companion', 959) === 'minimized',
  'open companion crossing below 960px minimizes (never a modal)',
)
assert(resolveGuideViewportCrossing('companion', 1440) === 'companion', 'companion stays docked while wide')
assert(
  resolveGuideViewportCrossing('minimized', 1440) === 'minimized',
  'widening never reopens a minimized chat',
)
assert(resolveGuideViewportCrossing('minimized', 390) === 'minimized', 'minimized stays minimized when narrow')
assert(resolveGuideViewportCrossing('page', 390) === 'page', 'page presentation is untouched by crossing')

// --- Minimized chrome status -----------------------------------------------------

assert(
  resolveGuideMinimizedStatus({ status: 'pending' }, false) === 'pending',
  'pending request shows in the minimized chrome',
)
assert(
  resolveGuideMinimizedStatus({ status: 'pending' }, true) === 'pending',
  'pending wins over an unseen earlier answer',
)
assert(
  resolveGuideMinimizedStatus({ status: 'ready' }, true) === 'unseen-answer',
  'answer that arrived while away shows as unseen',
)
assert(resolveGuideMinimizedStatus({ status: 'ready' }, false) === null, 'no status when caught up')
assert(resolveGuideMinimizedStatus(null, false) === null, 'no session → no status')

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll guide-navigation checks passed')
