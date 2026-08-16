/**
 * Deterministic adaptive quality (Stage 2): a four-tier budget ladder with a
 * hysteresis state machine that steps the whole scene up or down based on
 * measured frame cost — never on heuristics like user-agent sniffing. All
 * logic is pure and clock-injected so scripts/verify-quality-tiers.js can run
 * the full machine in Node.
 *
 * Evaluation cadence: non-overlapping 2-second windows after a 3-second
 * warm-up from mount. Two consecutive bad windows step down, five consecutive
 * good windows step up, and every transition starts a 5-second cooldown
 * during which windows are not evaluated. Windows that contain a hidden tab,
 * a resize, or a source rebuild are ignored entirely (counters untouched).
 */

import { isMobileViewport, MOBILE_GLYPH_CAP } from './displayBudget'
import {
  DESKTOP_CREATURE_DENSITY_CAP,
  MOBILE_CREATURE_DENSITY_CAP,
} from './motionConfig'

export type QualityTier = 0 | 1 | 2 | 3

export type QualityTierBudget = {
  /** Main glyph cap. 0 means "no tier cap" — the existing display budget
   *  (engine/displayBudget) applies unmodified. */
  glyphCap: number
  /** Creature (parametric motion) target cap and compute rate in Hz. */
  creatureCap: number
  creatureRate: number
  /** Ambient agent cap and physics tick rate in Hz. */
  ambientCap: number
  ambientTickHz: number
  /** Animated source sampling rate in Hz; 0 freezes the last computed frame. */
  samplingHz: number
  /** Render devicePixelRatio ceiling. */
  renderPixelRatioCap: number
  /** Background paint layer pixel ratio (kept at 1 on the lower tiers — the
   *  soft-brush layer is blurred anyway, so the fill saving is free). */
  backgroundPaintPixelRatio: number
}

export const QUALITY_TIER_BUDGETS: readonly QualityTierBudget[] = [
  // T0 — full quality.
  {
    glyphCap: 0,
    creatureCap: 2400,
    creatureRate: 60,
    ambientCap: 600,
    ambientTickHz: 30,
    samplingHz: 8,
    renderPixelRatioCap: 2,
    backgroundPaintPixelRatio: 2,
  },
  // T1 — mobile's starting tier.
  {
    glyphCap: 2400,
    creatureCap: 1600,
    creatureRate: 30,
    ambientCap: 360,
    ambientTickHz: 30,
    samplingHz: 6,
    renderPixelRatioCap: 2,
    backgroundPaintPixelRatio: 2,
  },
  // T2.
  {
    glyphCap: 1600,
    creatureCap: 1200,
    creatureRate: 30,
    ambientCap: 220,
    ambientTickHz: 20,
    samplingHz: 4,
    renderPixelRatioCap: 2,
    backgroundPaintPixelRatio: 1,
  },
  // T3 — ambient stays live; only the animated source sampling freezes.
  {
    glyphCap: 1000,
    creatureCap: 800,
    creatureRate: 15,
    ambientCap: 100,
    ambientTickHz: 15,
    samplingHz: 0,
    renderPixelRatioCap: 1.5,
    backgroundPaintPixelRatio: 1,
  },
]

export const QUALITY_TIER_COUNT = QUALITY_TIER_BUDGETS.length
export const MIN_QUALITY_TIER = 0
export const MAX_QUALITY_TIER = QUALITY_TIER_COUNT - 1

// Hysteresis constants (documented in the module header).
export const QUALITY_WARMUP_MS = 3000
export const QUALITY_WINDOW_MS = 2000
export const QUALITY_COOLDOWN_MS = 5000
export const QUALITY_BAD_WINDOWS_TO_STEP_DOWN = 2
export const QUALITY_GOOD_WINDOWS_TO_STEP_UP = 5
/** Bad window: average render cost above this, in ms… */
export const QUALITY_BAD_RENDER_MS = 18
/** …or FPS below this while render cost still exceeds QUALITY_BAD_FPS_RENDER_MS. */
export const QUALITY_BAD_FPS = 48
export const QUALITY_BAD_FPS_RENDER_MS = 12
/** Good window: average render cost below this and FPS at or above the floor. */
export const QUALITY_GOOD_RENDER_MS = 10
export const QUALITY_GOOD_FPS = 55

export type QualityTransitionReason =
  | 'initial'
  | 'mobile-start'
  | 'bad-windows'
  | 'good-windows'
  | 'debug-override'

