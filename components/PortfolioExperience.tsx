'use client'

import SceneCanvas from './SceneCanvas'
import Intro from './Intro'
import PrimaryActions, { ExperienceKey, PRIMARY_ACTION_COUNT } from './PrimaryActions'
import TuningPanel from './tuning/TuningPanel'
import {
  APPROVED_SCENE_DEFAULTS,
  SceneConfig,
} from './tuning/tuningConfig'
import {
  evaluateIntroSequence,
  getPhaseStartTime,
  getPrimaryActionProgresses,
  getStaggeredItemProgress,
  getTotalDuration,
  IntroPhase,
  IntroSequenceSnapshot,
  IntroTiming,
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

  // Editable working copies of authored configuration.
  const [introTiming, setIntroTiming] = useState<IntroTiming>(() => ({
    ...portfolioIntroPreset.timing,
  }))
  const timingRef = useRef(introTiming)
  useEffect(() => {
    timingRef.current = introTiming
  }, [introTiming])

  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(() => ({
    ...APPROVED_SCENE_DEFAULTS,
  }))

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

  useEffect(() => {
    controllerRef.current.startTime = performance.now()

    let raf: number
    let lastDiagnosticTick = 0

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
      const timing = timingRef.current
      const { optionsTransitionDuration, optionStagger } = timing

      const itemProgresses = getPrimaryActionProgresses(
        sequence,
        PRIMARY_ACTION_COUNT,
        timing,
      )

      let timingFallbackActive = false
      if (!optionsReady) {
        const { effectiveStaggerMs, itemDurationMs } = getStaggeredItemProgress({
          phaseElapsedMs: sequence.phaseElapsedMs,
          groupDurationMs: optionsTransitionDuration,
          staggerMs: optionStagger,
          itemIndex: 0,
          itemCount: PRIMARY_ACTION_COUNT,
        })
        timingFallbackActive =
          effectiveStaggerMs !== optionStagger ||
          itemDurationMs !==
            Math.max(
              0,
              optionsTransitionDuration - optionStagger * (PRIMARY_ACTION_COUNT - 1),
            )
      }

      for (let i = 0; i < PRIMARY_ACTION_COUNT; i += 1) {
        const eased = optionsVisible ? easeOutCubic(itemProgresses[i]) : 0
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
      const timing = timingRef.current
      const next = evaluateIntroSequence(elapsed, timing)
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
        const totalDuration = getTotalDuration(timing)
        const { effectiveStaggerMs, itemDurationMs } = getStaggeredItemProgress({
          phaseElapsedMs: next.phaseElapsedMs,
          groupDurationMs: timing.optionsTransitionDuration,
          staggerMs: timing.optionStagger,
          itemIndex: 0,
          itemCount: PRIMARY_ACTION_COUNT,
        })
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
          effectiveOptionStaggerMs: effectiveStaggerMs,
          effectiveOptionItemDurationMs: itemDurationMs,
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
    const timing = timingRef.current
    sequenceRef.current = evaluateIntroSequence(0, timing)
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
    const timing = timingRef.current
    const targetTime = getPhaseStartTime(phase, timing)
    // Always pause after a jump so the phase can be inspected.
    ctrl.paused = true
    ctrl.pausedElapsed = targetTime
    ctrl.wasPlayingBeforeHidden = false
    const next = evaluateIntroSequence(targetTime, timing)
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
    if (actionsNode) {
      const itemProgresses = getPrimaryActionProgresses(
        next,
        PRIMARY_ACTION_COUNT,
        timing,
      )
      for (let i = 0; i < PRIMARY_ACTION_COUNT; i += 1) {
        actionsNode.style.setProperty(
          `--option-progress-${i}`,
          String(easeOutCubic(next.optionsVisible ? itemProgresses[i] : 0)),
        )
      }
      const groupHidden = !next.optionsVisible || itemProgresses.every((p) => p <= 0)
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
      optionItemProgress: getPrimaryActionProgresses(
        next,
        PRIMARY_ACTION_COUNT,
        timing,
      ),
      actionsInert: !next.optionsReady,
    }))
  }

  const handleSpeedChange = (value: number) => {
    // Preserve elapsed time across rate changes by adjusting the start-time baseline.
    const ctrl = controllerRef.current
    if (!ctrl.paused) {
      ctrl.pausedElapsed += (performance.now() - ctrl.startTime) * ctrl.speed
      ctrl.startTime = performance.now()
    }
    ctrl.speed = value
    setDiagnostics((prev) => ({ ...prev, speed: value }))
  }

  const handleTimingChange = (key: keyof IntroTiming, value: number) => {
    setIntroTiming((prev) => ({ ...prev, [key]: value }))
  }

  const resetIntroTiming = () => {
    setIntroTiming({ ...portfolioIntroPreset.timing })
  }

  const handleSceneConfigChange = (key: keyof SceneConfig, value: number) => {
    setSceneConfig((prev) => ({ ...prev, [key]: value }))
  }

  const resetSceneConfig = () => {
    setSceneConfig({ ...APPROVED_SCENE_DEFAULTS })
  }

  return (
    <div className="portfolio-shell">
      <SceneCanvas
        tuningMode={tuningMode}
        sequenceDiagnostics={diagnostics}
        mouseR={sceneConfig.mouseR}
        particleRepel={sceneConfig.particleRepel}
        weatherRepelMult={sceneConfig.weatherRepelMult}
      />
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
        <TuningPanel
          introTiming={introTiming}
          onIntroTimingChange={handleTimingChange}
          onResetIntroTiming={resetIntroTiming}
          speed={diagnostics.speed}
          onSpeedChange={handleSpeedChange}
          sceneConfig={sceneConfig}
          onSceneConfigChange={handleSceneConfigChange}
          onResetSceneConfig={resetSceneConfig}
          onPlay={play}
          onPause={pause}
          onReplay={replay}
          onPrevPhase={() => jumpToPhase(previousPhase(diagnostics.phase, timingRef.current))}
          onNextPhase={() => jumpToPhase(nextPhase(diagnostics.phase, timingRef.current))}
          totalDurationMs={getTotalDuration(introTiming)}
          effectiveOptionStaggerMs={diagnostics.effectiveOptionStaggerMs}
          effectiveOptionItemDurationMs={diagnostics.effectiveOptionItemDurationMs}
          timingFallbackActive={diagnostics.timingFallbackActive}
        />
      )}
    </div>
  )
}
