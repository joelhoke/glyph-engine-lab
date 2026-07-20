'use client'

import SceneCanvas from './SceneCanvas'
import Intro from './Intro'
import PrimaryActions, { ExperienceKey, PRIMARY_ACTION_COUNT } from './PrimaryActions'
import {
  evaluateIntroSequence,
  getPhaseStartTime,
  getPrimaryActionProgresses,
  getStaggeredItemProgress,
  getTotalDuration,
  IntroPhase,
  IntroSequenceSnapshot,
  nextPhase,
  portfolioIntroPreset,
  previousPhase,
} from '../engine/introSequence'
import { useEffect, useRef, useState } from 'react'

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const ACTION_TRANSLATE_PX = 16

const isTuningMode = () => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('debug') === 'true'
}

type SequenceDiagnostics = {
  phase: IntroPhase
  elapsedMs: number
  phaseProgress: number
  overallProgress: number
  taglineProgress: number
  taglineVisible: boolean
  taglineMounted: boolean
  optionsProgress: number
  optionsVisible: boolean
  optionsReady: boolean
  optionsMounted: boolean
  optionItemProgress: number[]
  effectiveOptionStaggerMs: number
  effectiveOptionItemDurationMs: number
  timingFallbackActive: boolean
  actionsInert: boolean
  speed: number
  documentHidden: boolean
}

type SequenceController = {
  startTime: number
  pausedElapsed: number
  paused: boolean
  speed: number
  wasPlayingBeforeHidden: boolean
}

