#!/usr/bin/env node
/**
 * Deterministic verification for the vibe-creations gallery backend:
 * functions/lib/creations.ts (payload/upload validation, ID and media-key
 * validation, the D1 dedup/insert/FIFO-eviction flow against a mocked D1) and
 * the structural contract of migrations/0003_create_creations.sql.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-creations-api')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'functions', 'lib', 'creations.ts')}" "${path.join(projectRoot, 'functions', 'lib', 'creationsAdmin.ts')}" "${path.join(projectRoot, 'functions', 'types.d.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true --lib es2022,dom`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  CREATIONS_CAP,
  MAX_STATE_BYTES,
  MAX_THUMB_BYTES,
  MAX_MEDIA_BYTES,
  MAX_SOURCE_BYTES,
  CREATION_KINDS,
  THUMB_MIME_TO_EXT,
  MEDIA_MIME_TO_EXT,
  SOURCE_MIME_TO_EXT,
  CREATION_SELECT_BY_HASH_SQL,
  CREATION_INSERT_SQL,
  CREATION_EVICT_SELECT_SQL,
  CREATION_EVICT_DELETE_SQL,
  isValidCreationId,
  isValidMediaKey,
  isValidModerationAction,
  validateCreationPayload,
  validateUploadMeta,
  insertCreation,
  buildCreationHeaders,
} = require(path.join(tmpDir, 'creations.js'))

const {
  issueCreationsAdminCookie,
  hasCreationsAdminAccess,
  verifyCreationsAdminPassword,
} = require(path.join(tmpDir, 'creationsAdmin.js'))

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

assert(CREATIONS_CAP === 100, 'row cap is 100')
assert(MAX_STATE_BYTES === 512 * 1024, 'state cap is 512KB')
assert(MAX_THUMB_BYTES === 1 * 1024 * 1024, 'thumb cap is 1MB')
assert(MAX_MEDIA_BYTES === 25 * 1024 * 1024, 'media cap is 25MB')
assert(MAX_SOURCE_BYTES === 5 * 1024 * 1024, 'source cap is 5MB')
assert(
  Array.isArray(CREATION_KINDS) &&
    CREATION_KINDS.includes('auto') &&
    CREATION_KINDS.includes('image') &&
    CREATION_KINDS.includes('clip') &&
    CREATION_KINDS.length === 3,
  'kinds are exactly auto/image/clip',
)
assert(Object.keys(THUMB_MIME_TO_EXT).length === 3, 'thumb allowlist has 3 MIME types')
assert('video/mp4' in MEDIA_MIME_TO_EXT && 'video/webm' in MEDIA_MIME_TO_EXT, 'media allowlist is mp4 + webm')
assert('image/svg+xml' in SOURCE_MIME_TO_EXT, 'source allowlist includes SVG')

// --- isValidCreationId ---

assert(isValidCreationId('3f6b8a2e-1234-4abc-9def-0123456789ab'), 'UUID-shaped id accepted')
assert(!isValidCreationId('not-an-id'), 'random string rejected')
assert(!isValidCreationId('3f6b8a2e-1234-4abc-9def-0123456789a'.repeat(3)), 'overlong id rejected')
assert(!isValidCreationId('3F6B8A2E-1234-4ABC-9DEF-0123456789AB'), 'uppercase id rejected')
assert(!isValidCreationId(42), 'non-string id rejected')

// --- isValidMediaKey ---

const ID = '3f6b8a2e-1234-4abc-9def-0123456789ab'
assert(isValidMediaKey(`thumb/${ID}.webp`), 'thumb key accepted')
assert(isValidMediaKey(`media/${ID}.mp4`), 'media key accepted')
assert(isValidMediaKey(`source/${ID}.svg`), 'source key accepted')
assert(!isValidMediaKey(`thumb/../${ID}.webp`), 'traversal rejected')
assert(!isValidMediaKey(`../${ID}.webp`), 'leading traversal rejected')
assert(!isValidMediaKey(`Thumb/${ID}.webp`), 'uppercase prefix rejected')
assert(!isValidMediaKey(`thumb/${ID.toUpperCase()}.webp`), 'uppercase id segment rejected')
assert(!isValidMediaKey(`evil/${ID}.webp`), 'unknown prefix rejected')
assert(!isValidMediaKey(`thumb/${ID}.webp/extra`), 'extra segment rejected')
assert(!isValidMediaKey('no-slash.webp'), 'missing prefix rejected')

// --- validateCreationPayload ---

const HASH = 'a'.repeat(64)
const VALID_STATE = JSON.stringify({ version: 1, nodes: [] })

assert(
  validateCreationPayload({ state: VALID_STATE, configHash: HASH, kind: 'auto' }).ok === true,
  'valid auto payload accepted',
)
assert(
  validateCreationPayload({ state: VALID_STATE, configHash: HASH, kind: 'image' }).ok === true,
  'valid image payload accepted',
)
assert(
  validateCreationPayload({ state: VALID_STATE, configHash: HASH, kind: 'clip', hasMedia: true }).ok === true,
  'clip with media accepted',
)

const oversized = JSON.stringify({ version: 1, pad: 'x'.repeat(MAX_STATE_BYTES) })
assert(oversized.length > MAX_STATE_BYTES, 'test fixture: oversized state exceeds cap')
assert(
  validateCreationPayload({ state: oversized, configHash: HASH, kind: 'auto' }).ok === false,
  'oversize state rejected',
)
const atCapState = JSON.stringify({ version: 1, pad: 'x'.repeat(MAX_STATE_BYTES - 30) })
assert(atCapState.length <= MAX_STATE_BYTES, 'test fixture: at-cap state within cap')
assert(
  validateCreationPayload({ state: atCapState, configHash: HASH, kind: 'auto' }).ok === true,
  'state at the cap accepted',
)

assert(
  validateCreationPayload({ state: VALID_STATE, configHash: 'not-a-hash', kind: 'auto' }).ok === false,
  'bad config hash rejected',
)
assert(
  validateCreationPayload({ state: VALID_STATE, configHash: 'A'.repeat(64), kind: 'auto' }).ok === false,
  'uppercase config hash rejected',
)
assert(
  validateCreationPayload({ state: VALID_STATE, configHash: 'a'.repeat(63), kind: 'auto' }).ok === false,
  'short config hash rejected',
)

assert(
  validateCreationPayload({ state: VALID_STATE, configHash: HASH, kind: 'video' }).ok === false,
  'bad kind rejected',
)
assert(
  validateCreationPayload({ state: VALID_STATE, configHash: HASH, kind: 'clip' }).ok === false,
  'clip without media rejected',
)
assert(
  validateCreationPayload({ state: VALID_STATE, configHash: HASH, kind: 'auto', hasMedia: true }).ok === false,
  'media file on non-clip kind rejected',
)

assert(
  validateCreationPayload({ state: '{not json', configHash: HASH, kind: 'auto' }).ok === false,
  'unparseable state rejected',
)
assert(
  validateCreationPayload({ state: '[1,2]', configHash: HASH, kind: 'auto' }).ok === false,
  'array state rejected',
)
assert(
  validateCreationPayload({ state: JSON.stringify({ version: 2 }), configHash: HASH, kind: 'auto' }).ok === false,
  'version !== 1 rejected',
)
assert(
  validateCreationPayload({ state: '', configHash: HASH, kind: 'auto' }).ok === false,
  'empty state rejected',
)

// --- validateUploadMeta ---

assert(
  validateUploadMeta({ size: 1000, type: 'image/webp' }, THUMB_MIME_TO_EXT, MAX_THUMB_BYTES, 'thumb').ok === true,
  'valid thumb upload accepted',
)
assert(
  validateUploadMeta({ size: MAX_THUMB_BYTES + 1, type: 'image/webp' }, THUMB_MIME_TO_EXT, MAX_THUMB_BYTES, 'thumb')
    .ok === false,
  'oversize thumb rejected',
)
assert(
  validateUploadMeta({ size: 1000, type: 'image/gif' }, THUMB_MIME_TO_EXT, MAX_THUMB_BYTES, 'thumb').ok === false,
  'disallowed thumb MIME rejected',
)
const extCheck = validateUploadMeta({ size: 1000, type: 'video/mp4' }, MEDIA_MIME_TO_EXT, MAX_MEDIA_BYTES, 'media')
assert(extCheck.ok === true && extCheck.ext === 'mp4', 'mp4 upload maps to .mp4 extension')

// --- buildCreationHeaders ---

const headers = buildCreationHeaders()
assert(headers['cache-control'] === 'no-store', 'creation responses are never cached')
assert(headers['x-content-type-options'] === 'nosniff', 'creation responses carry nosniff')

// --- insertCreation against a mocked D1 ---

const NOW = 1700000000

/** Minimal in-memory D1 that understands exactly the creations SQL. */
function makeDb(options = {}) {
  const rows = []
  const calls = []
  return {
    rows,
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              calls.push({ sql, values })
              if (options.failOn && sql.startsWith(options.failOn)) throw new Error('d1 unavailable')
              if (sql === CREATION_SELECT_BY_HASH_SQL) {
                const hit = rows.find((r) => r.config_hash === values[0])
                return hit ? { id: hit.id } : null
              }
              return null
            },
            async all() {
              calls.push({ sql, values })
              if (options.failOn && sql.startsWith(options.failOn)) throw new Error('d1 unavailable')
              if (sql === CREATION_EVICT_SELECT_SQL) {
                const sorted = [...rows].sort((a, b) => b.created_at - a.created_at)
                const kept = new Set(sorted.slice(0, CREATIONS_CAP).map((r) => r.id))
                return {
                  results: rows
                    .filter((r) => !kept.has(r.id))
                    .map((r) => ({ thumb_key: r.thumb_key, media_key: r.media_key, source_key: r.source_key })),
                }
              }
              return { results: [] }
            },
            async run() {
              calls.push({ sql, values })
              if (options.failOn && sql.startsWith(options.failOn)) throw new Error('d1 unavailable')
              if (sql === CREATION_INSERT_SQL) {
                const [id, kind, state, config_hash, thumb_key, media_key, source_key, created_at] = values
                rows.push({ id, kind, state, config_hash, thumb_key, media_key, source_key, listed: 0, created_at })
              } else if (sql === CREATION_EVICT_DELETE_SQL) {
                const sorted = [...rows].sort((a, b) => b.created_at - a.created_at)
                const kept = new Set(sorted.slice(0, CREATIONS_CAP).map((r) => r.id))
                for (let i = rows.length - 1; i >= 0; i -= 1) if (!kept.has(rows[i].id)) rows.splice(i, 1)
              }
              return { success: true }
            },
          }
        },
      }
    },
  }
}

