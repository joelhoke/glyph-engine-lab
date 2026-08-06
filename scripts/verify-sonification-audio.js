#!/usr/bin/env node
/**
 * Lifecycle verification for the Visual Sonification audio engine
 * (engine/sonificationEngine.ts) driven with a STUB AudioContext and
 * injected timers — no DOM, no real audio.
 *
 * Covers: no context before Play, exactly one context across play/pause/
 * stop cycles, the ≤8 voice ceiling, pause/resume, hidden-tab suspension,
 * stop (leave Vibe / reset) requiring Play again, the unsupported-context
 * error path, unmount cleanup (close), immediate volume application, and
 * scheduler drop counting.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceFiles = [path.join(projectRoot, 'engine', 'sonificationEngine.ts')]
const tmpDir = path.join(projectRoot, 'tmp-verify-sonification-audio')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc ${sourceFiles.map((file) => `"${file}"`).join(' ')} --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const { createSonificationEngine, SONIFICATION_UNSUPPORTED_MESSAGE } = require(
  path.join(tmpDir, 'sonificationEngine.js'),
)

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

// --- stub Web Audio -----------------------------------------------------------

function createParam(value = 0) {
  return {
    value,
    setValueAtTime(v) {
      this.value = v
    },
    linearRampToValueAtTime(v) {
      this.value = v
    },
    cancelScheduledValues() {},
  }
}

function createStubContext() {
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: { kind: 'destination' },
    oscillators: [],
    gains: [],
    bufferSources: [],
    suspendCalls: 0,
    resumeCalls: 0,
    closeCalls: 0,
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: createParam(440),
        started: false,
        stopped: false,
        connect() {},
        disconnect() {},
        start() {
          this.started = true
        },
        stop() {
          this.stopped = true
        },
      }
      ctx.oscillators.push(osc)
      return osc
    },
    createGain() {
      const gain = { gain: createParam(1), connect() {}, disconnect() {} }
      ctx.gains.push(gain)
      return gain
    },
    createDynamicsCompressor() {
      return {
        threshold: createParam(),
        knee: createParam(),
        ratio: createParam(),
        attack: createParam(),
        release: createParam(),
        connect() {},
        disconnect() {},
      }
    },
    createBiquadFilter() {
      return { type: 'lowpass', frequency: createParam(350), Q: createParam(1), connect() {}, disconnect() {} }
    },
    createBuffer(channels, length) {
      const data = new Float32Array(length)
      return { getChannelData: () => data }
    },
    createBufferSource() {
      const source = {
        buffer: null,
        loop: false,
        started: false,
        stopped: false,
        connect() {},
        disconnect() {},
        start() {
          this.started = true
        },
        stop() {
          this.stopped = true
        },
      }
      ctx.bufferSources.push(source)
      return source
    },
    suspend() {
      ctx.suspendCalls += 1
      ctx.state = 'suspended'
    },
    resume() {
      ctx.resumeCalls += 1
      ctx.state = 'running'
    },
    close() {
      ctx.closeCalls += 1
      ctx.state = 'closed'
    },
  }
  return ctx
}

/** Injected manual scheduler: tick() runs the engine's interval callback. */
function createRig(engineOptions = {}) {
  const rig = {
    contexts: [],
    intervalFn: null,
    states: [],
    errors: [],
    scheduledSteps: [],
    tick() {
      if (rig.intervalFn) rig.intervalFn()
    },
    pump(seconds, step = 0.05) {
      const ctx = rig.contexts[rig.contexts.length - 1]
      for (let t = 0; t < seconds; t += step) {
        if (ctx) ctx.currentTime += step
        rig.tick()
      }
    },
  }
  const options = {
    createContext: () => {
      const ctx = engineOptions.unsupported ? null : createStubContext()
      if (ctx) rig.contexts.push(ctx)
      return ctx
    },
    setIntervalFn: (fn) => {
      rig.intervalFn = fn
      return 1
    },
    clearIntervalFn: () => {
      rig.intervalFn = null
    },
    onScheduleStep: (playbackStep) => {
      rig.scheduledSteps.push(playbackStep)
      return {
        notes: [{ frequency: 440, gain: 0.5, band: 0, blend: 0, brightness: 0.5 }],
        activity: 0.5,
      }
    },
    getTextures: () => ({
      drone: { rootFrequency: 110, fifthFrequency: 165, gain: 0.18, cutoff: 800 },
      noise: null,
      pulses: null,
    }),
    onPlaybackChange: (state) => rig.states.push(state),
    onError: (message) => rig.errors.push(message),
  }
  const engine = createSonificationEngine(options)
  return { engine, rig }
}

const CONFIG = { direction: 'left-to-right', sweepDuration: 4, volume: 35 }

// (1) no AudioContext before Play; exactly one across the whole lifecycle
{
  const { engine, rig } = createRig()
  assert(rig.contexts.length === 0, 'creating the engine creates no AudioContext')
  engine.setConfig(CONFIG)
  assert(rig.contexts.length === 0, 'setConfig creates no AudioContext')
  engine.play()
  assert(rig.contexts.length === 1, 'the first Play creates the AudioContext')
  engine.pause()
  engine.play()
  engine.stop()
  engine.play()
  assert(rig.contexts.length === 1, 'pause/stop/play cycles reuse the single context')
  const ctx = rig.contexts[0]
  assert(
    ctx.oscillators.length === 8,
    `voice ceiling holds: 2 drone + 6 note oscillators (got ${ctx.oscillators.length})`,
  )
  assert(
    ctx.bufferSources.length === 1 && ctx.bufferSources[0].loop,
    'one looping seeded noise source',
  )
  assert(
    ctx.oscillators.every((osc) => osc.started && !osc.stopped),
    'voice oscillators run continuously (gain-gated, never per-note nodes)',
  )
  engine.dispose()
}

