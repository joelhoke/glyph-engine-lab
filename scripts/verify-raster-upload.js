#!/usr/bin/env node
/**
 * Deterministic verification for engine/rasterUpload.ts.
 *
 * Compiles the validator to a temporary CommonJS module and exercises the
 * pure validators plus the pre-decode rejection paths of readUploadedRaster
 * (Node provides File but not Image, so the decode/dimension paths are only
 * reachable in a real browser). This is not a browser integration test; it
 * proves the magic-byte sniffing, the size cap, and the MIME-vs-content
 * agreement behave as documented.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'rasterUpload.ts')
const tmpDir = path.join(projectRoot, 'tmp-verify')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${sourceFile}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  isRasterUploadTooLarge,
  sniffRasterType,
  readUploadedRaster,
  MAX_RASTER_UPLOAD_BYTES,
  MAX_RASTER_DIMENSION,
  RASTER_MIME_TYPES,
} = require(path.join(tmpDir, 'rasterUpload.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected ${expected}, got ${actual})`)
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]

// --- constants ---------------------------------------------------------------

assertEqual(MAX_RASTER_UPLOAD_BYTES, 4 * 1024 * 1024, 'size cap is 4 MB')
assertEqual(MAX_RASTER_DIMENSION, 4096, 'dimension cap is 4096px')
assert(
  Array.isArray(RASTER_MIME_TYPES) &&
    RASTER_MIME_TYPES.length === 2 &&
    RASTER_MIME_TYPES.includes('image/png') &&
    RASTER_MIME_TYPES.includes('image/webp'),
  'supported MIME types are exactly PNG and WebP',
)

// --- size validator ----------------------------------------------------------

assertEqual(isRasterUploadTooLarge(MAX_RASTER_UPLOAD_BYTES + 1), true, 'size over limit is too large')
assertEqual(isRasterUploadTooLarge(MAX_RASTER_UPLOAD_BYTES), false, 'size exactly at limit is allowed')
assertEqual(isRasterUploadTooLarge(0), false, 'empty size is allowed')

// --- magic-byte sniffer -------------------------------------------------------

assertEqual(
  sniffRasterType(new Uint8Array([...PNG_MAGIC, 0x00, 0x00, 0x00, 0x00])),
  'image/png',
  'PNG magic bytes are accepted',
)
assertEqual(
  sniffRasterType(new Uint8Array(WEBP_MAGIC)),
  'image/webp',
  'WebP magic bytes are accepted',
)
assertEqual(
  sniffRasterType(new Uint8Array(JPEG_MAGIC)),
  null,
  'JPEG magic bytes are rejected (for now)',
)
assertEqual(
  sniffRasterType(new Uint8Array(PNG_MAGIC.slice(0, 4))),
  null,
  'truncated PNG header is rejected',
)
assertEqual(
  sniffRasterType(new Uint8Array(WEBP_MAGIC.slice(0, 8))),
  null,
  'truncated WebP header (missing WEBP fourcc) is rejected',
)
assertEqual(
  sniffRasterType(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b])),
  null,
  'garbage bytes are rejected',
)
assertEqual(
  sniffRasterType(new Uint8Array(0)),
  null,
  'empty input is rejected',
)

// --- readUploadedRaster: pre-decode rejection paths ---------------------------

async function main() {
  // size cap fires before anything is read
  {
    const big = new File([new Uint8Array(MAX_RASTER_UPLOAD_BYTES + 1)], 'big.png', { type: 'image/png' })
    const result = await readUploadedRaster(big)
    assert(!result.ok && result.error === 'The image file must be smaller than 4 MB.', 'oversized file is rejected by the size cap')
  }

  // sniffing rejects non-PNG/WebP contents
  {
    const jpeg = new File([new Uint8Array(JPEG_MAGIC)], 'photo.png', { type: 'image/png' })
    const result = await readUploadedRaster(jpeg)
    assert(!result.ok && result.error === 'The image must be a PNG or WebP file.', 'JPEG contents are rejected by the sniffer')
  }

  // declared MIME type must agree with the sniffed type
  {
    const mismatched = new File([new Uint8Array(PNG_MAGIC)], 'fake.webp', { type: 'image/webp' })
    const result = await readUploadedRaster(mismatched)
    assert(
      !result.ok && result.error === 'The image file type does not match its contents.',
      'MIME-vs-sniff mismatch is rejected',
    )
  }

  if (failures > 0) {
    console.error(`\n${failures} verification(s) failed.`)
    process.exit(1)
  }

  console.log('\nAll raster-upload verifications passed.')
}

main().catch((error) => {
  console.error('Verification run failed:', error)
  process.exit(1)
})
