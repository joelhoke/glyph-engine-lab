#!/usr/bin/env node
/**
 * Deterministic verification for engine/random.ts.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'engine', 'random.ts')
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

const { createSeededRandom } = require(path.join(tmpDir, 'random.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function take(seed, count) {
  const random = createSeededRandom(seed)
  const values = []
  for (let i = 0; i < count; i += 1) values.push(random())
  return values
}

// same seed produces the same sequence
const a1 = take(42, 512)
const a2 = take(42, 512)
assert(a1.length === a2.length && a1.every((v, i) => v === a2[i]), 'same seed yields identical sequence')

// different seeds produce different sequences
const b = take(43, 512)
assert(a1.some((v, i) => v !== b[i]), 'different seeds yield different sequences')

// values stay in [0, 1)
const wide = take(7, 2000)
assert(wide.every((v) => v >= 0 && v < 1), 'all values are within [0, 1)')

// sequence actually varies (no degenerate constant output)
assert(Math.min(...wide) < 0.05 && Math.max(...wide) > 0.95, 'sequence spans the unit interval')

// edge seeds are accepted and deterministic
const zero1 = take(0, 64)
const zero2 = take(0, 64)
assert(zero1.every((v, i) => v === zero2[i]), 'seed 0 is deterministic')
const neg1 = take(-1, 64)
const neg2 = take(-1, 64)
assert(neg1.every((v, i) => v === neg2[i]), 'negative seed is deterministic')
const big1 = take(4294967297, 64)
const big2 = take(4294967297, 64)
assert(big1.every((v, i) => v === big2[i]), 'seed larger than 2^32 is deterministic')

// generators with the same seed do not share state
const r1 = createSeededRandom(9)
const r2 = createSeededRandom(9)
const r1First = r1()
const r1Second = r1()
assert(r2() === r1First && r2() === r1Second, 'independent generators track identical state')

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll random verifications passed.')
