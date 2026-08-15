#!/usr/bin/env node
/**
 * Deterministic verification for the Work media rules (M9): every public
 * story's media is well-formed — images carry dimensions and alt text,
 * hosted videos carry posters and captions/transcript metadata, embeds are
 * interaction-loaded (provider + id only), details-section media references
 * resolve, and protected stories expose no media at all.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-work-media')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'content', 'work.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const { WORK_STORIES, WORK_SLIDES } = require(path.join(tmpDir, 'content', 'work.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

const IMAGE_EXTENSIONS = ['.avif', '.webp', '.jpg', '.jpeg', '.png']
const VIDEO_EXTENSIONS = ['.mp4', '.webm']

function hasExtension(src, extensions) {
  return extensions.some((ext) => src.toLowerCase().split('?')[0].endsWith(ext))
}

/** Local (same-origin) assets must exist under public/. */
function localAssetExists(src) {
  if (!src.startsWith('/')) return true // remote URLs are checked by review
  return fs.existsSync(path.join(projectRoot, 'public', src))
}

for (const story of WORK_STORIES) {
  if (story.access === 'protected') {
    assert(!story.media, `${story.id}: protected story exposes no media`)
    continue
  }

  const media = story.media ?? []
  const mediaIds = media.map((entry) => entry.id)
  assert(new Set(mediaIds).size === mediaIds.length, `${story.id}: media ids are unique`)

  for (const entry of media) {
    assert(
      typeof entry.id === 'string' && entry.id.trim().length > 0,
      `${story.id}/${entry.id ?? '?'}: media id is present`,
    )

    if (entry.kind === 'image') {
      assert(
        hasExtension(entry.src, IMAGE_EXTENSIONS),
        `${story.id}/${entry.id}: image src is AVIF/WebP/JPEG/PNG`,
      )
      assert(
        Number.isInteger(entry.width) && entry.width > 0 && Number.isInteger(entry.height) && entry.height > 0,
        `${story.id}/${entry.id}: image has positive integer dimensions`,
      )
      assert(
        typeof entry.alt === 'string' && entry.alt.trim().length > 0,
        `${story.id}/${entry.id}: image has alt text`,
      )
      assert(localAssetExists(entry.src), `${story.id}/${entry.id}: image asset exists (${entry.src})`)
      if (entry.thumbnail) {
        assert(
          localAssetExists(entry.thumbnail),
          `${story.id}/${entry.id}: thumbnail asset exists (${entry.thumbnail})`,
        )
      }
    } else if (entry.kind === 'video') {
      assert(
        hasExtension(entry.src, VIDEO_EXTENSIONS),
        `${story.id}/${entry.id}: video src is MP4/WebM`,
      )
      assert(
        typeof entry.poster === 'string' && entry.poster.length > 0 && localAssetExists(entry.poster),
        `${story.id}/${entry.id}: video has an existing poster`,
      )
      assert(
        typeof entry.transcript === 'string' && entry.transcript.trim().length > 0,
        `${story.id}/${entry.id}: video has transcript metadata`,
      )
      assert(
        typeof entry.alt === 'string' && entry.alt.trim().length > 0,
        `${story.id}/${entry.id}: video has an accessible description`,
      )
      if (entry.captionsSrc) {
        assert(
          entry.captionsSrc.toLowerCase().endsWith('.vtt'),
          `${story.id}/${entry.id}: captions track is WebVTT`,
        )
        assert(
          localAssetExists(entry.captionsSrc),
          `${story.id}/${entry.id}: captions asset exists (${entry.captionsSrc})`,
        )
      }
    } else if (entry.kind === 'embed') {
      assert(
        entry.provider === 'youtube' || entry.provider === 'vimeo',
        `${story.id}/${entry.id}: embed provider is youtube or vimeo`,
      )
      assert(
        typeof entry.videoId === 'string' && entry.videoId.trim().length > 0,
        `${story.id}/${entry.id}: embed has a video id`,
      )
      assert(
        typeof entry.title === 'string' && entry.title.trim().length > 0,
        `${story.id}/${entry.id}: embed has an accessible title`,
      )
      // interaction-loaded: an embed entry must not carry a ready iframe src
      assert(!('src' in entry), `${story.id}/${entry.id}: embed is interaction-loaded (no eager src)`)
    } else {
      assert(false, `${story.id}/${entry.id}: unknown media kind "${entry.kind}"`)
    }
  }

  // details-section media references resolve into the story's media array
  for (const section of story.details ?? []) {
    for (const mediaId of section.mediaIds ?? []) {
      assert(
        mediaIds.includes(mediaId),
        `${story.id}: details section "${section.heading}" references existing media "${mediaId}"`,
      )
    }
  }
}

