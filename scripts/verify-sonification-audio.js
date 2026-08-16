#!/usr/bin/env node
/**
 * Lifecycle + audio-safety verification for the Visual Sonification audio
 * engine (engine/sonificationEngine.ts) driven with a STUB AudioContext and
 * injected timers — no DOM, no real audio, no dependencies.
 *
 * Lifecycle coverage: no context before Play, exactly one context across
 * play/pause/stop cycles, the ≤6 voice ceiling, pause/resume, hidden-tab
 * suspension, stop (leave Vibe / reset) requiring Play again, the
 * unsupported-context error path, unmount cleanup (close), immediate volume
 * application, scheduler drop counting, and capture routing.
 *
 * Audio-safety coverage (the no-continuous-bed contract):
 *  - Graph shape: voices → master volume → transition fade → 120 Hz
 *    high-pass → limiter → destination/capture; no drone oscillators, no
 *    noise buffer source anywhere.
 *  - Exact-zero gating: every recorded voice-gain event value is exactly 0
 *    or ≥ 0.01 (no 0.0001 leaks); every envelope begins and ends at 0.
 *  - Offline render (the stub doubles as a deterministic renderer: sine/
 *    triangle oscillators, per-sample param automation, RBJ biquads, the
 *    limiter modeled as passthrough): a silent scene renders as EXACT
 *    digital silence (< −70 dBFS RMS, no DC); an active scene keeps the
 *    20–120 Hz band under 15% of total energy (the high-pass works) with no
 *    DC offset; matrix pulses render as discrete gated events with exact
 *    digital silence between them.
 *  - Transition clicks: every suspend (pause/stop/hidden/capture) is
 *    preceded by a scheduled 30ms fade-out and is DEFERRED until the fade
 *    completes; every resume/play fades back in.
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
// Every AudioParam records its automation events (set/ramp/cancel) so tests
// can inspect envelopes structurally AND render the graph offline.

function createParam(value = 0) {
  let stored = value
  const events = [] // { type: 'set' | 'ramp', value, time }
  const param = {
    events,
    baseValue: value, // value in effect before the first scheduled event
    get value() {
      return stored
    },
    set value(v) {
      stored = v
      // Direct assignments happen at build time, before any scheduling.
      if (events.length === 0) param.baseValue = v
    },
    setValueAtTime(v, t) {
      events.push({ type: 'set', value: v, time: t })
      stored = v
    },
    linearRampToValueAtTime(v, t) {
      events.push({ type: 'ramp', value: v, time: t })
      stored = v
    },
    cancelScheduledValues(t) {
      const kept = events.filter((e) => e.time < t)
      events.length = 0
      events.push(...kept)
    },
  }
  return param
}

function createStubContext() {
  let nextId = 1
  const ctx = {
    currentTime: 0,
    state: 'running',
    nodes: [],
    oscillators: [],
    gains: [],
    filters: [],
    bufferSources: [],
    captureDestinations: [],
    compressors: [],
    suspendCalls: 0,
    resumeCalls: 0,
    closeCalls: 0,
  }
  const register = (node) => {
    node.id = nextId
    nextId += 1
    node.inputs = []
    node.connectCalls = []
    node.connect = (target) => {
      node.connectCalls.push(target)
      if (target && Array.isArray(target.inputs)) target.inputs.push(node)
    }
    node.disconnect = () => {
      node.disconnected = true
    }
    ctx.nodes.push(node)
    return node
  }
  ctx.destination = register({ kind: 'destination' })
  ctx.createOscillator = () => {
    const osc = register({
      kind: 'oscillator',
      type: 'sine',
      frequency: createParam(440),
      started: false,
      stopped: false,
      start() {
        this.started = true
      },
      stop() {
        this.stopped = true
      },
    })
    ctx.oscillators.push(osc)
    return osc
  }
  ctx.createGain = () => {
    const gain = register({ kind: 'gain', gain: createParam(1) })
    ctx.gains.push(gain)
    return gain
  }
  ctx.createDynamicsCompressor = () => {
    const compressor = register({
      kind: 'compressor',
      threshold: createParam(),
      knee: createParam(),
      ratio: createParam(),
      attack: createParam(),
      release: createParam(),
    })
    ctx.compressors.push(compressor)
    return compressor
  }
  ctx.createBiquadFilter = () => {
    const filter = register({
      kind: 'biquad',
      type: 'lowpass',
      frequency: createParam(350),
      Q: createParam(1),
    })
    ctx.filters.push(filter)
    return filter
  }
  ctx.createBuffer = (channels, length) => {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
  ctx.createBufferSource = () => {
    const source = register({
      kind: 'bufferSource',
      buffer: null,
      loop: false,
      started: false,
      stopped: false,
      start() {
        this.started = true
      },
      stop() {
        this.stopped = true
      },
    })
    ctx.bufferSources.push(source)
    return source
  }
  ctx.createMediaStreamDestination = () => {
    const dest = register({
      kind: 'captureDestination',
      stream: {
        id: `capture-stream-${ctx.captureDestinations.length + 1}`,
        getAudioTracks() {
          return [{ kind: 'audio', stop() {} }]
        },
      },
    })
    ctx.captureDestinations.push(dest)
    return dest
  }
  ctx.suspend = () => {
    ctx.suspendCalls += 1
    ctx.state = 'suspended'
  }
  ctx.resume = () => {
    ctx.resumeCalls += 1
    ctx.state = 'running'
  }
  ctx.close = () => {
    ctx.closeCalls += 1
    ctx.state = 'closed'
  }
  return ctx
}

// --- deterministic offline renderer -------------------------------------------
// Evaluates the recorded stub graph sample-by-sample. The compressor is
// modeled as a passthrough: nothing under test depends on gain reduction,
// and level assertions stay well below the limiter threshold.

function paramAt(param, t) {
  let t0 = 0
  let v0 = param.baseValue
  for (const e of param.events) {
    if (t < e.time) {
      if (e.type === 'ramp' && e.time > t0) {
        return v0 + ((e.value - v0) * (t - t0)) / (e.time - t0)
      }
      return v0
    }
    v0 = e.value
    t0 = e.time
  }
  return v0
}

function renderContext(ctx, seconds, sampleRate = 8000) {
  const length = Math.round(seconds * sampleRate)
  const out = new Float32Array(length)
  const state = new Map()
  const memo = new Map()
  const stateOf = (node) => {
    let st = state.get(node)
    if (!st) {
      st = { phase: 0, x1: 0, x2: 0, y1: 0, y2: 0, coeffKey: '', b0: 0, b1: 0, b2: 0, a1: 0, a2: 0 }
      state.set(node, st)
    }
    return st
  }
  const evalNode = (node, i, t) => {
    const m = memo.get(node)
    if (m && m.sample === i) return m.value
    let value = 0
    if (node.kind === 'oscillator') {
      if (node.started && !node.stopped) {
        const st = stateOf(node)
        const freq = paramAt(node.frequency, t)
        st.phase += (2 * Math.PI * freq) / sampleRate
        const cycle = (st.phase / (2 * Math.PI)) % 1
        value = node.type === 'triangle' ? 4 * Math.abs(cycle - 0.5) - 1 : Math.sin(st.phase)
      }
    } else if (node.kind === 'gain') {
      let sum = 0
      for (const input of node.inputs) sum += evalNode(input, i, t)
      value = sum * paramAt(node.gain, t)
    } else if (node.kind === 'biquad') {
      let sum = 0
      for (const input of node.inputs) sum += evalNode(input, i, t)
      const st = stateOf(node)
      const f = paramAt(node.frequency, t)
      const q = paramAt(node.Q, t)
      const key = `${node.type}|${f}|${q}`
      if (key !== st.coeffKey) {
        // RBJ cookbook biquad (lowpass / highpass).
        const w0 = (2 * Math.PI * f) / sampleRate
        const alpha = Math.sin(w0) / (2 * q)
        const cosw0 = Math.cos(w0)
        let b0
        let b1
        let b2
        if (node.type === 'highpass') {
          b0 = (1 + cosw0) / 2
          b1 = -(1 + cosw0)
          b2 = b0
        } else {
          b0 = (1 - cosw0) / 2
          b1 = 1 - cosw0
          b2 = b0
        }
        const a0 = 1 + alpha
        st.b0 = b0 / a0
        st.b1 = b1 / a0
        st.b2 = b2 / a0
        st.a1 = (-2 * cosw0) / a0
        st.a2 = (1 - alpha) / a0
        st.coeffKey = key
      }
      value = st.b0 * sum + st.b1 * st.x1 + st.b2 * st.x2 - st.a1 * st.y1 - st.a2 * st.y2
      st.x2 = st.x1
      st.x1 = sum
      st.y2 = st.y1
      st.y1 = value
    } else {
      // compressor (passthrough), destination, capture destination: sum.
      let sum = 0
      for (const input of node.inputs) sum += evalNode(input, i, t)
      value = sum
    }
    memo.set(node, { sample: i, value })
    return value
  }
  for (let i = 0; i < length; i += 1) {
    out[i] = evalNode(ctx.destination, i, i / sampleRate)
  }
  return out
}

// --- measurement helpers --------------------------------------------------------

function rms(samples) {
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i]
  return Math.sqrt(sum / Math.max(1, samples.length))
}

function mean(samples) {
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) sum += samples[i]
  return sum / Math.max(1, samples.length)
}

function maxAbs(samples, fromIndex, toIndex) {
  let peak = 0
  for (let i = fromIndex; i < toIndex && i < samples.length; i += 1) {
    const v = Math.abs(samples[i])
    if (v > peak) peak = v
  }
  return peak
}

/** 4× cascaded RBJ lowpass: a steep deterministic 20–120 Hz band isolator
 *  (leakage from ≥220 Hz content is < −80 dB). */
