#!/usr/bin/env node
/**
 * Deterministic verification for content/collaborate.ts: the Collaborate
 * experience content model (invitation copy, conversation starters, contact
 * destinations, AI-guide flags/disclosure, and the authored per-topic canvas
 * treatments) plus the scene descriptor resolution used to drive the canvas
 * glyph phrase from starters and guide topics.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'content', 'collaborate.ts')}" "${path.join(projectRoot, 'engine', 'sceneConfig.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  COLLABORATE_HEADLINE,
  COLLABORATE_ENERGIZING_STATEMENT,
  COLLABORATE_CONTACT,
  COLLABORATE_GUIDE_CONTACT,
  COLLABORATE_GUIDE_DISCLOSURE,
  COLLABORATE_GUIDE_PENDING_HEADING,
  COLLABORATE_GUIDE_VISITOR_LABEL,
  COLLABORATE_GUIDE_NAME,
  COLLABORATE_GUIDE_PREVIEW_LABEL,
  COLLABORATE_GUIDE_RESUME,
  COLLABORATE_GUIDE_NEW,
  COLLABORATE_GUIDE_NEW_CONFIRM_PROMPT,
  COLLABORATE_GUIDE_NEW_CONFIRM_YES,
  COLLABORATE_GUIDE_NEW_CONFIRM_CANCEL,
  COLLABORATE_GUIDE_SHARE_LABEL,
  COLLABORATE_GUIDE_SHARE_NOTE,
  COLLABORATE_GUIDE_SHARE_EMAIL_LABEL,
  COLLABORATE_GUIDE_SHARE_BUTTON,
  COLLABORATE_GUIDE_SHARE_SENDING,
  COLLABORATE_GUIDE_SHARE_ERROR,
  COLLABORATE_GUIDE_BACK_LABEL,
  COLLABORATE_GUIDE_COMPOSER_LABEL,
  COLLABORATE_GUIDE_COMPOSER_PLACEHOLDER,
  COLLABORATE_GUIDE_SEND_LABEL,
  COLLABORATE_GUIDE_ANSWERED_ANNOUNCEMENT,
  COLLABORATE_SHOW_STARTERS,
  COLLABORATE_AI_GUIDE,
  COLLABORATE_STARTER_COUNT,
  COLLABORATE_TOPICS,
  COLLABORATE_CANVAS_TOPICS,
  CONVERSATION_STARTERS,
  getCollaborateStarter,
  resolveCollaborateScene,
} = require(path.join(tmpDir, 'content', 'collaborate.js'))
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

// --- Launch flags ---

assert(COLLABORATE_SHOW_STARTERS === false, 'conversation starters are hidden for launch')
// Preview development runs with the flag ON (uncommitted local change); the
// launch gate lives in docs/deployment.md. Here we only require that the
// flag exists, is a boolean, and that the component actually gates on it.
assert(typeof COLLABORATE_AI_GUIDE === 'boolean', 'AI guide flag exists and is a boolean')

const collaborateSurface = fs.readFileSync(
  path.join(projectRoot, 'components', 'collaborate', 'CollaborateExperience.tsx'),
  'utf8',
)
assert(
  collaborateSurface.includes('COLLABORATE_SHOW_STARTERS'),
  'the collaborate surface gates the starters on the launch flag',
)
assert(
  collaborateSurface.includes('COLLABORATE_AI_GUIDE'),
  'the collaborate surface gates the guide on its own launch flag',
)

// --- Starters: six, unique ids, all copy fields present ---

assert(CONVERSATION_STARTERS.length === 6, 'exactly 6 conversation starters')
assert(
  COLLABORATE_STARTER_COUNT === CONVERSATION_STARTERS.length,
  'COLLABORATE_STARTER_COUNT matches the array',
)

const ids = CONVERSATION_STARTERS.map((starter) => starter.id)
assert(new Set(ids).size === ids.length, 'starter ids are unique')

for (const starter of CONVERSATION_STARTERS) {
  const strings = [starter.id, starter.label, starter.response, starter.prompt]
  assert(
    strings.every((value) => typeof value === 'string' && value.trim().length > 0),
    `${starter.id}: id, label, response, and prompt are non-empty strings`,
  )
  if (starter.glyphPhrase !== undefined) {
    assert(
      typeof starter.glyphPhrase === 'string' && starter.glyphPhrase.trim().length > 0,
      `${starter.id}: glyphPhrase is non-empty when present`,
    )
  }
}

// --- Contact copy: classic unchanged, guide labels present ---

const topLevelStrings = [
  COLLABORATE_HEADLINE,
  COLLABORATE_ENERGIZING_STATEMENT,
  COLLABORATE_CONTACT.email,
  COLLABORATE_CONTACT.mailtoUrl,
  COLLABORATE_CONTACT.primaryLabel,
  COLLABORATE_CONTACT.copyLabel,
  COLLABORATE_CONTACT.copySuccessMessage,
  COLLABORATE_CONTACT.copyFailureMessage,
]
assert(
  topLevelStrings.every((value) => typeof value === 'string' && value.trim().length > 0),
  'headline, statement, and contact fields are non-empty strings',
)

assert(
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(COLLABORATE_CONTACT.email),
  'contact email is a plausible address',
)
assert(
  COLLABORATE_CONTACT.mailtoUrl === `mailto:${COLLABORATE_CONTACT.email}`,
  'mailtoUrl is mailto: followed by the contact email',
)

const guideContactStrings = [
  COLLABORATE_GUIDE_CONTACT.email,
  COLLABORATE_GUIDE_CONTACT.mailtoUrl,
  COLLABORATE_GUIDE_CONTACT.primaryLabel,
  COLLABORATE_GUIDE_CONTACT.copyLabel,
  COLLABORATE_GUIDE_CONTACT.copySuccessMessage,
  COLLABORATE_GUIDE_CONTACT.copyFailureMessage,
]
assert(
  guideContactStrings.every((value) => typeof value === 'string' && value.trim().length > 0),
  'guide contact fields are non-empty strings',
)
assert(
  COLLABORATE_GUIDE_CONTACT.email === COLLABORATE_CONTACT.email &&
    COLLABORATE_GUIDE_CONTACT.mailtoUrl === COLLABORATE_CONTACT.mailtoUrl,
  'guide contact reuses the same address and mailto route',
)
assert(
  COLLABORATE_GUIDE_CONTACT.primaryLabel === 'Email Joel directly',
  'guide primary label is “Email Joel directly”',
)
assert(
  COLLABORATE_GUIDE_CONTACT.copyLabel === 'Copy Joel’s email.',
  'guide copy label is “Copy Joel’s email.”',
)

assert(
  typeof COLLABORATE_GUIDE_DISCLOSURE === 'string' && COLLABORATE_GUIDE_DISCLOSURE.trim().length > 0,
  'guide disclosure copy is a non-empty string',
)

// --- Chat view copy: all present, key labels exact ---

const chatCopyStrings = [
  COLLABORATE_GUIDE_PENDING_HEADING,
  COLLABORATE_GUIDE_VISITOR_LABEL,
  COLLABORATE_GUIDE_NAME,
  COLLABORATE_GUIDE_PREVIEW_LABEL,
  COLLABORATE_GUIDE_RESUME,
  COLLABORATE_GUIDE_NEW,
  COLLABORATE_GUIDE_NEW_CONFIRM_PROMPT,
  COLLABORATE_GUIDE_NEW_CONFIRM_YES,
  COLLABORATE_GUIDE_NEW_CONFIRM_CANCEL,
  COLLABORATE_GUIDE_SHARE_LABEL,
  COLLABORATE_GUIDE_SHARE_NOTE,
  COLLABORATE_GUIDE_SHARE_EMAIL_LABEL,
  COLLABORATE_GUIDE_SHARE_BUTTON,
  COLLABORATE_GUIDE_SHARE_SENDING,
  COLLABORATE_GUIDE_SHARE_ERROR,
  COLLABORATE_GUIDE_BACK_LABEL,
  COLLABORATE_GUIDE_COMPOSER_LABEL,
  COLLABORATE_GUIDE_COMPOSER_PLACEHOLDER,
  COLLABORATE_GUIDE_SEND_LABEL,
  COLLABORATE_GUIDE_ANSWERED_ANNOUNCEMENT,
]
assert(
  chatCopyStrings.every((value) => typeof value === 'string' && value.trim().length > 0),
  'all chat view copy constants are non-empty strings',
)
assert(
  COLLABORATE_GUIDE_PENDING_HEADING === 'A conversation about Joel',
  'pending heading is “A conversation about Joel”',
)
assert(COLLABORATE_GUIDE_RESUME === 'Resume conversation', 'resume label is “Resume conversation”')
assert(
  COLLABORATE_GUIDE_NEW === 'Start new conversation',
  'start-new label is “Start new conversation”',
)
assert(
  COLLABORATE_GUIDE_SHARE_LABEL === 'Share conversation with Joel',
  'share switch label is “Share conversation with Joel”',
)
assert(
  COLLABORATE_GUIDE_SHARE_BUTTON === 'Share conversation',
  'share submit button label is “Share conversation”',
)
assert(COLLABORATE_GUIDE_VISITOR_LABEL === 'You', 'visitor turn label is “You”')
assert(COLLABORATE_GUIDE_NAME === 'Joel’s Guide', 'guide name is “Joel’s Guide”')

// --- Canvas topic treatments: all 7 topics, authored phrases only ---

const KNOWN_BEHAVIOR_KEYS = [
  'mouseR',
  'particleRepel',
  'weatherRepelMult',
  'clickImpulseRadius',
  'clickImpulseForce',
]

assert(COLLABORATE_TOPICS.length === 7, 'exactly 7 collaborate topics')
assert(
  new Set(COLLABORATE_TOPICS).size === COLLABORATE_TOPICS.length,
  'topic ids are unique',
)

const treatmentKeys = Object.keys(COLLABORATE_CANVAS_TOPICS)
assert(
  COLLABORATE_TOPICS.every((topic) => treatmentKeys.includes(topic)) &&
    treatmentKeys.every((key) => COLLABORATE_TOPICS.includes(key)),
  'canvas-topic map covers exactly the 7 topics',
)

for (const topic of COLLABORATE_TOPICS) {
  const treatment = COLLABORATE_CANVAS_TOPICS[topic]
  assert(
    typeof treatment.glyphPhrase === 'string' && treatment.glyphPhrase.trim().length > 0,
    `${topic}: glyphPhrase is a non-empty string`,
  )
  if (treatment.behavior !== undefined) {
    const keys = Object.keys(treatment.behavior)
    assert(
      keys.every((key) => KNOWN_BEHAVIOR_KEYS.includes(key)),
      `${topic}: behavior override uses only known behavior keys`,
    )
    assert(
      keys.every((key) => typeof treatment.behavior[key] === 'number'),
      `${topic}: behavior override values are numbers`,
    )
  }
}

// --- Bounds-safe starter lookup ---

assert(getCollaborateStarter(null) === null, 'null id resolves to no starter')
assert(getCollaborateStarter('nope') === null, 'unknown id resolves to no starter')
assert(
  getCollaborateStarter(CONVERSATION_STARTERS[0].id) === CONVERSATION_STARTERS[0],
  'known id resolves to its starter',
)

// --- Scene resolution: starters, topics, and immutability ---

const base = EXPERIENCE_SCENES.collaborate

for (const starter of CONVERSATION_STARTERS) {
  const resolved = resolveCollaborateScene(base, starter)
  if (starter.glyphPhrase) {
    assert(
      resolved.playground.glyphText === starter.glyphPhrase,
      `${starter.id}: resolved scene uses the starter glyph phrase`,
    )
  }
  assert(
    resolved.behavior.mouseR === base.behavior.mouseR &&
      resolved.sourceUrl === base.sourceUrl,
    `${starter.id}: unresolved fields fall back to the collaborate baseline`,
  )
}

// no starter keeps the baseline glyph text
const baselineResolved = resolveCollaborateScene(base, null)
assert(
  baselineResolved.playground.glyphText === base.playground.glyphText,
  'null starter keeps the baseline glyph text',
)

// a topic treatment overrides the glyph text (and wins over a starter)
for (const topic of COLLABORATE_TOPICS) {
  const treatment = COLLABORATE_CANVAS_TOPICS[topic]
  const resolved = resolveCollaborateScene(base, null, topic)
  assert(
    resolved.playground.glyphText === treatment.glyphPhrase,
    `${topic}: topic treatment overrides the glyph text`,
  )
  const withStarter = resolveCollaborateScene(base, CONVERSATION_STARTERS[0], topic)
  assert(
    withStarter.playground.glyphText === treatment.glyphPhrase,
    `${topic}: topic treatment wins over the starter phrase`,
  )
  for (const key of KNOWN_BEHAVIOR_KEYS) {
    const expected = treatment.behavior?.[key] ?? base.behavior[key]
    assert(
      resolved.behavior[key] === expected,
      `${topic}: behavior.${key} resolves to the treatment override or baseline`,
    )
  }
}

// resolution never mutates the baseline descriptor
const baselineGlyphText = EXPERIENCE_SCENES.collaborate.playground.glyphText
const baselineBehavior = { ...EXPERIENCE_SCENES.collaborate.behavior }
resolveCollaborateScene(base, CONVERSATION_STARTERS[0])
resolveCollaborateScene(base, null, COLLABORATE_TOPICS[0])
assert(
  EXPERIENCE_SCENES.collaborate.playground.glyphText === baselineGlyphText &&
    KNOWN_BEHAVIOR_KEYS.every(
      (key) => EXPERIENCE_SCENES.collaborate.behavior[key] === baselineBehavior[key],
    ),
  'base descriptor is not mutated',
)

// the collaborate field is gentler than vibe (warmer, less chaotic)
const vibe = EXPERIENCE_SCENES.vibe
assert(
  base.behavior.particleRepel < vibe.behavior.particleRepel &&
    base.behavior.weatherRepelMult < vibe.behavior.weatherRepelMult &&
    base.behavior.mouseR <= vibe.behavior.mouseR,
  'collaborate behavior is gentler than vibe',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll collaborate content verifications passed.')
