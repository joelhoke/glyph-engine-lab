#!/usr/bin/env node
/**
 * Publish hosted-prototype bundles to the PROTOTYPES_BUCKET R2 bucket
 * (docs/prototypes-plan.md, Phase 0).
 *
 * Usage:
 *   node scripts/publish-prototypes.mjs [<stack>[/<slug>]] [--bucket NAME] [--dry-run]
 *
 * Walks prototypes/<stack>/<slug>/ (or a single stack/prototype when
 * filtered) and uploads every serveable file to <bucket>/<stack>/<slug>/<file…>
 * via the wrangler CLI (`wrangler r2 object put`), which must be
 * authenticated. Content types are assigned from the same extension
 * allowlist the catch-all (functions/p/[[path]].ts) serves — files outside
 * the allowlist are skipped with a warning because they would 404 anyway.
 *
 * Removing a prototype: delete its objects —
 *   wrangler r2 object delete <bucket>/<stack>/<slug>/<file>  (per file)
 * and remove its entry from functions/lib/prototypesManifest.ts.
 */

import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
// Mirrors PROTOTYPE_MIME_BY_EXTENSION in functions/p/[[path]].ts — keep in sync.
const CONTENT_TYPE_BY_EXTENSION = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.avif', 'image/avif'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.vtt', 'text/vtt'],
])

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { filter: null, bucket: process.env.PROTOTYPES_BUCKET_NAME ?? 'jh-prototypes', dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--bucket') {
      args.bucket = argv[++i]
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/publish-prototypes.mjs [<stack>[/<slug>]] [--bucket NAME] [--dry-run]')
      process.exit(0)
    } else if (!args.filter) {
      args.filter = arg
    } else {
      fail(`unexpected argument: ${arg}`)
    }
  }
  return args
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  )
}

const args = parseArgs(process.argv.slice(2))
const prototypesRoot = path.join(repoRoot, 'prototypes')
if (!fs.existsSync(prototypesRoot)) fail(`prototypes directory not found: ${prototypesRoot}`)

let filterStack = null
let filterSlug = null
if (args.filter) {
  const parts = args.filter.split('/')
  if (parts.length > 2 || !parts.every((part) => SLUG_PATTERN.test(part))) {
    fail(`invalid filter "${args.filter}" — expected <stack> or <stack>/<slug>`)
  }
  ;[filterStack, filterSlug] = parts
}

const stacks = fs
  .readdirSync(prototypesRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && SLUG_PATTERN.test(entry.name))
  .map((entry) => entry.name)
  .filter((name) => !filterStack || name === filterStack)
if (filterStack && stacks.length === 0) fail(`no bundle stack matches "${filterStack}"`)

const uploads = []
const skipped = []
for (const stack of stacks) {
  const stackDir = path.join(prototypesRoot, stack)
  const slugs = fs
    .readdirSync(stackDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SLUG_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .filter((name) => !filterSlug || name === filterSlug)
  for (const slug of slugs) {
    const bundleDir = path.join(stackDir, slug)
    for (const file of walk(bundleDir)) {
      const relative = path.relative(bundleDir, file).split(path.sep).join('/')
      const extension = path.extname(file).toLowerCase()
      const contentType = CONTENT_TYPE_BY_EXTENSION.get(extension)
      if (!contentType) {
        skipped.push(`${stack}/${slug}/${relative}`)
        continue
      }
      uploads.push({ key: `${stack}/${slug}/${relative}`, file, contentType })
    }
  }
}

if (uploads.length === 0) fail('nothing to upload')
console.log(
  `${args.dryRun ? '[dry-run] would upload' : 'Uploading'} ${uploads.length} file(s) to ${args.bucket}` +
  (skipped.length ? ` — skipping ${skipped.length} non-serveable file(s)` : ''),
)
for (const name of skipped) console.log(`  skip: ${name}`)

let failures = 0
for (const upload of uploads) {
  console.log(`  put: ${upload.key}`)
  if (args.dryRun) continue
  try {
    execFileSync(
      'wrangler',
      ['r2', 'object', 'put', `${args.bucket}/${upload.key}`, '--file', upload.file, '--content-type', upload.contentType, '--remote'],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
  } catch (error) {
    failures += 1
    console.error(`  FAILED: ${upload.key} — ${error.stderr?.toString().trim() || error.message}`)
  }
}

if (failures > 0) fail(`${failures} upload(s) failed`)
console.log(args.dryRun ? '[dry-run] done' : 'Done.')