function lowpassCascade(samples, cutoff, sampleRate, stages = 4) {
  const w0 = (2 * Math.PI * cutoff) / sampleRate
  const alpha = Math.sin(w0) / (2 * 0.707)
  const cosw0 = Math.cos(w0)
  const a0 = 1 + alpha
  const b0 = ((1 - cosw0) / 2) / a0
  const b1 = (1 - cosw0) / a0
  const b2 = b0
  const a1 = (-2 * cosw0) / a0
  const a2 = (1 - alpha) / a0
  let data = samples
  for (let s = 0; s < stages; s += 1) {
    const out = new Float32Array(data.length)
    let x1 = 0
    let x2 = 0
    let y1 = 0
    let y2 = 0
    for (let i = 0; i < data.length; i += 1) {
      const x = data[i]
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      out[i] = y
    }
    data = out
  }
  return data
}

// --- rig ------------------------------------------------------------------------

/** Injected manual scheduler + timeouts: tick() runs the engine's interval
 *  callback, flushTimeouts() fires the deferred post-fade suspends. */
function createRig(engineOptions = {}) {
  const timeouts = new Map()
  let nextTimeoutId = 1
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
    flushTimeouts() {
      const fns = [...timeouts.values()]
      timeouts.clear()
      for (const fn of fns) fn()
    },
    pendingTimeouts: () => timeouts.size,
  }
  const options = {
    createContext: () => {
      const ctx = engineOptions.unsupported ? null : createStubContext()
      if (ctx && engineOptions.noCapture) delete ctx.createMediaStreamDestination
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
    setTimeoutFn: (fn) => {
      const id = nextTimeoutId
      nextTimeoutId += 1
      timeouts.set(id, fn)
      return id
    },
    clearTimeoutFn: (id) => {
      timeouts.delete(id)
    },
    onScheduleStep:
      engineOptions.onScheduleStep ??
      ((playbackStep) => {
        rig.scheduledSteps.push(playbackStep)
        return {
          notes: [{ frequency: 440, gain: 0.5, band: 0, blend: 0, brightness: 0.5 }],
          activity: 0.5,
        }
      }),
    getTextures: engineOptions.getTextures ?? (() => ({ pulses: null })),
    onPlaybackChange: (state) => rig.states.push(state),
    onError: (message) => rig.errors.push(message),
  }
  const engine = createSonificationEngine(options)
  return { engine, rig }
}

