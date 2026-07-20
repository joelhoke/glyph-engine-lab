#!/usr/bin/env node
/**
 * Deterministic verification for the numeric-control utility functions.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFile = path.join(projectRoot, 'components', 'tuning', 'tuningConfig.ts')
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
  commitNumericInput,
  formatNumericValue,
  isPotentiallyValidDraft,
  roundToStep,
} = require(path.join(tmpDir, 'components', 'tuning', 'tuningConfig.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function eq(a, b) {
  return Math.abs(a - b) < 1e-9
}

// formatNumericValue
assert(formatNumericValue(5, 1) === '5', 'format integer with integer step')
assert(formatNumericValue(5.5, 0.1) === '5.5', 'format one decimal with 0.1 step')
assert(formatNumericValue(5.5, 0.01) === '5.50', 'format two decimals with 0.01 step')
assert(formatNumericValue(0, 50) === '0', 'format zero')

// roundToStep
assert(eq(roundToStep(5.3, 1), 5), 'round to integer step down')
assert(eq(roundToStep(5.6, 1), 6), 'round to integer step up')
assert(eq(roundToStep(5.123, 0.01), 5.12), 'round to 0.01 step')
assert(eq(roundToStep(5.125, 0.01), 5.13), 'round to 0.01 step up')
assert(eq(roundToStep(5, 0), 5), 'round with zero step returns value')

// isPotentiallyValidDraft
assert(isPotentiallyValidDraft(''), 'empty draft is potentially valid')
assert(isPotentiallyValidDraft('-'), 'negative sign alone is potentially valid')
assert(isPotentiallyValidDraft('.'), 'decimal point alone is potentially valid')
assert(isPotentiallyValidDraft('-.'), 'negative decimal prefix is potentially valid')
assert(isPotentiallyValidDraft('5'), 'integer is valid')
assert(isPotentiallyValidDraft('5.'), 'trailing decimal is valid')
assert(isPotentiallyValidDraft('5.5'), 'decimal is valid')
assert(isPotentiallyValidDraft('-5'), 'negative number is valid')
assert(!isPotentiallyValidDraft('abc'), 'letters are invalid')
assert(!isPotentiallyValidDraft('5.5.5'), 'multiple decimals are invalid')

// commitNumericInput: valid values
assert(eq(commitNumericInput('5', 0, 0, 10, 1), 5), 'commit integer')
assert(eq(commitNumericInput('5.5', 0, 0, 10, 0.1), 5.5), 'commit decimal')
assert(eq(commitNumericInput('  5  ', 0, 0, 10, 1), 5), 'commit trimmed value')

// commitNumericInput: empty and partial drafts revert
assert(commitNumericInput('', 3, 0, 10, 1) === null, 'empty draft reverts')
assert(commitNumericInput('-', 3, -10, 10, 1) === null, 'lone minus reverts')
assert(commitNumericInput('.', 3, 0, 10, 1) === null, 'lone dot reverts')
assert(commitNumericInput('-.', 3, -10, 10, 1) === null, 'lone negative dot reverts')

// commitNumericInput: clamping
assert(eq(commitNumericInput('-5', 0, 0, 10, 1), 0), 'clamp below min')
assert(eq(commitNumericInput('15', 0, 0, 10, 1), 10), 'clamp above max')
assert(eq(commitNumericInput('-5', 0, -10, 10, 1), -5), 'allow negative within range')
assert(eq(commitNumericInput('-15', 0, -10, 10, 1), -10), 'clamp negative below min')

// commitNumericInput: step rounding
assert(eq(commitNumericInput('53', 0, 0, 100, 50), 50), 'round down to step')
assert(eq(commitNumericInput('78', 0, 0, 100, 50), 100), 'round up to step')
assert(eq(commitNumericInput('0.015', 0, 0, 1, 0.01), 0.02), 'round decimal to step')

// commitNumericInput: invalid text and special values
assert(commitNumericInput('abc', 3, 0, 10, 1) === null, 'invalid text reverts')
assert(commitNumericInput('NaN', 3, 0, 10, 1) === null, 'NaN reverts')
assert(commitNumericInput('Infinity', 3, 0, 10, 1) === null, 'Infinity reverts')
assert(commitNumericInput('-Infinity', 3, 0, 10, 1) === null, '-Infinity reverts')

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true })

if (failures > 0) {
  console.error(`\n${failures} numeric-control verification failure(s)`)
  process.exit(1)
}

console.log('\nAll numeric-control verifications passed.')
