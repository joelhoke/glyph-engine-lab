#!/usr/bin/env node
// October 2026 security floors; keep in sync with package.json engines.
const minimums = { 22: [23, 4], 24: [22, 1], 26: [12, 1] }

function isSupportedNodeVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return false
  const [major, minor, patch] = version.split('.').map(Number)
  const minimum = minimums[major]
  return Boolean(minimum && (minor > minimum[0] || (minor === minimum[0] && patch >= minimum[1])))
}

if (require.main === module) {
  if (!isSupportedNodeVersion(process.versions.node)) {
    console.error(`Node ${process.versions.node} is not a supported patched runtime. Run nvm install && nvm use (22.23.4), or use Node ^24.22.1 or ^26.12.1.`)
    process.exitCode = 1
  } else {
    console.log(`Security runtime check: Node ${process.versions.node}`)
  }
}

module.exports = { isSupportedNodeVersion }
