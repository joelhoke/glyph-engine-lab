'use client'

import SceneCanvas, { SceneCanvasHandle, SceneTargetRegion } from './SceneCanvas'
import CanvasFallback from './CanvasFallback'
import ExperienceNav from './ExperienceNav'
import ExperienceTransition, { useExperienceTransition } from './ExperienceTransition'
import WorkExperience, { MIN_EXPANSION_RANGE_PX } from './work/WorkExperience'
import CollaborateExperience from './collaborate/CollaborateExperience'
import VibeExperience, { VibeSurfaceStatus } from './vibe/VibeExperience'
import VibeToolbar from './vibe/VibeToolbar'
import AmbientCarousel from './vibe/AmbientCarousel'
import PondControl from './vibe/PondControl'
import SoundControl from './vibe/SoundControl'
import SonificationOverlay from './vibe/SonificationOverlay'
import { PAINT_DEFAULT_BACKGROUND_COLOR, PAINT_DEFAULT_GLYPH_COLOR } from './vibe/PaintPanel'
import { useSonification } from './vibe/useSonification'
import { useClipRecorder } from './vibe/useClipRecorder'
import { useVibeControlLayout } from './vibe/useVibeControlLayout'
import PrimaryActions, { ExperienceKey, PRIMARY_ACTION_COUNT } from './PrimaryActions'
import TuningPanel from './tuning/TuningPanel'
import AnalyticsConsent from './AnalyticsConsent'
import { ExperienceMode, ExperienceSceneKey } from '../engine/types'
import { EXPERIENCE_SCENES, resolveScenePlayground } from '../engine/sceneConfig'
import { getWorkSlide, getWorkSlideHeroFit, getWorkSlideId, resolveWorkSlideScene, WORK_SLIDES } from '../content/work'
import {
  COLLABORATE_AI_GUIDE,
  COLLABORATE_CONTACT,
  COLLABORATE_ENERGIZING_STATEMENT,
  COLLABORATE_GUIDE_MINIMIZE_LABEL,
  COLLABORATE_GUIDE_PENDING_HEADING,
  COLLABORATE_GUIDE_POP_OUT_LABEL,
  COLLABORATE_GUIDE_RESUME,
  COLLABORATE_GUIDE_RESUME_PENDING_STATUS,
  COLLABORATE_GUIDE_RESUME_UNSEEN_STATUS,
  COLLABORATE_HEADLINE,
  COLLABORATE_SHOW_STARTERS,
  CONVERSATION_STARTERS,
  CollaborateTopic,
  getCollaborateStarter,
  resolveCollaborateScene,
} from '../content/collaborate'
import {
  COLLABORATE_CHAT_HASH,
  formatExperienceHash,
  parseExperienceHashTarget,
  shouldCanonicalizeCollaborateChat,
} from '../engine/experienceHash'
import {
  GUIDE_COMPANION_MIN_WIDTH_PX,
  GuidePresentation,
  resolveGuideExitPresentation,
  resolveGuideMinimizedStatus,
  resolveGuideSourceTarget,
  resolveGuideViewportCrossing,
} from './collaborate/guideNavigation'
import ChatShell from './collaborate/ChatShell'
import {
  beginGuideShare,
  beginTurn,
  createGuideConversation,
  failGuideShare,
  failTurn,
  GuideConversationDeps,
  GuideConversationState,
  guideMessagesForApi,
  latestAssistantTurn,
  parseGuideAnswer,
  resetGuideConversation,
  resolveGuideShare,
  resolveTurn,
  setGuideDraft,
} from './collaborate/guideConversation'
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
import {
  AMBIENT_SCENE_COUNT,
  AMBIENT_SCENES,
  ambientSceneIndex,
  buildSceneAmbientConfig,
  nextAmbientSceneId,
  resolveAmbientSceneId,
} from '../engine/ambientScenes'
import { LANDING_CANVAS_GRADIENT, ThemeName, resolveThemedSourceUrl } from '../engine/theme'
import { useSystemTheme } from '../engine/useSystemTheme'
import { resolvePlaygroundConfig } from '../engine/playgroundTheme'
import { AnalyticsClient, AnalyticsEvent } from '../engine/analytics'
import {
  APPROVED_PLAYGROUND_DEFAULTS,
  PlaygroundConfig,
} from '../engine/playgroundConfig'
import {
  getFriendlyUploadError,
  getVibePreset,
  VIBE_INVITATION,
  VIBE_PRESETS,
  VIBE_PRIVACY_NOTE,
  VIBE_UPLOAD_PENDING_LABEL,
} from '../content/vibe'
import {
  DEFAULT_UPLOADED_SVG_FILENAME,
  createSvgObjectUrl,
  readUploadedSvg,
} from '../engine/svgUpload'
import { readUploadedRaster } from '../engine/rasterUpload'
import { UNSUPPORTED_SOURCE_TYPE_ERROR, VisualSourceKind } from '../engine/visualSource'
import {
  createSourceUrlRegistry,
  resolveSourcePromotion,
  resolveUploadRoute,
} from '../engine/sourcePromotion'
import {
  PAINT_BRUSH_DIAMETER_DEFAULT,
  PAINT_BRUSH_DIAMETER_MAX,
  PAINT_BRUSH_DIAMETER_MIN,
  PaintSnapshot,
  PaintStatus,
  PaintToolConfig,
  clonePaintSnapshot,
  createEmptyPaintSnapshot,
} from '../engine/paint'
import { clampPondConfig, POND_DEFAULTS, PondCharacter, PondConfig } from '../engine/pondConfig'
import { SonificationDirection } from '../engine/sonificationConfig'
import { CLIP_DURATION_DEFAULT_MS } from '../engine/clipRecorder'
import {
  VibeHistory,
  VibeStateSnapshot,
  VibeTransactionKind,
  canRedoVibe,
  canUndoVibe,
  clearVibeHistory,
  cloneVibeConfig,
  createVibeHistory,
  pushTransaction,
  redoTransaction,
  undoTransaction,
} from '../engine/vibeHistory'
import {
  APPROVED_SCENE_DEFAULTS,
  APPROVED_SOURCE_LAYOUT_DEFAULTS,
  SceneConfig,
} from './tuning/tuningConfig'
import { loadSvgTargets, SourceLayoutConfig } from '../engine/svgTargetSource'
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
  logoScale: number
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

/** The visitor-supplied source for the vibe field: an uploaded SVG or raster
 *  image (registry-owned blob: URL), or a preset's built-in SVG. */
type UploadedSourceState = {
  kind: VisualSourceKind
  url: string
  filename: string
}