/** Effective budgets after composing a tier with the existing device caps.
 *  Requested values stay visible in the UI; these are what the engine runs. */
export type EffectiveQualityBudget = {
  tier: QualityTier
  glyphCap: number
  creatureCap: number
  creatureRate: number
  ambientCap: number
  ambientTickHz: number
  samplingHz: number
  renderPixelRatioCap: number
  backgroundPaintPixelRatio: number
}

/** Compose a tier's budgets with the existing mobile caps through min().
 *  A tier glyphCap of 0 (T0) defers to the device budget entirely. */
export function resolveEffectiveQualityBudget(
  tier: QualityTier,
  viewportWidth: number,
): EffectiveQualityBudget {
  const budget = QUALITY_TIER_BUDGETS[tier] ?? QUALITY_TIER_BUDGETS[0]
  const mobile = isMobileViewport(viewportWidth)
  const glyphCap =
    budget.glyphCap === 0
      ? mobile
        ? MOBILE_GLYPH_CAP
        : 0
      : mobile
        ? Math.min(budget.glyphCap, MOBILE_GLYPH_CAP)
        : budget.glyphCap
  return {
    tier,
    glyphCap,
    creatureCap: Math.min(
      budget.creatureCap,
      mobile ? MOBILE_CREATURE_DENSITY_CAP : DESKTOP_CREATURE_DENSITY_CAP,
    ),
    creatureRate: budget.creatureRate,
    ambientCap: budget.ambientCap,
    ambientTickHz: budget.ambientTickHz,
    samplingHz: budget.samplingHz,
    renderPixelRatioCap: budget.renderPixelRatioCap,
    backgroundPaintPixelRatio: budget.backgroundPaintPixelRatio,
  }
}

/**
 * Deterministic stride subsampling of a target field: picks `cap` indices
 * spread evenly across [0, count) — never random, so a given (count, cap)
 * pair always yields the same field. Returns the identity when cap ≥ count.
 */
export function subsampleStrided(count: number, cap: number): Uint32Array {
  const total = Math.max(0, Math.floor(count))
  const target = Math.max(0, Math.floor(cap))
  if (target >= total) {
    const identity = new Uint32Array(total)
    for (let i = 0; i < total; i += 1) identity[i] = i
    return identity
  }
  const out = new Uint32Array(target)
  if (target === 0) return out
  const stride = total / target
  for (let i = 0; i < target; i += 1) {
    out[i] = Math.min(total - 1, Math.floor(i * stride))
  }
  return out
}

export type QualityFrameSample = {
  /** Wall-clock timestamp of the frame, ms (injected — never read globally). */
  timestampMs: number
  /** Render cost of the frame, ms. */
  renderMs: number
  /** The tab was hidden at some point during this frame's window. */
  hidden?: boolean
  /** A resize landed during this frame's window. */
  resized?: boolean
  /** A source/target rebuild landed during this frame's window. */
  rebuilt?: boolean
  /** An ambient scene wipe ran during this frame's window. */
  wiped?: boolean
}

export type QualityTransition = {
  from: QualityTier
  to: QualityTier
  reason: QualityTransitionReason
}

type WindowAccum = {
  startMs: number
  frames: number
  renderTotalMs: number
  firstFrameMs: number
  lastFrameMs: number
  ignored: boolean
}

export type QualityController = {
  recordFrame: (sample: QualityFrameSample) => QualityTransition | null
  /** Force a tier (debug override) or return to automatic control (null). */
  setOverride: (tier: QualityTier | null, nowMs: number) => QualityTransition | null
  /** The tier a mobile device starts on; desktop starts at T0. */
  getTier: () => QualityTier
  getLastTransitionReason: () => QualityTransitionReason
  isOverrideActive: () => boolean
  /** Test/diagnostic hook: consecutive counters and window state. */
  getStats: () => {
    consecutiveBad: number
    consecutiveGood: number
    warmupUntilMs: number
    cooldownUntilMs: number
    windowActive: boolean
  }
}

/**
 * Create the hysteresis controller. Mobile viewports begin at T1 and may step
 * up to T0 after sustained good performance; desktops begin at T0.
 */
