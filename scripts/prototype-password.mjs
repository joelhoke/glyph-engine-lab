#!/usr/bin/env node
/**
 * Generate a PBKDF2 password record for a gated prototype stack
 * (docs/prototypes-plan.md, Phase 1).
 *
 * Usage:
 *   node scripts/prototype-password.mjs "<password>"
 *   node scripts/prototype-password.mjs            (prompts, no shell history)
 *
 * Prints a `pbkdf2$<iterations>$<salt-b64u>$<hash-b64u>` record to paste
 * into the stack's access.passwordHash in functions/lib/prototypesManifest.ts.
 * Verification lives in functions/lib/prototypeAuth.ts (WebCrypto) — keep
 * the parameters (SHA-256, 100k iterations, 32-byte salt/hash) in sync.
 * Plaintext passwords never enter the repo.
 */

import crypto from 'crypto'
import readline from 'readline'

const ITERATIONS = 100_000
const KEY_BYTES = 32
const SALT_BYTES = 32

function b64u(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function recordFor(password) {
  const salt = crypto.randomBytes(SALT_BYTES)
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_BYTES, 'sha256')
  return `pbkdf2$${ITERATIONS}$${b64u(salt)}$${b64u(hash)}`
}

const arg = process.argv[2]
if (arg) {
  console.log(recordFor(arg))
  process.exit(0)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question('Password to hash: ', (password) => {
  rl.close()
  if (!password) {
    console.error('ERROR: empty password')
    process.exit(1)
  }
  console.log(recordFor(password))
})
