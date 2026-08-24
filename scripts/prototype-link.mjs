#!/usr/bin/env node
/**
 * Mint a magic link for a gated prototype stack (docs/prototypes-plan.md,
 * Phase 1). Usage:
 *   node scripts/prototype-link.mjs <stack> [--days N] [--base URL]
 *
 * Signs the token with PROTOTYPES_AUTH_SECRET from .dev.vars (compiling the
 * real functions/lib/prototypeAuth.ts so the algorithm can never drift) and
 * prints the full /s/<stack>?k=<token> URL. Default lifetime: 30 days.
 * Revoking every outstanding link for a stack: bump its tokenVersion in
 * functions/lib/prototypesManifest.ts and redeploy.
 *
 * NOTE: tokens only verify against deployments using the SAME secret. The
 * preview and production environments have their own copies of
 * PROTOTYPES_AUTH_SECRET — links minted here work wherever the .dev.vars
 * value is the configured secret.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const stack = args.find((arg) => !arg.startsWith('--'))
const daysFlag = args.indexOf('--days')
const baseFlag = args.indexOf('--base')
const days = daysFlag >= 0 ? Number(args[daysFlag + 1]) : 30
const base = baseFlag >= 0 ? args[baseFlag + 1] : 'https://joelhoke.me'
if (!stack) fail('usage: node scripts/prototype-link.mjs <stack> [--days N] [--base URL]')
if (!Number.isFinite(days) || days <= 0) fail('--days must be a positive number')

// Secret from .dev.vars (gitignored).
const devVarsPath = path.join(repoRoot, '.dev.vars')
if (!fs.existsSync(devVarsPath)) fail('.dev.vars not found — expected PROTOTYPES_AUTH_SECRET=<secret>')
const secretLine = fs
  .readFileSync(devVarsPath, 'utf8')
  .split('\n')
  .find((line) => line.startsWith('PROTOTYPES_AUTH_SECRET='))
if (!secretLine) fail('PROTOTYPES_AUTH_SECRET not found in .dev.vars')
const secret = secretLine.slice('PROTOTYPES_AUTH_SECRET='.length).trim()

// tokenVersion from the manifest (textual lookup — the manifest is the
// source of truth and this stays robust to formatting).
const manifest = fs.readFileSync(
  path.join(repoRoot, 'functions', 'lib', 'prototypesManifest.ts'),
  'utf8',
)
const stackBlock = manifest.match(
  new RegExp(`slug: '${stack}'[\\s\\S]*?tokenVersion: (\\d+)`),
)
if (!stackBlock) fail(`stack "${stack}" (with a tokenVersion) not found in the manifest`)
const tokenVersion = Number(stackBlock[1])

// Compile the real auth lib so token minting matches verification exactly.
const tmpDir = path.join(repoRoot, 'tmp-prototype-link')
fs.rmSync(tmpDir, { recursive: true, force: true })
fs.mkdirSync(tmpDir, { recursive: true })
execSync(
  `npx tsc "${path.join(repoRoot, 'functions', 'lib', 'prototypeAuth.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
  { stdio: 'inherit', cwd: repoRoot },
)
const { issuePrototypeLinkToken } = require(path.join(tmpDir, 'prototypeAuth.js'))

const expMs = Date.now() + days * 24 * 60 * 60 * 1000
const token = await issuePrototypeLinkToken(stack, tokenVersion, secret, expMs)
fs.rmSync(tmpDir, { recursive: true, force: true })

console.log(`\n${base}/s/${stack}?k=${token}`)
console.log(`\nexpires: ${new Date(expMs).toISOString()} (${days} days), tokenVersion ${tokenVersion}`)