/** Locate the fixed chain stages via recorded wiring. */
function chainStages(ctx) {
  const compressor = ctx.compressors[0]
  const highpass = ctx.filters.find((f) => f.type === 'highpass')
  const transition = ctx.gains.find((g) => highpass && g.connectCalls.includes(highpass))
  const master = ctx.gains.find((g) => transition && g.connectCalls.includes(transition))
  const voiceGains = master ? ctx.gains.filter((g) => g.connectCalls.includes(master)) : []
  return { compressor, highpass, transition, master, voiceGains }
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
  rig.flushTimeouts()
  engine.play()
  engine.stop()
  rig.flushTimeouts()
  engine.play()
  assert(rig.contexts.length === 1, 'pause/stop/play cycles reuse the single context')
  const ctx = rig.contexts[0]
  assert(
    ctx.oscillators.length === 6,
    `voice ceiling holds: 6 gated note oscillators, no drone pair (got ${ctx.oscillators.length})`,
  )
  assert(
    ctx.bufferSources.length === 0,
    'no buffer source exists — the looping noise bed is gone',
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
  const { master } = chainStages(ctx)
  const before = master.gain.value
  engine.setConfig({ ...CONFIG, volume: 100 })
  const after = master.gain.value
  assert(after > before, `volume change applies immediately (${before.toFixed(3)} → ${after.toFixed(3)})`)
  engine.setConfig({ ...CONFIG, volume: 0 })
  assert(master.gain.value === 0, 'volume 0 silences the master immediately')
  engine.dispose()
}

// (4) pause/resume: suspend is deferred until the fade-out completes
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(0.5)
  const ctx = rig.contexts[0]
  const { transition } = chainStages(ctx)
  const suspends = ctx.suspendCalls
  engine.pause()
  assert(engine.getState() === 'paused', 'pause reports the paused state')
  assert(ctx.suspendCalls === suspends, 'pause does NOT suspend synchronously (fade first)')
  const fadeEvents = transition.gain.events
  const lastFade = fadeEvents[fadeEvents.length - 1]
  assert(
    lastFade && lastFade.type === 'ramp' && lastFade.value === 0,
    'pause schedules a fade-out ramp to exactly 0 before suspending',
  )
  assert(rig.intervalFn === null, 'pause stops the scheduler')
  rig.flushTimeouts()
  assert(ctx.suspendCalls === suspends + 1 && ctx.state === 'suspended', 'the context suspends after the fade')
  engine.play()
  assert(ctx.state === 'running' && engine.getState() === 'playing', 'Play after pause resumes')
  assert(rig.intervalFn !== null, 'resume restarts the scheduler')
  const resumedEvents = transition.gain.events
  const lastResume = resumedEvents[resumedEvents.length - 1]
  assert(lastResume && lastResume.type === 'ramp' && lastResume.value === 1, 'resume fades back in')
  rig.flushTimeouts()
  assert(ctx.suspendCalls === suspends + 1, 'resume cancels the stale deferred suspend')
  engine.dispose()
}

