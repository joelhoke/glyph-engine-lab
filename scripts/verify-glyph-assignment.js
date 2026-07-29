#!/usr/bin/env node
/**
 * Deterministic verification for engine/glyphAssignment.ts.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'glyphAssignment.ts')
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

const { assignGlyphsToTargets } = require(path.join(tmpDir, 'glyphAssignment.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function uniqueAssignedTargets(assignment) {
  const seen = new Set()
  for (let i = 0; i < assignment.glyphToTarget.length; i += 1) {
    const target = assignment.glyphToTarget[i]
    if (target >= 0) seen.add(target)
  }
  return seen
}

// same inputs produce the same mapping
const first = assignGlyphsToTargets(120, 40)
const second = assignGlyphsToTargets(120, 40)
assert(
  first.glyphToTarget.length === second.glyphToTarget.length &&
    first.glyphToTarget.every((v, i) => v === second.glyphToTarget[i]),
  'same inputs yield identical mapping',
)
assert(first.assignedCount === second.assignedCount, 'same inputs yield identical assigned count')

// glyphs >= targets: every target is covered exactly once
const covering = assignGlyphsToTargets(120, 40)
const covered = uniqueAssignedTargets(covering)
assert(covered.size === 40, 'all targets covered when glyphs >= targets')
assert(covering.assignedCount === 40, 'assigned count equals target count when glyphs >= targets')
for (let i = 0; i < 40; i += 1) {
  if (covering.glyphToTarget[i] !== i) {
    assert(false, `order-preserving mapping at glyph ${i}`)
    break
  }
  if (i === 39) assert(true, 'order-preserving mapping for assigned glyphs')
}
assert(covering.glyphToTarget[119] === -1, 'surplus glyphs are unassigned')

// glyphs preserved when the target count changes
const shrunk = assignGlyphsToTargets(120, 30)
assert(shrunk.glyphToTarget.length === 120, 'glyph population size preserved on target shrink')
assert(
  shrunk.glyphToTarget.every((v) => v >= -1 && v < 30),
  'mapping stays within target bounds on shrink',
)
const grown = assignGlyphsToTargets(120, 200)
assert(grown.glyphToTarget.length === 120, 'glyph population size preserved on target growth')
assert(
  uniqueAssignedTargets(grown).size === grown.assignedCount,
  'no target receives two glyphs on growth',
)

// targets > glyphs: bounded behavior, every glyph assigned uniquely
const sparse = assignGlyphsToTargets(10, 50)
assert(sparse.assignedCount === 10, 'every glyph assigned when targets > glyphs')
assert(sparse.glyphToTarget.every((v) => v >= 0 && v < 50), 'sparse mapping within bounds')
assert(uniqueAssignedTargets(sparse).size === 10, 'sparse glyphs never share a target')
assert(sparse.glyphToTarget[9] === 45, 'sparse glyphs spread across the full target list')

// degenerate inputs
const noTargets = assignGlyphsToTargets(25, 0)
assert(noTargets.assignedCount === 0 && noTargets.glyphToTarget.every((v) => v === -1), 'zero targets leaves all glyphs unassigned')
const noGlyphs = assignGlyphsToTargets(0, 10)
assert(noGlyphs.glyphToTarget.length === 0 && noGlyphs.assignedCount === 0, 'zero glyphs yields an empty mapping')
const messy = assignGlyphsToTargets(10.7, -3)
assert(messy.glyphToTarget.length === 10 && messy.assignedCount === 0, 'counts are floored and clamped at zero')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll glyph-assignment verifications passed.')
