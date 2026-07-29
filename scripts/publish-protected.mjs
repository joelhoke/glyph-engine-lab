#!/usr/bin/env node
/**
 * Publish a confidential-work directory to the private R2 bucket (Stage 4b).
 *
 * Usage:
 *   node scripts/publish-protected.mjs <confidential-dir> [--bucket NAME] [--dry-run]
 *
 * The bucket name comes from --bucket or PROTECTED_BUCKET_NAME. Uploads run
 * through the wrangler CLI (`wrangler r2 object put`), which must be
 * authenticated. The source directory MUST live outside this repository —
 * confidential material never enters Git or the static export.
 *
 * Expected directory layout:
 *   <dir>/index.json                 — [{ id, title, summary }]
 *   <dir>/manifests/<id>.json        — full story manifest (schema below)
 *   <dir>/media/<file>               — binaries referenced by manifests
 *
 * Manifest schema:
 *   { id, title, summary,
 *     sections?: [{ heading, paragraphs?: string[], items?: string[] }],
 *     media?: [{ id (= media filename), file, type: 'image'|'video', alt,
 *                caption?, width?, height?, poster?, captions? }] }
 *
 * Media IDs equal their filename, match ^[a-z0-9][a-z0-9-]{0,63}$ (any
 * extension), and are served at /api/protected/media/<id> — so a WebVTT
 * captions file should itself live in media/ and be referenced as
 * captions: '/api/protected/media/<vtt-id>'.
 *
 * Revoking a story: delete its objects —
 *   wrangler r2 object delete <bucket>/manifests/<id>.json
 *   wrangler r2 object delete <bucket>/media/<file>   (per media entry)
 * and remove its entry from index.json (republish index). Revoking a
 * PERSON happens in the Cloudflare Zero Trust dashboard (Access policy).
 */

import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const ALLOWED_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.pdf', 'application/pdf'],
  ['.vtt', 'text/vtt'],
])
const SIZE_WARN_BYTES = 50 * 1024 * 1024

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { dir: null, bucket: process.env.PROTECTED_BUCKET_NAME ?? null, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--bucket') {
      args.bucket = argv[++i]
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/publish-protected.mjs <confidential-dir> [--bucket NAME] [--dry-run]')
      process.exit(0)
    } else if (!args.dir) {
      args.dir = arg
    } else {
      fail(`unexpected argument: ${arg}`)
    }
  }
  return args
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`invalid JSON at ${file}: ${error.message}`)
  }
}

function mediaIdFromFile(file) {
  const base = path.basename(file)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

const args = parseArgs(process.argv.slice(2))
if (!args.dir) fail('a confidential directory is required (see --help)')
if (!args.bucket) fail('a bucket is required: --bucket NAME or PROTECTED_BUCKET_NAME')

const sourceDir = path.resolve(args.dir)
const repoRoot = path.resolve(__dirname, '..')
if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
  fail(`directory not found: ${sourceDir}`)
}
if (sourceDir === repoRoot || sourceDir.startsWith(repoRoot + path.sep)) {
  fail('the confidential directory must live OUTSIDE this repository')
}

// --- Validate ----------------------------------------------------------------

const indexFile = path.join(sourceDir, 'index.json')
if (!fs.existsSync(indexFile)) fail(`missing ${indexFile}`)
const index = readJson(indexFile)
if (!Array.isArray(index) || index.length === 0) fail('index.json must be a non-empty array')

const uploads = [] // { local, key, contentType }
uploads.push({ local: indexFile, key: 'manifests/index.json', contentType: 'application/json' })

const seenIds = new Set()
for (const entry of index) {
  if (!entry || !ID_PATTERN.test(entry.id ?? '')) fail(`index entry has an invalid id: ${JSON.stringify(entry)}`)
  if (seenIds.has(entry.id)) fail(`duplicate story id in index.json: ${entry.id}`)
  seenIds.add(entry.id)
  if (typeof entry.title !== 'string' || !entry.title.trim()) fail(`${entry.id}: title is required`)

  const manifestFile = path.join(sourceDir, 'manifests', `${entry.id}.json`)
  if (!fs.existsSync(manifestFile)) fail(`missing manifest for story "${entry.id}": ${manifestFile}`)
  const manifest = readJson(manifestFile)
  if (manifest.id !== entry.id) fail(`${entry.id}: manifest id does not match the index entry`)
  uploads.push({ local: manifestFile, key: `manifests/${entry.id}.json`, contentType: 'application/json' })

  for (const media of manifest.media ?? []) {
    const mediaFile = path.join(sourceDir, 'media', media.file ?? '')
    if (path.basename(media.file ?? '') !== media.file) fail(`${entry.id}: media file must be a bare filename, got "${media.file}"`)
    if (!fs.existsSync(mediaFile)) fail(`${entry.id}: media file not found: ${mediaFile}`)
    const mediaId = mediaIdFromFile(media.file)
    if (media.id !== mediaId) fail(`${entry.id}: media id "${media.id}" must equal the filename stem "${mediaId}"`)
    const stem = media.id
    if (!ID_PATTERN.test(stem)) fail(`${entry.id}: media id "${stem}" fails the protected-id pattern`)
    const ext = path.extname(media.file).toLowerCase()
    const contentType = ALLOWED_TYPES.get(ext)
    if (!contentType) fail(`${entry.id}: unsupported media type "${ext}" for ${media.file}`)
    if (!media.alt || !String(media.alt).trim()) fail(`${entry.id}/${media.id}: alt text is required`)
    const size = fs.statSync(mediaFile).size
    if (size > SIZE_WARN_BYTES) {
      console.warn(`WARN: ${media.file} is ${Math.round(size / 1024 / 1024)} MB — consider compressing`)
    }
    uploads.push({ local: mediaFile, key: `media/${media.file}`, contentType })
  }
}

// --- Upload ------------------------------------------------------------------

console.log(`Publishing ${seenIds.size} stor${seenIds.size === 1 ? 'y' : 'ies'} and ${uploads.length} object(s) to bucket "${args.bucket}"${args.dryRun ? ' (dry run)' : ''}:`)
for (const upload of uploads) {
  console.log(`  ${upload.key}  ←  ${upload.local}`)
  if (args.dryRun) continue
  execFileSync(
    'wrangler',
    [
      'r2', 'object', 'put', `${args.bucket}/${upload.key}`,
      '--file', upload.local,
      '--content-type', upload.contentType,
    ],
    { stdio: 'inherit' },
  )
}

console.log(args.dryRun ? 'Dry run complete — nothing was uploaded.' : 'Publish complete.')
console.log('Reminder: revoking a person happens in the Cloudflare Zero Trust dashboard; revoking a story deletes its manifest and media keys (see header comment).')