// (5) hidden tab fades out and suspends; returning resumes with a fade-in
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(0.3)
  const ctx = rig.contexts[0]
  engine.setHidden(true)
  assert(ctx.state === 'running', 'hidden tab fades before suspending (no click)')
  rig.flushTimeouts()
  assert(ctx.state === 'suspended', 'hidden tab suspends the context after the fade')
  assert(engine.getState() === 'playing', 'hidden tab keeps the playing state (auto-resume)')
  engine.setHidden(false)
  assert(ctx.state === 'running', 'returning to the tab resumes the context')
  // Hidden while idle/paused: no spurious resume.
  engine.pause()
  rig.flushTimeouts()
  const resumes = ctx.resumeCalls
  engine.setHidden(true)
  rig.flushTimeouts()
  engine.setHidden(false)
  rig.flushTimeouts()
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
  assert(ctx.state === 'running', 'stop fades out before suspending (no click)')
  rig.flushTimeouts()
  assert(ctx.state === 'suspended', 'stop suspends the context after the fade')
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

// (9) dispose: everything stopped and closed; pending fades are cancelled
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(0.5)
  const ctx = rig.contexts[0]
  engine.pause() // leaves a deferred suspend pending
  engine.dispose()
  rig.flushTimeouts()
  assert(ctx.closeCalls === 1, 'dispose closes the context')
  assert(ctx.suspendCalls === 0, 'dispose cancels the pending post-fade suspend')
  assert(rig.intervalFn === null, 'dispose stops the scheduler')
  assert(
    ctx.oscillators.every((osc) => osc.stopped),
    'dispose stops every voice oscillator',
  )
  assert(engine.getState() === 'idle', 'dispose returns to idle')
  assert(engine.getDiagnostics().contextState === 'none', 'no context remains after dispose')
}

