'use client'

import SceneCanvas, { SceneCanvasHandle } from './SceneCanvas'
import CanvasFallback from './CanvasFallback'
import Intro from './Intro'
import ExperienceNav from './ExperienceNav'
import ExperienceTransition, { useExperienceTransition } from './ExperienceTransition'
import WorkExperience from './work/WorkExperience'
import CollaborateExperience from './collaborate/CollaborateExperience'
import VibeExperience, { VibeSurfaceStatus } from './vibe/VibeExperience'
import PrimaryActions, { ExperienceKey, PRIMARY_ACTION_COUNT } from './PrimaryActions'
import TuningPanel from './tuning/TuningPanel'
import AnalyticsConsent from './AnalyticsConsent'
import PlaygroundControlDock from './PlaygroundControlDock'
import { ExperienceMode, ExperienceSceneKey } from '../engine/types'
import { EXPERIENCE_SCENES, LANDING_SOURCE_URL } from '../engine/sceneConfig'
import { getWorkStory, resolveWorkScene, WORK_INTRO, WORK_STORIES } from '../content/work'
import {
  COLLABORATE_CONTACT,
  COLLABORATE_ENERGIZING_STATEMENT,
  COLLABORATE_HEADLINE,
  CONVERSATION_STARTERS,
  getCollaborateStarter,
  resolveCollaborateScene,
} from '../content/collaborate'
import { formatExperienceHash, parseExperienceHash } from '../engine/experienceHash'
import {
  createDefaultDiagnosticsSnapshot,
  SceneDiagnosticsSnapshot,
} from '../engine/diagnostics'
import { QualityTier } from '../engine/qualityTiers'
import { SceneSourceSelection } from '../engine/animatedSource'
import {
  captureSeasonalAtmosphereInput,
  resolveSeasonalAtmosphere,
} from '../engine/seasonalAtmosphere'
import { AmbientConfig } from '../engine/ambientConfig'
import { AnalyticsClient, AnalyticsEvent } from '../engine/analytics'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  PlaygroundConfig,
} from '../engine/playgroundConfig'
import {
  getFriendlyUploadError,
  getVibePreset,
  VIBE_DOCK_INVITATION,
  VIBE_INVITATION,
  VIBE_PRESETS,
  VIBE_PRIVACY_NOTE,
  VIBE_UPLOAD_PENDING_LABEL,
} from '../content/vibe'
import {
  DEFAULT_UPLOADED_SVG_FILENAME,
  readUploadedSvg,
} from '../engine/svgUpload'
import { RASTER_MIME_TYPES, readUploadedRaster } from '../engine/rasterUpload'
import { UNSUPPORTED_SOURCE_TYPE_ERROR, VisualSourceKind } from '../engine/visualSource'
import {
  PAINT_BRUSH_DIAMETER_DEFAULT,
  PAINT_BRUSH_DIAMETER_MAX,
  PAINT_BRUSH_DIAMETER_MIN,
  PaintStatus,
  PaintToolConfig,
} from '../engine/paint'
import PlaygroundControls from './PlaygroundControls'
import {
  APPROVED_SCENE_DEFAULTS,
  APPROVED_SOURCE_LAYOUT_DEFAULTS,
  SceneConfig,
} from './tuning/tuningConfig'
import { SourceLayoutConfig } from '../engine/svgTargetSource'
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
import { useEffect, useId, useMemo, useRef, useState } from 'react'

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const ACTION_TRANSLATE_PX = 16

/** Deep-enough copy for playground configs: the palette array must not be
 *  shared between state and the authored defaults. */
function clonePlaygroundConfig(config: PlaygroundConfig): PlaygroundConfig {
  return { ...config, glyphPalette: [...config.glyphPalette] }
}

const isTuningMode = () => {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return false
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
  targetCount: number
}

type SequenceController = {
  startTime: number
  pausedElapsed: number
  paused: boolean
  speed: number
  wasPlayingBeforeHidden: boolean
}

const BASE_DOCUMENT_TITLE = 'joel hoke design'

/** The visitor-supplied source for the vibe field: an uploaded SVG (data URL),
 *  an uploaded raster image (object URL), or a preset's built-in SVG. */
type UploadedSourceState = {
  kind: VisualSourceKind
  url: string
  filename: string
}

