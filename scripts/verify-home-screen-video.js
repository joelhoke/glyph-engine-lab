#!/usr/bin/env node
// Exercise real compositor lifecycle with a controlled media element: an
// offscreen pause must win even if play() resolves later; no decode survives
// unmount; reduced motion must paint the poster, not an empty screen.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'tmp-verify-home-video')
execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
  'components/home/renderers/screenContent.ts', '--outDir', out,
  '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
], { cwd: root, stdio: 'inherit' })
const { createScreenPainter } = require(path.join(out, 'components/home/renderers/screenContent.js'))
let nextFrame = 0
const frames = new Map()
global.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame }
global.cancelAnimationFrame = id => frames.delete(id)
const drawn = []
const context = { fillRect() {}, drawImage(...args) { drawn.push(args) } }
let media
class FakeVideo {
  readyState = 2; videoWidth = 1920; videoHeight = 1080; paused = true
  events = {}; playResolves = []; playRejects = []; released = false; attributes = {}
  addEventListener(name, fn) { this.events[name] = fn }
  play() { this.paused = false; return new Promise((resolve, reject) => { this.playResolves.push(resolve); this.playRejects.push(reject) }) }
  setAttribute(name, value) { this.attributes[name] = value }
  pause() { this.paused = true }
  removeAttribute(name) { if (name === 'src') this.src = '' }
  load() { this.released = true }
}
let poster
global.Image = class { constructor() { poster = this; this.complete = true; this.naturalWidth = 1920; this.naturalHeight = 1080 } }
global.document = { createElement(type) {
  if (type === 'canvas') return { width: 0, height: 0, getContext() { return context } }
  if (type === 'video') return media = new FakeVideo()
  throw new Error(type)
} }
async function main() {
  let renders = 0
  const painter = createScreenPainter({ kind: 'video', src: '/reel.mp4', poster: '/poster.jpg', fit: 'cover' },
    { width: 512, height: 384, requestFrame: () => { renders++ } })
  assert.equal(media.muted, true)
  assert.equal(media.loop, true)
  assert.equal(media.playsInline, true)
  painter.setActive(true)
  painter.setActive(false)
  media.playResolves.shift()()
  await Promise.resolve()
  assert.equal(media.paused, true, 'late play resolution must not resume an offscreen video')
  assert.equal(painter.needsFrames(), false)
  assert.equal(frames.size, 0)
  painter.setActive(true)
  media.playResolves.shift()()
  await Promise.resolve()
  assert.equal(painter.needsFrames(), true)
  assert.equal(frames.size, 1)
  // Execute one RAF: the reel must fill the CRT with a centered crop.
  const [id, callback] = frames.entries().next().value
  frames.delete(id); callback(16)
  const videoDraw = drawn.find(args => args[0] === media)
  assert(Math.abs(videoDraw[1] + 85.3333333333) < 0.00001)
  assert.equal(videoDraw[2], 0)
  assert(Math.abs(videoDraw[3] - 682.6666666667) < 0.00001)
  assert.equal(videoDraw[4], 384)
  painter.setReducedMotion(true)
  assert.equal(media.paused, true)
  assert.equal(painter.needsFrames(), false)
  assert.equal(drawn.at(-1)[0], poster, 'reduced motion paints the poster')
  painter.setReducedMotion(false)
  const latePlay = media.playResolves.shift()
  const retainedVideo = media
  const before = renders
  painter.dispose()
  latePlay()
  await Promise.resolve()
  assert.equal(retainedVideo.paused, true)
  assert.equal(retainedVideo.src, '')
  assert.equal(retainedVideo.released, true)
  assert.equal(frames.size, 0)
  retainedVideo.events.canplay()
  assert.equal(renders, before, 'disposed media cannot repaint the host')
  const states = []
  const retry = createScreenPainter({ kind: 'video', src: '/reel.mp4', poster: '/poster.jpg' },
    { width: 512, height: 384, requestFrame() {}, onPlaybackState: state => states.push(state) })
  media.readyState = 0
  retry.setActive(true)
  assert.equal(media.playResolves.length, 1, 'request play before a decoded frame exists')
  assert.equal(media.defaultMuted, true)
  assert.equal(media.attributes.playsinline, '')
  media.playResolves.shift()
  media.playRejects.shift()({ name: 'NotAllowedError' })
  await Promise.resolve(); await Promise.resolve()
  assert.equal(states.at(-1), 'blocked', 'autoplay rejection is exposed to the Play control')
  assert.equal(retry.needsFrames(), false)
  media.events.canplay()
  assert.equal(media.playResolves.length, 0, 'a blocked player does not repeatedly retry without a gesture')
  retry.play()
  assert.equal(media.playResolves.length, 1, 'manual play calls the media synchronously, inside user activation')
  media.readyState = 2
  media.playResolves.shift()()
  await Promise.resolve()
  assert.equal(states.at(-1), 'playing')
  assert.equal(retry.needsFrames(), true)
  retry.pause()
  assert.equal(states.at(-1), 'paused')
  assert.equal(retry.needsFrames(), false)
  retry.setReducedMotion(true)
  retry.play()
  media.playResolves.shift()()
  await Promise.resolve()
  assert.equal(retry.needsFrames(), true, 'explicit Play is allowed with reduced motion')
  retry.paintNow()
  assert.equal(drawn.at(-1)[0], media, 'explicit playback paints the video, not the reduced-motion poster')
  retry.setActive(false)
  assert.equal(retry.needsFrames(), false, 'manual playback still parks offscreen')
  retry.dispose()
  assert.equal(frames.size, 0)
  console.log('PASS: full CRT crop, loading startup, autoplay rejection/retry, direct manual play, reduced-motion opt-in, offscreen parking and disposal')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