// (10) capture stream: none before Play, single reusable destination after
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  assert(engine.getCaptureStream() === null, 'no capture stream before any context exists')
  assert(rig.contexts.length === 0, 'asking for the capture stream creates no AudioContext')
  engine.play()
  const ctx = rig.contexts[0]
  const streamA = engine.getCaptureStream()
  const streamB = engine.getCaptureStream()
  assert(streamA !== null, 'capture stream is available after Play')
  assert(streamA === streamB && ctx.captureDestinations.length === 1, 'one reusable capture destination per context')
  // Routing: the capture tap hangs off the compressor (post master gain +
  // limiter), so the recorded mix equals the audible mix.
  const compressor = ctx.compressors[0]
  assert(
    compressor.connectCalls.includes(ctx.destination) &&
      compressor.connectCalls.includes(ctx.captureDestinations[0]),
    'capture destination connects AFTER the limiter (recorded == audible)',
  )
  engine.dispose()
  assert(ctx.captureDestinations[0].disconnected, 'dispose disconnects the capture destination')
}

// (11) capture unavailable: beginCapture fails cleanly and restores state
{
  const { engine, rig } = createRig({ noCapture: true })
  engine.setConfig(CONFIG)
  const session = engine.beginCapture()
  assert(session === null, 'beginCapture returns null when capture is unavailable')
  assert(engine.getState() === 'idle', 'state is restored after a failed beginCapture')
  rig.flushTimeouts()
  engine.dispose()
}

// (12) beginCapture/finish: playback-mode snapshot and restore
{
  // From idle: starts a fresh playing sweep, finish returns to idle.
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  const session = engine.beginCapture()
  assert(session !== null && session.stream, 'beginCapture from idle returns a capture session')
  assert(rig.contexts.length === 1, 'beginCapture is the gesture that creates the context')
  assert(engine.getState() === 'playing', 'beginCapture plays through the speakers')
  rig.pump(0.4)
  assert(rig.scheduledSteps[0] === 0, 'capture sweep starts from step zero')
  session.finish()
  assert(engine.getState() === 'idle', 'finish after idle-capture restores idle')
  session.finish() // idempotent
  assert(engine.getState() === 'idle', 'finish is idempotent')
  rig.flushTimeouts()

  // From paused: finish re-pauses.
  engine.play()
  engine.pause()
  rig.flushTimeouts()
  const session2 = engine.beginCapture()
  assert(engine.getState() === 'playing', 'beginCapture from paused plays')
  session2.finish()
  assert(engine.getState() === 'paused', 'finish after paused-capture restores paused')
  rig.flushTimeouts()

  // From playing: finish leaves playback running.
  const ctx = rig.contexts[0]
  const resumeCalls = ctx.resumeCalls
  engine.play()
  const session3 = engine.beginCapture()
  assert(engine.getState() === 'playing', 'beginCapture from playing keeps playing')
  session3.finish()
  assert(
    engine.getState() === 'playing' && ctx.resumeCalls >= resumeCalls,
    'finish after playing-capture leaves playback running',
  )
  assert(rig.contexts.length === 1, 'capture cycles never create a second context')
  assert(ctx.captureDestinations.length === 1, 'capture cycles reuse the single destination')
  engine.dispose()
}