export default function PortfolioExperience() {
  // Shell state: intro → work ↔ vibe ↔ collaborate. Starts at intro unless a
  // deep-link hash resolves to a mode on mount (handled below).
  const [experience, setExperience] = useState<ExperienceMode>('intro')
  const [selected, setSelected] = useState<ExperienceKey | null>(null)
  const [tuningMode, setTuningMode] = useState(false)
  const [qualityTierOverride, setQualityTierOverride] = useState<QualityTier | null>(null)
  const { displayed, phase: transitionPhase } = useExperienceTransition(experience)
  const modeHeadingRef = useRef<HTMLHeadingElement | null>(null)

  // Active work case study. Controlled here (not inside WorkExperience) so the
  // same index drives both the foreground story and the canvas descriptor.
  const [workStoryIndex, setWorkStoryIndex] = useState(0)

  // Resolved work scene: the work baseline merged with the active story's
  // source, palette/background, and behavior overrides.
  const workDescriptor = useMemo(
    () => resolveWorkScene(EXPERIENCE_SCENES.work, getWorkStory(workStoryIndex)),
    [workStoryIndex],
  )

  // Selected conversation starter. Controlled here (not inside
  // CollaborateExperience) so the same state also drives the canvas descriptor.
  const [collaborateStarterId, setCollaborateStarterId] = useState<string | null>(null)

  // Sealed analytics client (Stage 5): no-op until the visitor opts in via
  // the consent UI; every track call is silent on failure.
  const analyticsClientRef = useRef<AnalyticsClient | null>(null)
  const trackEvent = (event: AnalyticsEvent) => {
    try {
      analyticsClientRef.current?.track(event)
    } catch {
      /* silent */
    }
  }

  // Consented public events: experience and story views.
  useEffect(() => {
    trackEvent({ name: 'experience_view', params: { experience: displayed } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed])
  useEffect(() => {
    if (displayed !== 'work') return
    trackEvent({ name: 'story_view', params: { story_id: getWorkStory(workStoryIndex).id } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workStoryIndex, displayed])

  // Resolved collaborate scene: the collaborate baseline merged with the
  // selected starter's glyph phrase (baseline kept when nothing is selected).
  const collaborateDescriptor = useMemo(
    () =>
      resolveCollaborateScene(
        EXPERIENCE_SCENES.collaborate,
        getCollaborateStarter(collaborateStarterId),
      ),
    [collaborateStarterId],
  )

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

  const [sourceLayout, setSourceLayout] = useState<SourceLayoutConfig>(() => ({
    ...APPROVED_SOURCE_LAYOUT_DEFAULTS,
  }))

  // Vibe's editable composition. Seeded from the generic playground defaults
  // so the intro keeps its established look; on entering vibe it adopts the
  // curated default composition from the scene descriptor until the visitor
  // changes anything themselves (tracked by vibeTouchedRef).
  const [playgroundConfig, setPlaygroundConfig] = useState<PlaygroundConfig>(() =>
    clonePlaygroundConfig(APPROVED_PLAYGROUND_DEFAULTS),
  )
  const vibeTouchedRef = useRef(false)

  // Ambient effect changes (Vibe Off/Weather/Matrix selector).
  const ambientMode = playgroundConfig.ambient.mode
  const prevAmbientModeRef = useRef(ambientMode)
  useEffect(() => {
    if (prevAmbientModeRef.current !== ambientMode) {
      prevAmbientModeRef.current = ambientMode
      trackEvent({ name: 'effect_change', params: { mode: ambientMode } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambientMode])

  const sceneCanvasRef = useRef<SceneCanvasHandle>(null)

  const [uploadedSource, setUploadedSource] = useState<UploadedSourceState | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadPending, setUploadPending] = useState(false)

  // Vibe shape source: the animated Black hole replaces the image field
  // (default mark or upload) until the visitor switches back. The upload
  // itself is preserved — toggling back to 'image' restores it.
  const [vibeBlackHole, setVibeBlackHole] = useState(false)

  // Vibe presentation (Stage 3): the invitation card and the control dock
  // are mutually exclusive, and the open state lives here so the card can
  // unmount entirely and restore focus to its CTA when the dock closes.
  const [vibeControlsOpen, setVibeControlsOpen] = useState(false)
  const vibeCtaRef = useRef<HTMLButtonElement | null>(null)
  const vibeControlsWasOpenRef = useRef(false)
  const vibeDockId = useId().replace(/:/g, '-')

  // Landing seasonal atmosphere (Stage 3): computed once on mount from the
  // local date/locale, adopted by the completed-intro scene and faded in
  // (intensity ramp) at the options-reveal moment.
  const [landingAmbient, setLandingAmbient] = useState<AmbientConfig | null>(null)
  const landingAtmosphereRef = useRef<AmbientConfig | null>(null)
  const landingAtmosphereStartedRef = useRef(false)

  // Vibe-only paint tool state (session-only; never URL-persisted) and the
  // live overlay status reported by the canvas.
  const [paintTool, setPaintTool] = useState<PaintToolConfig>({
    enabled: false,
    tool: 'paint',
    glyphColor: '#8abaff',
    backgroundColor: 'none',
    brushDiameter: PAINT_BRUSH_DIAMETER_DEFAULT,
  })
  const [paintStatus, setPaintStatus] = useState<PaintStatus | null>(null)

  // Accessible confirmation for paint-destructive actions (upload, preset,
  // parametric enter/leave, variant change, leaving vibe). Holds the action
  // to run when the visitor confirms discarding their paint.
  const [pendingPaintAction, setPendingPaintAction] = useState<(() => void) | null>(null)
  const paintConfirmCancelRef = useRef<HTMLButtonElement | null>(null)
  const paintConfirmRestoreFocusRef = useRef<Element | null>(null)

  const hasPaint = () => {
    const status = sceneCanvasRef.current?.getPaintStatus()
    return !!status && status.strokeCount > 0
  }

  const withPaintConfirmation = (action: () => void) => {
    if (hasPaint()) {
      paintConfirmRestoreFocusRef.current = document.activeElement
      setPendingPaintAction(() => action)
    } else {
      action()
    }
  }

  const cancelPendingPaintAction = () => {
    setPendingPaintAction(null)
    const restore = paintConfirmRestoreFocusRef.current
    if (restore instanceof HTMLElement) restore.focus()
  }

  const confirmPendingPaintAction = () => {
    const action = pendingPaintAction
    setPendingPaintAction(null)
    action?.()
    const restore = paintConfirmRestoreFocusRef.current
    if (restore instanceof HTMLElement) restore.focus()
  }

  useEffect(() => {
    if (pendingPaintAction) {
      paintConfirmCancelRef.current?.focus()
    }
  }, [pendingPaintAction])

  // Photoshop-style brush sizing while painting: [ and ] adjust the brush by
  // 4 px (16 px with Shift), clamped to the brush bounds. Ignored while the
  // visitor is typing in a form field.
  useEffect(() => {
    const handleBrushKeys = (event: KeyboardEvent) => {
      if (displayed !== 'vibe' || !paintTool.enabled) return
      const tag = (event.target as HTMLElement | null)?.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (event.key !== '[' && event.key !== ']') return
      event.preventDefault()
      const delta = (event.key === ']' ? 1 : -1) * (event.shiftKey ? 16 : 4)
      setPaintTool((prev) => ({
        ...prev,
        brushDiameter: Math.min(
          PAINT_BRUSH_DIAMETER_MAX,
          Math.max(PAINT_BRUSH_DIAMETER_MIN, prev.brushDiameter + delta),
        ),
      }))
    }
    window.addEventListener('keydown', handleBrushKeys)
    return () => window.removeEventListener('keydown', handleBrushKeys)
  }, [displayed, paintTool.enabled])

  // Object-URL lifecycle: raster uploads hold a blob: URL that must be revoked
  // when the source is replaced, cleared, or the component unmounts. SVG data
  // URLs and built-in paths need nothing.
  const uploadedSourceRef = useRef<UploadedSourceState | null>(null)
  useEffect(() => {
    uploadedSourceRef.current = uploadedSource
  }, [uploadedSource])
  useEffect(() => {
    return () => {
      const current = uploadedSourceRef.current
      if (current && current.url.startsWith('blob:')) {
        URL.revokeObjectURL(current.url)
      }
    }
  }, [])

  const revokeUploadedSourceUrl = () => {
    const current = uploadedSourceRef.current
    if (current && current.url.startsWith('blob:')) {
      URL.revokeObjectURL(current.url)
    }
  }

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
    targetCount: 0,
  })

  // Latest engine-side scene diagnostics snapshot (throttled push from the
  // canvas while the debug UI is active); feeds the tuning panel readouts.
  const [sceneDiagnostics, setSceneDiagnostics] = useState<SceneDiagnosticsSnapshot>(() =>
    createDefaultDiagnosticsSnapshot(),
  )

  const controllerRef = useRef<SequenceController>({
    startTime: 0,
    pausedElapsed: 0,
    paused: false,
    speed: 1,
    wasPlayingBeforeHidden: false,
  })

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const ctrl = controllerRef.current

    ctrl.startTime = performance.now()
    if (reducedMotionQuery.matches) {
      ctrl.pausedElapsed = getTotalDuration(timingRef.current)
      ctrl.paused = true
    }

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return
      const controller = controllerRef.current
      controller.pausedElapsed = getTotalDuration(timingRef.current)
      controller.paused = true
    }

    reducedMotionQuery.addEventListener('change', handleReducedMotionChange)

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
          // targetCount is reported by SceneCanvas diagnostics and should not be overwritten here.
        }))
        lastDiagnosticTick = now
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange)
    }
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

  const navigateTo = (key: ExperienceSceneKey) => {
    const doNavigate = () => {
      setSelected(key)
      setExperience(key)
      if (typeof window !== 'undefined' && window.location.hash !== formatExperienceHash(key)) {
        // pushState (not location.hash assignment) so no hashchange event fires;
        // the listener below owns back/forward navigation only. Every state
        // update simply replaces the previous one, so rapid navigation always
        // resolves to the last selected mode.
        window.history.pushState(null, '', formatExperienceHash(key))
      }
    }
    // Leaving vibe with paint on the field asks before discarding it.
    if (displayed === 'vibe' && key !== 'vibe') {
      withPaintConfirmation(() => {
        sceneCanvasRef.current?.clearPaint()
        doNavigate()
      })
      return
    }
    doNavigate()
  }

  // Deep links: resolve the initial hash (skipping the intro) and keep the
  // mode in sync with back/forward navigation.
  useEffect(() => {
    const applyHash = () => {
      const mode = parseExperienceHash(window.location.hash)
      if (mode) {
        setSelected(mode)
        setExperience(mode)
      }
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  // Scene switch: adopt the active scene's behavior and source layout so the
  // canvas morphs to the new descriptor. The SceneCanvas instance itself
  // stays mounted — only its props change. In work mode the descriptor is the
  // active story's resolved scene, and in collaborate mode the selected
  // starter's resolved scene, so those changes re-run this adoption too.
  useEffect(() => {
    if (displayed === 'intro') return
    const scene =
      displayed === 'work'
        ? workDescriptor
        : displayed === 'collaborate'
          ? collaborateDescriptor
          : EXPERIENCE_SCENES[displayed]
    setSceneConfig({ ...scene.behavior })
    setSourceLayout({ ...scene.sourceLayout })
    // Vibe entry: adopt the curated default composition so the mode is
    // visually complete before the dock is opened — unless the visitor has
    // already made their own edits, which survive mode switches.
    if (displayed === 'vibe' && !vibeTouchedRef.current) {
      setPlaygroundConfig(clonePlaygroundConfig(scene.playground))
    }
  }, [displayed, workDescriptor, collaborateDescriptor])

  // Safety net: whenever the settled experience is not vibe, no paint may
  // remain on the field. navigateTo confirms-then-clears on the explicit path;
  // browser back/forward resolves through the hash listener and lands here.
  useEffect(() => {
    if (displayed !== 'vibe') {
      sceneCanvasRef.current?.clearPaint()
    }
  }, [displayed])

  // Focus management + titles: move focus to the mode heading and set a
  // meaningful document.title whenever the settled mode changes.
  useEffect(() => {
    if (displayed === 'intro') {
      document.title = BASE_DOCUMENT_TITLE
      return
    }
    const scene = EXPERIENCE_SCENES[displayed]
    document.title = `${BASE_DOCUMENT_TITLE} — ${scene.copy.documentTitle}`
    modeHeadingRef.current?.focus({ preventScroll: true })
  }, [displayed])

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

  const handleSourceLayoutChange = (key: keyof SourceLayoutConfig, value: number | string) => {
    setSourceLayout((prev: SourceLayoutConfig) => ({ ...prev, [key]: value }))
  }

  const resetSourceLayout = () => {
    setSourceLayout({ ...APPROVED_SOURCE_LAYOUT_DEFAULTS })
  }

  const handleCopyConfiguration = () => {
    const payload = {
      timing: { ...introTiming },
      scene: { ...sceneConfig },
      sourceLayout: { ...sourceLayout },
    }
    const json = JSON.stringify(payload, null, 2)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(json).catch(() => {})
    }
  }

  const handlePlaygroundConfigChange = (patch: Partial<PlaygroundConfig>) => {
    vibeTouchedRef.current = true
    // Parametric transitions (enter/leave) and variant swaps replace the
    // target field's identity, so they discard paint — with confirmation.
    if (patch.motion) {
      const prevMotion = playgroundConfig.motion
      const nextMotion = patch.motion
      const destructive =
        (prevMotion.mode !== nextMotion.mode &&
          (prevMotion.mode === 'parametric-creature' ||
            nextMotion.mode === 'parametric-creature')) ||
        (prevMotion.mode === 'parametric-creature' &&
          nextMotion.mode === 'parametric-creature' &&
          prevMotion.variant !== nextMotion.variant)
      if (destructive) {
        withPaintConfirmation(() => {
          sceneCanvasRef.current?.clearPaint()
          setPlaygroundConfig((prev) => ({ ...prev, ...patch }))
        })
        return
      }
    }
    setPlaygroundConfig((prev) => ({ ...prev, ...patch }))
  }

  // Reset restores EVERYTHING to the curated default composition: the full
  // editable config (text, palette, background, font, color mode, scale,
  // motion), the paint tool, and the source (any uploaded image is cleared
  // back to the built-in default). Full Reset is immediate — no confirmation.
  const handleResetPlaygroundConfig = () => {
    vibeTouchedRef.current = false
    setPlaygroundConfig(clonePlaygroundConfig(EXPERIENCE_SCENES.vibe.playground))
    sceneCanvasRef.current?.clearPaint()
    setPaintTool({
      enabled: false,
      tool: 'paint',
      glyphColor: '#8abaff',
      backgroundColor: 'none',
      brushDiameter: PAINT_BRUSH_DIAMETER_DEFAULT,
    })
    setVibeBlackHole(false)
    revokeUploadedSourceUrl()
    setUploadedSource(null)
    setUploadError(null)
  }

  // Shape source selection (image field vs. the animated Black hole). Both
  // directions are paint-destructive, so they reuse the existing confirmed
  // discard flow; the uploaded image itself survives the switch.
  const handleSelectSourceShape = (shape: 'image' | 'black-hole') => {
    const next = shape === 'black-hole'
    if (next === vibeBlackHole) return
    withPaintConfirmation(() => {
      sceneCanvasRef.current?.clearPaint()
      vibeTouchedRef.current = true
      setVibeBlackHole(next)
      setUploadError(null)
      trackEvent({ name: 'source_change', params: { source: next ? 'black-hole' : 'builtin' } })
    })
  }

  // Presets apply a complete authored composition. A preset with a sourceUrl
  // swaps the field's source to that built-in SVG; one without clears any
  // upload back to the default source. Paint is discarded (with confirmation).
  const handleApplyVibePreset = (id: string) => {
    const preset = getVibePreset(id)
    if (!preset) return
    withPaintConfirmation(() => {
      sceneCanvasRef.current?.clearPaint()
      vibeTouchedRef.current = true
      setPlaygroundConfig(clonePlaygroundConfig(preset.config))
      setUploadError(null)
      setVibeBlackHole(false)
      revokeUploadedSourceUrl()
      if (preset.sourceUrl) {
        setUploadedSource({ kind: 'svg', url: preset.sourceUrl, filename: `${preset.label} source` })
      } else {
        setUploadedSource(null)
      }
      trackEvent({ name: 'preset_change', params: { preset_id: preset.id } })
      trackEvent({ name: 'source_change', params: { source: preset.sourceUrl ? 'preset' : 'builtin' } })
    })
  }

  const handleUploadSource = async (file: File) => {
    withPaintConfirmation(() => {
      sceneCanvasRef.current?.clearPaint()
      void performUploadSource(file)
    })
  }

  const performUploadSource = async (file: File) => {
    vibeTouchedRef.current = true
    setVibeBlackHole(false)
    setUploadPending(true)
    setUploadError(null)

    let result:
      | { ok: true; kind: VisualSourceKind; url: string; filename: string }
      | { ok: false; error: string }
    if (file.type === 'image/svg+xml') {
      const svgResult = await readUploadedSvg(file)
      result = svgResult.ok
        ? { ok: true, kind: 'svg', url: svgResult.url, filename: svgResult.filename }
        : svgResult
    } else if ((RASTER_MIME_TYPES as readonly string[]).includes(file.type)) {
      result = await readUploadedRaster(file)
    } else {
      result = { ok: false, error: UNSUPPORTED_SOURCE_TYPE_ERROR }
    }

    if (result.ok) {
      revokeUploadedSourceUrl()
      setUploadedSource({ kind: result.kind, url: result.url, filename: result.filename })
      setUploadError(null)
      trackEvent({ name: 'upload_result', params: { mime_type: file.type || 'unknown', ok: true } })
      trackEvent({ name: 'source_change', params: { source: 'upload' } })
    } else {
      // Map the sanitizer's messages to friendly copy (content/vibe.ts).
      setUploadError(getFriendlyUploadError(result.error))
      trackEvent({ name: 'upload_result', params: { mime_type: file.type || 'unknown', ok: false } })
    }
    setUploadPending(false)
  }

  // Seasonal landing atmosphere: resolve once on mount (client-only — the
  // inputs are the local clock and Intl locale/timezone, both injected into
  // the pure resolver). Never live weather; see engine/seasonalAtmosphere.
  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions()
    landingAtmosphereRef.current = resolveSeasonalAtmosphere(
      captureSeasonalAtmosphereInput(new Date(), {
        locale: resolved.locale,
        timeZone: resolved.timeZone,
      }),
    )
  }, [])

  // Options-reveal moment: fade the atmosphere in by ramping its weather
  // intensity from zero to the resolved target. Non-structural knob edits,
  // so the ambient pool never rebuilds during the ramp; under reduced motion
  // each step just re-renders the static pose.
  useEffect(() => {
    const target = landingAtmosphereRef.current
    if (!diagnostics.optionsReady || !target || landingAtmosphereStartedRef.current) return
    landingAtmosphereStartedRef.current = true
    const finalIntensity = target.weather.intensity
    let step = 0
    const steps = 6
    const interval = window.setInterval(() => {
      step += 1
      const intensity = Math.round((finalIntensity * step) / steps)
      setLandingAmbient({
        ...target,
        weather: { ...target.weather, intensity },
      })
      if (step >= steps) window.clearInterval(interval)
    }, 200)
    return () => window.clearInterval(interval)
  }, [diagnostics.optionsReady])

  // Closing the dock (Hide or Escape) remounts the invitation card; return
  // keyboard focus to its "Make it yours" CTA.
  useEffect(() => {
    if (!vibeControlsOpen && vibeControlsWasOpenRef.current) {
      vibeCtaRef.current?.focus()
    }
    vibeControlsWasOpenRef.current = vibeControlsOpen
  }, [vibeControlsOpen])

  // Leaving vibe always settles back to the closed-card presentation.
  useEffect(() => {
    if (displayed !== 'vibe') setVibeControlsOpen(false)
  }, [displayed])

  // The scene's source selection: the landing samples the JH logotype
  // (LANDING_SOURCE_URL, falling back to the built-in monogram on decode
  // failure); work/collaborate sample their resolved static SVGs; vibe
  // samples the Black hole while it's selected, else the uploaded image,
  // else the built-in monogram.
  const sceneSource = useMemo<SceneSourceSelection>(() => {
    if (displayed === 'intro') {
      return { kind: 'static', url: LANDING_SOURCE_URL, sourceKind: 'svg' }
    }
    if (displayed === 'work') {
      return workDescriptor.sourceUrl
        ? { kind: 'static', url: workDescriptor.sourceUrl, sourceKind: 'svg' }
        : { kind: 'builtin' }
    }
    if (displayed === 'collaborate') {
      return collaborateDescriptor.sourceUrl
        ? { kind: 'static', url: collaborateDescriptor.sourceUrl, sourceKind: 'svg' }
        : { kind: 'builtin' }
    }
    if (vibeBlackHole) return { kind: 'animated', provider: 'black-hole' }
    if (uploadedSource) {
      return { kind: 'static', url: uploadedSource.url, sourceKind: uploadedSource.kind }
    }
    return { kind: 'builtin' }
  }, [displayed, workDescriptor, collaborateDescriptor, vibeBlackHole, uploadedSource])

  // The landing (completed intro) adopts the seasonal atmosphere; every
  // other mode keeps its own playground config untouched.
  const scenePlayground = useMemo<PlaygroundConfig>(() => {
    if (displayed === 'work') return workDescriptor.playground
    if (displayed === 'collaborate') return collaborateDescriptor.playground
    if (displayed === 'intro' && landingAmbient) {
      return { ...playgroundConfig, ambient: landingAmbient }
    }
    return playgroundConfig
  }, [displayed, workDescriptor, collaborateDescriptor, playgroundConfig, landingAmbient])

  // Vibe surface status: a subtle indicator for the upload lifecycle, kept
  // visible even if the visitor hides the control dock mid-processing.
  const vibeStatus: VibeSurfaceStatus | null = uploadPending
    ? { state: 'processing', message: VIBE_UPLOAD_PENDING_LABEL }
    : uploadError
      ? { state: 'error', message: uploadError }
      : null

  return (
    <div className="portfolio-shell">
      {/* Static branded layer behind the canvas: visible only while the
          canvas has not painted (no JS / no 2D context). */}
      <CanvasFallback />
      <SceneCanvas
        ref={sceneCanvasRef}
        tuningMode={tuningMode}
        sequenceDiagnostics={diagnostics}
        experience={displayed}
        sceneId={
          displayed === 'work'
            ? `work/${getWorkStory(workStoryIndex).id}`
            : displayed === 'collaborate'
              ? `collaborate/${collaborateStarterId ?? 'default'}`
              : displayed
        }
        mouseR={sceneConfig.mouseR}
        particleRepel={sceneConfig.particleRepel}
        weatherRepelMult={sceneConfig.weatherRepelMult}
        clickImpulseRadius={sceneConfig.clickImpulseRadius}
        clickImpulseForce={sceneConfig.clickImpulseForce}
        sourceLayout={sourceLayout}
        source={sceneSource}
        playgroundConfig={scenePlayground}
        paintTool={displayed === 'vibe' ? paintTool : undefined}
        onPaintStatusChange={setPaintStatus}
        qualityTierOverride={qualityTierOverride}
        onQualityTierChange={(from, to) =>
          trackEvent({ name: 'tier_transition', params: { from_tier: from, to_tier: to } })
        }
        onDiagnosticsUpdate={(snapshot) => {
          setSceneDiagnostics(snapshot)
          if (snapshot.targetCount !== diagnostics.targetCount) {
            setDiagnostics((prev) => ({ ...prev, targetCount: snapshot.targetCount }))
          }
        }}
      />
      {experience !== 'intro' && (
        <ExperienceNav
          active={displayed === 'intro' ? null : displayed}
          onSelect={navigateTo}
        />
      )}
      <AnalyticsConsent onClient={(client) => (analyticsClientRef.current = client)} />
      <main id="main-content" tabIndex={-1} className="foreground-layer" aria-live="polite">
        <ExperienceTransition phase={transitionPhase}>
          <div className="foreground-content">
            {displayed === 'intro' ? (
              <>
                <Intro taglineRef={taglineRef} />
                <PrimaryActions
                  selected={selected}
                  onSelect={navigateTo}
                  groupRef={actionsRef}
                />
              </>
            ) : displayed === 'work' ? (
              <WorkExperience
                stories={WORK_STORIES}
                activeIndex={workStoryIndex}
                onIndexChange={setWorkStoryIndex}
                headingRef={modeHeadingRef}
                titleBase={BASE_DOCUMENT_TITLE}
                modeTitle={EXPERIENCE_SCENES.work.copy.documentTitle}
                onTrackEvent={trackEvent}
              />
            ) : displayed === 'collaborate' ? (
              <CollaborateExperience
                selectedStarterId={collaborateStarterId}
                onSelectStarter={setCollaborateStarterId}
                headingRef={modeHeadingRef}
              />
            ) : (
              <VibeExperience
                headingRef={modeHeadingRef}
                status={vibeControlsOpen ? null : vibeStatus}
                controlsOpen={vibeControlsOpen}
                onOpenControls={() => setVibeControlsOpen(true)}
                ctaRef={vibeCtaRef}
                controlsId={`vibe-controls-${vibeDockId}`}
              />
            )}
          </div>
        </ExperienceTransition>
      </main>
      {/* Crawlable work digest: the interactive work surface only mounts after
          client-side hash/navigation state resolves, so the static export
          carries the full story content here instead. Visually hidden but
          semantic; unmounted while the work surface itself is on screen to
          avoid duplicated content for assistive tech. */}
      {displayed !== 'work' && (
        <section className="visually-hidden" aria-label="Work case studies">
          <h2>Work</h2>
          <p>{WORK_INTRO}</p>
          {WORK_STORIES.map((story) => (
            <article key={story.id}>
              <h3>{story.title}</h3>
              <p>{story.thesis}</p>
              <p>
                {story.role} — {story.context}
              </p>
              <p>{story.outcome}</p>
              {story.access === 'protected' ? (
                <a href={`/protected-work?story=${story.protectedId}`}>
                  View this confidential case study
                </a>
              ) : (
                story.links.map((link) => (
                  <a key={link.url} href={link.url}>
                    {link.label}
                  </a>
                ))
              )}
            </article>
          ))}
        </section>
      )}
      {/* Crawlable collaborate digest: same rationale as the work digest
          above — the interactive surface only mounts after client-side
          navigation resolves, so the static export carries the invitation
          copy and the mailto route here. Visually hidden but semantic;
          unmounted while the collaborate surface itself is on screen. */}
      {displayed !== 'collaborate' && (
        <section className="visually-hidden" aria-label="Collaborate">
          <h2>Collaborate</h2>
          <p>{COLLABORATE_HEADLINE}</p>
          <p>{COLLABORATE_ENERGIZING_STATEMENT}</p>
          <ul>
            {CONVERSATION_STARTERS.map((starter) => (
              <li key={starter.id}>
                {starter.label} {starter.response}
              </li>
            ))}
          </ul>
          <a href={COLLABORATE_CONTACT.mailtoUrl}>{COLLABORATE_CONTACT.primaryLabel}</a>
        </section>
      )}
      {/* Crawlable vibe digest: same rationale as the work digest above — the
          interactive surface only mounts after client-side navigation
          resolves, so the static export carries the invitation copy, the
          privacy note, and the preset names here. Visually hidden but
          semantic; unmounted while the vibe surface itself is on screen. */}
      {displayed !== 'vibe' && (
        <section className="visually-hidden" aria-label="Vibe">
          <h2>Vibe</h2>
          <p>{VIBE_INVITATION}</p>
          <p>{VIBE_PRIVACY_NOTE}</p>
          <ul>
            {VIBE_PRESETS.map((preset) => (
              <li key={preset.id}>{preset.label}</li>
            ))}
          </ul>
        </section>
      )}
      {displayed === 'vibe' && (
        <PlaygroundControlDock
          open={vibeControlsOpen}
          onClose={() => setVibeControlsOpen(false)}
          status={vibeStatus}
          invitation={<>{VIBE_DOCK_INVITATION}</>}
          paneId={`vibe-controls-${vibeDockId}`}
          controls={
            <PlaygroundControls
              config={playgroundConfig}
              uploadedFilename={uploadedSource?.filename ?? DEFAULT_UPLOADED_SVG_FILENAME}
              uploadError={uploadError}
              uploadPending={uploadPending}
              uploadPendingLabel={VIBE_UPLOAD_PENDING_LABEL}
              privacyNote={VIBE_PRIVACY_NOTE}
              presets={VIBE_PRESETS}
              onSelectPreset={handleApplyVibePreset}
              sourceShape={vibeBlackHole ? 'black-hole' : 'image'}
              onSelectSourceShape={handleSelectSourceShape}
              canvasRef={sceneCanvasRef}
              onChange={handlePlaygroundConfigChange}
              onReset={handleResetPlaygroundConfig}
              onUpload={handleUploadSource}
              paintTool={paintTool}
              paintStatus={paintStatus}
              onPaintToolChange={(patch) => setPaintTool((prev) => ({ ...prev, ...patch }))}
            />
          }
        />
      )}
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
          sourceLayout={sourceLayout}
          onSourceLayoutChange={handleSourceLayoutChange}
          onResetSourceLayout={resetSourceLayout}
          targetCount={diagnostics.targetCount}
          sceneDiagnostics={sceneDiagnostics}
          qualityTierOverride={qualityTierOverride}
          onQualityTierOverrideChange={setQualityTierOverride}
          onCopyConfiguration={handleCopyConfiguration}
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
      {pendingPaintAction && (
        <div
          className="paint-confirm-overlay"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              cancelPendingPaintAction()
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="paint-confirm-title"
            aria-describedby="paint-confirm-desc"
            className="paint-confirm-dialog"
          >
            <h2 id="paint-confirm-title" className="paint-confirm-title">
              Discard your painting?
            </h2>
            <p id="paint-confirm-desc" className="paint-confirm-body">
              This clears the paint you added to the field. The base image stays
              untouched, but the paint can&apos;t be recovered.
            </p>
            <div className="paint-confirm-actions">
              <button
                ref={paintConfirmCancelRef}
                type="button"
                className="paint-confirm-button"
                onClick={cancelPendingPaintAction}
              >
                Keep painting
              </button>
              <button
                type="button"
                className="paint-confirm-button paint-confirm-button-danger"
                onClick={confirmPendingPaintAction}
              >
                Discard and continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
