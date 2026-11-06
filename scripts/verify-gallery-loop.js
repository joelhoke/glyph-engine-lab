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
    'components/home/HomeGalleryCarousel.tsx', 'components/home/galleryLoop.ts', 'next-env.d.ts',
    '--outDir', out, '--module', 'commonjs', '--target', 'es2020',
    '--jsx', 'react-jsx', '--esModuleInterop', '--skipLibCheck',
  ], { cwd: root, stdio: 'inherit' })
  // Node's static-markup test does not run Next's CSS loader.
  fs.copyFileSync(path.join(root, 'components/ProjectThumbnail.module.css'), path.join(out, 'components/ProjectThumbnail.module.css'))
  require.extensions['.css'] = module => { module.exports = {} }
  const { galleryLoopOffset } = require(path.join(out, 'components/home/galleryLoop.js'))
  const Carousel = require(path.join(out, 'components/home/HomeGalleryCarousel.js')).default
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
  // WebKit reports integer scrollLeft values even when the measured loop
  // origin is fractional. Settling that rounded position must not wrap again.
  for (const period of [5304.6, 5304.375, 2991.3]) {
    for (const copiesBefore of [2, 3, 4]) {
      const origin = period * copiesBefore
      for (const round of [Math.floor, Math.round, Math.ceil]) {
        const resting = round(origin)
        assert(Math.abs(galleryLoopOffset(resting, period, copiesBefore) - resting) <= 1,
          'a rounded loop origin must stay settled')
        for (const offset of [origin - period, origin + period, origin - 40, origin + period + 40]) {
          let recentered = round(galleryLoopOffset(offset, period, copiesBefore))
          // Rounding at the far boundary may require one more wrap, but it
          // must converge rather than alternate between duplicate copies.
          recentered = round(galleryLoopOffset(recentered, period, copiesBefore))
          assert(Math.abs(galleryLoopOffset(recentered, period, copiesBefore) - recentered) <= 1,
            'recentring must converge when the browser rounds scrollLeft')
        }
      }
      assert(galleryLoopOffset(origin - 2, period, copiesBefore) > origin + period - 3,
        'backward scrolling beyond the rounding tolerance must still wrap')
    }
  }
  const projects = Array.from({ length: 6 }, (_, index) => ({
    id: `project-${index}`, title: `Project ${index}`, collection: 'Gallery',
    summary: 'Example', href: `/p/example/${index}`, thumbnail: '/example.png',
  }))
  const render = items => renderToStaticMarkup(React.createElement(Carousel, {
    projects: items, introduction: 'Gallery', action: 'Browse', portrait: null,
  }))
  const html = render(projects)
  const themed = render([{ ...projects[0], href: '/gallery/cars', thumbnail: '/assets/gallery/vehicle-playground.webp' }])
  assert(themed.includes('media="(prefers-color-scheme: light)"'), 'light poster must be selectable before hydration')
  assert(themed.includes('src="/assets/gallery/previews/cars-dark.webp?v=3"'), 'dark poster is the default, matching the site theme')
  assert(!themed.includes('<video'), 'server output must not preload motion clips')
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
