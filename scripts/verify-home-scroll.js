#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const out = fs.mkdtempSync(path.join(root, 'tmp-verify-home-scroll-'))
try {
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
    'engine/homeNavigation.ts', '--outDir', out, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck',
  ], { cwd: root, stdio: 'inherit' })
  const { createHomeScrollRecorder, writeHomeHistoryEntry, readHomeHistoryEntry } = require(path.join(out, 'engine/homeNavigation.js'))
  let now = 0, serial = 0, scrollY = 0
  const timers = new Map(), writes = []
  global.window = { history: {
    state: { framework: 'preserved', jhHome: { key: 'home-a', scrollY: 0 } },
    replaceState(state) {
      writes.push(now)
      assert(writes.filter(time => now - time < 10000).length < 100, 'history must stay below Safari’s reported rate limit')
      this.state = state
    },
  } }
  const recorder = createHomeScrollRecorder(
    () => writeHomeHistoryEntry({ key: 'home-a', scrollY }),
    (callback, delay) => { timers.set(++serial, { at: now + delay, callback }); return serial },
    timer => timers.delete(timer),
  )
  function advance(target) {
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > target) break
      now = next[1].at
      timers.delete(next[0])
      next[1].callback()
    }
    now = target
  }
  for (let frame = 1; frame <= 3600; frame++) {
    advance(frame * 1000 / 120)
    scrollY = frame * 3
    recorder.schedule()
  }
  assert(writes.length <= 120, 'continuous scrolling persists at most four times per second')
  recorder.flush()
  assert.equal(readHomeHistoryEntry(window.history.state).scrollY, scrollY, 'scroll end/page exit preserves the final position')
  assert.equal(window.history.state.framework, 'preserved')
  assert.equal(timers.size, 0, 'flush leaves no delayed write after navigation or unmount')
  const count = writes.length
  recorder.flush()
  recorder.flush()
  assert.equal(writes.length, count, 'duplicate position writes are skipped')
  advance(now + 1000)
  assert.equal(writes.length, count)
  console.log('Home scroll: 120 Hz scrolling, history rate limit, final restoration, deduplication, and timer cleanup passed.')
} finally {
  delete global.window
  fs.rmSync(out, { recursive: true, force: true })
}
