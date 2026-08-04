#!/usr/bin/env node
/**
 * Deterministic verification for the collaborate transcript-share backend:
 * functions/lib/collaborateShare.ts (payload validation, retention math, the
 * request handler against a mocked D1) and the structural contract of
 * migrations/0002_create_collaborate_shares.sql.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-collaborate-share')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'functions', 'lib', 'collaborateShare.ts')}" "${path.join(projectRoot, 'functions', 'api', 'collaborate', 'share.ts')}" "${path.join(projectRoot, 'functions', 'types.d.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true --lib es2022,dom`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  SHARE_RETENTION_DAYS,
  SHARE_RETENTION_SECONDS,
  SHARE_EMAIL_MAX,
  SHARE_MAX_MESSAGES,
  SHARE_MESSAGE_MAX_CHARS,
  SHARE_INSERT_SQL,
  SHARE_DELETE_EXPIRED_SQL,
  validateSharePayload,
  handleShareRequest,
} = require(path.join(tmpDir, 'lib', 'collaborateShare.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- Constants ---

assert(SHARE_RETENTION_DAYS === 180, 'retention is 180 days')
assert(SHARE_RETENTION_SECONDS === 180 * 24 * 60 * 60, 'retention seconds match 180 days')
assert(SHARE_MAX_MESSAGES === 26, 'transcript cap is 26 messages')
assert(SHARE_MESSAGE_MAX_CHARS === 4000, 'message cap is 4000 chars')
assert(SHARE_EMAIL_MAX === 254, 'email cap is 254 chars')

// --- validateSharePayload ---

const VALID = {
  messages: [
    { role: 'user', content: 'What did Joel design at Microsoft?' },
    { role: 'assistant', content: 'Joel designed the EX Toolkit.' },
  ],
  consentVersion: 'v1',
}
const ok = validateSharePayload(VALID)
assert(ok.ok === true, 'valid payload accepted')
assert(ok.ok && ok.payload.replyEmail === undefined, 'absent email stays absent')

assert(validateSharePayload({ ...VALID, messages: [] }).ok === false, 'empty messages rejected')
assert(
  validateSharePayload({
    ...VALID,
    messages: Array.from({ length: 27 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })),
  }).ok === false,
  '27 messages rejected',
)
assert(
  validateSharePayload({
    ...VALID,
    messages: Array.from({ length: 26 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })),
  }).ok === true,
  '26 messages accepted',
)
assert(validateSharePayload({ ...VALID, messages: [{ role: 'system', content: 'x' }] }).ok === false, 'unknown role rejected')
assert(validateSharePayload({ ...VALID, messages: [{ role: 'user', content: 'x'.repeat(4001) }] }).ok === false, '4001-char message rejected')
assert(validateSharePayload({ ...VALID, messages: [{ role: 'user', content: 'x'.repeat(4000) }] }).ok === true, '4000-char message accepted')

assert(validateSharePayload({ messages: VALID.messages }).ok === false, 'missing consentVersion rejected')
assert(validateSharePayload({ ...VALID, consentVersion: 'v2' }).ok === false, 'unknown consentVersion rejected')
assert(validateSharePayload({ ...VALID, consentVersion: 1 }).ok === false, 'non-string consentVersion rejected')

assert(validateSharePayload({ ...VALID, replyEmail: 'not-an-email' }).ok === false, 'malformed email rejected')
const longEmail = `${'a'.repeat(64)}@${'b'.repeat(254 - 64 - 1 - 4 + 1)}.com`
assert(longEmail.length === 255, 'test fixture: 255-char email')
assert(validateSharePayload({ ...VALID, replyEmail: longEmail }).ok === false, 'email over 254 chars rejected')

const trimmedEmail = validateSharePayload({ ...VALID, replyEmail: '  someone@example.org ' })
assert(trimmedEmail.ok && trimmedEmail.payload.replyEmail === 'someone@example.org', 'email is trimmed')
const blankEmail = validateSharePayload({ ...VALID, replyEmail: '   ' })
assert(blankEmail.ok && blankEmail.payload.replyEmail === undefined, 'blank email omitted from the payload')

const withRoute = validateSharePayload({ ...VALID, modelRoute: { modelClass: 'openai/gpt-5.6-luna', profileVersion: '2026-08-03.v1' } })
assert(withRoute.ok && withRoute.payload.modelRoute.modelClass === 'openai/gpt-5.6-luna', 'modelRoute carried through')
assert(validateSharePayload({ ...VALID, modelRoute: 'nope' }).ok === false, 'non-object modelRoute rejected')

// --- handleShareRequest against a mocked D1 ---

const NOW = 1700000000
const DEPS = { nowSeconds: () => NOW, randomId: () => 'receipt-test-id' }

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
  return new Request('https://joelhoke.me/api/collaborate/share', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function handlerSuite() {
  // 503 when the binding is missing.
  const noDb = await handleShareRequest(jsonRequest(VALID), undefined, DEPS)
  assert(noDb.status === 503, 'missing COLLABORATE_DB binding → 503 (fail closed)')

  // 415 for the wrong content type.
  const wrongType = await handleShareRequest(jsonRequest(VALID, 'text/plain'), makeDb([]), DEPS)
  assert(wrongType.status === 415, 'text/plain → 415')

  // 400 for unparseable JSON.
  const badJson = await handleShareRequest(jsonRequest('{not json'), makeDb([]), DEPS)
  assert(badJson.status === 400, 'unparseable JSON → 400')

  // 400 for an oversized body.
  const oversized = await handleShareRequest(
    jsonRequest({ messages: [{ role: 'user', content: 'x'.repeat(4000) }], consentVersion: 'v1', pad: 'y'.repeat(64 * 1024) }),
    makeDb([]),
    DEPS,
  )
  assert(oversized.status === 400, 'body over 64KB → 400')

  // 400 for an invalid payload (and nothing is stored).
  const invalidCalls = []
  const invalid = await handleShareRequest(jsonRequest({ messages: [], consentVersion: 'v1' }), makeDb(invalidCalls), DEPS)
  assert(invalid.status === 400, 'invalid payload → 400')
  assert(invalidCalls.length === 0, 'invalid payload stores nothing')

  // 201 on success with the full storage contract.
  const calls = []
  const res = await handleShareRequest(
    jsonRequest({ ...VALID, replyEmail: 'someone@example.org', modelRoute: { modelClass: 'fallback' } }),
    makeDb(calls),
    DEPS,
  )
  assert(res.status === 201, 'valid share → 201')
  const body = await res.json()
  assert(body.ok === true && body.receiptId === 'receipt-test-id', 'receipt id returned')
  assert(res.headers.get('cache-control') === 'no-store', 'responses are never cached')

  const insert = calls.find((c) => c.sql === SHARE_INSERT_SQL)
  assert(Boolean(insert), 'insert statement executed')
  assert(insert && insert.values.length === 7, 'insert binds exactly 7 values')
  if (insert) {
    const [id, transcript, email, consentVersion, modelRoute, createdAt, expiresAt] = insert.values
    assert(id === 'receipt-test-id', 'id is the injected receipt id')
    assert(transcript === JSON.stringify(VALID.messages), 'transcript stored as JSON')
    assert(email === 'someone@example.org', 'reply email stored')
    assert(consentVersion === 'v1', 'consent version stored')
    assert(modelRoute === JSON.stringify({ modelClass: 'fallback' }), 'model route stored as JSON')
    assert(createdAt === NOW, 'created_at is the injected clock')
    assert(expiresAt === NOW + SHARE_RETENTION_SECONDS, 'expires_at = created_at + 180 days')
  }
  const sweep = calls.find((c) => c.sql === SHARE_DELETE_EXPIRED_SQL)
  assert(Boolean(sweep), 'opportunistic expiry delete executed')
  assert(sweep && sweep.values.length === 1 && sweep.values[0] === NOW, 'expiry delete bound to the same now')

  // No email → null column, never an empty string.
  const noEmailCalls = []
  const noEmailRes = await handleShareRequest(jsonRequest(VALID), makeDb(noEmailCalls), DEPS)
  assert(noEmailRes.status === 201, 'share without email → 201')
  const noEmailInsert = noEmailCalls.find((c) => c.sql === SHARE_INSERT_SQL)
  assert(noEmailInsert && noEmailInsert.values[2] === null, 'absent email stored as NULL')

  // D1 failure → 503 (never a fake success).
  const failRes = await handleShareRequest(jsonRequest(VALID), makeDb([], { failOn: 'INSERT' }), DEPS)
  assert(failRes.status === 503, 'D1 insert failure → 503')
  assert((await failRes.json()).ok === false, '503 body reports failure')
}

// --- Migration structure ---

const migration = fs.readFileSync(
  path.join(projectRoot, 'migrations', '0002_create_collaborate_shares.sql'),
  'utf8',
)
assert(/CREATE TABLE IF NOT EXISTS collaborate_shares\(/.test(migration), 'migration creates collaborate_shares')
for (const column of ['id', 'transcript', 'email', 'consent_version', 'model_route', 'created_at', 'expires_at']) {
  assert(new RegExp(`^\\s+${column}\\s`, 'm').test(migration), `migration has the ${column} column`)
}
assert(/id TEXT PRIMARY KEY/.test(migration), 'id is the primary key')
assert(
  /CREATE INDEX IF NOT EXISTS idx_collaborate_shares_expires_at ON collaborate_shares\(expires_at\)/.test(migration),
  'migration indexes expires_at for the retention sweep',
)
assert(/created_at \+ 180 days/.test(migration), 'migration documents the 180-day retention')

handlerSuite()
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} verification(s) failed.`)
      process.exit(1)
    }
    console.log('\nAll collaborate share verifications passed.')
  })
  .catch((error) => {
    console.error('Verification crashed:', error)
    process.exit(1)
  })
