export type IntroPhase =
  | 'logo-forming'
  | 'logo-hold'
  | 'tagline-entering'
  | 'tagline-hold'
  | 'options-entering'
  | 'complete'

export type IntroTiming = {
  logoFormDuration: number
  logoHoldDuration: number
  taglineTransitionDuration: number
  taglineHoldDuration: number
  optionsTransitionDuration: number
  optionStagger: number
}

export type IntroSequenceConfig = {
  timing: IntroTiming
}

export type IntroSequenceSnapshot = {
  phase: IntroPhase
  elapsedMs: number
  phaseElapsedMs: number
  phaseProgress: number
  logoVisible: boolean
  taglineVisible: boolean
  taglineProgress: number
  optionsVisible: boolean
  optionsProgress: number
  optionsReady: boolean
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Pure evaluator that maps an elapsed sequence time to a deterministic
 * intro snapshot. All durations are in milliseconds.
 */
export function evaluateIntroSequence(
  elapsedMs: number,
  timing: IntroTiming,
): IntroSequenceSnapshot {
  const {
    logoFormDuration,
    logoHoldDuration,
    taglineTransitionDuration,
    taglineHoldDuration,
    optionsTransitionDuration,
  } = timing

  const t = Math.max(0, elapsedMs)

  const logoEnd = logoFormDuration
  const logoHoldEnd = logoEnd + logoHoldDuration
  const taglineEnd = logoHoldEnd + taglineTransitionDuration
  const taglineHoldEnd = taglineEnd + taglineHoldDuration
  const optionsEnd = taglineHoldEnd + optionsTransitionDuration

  if (t < logoEnd) {
    const progress = logoEnd > 0 ? t / logoEnd : 1
    return {
      phase: 'logo-forming',
      elapsedMs: t,
      phaseElapsedMs: t,
      phaseProgress: clamp(progress, 0, 1),
      logoVisible: true,
      taglineVisible: false,
      taglineProgress: 0,
      optionsVisible: false,
      optionsProgress: 0,
      optionsReady: false,
    }
  }

  if (t < logoHoldEnd) {
    return {
      phase: 'logo-hold',
      elapsedMs: t,
      phaseElapsedMs: t - logoEnd,
      phaseProgress: 0,
      logoVisible: true,
      taglineVisible: false,
      taglineProgress: 0,
      optionsVisible: false,
      optionsProgress: 0,
      optionsReady: false,
    }
  }

  if (t < taglineEnd) {
    const phaseElapsed = t - logoHoldEnd
    const progress =
      taglineTransitionDuration > 0
        ? phaseElapsed / taglineTransitionDuration
        : 1
    return {
      phase: 'tagline-entering',
      elapsedMs: t,
      phaseElapsedMs: phaseElapsed,
      phaseProgress: clamp(progress, 0, 1),
      logoVisible: true,
      taglineVisible: true,
      taglineProgress: clamp(progress, 0, 1),
      optionsVisible: false,
      optionsProgress: 0,
      optionsReady: false,
    }
  }

  if (t < taglineHoldEnd) {
    return {
      phase: 'tagline-hold',
      elapsedMs: t,
      phaseElapsedMs: t - taglineEnd,
      phaseProgress: 0,
      logoVisible: true,
      taglineVisible: true,
      taglineProgress: 1,
      optionsVisible: false,
      optionsProgress: 0,
      optionsReady: false,
    }
  }

  if (t < optionsEnd) {
    const phaseElapsed = t - taglineHoldEnd
    const progress =
      optionsTransitionDuration > 0
        ? phaseElapsed / optionsTransitionDuration
        : 1
    return {
      phase: 'options-entering',
      elapsedMs: t,
      phaseElapsedMs: phaseElapsed,
      phaseProgress: clamp(progress, 0, 1),
      logoVisible: true,
      taglineVisible: true,
      taglineProgress: 1,
      optionsVisible: true,
      optionsProgress: clamp(progress, 0, 1),
      optionsReady: progress >= 1,
    }
  }

  return {
    phase: 'complete',
    elapsedMs: t,
    phaseElapsedMs: t - optionsEnd,
    phaseProgress: 0,
    logoVisible: true,
    taglineVisible: true,
    taglineProgress: 1,
    optionsVisible: true,
    optionsProgress: 1,
    optionsReady: true,
  }
}

export const portfolioIntroPreset: IntroSequenceConfig = {
  timing: {
    logoFormDuration: 900,
    logoHoldDuration: 2000,
    taglineTransitionDuration: 900,
    taglineHoldDuration: 1500,
    optionsTransitionDuration: 900,
    optionStagger: 120,
  },
}

const phaseOrder: IntroPhase[] = [
  'logo-forming',
  'logo-hold',
  'tagline-entering',
  'tagline-hold',
  'options-entering',
  'complete',
]

export function getTotalDuration(timing: IntroTiming): number {
  return (
    timing.logoFormDuration +
    timing.logoHoldDuration +
    timing.taglineTransitionDuration +
    timing.taglineHoldDuration +
    timing.optionsTransitionDuration
  )
}

export function getPhaseStartTime(
  phase: IntroPhase,
  timing: IntroTiming,
): number {
  const {
    logoFormDuration,
    logoHoldDuration,
    taglineTransitionDuration,
    taglineHoldDuration,
    optionsTransitionDuration,
  } = timing

  switch (phase) {
    case 'logo-forming':
      return 0
    case 'logo-hold':
      return logoFormDuration
    case 'tagline-entering':
      return logoFormDuration + logoHoldDuration
    case 'tagline-hold':
      return (
        logoFormDuration +
        logoHoldDuration +
        taglineTransitionDuration
      )
    case 'options-entering':
      return (
        logoFormDuration +
        logoHoldDuration +
        taglineTransitionDuration +
        taglineHoldDuration
      )
    case 'complete':
      return (
        logoFormDuration +
        logoHoldDuration +
        taglineTransitionDuration +
        taglineHoldDuration +
        optionsTransitionDuration
      )
    default:
      return 0
  }
}

export function nextPhase(
  current: IntroPhase,
  timing: IntroTiming,
): IntroPhase {
  const index = phaseOrder.indexOf(current)
  if (index < 0 || index >= phaseOrder.length - 1) return 'complete'
  return phaseOrder[index + 1]
}

export function previousPhase(
  current: IntroPhase,
  timing: IntroTiming,
): IntroPhase {
  const index = phaseOrder.indexOf(current)
  if (index <= 0) return 'logo-forming'
  return phaseOrder[index - 1]
}
