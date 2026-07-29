#!/usr/bin/env node
/**
 * Deterministic verification for the confidential-access stack (Stage 4b):
 * protected-ID validation, HTTP Range parsing, the MIME allowlist, security
 * headers, and the Cloudflare Access JWT verification core (with a locally
 * generated RS256 keypair). Also asserts repo hygiene: nothing confidential
 * can ship in the static export.
 */

const { execSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-protected-api')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'functions', 'lib', 'protectedShared.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true --lib es2020,dom`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  isValidProtectedId,
  parseRangeHeader,
  isAllowedProtectedMime,
  buildProtectedHeaders,
  verifyAccessJwt,
  extractAccessToken,
} = require(path.join(tmpDir, 'protectedShared.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- Protected ID validation ---

assert(isValidProtectedId('pw-7f3a9c2d'), 'slug id is valid')
assert(isValidProtectedId('a'), 'single-character id is valid')
assert(!isValidProtectedId('..'), 'dot traversal rejected')
assert(!isValidProtectedId('../secret'), 'path traversal rejected')
assert(!isValidProtectedId('a/b'), 'slash rejected')
assert(!isValidProtectedId('a%2fb'), 'encoded slash rejected')
assert(!isValidProtectedId('%2e%2e'), 'encoded dots rejected')
assert(!isValidProtectedId('Story-One'), 'uppercase rejected')
assert(!isValidProtectedId('-leading-dash'), 'leading dash rejected')
assert(!isValidProtectedId(''), 'empty rejected')
assert(!isValidProtectedId('x'.repeat(65)), 'over-length rejected')
assert(!isValidProtectedId(undefined), 'undefined rejected')

// --- Range parsing ---

const SIZE = 1000
assert(parseRangeHeader(null, SIZE).kind === 'none', 'no header → none')
assert(parseRangeHeader('', SIZE).kind === 'none', 'empty header → none')

const r1 = parseRangeHeader('bytes=0-99', SIZE)
assert(r1.kind === 'range' && r1.start === 0 && r1.end === 99, 'explicit range parses')

const r2 = parseRangeHeader('bytes=500-', SIZE)
assert(r2.kind === 'range' && r2.start === 500 && r2.end === 999, 'open-ended range clamps to size')

const r3 = parseRangeHeader('bytes=0-9999', SIZE)
assert(r3.kind === 'range' && r3.end === 999, 'oversized end clamps to size')

const r4 = parseRangeHeader('bytes=-200', SIZE)
assert(r4.kind === 'range' && r4.start === 800 && r4.end === 999, 'suffix range resolves')

const r5 = parseRangeHeader('bytes=-99999', SIZE)
assert(r5.kind === 'range' && r5.start === 0 && r5.end === 999, 'oversized suffix clamps to whole object')

assert(parseRangeHeader('bytes=1000-1001', SIZE).kind === 'unsatisfiable', 'start beyond size → 416')
assert(parseRangeHeader('bytes=99-10', SIZE).kind === 'unsatisfiable', 'end before start → 416')
assert(parseRangeHeader('bytes=0-1,3-4', SIZE).kind === 'unsatisfiable', 'multi-range → 416')
assert(parseRangeHeader('bytes=-', SIZE).kind === 'unsatisfiable', 'empty range spec → 416')
assert(parseRangeHeader('bytes=-0', SIZE).kind === 'unsatisfiable', 'zero suffix → 416')
assert(parseRangeHeader('items=0-1', SIZE).kind === 'unsatisfiable', 'non-bytes unit → 416')
assert(parseRangeHeader('garbage', SIZE).kind === 'unsatisfiable', 'malformed → 416')

// --- MIME allowlist ---

for (const ok of ['image/avif', 'image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'application/pdf', 'text/vtt', 'video/mp4; codecs=avc1']) {
  assert(isAllowedProtectedMime(ok), `allowed: ${ok}`)
}
for (const bad of ['text/html', 'application/javascript', 'image/svg+xml', 'application/octet-stream', '', undefined]) {
  assert(!isAllowedProtectedMime(bad), `rejected: ${bad}`)
}

// --- Security headers ---

const headers = buildProtectedHeaders({ 'X-Test': '1' })
assert(headers['Cache-Control'] === 'private, no-store', 'private/no-store caching')
assert(headers['X-Content-Type-Options'] === 'nosniff', 'nosniff')
assert(headers['Referrer-Policy'] === 'no-referrer', 'no-referrer')
assert(headers['X-Test'] === '1', 'extra headers merge')

// --- JWT verification ---

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64url')
}

function signJwt(privateKey, { alg = 'RS256', kid = 'test-key', aud, exp, tamper = false }) {
  const header = base64Url(JSON.stringify({ alg, kid, typ: 'JWT' }))
  const payload = base64Url(JSON.stringify({ aud, exp, email: 'someone@example.org' }))
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  let signature = signer.sign(privateKey)
  if (tamper) signature[0] ^= 0xff
  return `${header}.${payload}.${base64Url(signature)}`
}

async function verifyJwtSuite() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = publicKey.export({ format: 'jwk' })
  const jwks = { keys: [{ ...jwk, kid: 'test-key' }] }
  const now = Math.floor(Date.now() / 1000)
  const AUD = 'test-aud-tag'

  const good = signJwt(privateKey, { aud: AUD, exp: now + 3600 })
  const goodResult = await verifyAccessJwt(good, { jwks, aud: AUD, nowSeconds: now })
  assert(goodResult.ok === true, 'valid Access JWT verifies')

  const badSig = signJwt(privateKey, { aud: AUD, exp: now + 3600, tamper: true })
  const badSigResult = await verifyAccessJwt(badSig, { jwks, aud: AUD, nowSeconds: now })
  assert(badSigResult.ok === false && badSigResult.reason === 'bad signature', 'tampered signature rejected')

  const expired = signJwt(privateKey, { aud: AUD, exp: now - 10 })
  const expiredResult = await verifyAccessJwt(expired, { jwks, aud: AUD, nowSeconds: now })
  assert(expiredResult.ok === false && expiredResult.reason === 'token expired', 'expired token rejected')

  const wrongAud = signJwt(privateKey, { aud: 'other-aud', exp: now + 3600 })
  const wrongAudResult = await verifyAccessJwt(wrongAud, { jwks, aud: AUD, nowSeconds: now })
  assert(wrongAudResult.ok === false && wrongAudResult.reason === 'wrong audience', 'wrong audience rejected')

  const arrayAud = signJwt(privateKey, { aud: [AUD, 'other'], exp: now + 3600 })
  const arrayAudResult = await verifyAccessJwt(arrayAud, { jwks, aud: AUD, nowSeconds: now })
  assert(arrayAudResult.ok === true, 'array aud containing the tag verifies')

  const unknownKid = signJwt(privateKey, { kid: 'nope', aud: AUD, exp: now + 3600 })
  const unknownKidResult = await verifyAccessJwt(unknownKid, { jwks, aud: AUD, nowSeconds: now })
  assert(unknownKidResult.ok === false && unknownKidResult.reason === 'unknown signing key', 'unknown kid rejected')

  const hs256 = signJwt(privateKey, { alg: 'HS256', aud: AUD, exp: now + 3600 })
  const hs256Result = await verifyAccessJwt(hs256, { jwks, aud: AUD, nowSeconds: now })
  assert(hs256Result.ok === false && hs256Result.reason === 'unexpected algorithm', 'non-RS256 alg rejected')

  assert((await verifyAccessJwt('not-a-jwt', { jwks, aud: AUD, nowSeconds: now })).ok === false, 'malformed token rejected')

  // token extraction: cookie first, header fallback
  const cookieReq = new Request('https://x.test/', { headers: { Cookie: 'a=1; CF_Authorization=tok123; b=2' } })
  assert(extractAccessToken(cookieReq) === 'tok123', 'CF_Authorization cookie extracted')
  const headerReq = new Request('https://x.test/', { headers: { 'Cf-Access-Jwt-Assertion': 'tok456' } })
  assert(extractAccessToken(headerReq) === 'tok456', 'assertion header extracted')
  const emptyReq = new Request('https://x.test/')
  assert(extractAccessToken(emptyReq) === null, 'missing token → null')

  // --- Repo hygiene: nothing confidential ships publicly ---
  const publicDir = path.join(projectRoot, 'public')
  const publicFiles = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('._')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else publicFiles.push(full)
    }
  }
  walk(publicDir)
  assert(
    publicFiles.every((file) => !/protected|confidential/i.test(file)),
    'no protected/confidential artifacts under public/',
  )
  assert(
    !fs.existsSync(path.join(projectRoot, 'public', 'manifests')) && !fs.existsSync(path.join(projectRoot, 'public', 'media', 'protected')),
    'no confidential manifest/media directories under public/',
  )
}

verifyJwtSuite()
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} verification(s) failed.`)
      process.exit(1)
    }
    console.log('\nAll protected API verifications passed.')
  })
  .catch((error) => {
    console.error('Verification crashed:', error)
    process.exit(1)
  })