// The lib calls .prepare(sql).all() / .run() WITHOUT .bind() for the eviction
// statements — the mock above only supports the .bind() chain, so wrap it to
// also expose parameterless execution.
function makeDbFull(options = {}) {
  const inner = makeDb(options)
  const basePrepare = inner.prepare
  inner.prepare = (sql) => {
    const stmt = basePrepare(sql)
    const boundless = stmt.bind()
    return {
      bind: stmt.bind,
      first: () => boundless.first(),
      all: () => boundless.all(),
      run: () => boundless.run(),
    }
  }
  return inner
}

function makeCreation(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    kind: 'auto',
    state: VALID_STATE,
    configHash: crypto.randomUUID().replace(/-/g, '').padEnd(64, '0').slice(0, 64),
    thumbKey: null,
    mediaKey: null,
    sourceKey: null,
    ...overrides,
  }
}

async function insertSuite() {
  // Plain insert.
  const db = makeDbFull()
  const creation = makeCreation({ kind: 'clip', thumbKey: `thumb/${ID}.webp`, mediaKey: `media/${ID}.mp4` })
  const res = await insertCreation(db, creation, NOW)
  assert(res.ok === true && res.duplicate === false, 'fresh insert succeeds')
  assert(db.rows.length === 1, 'row stored')
  assert(db.rows[0].listed === 0, 'row inserted unlisted (held for review)')
  assert(db.rows[0].created_at === NOW, 'created_at is the injected clock')
  assert(db.rows[0].thumb_key === `thumb/${ID}.webp` && db.rows[0].media_key === `media/${ID}.mp4`, 'media keys stored')
  assert(Array.isArray(res.evictedKeys) && res.evictedKeys.length === 0, 'no eviction below the cap')

  // Insert binds 8 values: 7 columns + created_at (listed is a literal 0).
  const insertCall = db.calls.find((c) => c.sql === CREATION_INSERT_SQL)
  assert(insertCall && insertCall.values.length === 8, 'insert binds exactly 8 values')

  // Duplicate config hash short-circuits before any insert.
  const dupDb = makeDbFull()
  const original = makeCreation()
  await insertCreation(dupDb, original, NOW)
  const dup = await insertCreation(dupDb, { ...makeCreation(), configHash: original.configHash }, NOW + 1)
  assert(dup.ok === true && dup.duplicate === true, 'duplicate hash short-circuits')
  assert(dupDb.rows.length === 1, 'duplicate stores nothing')
  const dupInserts = dupDb.calls.filter((c) => c.sql === CREATION_INSERT_SQL)
  assert(dupInserts.length === 1, 'duplicate never runs the insert')

  // FIFO eviction beyond the cap, returning the evicted rows' media keys.
  const evictDb = makeDbFull()
  let lastResult = null
  for (let i = 0; i < CREATIONS_CAP + 1; i += 1) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    lastResult = await insertCreation(
      evictDb,
      makeCreation({
        id,
        kind: 'image',
        thumbKey: `thumb/${id}.png`,
        sourceKey: `source/${id}.png`,
      }),
      NOW + i,
    )
  }
  assert(evictDb.rows.length === CREATIONS_CAP, `table held at the ${CREATIONS_CAP}-row cap`)
  assert(!evictDb.rows.some((r) => r.id === '00000000-0000-4000-8000-000000000000'), 'oldest row evicted (FIFO)')
  assert(
    evictDb.rows.some((r) => r.id === `00000000-0000-4000-8000-${String(CREATIONS_CAP).padStart(12, '0')}`),
    'newest row kept',
  )
  assert(lastResult.ok && lastResult.duplicate === false, 'evicting insert still succeeds')
  const evictedId = '00000000-0000-4000-8000-000000000000'
  assert(
    lastResult.evictedKeys.includes(`thumb/${evictedId}.png`) && lastResult.evictedKeys.includes(`source/${evictedId}.png`),
    'evicted media keys returned for R2 cleanup',
  )
  assert(
    evictDb.calls.some((c) => c.sql === CREATION_EVICT_DELETE_SQL),
    'eviction delete executed',
  )

  // D1 failure → clean error, never a fake success.
  const failRes = await insertCreation(makeDbFull({ failOn: 'INSERT' }), makeCreation(), NOW)
  assert(failRes.ok === false, 'D1 insert failure surfaces as an error')
}

