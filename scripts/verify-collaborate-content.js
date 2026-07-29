#!/usr/bin/env node
/**
 * Deterministic verification for content/collaborate.ts: the Collaborate
 * experience content model (placeholder invitation copy, conversation
 * starters, contact destinations) and the per-starter scene descriptor
 * resolution used to drive the canvas glyph phrase.
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
  COLLABORATE_STARTER_COUNT,
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

// exactly three starters
assert(CONVERSATION_STARTERS.length === 3, 'exactly 3 conversation starters')
assert(
  COLLABORATE_STARTER_COUNT === CONVERSATION_STARTERS.length,
  'COLLABORATE_STARTER_COUNT matches the array',
)

// unique ids
const ids = CONVERSATION_STARTERS.map((starter) => starter.id)
assert(new Set(ids).size === ids.length, 'starter ids are unique')

// every required copy field is present and non-empty
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

for (const starter of CONVERSATION_STARTERS) {
  const strings = [starter.id, starter.label, starter.response]
  assert(
    strings.every((value) => typeof value === 'string' && value.trim().length > 0),
    `${starter.id}: id, label, and response are non-empty strings`,
  )
  if (starter.glyphPhrase !== undefined) {
    assert(
      typeof starter.glyphPhrase === 'string' && starter.glyphPhrase.trim().length > 0,
      `${starter.id}: glyphPhrase is non-empty when present`,
    )
  }
}

// email is a plausible address
assert(
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(COLLABORATE_CONTACT.email),
  'contact email is a plausible address',
)

// mailto URL is well-formed and matches the email
assert(
  COLLABORATE_CONTACT.mailtoUrl === `mailto:${COLLABORATE_CONTACT.email}`,
  'mailtoUrl is mailto: followed by the contact email',
)

// bounds-safe starter lookup
assert(getCollaborateStarter(null) === null, 'null id resolves to no starter')
assert(getCollaborateStarter('nope') === null, 'unknown id resolves to no starter')
assert(
  getCollaborateStarter(CONVERSATION_STARTERS[0].id) === CONVERSATION_STARTERS[0],
  'known id resolves to its starter',
)

// per-starter scene resolution
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

// resolution never mutates the baseline descriptor
const baselineGlyphText = EXPERIENCE_SCENES.collaborate.playground.glyphText
resolveCollaborateScene(base, CONVERSATION_STARTERS[0])
assert(
  EXPERIENCE_SCENES.collaborate.playground.glyphText === baselineGlyphText,
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