// slide model: media and narrative details belong to project slides only —
// the intro slide carries its title, copy, and hero source, nothing else.
assert(WORK_SLIDES.length === WORK_STORIES.length + 1, 'the work carousel is intro + one slide per story')
for (const slide of WORK_SLIDES) {
  if (slide.kind === 'intro') {
    assert(
      !('media' in slide) && !('details' in slide),
      `${slide.id}: intro slide carries no media or details`,
    )
  } else {
    assert(
      WORK_STORIES.includes(slide.story),
      `${slide.story.id}: project slide wraps a WORK_STORIES entry (its media rules apply above)`,
    )
  }
}

// slide hero sources: every source exists in public/, and the source kind is
// 'raster' exactly on the PNG story (svg is the default everywhere else).
for (const slide of WORK_SLIDES) {
  const sourceUrl = slide.kind === 'intro' ? slide.sourceUrl : slide.story.sourceUrl
  const sourceKind = slide.kind === 'intro' ? 'svg' : (slide.story.sourceKind ?? 'svg')
  const id = slide.kind === 'intro' ? slide.id : slide.story.id
  assert(
    fs.existsSync(path.join(projectRoot, 'public', sourceUrl)),
    `${id}: hero source exists in public/ (${sourceUrl})`,
  )
  const isRaster = sourceUrl.toLowerCase().endsWith('.png')
  assert(
    isRaster ? sourceKind === 'raster' : sourceKind === 'svg',
    `${id}: sourceKind '${sourceKind}' matches the hero asset type`,
  )
}

// declared dimensions match the real pixel dimensions of every local image
// (sips is macOS-only; skip silently elsewhere)
if (process.platform === 'darwin') {
  for (const story of WORK_STORIES) {
    for (const entry of story.media ?? []) {
      if (entry.kind !== 'image' || !entry.src.startsWith('/')) continue
      const file = path.join(projectRoot, 'public', entry.src)
      if (!fs.existsSync(file)) continue
      const out = execSync(`sips -g pixelWidth -g pixelHeight "${file}"`).toString()
      const width = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1])
      const height = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1])
      assert(
        width === entry.width && height === entry.height,
        `${story.id}/${entry.id}: declared ${entry.width}x${entry.height} matches the file's real ${width}x${height}`,
      )
    }
  }
}

// provenance: every externally downloaded asset is recorded in
// docs/work-media-sources.md with its source page, original asset URL,
// retrieval date, and displayed caption (feature/work-expanding-case-study)
const ADDED_ASSETS = [
  'EmployeeExperience-MyHub-AppStore.png',
  'EmployeeExperience-VivaConnections.jpg',
  'GlobalCompensation-TotalRewards-Employee.png',
  'GlobalCompensation-TotalRewards-Manager.png',
]
const manifestPath = path.join(projectRoot, 'docs', 'work-media-sources.md')
assert(fs.existsSync(manifestPath), 'the work-media provenance manifest exists')
const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : ''
for (const basename of ADDED_ASSETS) {
  const blockStart = manifest.indexOf(`## ${basename}`)
  assert(blockStart >= 0, `manifest records ${basename}`)
  const block = blockStart >= 0 ? manifest.slice(blockStart, manifest.indexOf('\n## ', blockStart + 1) === -1 ? undefined : manifest.indexOf('\n## ', blockStart + 1)) : ''
  for (const field of ['Story:', 'Local path:', 'Source page:', 'Original asset URL:', 'Retrieval date:', 'Caption:']) {
    assert(
      block.includes(field),
      `manifest entry for ${basename} includes ${field.replace(':', '').toLowerCase()}`,
    )
  }
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll work media verifications passed.')