// --- Migration structure ---

const migration = fs.readFileSync(path.join(projectRoot, 'migrations', '0003_create_creations.sql'), 'utf8')
assert(/CREATE TABLE IF NOT EXISTS creations\(/.test(migration), 'migration creates creations')
for (const column of ['id', 'kind', 'state', 'config_hash', 'thumb_key', 'media_key', 'source_key', 'listed', 'created_at']) {
  assert(new RegExp(`^\\s+${column}\\s`, 'm').test(migration), `migration has the ${column} column`)
}
assert(/id TEXT PRIMARY KEY/.test(migration), 'id is the primary key')
assert(/listed INTEGER NOT NULL DEFAULT 0/.test(migration), 'rows default to unlisted')
assert(/CREATE INDEX IF NOT EXISTS idx_creations_hash ON creations\(config_hash\)/.test(migration), 'migration indexes config_hash for dedup')
assert(
  /CREATE INDEX IF NOT EXISTS idx_creations_listed_created ON creations\(listed, created_at\)/.test(migration),
  'migration indexes (listed, created_at) for the gallery listing',
)

// --- moderation: action validation + admin auth round-trip ---------------------

assert(isValidModerationAction('list'), "moderation: 'list' is a valid action")
assert(isValidModerationAction('unlist'), "moderation: 'unlist' is a valid action")
assert(isValidModerationAction('delete'), "moderation: 'delete' is a valid action")
assert(!isValidModerationAction('drop') && !isValidModerationAction('') && !isValidModerationAction(null), 'moderation: unknown actions are rejected')

async function moderationSuite() {
  // PBKDF2 record generated with the same parameters as
  // scripts/prototype-password.mjs (SHA-256, 100k iterations, 32-byte salts).
  const nodeCrypto = require('crypto')
  const b64u = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const salt = nodeCrypto.randomBytes(32)
  const record = `pbkdf2$100000$${b64u(salt)}$${b64u(nodeCrypto.pbkdf2Sync('correct horse', salt, 100000, 32, 'sha256'))}`
  assert(await verifyCreationsAdminPassword('correct horse', record), 'admin auth: correct password verifies')
  assert(!(await verifyCreationsAdminPassword('wrong horse', record)), 'admin auth: wrong password rejected')
  assert(!(await verifyCreationsAdminPassword('correct horse', 'not-a-record')), 'admin auth: malformed record rejected')

  const secret = 'test-signing-secret'
  const now = Date.now()
  const cookie = await issueCreationsAdminCookie(secret, now)
  const cookiePair = cookie.split(';')[0]
  assert(cookiePair.startsWith('jh_creations_admin='), 'admin cookie: expected name')
  assert(/HttpOnly; Secure; SameSite=Lax/.test(cookie) && /Path=\//.test(cookie), 'admin cookie: hardened attributes')
  const authed = await hasCreationsAdminAccess(new Request('https://x', { headers: { Cookie: cookiePair } }), secret, now + 1000)
  assert(authed, 'admin cookie: fresh cookie grants access')
  const tampered = `${cookiePair.slice(0, -2)}xx`
  assert(
    !(await hasCreationsAdminAccess(new Request('https://x', { headers: { Cookie: tampered } }), secret, now + 1000)),
    'admin cookie: tampered signature rejected',
  )
  assert(
    !(await hasCreationsAdminAccess(new Request('https://x', { headers: { Cookie: cookiePair } }), 'other-secret', now + 1000)),
    'admin cookie: wrong signing secret rejected',
  )
  const expired = await issueCreationsAdminCookie(secret, now - 15 * 24 * 60 * 60 * 1000)
  assert(
    !(await hasCreationsAdminAccess(new Request('https://x', { headers: { Cookie: expired.split(';')[0] } }), secret, now)),
    'admin cookie: expired cookie rejected',
  )
  assert(
    !(await hasCreationsAdminAccess(new Request('https://x'), secret, now)),
    'admin cookie: missing cookie rejected',
  )
}

insertSuite()
  .then(() => moderationSuite())
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} verification(s) failed.`)
      process.exit(1)
    }
    console.log('\nAll creations API verifications passed.')
  })
  .catch((error) => {
    console.error('Verification crashed:', error)
    process.exit(1)
  })