// (13) graph shape: voices → master → transition fade → 120 Hz high-pass →
// limiter → destination/capture. No drone, no noise source.
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  const ctx = rig.contexts[0]
  const { compressor, highpass, transition, master, voiceGains } = chainStages(ctx)
  assert(
    highpass &&
      Math.abs(highpass.frequency.value - 120) < 1e-9 &&
      Math.abs(highpass.Q.value - 0.707) < 1e-9,
    'a master high-pass stage sits at 120 Hz (Butterworth Q)',
  )
  assert(highpass.connectCalls.includes(compressor), 'the high-pass feeds the limiter')
  assert(
    transition && master && voiceGains.length === 6,
    'chain order: 6 voices → master volume → transition fade → high-pass',
  )
  assert(
    ctx.filters.filter((f) => f.type === 'highpass').length === 1,
    'exactly one high-pass stage (no leftover drone/noise filters)',
  )
  assert(
    transition.gain.baseValue === 0,
    'the transition stage starts at 0 — every playback begins with a fade-in',
  )
  engine.dispose()
}

// (14) exact-zero gating and envelope completion (structural)
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(1.0)
  const ctx = rig.contexts[0]
  const { voiceGains } = chainStages(ctx)
  let gated = 0
  let exactValues = true
  let beginsAtZero = true
  let endsAtZero = true
  for (const voice of voiceGains) {
    const events = voice.gain.events
    if (events.length === 0) continue
    gated += 1
    for (let i = 0; i < events.length; i += 1) {
      const e = events[i]
      if (!(e.value === 0 || e.value >= 0.01)) exactValues = false
      if (e.type === 'ramp' && e.value > 0) {
        const prev = events[i - 1]
        if (!prev || prev.value !== 0) beginsAtZero = false
      }
    }
    if (events[events.length - 1].value !== 0) endsAtZero = false
  }
  assert(gated > 0, 'note events actually gate the voices')
  assert(exactValues, 'every gated value is exactly 0 or ≥ 0.01 (no 0.0001 leaks)')
  assert(beginsAtZero, 'every envelope begins at exactly 0')
  assert(endsAtZero, 'every envelope ends at exactly 0')
  engine.dispose()
}

// (15) offline render: a silent scene is EXACT digital silence (< −70 dBFS)
{
  const { engine, rig } = createRig({ onScheduleStep: () => null })
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(2.0)
  const ctx = rig.contexts[0]
  const samples = renderContext(ctx, 2.0)
  const floor = Math.pow(10, -70 / 20)
  const level = rms(samples)
  assert(
    maxAbs(samples, 0, samples.length) === 0,
    'a silent scene renders as exact digital silence after the startup fade',
  )
  assert(
    level < floor,
    `silent-scene RMS is below −70 dBFS (${level === 0 ? '0' : level.toExponential(2)})`,
  )
  assert(Math.abs(mean(samples)) < 1e-6, 'the silent render has no DC offset')
  engine.dispose()
}

// (16) offline render: active scene — audible events, no sustained 20–120 Hz
// component, no DC offset
{
  const { engine, rig } = createRig({
    onScheduleStep: () => ({
      notes: [
        { frequency: 55, gain: 0.8, band: 0, blend: 0, brightness: 0.5 },
        { frequency: 440, gain: 0.8, band: 1, blend: 0, brightness: 0.5 },
      ],
      activity: 0.8,
    }),
  })
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(1.0)
  const ctx = rig.contexts[0]
  const samples = renderContext(ctx, 1.0)
  const total = rms(samples)
  assert(total > 0.005, `active scene renders audible events (RMS ${total.toFixed(4)})`)
  const lowBand = lowpassCascade(samples, 120, 8000)
  const totalEnergy = samples.reduce((sum, v) => sum + v * v, 0)
  const lowEnergy = lowBand.reduce((sum, v) => sum + v * v, 0)
  const fraction = lowEnergy / Math.max(1e-12, totalEnergy)
  assert(
    fraction < 0.15,
    `the 20–120 Hz band stays under 15% of total energy even with a 55 Hz source (got ${(fraction * 100).toFixed(1)}%)`,
  )
  assert(
    Math.abs(mean(samples)) < 1e-3,
    'the active render has no DC offset',
  )
  engine.dispose()
}

