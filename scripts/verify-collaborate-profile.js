#!/usr/bin/env node
/**
 * Deterministic verification for functions/lib/collaborateProfile.ts: the
 * approved knowledge pack (12 ProfileEntries) — structural validation,
 * evidence deep-link integrity against content/work.ts, protected-content
 * exclusion, expiry handling, prompt serialization, third-person voice
 * hygiene, and category coverage.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-collaborate-profile')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'functions', 'lib', 'collaborateProfile.ts')}" "${path.join(projectRoot, 'functions', 'lib', 'collaborateShared.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true --lib es2022,dom`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  PROFILE_ENTRIES,
  COLLABORATE_TOPICS,
  validateProfileEntries,
  getActiveProfileEntries,
  getProfileEntry,
  buildProfilePackPrompt,
} = require(path.join(tmpDir, 'collaborateProfile.js'))
const { COLLABORATE_SYSTEM_PROMPT } = require(path.join(tmpDir, 'collaborateShared.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- Shipped pack is structurally valid ---

const packErrors = validateProfileEntries(PROFILE_ENTRIES)
assert(packErrors.length === 0, `shipped pack validates clean (got: ${packErrors.join('; ') || 'none'})`)
assert(PROFILE_ENTRIES.length === 18, 'pack contains exactly 18 entries')

// The validator itself works: it must flag a broken clone.
const broken = JSON.parse(JSON.stringify(PROFILE_ENTRIES[0]))
broken.id = PROFILE_ENTRIES[1].id // duplicate
broken.evidenceUrl = 'https://example.com/not-a-deep-link'
const brokenErrors = validateProfileEntries([...PROFILE_ENTRIES, broken])
assert(brokenErrors.some((e) => e.includes('duplicate id')), 'validator catches duplicate ids')
assert(brokenErrors.some((e) => e.includes('deep link')), 'validator catches non-#work evidence URLs')

// --- ID + evidence integrity ---

const ids = PROFILE_ENTRIES.map((e) => e.id)
assert(new Set(ids).size === ids.length, 'entry ids are unique')

const workSrc = fs.readFileSync(path.join(projectRoot, 'content', 'work.ts'), 'utf8')
const storiesBlock = workSrc.slice(workSrc.indexOf('export const WORK_STORIES'), workSrc.indexOf('export const WORK_SLIDES'))
const storyIds = new Set([...storiesBlock.matchAll(/id: '([a-z0-9-]+)'/g)].map((m) => m[1]))
assert(storyIds.size >= 2, `test fixture: extracted ${storyIds.size} work story ids`)

for (const entry of PROFILE_ENTRIES) {
  if (entry.sourceType === 'portfolio') {
    const m = /^#work\/([a-z0-9-]+)$/.exec(entry.evidenceUrl || '')
    assert(Boolean(m), `${entry.id}: evidenceUrl is a #work/<storyId> deep link`)
    assert(m && storyIds.has(m[1]), `${entry.id}: evidenceUrl story "${m && m[1]}" exists in content/work.ts`)
  } else {
    assert(entry.evidenceUrl === undefined, `${entry.id}: approved-profile entries carry no URL`)
  }
  assert(COLLABORATE_TOPICS.includes(entry.canvasTopic), `${entry.id}: canvasTopic is a known collaborate topic`)
}

// --- Protected-content exclusion ---

// Extract protected story ids + protectedIds from content/work.ts.
function extractProtectedRefs(src) {
  const storyIdsOut = []
  const protectedIds = []
  for (const match of src.matchAll(/access: 'protected'/g)) {
    const before = src.slice(0, match.index)
    const idMatch = /id: '([^']+)'/g
    let last = null
    let m
    while ((m = idMatch.exec(before))) last = m[1]
    if (last) storyIdsOut.push(last)
    const after = src.slice(match.index, match.index + 500)
    const pid = /protectedId: '([^']+)'/.exec(after)
    if (pid) protectedIds.push(pid[1])
  }
  return { storyIds: storyIdsOut, protectedIds }
}

const entryText = (entry) =>
  JSON.stringify([entry.statement, entry.evidenceLabel, entry.evidenceUrl ?? '', entry.tags, entry.aliases])

const protectedRefs = extractProtectedRefs(workSrc)
assert(
  protectedRefs.storyIds.length === 0 && protectedRefs.protectedIds.length === 0,
  `content/work.ts currently ships no protected stories (extracted ${protectedRefs.storyIds.length})`,
)
for (const ref of [...protectedRefs.storyIds, ...protectedRefs.protectedIds]) {
  assert(
    PROFILE_ENTRIES.every((e) => !entryText(e).includes(ref)),
    `no profile entry references protected ref "${ref}"`,
  )
}

// The exclusion machinery itself must work: a synthetic protected story is
// extracted, and a synthetic entry referencing it is caught.
const syntheticSrc = `{ id: 'acme-secret', access: 'protected', protectedId: 'prot-9f2k' }`
const syntheticRefs = extractProtectedRefs(syntheticSrc)
assert(
  syntheticRefs.storyIds.includes('acme-secret') && syntheticRefs.protectedIds.includes('prot-9f2k'),
  'protected-ref extractor catches a synthetic protected story',
)
const syntheticEntry = { statement: 'Joel led acme-secret for a client.', evidenceLabel: 'x', tags: [], aliases: [] }
assert(entryText(syntheticEntry).includes('acme-secret'), 'exclusion check flags an entry referencing a protected id')

// Hard substrings that must never appear in the model-addressable pack.
for (const entry of PROFILE_ENTRIES) {
  const text = entryText(entry)
  assert(!/protectedId|protected-work|under NDA/i.test(text), `${entry.id}: no protected-work vocabulary`)
  assert(!/\bR2\b/.test(text), `${entry.id}: no R2 storage references`)
}

// --- Expiry handling ---

const base = { ...PROFILE_ENTRIES[0], sourceType: 'approved-profile', evidenceUrl: undefined }
const expired = { ...base, id: 'syn-expired', expiryDate: '2020-01-01' }
const future = { ...base, id: 'syn-future', expiryDate: '2099-01-01' }
const expiresToday = { ...base, id: 'syn-today', expiryDate: '2026-06-15' }
const noExpiry = { ...base, id: 'syn-none' }
const activeIds = getActiveProfileEntries('2026-06-15', [expired, future, expiresToday, noExpiry]).map((e) => e.id)
assert(!activeIds.includes('syn-expired'), 'expired entry (expiryDate < today) is excluded')
assert(activeIds.includes('syn-future'), 'future expiryDate is included')
assert(activeIds.includes('syn-today'), 'expiryDate == today is still included')
assert(activeIds.includes('syn-none'), 'entries without expiryDate are included')

const realToday = new Date().toISOString().slice(0, 10)
const activePack = getActiveProfileEntries(realToday)
assert(activePack.length === PROFILE_ENTRIES.length, 'all shipped entries are active today')

// --- Prompt serialization ---

const prompt = buildProfilePackPrompt(activePack)
assert(prompt.startsWith('APPROVED PROFILE'), 'pack prompt opens with the approved-profile header')
for (const entry of activePack) {
  assert(prompt.includes(`id: ${entry.id} `), `prompt names entry id "${entry.id}"`)
  assert(prompt.includes(entry.statement), `prompt includes the statement for "${entry.id}"`)
}
assert(
  /sourceIds must come from the approved profile entry IDs/.test(COLLABORATE_SYSTEM_PROMPT),
  'system prompt instructs the model to cite entry IDs verbatim',
)

// --- Third-person hygiene ---

for (const entry of PROFILE_ENTRIES) {
  const s = entry.statement
  assert(!/^\s*i\b/i.test(s), `${entry.id}: statement does not start with first-person "I"`)
  assert(
    !/\bmy (?:portfolio|work|approach|experience|projects?|process|background)\b/i.test(s),
    `${entry.id}: no first-person "my <noun>" phrasing`,
  )
  assert(
    !/\bi(?:'m| am) joel\b/i.test(s) && !/\bas joel\b/i.test(s) && !/\bi led\b/i.test(s),
    `${entry.id}: no impersonation phrasing`,
  )
}

// --- Category coverage ---

const ALL_CATEGORIES = [
  'values',
  'ic-craft',
  'design-leadership',
  'ambiguity',
  'research',
  'systems-thinking',
  'ai-product',
  'cross-functional',
  'conflict',
  'career-interests',
  'entrepreneurial',
  'logistics',
]
const EXPECTED_COVERED_NOW = [
  'values',
  'ic-craft',
  'design-leadership',
  'ambiguity',
  'research',
  'systems-thinking',
  'ai-product',
  'cross-functional',
  'career-interests',
  'entrepreneurial',
  'logistics',
]
const covered = new Set(PROFILE_ENTRIES.map((e) => e.category))
for (const cat of EXPECTED_COVERED_NOW) {
  assert(covered.has(cat), `pack covers category "${cat}"`)
}
const missing = ALL_CATEGORIES.filter((c) => !covered.has(c))
assert(
  missing.length === 1 && missing[0] === 'conflict',
  `only "conflict" awaits the interview import (missing: ${missing.join(', ') || 'none'})`,
)

// --- Lookup helper ---

assert(getProfileEntry(PROFILE_ENTRIES[0].id) === PROFILE_ENTRIES[0], 'getProfileEntry resolves a known id')
assert(getProfileEntry('nope') === null, 'getProfileEntry returns null for unknown ids')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll collaborate profile verifications passed.')