export function createQualityController(options: {
  mobile: boolean
  mountMs: number
}): QualityController {
  let tier: QualityTier = options.mobile ? 1 : 0
  let lastReason: QualityTransitionReason = options.mobile ? 'mobile-start' : 'initial'
  let overrideTier: QualityTier | null = null
  let consecutiveBad = 0
  let consecutiveGood = 0
  const warmupUntilMs = options.mountMs + QUALITY_WARMUP_MS
  let cooldownUntilMs = 0
  let windowState: WindowAccum | null = null

  const transitionTo = (
    to: QualityTier,
    reason: QualityTransitionReason,
    nowMs: number,
  ): QualityTransition | null => {
    if (to === tier) return null
    const transition = { from: tier, to, reason }
    tier = to
    lastReason = reason
    consecutiveBad = 0
    consecutiveGood = 0
    cooldownUntilMs = nowMs + QUALITY_COOLDOWN_MS
    return transition
  }

  const closeWindow = (w: WindowAccum, nowMs: number): QualityTransition | null => {
    // Warm-up, cooldown, override, and ignored windows never evaluate.
    if (w.ignored || nowMs < warmupUntilMs || nowMs < cooldownUntilMs || overrideTier !== null) {
      return null
    }
    if (w.frames === 0) return null
    const avgRenderMs = w.renderTotalMs / w.frames
    const spanMs = w.lastFrameMs - w.firstFrameMs
    const fps = w.frames > 1 && spanMs > 0 ? ((w.frames - 1) / spanMs) * 1000 : 0

    const bad =
      avgRenderMs > QUALITY_BAD_RENDER_MS ||
      (fps < QUALITY_BAD_FPS && avgRenderMs > QUALITY_BAD_FPS_RENDER_MS)
    const good = avgRenderMs < QUALITY_GOOD_RENDER_MS && fps >= QUALITY_GOOD_FPS

    if (bad) {
      consecutiveBad += 1
      consecutiveGood = 0
      if (consecutiveBad >= QUALITY_BAD_WINDOWS_TO_STEP_DOWN && tier < MAX_QUALITY_TIER) {
        return transitionTo((tier + 1) as QualityTier, 'bad-windows', nowMs)
      }
    } else if (good) {
      consecutiveGood += 1
      consecutiveBad = 0
      if (consecutiveGood >= QUALITY_GOOD_WINDOWS_TO_STEP_UP && tier > MIN_QUALITY_TIER) {
        return transitionTo((tier - 1) as QualityTier, 'good-windows', nowMs)
      }
    } else {
      // A neutral window breaks both streaks.
      consecutiveBad = 0
      consecutiveGood = 0
    }
    return null
  }

  const recordFrame = (sample: QualityFrameSample): QualityTransition | null => {
    if (sample.timestampMs < warmupUntilMs) return null
    if (!windowState) {
      windowState = {
        startMs: sample.timestampMs,
        frames: 0,
        renderTotalMs: 0,
        firstFrameMs: sample.timestampMs,
        lastFrameMs: sample.timestampMs,
        ignored: false,
      }
    }
    const w = windowState
    if (sample.hidden || sample.resized || sample.rebuilt || sample.wiped) w.ignored = true
    w.frames += 1
    w.renderTotalMs += sample.renderMs
    w.lastFrameMs = sample.timestampMs
    if (sample.timestampMs - w.startMs < QUALITY_WINDOW_MS) return null
    const transition = closeWindow(w, sample.timestampMs)
    windowState = null
    return transition
  }

  const setOverride = (
    next: QualityTier | null,
    nowMs: number,
  ): QualityTransition | null => {
    const clamped =
      next === null
        ? null
        : (Math.min(MAX_QUALITY_TIER, Math.max(MIN_QUALITY_TIER, Math.round(next))) as QualityTier)
    if (clamped === overrideTier) return null
    overrideTier = clamped
    consecutiveBad = 0
    consecutiveGood = 0
    windowState = null
    if (clamped !== null) {
      return transitionTo(clamped, 'debug-override', nowMs)
    }
    // Releasing the override restarts evaluation with a warm cooldown so the
    // first measured windows after the switch don't immediately re-transition.
    cooldownUntilMs = nowMs + QUALITY_COOLDOWN_MS
    return null
  }

  return {
    recordFrame,
    setOverride,
    getTier: () => tier,
    getLastTransitionReason: () => lastReason,
    isOverrideActive: () => overrideTier !== null,
    getStats: () => ({
      consecutiveBad,
      consecutiveGood,
      warmupUntilMs,
      cooldownUntilMs,
      windowActive: windowState !== null,
    }),
  }
}
