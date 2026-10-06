#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = path.resolve(__dirname, '..')
const out = fs.mkdtempSync(path.join(root, 'tmp-verify-gallery-'))
try {
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
    'components/home/HomeGalleryCarousel.tsx', 'components/home/galleryLoop.ts',
    '--outDir', out, '--module', 'commonjs', '--target', 'es2020',
    '--jsx', 'react-jsx', '--esModuleInterop', '--skipLibCheck',
  ], { cwd: root, stdio: 'inherit' })
  const { galleryLoopOffset } = require(path.join(out, 'galleryLoop.js'))
  const Carousel = require(path.join(out, 'HomeGalleryCarousel.js')).default
  // Fractional card sizes and gaps must preserve the same visible content
  // through arbitrarily many forward/backward loops, without accumulating drift.
  for (const step of [296, 333.25, 592]) {
    const period = step * 6
    for (const direction of [-1, 1]) {
      let offset = period * 2
      for (let index = 1; index <= 240; index++) {
        offset = galleryLoopOffset(offset + direction * step, period)
        assert(offset >= period * 2 && offset < period * 3)
        const visible = Math.round((offset - period * 2) / step) % 6
        assert.equal(visible, ((direction * index) % 6 + 6) % 6)
      }
    }
    for (const offset of [-17.5, period - 0.25, period * 3 + 42.75]) {
      const wrapped = galleryLoopOffset(offset, period)
      const cycles = (wrapped - offset) / period
      assert(Math.abs(cycles - Math.round(cycles)) < 1e-9, 'recenter must preserve sub-card position')
    }
  }
  assert.equal(galleryLoopOffset(10, 0), 0)
  const projects = Array.from({ length: 6 }, (_, index) => ({
    id: `project-${index}`, title: `Project ${index}`, collection: 'Gallery',
    summary: 'Example', href: `/p/example/${index}`, thumbnail: '/example.png',
  }))
  const render = items => renderToStaticMarkup(React.createElement(Carousel, {
    projects: items, introduction: 'Gallery', action: 'Browse', portrait: null,
  }))
  const html = render(projects)
  assert.equal((html.match(/class="home-project"/g) || []).length, 30)
  assert.equal((html.match(/tabindex="-1"/g) || []).length, 24, 'only one copy of each project enters the tab order')
  assert.equal((html.match(/<li[^>]*aria-hidden="true"/g) || []).length, 24, 'buffer slides stay out of the accessibility tree')
  assert(!html.includes('disabled=""'), 'both arrows remain available throughout a loop')
  for (const items of [[], projects.slice(0, 1)]) {
    const single = render(items)
    assert.equal((single.match(/class="home-project"/g) || []).length, items.length)
    assert.equal((single.match(/disabled=""/g) || []).length, 2)
  }
  console.log('Gallery loop: repeated cycles, fractional offsets, keyboard duplicates, and small collections passed.')
} finally {
  fs.rmSync(out, { recursive: true, force: true })
}