// (17) offline render: matrix pulses are discrete gated events with exact
// silence between them
{
  const { engine, rig } = createRig({
    onScheduleStep: () => null,
    getTextures: () => ({
      pulses: { rateHz: 2, frequency: 2000, gain: 0.1, delaySeconds: 0.3, echoGain: 0.3 },
    }),
  })
  engine.setConfig(CONFIG)
  engine.play()
  rig.pump(2.0)
  const ctx = rig.contexts[0]
  const samples = renderContext(ctx, 2.0)
  const sr = 8000
  const idx = (t) => Math.floor(t * sr)
  let pulsesSound = true
  let gapsSilent = true
  // −70 dBFS peak floor: the master high-pass is an IIR, so its tail after a
  // gated event decays exponentially (~1e-11 here) rather than hitting exact
  // zero — the floor encodes "no audible output between events".
  const floor = Math.pow(10, -70 / 20)
  // Pulses start at the 0.1s sweep offset, every 0.5s; echo at +0.3s.
  for (let p = 0.1; p + 0.5 <= 2.0; p += 0.5) {
    if (maxAbs(samples, idx(p + 0.02), idx(p + 0.036)) < 0.003) pulsesSound = false
    if (maxAbs(samples, idx(p + 0.08), idx(p + 0.25)) >= floor) gapsSilent = false
    if (maxAbs(samples, idx(p + 0.38), idx(p + 0.5)) >= floor) gapsSilent = false
  }
  assert(pulsesSound, 'matrix pulses render as audible gated events')
  assert(gapsSilent, 'output between pulse and echo events stays below −70 dBFS')
  engine.dispose()
}

// (18) transition fades: every suspend boundary is faded; capture boundaries
// fade out and back in
{
  const { engine, rig } = createRig()
  engine.setConfig(CONFIG)
  engine.play()
  const ctx = rig.contexts[0]
  const { transition } = chainStages(ctx)
  const lastEvent = () => transition.gain.events[transition.gain.events.length - 1]
  assert(
    transition.gain.events[0].type === 'set' &&
      transition.gain.events[0].value === 0 &&
      lastEvent().type === 'ramp' &&
      lastEvent().value === 1,
    'Play fades in from exactly 0',
  )
  rig.pump(0.3)
  engine.stop()
  assert(
    lastEvent().type === 'ramp' && lastEvent().value === 0 && ctx.state === 'running',
    'Stop fades out before the context suspends',
  )
  rig.flushTimeouts()
  engine.play()
  assert(lastEvent().type === 'ramp' && lastEvent().value === 1, 'Play after Stop fades back in')
  rig.pump(0.2)
  engine.setHidden(true)
  assert(
    lastEvent().type === 'ramp' && lastEvent().value === 0 && ctx.state === 'running',
    'tab-hide fades out before the context suspends',
  )
  rig.flushTimeouts()
  engine.setHidden(false)
  assert(lastEvent().type === 'ramp' && lastEvent().value === 1, 'tab-show fades back in')
  // Capture transition: stop+play cycle fades out then back in.
  const session = engine.beginCapture()
  assert(session !== null && engine.getState() === 'playing', 'capture restarts playback')
  assert(
    lastEvent().type === 'ramp' && lastEvent().value === 1,
    'the capture transition ends faded back in (no click at the boundary)',
  )
  session.finish()
  rig.flushTimeouts()
  engine.dispose()
}

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll sonification audio-engine verifications passed.')