export default function PortfolioExperience() {
  const [selected, setSelected] = useState<ExperienceKey | null>(null)
  const [tuningMode, setTuningMode] = useState(false)

  useEffect(() => {
    setTuningMode(isTuningMode())
  }, [])

  // Animation-facing sequence state: updated every RAF tick for smooth progress.
  const sequenceRef = useRef<IntroSequenceSnapshot>(
    evaluateIntroSequence(0, portfolioIntroPreset.timing),
  )

  // Direct DOM refs for full-rate visual updates (not throttled diagnostics).
  const taglineRef = useRef<HTMLElement | null>(null)
  const actionsRef = useRef<HTMLDivElement | null>(null)

  // Throttled diagnostic state: drives text readouts only.
  const [diagnostics, setDiagnostics] = useState<SequenceDiagnostics>({
    phase: 'logo-forming',
    elapsedMs: 0,
    phaseProgress: 0,
    overallProgress: 0,
    taglineProgress: 0,
    taglineVisible: false,
    taglineMounted: true,
    optionsProgress: 0,
    optionsVisible: false,
    optionsReady: false,
    optionsMounted: true,
    optionItemProgress: Array(PRIMARY_ACTION_COUNT).fill(0),
    effectiveOptionStaggerMs: portfolioIntroPreset.timing.optionStagger,
    effectiveOptionItemDurationMs: 0,
    timingFallbackActive: false,
    actionsInert: true,
    speed: 1,
    documentHidden: false,
  })

  const controllerRef = useRef<SequenceController>({
    startTime: 0,
    pausedElapsed: 0,
    paused: false,
    speed: 1,
    wasPlayingBeforeHidden: false,
  })

  // Playback-rate input draft state.
  const [speedDraft, setSpeedDraft] = useState('1')

  useEffect(() => {
    controllerRef.current.startTime = performance.now()

    let raf: number
    let lastDiagnosticTick = 0
    const totalDuration = getTotalDuration(portfolioIntroPreset.timing)

    const updateTaglineVisuals = (sequence: IntroSequenceSnapshot) => {
      const node = taglineRef.current
      if (!node) return

      const taglineProgress = sequence.taglineVisible ? sequence.taglineProgress : 0
      const eased = easeOutCubic(taglineProgress)
      node.style.setProperty('--tagline-progress', String(eased))

      const visuallyHidden = !sequence.taglineVisible || taglineProgress <= 0
      node.classList.toggle('tagline-hidden', visuallyHidden)
      node.setAttribute('aria-hidden', String(visuallyHidden))
    }

    const updateActionsVisuals = (sequence: IntroSequenceSnapshot) => {
      const node = actionsRef.current
      if (!node) return

      const optionsVisible = sequence.optionsVisible
      const optionsReady = sequence.optionsReady
      const { optionsTransitionDuration, optionStagger } = portfolioIntroPreset.timing

      const itemProgresses = getPrimaryActionProgresses(
        sequence,
        PRIMARY_ACTION_COUNT,
        portfolioIntroPreset.timing,
      )

      const { effectiveStaggerMs, itemDurationMs } = getStaggeredItemProgress({
        phaseElapsedMs: sequence.phaseElapsedMs,
        groupDurationMs: optionsTransitionDuration,
        staggerMs: optionStagger,
        itemIndex: 0,
        itemCount: PRIMARY_ACTION_COUNT,
      })
      const timingFallbackActive =
        effectiveStaggerMs !== optionStagger ||
        itemDurationMs !==
          Math.max(
            0,
            optionsTransitionDuration - optionStagger * (PRIMARY_ACTION_COUNT - 1),
          )

      for (let i = 0; i < PRIMARY_ACTION_COUNT; i += 1) {
        const progress = itemProgresses[i] ?? 0
        const eased = optionsVisible ? easeOutCubic(progress) : 0
        node.style.setProperty(`--option-progress-${i}`, String(eased))
      }

      const groupHidden = !optionsVisible || itemProgresses.every((p) => p <= 0)
      node.classList.toggle('options-hidden', groupHidden)
      node.classList.toggle('options-inert', !optionsReady)
      node.setAttribute('aria-hidden', String(!optionsVisible))
      node.toggleAttribute('inert', !optionsReady)

      return { itemProgresses, timingFallbackActive }
    }

    const tick = (now: number) => {
      const ctrl = controllerRef.current
      const elapsed = ctrl.paused
        ? ctrl.pausedElapsed
        : ctrl.pausedElapsed + (now - ctrl.startTime) * ctrl.speed
      const next = evaluateIntroSequence(elapsed, portfolioIntroPreset.timing)
      sequenceRef.current = next

      // Full-rate visual update path: apply directly to the DOM without React re-render.
      updateTaglineVisuals(next)
      const actionMeta = updateActionsVisuals(next)

      // Throttle diagnostic React state updates to ~10fps.
      if (now - lastDiagnosticTick > 100) {
        const taglineProgress = next.taglineVisible ? next.taglineProgress : 0
        const optionsProgress = next.optionsVisible ? next.optionsProgress : 0
        const { itemProgresses, timingFallbackActive } = actionMeta ?? {
          itemProgresses: Array(PRIMARY_ACTION_COUNT).fill(0),
          timingFallbackActive: false,
        }
        setDiagnostics((prev) => ({
          ...prev,
          phase: next.phase,
          elapsedMs: next.elapsedMs,
          phaseProgress: next.phase === 'complete' ? 1 : next.phaseProgress,
          overallProgress: clamp(next.elapsedMs / totalDuration, 0, 1),
          taglineProgress,
          taglineVisible: next.taglineVisible,
          taglineMounted: !!taglineRef.current,
          optionsProgress,
          optionsVisible: next.optionsVisible,
          optionsReady: next.optionsReady,
          optionsMounted: !!actionsRef.current,
          optionItemProgress: itemProgresses,
          effectiveOptionStaggerMs: portfolioIntroPreset.timing.optionStagger,
          effectiveOptionItemDurationMs: Math.max(
            0,
            portfolioIntroPreset.timing.optionsTransitionDuration -
              portfolioIntroPreset.timing.optionStagger * (PRIMARY_ACTION_COUNT - 1),
          ),
          timingFallbackActive,
          actionsInert: !next.optionsReady,
          speed: ctrl.speed,
        }))
        lastDiagnosticTick = now
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Freeze sequence while the tab is hidden to avoid large deltas.
  useEffect(() => {
    const handleVisibility = () => {
      const ctrl = controllerRef.current
      const hidden = document.hidden

      if (hidden) {
        if (!ctrl.paused) {
          ctrl.wasPlayingBeforeHidden = true
          ctrl.pausedElapsed += (performance.now() - ctrl.startTime) * ctrl.speed
          ctrl.paused = true
        }
      } else {
        if (ctrl.wasPlayingBeforeHidden) {
          ctrl.startTime = performance.now()
          ctrl.paused = false
          ctrl.wasPlayingBeforeHidden = false
        }
      }

      setDiagnostics((prev) => ({ ...prev, documentHidden: hidden }))
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const handleAction = (key: ExperienceKey) => {
    setSelected(key)
  }

  const play = () => {
    const ctrl = controllerRef.current
    if (ctrl.paused) {
      ctrl.paused = false
      ctrl.startTime = performance.now()
    }
  }

  const pause = () => {
    const ctrl = controllerRef.current
    if (!ctrl.paused) {
      ctrl.paused = true
      ctrl.pausedElapsed += performance.now() - ctrl.startTime
    }
  }

  const resetActionsVisuals = () => {
    const node = actionsRef.current
    if (!node) return
    for (let i = 0; i < PRIMARY_ACTION_COUNT; i += 1) {
      node.style.setProperty(`--option-progress-${i}`, '0')
    }
    node.classList.add('options-hidden')
    node.classList.add('options-inert')
    node.setAttribute('aria-hidden', 'true')
    node.setAttribute('inert', '')
  }

  const replay = () => {
    const ctrl = controllerRef.current
    ctrl.paused = false
    ctrl.startTime = performance.now()
    ctrl.pausedElapsed = 0
    sequenceRef.current = evaluateIntroSequence(0, portfolioIntroPreset.timing)
    // Force immediate visual reset so the tagline hides before the next RAF.
    const node = taglineRef.current
    if (node) {
      node.style.setProperty('--tagline-progress', '0')
      node.classList.add('tagline-hidden')
      node.setAttribute('aria-hidden', 'true')
    }
    resetActionsVisuals()
    setDiagnostics((prev) => ({
      ...prev,
      phase: 'logo-forming',
      elapsedMs: 0,
      phaseProgress: 0,
      overallProgress: 0,
      taglineProgress: 0,
      taglineVisible: false,
      optionsProgress: 0,
      optionsVisible: false,
      optionsReady: false,
      optionItemProgress: Array(PRIMARY_ACTION_COUNT).fill(0),
      actionsInert: true,
    }))
  }

  const jumpToPhase = (phase: IntroPhase) => {
    const ctrl = controllerRef.current
    const targetTime = getPhaseStartTime(phase, portfolioIntroPreset.timing)
    // Always pause after a jump so the phase can be inspected.
    ctrl.paused = true
    ctrl.pausedElapsed = targetTime
    ctrl.wasPlayingBeforeHidden = false
    const next = evaluateIntroSequence(targetTime, portfolioIntroPreset.timing)
    sequenceRef.current = next

    const taglineProgress = next.taglineVisible ? next.taglineProgress : 0

    const taglineNode = taglineRef.current
    if (taglineNode) {
      taglineNode.style.setProperty('--tagline-progress', String(easeOutCubic(taglineProgress)))
      const visuallyHidden = !next.taglineVisible || taglineProgress <= 0
      taglineNode.classList.toggle('tagline-hidden', visuallyHidden)
      taglineNode.setAttribute('aria-hidden', String(visuallyHidden))
    }

    const actionsNode = actionsRef.current
    const optionItemProgress = getPrimaryActionProgresses(
      next,
      PRIMARY_ACTION_COUNT,
      portfolioIntroPreset.timing,
    )

    if (actionsNode) {
      for (let i = 0; i < PRIMARY_ACTION_COUNT; i += 1) {
        const progress = optionItemProgress[i] ?? 0
        actionsNode.style.setProperty(`--option-progress-${i}`, String(easeOutCubic(next.optionsVisible ? progress : 0)))
      }
      const groupHidden = !next.optionsVisible || optionItemProgress.every((p) => p <= 0)
      actionsNode.classList.toggle('options-hidden', groupHidden)
      actionsNode.classList.toggle('options-inert', !next.optionsReady)
      actionsNode.setAttribute('aria-hidden', String(!next.optionsVisible))
      actionsNode.toggleAttribute('inert', !next.optionsReady)
    }

    setDiagnostics((prev) => ({
      ...prev,
      phase,
      elapsedMs: targetTime,
      phaseProgress: phase === 'complete' ? 1 : next.phaseProgress,
      taglineProgress,
      taglineVisible: next.taglineVisible,
      optionsProgress: next.optionsVisible ? next.optionsProgress : 0,
      optionsVisible: next.optionsVisible,
      optionsReady: next.optionsReady,
      optionItemProgress,
      actionsInert: !next.optionsReady,
    }))
  }

  const commitSpeed = (raw: string) => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0 || Number.isNaN(parsed)) {
      setSpeedDraft(String(controllerRef.current.speed))
      return
    }
    // Preserve elapsed time across rate changes by adjusting the start-time baseline.
    const ctrl = controllerRef.current
    if (!ctrl.paused) {
      ctrl.pausedElapsed += (performance.now() - ctrl.startTime) * ctrl.speed
      ctrl.startTime = performance.now()
    }
    ctrl.speed = parsed
    setSpeedDraft(String(parsed))
    setDiagnostics((prev) => ({ ...prev, speed: parsed }))
  }

  return (
    <div className="portfolio-shell">
      <SceneCanvas tuningMode={tuningMode} sequenceDiagnostics={diagnostics} />
      <div className="foreground-layer" aria-live="polite">
        <div className="foreground-content">
          <Intro taglineRef={taglineRef} />
          <PrimaryActions
            selected={selected}
            onSelect={handleAction}
            groupRef={actionsRef}
          />
        </div>
      </div>
      {tuningMode && (
        <div className="sequence-controls" aria-label="Sequence playback controls">
          <div>phase: {diagnostics.phase}</div>
          <div>elapsed: {Math.round(diagnostics.elapsedMs)}ms</div>
          <div>phase progress: {diagnostics.phaseProgress.toFixed(2)}</div>
          <div>overall progress: {diagnostics.overallProgress.toFixed(2)}</div>
          <div>tagline progress: {diagnostics.taglineProgress.toFixed(2)}</div>
          <div>tagline visible: {diagnostics.taglineVisible ? 'yes' : 'no'}</div>
          <div>tagline mounted: {diagnostics.taglineMounted ? 'yes' : 'no'}</div>
          <div>options progress: {diagnostics.optionsProgress.toFixed(2)}</div>
          <div>options visible: {diagnostics.optionsVisible ? 'yes' : 'no'}</div>
          <div>options ready: {diagnostics.optionsReady ? 'yes' : 'no'}</div>
          <div>actions mounted: {diagnostics.optionsMounted ? 'yes' : 'no'}</div>
          <div>actions inert: {diagnostics.actionsInert ? 'yes' : 'no'}</div>
          <div>effective option stagger: {Math.round(diagnostics.effectiveOptionStaggerMs)}ms</div>
          <div>effective option item duration: {Math.round(diagnostics.effectiveOptionItemDurationMs)}ms</div>
          <div>timing fallback: {diagnostics.timingFallbackActive ? 'yes' : 'no'}</div>
          {diagnostics.optionItemProgress.map((p, i) => (
            <div key={i}>option {i} progress: {p.toFixed(2)}</div>
          ))}
          <div>speed: {diagnostics.speed.toFixed(2)}x</div>
          <div>hidden: {diagnostics.documentHidden ? 'yes' : 'no'}</div>
          <label className="rate-control">
            rate
            <input
              type="number"
              value={speedDraft}
              min={0.01}
              step={0.1}
              onChange={(event) => setSpeedDraft(event.target.value)}
              onBlur={(event) => commitSpeed(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitSpeed((event.target as HTMLInputElement).value)
                }
              }}
            />
          </label>
          <div className="sequence-buttons">
            <button type="button" onClick={play}>Play</button>
            <button type="button" onClick={pause}>Pause</button>
            <button type="button" onClick={replay}>Replay</button>
            <button
              type="button"
              onClick={() => jumpToPhase(previousPhase(diagnostics.phase, portfolioIntroPreset.timing))}
            >
              Prev phase
            </button>
            <button
              type="button"
              onClick={() => jumpToPhase(nextPhase(diagnostics.phase, portfolioIntroPreset.timing))}
            >
              Next phase
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