export default function PortfolioExperience() {
  // System light/dark theme (feature/light-dark): 'dark' on the first paint,
  // the real preference after hydration, live updates on OS changes. Drives
  // the canvas colors and the CSS is handled by globals.css media queries.
  const theme = useSystemTheme()
  // Shell state: intro → work ↔ vibe ↔ collaborate. Starts at intro unless a
  // deep-link hash resolves to a mode on mount (handled below).
  const [experience, setExperience] = useState<ExperienceMode>('intro')
  const [selected, setSelected] = useState<ExperienceKey | null>(null)
  const [tuningMode, setTuningMode] = useState(false)
  const [qualityTierOverride, setQualityTierOverride] = useState<QualityTier | null>(null)
  const { displayed, phase: transitionPhase } = useExperienceTransition(experience)
  const modeHeadingRef = useRef<HTMLHeadingElement | null>(null)

  // Active work slide (intro first, then one project slide per story).
  // Controlled here (not inside WorkExperience) so the same index drives both
  // the foreground slide and the canvas descriptor.
  const [workSlideIndex, setWorkSlideIndex] = useState(0)

  // Work card expansion progress (0 = compact hero+card, 1 = full-height
  // reading panel). Controlled here because this component coordinates the
  // inputs: in-card scrolling (via WorkExperience), gap gestures outside the
  // card, and the measured glyph region those gestures must avoid. Gap
  // gestures are additionally gated on the expansion metrics reported up from
  // WorkExperience — a non-scrollable slide (the intro) never expands — and
  // accumulate against the same expansion range the card uses.
  const [workExpansionProgress, setWorkExpansionProgress] = useState(0)
  // Live mirrors for the passive window listeners (state is too stale
  // mid-gesture); gap commits are rAF-coalesced like the card's.
  const workExpansionProgressRef = useRef(0)
  const workOverflowEligibleRef = useRef(false)
  const workExpansionRangeRef = useRef(MIN_EXPANSION_RANGE_PX)
  const workGapRafRef = useRef<number | null>(null)
  const workGapPendingRef = useRef(0)

  // Resolved work scene: the work baseline merged with the active slide's
  // source, palette/background, and behavior overrides.
  const workDescriptor = useMemo(
    () => resolveWorkSlideScene(EXPERIENCE_SCENES.work, getWorkSlide(workSlideIndex)),
    [workSlideIndex],
  )

  // Work glyph stage: the active slide's hero-fit policy decides the canvas
  // target region. 'viewport' (the Microsoft intro's wide wordmark) keeps
  // MAIN's full-viewport sampling size — viewport-sized bounds centered on
  // the stage's center — so the glyphs render at their original scale,
  // shifted directionally up, with a slight intentional overlap behind the
  // compact card. 'stage' passes the measured stage rectangle directly.
  // 'balanced' (every project story) interpolates halfway between the two,
  // centered on the stage: larger than stage fit, smaller than viewport fit.
  // The stage rect itself always stays the gesture-dedication area (and
  // never changes with card expansion, so expansion never morphs the
  // canvas). Measured with a ResizeObserver on the stage (plus its layout
  // wrapper, whose size shifts the stage's position) and window
  // resize/orientationchange; values are rounded to whole CSS px so only
  // real changes propagate.
  const glyphStageRef = useRef<HTMLDivElement | null>(null)
  const workHeroFit = getWorkSlideHeroFit(getWorkSlide(workSlideIndex))
  const [workTargetRegion, setWorkTargetRegion] = useState<SceneTargetRegion | null>(null)
  useEffect(() => {
    if (displayed !== 'work') {
      setWorkTargetRegion(null)
      return
    }
    const stage = glyphStageRef.current
    if (!stage) return
    const measure = () => {
      const rect = stage.getBoundingClientRect()
      const vw = window.visualViewport?.width ?? window.innerWidth
      const vh = window.visualViewport?.height ?? window.innerHeight
      if (rect.width <= 1 || rect.height <= 1) {
        setWorkTargetRegion((prev) => (prev === null ? prev : null))
        return
      }
      // Viewport-fit bounds: viewport-sized, centered on the stage center.
      const viewportBounds = {
        x: rect.left + rect.width / 2 - vw / 2,
        y: rect.top + rect.height / 2 - vh / 2,
        width: vw,
        height: vh,
      }
      const stageBounds = { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      // 'balanced': halfway between stage and viewport bounds, component by
      // component — both share the stage center, so the midpoint does too.
      const balancedBounds = {
        x: (stageBounds.x + viewportBounds.x) / 2,
        y: (stageBounds.y + viewportBounds.y) / 2,
        width: (stageBounds.width + viewportBounds.width) / 2,
        height: (stageBounds.height + viewportBounds.height) / 2,
      }
      const raw =
        workHeroFit === 'viewport'
          ? viewportBounds
          : workHeroFit === 'stage'
            ? stageBounds
            : balancedBounds
      const next: SceneTargetRegion = {
        x: Math.round(raw.x),
        y: Math.round(raw.y),
        width: Math.round(raw.width),
        height: Math.round(raw.height),
      }
      setWorkTargetRegion((prev) => {
        if (
          prev !== null &&
          prev.x === next.x &&
          prev.y === next.y &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev
        }
        return next
      })
    }
    measure()
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(stage)
      if (stage.parentElement) observer.observe(stage.parentElement)
    }
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
    }
    // transitionPhase: the entrance morph transforms the foreground without
    // RESIZING the stage, so the initial measurement can be mid-flight —
    // re-measure once the transition settles.
  }, [displayed, workHeroFit, transitionPhase])

  // Dev-only debug surface for scripts/dev/work-visual-smoke.js (?debug=true):
  // the resolved hero fit and target region for the active slide.
  useEffect(() => {
    if (!tuningMode) return
    ;(window as unknown as { __workHero?: unknown }).__workHero = {
      fit: workHeroFit,
      region: workTargetRegion,
    }
  }, [tuningMode, workHeroFit, workTargetRegion])

  // Keep the gap-gesture mirror in sync with the controlled state (card-side
  // commits from WorkExperience also move it).
  useEffect(() => {
    workExpansionProgressRef.current = workExpansionProgress
  }, [workExpansionProgress])

  // Leaving Work always returns the card to the compact state.
  useEffect(() => {
    if (displayed !== 'work') {
      workExpansionProgressRef.current = 0
      workOverflowEligibleRef.current = false
      workExpansionRangeRef.current = MIN_EXPANSION_RANGE_PX
      setWorkExpansionProgress(0)
    }
  }, [displayed])

  // Gap gestures: wheel/trackpad or touch in the empty gap OUTSIDE the card
  // scrubs the expansion progress against the same expansion range the card
  // reports (compactCardTop - expandedCardTop) — but never inside the
  // measured glyph region, which stays dedicated to canvas interaction. The
  // gaps are pointer-transparent, so these gestures land on the canvas; the
  // window listeners observe them without intercepting (all passive). The
  // card's own viewport handles in-card gestures (WorkExperience). Upward gap
  // input contracts only when the card content is at its top — gap gestures
  // never scroll content. Non-overflowing slides ignore gap input entirely.
  useEffect(() => {
    if (displayed !== 'work') return
    const commitGapProgress = (next: number) => {
      const clamped = Math.min(1, Math.max(0, next))
      if (clamped === workExpansionProgressRef.current) return
      workExpansionProgressRef.current = clamped
      workGapPendingRef.current = clamped
      if (workGapRafRef.current === null) {
        workGapRafRef.current = requestAnimationFrame(() => {
          workGapRafRef.current = null
          setWorkExpansionProgress(workGapPendingRef.current)
        })
      }
    }
    const gapRangePx = () => Math.max(workExpansionRangeRef.current, MIN_EXPANSION_RANGE_PX)
    const contentScrolled = () => {
      const viewport = document.querySelector('.work-experience-viewport')
      return !!viewport && viewport.scrollTop > 1
    }
    const applyGapDelta = (deltaPx: number) => {
      if (!workOverflowEligibleRef.current || deltaPx === 0) return
      if (deltaPx < 0 && contentScrolled()) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        commitGapProgress(deltaPx > 0 ? 1 : 0)
        return
      }
      commitGapProgress(workExpansionProgressRef.current + deltaPx / gapRangePx())
    }
    const isInCard = (target: EventTarget | null) =>
      target instanceof Element &&
      !!(target.closest('.work-experience') || target.closest('.work-lightbox'))
    const isInGlyphRegion = (x: number, y: number) => {
      const rect = glyphStageRef.current?.getBoundingClientRect()
      return (
        !!rect &&
        rect.width > 1 &&
        rect.height > 1 &&
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      )
    }
    const handleWheel = (event: globalThis.WheelEvent) => {
      if (isInCard(event.target)) return
      if (isInGlyphRegion(event.clientX, event.clientY)) return
      applyGapDelta(event.deltaY)
    }
    // Gesture dedication is decided where the touch BEGINS: a swipe that
    // starts in the glyph region never scrubs the card, even if it travels
    // over the gap. Like the card, gap touch progress is ABSOLUTE — computed
    // from the gesture's starting Y and starting progress.
    let touch: { startY: number; startProgress: number; allowed: boolean } | null = null
    const handleTouchStart = (event: globalThis.TouchEvent) => {
      const point = event.touches[0]
      if (!point) {
        touch = null
        return
      }
      touch = {
        startY: point.clientY,
        startProgress: workExpansionProgressRef.current,
        allowed: !isInCard(event.target) && !isInGlyphRegion(point.clientX, point.clientY),
      }
    }
    const handleTouchMove = (event: globalThis.TouchEvent) => {
      if (!touch?.allowed) return
      const point = event.touches[0]
      if (!point) return
      const dy = touch.startY - point.clientY
      if (!workOverflowEligibleRef.current) return
      if (dy < 0 && contentScrolled()) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        commitGapProgress(dy > 0 ? 1 : 0)
        return
      }
      commitGapProgress(touch.startProgress + dy / gapRangePx())
    }
    const handleTouchEnd = () => {
      touch = null
    }
    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
      if (workGapRafRef.current !== null) cancelAnimationFrame(workGapRafRef.current)
      workGapRafRef.current = null
    }
  }, [displayed])

  // Selected conversation starter. Controlled here (not inside
  // CollaborateExperience) so the same state also drives the canvas descriptor.
  const [collaborateStarterId, setCollaborateStarterId] = useState<string | null>(null)

  // Latest guide answer topic, reported up from CollaborateExperience so the
  // canvas morphs to the authored per-topic treatment (null = starter/baseline).
  const [collaborateGuideTopic, setCollaborateGuideTopic] = useState<CollaborateTopic | null>(null)

  // Collaborate subview: the guide landing or the chat. Selecting Collaborate
  // from another mode always opens the landing; the chat is reachable via
  // #collaborate/chat (and canonicalized back to the landing when no
  // conversation exists in memory).
  const [collaborateView, setCollaborateView] = useState<'landing' | 'chat'>('landing')

  // Guide conversation session (page-load memory only — NO browser storage).
  // Owned here so it survives landing ↔ chat navigation. Created lazily in an
  // effect so server-rendered markup never depends on the session id.
  const [guideState, setGuideState] = useState<GuideConversationState | null>(null)
  const guideStateRef = useRef<GuideConversationState | null>(null)
  const guideDepsRef = useRef<GuideConversationDeps>({
    now: () => Date.now(),
    id: () =>
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
  })
  const chatHeadingRef = useRef<HTMLHeadingElement | null>(null)
  useEffect(() => {
    const initial = createGuideConversation(guideDepsRef.current)
    guideStateRef.current = initial
    setGuideState(initial)
  }, [])

  const applyGuideState = (next: GuideConversationState) => {
    guideStateRef.current = next
    setGuideState(next)
  }

  // Guide presentation: how the conversation appears while the visitor
  // browses. 'page' = the full chat view (#collaborate/chat); 'companion' =
  // docked panel alongside Work/Vibe (wide viewports); 'minimized' = resume
  // bar/pill. Page memory only — no storage, no new URLs. The narrow-viewport
  // modal overlay is a flag on top of 'minimized', not a fourth presentation.
  const [guidePresentation, setGuidePresentation] = useState<GuidePresentation>('page')
  const [guideOverlayOpen, setGuideOverlayOpen] = useState(false)
  // An answer that arrived while the transcript was out of view (minimized).
  const [guideUnseenAnswer, setGuideUnseenAnswer] = useState(false)
  const guideResumeRef = useRef<HTMLButtonElement | null>(null)
  const guideOverlayRef = useRef<HTMLDivElement | null>(null)
  // Focus-restore flags: set by the user action, consumed by the effect that
  // runs once the destination control is mounted.
  const guideResumeFocusRef = useRef(false)
  const guideMinimizeFocusRef = useRef(false)
  const guideOverlayRestoreFocusRef = useRef(false)

  // Companion breakpoint (960px): drives the pop-out/minimize labels and the
  // resume target, and the crossing effect below minimizes an open companion.
  const [guideWideViewport, setGuideWideViewport] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(`(min-width: ${GUIDE_COMPANION_MIN_WIDTH_PX}px)`).matches,
  )
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${GUIDE_COMPANION_MIN_WIDTH_PX}px)`)
    const update = () => setGuideWideViewport(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // Viewport crossing: an open companion minimizes below the breakpoint (and
  // any open overlay closes) — widening never reopens a minimized chat.
  useEffect(() => {
    const width = window.innerWidth
    setGuidePresentation((current) => resolveGuideViewportCrossing(current, width))
    if (width >= GUIDE_COMPANION_MIN_WIDTH_PX) setGuideOverlayOpen(false)
  }, [guideWideViewport])

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
    // story_view is project-only: the intro slide is mode copy, not a story.
    const slide = getWorkSlide(workSlideIndex)
    if (slide.kind !== 'project') return
    trackEvent({ name: 'story_view', params: { story_id: slide.story.id } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workSlideIndex, displayed])

  // Resolved collaborate scene: the collaborate baseline merged with the
  // selected starter's glyph phrase, or — when the guide has answered — the
  // authored treatment for the latest answer's topic (topic wins).
  const collaborateDescriptor = useMemo(
    () =>
      resolveCollaborateScene(
        EXPERIENCE_SCENES.collaborate,
        getCollaborateStarter(collaborateStarterId),
        collaborateGuideTopic,
      ),
    [collaborateStarterId, collaborateGuideTopic],
  )

  useEffect(() => {
    setTuningMode(isTuningMode())
  }, [])

  // Editable working copies of authored configuration. The intro sequence
  // timing is fixed (portfolioIntroPreset); the RAF loop reads it through a
  // stable ref so the tick closure never goes stale.
  const timingRef = useRef(portfolioIntroPreset.timing)

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

  // Stable theme mirror for deferred/imperative readers (the scene-adoption
  // effect, preset/reset handlers) so they never capture a stale theme.
  const themeRef = useRef<ThemeName>(theme)
  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  /** The vibe default composition resolved against a theme — the entry
   *  adoption, the live system-follow, and the reset target. */
  const resolveVibeDefault = (forTheme: ThemeName): PlaygroundConfig =>
    resolvePlaygroundConfig(EXPERIENCE_SCENES.vibe.themedPlayground, forTheme)

  // Theme follow-through (feature/light-dark): while the vibe composition is
  // untouched, the default tracks the system theme live. This is deliberately
  // NOT a vibe-history transaction and never sets vibeTouchedRef — a theme
  // change is not a visitor edit, and an applied preset or any manual edit
  // sticks across later system changes.
  const vibeThemeAppliedRef = useRef<ThemeName>(theme)
  useEffect(() => {
    if (vibeThemeAppliedRef.current === theme) return
    vibeThemeAppliedRef.current = theme
    if (vibeTouchedRef.current) return
    const resolved = resolveVibeDefault(theme)
    setPlaygroundConfig(resolved)
    playgroundConfigRef.current = cloneVibeConfig(resolved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  // Ambient effect changes (Vibe Off/Weather/Matrix selector). Undo/redo
  // replays are excluded: analytics fire on the forward action only. The ref
  // counts history-applied ambient-mode changes not yet consumed by the
  // effect below (applyVibeSnapshot increments it only when the applied
  // snapshot actually changes the mode, so increments and suppressed changes
  // pair up exactly).
  const ambientMode = playgroundConfig.ambient.mode
  const prevAmbientModeRef = useRef(ambientMode)
  const vibeAmbientHistoryAppliesRef = useRef(0)
  useEffect(() => {
    if (prevAmbientModeRef.current !== ambientMode) {
      prevAmbientModeRef.current = ambientMode
      if (vibeAmbientHistoryAppliesRef.current > 0) {
        vibeAmbientHistoryAppliesRef.current -= 1
      } else {
        trackEvent({ name: 'effect_change', params: { mode: ambientMode } })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambientMode])

  const sceneCanvasRef = useRef<SceneCanvasHandle>(null)

  const [uploadedSource, setUploadedSource] = useState<UploadedSourceState | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadPending, setUploadPending] = useState(false)

  // Vibe presentation (Stage 3): the invitation card and the control dock
  // are mutually exclusive, and the open state lives here so the card can
  // unmount entirely and restore focus to its CTA when the dock closes.
  const [vibeControlsOpen, setVibeControlsOpen] = useState(false)
  const vibeCtaRef = useRef<HTMLButtonElement | null>(null)
  const vibeControlsWasOpenRef = useRef(false)
  const vibeDockId = useId().replace(/:/g, '-')
  const vibeToolbarId = `vibe-toolbar-${vibeDockId}`

  // Ambient scene carousel (session-only UI around the config transaction):
  // the wipe lock disables the nav buttons while a scene transition runs,
  // and the temporary top-center chip names the freshly applied scene.
  const [ambientWipeActive, setAmbientWipeActive] = useState(false)
  const [ambientSceneLabel, setAmbientSceneLabel] = useState<string | null>(null)
  const ambientSceneLabelTimeoutRef = useRef<number | null>(null)

  // Sound control (session-only): expansion state only — playback/config live
  // in useSonification. Expanding never starts audio.
  const [soundExpanded, setSoundExpanded] = useState(false)

  // Landing seasonal atmosphere (Stage 3): computed once on mount from the
  // local date/locale and applied at full intensity from the first landing
  // frame — no ramp.
  const [landingAmbient, setLandingAmbient] = useState<AmbientConfig | null>(null)

  // Vibe-only paint tool state (session-only; never URL-persisted) and the
  // live overlay status reported by the canvas.
  const [paintTool, setPaintTool] = useState<PaintToolConfig>({
    enabled: false,
    tool: 'paint',
    glyphColor: PAINT_DEFAULT_GLYPH_COLOR,
    backgroundColor: 'none',
    brushDiameter: PAINT_BRUSH_DIAMETER_DEFAULT,
  })
  const [paintStatus, setPaintStatus] = useState<PaintStatus | null>(null)

  // Unified Vibe undo/redo history (launch item 6): one transaction stack
  // covering config, text, presets, uploads, paint-tool, paint strokes, and
  // clear paint. The canUndo/canRedo React state only updates on
  // history-structure changes (and upload lifecycle), never per keystroke.
  const vibeHistoryRef = useRef<VibeHistory>(createVibeHistory())
  const [vibeCanUndo, setVibeCanUndo] = useState(false)
  const [vibeCanRedo, setVibeCanRedo] = useState(false)
  // Latest paint-overlay state: the "before" for the next stroke transaction
  // (the canvas only reports stroke ENDS, so this is tracked continuously).
  const lastPaintSnapshotRef = useRef<PaintSnapshot>(createEmptyPaintSnapshot())
  // Stable mirrors so async/deferred handlers (uploads, keyboard shortcuts)
  // never read stale render closures.
  const playgroundConfigRef = useRef(playgroundConfig)
  const paintToolRef = useRef(paintTool)
  const uploadPendingRef = useRef(uploadPending)
  useEffect(() => {
    playgroundConfigRef.current = playgroundConfig
  }, [playgroundConfig])
  useEffect(() => {
    paintToolRef.current = paintTool
  }, [paintTool])
  useEffect(() => {
    uploadPendingRef.current = uploadPending
    syncVibeHistoryFlags()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadPending])

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
      const next = Math.min(
        PAINT_BRUSH_DIAMETER_MAX,
        Math.max(PAINT_BRUSH_DIAMETER_MIN, paintToolRef.current.brushDiameter + delta),
      )
      if (next === paintToolRef.current.brushDiameter) return
      handlePaintToolChange({ brushDiameter: next }, 'brushDiameter')
    }
    window.addEventListener('keydown', handleBrushKeys)
    return () => window.removeEventListener('keydown', handleBrushKeys)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed, paintTool.enabled])

  // Object-URL lifecycle: SVG and raster uploads hold blob: URLs, all owned
  // by one registry (engine/sourcePromotion) so every revocation is
  // exactly-once. URLs referenced by any retained vibe-history entry (or the
  // live source) must stay valid, so revocation happens only when a candidate
  // fails or goes stale, when history entries are trimmed/cleared, on reset,
  // or on unmount — never when a source is replaced (the replacing
  // transaction's before-snapshot still references it).
  const uploadedSourceRef = useRef<UploadedSourceState | null>(null)
  const urlRegistryRef = useRef(
    createSourceUrlRegistry((url) => URL.revokeObjectURL(url)),
  )
  // Upload request generation: only the newest attempt may promote a source
  // or touch the pending/error state; stale attempts release their candidate
  // URL and exit without disturbing the winner.
  const uploadRequestRef = useRef(0)
  useEffect(() => {
    uploadedSourceRef.current = uploadedSource
  }, [uploadedSource])
  useEffect(() => {
    return () => {
      urlRegistryRef.current.releaseOrphans(new Set())
    }
  }, [])

  // Release guard handed to the history module: never revoke the live source
  // (trimming can surface an URL the field still samples). The registry
  // no-ops on URLs it does not own (preset /assets paths, data: URLs).
  const releaseOrphanedUrl = (url: string) => {
    if (uploadedSourceRef.current?.url === url) return
    urlRegistryRef.current.release(url)
  }

  // --- Unified vibe history (launch item 6) --------------------------------

  const syncVibeHistoryFlags = () => {
    setVibeCanUndo(canUndoVibe(vibeHistoryRef.current, uploadPendingRef.current))
    setVibeCanRedo(canRedoVibe(vibeHistoryRef.current, uploadPendingRef.current))
  }

  /** Snapshot the full vibe state (config + paint tool + paint + upload).
   *  The paint component rides lastPaintSnapshotRef — pass an override when
   *  the canvas state just changed synchronously. */
  const captureVibeSnapshot = (paintOverride?: PaintSnapshot): VibeStateSnapshot => ({
    config: cloneVibeConfig(playgroundConfigRef.current),
    paintTool: { ...paintToolRef.current },
    paint: paintOverride
      ? clonePaintSnapshot(paintOverride)
      : clonePaintSnapshot(lastPaintSnapshotRef.current),
    upload: uploadedSourceRef.current ? { ...uploadedSourceRef.current } : null,
  })

  const recordVibeTransaction = (
    kind: VibeTransactionKind,
    key: string | null,
    before: VibeStateSnapshot,
    after: VibeStateSnapshot,
  ) => {
    pushTransaction(vibeHistoryRef.current, { kind, key, before, after }, releaseOrphanedUrl)
    syncVibeHistoryFlags()
  }

  /** Default coalesce key from the patch contents: single scalar fields use
   *  their name; nested motion/ambient use `<field>.<changed subfield>`; an
   *  in-place palette recolor uses `glyphPalette.<index>`. Multi-field or
   *  structural patches return null (never coalesced). */
  const deriveConfigHistoryKey = (
    prev: PlaygroundConfig,
    patch: Partial<PlaygroundConfig>,
  ): string | null => {
    const keys = Object.keys(patch) as (keyof PlaygroundConfig)[]
    if (keys.length !== 1) return null
    const key = keys[0]
    if ((key === 'motion' || key === 'ambient') && patch[key]) {
      const prevNested = prev[key] as unknown as Record<string, unknown>
      const nextNested = patch[key] as unknown as Record<string, unknown>
      const changed = Object.keys(nextNested).filter(
        (field) => JSON.stringify(nextNested[field]) !== JSON.stringify(prevNested[field]),
      )
      return changed.length === 1 ? `${key}.${changed[0]}` : key
    }
    if (
      key === 'glyphPalette' &&
      patch.glyphPalette &&
      patch.glyphPalette.length === prev.glyphPalette.length
    ) {
      const diffs = patch.glyphPalette.filter((color, i) => color !== prev.glyphPalette[i])
      if (diffs.length === 1) {
        return `glyphPalette.${patch.glyphPalette.findIndex(
          (color, i) => color !== prev.glyphPalette[i],
        )}`
      }
      return 'glyphPalette'
    }
    return key
  }

  // Animation-facing sequence state: updated every RAF tick for smooth progress.
  const sequenceRef = useRef<IntroSequenceSnapshot>(
    evaluateIntroSequence(0, portfolioIntroPreset.timing),
  )

  // Direct DOM ref for full-rate visual updates (not throttled diagnostics).
  const actionsRef = useRef<HTMLDivElement | null>(null)

  // Throttled diagnostic state: drives text readouts only.
  const [diagnostics, setDiagnostics] = useState<SequenceDiagnostics>({
    phase: 'logo-scale',
    elapsedMs: 0,
    phaseProgress: 0,
    overallProgress: 0,
    logoScale: 0,
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

  // Private Pond (session-only): the physics config (editable only through
  // the debug-only Pond panel) plus the visitor-facing enable toggle and
  // swimming-body character. None of this enters PlaygroundConfig, presets,
  // unified history, URL sharing, or analytics.
  const [pondConfig, setPondConfig] = useState<PondConfig>(() => ({ ...POND_DEFAULTS }))
  const [pondEnabled, setPondEnabled] = useState(false)
  const [pondCharacter, setPondCharacter] = useState<PondCharacter>('source')
  const handlePondChange = (next: PondConfig) => {
    setPondConfig(clampPondConfig(next))
  }
  // POND_DEFAULTS ships disabled; the visitor toggle (or the debug panel's
  // own enable checkbox) is the enable bit, so the canvas only ever sees an
  // enabled config while the pond is on. Memoized: SceneCanvas re-runs its
  // pond mirror effect on prop identity.
  const activePondConfig = useMemo<PondConfig>(
    () => ({ ...pondConfig, enabled: true }),
    [pondConfig],
  )

  // Visual Sonification (session-only): the scanner reads the live canvas and
  // plays a tonal score, driven by the Sound control. It never enters
  // PlaygroundConfig, presets, unified history, URL sharing, analytics, or
  // uploaded-source state. Enabled throughout Vibe Mode so clip recording can
  // drive it too; no AudioContext exists until a user gesture (Sound Play, or
  // Record clip).
  const sonification = useSonification({
    enabled: displayed === 'vibe',
    sceneCanvasRef,
    qualityTier: (sceneDiagnostics.qualityTier >= 0 && sceneDiagnostics.qualityTier <= 3
      ? sceneDiagnostics.qualityTier
      : 0) as QualityTier,
    backgroundColor1: playgroundConfig.backgroundColor1,
    backgroundColor2: playgroundConfig.backgroundColor2,
    ambient: playgroundConfig.ambient,
  })

  // 15/10/5-second vibe clips: canvas captureStream + sonification
  // soundtrack. The dev-only ?clipTestMs= query param (clamped 500–15000)
  // OVERRIDES any chosen duration for automated verification; production has
  // no override and always honors the chooser's 5/10/15s selection.
  const clipDurationOverrideMs = useMemo(() => {
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
      return null
    }
    const raw = new URLSearchParams(window.location.search).get('clipTestMs')
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed)
      ? Math.min(CLIP_DURATION_DEFAULT_MS, Math.max(500, parsed))
      : null
  }, [])
  const clipRecorder = useClipRecorder({
    enabled: displayed === 'vibe',
    sceneCanvasRef,
    beginCapture: sonification.beginCapture,
    durationOverrideMs: clipDurationOverrideMs,
  })

  /* Floating vibe controls (Sound/Pond FABs + pills) vs the centered toolbar
     capsule: publishes the measured capsule half-width and per-side
     horizontal/vertical pill layout so nothing overlaps at mid-size widths. */
  useVibeControlLayout(displayed === 'vibe' && vibeControlsOpen)

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

      // Full-rate visual update path: apply directly to the DOM/canvas
      // without React re-render. The logo scale goes to the canvas
      // imperatively; the option reveals are CSS custom properties.
      sceneCanvasRef.current?.setLandingLogoScale(next.logoScale)
      const actionMeta = updateActionsVisuals(next)

      // Throttle diagnostic React state updates to ~10fps.
      if (now - lastDiagnosticTick > 100) {
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
          logoScale: next.logoScale,
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
      // Leaving the full chat page via the nav retains the conversation as
      // the companion (wide) or the minimized resume bar (narrow); entering
      // Collaborate keeps that chrome too — the landing's resume view
      // coexists with the docked conversation.
      const leavingChatPage =
        COLLABORATE_AI_GUIDE && displayed === 'collaborate' && collaborateView === 'chat'
      const hasConversation = (guideStateRef.current?.turns.length ?? 0) > 0
      if (leavingChatPage && hasConversation && key !== 'collaborate') {
        setGuidePresentation(resolveGuideExitPresentation(window.innerWidth))
        setGuideOverlayOpen(false)
      }
      setSelected(key)
      setExperience(key)
      // Selecting Collaborate from Work/Vibe ALWAYS opens the landing, even
      // when a conversation exists in memory (the landing previews it).
      if (key === 'collaborate') setCollaborateView('landing')
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
  // mode in sync with back/forward navigation. `#work/<storyId>` deep links
  // also select that story's project slide; unknown story ids degrade to the
  // bare work mode (slide untouched). `#collaborate/chat` deep links open the
  // chat subview while a conversation exists in memory; without turns (e.g. a
  // direct load or reload — page memory only) the hash canonicalizes to the
  // bare `#collaborate` landing via replaceState.
  useEffect(() => {
    const applyHash = () => {
      const target = parseExperienceHashTarget(window.location.hash)
      if (target) {
        setSelected(target.key)
        setExperience(target.key)
        if (target.key === 'work' && target.storyId) {
          const index = WORK_SLIDES.findIndex(
            (slide) => slide.kind === 'project' && slide.story.id === target.storyId,
          )
          if (index >= 0) setWorkSlideIndex(index)
        }
        if (target.key === 'collaborate') {
          const hasTurns = (guideStateRef.current?.turns.length ?? 0) > 0
          if (shouldCanonicalizeCollaborateChat(target, hasTurns)) {
            window.history.replaceState(null, '', formatExperienceHash('collaborate'))
            setCollaborateView('landing')
          } else {
            setCollaborateView(target.subview === 'chat' ? 'chat' : 'landing')
          }
          // Back/forward into the chat deep link returns the conversation to
          // the full page; a bare #collaborate keeps the companion/minimized
          // chrome alongside the landing's resume view.
          if (target.subview === 'chat') {
            setGuidePresentation('page')
            setGuideOverlayOpen(false)
            setGuideUnseenAnswer(false)
          }
        }
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
    // already made their own edits, which survive mode switches. Resolved
    // against the active theme (the untouched default follows the system).
    if (displayed === 'vibe' && !vibeTouchedRef.current) {
      setPlaygroundConfig(resolveVibeDefault(themeRef.current))
    }
  }, [displayed, workDescriptor, collaborateDescriptor])

  // Safety net: whenever the settled experience is not vibe, no paint may
  // remain on the field. navigateTo confirms-then-clears on the explicit path;
  // browser back/forward resolves through the hash listener and lands here.
  // The departure discard is non-recoverable, so the vibe undo history (which
  // could otherwise restore paint onto a different mode's field) is dropped
  // with it; the uploaded source itself survives mode switches.
  useEffect(() => {
    if (displayed !== 'vibe') {
      sceneCanvasRef.current?.clearPaint()
      clearVibeHistory(vibeHistoryRef.current, releaseOrphanedUrl)
      lastPaintSnapshotRef.current = createEmptyPaintSnapshot()
      syncVibeHistoryFlags()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed])

  // Focus management: move focus to the mode heading whenever the settled
  // mode (or collaborate subview) changes. The collaborate chat view focuses
  // its own heading instead; returning to the landing refocuses the mode
  // heading. Focus is never moved to individual guide answers.
  useEffect(() => {
    if (displayed === 'intro') return
    if (displayed === 'collaborate' && collaborateView === 'chat') {
      chatHeadingRef.current?.focus({ preventScroll: true })
    } else {
      modeHeadingRef.current?.focus({ preventScroll: true })
    }
  }, [displayed, collaborateView])

  // Titles: a meaningful document.title for the settled mode. The collaborate
  // chat view retitles from the locked conversation heading once the first
  // answer arrives; the landing keeps the normal Collaborate title.
  useEffect(() => {
    if (displayed === 'intro') {
      document.title = BASE_DOCUMENT_TITLE
      return
    }
    const scene = EXPERIENCE_SCENES[displayed]
    const guideHeading =
      displayed === 'collaborate' && collaborateView === 'chat' ? guideState?.heading : null
    document.title = `${BASE_DOCUMENT_TITLE} — ${guideHeading ?? scene.copy.documentTitle}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed, collaborateView, guideState?.heading])

  // --- Guide conversation actions (chat view; controller is pure) -----------

  const navigateToCollaborateChat = () => {
    setGuidePresentation('page')
    setGuideOverlayOpen(false)
    setGuideUnseenAnswer(false)
    setCollaborateView('chat')
    if (typeof window !== 'undefined' && window.location.hash !== COLLABORATE_CHAT_HASH) {
      // pushState (not location.hash assignment) so no hashchange event fires;
      // the listener above owns back/forward navigation only.
      window.history.pushState(null, '', COLLABORATE_CHAT_HASH)
    }
  }

  const navigateToCollaborateLanding = () => {
    setCollaborateView('landing')
    if (
      typeof window !== 'undefined' &&
      window.location.hash !== formatExperienceHash('collaborate')
    ) {
      window.history.pushState(null, '', formatExperienceHash('collaborate'))
    }
  }

  // --- Guide presentation actions (companion / minimized / overlay) ---------

  /** Full-chat header control: "Pop chat out" (wide) / "Minimize chat"
   *  (narrow). Returns to the collaborate landing — the last place the
   *  visitor was before the conversation — with the chat docked (wide) or
   *  minimized (narrow) alongside it. Back from there restores
   *  #collaborate/chat. */
  const exitGuideChatPage = () => {
    setGuidePresentation(resolveGuideExitPresentation(window.innerWidth))
    setGuideOverlayOpen(false)
    setSelected('collaborate')
    setExperience('collaborate')
    setCollaborateView('landing')
    if (
      typeof window !== 'undefined' &&
      window.location.hash !== formatExperienceHash('collaborate')
    ) {
      window.history.pushState(null, '', formatExperienceHash('collaborate'))
    }
  }

  /** Intentional internal source navigation: a validated `#work/<storyId>`
   *  source card clicked with an unmodified primary click. Selects the story,
   *  updates the hash, and docks (wide) or minimizes (narrow) the chat. From
   *  the narrow overlay this also restores the resume bar. */
  const handleGuideSourceNavigate = (storyId: string) => {
    const target = resolveGuideSourceTarget(`#work/${storyId}`)
    if (!target) return
    const doNavigate = () => {
      const nextPresentation = resolveGuideExitPresentation(window.innerWidth)
      setGuidePresentation(nextPresentation)
      setGuideOverlayOpen(false)
      setSelected('work')
      setExperience('work')
      setWorkSlideIndex(target.slideIndex)
      // Same-story re-click while Work is already settled: the slide-change
      // focus effect will not fire, so move focus to the Work heading here.
      if (target.slideIndex === workSlideIndex && displayed === 'work') {
        modeHeadingRef.current?.focus({ preventScroll: true })
      }
      const hash = `#work/${target.storyId}`
      if (typeof window !== 'undefined' && window.location.hash !== hash) {
        window.history.pushState(null, '', hash)
      }
      trackEvent({
        name: 'collaborate_guide_navigation',
        params: { story_id: target.storyId, presentation: nextPresentation },
      })
    }
    // Leaving vibe with paint on the field asks before discarding it.
    if (displayed === 'vibe') {
      withPaintConfirmation(() => {
        sceneCanvasRef.current?.clearPaint()
        doNavigate()
      })
      return
    }
    doNavigate()
  }

  /** Companion "Open full conversation" (and any path back to the chat page):
   *  the hash returns to #collaborate/chat so Back restores the page. */
  const openGuideFullConversation = () => {
    const doOpen = () => {
      setGuidePresentation('page')
      setGuideOverlayOpen(false)
      setGuideUnseenAnswer(false)
      setSelected('collaborate')
      setExperience('collaborate')
      setCollaborateView('chat')
      if (typeof window !== 'undefined' && window.location.hash !== COLLABORATE_CHAT_HASH) {
        window.history.pushState(null, '', COLLABORATE_CHAT_HASH)
      }
    }
    if (displayed === 'vibe') {
      withPaintConfirmation(() => {
        sceneCanvasRef.current?.clearPaint()
        doOpen()
      })
      return
    }
    doOpen()
  }

  /** Companion "Minimize": collapse to the resume pill and return focus to
   *  it once mounted. */
  const minimizeGuideCompanion = () => {
    guideMinimizeFocusRef.current = true
    setGuidePresentation('minimized')
  }

  /** Resume control: wide viewports reopen the docked companion (focus moves
   *  to its heading); narrow viewports open the full-viewport modal overlay
   *  over the current site without changing its hash. */
  const handleGuideResume = () => {
    setGuideUnseenAnswer(false)
    if (window.innerWidth >= GUIDE_COMPANION_MIN_WIDTH_PX) {
      guideResumeFocusRef.current = true
      setGuidePresentation('companion')
    } else {
      setGuideOverlayOpen(true)
    }
  }

  /** Overlay minimize control / Escape: back to the resume bar with focus. */
  const closeGuideOverlay = () => {
    guideOverlayRestoreFocusRef.current = true
    setGuideOverlayOpen(false)
  }

  // Focus delivery for the companion/minimize transitions above: the flags
  // are set by the user action and consumed once the destination is mounted.
  useEffect(() => {
    if (guidePresentation === 'companion' && guideResumeFocusRef.current) {
      guideResumeFocusRef.current = false
      chatHeadingRef.current?.focus({ preventScroll: true })
    }
    if (guidePresentation === 'minimized' && guideMinimizeFocusRef.current) {
      guideMinimizeFocusRef.current = false
      guideResumeRef.current?.focus({ preventScroll: true })
    }
  }, [guidePresentation])

  /** Optimistically append the visitor message, navigate to the chat, and
   *  send the full transcript. A starter id also applies its canvas glyph
   *  treatment (existing behavior). */
  const sendGuideMessage = (raw: string, starterId?: string) => {
    const current = guideStateRef.current
    if (!current) return
    const begun = beginTurn(current, raw, guideDepsRef.current)
    if (!begun.ok) return
    applyGuideState(begun.state)
    if (starterId) setCollaborateStarterId(starterId)
    // Sending from the docked companion or the narrow overlay keeps the
    // visitor where they are; only a page-context send opens the chat view.
    if (guidePresentation === 'page') navigateToCollaborateChat()
    void completeGuideTurn(begun.state)
  }

  /** The network half of a send. Every state resolution carries the turn's
   *  generation, so a response arriving after a reset is rejected as stale
   *  and never populates the new conversation. */
  const completeGuideTurn = async (pendingState: GuideConversationState) => {
    const generation = pendingState.generation
    try {
      const res = await fetch('/api/collaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Role + content only — never timestamps (guideMessagesForApi strips
        // them) and never anything but the transcript and session id.
        body: JSON.stringify({
          sessionId: pendingState.sessionId,
          messages: guideMessagesForApi(pendingState.turns),
        }),
      })
      const data: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const failed = failTurn(
          guideStateRef.current ?? pendingState,
          generation,
          res.status === 503 ? 'offline' : 'generic',
        )
        if (failed) applyGuideState(failed)
        return
      }
      const payload = parseGuideAnswer(data)
      const resolved = resolveTurn(
        guideStateRef.current ?? pendingState,
        generation,
        payload,
        guideDepsRef.current,
      )
      if (!resolved) return // stale: a reset replaced this conversation
      applyGuideState(resolved.state)
      setCollaborateGuideTopic(resolved.topic)
      trackEvent({
        name: 'collaborate_guide_answered',
        params: { topic: resolved.topic, model_class: payload.modelClass },
      })
      // If the transcript isn't on screen (minimized), flag the new answer
      // for the resume chrome — never transcript text, just the status.
      if (!guideTranscriptVisibleRef.current) setGuideUnseenAnswer(true)
    } catch {
      // Roll the optimistic visitor turn back so nothing is lost; the typed
      // draft is restored and the error card offers retry + email.
      const failed = failTurn(guideStateRef.current ?? pendingState, generation, 'generic')
      if (failed) applyGuideState(failed)
    }
  }

  const retryGuideMessage = () => {
    const lastAttempt = guideStateRef.current?.lastAttempt
    if (lastAttempt) sendGuideMessage(lastAttempt)
  }

  /** Confirmed "start new conversation": clears turns, heading, draft,
   *  errors, share state, and the canvas starter/topic treatments, and bumps
   *  the generation so any in-flight response is rejected as stale. */
  const resetGuide = () => {
    const current = guideStateRef.current
    if (!current) return
    applyGuideState(resetGuideConversation(current, guideDepsRef.current))
    setCollaborateStarterId(null)
    setCollaborateGuideTopic(null)
    setGuidePresentation('page')
    setGuideOverlayOpen(false)
    setGuideUnseenAnswer(false)
  }

  const handleGuideDraftChange = (draft: string) => {
    const current = guideStateRef.current
    if (current) applyGuideState(setGuideDraft(current, draft))
  }

  /** Consented share of the transcript. The reply email goes only to the
   *  share endpoint — never to the guide endpoint or analytics. */
  const shareGuideConversation = async (replyEmail: string) => {
    const current = guideStateRef.current
    if (!current) return
    const generation = current.generation
    const sending = beginGuideShare(current, generation)
    if (!sending) return
    applyGuideState(sending)
    try {
      const lastAssistant = latestAssistantTurn(current.turns)
      const res = await fetch('/api/collaborate/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: guideMessagesForApi(current.turns),
          consentVersion: 'v1',
          ...(replyEmail.trim() ? { replyEmail: replyEmail.trim() } : {}),
          ...(lastAssistant
            ? {
                modelRoute: {
                  modelClass: lastAssistant.modelClass,
                  profileVersion: lastAssistant.profileVersion,
                },
              }
            : {}),
        }),
      })
      const data: unknown = await res.json().catch(() => null)
      const body = (typeof data === 'object' && data !== null ? data : {}) as Record<
        string,
        unknown
      >
      if (!res.ok || body.ok !== true || typeof body.receiptId !== 'string') {
        throw new Error('share failed')
      }
      const next = resolveGuideShare(guideStateRef.current ?? current, generation, body.receiptId)
      if (next) applyGuideState(next)
    } catch {
      const next = failGuideShare(guideStateRef.current ?? current, generation)
      if (next) applyGuideState(next)
    }
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
    // Force the scale-in to restart immediately: the canvas snaps the glyph
    // population to the logo center before the next RAF.
    sceneCanvasRef.current?.setLandingLogoScale(0)
    resetActionsVisuals()
    setDiagnostics((prev) => ({
      ...prev,
      phase: 'logo-scale',
      elapsedMs: 0,
      phaseProgress: 0,
      overallProgress: 0,
      logoScale: 0,
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

    sceneCanvasRef.current?.setLandingLogoScale(next.logoScale)

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
      logoScale: next.logoScale,
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
      timing: { ...portfolioIntroPreset.timing },
      scene: { ...sceneConfig },
      sourceLayout: { ...sourceLayout },
    }
    const json = JSON.stringify(payload, null, 2)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(json).catch(() => {})
    }
  }

  const handlePlaygroundConfigChange = (
    patch: Partial<PlaygroundConfig>,
    historyKey?: string,
  ) => {
    vibeTouchedRef.current = true
    const key = historyKey ?? deriveConfigHistoryKey(playgroundConfigRef.current, patch)
    // Parametric transitions (enter/leave) and variant swaps replace the
    // target field's identity, so they discard paint — with confirmation.
    if (patch.motion) {
      const prevMotion = playgroundConfigRef.current.motion
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
          const before = captureVibeSnapshot()
          sceneCanvasRef.current?.clearPaint()
          lastPaintSnapshotRef.current =
            sceneCanvasRef.current?.capturePaintState() ?? createEmptyPaintSnapshot()
          setPlaygroundConfig((prev) => ({ ...prev, ...patch }))
          playgroundConfigRef.current = { ...playgroundConfigRef.current, ...patch }
          recordVibeTransaction('config', key, before, captureVibeSnapshot())
        })
        return
      }
    }
    const before = captureVibeSnapshot()
    setPlaygroundConfig((prev) => ({ ...prev, ...patch }))
    playgroundConfigRef.current = { ...playgroundConfigRef.current, ...patch }
    recordVibeTransaction('config', key, before, captureVibeSnapshot())
  }

  // Ambient scene carousel: one history transaction per step (undo/redo
  // restores scenes immediately — no wipe on replay). The outgoing canvas is
  // captured BEFORE the new scene config applies; when beginAmbientWipe
  // declines (reduced motion / wipe already running) it still fires
  // onAmbientWipeEnd via microtask, so the nav lock always releases.
  const handleAmbientNavigate = (direction: 'next' | 'prev') => {
    if (ambientWipeActive) return
    const current = resolveAmbientSceneId(playgroundConfigRef.current.ambient)
    const next = nextAmbientSceneId(current, direction)
    if (sceneCanvasRef.current?.beginAmbientWipe(direction)) {
      setAmbientWipeActive(true)
    }
    handlePlaygroundConfigChange({ ambient: buildSceneAmbientConfig(next) }, 'ambient.scene')
    const index = ambientSceneIndex(next)
    setAmbientSceneLabel(`${AMBIENT_SCENES[index].label} · ${index + 1} of ${AMBIENT_SCENE_COUNT}`)
    if (ambientSceneLabelTimeoutRef.current !== null) {
      window.clearTimeout(ambientSceneLabelTimeoutRef.current)
    }
    ambientSceneLabelTimeoutRef.current = window.setTimeout(() => {
      setAmbientSceneLabel(null)
      ambientSceneLabelTimeoutRef.current = null
    }, 1800)
  }

  // The wipe completed (or never started): release the nav lock.
  const handleAmbientWipeEnd = () => setAmbientWipeActive(false)

  // Sound control: the transport locks out while a clip records (same gate as
  // the toolbar's Reset/Share), and the direction button cycles the sweep.
  const clipRecordingActive =
    clipRecorder.phase === 'recording' || clipRecorder.phase === 'processing'
  const SOUND_DIRECTION_CYCLE: readonly SonificationDirection[] = [
    'left-to-right',
    'top-to-bottom',
    'right-to-left',
    'bottom-to-top',
  ]
  const handleSoundPlay = () => {
    if (clipRecordingActive) return
    sonification.play()
  }
  const handleSoundPause = () => {
    if (clipRecordingActive) return
    sonification.pause()
  }
  const handleSoundDisable = () => {
    sonification.stop()
    setSoundExpanded(false)
  }
  const handleSoundCycleDirection = () => {
    const current = sonification.config.direction
    const index = SOUND_DIRECTION_CYCLE.indexOf(current)
    const next = SOUND_DIRECTION_CYCLE[(index + 1) % SOUND_DIRECTION_CYCLE.length]
    sonification.updateConfig({ direction: next })
  }

  // Leaving vibe (or closing the control dock) stops the sonification scanner
  // and collapses the sound control — playback never outlives its UI. The
  // hook's own `enabled` gate already stops the engine on leaving vibe; this
  // also covers the dock closing in place.
  useEffect(() => {
    if (displayed === 'vibe' && vibeControlsOpen) return
    setSoundExpanded(false)
    sonification.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed, vibeControlsOpen])

  // The scene label chip never outlives vibe mode or the session.
  useEffect(() => {
    if (displayed !== 'vibe') {
      if (ambientSceneLabelTimeoutRef.current !== null) {
        window.clearTimeout(ambientSceneLabelTimeoutRef.current)
        ambientSceneLabelTimeoutRef.current = null
      }
      setAmbientSceneLabel(null)
      setAmbientWipeActive(false)
    }
  }, [displayed])
  useEffect(
    () => () => {
      if (ambientSceneLabelTimeoutRef.current !== null) {
        window.clearTimeout(ambientSceneLabelTimeoutRef.current)
      }
    },
    [],
  )

  // Glyph text commits as ONE transaction per editing session (the panel
  // normalizes and commits on blur), so undo restores the previous text.
  const handleCommitGlyphText = (text: string) => {
    vibeTouchedRef.current = true
    const before = captureVibeSnapshot()
    setPlaygroundConfig((prev) => ({ ...prev, glyphText: text }))
    playgroundConfigRef.current = { ...playgroundConfigRef.current, glyphText: text }
    recordVibeTransaction('text', null, before, captureVibeSnapshot())
  }

  // Reset restores EVERYTHING to the curated default composition: the full
  // editable config (text, palette, background, font, color mode, scale,
  // motion), the paint tool, and the source (any uploaded image is cleared
  // back to the built-in default). Full Reset is immediate — no confirmation
  // — and deliberately NOT undoable: the history is dropped and every object
  // URL the session still references is released.
  const handleResetPlaygroundConfig = () => {
    vibeTouchedRef.current = false
    // The sonification scanner stops on reset; the visitor presses Play again.
    sonification.stop()
    // Reset restores the CURRENT themed default (feature/light-dark) and —
    // by clearing the touched flag — resumes following the system theme.
    const defaultConfig = resolveVibeDefault(themeRef.current)
    setPlaygroundConfig(clonePlaygroundConfig(defaultConfig))
    playgroundConfigRef.current = cloneVibeConfig(defaultConfig)
    sceneCanvasRef.current?.clearPaint()
    lastPaintSnapshotRef.current = createEmptyPaintSnapshot()
    const defaultPaintTool: PaintToolConfig = {
      enabled: false,
      tool: 'paint',
      glyphColor: PAINT_DEFAULT_GLYPH_COLOR,
      backgroundColor: 'none',
      brushDiameter: PAINT_BRUSH_DIAMETER_DEFAULT,
    }
    setPaintTool(defaultPaintTool)
    paintToolRef.current = defaultPaintTool
    // History is dropped without per-entry release; the registry revokes
    // every owned URL at once (history-retained and live alike), exactly once.
    clearVibeHistory(vibeHistoryRef.current)
    setUploadedSource(null)
    uploadedSourceRef.current = null
    urlRegistryRef.current.releaseOrphans(new Set())
    setUploadError(null)
    syncVibeHistoryFlags()
  }

  const handlePaintToolChange = (patch: Partial<PaintToolConfig>, historyKey?: string) => {
    const before = captureVibeSnapshot()
    // Off→on selects BOTH paint targets at their defaults, so enabling paint
    // is immediately usable. Later target toggles are honored unchanged, and
    // enabling never clears the existing paint overlay.
    const applied =
      patch.enabled === true && !paintToolRef.current.enabled
        ? {
            ...patch,
            glyphColor: PAINT_DEFAULT_GLYPH_COLOR,
            backgroundColor: PAINT_DEFAULT_BACKGROUND_COLOR,
          }
        : patch
    setPaintTool((prev) => ({ ...prev, ...applied }))
    paintToolRef.current = { ...paintToolRef.current, ...applied }
    const key = historyKey ?? Object.keys(applied).sort().join(',')
    recordVibeTransaction('paint-tool', key, before, captureVibeSnapshot())
  }

  // A completed stroke is one transaction: the before snapshot was captured
  // after the previous paint-affecting event, the after comes from the canvas.
  const handlePaintStrokeEnd = () => {
    const canvas = sceneCanvasRef.current
    if (!canvas) return
    const before = captureVibeSnapshot()
    lastPaintSnapshotRef.current = canvas.capturePaintState()
    recordVibeTransaction('paint-stroke', null, before, captureVibeSnapshot())
  }

  // Clear paint (Paint popout action): a compound before/after paint swap.
  const handleClearPaint = () => {
    const canvas = sceneCanvasRef.current
    if (!canvas || canvas.getPaintStatus().strokeCount === 0) return
    const before = captureVibeSnapshot()
    canvas.clearPaint()
    lastPaintSnapshotRef.current = canvas.capturePaintState()
    recordVibeTransaction('clear-paint', null, before, captureVibeSnapshot())
  }

  // Apply a history snapshot in either direction: config, paint tool, paint
  // overlay, and upload reference. No analytics fire here — events belong to
  // the forward action only.
  const applyVibeSnapshot = (snapshot: VibeStateSnapshot) => {
    vibeTouchedRef.current = true
    if (snapshot.config.ambient.mode !== playgroundConfigRef.current.ambient.mode) {
      vibeAmbientHistoryAppliesRef.current += 1
    }
    setPlaygroundConfig(cloneVibeConfig(snapshot.config))
    playgroundConfigRef.current = cloneVibeConfig(snapshot.config)
    setPaintTool({ ...snapshot.paintTool })
    paintToolRef.current = { ...snapshot.paintTool }
    sceneCanvasRef.current?.restorePaintState(snapshot.paint)
    lastPaintSnapshotRef.current = clonePaintSnapshot(snapshot.paint)
    const nextSource = snapshot.upload ? { ...snapshot.upload } : null
    setUploadedSource(nextSource)
    uploadedSourceRef.current = nextSource
    setUploadError(null)
  }

  const handleUndoVibe = () => {
    if (!canUndoVibe(vibeHistoryRef.current, uploadPendingRef.current)) return
    const transaction = undoTransaction(vibeHistoryRef.current)
    if (!transaction) return
    applyVibeSnapshot(transaction.before)
    syncVibeHistoryFlags()
  }

  const handleRedoVibe = () => {
    if (!canRedoVibe(vibeHistoryRef.current, uploadPendingRef.current)) return
    const transaction = redoTransaction(vibeHistoryRef.current)
    if (!transaction) return
    applyVibeSnapshot(transaction.after)
    syncVibeHistoryFlags()
  }

  // Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) redoes — scoped to
  // vibe mode and never intercepted inside editable fields, where native
  // text undo wins.
  useEffect(() => {
    const handleHistoryKeys = (event: KeyboardEvent) => {
      if (displayed !== 'vibe') return
      const tag = (event.target as HTMLElement | null)?.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey) {
        event.preventDefault()
        handleRedoVibe()
      } else if (key === 'z') {
        event.preventDefault()
        handleUndoVibe()
      } else if (key === 'y') {
        event.preventDefault()
        handleRedoVibe()
      }
    }
    window.addEventListener('keydown', handleHistoryKeys)
    return () => window.removeEventListener('keydown', handleHistoryKeys)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed])

  // Presets apply a complete authored composition, resolved against the
  // ACTIVE theme at selection time (feature/light-dark) — the resolution
  // sticks: later system changes never overwrite an applied preset. A preset
  // with a sourceUrl swaps the field's source to that built-in SVG; one
  // without clears any upload back to the default source. Paint is discarded
  // (with confirmation). The whole swap is ONE compound transaction: undo
  // restores the previous config, paint, and upload together.
  const handleApplyVibePreset = (id: string) => {
    const preset = getVibePreset(id)
    if (!preset) return
    withPaintConfirmation(() => {
      const before = captureVibeSnapshot()
      sceneCanvasRef.current?.clearPaint()
      lastPaintSnapshotRef.current =
        sceneCanvasRef.current?.capturePaintState() ?? createEmptyPaintSnapshot()
      vibeTouchedRef.current = true
      const resolvedPreset = resolvePlaygroundConfig(preset.config, themeRef.current)
      setPlaygroundConfig(clonePlaygroundConfig(resolvedPreset))
      playgroundConfigRef.current = cloneVibeConfig(resolvedPreset)
      setUploadError(null)
      const nextSource: UploadedSourceState | null = preset.sourceUrl
        ? { kind: 'svg', url: preset.sourceUrl, filename: `${preset.label} source` }
        : null
      setUploadedSource(nextSource)
      uploadedSourceRef.current = nextSource
      recordVibeTransaction('preset', null, before, captureVibeSnapshot())
      trackEvent({ name: 'preset_change', params: { preset_id: preset.id } })
      trackEvent({ name: 'source_change', params: { source: preset.sourceUrl ? 'preset' : 'builtin' } })
    })
  }

  const handleUploadSource = (file: File) => {
    withPaintConfirmation(() => {
      // Capture the pre-upload state up front so a promoted candidate's undo
      // restores the paint and the previous source together. The confirmed
      // paint discard itself is DEFERRED to promotion: a failed upload is a
      // no-op transaction that leaves the field (and its paint) untouched.
      const before = captureVibeSnapshot()
      void performUploadSource(file, before)
    })
  }

  // Transactional upload (mobile SVG-loading hardening): the current artwork
  // stays on the field while the candidate validates (phase 1) and proves it
  // decodes to a field with visible targets (phase 2); only then is it
  // promoted and recorded in history (phase 3). Any failure retains the prior
  // source and field, revokes the candidate's Blob URL exactly once
  // (registry), stops the pending state, and shows the friendly error copy.
  const performUploadSource = async (file: File, before: VibeStateSnapshot) => {
    vibeTouchedRef.current = true
    const requestId = ++uploadRequestRef.current
    setUploadPending(true)
    setUploadError(null)

    // Phase 1 — validate. Routing never trusts an exact MIME match (mobile
    // pickers report empty/generic values); the SVG parse or the raster
    // magic-byte sniff is the real check. The Blob URL is minted from the
    // sanitized, size-normalized markup and registry-owned from creation.
    const route = resolveUploadRoute(file)
    let candidate: UploadedSourceState | null = null
    let candidateOwnedUrl: string | null = null
    let failure: string | null = null

    if (route === 'svg') {
      const svgResult = await readUploadedSvg(file)
      if (svgResult.ok) {
        const url = createSvgObjectUrl(svgResult.markup)
        urlRegistryRef.current.own(url)
        candidate = { kind: 'svg', url, filename: svgResult.filename }
        candidateOwnedUrl = url
      } else {
        failure = svgResult.error
      }
    } else if (route === 'raster') {
      const rasterResult = await readUploadedRaster(file)
      if (rasterResult.ok) {
        urlRegistryRef.current.own(rasterResult.url)
        candidate = { kind: 'raster', url: rasterResult.url, filename: rasterResult.filename }
        candidateOwnedUrl = rasterResult.url
      } else {
        failure = rasterResult.error
      }
    } else {
      failure = UNSUPPORTED_SOURCE_TYPE_ERROR
    }

    // Phase 2 — probe: decode and sample the candidate BEFORE promoting it.
    // The decode cache (engine/svgTargetSource) dedupes this with the
    // renderer's own rebuild, so promotion never triggers a second decode
    // that could fail or flash the fallback.
    if (candidate && !failure) {
      const probe = await loadSvgTargets({
        url: candidate.url,
        kind: candidate.kind,
        bounds: {
          width: Math.max(1, window.innerWidth),
          height: Math.max(1, window.innerHeight),
        },
        samplingStep: sourceLayout.samplingStep,
        alphaThreshold: sourceLayout.alphaThreshold,
        margin: sourceLayout.margin,
        fit: sourceLayout.fit,
      })
      const decision = resolveSourcePromotion(
        { ok: probe.ok, targetCount: probe.x.length, error: probe.error },
        candidate.kind,
      )
      if (!decision.promote) failure = decision.error
    }

    if (requestId !== uploadRequestRef.current) {
      // A newer upload took over mid-flight: release this attempt's URL and
      // leave the pending/error state (and the field) to the winner.
      if (candidateOwnedUrl) urlRegistryRef.current.release(candidateOwnedUrl)
      return
    }

    if (candidate && !failure) {
      // Phase 3 — promote: only now does the source swap, the confirmed paint
      // discard happen, and history record the transaction (undo restores the
      // previous source and paint together).
      sceneCanvasRef.current?.clearPaint()
      lastPaintSnapshotRef.current =
        sceneCanvasRef.current?.capturePaintState() ?? createEmptyPaintSnapshot()
      setUploadedSource(candidate)
      uploadedSourceRef.current = candidate
      setUploadError(null)
      recordVibeTransaction('source', null, before, captureVibeSnapshot())
      trackEvent({ name: 'upload_result', params: { mime_type: file.type || 'unknown', ok: true } })
      trackEvent({ name: 'source_change', params: { source: 'upload' } })
    } else {
      // Rejection: the prior source and field stay live; the failed
      // candidate's URL is released exactly once.
      if (candidateOwnedUrl) urlRegistryRef.current.release(candidateOwnedUrl)
      setUploadError(getFriendlyUploadError(failure ?? UNSUPPORTED_SOURCE_TYPE_ERROR))
      trackEvent({ name: 'upload_result', params: { mime_type: file.type || 'unknown', ok: false } })
    }
    setUploadPending(false)
  }

  // Seasonal landing atmosphere: resolve once on mount (client-only — the
  // inputs are the local clock and Intl locale/timezone, both injected into
  // the pure resolver) and apply immediately at full intensity. Never live
  // weather; see engine/seasonalAtmosphere.
  useEffect(() => {
    const resolved = Intl.DateTimeFormat().resolvedOptions()
    setLandingAmbient(
      resolveSeasonalAtmosphere(
        captureSeasonalAtmosphereInput(new Date(), {
          locale: resolved.locale,
          timeZone: resolved.timeZone,
        }),
      ),
    )
  }, [])

  // Leaving vibe settles back to the closed-card presentation; if the
  // invitation card remounts, return keyboard focus to its "Make it yours"
  // CTA.
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

  // The scene's source selection: the landing is ALWAYS the responsive
  // landing variant — SceneCanvas resolves logotype (desktop) vs monogram
  // (mobile) at build time from its own measured canvas width, so a cold
  // mobile load never briefly builds the desktop source. Work/collaborate
  // sample their resolved static SVGs; vibe samples the uploaded image or
  // the built-in monogram. (The animated Black-hole provider is retained in
  // engine/animatedSource.ts but is not a selectable production option —
  // nothing here can construct it.)
  const sceneSource = useMemo<SceneSourceSelection>(() => {
    if (displayed === 'intro') {
      return { kind: 'responsive-landing' }
    }
    if (displayed === 'work') {
      if (!workDescriptor.sourceUrl) return { kind: 'builtin' }
      // Theme-aware source (feature/light-dark): a slide/story may carry an
      // optional lightSourceUrl twin (e.g. a wordmark that would vanish on
      // the light field). Absent = the base source in both themes.
      const activeSlide = getWorkSlide(workSlideIndex)
      const lightSourceUrl =
        activeSlide.kind === 'intro'
          ? (activeSlide as { lightSourceUrl?: string }).lightSourceUrl
          : (activeSlide.story as { lightSourceUrl?: string }).lightSourceUrl
      return {
        kind: 'static',
        url: resolveThemedSourceUrl(workDescriptor.sourceUrl, lightSourceUrl, theme),
        sourceKind: workDescriptor.sourceKind ?? 'svg',
      }
    }
    if (displayed === 'collaborate') {
      return collaborateDescriptor.sourceUrl
        ? { kind: 'static', url: collaborateDescriptor.sourceUrl, sourceKind: 'svg' }
        : { kind: 'builtin' }
    }
    if (uploadedSource) {
      return { kind: 'static', url: uploadedSource.url, sourceKind: uploadedSource.kind }
    }
    return { kind: 'builtin' }
  }, [displayed, workDescriptor, collaborateDescriptor, uploadedSource, workSlideIndex, theme])

  // The landing runs on the themed canvas gradient (engine/theme) with the
  // seasonal atmosphere adopted as soon as it resolves; the work/collaborate
  // scenes resolve their themed baselines against the active theme; vibe
  // keeps its own playground config untouched.
  const scenePlayground = useMemo<PlaygroundConfig>(() => {
    if (displayed === 'work') return resolveScenePlayground(workDescriptor, theme)
    if (displayed === 'collaborate') return resolveScenePlayground(collaborateDescriptor, theme)
    if (displayed === 'intro') {
      return {
        ...playgroundConfig,
        backgroundColor1: LANDING_CANVAS_GRADIENT[theme].color1,
        backgroundColor2: LANDING_CANVAS_GRADIENT[theme].color2,
        // The landing field spells the site URL and takes its colors from the
        // recolored source field (the themed landing gradient, applied in
        // SceneCanvas) — never the ROYGBV image-gradient palette.
        glyphText: 'joelhoke.me.',
        glyphColorMode: 'source-colors',
        ambient: landingAmbient ?? playgroundConfig.ambient,
      }
    }
    return playgroundConfig
  }, [displayed, workDescriptor, collaborateDescriptor, playgroundConfig, landingAmbient, theme])

  // Vibe surface status: a subtle indicator for the upload lifecycle, kept
  // visible even if the visitor hides the control dock mid-processing.
  const vibeStatus: VibeSurfaceStatus | null = uploadPending
    ? { state: 'processing', message: VIBE_UPLOAD_PENDING_LABEL }
    : uploadError
      ? { state: 'error', message: uploadError }
      : null

  // The collaborate chat shell is on screen (guide flag on, chat subview):
  // on mobile this hides the persistent nav to reclaim vertical space.
  const collaborateChatActive =
    COLLABORATE_AI_GUIDE && displayed === 'collaborate' && collaborateView === 'chat'

  // Guide companion chrome: the conversation off the full chat page. The
  // docked companion (wide), the minimized resume bar/pill, and the narrow
  // modal overlay are mutually exclusive; each requires a live conversation
  // and none appears on the chat page itself.
  const guideConversationActive =
    COLLABORATE_AI_GUIDE && !!guideState && guideState.turns.length > 0
  const guideChromeOffPage = guideConversationActive && !collaborateChatActive
  const guideCompanionVisible = guideChromeOffPage && guidePresentation === 'companion'
  const guideOverlayVisible =
    guideChromeOffPage && guidePresentation === 'minimized' && guideOverlayOpen
  const guideMinimizedVisible =
    guideChromeOffPage && guidePresentation === 'minimized' && !guideOverlayOpen
  const guideResumeStatus = guideMinimizedVisible
    ? resolveGuideMinimizedStatus(guideState, guideUnseenAnswer)
    : null

  // Whether the transcript is on screen (page, companion, or overlay) —
  // answers arriving while it is hidden flag the resume chrome instead.
  const guideTranscriptVisibleRef = useRef(true)
  useEffect(() => {
    guideTranscriptVisibleRef.current =
      collaborateChatActive || guideCompanionVisible || guideOverlayVisible
  })

  // Narrow modal overlay: focus containment, Escape back to the resume bar,
  // and inert background content (nav, canvas, foreground) while it is open.
  useEffect(() => {
    if (!guideOverlayVisible) return
    const overlay = guideOverlayRef.current
    const shell = overlay?.parentElement
    if (!overlay || !shell) return
    const background = Array.from(shell.children).filter((el) => el !== overlay)
    background.forEach((el) => el.setAttribute('inert', ''))
    chatHeadingRef.current?.focus({ preventScroll: true })
    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        guideOverlayRestoreFocusRef.current = true
        setGuideOverlayOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusables = Array.from(
        overlay.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => el.getClientRects().length > 0)
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !overlay.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !overlay.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      background.forEach((el) => el.removeAttribute('inert'))
      document.removeEventListener('keydown', onKeyDown, true)
      if (guideOverlayRestoreFocusRef.current) {
        guideOverlayRestoreFocusRef.current = false
        guideResumeRef.current?.focus({ preventScroll: true })
      }
    }
  }, [guideOverlayVisible])

  return (
    <div
      className={`portfolio-shell${guideCompanionVisible ? ' portfolio-shell--guide-companion' : ''}${
        guideMinimizedVisible ? ' portfolio-shell--guide-minimized' : ''
      }${guideOverlayVisible ? ' portfolio-shell--guide-overlay' : ''}`}
    >
      {/* Static branded layer behind the canvas: visible only while the
          canvas has not painted (no JS / no 2D context). */}
      <CanvasFallback />
      <SceneCanvas
        ref={sceneCanvasRef}
        theme={theme}
        tuningMode={tuningMode}
        sequenceDiagnostics={diagnostics}
        experience={displayed}
        sceneId={
          displayed === 'work'
            ? `work/${getWorkSlideId(getWorkSlide(workSlideIndex))}`
            : displayed === 'collaborate'
              ? `collaborate/${collaborateStarterId ?? 'default'}${
                  collaborateGuideTopic ? `/${collaborateGuideTopic}` : ''
                }`
              : displayed
        }
        mouseR={sceneConfig.mouseR}
        particleRepel={sceneConfig.particleRepel}
        weatherRepelMult={sceneConfig.weatherRepelMult}
        clickImpulseRadius={sceneConfig.clickImpulseRadius}
        clickImpulseForce={sceneConfig.clickImpulseForce}
        sourceLayout={sourceLayout}
        source={sceneSource}
        targetRegion={displayed === 'work' ? workTargetRegion : null}
        playgroundConfig={scenePlayground}
        paintTool={displayed === 'vibe' ? paintTool : undefined}
        onPaintStatusChange={setPaintStatus}
        onPaintStrokeEnd={handlePaintStrokeEnd}
        qualityTierOverride={qualityTierOverride}
        onQualityTierChange={(from, to) =>
          trackEvent({ name: 'tier_transition', params: { from_tier: from, to_tier: to } })
        }
        pond={
          displayed === 'vibe' && (pondEnabled || (tuningMode && pondConfig.enabled))
            ? activePondConfig
            : undefined
        }
        pondCharacter={pondCharacter}
        onAmbientWipeEnd={handleAmbientWipeEnd}
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
          className={collaborateChatActive ? 'experience-nav--chat-active' : undefined}
        />
      )}
      <AnalyticsConsent onClient={(client) => (analyticsClientRef.current = client)} />
      <main
        id="main-content"
        tabIndex={-1}
        className={`foreground-layer${
          displayed === 'collaborate' ? ' foreground-layer--collaborate' : ''
        }${collaborateChatActive ? ' foreground-layer--chat' : ''}`}
      >
        <ExperienceTransition phase={transitionPhase}>
          <div
            className={`foreground-content${
              collaborateChatActive ? ' foreground-content-chat' : ''
            }`}
          >
            {displayed === 'intro' ? (
              <>
                {/* Accessible landing heading: the visible mark is the canvas
                    glyph logotype, so the h1 stays visually hidden. */}
                <h1 className="visually-hidden">joel hoke design</h1>
                <PrimaryActions
                  selected={selected}
                  onSelect={navigateTo}
                  groupRef={actionsRef}
                />
              </>
            ) : displayed === 'work' ? (
              <div className="work-layout">
                {/* Glyph stage: its measured rect positions the hero (fit per
                    the active slide's hero policy — 'viewport' samples at
                    full-viewport size centered on the stage, 'stage' is
                    contained inside the stage bounds) and marks the
                    canvas-dedicated gesture area. Empty and
                    pointer-transparent — the fixed canvas beneath stays
                    interactive. Its geometry does not change when the card
                    expands, so expansion never morphs the canvas. */}
                <div className="work-glyph-stage" aria-hidden="true" ref={glyphStageRef} />
                <WorkExperience
                  slides={WORK_SLIDES}
                  activeIndex={workSlideIndex}
                  onIndexChange={setWorkSlideIndex}
                  headingRef={modeHeadingRef}
                  titleBase={BASE_DOCUMENT_TITLE}
                  modeTitle={EXPERIENCE_SCENES.work.copy.documentTitle}
                  expansionProgress={workExpansionProgress}
                  onExpansionProgressChange={setWorkExpansionProgress}
                  onExpansionMetricsChange={(metrics) => {
                    workOverflowEligibleRef.current = metrics.eligible
                    workExpansionRangeRef.current = metrics.rangePx
                  }}
                  onTrackEvent={trackEvent}
                />
              </div>
            ) : displayed === 'collaborate' ? (
              <CollaborateExperience
                selectedStarterId={collaborateStarterId}
                onSelectStarter={setCollaborateStarterId}
                headingRef={modeHeadingRef}
                guide={
                  guideState
                    ? {
                        view: collaborateView,
                        state: guideState,
                        chatHeadingRef,
                        onSend: sendGuideMessage,
                        onRetry: retryGuideMessage,
                        onReset: resetGuide,
                        onShare: shareGuideConversation,
                        onDraftChange: handleGuideDraftChange,
                        onNavigateToChat: navigateToCollaborateChat,
                        onNavigateToLanding: navigateToCollaborateLanding,
                        onPopOut: exitGuideChatPage,
                        popOutLabel: guideWideViewport
                          ? COLLABORATE_GUIDE_POP_OUT_LABEL
                          : COLLABORATE_GUIDE_MINIMIZE_LABEL,
                        onSourceNavigate: handleGuideSourceNavigate,
                      }
                    : undefined
                }
              />
            ) : (
              <VibeExperience
                headingRef={modeHeadingRef}
                status={vibeControlsOpen ? null : vibeStatus}
                controlsOpen={vibeControlsOpen}
                onOpenControls={() => setVibeControlsOpen(true)}
                ctaRef={vibeCtaRef}
                controlsId={vibeToolbarId}
              />
            )}
          </div>
        </ExperienceTransition>
      </main>
      {/* Docked companion (wide viewports): a nonmodal complementary region
          alongside Work/Vibe. Rendered at the shell level — inside the
          foreground layers a fixed panel would be trapped by the work panel's
          backdrop-filter containing block (same trap as the media lightbox). */}
      {guideCompanionVisible && guideState && (
        <aside className="guide-companion" role="complementary" aria-label="Joel’s guide conversation">
          <ChatShell
            variant="companion"
            heading={guideState.heading}
            state={guideState}
            headingRef={chatHeadingRef}
            onSend={(content) => sendGuideMessage(content)}
            onRetry={retryGuideMessage}
            onDraftChange={handleGuideDraftChange}
            onShare={shareGuideConversation}
            onMinimize={minimizeGuideCompanion}
            minimizeLabel={COLLABORATE_GUIDE_MINIMIZE_LABEL}
            onExpand={openGuideFullConversation}
            onSourceNavigate={handleGuideSourceNavigate}
          />
        </aside>
      )}
      {/* Narrow modal overlay: the full-viewport conversation over the current
          site (hash untouched). Focus is contained and the background is inert
          while it is open (effect above). */}
      {guideOverlayVisible && guideState && (
        <div
          className="guide-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Conversation with Joel’s guide"
          ref={guideOverlayRef}
        >
          <ChatShell
            variant="modal"
            heading={guideState.heading}
            state={guideState}
            headingRef={chatHeadingRef}
            onSend={(content) => sendGuideMessage(content)}
            onRetry={retryGuideMessage}
            onDraftChange={handleGuideDraftChange}
            onShare={shareGuideConversation}
            onMinimize={closeGuideOverlay}
            minimizeLabel={COLLABORATE_GUIDE_MINIMIZE_LABEL}
            onSourceNavigate={handleGuideSourceNavigate}
          />
        </div>
      )}
      {/* Minimized chrome: the guide title plus pending/new-answer status —
          never transcript text. A bottom bar on narrow screens (safe-area
          aware), a compact pill on desktop. */}
      {guideMinimizedVisible && guideState && (
        <div className="guide-resume">
          <button
            type="button"
            className="guide-resume-button"
            ref={guideResumeRef}
            onClick={handleGuideResume}
          >
            <span className="guide-resume-title">
              {guideState.heading ?? COLLABORATE_GUIDE_PENDING_HEADING}
            </span>
            {guideResumeStatus && (
              <span className="guide-resume-status" role="status">
                {guideResumeStatus === 'pending'
                  ? COLLABORATE_GUIDE_RESUME_PENDING_STATUS
                  : COLLABORATE_GUIDE_RESUME_UNSEEN_STATUS}
              </span>
            )}
            <span className="visually-hidden"> — {COLLABORATE_GUIDE_RESUME}</span>
          </button>
        </div>
      )}
      {/* Crawlable work digest: the interactive work surface only mounts after
          client-side hash/navigation state resolves, so the static export
          carries the full story content here instead. Visually hidden but
          semantic; unmounted while the work surface itself is on screen to
          avoid duplicated content for assistive tech. */}
      {displayed !== 'work' && (
        <section className="visually-hidden" aria-label="Work case studies">
          <h2>Work</h2>
          {WORK_SLIDES.map((slide) =>
            slide.kind === 'intro' ? (
              <article key={slide.id}>
                <h3>{slide.title}</h3>
                <p>{slide.copy}</p>
              </article>
            ) : (
              <article key={slide.story.id}>
                <h3>{slide.story.title}</h3>
                <p>{slide.story.thesis}</p>
                <p>
                  {slide.story.role} — {slide.story.context}
                </p>
                <p>{slide.story.outcome}</p>
                {slide.story.access === 'protected' ? (
                  <a href={`/protected-work?story=${slide.story.protectedId}`}>
                    View this confidential case study
                  </a>
                ) : (
                  <>
                    <a href={`#work/${slide.story.id}`}>View this case study</a>
                    {slide.story.links.map((link) => (
                      <a key={link.url} href={link.url}>
                        {link.label}
                      </a>
                    ))}
                  </>
                )}
              </article>
            ),
          )}
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
          {COLLABORATE_SHOW_STARTERS && (
            <ul>
              {CONVERSATION_STARTERS.map((starter) => (
                <li key={starter.id}>
                  {starter.label} {starter.response}
                </li>
              ))}
            </ul>
          )}
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
        <VibeToolbar
          id={vibeToolbarId}
          open={vibeControlsOpen}
          config={playgroundConfig}
          onChange={handlePlaygroundConfigChange}
          onCommitGlyphText={handleCommitGlyphText}
          presets={VIBE_PRESETS}
          onSelectPreset={handleApplyVibePreset}
          onUpload={handleUploadSource}
          privacyNote={VIBE_PRIVACY_NOTE}
          uploadPending={uploadPending}
          uploadPendingLabel={VIBE_UPLOAD_PENDING_LABEL}
          uploadError={uploadError}
          uploadedFilename={uploadedSource?.filename ?? DEFAULT_UPLOADED_SVG_FILENAME}
          paintTool={paintTool}
          onPaintToolChange={handlePaintToolChange}
          paintStatus={paintStatus}
          canUndo={vibeCanUndo}
          canRedo={vibeCanRedo}
          onUndo={handleUndoVibe}
          onRedo={handleRedoVibe}
          onReset={handleResetPlaygroundConfig}
          onClearPaint={handleClearPaint}
          canvasRef={sceneCanvasRef}
          debugMode={tuningMode}
          pond={pondConfig}
          onPondChange={handlePondChange}
          sound={{
            config: sonification.config,
            playback: sonification.playback,
            error: sonification.error,
          }}
          onSoundConfigChange={sonification.updateConfig}
          onSoundPlay={sonification.play}
          onSoundPause={sonification.pause}
          clip={clipRecorder}
        />
      )}
      {displayed === 'vibe' && vibeControlsOpen && (
        <>
          <AmbientCarousel
            onPrevious={() => handleAmbientNavigate('prev')}
            onNext={() => handleAmbientNavigate('next')}
            disabled={ambientWipeActive}
            label={ambientSceneLabel}
          />
          <PondControl
            enabled={pondEnabled}
            character={pondCharacter}
            onToggle={() => setPondEnabled((prev) => !prev)}
            onSelect={setPondCharacter}
          />
          <SoundControl
            expanded={soundExpanded}
            playback={sonification.playback}
            error={sonification.error}
            direction={sonification.config.direction}
            onExpand={() => setSoundExpanded(true)}
            onDisable={handleSoundDisable}
            onPlay={handleSoundPlay}
            onPause={handleSoundPause}
            onCycleDirection={handleSoundCycleDirection}
          />
        </>
      )}
      {displayed === 'vibe' && (
        <SonificationOverlay
          active={sonification.playback === 'playing' || sonification.playback === 'paused'}
          getSweepPosition={sonification.getSweepPosition}
          getActiveDirection={sonification.getActiveDirection}
        />
      )}
      {tuningMode && (
        <TuningPanel
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
          totalDurationMs={getTotalDuration(portfolioIntroPreset.timing)}
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
