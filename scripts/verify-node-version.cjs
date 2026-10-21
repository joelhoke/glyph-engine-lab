const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { isSupportedNodeVersion } = require('./check-node-version.cjs')

for (const version of ['22.23.4', '22.23.5', '22.24.0', '24.22.1', '24.23.0', '26.12.1', '26.13.0']) {
  assert(isSupportedNodeVersion(version), `${version} must be accepted`)
}
for (const version of ['20.20.0', '22.13.0', '22.23.3', '24.22.0', '26.5.0', '26.12.0', '23.0.0', '27.0.0', '22.23.4-rc.1', 'invalid']) {
  assert(!isSupportedNodeVersion(version), `${version} must be rejected`)
}
const root = path.resolve(__dirname, '..')
assert(isSupportedNodeVersion(fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim()))
assert.equal(require('../package.json').engines.node, '^22.23.4 || ^24.22.1 || ^26.12.1')
console.log('PASS: runtime security floors and .nvmrc')