// (2) scheduling, sweep position, diagnostics
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  assert(engine.getSweepPosition() === null, 'no sweep position while idle')
  engine.play()
  rig.pump(1.0)
  const diag = engine.getDiagnostics()
  assert(diag.playbackState === 'playing', 'playback state is playing')
  assert(diag.contextState === 'running', 'context resumes on play')
  assert(diag.scheduledSteps >= 5, `steps are scheduled on the audio clock (got ${diag.scheduledSteps})`)
  assert(diag.droppedSteps === 0, 'no drops while the clock keeps up')
  assert(rig.scheduledSteps[0] === 0, 'the sweep starts at step 0')
  const position = engine.getSweepPosition()
  assert(position !== null && position > 0.1 && position < 0.4, `sweep position derives from audio time (got ${position})`)
  engine.reportAnalysisMs(2.5)
  assert(engine.getDiagnostics().analysisMs === 2.5, 'analysis cost is reported')
  assert(engine.getDiagnostics().activeVoices >= 1, 'active voices are counted')
  engine.dispose()
}

// (3) volume applies immediately; duration waits for the next sweep
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  const ctx = rig.contexts[0]
  const master = ctx.gains[0] // first gain node built is the master
  const before = master.gain.value
  engine.setConfig({ ...CONFIG, volume: 100 })
  const after = master.gain.value
  assert(after > before, `volume change applies immediately (${before.toFixed(3)} → ${after.toFixed(3)})`)
  engine.setConfig({ ...CONFIG, volume: 0 })
  assert(master.gain.value === 0, 'volume 0 silences the master immediately')
  engine.dispose()
}

// (4) pause/resume
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(0.5)
  const ctx = rig.contexts[0]
  const suspends = ctx.suspendCalls
  engine.pause()
  assert(engine.getState() === 'paused', 'pause reports the paused state')
  assert(ctx.suspendCalls === suspends + 1 && ctx.state === 'suspended', 'pause suspends the context')
  assert(rig.intervalFn === null, 'pause stops the scheduler')
  engine.play()
  assert(ctx.state === 'running' && engine.getState() === 'playing', 'Play after pause resumes')
  assert(rig.intervalFn !== null, 'resume restarts the scheduler')
  engine.dispose()
}

// (5) hidden tab suspends; returning resumes
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(0.3)
  const ctx = rig.contexts[0]
  engine.setHidden(true)
  assert(ctx.state === 'suspended', 'hidden tab suspends the context')
  assert(engine.getState() === 'playing', 'hidden tab keeps the playing state (auto-resume)')
  engine.setHidden(false)
  assert(ctx.state === 'running', 'returning to the tab resumes the context')
  // Hidden while idle/paused: no spurious resume.
  engine.pause()
  const resumes = ctx.resumeCalls
  engine.setHidden(true)
  engine.setHidden(false)
  assert(ctx.resumeCalls === resumes, 'no resume when playback was already paused')
  engine.dispose()
}

// (6) stop (leave Vibe / reset): playback ends, Play starts a fresh sweep
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(1.0)
  const ctx = rig.contexts[0]
  engine.stop()
  assert(engine.getState() === 'idle', 'stop returns to idle')
  assert(ctx.state === 'suspended', 'stop suspends the context')
  assert(rig.intervalFn === null, 'stop halts the scheduler')
  assert(engine.getSweepPosition() === null, 'no sweep position after stop')
  rig.scheduledSteps.length = 0
  engine.play()
  rig.pump(0.5)
  assert(rig.scheduledSteps[0] === 0, 'Play after stop restarts the sweep from step 0')
  assert(rig.contexts.length === 1, 'stop did not close the context — still one context')
  engine.dispose()
}

// (7) unsupported context: clean error, no crash, no context
{
  const { engine, rig } = createRig({ unsupported: true })
  engine.setConfig(CONFIG)
  engine.play()
  assert(engine.getState() === 'error', 'unsupported context → error state')
  assert(
    rig.errors.length === 1 && rig.errors[0] === SONIFICATION_UNSUPPORTED_MESSAGE,
    'the unsupported-context error is reported',
  )
  assert(rig.contexts.length === 0 && rig.intervalFn === null, 'no context, no scheduler on error')
  engine.dispose()
}

// (8) scheduler drops counted when the clock jumps ahead
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(0.5)
  const ctx = rig.contexts[0]
  ctx.currentTime += 3 // simulate a long main-thread block
  rig.tick()
  assert(engine.getDiagnostics().droppedSteps > 0, 'missed steps are counted as dropped, not piled up')
  engine.dispose()
}

// (9) dispose: everything stopped and closed
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(0.5)
  const ctx = rig.contexts[0]
  engine.dispose()
  assert(ctx.closeCalls === 1, 'dispose closes the context')
  assert(rig.intervalFn === null, 'dispose stops the scheduler')
  assert(
    ctx.oscillators.every((osc) => osc.stopped) && ctx.bufferSources.every((s) => s.stopped),
    'dispose stops every oscillator and the noise source',
  )
  assert(engine.getState() === 'idle', 'dispose returns to idle')
  assert(engine.getDiagnostics().contextState === 'none', 'no context remains after dispose')
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll sonification audio-engine verifications passed.')
