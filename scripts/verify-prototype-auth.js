#!/usr/bin/env node
/* Roundtrip verification for functions/lib/prototypeAuth.ts (Phase 1):
   PBKDF2 record verify + signed-cookie issue/parse, including tamper,
   version-revocation, and expiry paths. */
const { execSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-auth')
fs.rmSync(tmpDir, { recursive: true, force: true })
fs.mkdirSync(tmpDir, { recursive: true })
execSync(
  `npx tsc "${path.join(projectRoot, 'functions/lib/prototypeAuth.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
  { stdio: 'inherit', cwd: projectRoot },
)

const auth = require(path.join(tmpDir, 'prototypeAuth.js'))

let failures = 0
function check(label, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) failures += 1
}

const b64u = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function main() {
  // --- PBKDF2 records ---
  const salt = crypto.randomBytes(32)
  const hash = crypto.pbkdf2Sync('correct horse', salt, 100000, 32, 'sha256')
  const record = `pbkdf2$100000$${b64u(salt)}$${b64u(hash)}`
  check('pbkdf2: correct password verifies', await auth.verifyPrototypePassword('correct horse', record))
  check('pbkdf2: wrong password rejected', !(await auth.verifyPrototypePassword('wrong', record)))
  check('pbkdf2: malformed record rejected', !(await auth.verifyPrototypePassword('correct horse', 'nope')))

  // --- Signed cookies ---
  const secret = 'test-secret-32-bytes-exactly-padded!!'
  const now = Date.now()
  const setCookie = await auth.issuePrototypeCookie('golden-age-collectables', 3, secret, now)
  const cookiePair = setCookie.split(';')[0]
  const req = (cookie) => new Request('https://x.test/p/golden-age-collectables/', { headers: { Cookie: cookie } })

  check('cookie: issued grant verifies', await auth.hasPrototypeAccess(req(cookiePair), 'golden-age-collectables', 3, secret, now))
  check('cookie: missing cookie rejected', !(await auth.hasPrototypeAccess(req(''), 'golden-age-collectables', 3, secret, now)))
  check(
    'cookie: tokenVersion bump revokes',
    !(await auth.hasPrototypeAccess(req(cookiePair), 'golden-age-collectables', 4, secret, now)),
  )
  check(
    'cookie: wrong stack rejected',
    !(await auth.hasPrototypeAccess(req(cookiePair), 'type-lab', 3, secret, now)),
  )
  check(
    'cookie: wrong secret rejected',
    !(await auth.hasPrototypeAccess(req(cookiePair), 'golden-age-collectables', 3, 'other-secret', now)),
  )
  check(
    'cookie: expiry enforced',
    !(await auth.hasPrototypeAccess(req(cookiePair), 'golden-age-collectables', 3, secret, now + 15 * 24 * 3600 * 1000)),
  )
  const tampered = cookiePair.replace(/.$/, cookiePair.endsWith('A') ? 'B' : 'A')
  check('cookie: tampered value rejected', !(await auth.hasPrototypeAccess(req(tampered), 'golden-age-collectables', 3, secret, now)))
  check(
    'cookie: path scoping present',
    setCookie.includes('Path=/p/golden-age-collectables;') && setCookie.includes('HttpOnly') && setCookie.includes('Secure'),
  )

  // --- Magic-link tokens ---
  const exp = now + 30 * 24 * 3600 * 1000
  const token = await auth.issuePrototypeLinkToken('golden-age-collectables', 3, secret, exp)
  check('link: minted token verifies', await auth.verifyPrototypeLinkToken(token, 'golden-age-collectables', 3, secret, now))
  check('link: wrong stack rejected', !(await auth.verifyPrototypeLinkToken(token, 'type-lab', 3, secret, now)))
  check('link: tokenVersion bump revokes', !(await auth.verifyPrototypeLinkToken(token, 'golden-age-collectables', 4, secret, now)))
  check('link: expiry enforced', !(await auth.verifyPrototypeLinkToken(token, 'golden-age-collectables', 3, secret, exp + 1)))
  check(
    'link: cookie value not replayable as token',
    !(await auth.verifyPrototypeLinkToken(cookiePair.split('=')[1], 'golden-age-collectables', 3, secret, now)),
  )
  const tamperedToken = token.replace(/.$/, token.endsWith('A') ? 'B' : 'A')
  check('link: tampered token rejected', !(await auth.verifyPrototypeLinkToken(tamperedToken, 'golden-age-collectables', 3, secret, now)))

  fs.rmSync(tmpDir, { recursive: true, force: true })
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll prototype-auth verifications passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
