#!/usr/bin/env node
/**
 * Deterministic verification for engine/svgUpload.ts.
 *
 * Compiles the sanitizer to a temporary CommonJS module and exercises the
 * validation rules with a small DOM mock. This is not a browser integration
 * test; it proves the sanitizer rejects the documented unsafe patterns and
 * accepts normal SVG geometry/fragment references.
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

// 1. Valid path-based SVG.
let doc = makeDocument(svgRoot(makeElement('path', { d: 'M0 0h10v10H0z' })))
let result = validateSvgDocument(doc, '<svg></svg>', 'path.svg')
assert(result.ok, 'valid path-based SVG is accepted')
assert(
  result.ok && result.url.startsWith('data:image/svg+xml;base64,'),
  'valid SVG produces a base64 data URL',
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
