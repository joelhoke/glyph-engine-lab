#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const out = fs.mkdtempSync(path.join(root, 'tmp-verify-sphere-'))
try {
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), ['components/gallery/galleryGeometry.ts', 'components/gallery/galleryCatalog.ts', 'content/galleryArtwork.ts', 'content/projectPreviews.ts',
    '--outDir', out, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--jsx', 'react-jsx', '--resolveJsonModule'], { cwd: root, stdio: 'inherit' })
  const { galleryPattern, galleryMetrics, visibleTiles, projectTile, projectedCorners, tileTransform, unprojectTilePoint, diagonalWheel, createGalleryWheelInput, seededRandom, wrap } = require(path.join(out, 'components/gallery/galleryGeometry.js'))
  const { buildGalleryCatalog } = require(path.join(out, 'components/gallery/galleryCatalog.js'))
  const { GALLERY_PALETTES } = require(path.join(out, 'content/galleryArtwork.js'))
  const { PROJECT_PREVIEWS, getProjectPreview } = require(path.join(out, 'content/projectPreviews.js'))
  for (const [href, media] of Object.entries(PROJECT_PREVIEWS)) {
    for (const asset of Object.values(media)) assert(fs.existsSync(path.join(root, 'public', asset.split('?')[0])), `Missing themed asset for ${href}: ${asset}`)
    if (!media.darkPoster) continue
    assert.notEqual(media.poster, media.darkPoster, 'dark mode needs dedicated artwork')
    assert(media.darkVideo && media.darkVideo !== media.video, 'dark mode needs a matching dedicated clip')
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path.join(root, 'public', media.darkVideo.split('?')[0])], { encoding: 'utf8' }))
    assert(info.format.duration >= 4 && info.format.duration <= 8.1)
    assert.equal(info.streams.length, 1); assert.equal(info.streams[0].codec_name, 'h264')
  }
  assert.equal(getProjectPreview('/p/joelops', '/assets/work/global-operations-thumbnail.webp'), PROJECT_PREVIEWS['/p/joelops/demo'])
  assert.equal(getProjectPreview('/gallery/cars?gallery-embed=1'), PROJECT_PREVIEWS['/gallery/cars'])
  for (const layout of ['regular', 'mixed']) for (const count of [0, 1, 11, 13, 29, 90]) {
    const pattern = galleryPattern(count, layout), cells = new Set()
    assert.deepEqual(pattern.slots.filter(s => s.itemIndex !== undefined).map(s => s.itemIndex), Array.from({ length: count }, (_, i) => i))
    assert.equal(new Set(pattern.slots.filter(s => s.artwork).map(s => s.artwork.palette)).size, GALLERY_PALETTES.length)
    for (const slot of pattern.slots) for (let y = slot.y; y < slot.y + slot.h; y++) for (let x = slot.x; x < slot.x + slot.w; x++) {
      const key = `${x},${y}`; assert(!cells.has(key), 'mixed spans must never overlap'); cells.add(key)
    }
    assert.equal(cells.size, pattern.width * pattern.height, 'every motif cell must be filled')
    for (const width of [390, 1280, 2560]) {
      const metrics = galleryMetrics(width, layout), base = { x: 217.375, y: -938.125 }
      const expected = visibleTiles(pattern, base, width, 720, layout)
      for (const cycles of [-1000, -1, 1, 1000]) {
        const next = visibleTiles(pattern, { x: base.x + cycles * pattern.width * metrics.cellX,
          y: base.y + cycles * pattern.height * metrics.cellY }, width, 720, layout)
        assert.equal(next.length, expected.length)
        next.forEach((t, i) => {
          assert.equal(t.id, expected[i].id)
          assert(Math.abs(t.left - expected[i].left) < 1e-6)
          assert(Math.abs(t.top - expected[i].top) < 1e-6)
          assert.deepEqual(t.artwork, expected[i].artwork)
        })
      }
    }
  }
  // Crossing either wrap seam must preserve the mounted identity of every
  // overlapping tile. Otherwise canvases/images are recreated during movement.
  for (const layout of ['regular', 'mixed']) {
    const pattern = galleryPattern(10, layout), metrics = galleryMetrics(1280, layout)
    for (const axis of ['x', 'y']) for (const cycle of [-2, -1, 0, 1, 2]) {
      const period = axis === 'x' ? pattern.width * metrics.cellX : pattern.height * metrics.cellY
      const before = { x: 173.25, y: 98.75, [axis]: cycle * period - 0.25 }
      const after = { ...before, [axis]: cycle * period + 0.25 }
      const oldTiles = visibleTiles(pattern, before, 1280, 720, layout)
      const nextTiles = new Map(visibleTiles(pattern, after, 1280, 720, layout).map(t => [t.key, t]))
      for (const tile of oldTiles.filter(t => Math.abs(t.left) < 640 && Math.abs(t.top) < 360)) {
        const next = nextTiles.get(tile.key)
        assert(next, 'visible tiles must stay mounted across the wrap seam')
        assert(Math.abs(next.left - tile.left + (axis === 'x' ? 0.5 : 0)) < 1e-6, 'tile identity must follow its continuous horizontal position')
        assert(Math.abs(next.top - tile.top + (axis === 'y' ? 0.5 : 0)) < 1e-6, 'tile identity must follow its continuous vertical position')
      }
    }
  }
  // Test actual screen polygons, including mixed-span T junctions at the edges.
  const overlaps = (a, b) => [a, b].every(poly => poly.every((point, i) => {
    const next = poly[(i + 1) % 4], axis = { x: -(next.y - point.y), y: next.x - point.x }
    const pa = a.map(p => p.x * axis.x + p.y * axis.y), pb = b.map(p => p.x * axis.x + p.y * axis.y)
    return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa)
  }))
  for (const layout of ['regular', 'mixed']) for (const [width, height] of [[390, 844], [1280, 720], [2560, 1440]]) {
    for (const position of [{ x: 0, y: 0 }, { x: 217.375, y: -938.125 }, { x: 800.25, y: 633.75 }]) {
      const tiles = visibleTiles(galleryPattern(13, layout), position, width, height, layout)
      const polygons = tiles.map(t => projectedCorners(t.left, t.top, t.width, t.height, width, height))
      polygons.forEach((poly, i) => {
        for (let j = i + 1; j < polygons.length; j++) assert(!overlaps(poly, polygons[j]), `${layout} projected tiles overlap: ${i},${j} at ${width}`)
        const t = tiles[i], matrix = tileTransform(t.left, t.top, t.width, t.height, width, height).slice(9, -1).split(',').map(Number)
        ;[[0, 0], [t.width, 0], [t.width, t.height], [0, t.height]].forEach(([x, y], corner) => {
          const divisor = matrix[3] * x + matrix[7] * y + 1
          assert(Math.abs((matrix[0] * x + matrix[4] * y + matrix[12]) / divisor - poly[corner].x) < 1e-6)
          assert(Math.abs((matrix[1] * x + matrix[5] * y + matrix[13]) / divisor - poly[corner].y) < 1e-6)
          const hit = unprojectTilePoint(matrix, poly[corner].x, poly[corner].y)
          assert(Math.abs(hit.x - x) < 1e-6 && Math.abs(hit.y - y) < 1e-6, 'pointer must align with the curved tile')
        })
      })
    }
  }
  assert.deepEqual(projectTile(0, 0, 1280, 720), { x: 0, y: 0, z: 0 })
  assert(projectTile(600, 250, 1280, 720).z < 0)
  for (const mode of [0, 1, 2]) {
    const a = diagonalWheel(0, 12, mode, 720), b = diagonalWheel(0, -12, mode, 720)
    assert.equal(a.x, a.y); assert.equal(a.x, -b.x); assert.equal(a.y, -b.y)
    assert.deepEqual(diagonalWheel(12, 0, mode, 720), a)
    assert.deepEqual(diagonalWheel(99, 12, mode, 720), a)
  }
  assert.equal(wrap(-0.25, 100), 99.75)
  const wheel = createGalleryWheelInput()
  for (const delta of [100, -100, 120, -120]) assert.deepEqual(wheel(0, delta, 0, 720), diagonalWheel(0, delta, 0, 720))
  for (const mode of [1, 2]) {
    assert.deepEqual(wheel(0, 3, mode, 720), diagonalWheel(0, 3, mode, 720))
    assert.deepEqual(wheel(0, -3, mode, 720), diagonalWheel(0, -3, mode, 720))
  }
  const trackpad = createGalleryWheelInput()
  assert.deepEqual(trackpad(0, 4, 0, 720), { x: 0, y: 4 }, 'precision vertical swipes stay vertical')
  assert.deepEqual(trackpad(0, 100, 0, 720), { x: 0, y: 100 }, 'fast trackpad frames retain their direction')
  assert.deepEqual(trackpad(23, -7, 0, 720), { x: 23, y: -7 }, 'two-axis swipes preserve the supplied angle')
  assert.deepEqual(trackpad(-23, 7, 0, 720), { x: -23, y: 7 }, 'swipe reversal reverses both axes')
  assert.deepEqual(trackpad(-75, 0, 0, 720), { x: -75, y: 0 }, 'horizontal-only swipes stay horizontal')
  for (const dy of [12, 6.5, 2, .25, 0]) assert.deepEqual(trackpad(0, dy, 0, 720), { x: 0, y: dy }, 'native momentum tail gains no diagonal drift')
  assert.deepEqual(trackpad(900, 1200, 0, 720), { x: 360, y: 480 }, 'input clamp preserves the swipe angle')
  assert.deepEqual(trackpad(0, 3, 1, 720), diagonalWheel(0, 3, 1, 720), 'line wheels still move diagonally after trackpad input')
  assert.deepEqual(createGalleryWheelInput()(8, 3, 1, 720), { x: 128, y: 48 }, 'two-axis line input respects both axes')
  assert.deepEqual(createGalleryWheelInput()(0, 42.5, 0, 720), { x: 0, y: 42.5 }, 'fractional pixel input uses its true direction')
  const a = seededRandom(104729), b = seededRandom(104729), c = seededRandom(104730)
  for (let i = 0; i < 100; i++) { assert.equal(a(), b()); assert.notEqual(b(), c()); a() }
  assert.deepEqual(GALLERY_PALETTES.map(p => p.colors.length), [5, 5, 6, 5, 5, 6, 5])
  const catalog = buildGalleryCatalog()
  assert.equal(catalog.length, 10); assert.equal(new Set(catalog.map(i => i.id)).size, 10)
  assert.equal(catalog.filter(i => i.requiresPassword).length, 3)
  assert.equal(catalog.filter(i => i.category === 'Case study').length, 0)
  assert(!catalog.some(i => i.action.kind === 'link' && i.action.href.includes('#work/')))
  assert(catalog.some(i => i.id === 'joelops/demo'))
  assert(!JSON.stringify(catalog).match(/passwordHash|pbkdf2|tokenVersion/))
  for (const item of catalog) {
    assert(item.preview, `${item.id} needs its dedicated preview`)
    for (const asset of [item.poster, item.preview]) assert(fs.existsSync(path.join(root, 'public', asset.split('?')[0])), `Missing ${asset}`)
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path.join(root, 'public', item.preview.split('?')[0])], { encoding: 'utf8' }))
    assert(info.format.duration >= 4 && info.format.duration <= 8.1)
    assert.equal(info.streams.length, 1, 'preview must have no audio track')
    assert.equal(info.streams[0].codec_name, 'h264')
  }
  console.log(`Spherical gallery: layouts, wrapping, wheel direction, seeds, public catalog, and all ${catalog.length} preview assets passed.`)
} finally { fs.rmSync(out, { recursive: true, force: true }) }
