#!/usr/bin/env node
/**
 * Deterministic verification for engine/svgUpload.ts.
 *
 * Compiles the sanitizer to a temporary CommonJS module and exercises the
 * validation rules with a small DOM mock. This is not a browser integration
 * test; it proves the sanitizer rejects the documented unsafe patterns,
 * accepts normal SVG geometry/fragment references, and — for the mobile
 * upload hardening — returns normalized markup plus resolved intrinsic
 * dimensions (viewBox-only and percentage-sized roots no longer collapse).
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'svgUpload.ts')
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
  validateSvgDocument,
  isUploadTooLarge,
  MAX_UPLOAD_SIZE_BYTES,
} = require(path.join(tmpDir, 'svgUpload.js'))

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

function isElement(node) {
  return node && typeof node.tagName === 'string'
}

function makeElement(tagName, attrs = {}, children = [], textContent = '') {
  const element = {
    tagName: tagName.toLowerCase(),
    attributes: Object.entries(attrs).map(([name, value]) => ({
      name,
      value: String(value),
    })),
    childNodes: children.filter(Boolean),
    textContent: String(textContent),
    querySelectorAll(selector) {
      const out = []
      const walk = (node) => {
        for (const child of node.childNodes) {
          if (isElement(child)) {
            out.push(child)
            walk(child)
          }
        }
      }
      if (selector === '*') walk(this)
      return out
    },
    getAttribute(name) {
      const found = this.attributes.find(
        (attr) => attr.name.toLowerCase() === name.toLowerCase(),
      )
      return found ? found.value : null
    },
  }
  return element
}

function makeDocument(rootElement, parserErrorElement = null) {
  const collectByTag = (node, name) => {
    const out = []
    const walk = (n) => {
      if (!isElement(n)) return
      if (n.tagName === name) out.push(n)
      for (const child of n.childNodes) walk(child)
    }
    walk(node)
    return out
  }

  return {
    documentElement: rootElement,
    querySelector(selector) {
      if (selector === 'parsererror') return parserErrorElement
      return null
    },
    getElementsByTagName(name) {
      return rootElement ? collectByTag(rootElement, name.toLowerCase()) : []
    },
  }
}

function svgRoot(...children) {
  return makeElement('svg', { xmlns: 'http://www.w3.org/2000/svg' }, children)
}

function svgRootAttrs(attrs, ...children) {
  return makeElement('svg', { xmlns: 'http://www.w3.org/2000/svg', ...attrs }, children)
}

// 1. Valid path-based SVG: validated markup is returned (no data URL — the
// caller mints a Blob URL from the markup after validation).
const SIMPLE_CONTENT = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10H0z"/></svg>'
let doc = makeDocument(svgRoot(makeElement('path', { d: 'M0 0h10v10H0z' })))
let result = validateSvgDocument(doc, SIMPLE_CONTENT, 'path.svg')
assert(result.ok, 'valid path-based SVG is accepted')
assert(
  result.ok && result.markup === SIMPLE_CONTENT,
  'valid SVG returns the validated markup unchanged when sizing is already fine',
)
assert(
  result.ok && !('url' in result),
  'validation no longer creates a URL (split from URL creation)',
)
assert(
  result.ok && result.intrinsicWidth === null && result.intrinsicHeight === null,
  'root without any sizing resolves null intrinsic dimensions',
)

// 2. Valid internal gradient.
doc = makeDocument(
  svgRoot(
    makeElement('defs', {}, [
      makeElement('linearGradient', { id: 'grad' }, [
        makeElement('stop', { offset: '0%', 'stop-color': '#fff' }),
      ]),
    ]),
    makeElement('rect', { width: '10', height: '10', fill: 'url(#grad)' }),
  ),
)
result = validateSvgDocument(doc, '<svg></svg>', 'gradient.svg')
assert(result.ok, 'valid internal gradient is accepted')

// 3. Valid internal clip-path reference.
doc = makeDocument(
  svgRoot(
    makeElement('defs', {}, [
      makeElement('clipPath', { id: 'clip' }, [
        makeElement('rect', { width: '5', height: '5' }),
      ]),
    ]),
    makeElement('rect', { width: '10', height: '10', 'clip-path': 'url(#clip)' }),
  ),
)
result = validateSvgDocument(doc, '<svg></svg>', 'clip.svg')
assert(result.ok, 'valid internal clip-path reference is accepted')

// 3b. Valid internal mask.
doc = makeDocument(
  svgRoot(
    makeElement('defs', {}, [
      makeElement('mask', { id: 'fade' }, [
        makeElement('rect', { width: '10', height: '10', fill: 'url(#grad)' }),
      ]),
    ]),
    makeElement('rect', { width: '10', height: '10', mask: 'url(#fade)' }),
  ),
)
result = validateSvgDocument(doc, '<svg></svg>', 'mask.svg')
assert(result.ok, 'valid internal mask reference is accepted')

// 3c. Valid internal use fragment.
doc = makeDocument(
  svgRoot(
    makeElement('defs', {}, [makeElement('path', { id: 'shape', d: 'M0 0h4v4H0z' })]),
    makeElement('use', { href: '#shape' }),
  ),
)
result = validateSvgDocument(doc, '<svg></svg>', 'use-internal.svg')
assert(result.ok, 'internal use fragment reference is accepted')

// 3d. UTF-8 filename and markup survive validation byte-for-byte.
const UTF8_CONTENT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text>标志 — café</text></svg>'
doc = makeDocument(
  svgRootAttrs({ width: '24', height: '24' }, makeElement('text', {}, [], '标志 — café')),
)
result = validateSvgDocument(doc, UTF8_CONTENT, '标志.svg')
assert(result.ok, 'UTF-8 markup is accepted')
assert(result.ok && result.filename === '标志.svg', 'UTF-8 filename is preserved')
assert(result.ok && result.markup === UTF8_CONTENT, 'UTF-8 markup is preserved byte-for-byte')

// 3e. viewBox-only sizing: intrinsic size resolves from the viewBox and is
// injected into the normalized markup (mobile decode hardening).
const VIEWBOX_CONTENT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><rect width="240" height="120"/></svg>'
doc = makeDocument(
  svgRootAttrs({ viewBox: '0 0 240 120' }, makeElement('rect', { width: '240', height: '120' })),
)
result = validateSvgDocument(doc, VIEWBOX_CONTENT, 'viewbox.svg')
assert(result.ok, 'viewBox-only SVG is accepted')
assert(
  result.ok && result.intrinsicWidth === 240 && result.intrinsicHeight === 120,
  'viewBox-only SVG resolves intrinsic dimensions from the viewBox',
)
assert(
  result.ok && /<svg[^>]*width="240"/.test(result.markup) && /<svg[^>]*height="120"/.test(result.markup),
  'viewBox-only SVG markup is normalized with concrete root width/height',
)
assert(
  result.ok && result.markup.includes('viewBox="0 0 240 120"'),
  'normalization keeps the viewBox attribute intact',
)

// 3f. Percentage sizing: resolved against the viewBox, percentages replaced.
const PERCENT_CONTENT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 50"><rect width="100" height="50"/></svg>'
doc = makeDocument(
  svgRootAttrs(
    { width: '100%', height: '100%', viewBox: '0 0 100 50' },
    makeElement('rect', { width: '100', height: '50' }),
  ),
)
result = validateSvgDocument(doc, PERCENT_CONTENT, 'percent.svg')
assert(result.ok, 'percentage-sized SVG is accepted')
assert(
  result.ok && result.intrinsicWidth === 100 && result.intrinsicHeight === 50,
  'percentage-sized SVG resolves intrinsic dimensions from the viewBox',
)
assert(
  result.ok &&
    /<svg[^>]*width="100"/.test(result.markup) &&
    /<svg[^>]*height="50"/.test(result.markup) &&
    !/<svg[^>]*100%/.test(result.markup),
  'percentage root dimensions are replaced with resolved values',
)

// 3g. Fixed numeric sizing: metadata returned, markup untouched.
doc = makeDocument(svgRootAttrs({ width: '10', height: '20' }, makeElement('rect')))
const FIXED_CONTENT = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><rect/></svg>'
result = validateSvgDocument(doc, FIXED_CONTENT, 'fixed.svg')
assert(
  result.ok && result.intrinsicWidth === 10 && result.intrinsicHeight === 20,
  'fixed numeric root dimensions resolve directly',
)
assert(result.ok && result.markup === FIXED_CONTENT, 'already-sized markup is left unchanged')

// 3h. One fixed axis + viewBox: the missing axis derives from the aspect.
doc = makeDocument(svgRootAttrs({ width: '200', viewBox: '0 0 100 50' }, makeElement('rect')))
const ONE_AXIS_CONTENT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" viewBox="0 0 100 50"><rect/></svg>'
result = validateSvgDocument(doc, ONE_AXIS_CONTENT, 'one-axis.svg')
assert(
  result.ok && result.intrinsicWidth === 200 && result.intrinsicHeight === 100,
  'missing axis derives from the viewBox aspect ratio',
)
assert(
  result.ok && /<svg[^>]*height="100"/.test(result.markup),
  'derived missing axis is injected into the markup',
)

// 3i. Degenerate viewBox: no usable size, markup untouched.
doc = makeDocument(svgRootAttrs({ viewBox: '0 0 0 0' }, makeElement('rect')))
const DEGEN_CONTENT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0"><rect/></svg>'
result = validateSvgDocument(doc, DEGEN_CONTENT, 'degenerate.svg')
assert(
  result.ok && result.intrinsicWidth === null && result.intrinsicHeight === null,
  'degenerate viewBox resolves null intrinsic dimensions',
)
assert(result.ok && result.markup === DEGEN_CONTENT, 'unresolvable sizing leaves markup unchanged')

// 4. Missing SVG root.
doc = makeDocument(makeElement('div', {}, [makeElement('path')]))
result = validateSvgDocument(doc, '<div></div>', 'div.svg')
assert(!result.ok, 'missing SVG root is rejected')

// 5. Malformed XML / parser error.
doc = makeDocument(makeElement('parsererror'), makeElement('parsererror'))
result = validateSvgDocument(doc, '<svg><unclosed', 'malformed.svg')
assert(!result.ok, 'malformed XML is rejected')

// 6. Script element.
doc = makeDocument(svgRoot(makeElement('script', {}, [], 'alert(1)')))
result = validateSvgDocument(doc, '<svg></svg>', 'script.svg')
assert(!result.ok, 'script element is rejected')

// 7. foreignObject.
doc = makeDocument(svgRoot(makeElement('foreignObject', {}, [makeElement('div')])))
result = validateSvgDocument(doc, '<svg></svg>', 'foreign.svg')
assert(!result.ok, 'foreignObject is rejected')

// 8. Event-handler attribute.
doc = makeDocument(svgRoot(makeElement('path', { onclick: 'alert(1)' })))
result = validateSvgDocument(doc, '<svg></svg>', 'event.svg')
assert(!result.ok, 'event-handler attribute is rejected')

// 9. javascript: URL.
doc = makeDocument(svgRoot(makeElement('a', { href: 'javascript:alert(1)' })))
result = validateSvgDocument(doc, '<svg></svg>', 'javascript.svg')
assert(!result.ok, 'javascript URL is rejected')

// 10. External image.
doc = makeDocument(
  svgRoot(
    makeElement('image', {
      href: 'https://example.com/pixel.png',
      width: '10',
      height: '10',
    }),
  ),
)
result = validateSvgDocument(doc, '<svg></svg>', 'external-image.svg')
assert(!result.ok, 'external image reference is rejected')

// 11. External use reference.
doc = makeDocument(
  svgRoot(makeElement('use', { href: 'https://example.com/sprite.svg#icon' })),
)
result = validateSvgDocument(doc, '<svg></svg>', 'external-use.svg')
assert(!result.ok, 'external use reference is rejected')

// 12. Size limit.
assertEqual(isUploadTooLarge(MAX_UPLOAD_SIZE_BYTES + 1), true, 'size over limit is too large')
assertEqual(isUploadTooLarge(MAX_UPLOAD_SIZE_BYTES), false, 'size exactly at limit is allowed')
assertEqual(isUploadTooLarge(0), false, 'empty size is allowed')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll SVG-upload verifications passed.')
