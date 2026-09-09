#!/usr/bin/env node
/**
 * Scaffold a hosted prototype (docs/prototypes-plan.md, Phase 0).
 *
 * Usage:
 *   node scripts/new-prototype.mjs <stack-slug> <prototype-slug> "<title>"
 *     [--summary "..."] [--tier "..."] [--unlisted]
 *
 * Bundle format: each prototype is a self-contained static folder
 *   prototypes/<stack>/<slug>/index.html   — entry document, relative paths only
 *   prototypes/<stack>/<slug>/thumb.webp   — card thumbnail
 * plus any assets it references relatively (css/js/images). Bundles never go
 * into public/ or the export; they are uploaded to the PROTOTYPES_BUCKET R2
 * bucket under /<stack>/<slug>/<file> and served by functions/p/[[path]].ts.
 *
 * What this script does:
 *   1. creates the bundle folder with a starter index.html and a placeholder
 *      thumb.webp (a 1x1 WebP — replace it with a real 16:9 thumbnail),
 *   2. if <stack-slug> is new, inserts a public, listed stack entry into
 *      functions/lib/prototypesManifest.ts at the marked SCAFFOLD line,
 *   3. if the stack already exists, PRINTS the prototype manifest entry for
 *      a manual paste into that stack's prototypes array (robust over
 *      clever — programmatic edits to nested entries are fragile).
 *
 * Then upload the bundle (after `wrangler r2 bucket create jh-prototypes`):
 *   wrangler r2 object put jh-prototypes/<stack>/<slug>/index.html \
 *     --file prototypes/<stack>/<slug>/index.html --content-type text/html
 *   wrangler r2 object put jh-prototypes/<stack>/<slug>/thumb.webp \
 *     --file prototypes/<stack>/<slug>/thumb.webp --content-type image/webp
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const MANIFEST_FILE = path.join(repoRoot, 'functions', 'lib', 'prototypesManifest.ts')
const SCAFFOLD_MARKER = '// === SCAFFOLD: scripts/new-prototype.mjs inserts new stacks after this line ==='

// Valid 1x1 WebP placeholder (RIFF/VP8). Replace with a real 16:9 thumbnail
// (e.g. 1200x675) before publishing — it renders stretched on the cards.
const PLACEHOLDER_THUMB_BASE64 = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { stack: null, slug: null, title: null, summary: null, tier: null, unlisted: false }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--summary') {
      args.summary = argv[++i]
    } else if (arg === '--tier') {
      args.tier = argv[++i]
    } else if (arg === '--unlisted') {
      args.unlisted = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/new-prototype.mjs <stack-slug> <prototype-slug> "<title>" [--summary "..."] [--tier "..."] [--unlisted]',
      )
      process.exit(0)
    } else {
      positional.push(arg)
    }
  }
  ;[args.stack, args.slug, args.title] = positional
  return args
}

function starterHtml(title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #090c12;
        color: #c5d4ea;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
    </style>
  </head>
  <body>
    <p>${title} — replace this starter with your prototype.</p>
    <!-- Self-contained bundle: reference assets with RELATIVE paths only. -->
  </body>
</html>
`
}

const args = parseArgs(process.argv.slice(2))
if (!args.stack || !args.slug || !args.title) {
  fail('stack slug, prototype slug, and title are required (see --help)')
}
if (!SLUG_PATTERN.test(args.stack)) fail(`invalid stack slug: "${args.stack}"`)
if (!SLUG_PATTERN.test(args.slug)) fail(`invalid prototype slug: "${args.slug}"`)

// --- Bundle folder -------------------------------------------------------------

const bundleDir = path.join(repoRoot, 'prototypes', args.stack, args.slug)
if (fs.existsSync(bundleDir)) fail(`bundle already exists: ${bundleDir}`)
fs.mkdirSync(bundleDir, { recursive: true })
fs.writeFileSync(path.join(bundleDir, 'index.html'), starterHtml(args.title))
fs.writeFileSync(
  path.join(bundleDir, 'thumb.webp'),
  Buffer.from(PLACEHOLDER_THUMB_BASE64, 'base64'),
)
console.log(`Created ${path.relative(repoRoot, bundleDir)}/ (index.html + placeholder thumb.webp)`)

// --- Manifest ------------------------------------------------------------------

if (!fs.existsSync(MANIFEST_FILE)) fail(`manifest not found: ${MANIFEST_FILE}`)
const manifest = fs.readFileSync(MANIFEST_FILE, 'utf8')

const summary = args.summary ?? `${args.title} — one-line summary.`
const prototypeEntry = [
  '      {',
  `        slug: '${args.slug}',`,
  `        title: '${args.title.replace(/'/g, "\\'")}',`,
  ...(args.tier ? [`        tier: '${args.tier.replace(/'/g, "\\'")}',`] : []),
  `        summary: '${summary.replace(/'/g, "\\'")}',`,
  "        thumb: 'thumb.webp',",
  '      },',
].join('\n')

if (manifest.includes(`slug: '${args.stack}'`)) {
  // Existing stack: programmatic edits into a nested array are fragile —
  // print the entry for a manual paste instead.
  console.log(`\nStack "${args.stack}" already exists in the manifest. Paste this into its prototypes array:\n`)
  console.log(prototypeEntry)
} else {
  if (!manifest.includes(SCAFFOLD_MARKER)) {
    fail(`scaffold marker not found in ${MANIFEST_FILE} — add the stack entry manually`)
  }
  const stackEntry = [
    '  {',
    `    slug: '${args.stack}',`,
    `    title: '${args.stack}', // TODO: human-readable stack title`,
    "    access: { mode: 'public' },",
    `    listed: ${args.unlisted ? 'false' : 'true'},`,
    '    prototypes: [',
    prototypeEntry,
    '    ],',
    '  },',
  ].join('\n')
  const updated = manifest.replace(SCAFFOLD_MARKER, `${SCAFFOLD_MARKER}\n${stackEntry}`)
  fs.writeFileSync(MANIFEST_FILE, updated)
  console.log(`Added stack "${args.stack}" to functions/lib/prototypesManifest.ts`)
}

console.log('\nNext: build the prototype in the bundle folder, replace thumb.webp, then upload with wrangler (see header comment).')
