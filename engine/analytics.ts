/**
 * Consent-based analytics (Stage 5).
 *
 * GA4 is the only provider, sealed behind this module: nothing else in the
 * codebase references gtag, and nothing here loads before the visitor
 * explicitly opts in. Before consent: no gtag.js, no GA cookies, no events —
 * declining sends nothing. Failures are always silent and never affect
 * rendering or navigation.
 *
 * The event surface is closed: only the builders below can construct an
 * event, each with a fixed, whitelisted parameter shape. There is no
 * arbitrary-params escape hatch, so glyph text, palette values, filenames,
 * identities, confidential IDs, protected-route activity, and raw diagnostics
 * cannot be transmitted by construction.
 *
 * Pure parts (consent records, event builders) are injectable and verified
 * by scripts/verify-analytics.js.
 */

// --- Consent storage ---------------------------------------------------------

export type AnalyticsDecision = 'granted' | 'denied'

export type ConsentRecord = {
  decision: AnalyticsDecision
  /** Epoch milliseconds when the decision was recorded. */
  decidedAt: number
}

export const CONSENT_STORAGE_KEY = 'jh.analytics-consent'
/** Decisions are honored for 180 days, then the visitor is asked again. */
export const CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000

export type ConsentStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Read the stored decision; null when absent, malformed, or expired. */
export function readConsent(storage: ConsentStorage, nowMs: number): ConsentRecord | null {
  let raw: string | null = null
  try {
    raw = storage.getItem(CONSENT_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>
    if (
      (parsed.decision === 'granted' || parsed.decision === 'denied') &&
      typeof parsed.decidedAt === 'number' &&
      Number.isFinite(parsed.decidedAt) &&
      nowMs - parsed.decidedAt < CONSENT_TTL_MS &&
      parsed.decidedAt <= nowMs
    ) {
      return { decision: parsed.decision, decidedAt: parsed.decidedAt }
    }
    return null
  } catch {
    return null
  }
}

export function writeConsent(
  storage: ConsentStorage,
  decision: AnalyticsDecision,
  nowMs: number,
): void {
  try {
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ decision, decidedAt: nowMs }))
  } catch {
    // Storage unavailable (private mode): the session simply asks again.
  }
}

// --- Closed event surface ----------------------------------------------------

export type ExperienceKey = 'intro' | 'work' | 'vibe' | 'collaborate'
export type AmbientMode = 'off' | 'weather' | 'matrix'
export type MediaKind = 'image' | 'video' | 'embed'
export type SourceChange = 'builtin' | 'preset' | 'upload'
export type CreationSaveKind = 'auto' | 'image' | 'clip'
export type CreationSaveQualifier = 'steps' | 'tools' | 'elements'

export type AnalyticsEvent =
  | { name: 'experience_view'; params: { experience: ExperienceKey } }
  | { name: 'story_view'; params: { story_id: string } }
  | { name: 'media_open'; params: { story_id: string; media_kind: MediaKind } }
  | { name: 'outbound_link'; params: { host: string } }
  | { name: 'upload_result'; params: { mime_type: string; ok: boolean } }
  | { name: 'preset_change'; params: { preset_id: string } }
  | { name: 'effect_change'; params: { mode: AmbientMode } }
  | { name: 'source_change'; params: { source: SourceChange } }
  | { name: 'tier_transition'; params: { from_tier: number; to_tier: number } }
  /** Gallery-archive save: the export/auto kind and the first engagement
   *  qualifier only — never composition contents. */
  | { name: 'creation_save'; params: { kind: CreationSaveKind; qualifier: CreationSaveQualifier } }
  | { name: 'collaborate_guide_answered'; params: { topic: string; model_class: string } }
  | {
      name: 'collaborate_guide_navigation'
      /** The validated story and the resulting presentation only — never
       *  prompts, answers, or raw URLs. */
      params: { story_id: string; presentation: string }
    }

/** Parameter keys each event may carry — anything else is stripped. */
const ALLOWED_PARAMS: Record<AnalyticsEvent['name'], readonly string[]> = {
  experience_view: ['experience'],
  story_view: ['story_id'],
  media_open: ['story_id', 'media_kind'],
  outbound_link: ['host'],
  upload_result: ['mime_type', 'ok'],
  preset_change: ['preset_id'],
  effect_change: ['mode'],
  source_change: ['source'],
  tier_transition: ['from_tier', 'to_tier'],
  creation_save: ['kind', 'qualifier'],
  collaborate_guide_answered: ['topic', 'model_class'],
  collaborate_guide_navigation: ['story_id', 'presentation'],
}

/** Keys that must never appear in an event payload (defense in depth). */
const FORBIDDEN_KEYS = /text|glyph|palette|color|file|name|email|identity|password|token|protected|diagnostic|fingerprint/i

/** Outbound links report the destination host only — never paths or queries. */
export function outboundHost(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.host : null
  } catch {
    return null
  }
}

/**
 * Final scrub before anything leaves: only the event's whitelisted keys
 * survive, and any key even resembling a forbidden channel is dropped.
 */
export function sanitizeEvent(event: AnalyticsEvent): { name: string; params: Record<string, unknown> } {
  const allowed = new Set(ALLOWED_PARAMS[event.name])
  const params: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event.params)) {
    if (!allowed.has(key)) continue
    if (FORBIDDEN_KEYS.test(key)) continue
    if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
      params[key] = value
    }
  }
  return { name: event.name, params }
}

// --- Client (browser only) ---------------------------------------------------

export type AnalyticsClient = {
  /** True only after explicit opt-in AND a configured measurement ID. */
  isActive(): boolean
  grant(): void
  deny(): void
  track(event: AnalyticsEvent): void
}

/**
 * Create the sealed client. Loads gtag.js and starts GA4 only on `grant()`;
 * `deny()` records the decision and sends nothing. The protected viewer never
 * mounts the consent UI, and the client additionally refuses to activate on
 * protected/api routes. All provider failures are swallowed.
 */
export function createAnalyticsClient(options: {
  measurementId?: string
  storage: ConsentStorage
  nowMs?: () => number
  pathname?: string
}): AnalyticsClient {
  const measurementId = options.measurementId?.trim() ?? ''
  const now = options.nowMs ?? (() => Date.now())
  const pathname = options.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/')
  const isProtectedRoute = pathname.startsWith('/protected-work') || pathname.startsWith('/api/protected')

  let active = false
  let gtagReady = false

  const boot = () => {
    if (active || typeof document === 'undefined') return
    active = true
    try {
      const script = document.createElement('script')
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
      script.onload = () => {
        try {
          const w = window as any
          w.dataLayer = w.dataLayer ?? []
          w.gtag = w.gtag ?? ((...args: unknown[]) => w.dataLayer.push(args))
          w.gtag('js', new Date())
          w.gtag('config', measurementId, { send_page_view: false })
          gtagReady = true
        } catch {
          /* silent */
        }
      }
      document.head.appendChild(script)
    } catch {
      /* silent */
    }
  }

  return {
    isActive: () => active && measurementId.length > 0,
    grant: () => {
      writeConsent(options.storage, 'granted', now())
      if (measurementId.length > 0 && !isProtectedRoute) boot()
    },
    deny: () => {
      writeConsent(options.storage, 'denied', now())
      // Nothing to tear down: before consent nothing was ever loaded.
    },
    track: (event: AnalyticsEvent) => {
      if (!gtagReady || typeof window === 'undefined') return
      try {
        const clean = sanitizeEvent(event)
        ;(window as any).gtag?.('event', clean.name, clean.params)
      } catch {
        /* silent */
      }
    },
  }
}
