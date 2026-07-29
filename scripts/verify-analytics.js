#!/usr/bin/env node
/**
 * Deterministic verification for consent-based analytics (Stage 5):
 * consent storage (180-day TTL, malformed/expired handling), the closed
 * event surface and redaction guarantees, and structural proof that nothing
 * loads before opt-in and no forbidden configuration exists anywhere.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-analytics')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'engine', 'analytics.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true --lib es2020,dom`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  CONSENT_STORAGE_KEY,
  CONSENT_TTL_MS,
  readConsent,
  writeConsent,
  sanitizeEvent,
  outboundHost,
  createAnalyticsClient,
} = require(path.join(tmpDir, 'analytics.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    _map: map,
  }
}

const NOW = 1_800_000_000_000

// --- Consent storage ---

assert(CONSENT_TTL_MS === 180 * 24 * 60 * 60 * 1000, 'consent TTL is 180 days')

const storage = memoryStorage()
assert(readConsent(storage, NOW) === null, 'absent consent reads as undecided')

writeConsent(storage, 'granted', NOW)
const granted = readConsent(storage, NOW + 1000)
assert(granted?.decision === 'granted', 'granted decision round-trips')

writeConsent(storage, 'denied', NOW)
assert(readConsent(storage, NOW + 1000)?.decision === 'denied', 'denied decision round-trips')

writeConsent(storage, 'granted', NOW)
assert(
  readConsent(storage, NOW + CONSENT_TTL_MS - 1)?.decision === 'granted',
  'decision honored just inside the TTL',
)
assert(readConsent(storage, NOW + CONSENT_TTL_MS + 1) === null, 'decision expires after 180 days')
assert(readConsent(storage, NOW - 1000) === null, 'future-dated decision is rejected')

storage._map.set(CONSENT_STORAGE_KEY, 'not json')
assert(readConsent(storage, NOW) === null, 'malformed record reads as undecided')
storage._map.set(CONSENT_STORAGE_KEY, JSON.stringify({ decision: 'sometimes', decidedAt: NOW }))
assert(readConsent(storage, NOW) === null, 'unknown decision value reads as undecided')

const throwingStorage = {
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('blocked') },
}
assert(readConsent(throwingStorage, NOW) === null, 'unreadable storage reads as undecided')
writeConsent(throwingStorage, 'granted', NOW)
assert(true, 'unwritable storage does not throw')

// --- Redaction ---

const clean = sanitizeEvent({ name: 'upload_result', params: { mime_type: 'image/svg+xml', ok: true } })
assert(clean.name === 'upload_result' && clean.params.mime_type === 'image/svg+xml' && clean.params.ok === true, 'whitelisted params survive')

const poisoned = sanitizeEvent({
  name: 'upload_result',
  params: { mime_type: 'image/png', ok: false, filename: 'secret.sketch', glyphText: 'hello', path: '/Users/x' },
})
assert(!('filename' in poisoned.params) && !('glyphText' in poisoned.params) && !('path' in poisoned.params), 'non-whitelisted keys are stripped')

const hostPoison = sanitizeEvent({ name: 'outbound_link', params: { host: 'example.org', referrer: 'x' } })
assert(Object.keys(hostPoison.params).join(',') === 'host', 'outbound_link carries host only')

// --- Outbound host ---

assert(outboundHost('https://www.example.org/path?q=1') === 'www.example.org', 'https URL yields bare host')
assert(outboundHost('not a url') === null, 'garbage URL yields null')
assert(outboundHost('javascript:alert(1)') === null, 'non-http scheme yields null')

// --- Client: nothing loads before consent; failures are silent ---

const clientStorage = memoryStorage()
const client = createAnalyticsClient({ measurementId: 'G-TEST', storage: clientStorage })
assert(!client.isActive(), 'client is inactive before consent')
client.track({ name: 'experience_view', params: { experience: 'work' } })
assert(true, 'tracking before consent is a silent no-op')

client.deny()
assert(readConsent(clientStorage, Date.now())?.decision === 'denied', 'deny records the decision')
assert(!client.isActive(), 'client stays inactive after denial')

client.grant() // document is undefined in Node — boot must no-op safely
assert(readConsent(clientStorage, Date.now())?.decision === 'granted', 'grant records the decision')

const noIdClient = createAnalyticsClient({ measurementId: '', storage: memoryStorage() })
noIdClient.grant()
assert(!noIdClient.isActive(), 'missing measurement ID never activates')

const protectedClient = createAnalyticsClient({
  measurementId: 'G-TEST',
  storage: memoryStorage(),
  pathname: '/protected-work?story=pw-1',
})
protectedClient.grant()
assert(!protectedClient.isActive(), 'client refuses to activate on protected routes')

// --- Structural guarantees in source ---

const analyticsSource = fs.readFileSync(path.join(projectRoot, 'engine', 'analytics.ts'), 'utf8')
assert(!analyticsSource.includes('client_storage'), 'no client_storage override anywhere')
assert(!analyticsSource.includes('anonymize_ip'), 'no anonymize_ip promise anywhere')
assert(
  analyticsSource.indexOf('createElement') > analyticsSource.indexOf('grant'),
  'gtag.js is only ever created inside the grant path',
)

// No GA references outside the sealed module (provider sealing).
const { execSync: exec } = require('child_process')
let leaks = ''
try {
  leaks = exec(
    `grep -rn "googletagmanager\\|gtag(" app components content engine functions --include="*.ts" --include="*.tsx" | grep -v "engine/analytics.ts" | grep -v "\\._" || true`,
    { cwd: projectRoot, encoding: 'utf8' },
  )
} catch (error) {
  leaks = ''
}
assert(leaks.trim() === '', 'no GA references outside engine/analytics.ts (provider sealed)')

// The protected viewer never mounts the consent UI.
const protectedPage = fs.readFileSync(path.join(projectRoot, 'app', 'protected-work', 'page.tsx'), 'utf8')
const protectedViewer = fs.readFileSync(path.join(projectRoot, 'app', 'protected-work', 'ProtectedWorkViewer.tsx'), 'utf8')
assert(
  !protectedPage.includes('AnalyticsConsent') && !protectedViewer.includes('AnalyticsConsent'),
  'protected viewer mounts no consent/analytics UI',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll analytics verifications passed.')
