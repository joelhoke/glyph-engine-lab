#!/usr/bin/env node
/**
 * Deterministic verification for the feedback stack: payload validation
 * boundaries, honeypot short-circuit, retention math, and the request
 * handler against a mocked D1. Also structural asserts on the FAB/panel
 * (aria wiring, safe-area + 100dvh CSS) and that the feedback view never
 * touches analytics.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-feedback')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'functions', 'lib', 'feedbackShared.ts')}" "${path.join(projectRoot, 'functions', 'api', 'feedback', 'index.ts')}" "${path.join(projectRoot, 'functions', 'types.d.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true --lib es2020,dom`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const shared = require(path.join(tmpDir, 'lib', 'feedbackShared.js'))
const handlerModule = require(path.join(tmpDir, 'api', 'feedback', 'index.js'))
const {
  validateFeedbackPayload,
  retentionWindow,
  handleFeedbackRequest,
  FEEDBACK_RETENTION_SECONDS,
  FEEDBACK_INSERT_SQL,
} = shared

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- Validation boundaries ---

const msg = (n) => 'x'.repeat(n)
assert(validateFeedbackPayload({ message: msg(9) }).kind === 'invalid', '9 chars rejected')
assert(validateFeedbackPayload({ message: msg(10) }).kind === 'ok', '10 chars accepted')
assert(validateFeedbackPayload({ message: msg(2000) }).kind === 'ok', '2000 chars accepted')
assert(validateFeedbackPayload({ message: msg(2001) }).kind === 'invalid', '2001 chars rejected')

const trimmed = validateFeedbackPayload({ message: `  ${msg(10)}  ` })
assert(trimmed.kind === 'ok' && trimmed.message === msg(10), 'message is trimmed before length check/storage')
assert(validateFeedbackPayload({ message: `  ${msg(7)}  ` }).kind === 'invalid', '9 effective chars after trim rejected')
assert(validateFeedbackPayload({ message: '          ' }).kind === 'invalid', 'whitespace-only message rejected')
assert(validateFeedbackPayload({ message: 42 }).kind === 'invalid', 'non-string message rejected')
assert(validateFeedbackPayload(null).kind === 'invalid', 'null body rejected')
assert(validateFeedbackPayload([1, 2]).kind === 'invalid', 'array body rejected')

const okEmail = validateFeedbackPayload({ message: msg(10), email: 'someone@example.org' })
assert(okEmail.kind === 'ok' && okEmail.email === 'someone@example.org', 'valid email accepted')
const trimmedEmail = validateFeedbackPayload({ message: msg(10), email: '  someone@example.org ' })
assert(trimmedEmail.kind === 'ok' && trimmedEmail.email === 'someone@example.org', 'email is trimmed')
const blankEmail = validateFeedbackPayload({ message: msg(10), email: '   ' })
assert(blankEmail.kind === 'ok' && blankEmail.email === null, 'blank email treated as absent')
assert(validateFeedbackPayload({ message: msg(10), email: 'not-an-email' }).kind === 'invalid', 'malformed email rejected')
assert(validateFeedbackPayload({ message: msg(10), email: 'a@b' }).kind === 'invalid', 'dotless domain rejected')
assert(validateFeedbackPayload({ message: msg(10), email: 'a b@c.de' }).kind === 'invalid', 'whitespace in email rejected')

const exactEmail = (len) => {
  // 64-char local part + '@' + dotted domain, totaling exactly len chars.
  return `${'a'.repeat(64)}@${'b'.repeat(len - 64 - 1 - 4)}.com`
}
assert(exactEmail(254).length === 254, 'test fixture: 254-char email')
assert(validateFeedbackPayload({ message: msg(10), email: exactEmail(254) }).kind === 'ok', '254-char email accepted')
assert(validateFeedbackPayload({ message: msg(10), email: exactEmail(255) }).kind === 'invalid', '255-char email rejected')

// --- Honeypot short-circuit ---

assert(validateFeedbackPayload({ message: msg(10), company: 'Spam Inc.' }).kind === 'honeypot', 'filled honeypot detected')
assert(validateFeedbackPayload({ message: msg(10), company: '  x ' }).kind === 'honeypot', 'whitespace-padded honeypot detected')
assert(validateFeedbackPayload({ message: msg(10), company: '' }).kind === 'ok', 'empty honeypot is fine')
assert(validateFeedbackPayload({ message: msg(10), company: '   ' }).kind === 'ok', 'whitespace-only honeypot is fine')

// --- Retention math ---

const now = 1700000000
const window1 = retentionWindow(now)
assert(window1.createdAt === now, 'created_at is the injected clock')
assert(window1.expiresAt - window1.createdAt === FEEDBACK_RETENTION_SECONDS, 'expires exactly 180 days after created (seconds)')
assert(FEEDBACK_RETENTION_SECONDS === 180 * 24 * 60 * 60, 'retention constant is 180 days in seconds')

// --- Request handler against a mocked D1 ---

function makeDb(calls, options = {}) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() {
              calls.push({ sql, values })
              if (options.failOn && sql.startsWith(options.failOn)) {
                throw new Error('d1 unavailable')
              }
              return { success: true }
            },
          }
        },
      }
    },
  }
}

function jsonRequest(body, contentType = 'application/json') {
  return new Request('https://joelhoke.me/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function handlerSuite() {
  // Success path via the real Pages Function wiring (onRequestPost).
  const calls = []
  const db = makeDb(calls)
  const res = await handlerModule.onRequestPost({
    request: jsonRequest({ message: msg(12), email: 'someone@example.org' }),
    env: { FEEDBACK_DB: db },
  })
  assert(res.status === 201, 'valid submission → 201')
  assert(JSON.stringify(await res.json()) === JSON.stringify({ ok: true }), 'success body is {"ok":true}')

  const insert = calls.find((c) => c.sql === FEEDBACK_INSERT_SQL)
  assert(Boolean(insert), 'insert statement executed')
  assert(insert && insert.values.length === 5, 'insert binds exactly 5 values (id, message, email, created_at, expires_at)')
  if (insert) {
    const [id, message, email, createdAt, expiresAt] = insert.values
    assert(typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id), 'id is a UUID')
    assert(message === msg(12) && email === 'someone@example.org', 'message and email stored (trimmed)')
    assert(Number.isInteger(createdAt) && Number.isInteger(expiresAt), 'timestamps are integers')
    assert(expiresAt - createdAt === FEEDBACK_RETENTION_SECONDS, 'stored timestamps are 180 days apart')
  }
  const allSql = calls.map((c) => c.sql).join('\n')
  assert(!/ip|user_agent|useragent|glyph|analytics/i.test(allSql), 'no IP/UA/glyph/analytics columns touched')
  const deleteCall = calls.find((c) => c.sql.startsWith('DELETE FROM feedback'))
  assert(Boolean(deleteCall), 'opportunistic expiry delete executed')

  // Honeypot: 201 without storing.
  const honeyCalls = []
  const honeyRes = await handleFeedbackRequest(
    jsonRequest({ message: msg(12), company: 'Spam Inc.' }),
    makeDb(honeyCalls),
  )
  assert(honeyRes.status === 201, 'honeypot → 201 (fake success)')
  assert(honeyCalls.length === 0, 'honeypot stores nothing')

  // D1 failure → 503.
  const failRes = await handleFeedbackRequest(
    jsonRequest({ message: msg(12) }),
    makeDb([], { failOn: 'INSERT' }),
  )
  assert(failRes.status === 503, 'D1 insert failure → 503')
  assert(!(await failRes.json()).ok, '503 body reports failure')

  // Bad JSON → 400.
  const badJsonRes = await handleFeedbackRequest(jsonRequest('{not json'), makeDb([]))
  assert(badJsonRes.status === 400, 'unparseable JSON → 400')

  // Wrong content type → 415.
  const wrongTypeRes = await handleFeedbackRequest(
    jsonRequest({ message: msg(12) }, 'text/plain'),
    makeDb([]),
  )
  assert(wrongTypeRes.status === 415, 'text/plain → 415')
  const charsetRes = await handleFeedbackRequest(
    jsonRequest({ message: msg(12) }, 'application/json; charset=utf-8'),
    makeDb([]),
  )
  assert(charsetRes.status === 201, 'application/json with charset accepted')

  // Invalid fields → 400, no echo of submitted text.
  const secret = 'shh-nine!' // exactly 9 chars → invalid, must not be echoed
  const invalidRes = await handleFeedbackRequest(jsonRequest({ message: secret }), makeDb([]))
  assert(invalidRes.status === 400, 'too-short message → 400')
  const invalidBody = await invalidRes.text()
  assert(!invalidBody.includes(secret), 'error response never echoes submitted text')

  // Missing binding → fail closed 503.
  const noDbRes = await handleFeedbackRequest(jsonRequest({ message: msg(12) }), undefined)
  assert(noDbRes.status === 503, 'missing FEEDBACK_DB binding → 503 (fail closed)')

  // --- Structural asserts: component + CSS ---

  const componentSrc = fs.readFileSync(path.join(projectRoot, 'components', 'AnalyticsConsent.tsx'), 'utf8')
  const cssSrc = fs.readFileSync(path.join(projectRoot, 'components', 'AnalyticsConsent.css'), 'utf8')

  assert(/aria-expanded=\{panelOpen\}/.test(componentSrc), 'FAB has aria-expanded')
  assert(/aria-controls=\{panelId\}/.test(componentSrc), 'FAB has aria-controls')
  assert(/aria-label="Privacy and feedback"/.test(componentSrc), 'FAB accessible name is "Privacy and feedback"')
  assert(/role="tablist"/.test(componentSrc) && /role="tabpanel"/.test(componentSrc), 'tab semantics present')
  assert(componentSrc.includes("event.key === 'Escape'"), 'Escape closes the panel')

  assert(cssSrc.includes('env(safe-area-inset-top, 0px)'), 'CSS uses safe-area-inset-top')
  assert(cssSrc.includes('env(safe-area-inset-right, 0px)'), 'CSS uses safe-area-inset-right')
  assert(cssSrc.includes('100dvh'), 'panel max-height is bounded by 100dvh')
  assert(cssSrc.includes('overflow-y: auto'), 'panel scrolls internally')

  // The feedback view must never emit analytics events.
  const feedbackStart = componentSrc.indexOf('function FeedbackForm')
  const feedbackEnd = componentSrc.indexOf('export default function')
  assert(feedbackStart !== -1 && feedbackEnd > feedbackStart, 'FeedbackForm is a standalone section')
  const feedbackSrc = componentSrc.slice(feedbackStart, feedbackEnd)
  assert(!/gtag|clientRef|createAnalyticsClient|\.track\(|\.grant\(|\.deny\(/.test(feedbackSrc), 'feedback view contains no analytics calls')
}

handlerSuite()
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} verification(s) failed.`)
      process.exit(1)
    }
    console.log('\nAll feedback verifications passed.')
  })
  .catch((error) => {
    console.error('Verification crashed:', error)
    process.exit(1)
  })
