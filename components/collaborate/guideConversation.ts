import { COLLABORATE_TOPICS, CollaborateTopic } from '../../content/collaborate'

// =============================================================================
// Guide conversation controller — a pure state machine for the collaborate AI
// guide chat. No React, no Date.now/crypto inside: time and id sources are
// injected (GuideConversationDeps) so scripts/verify-collaborate-guide-state.js
// can exercise every transition deterministically under Node.
//
// Invariants:
// - `heading` LOCKS to the first accepted answer's heading; later headings are
//   ignored.
// - `generation` increments on every reset (and starts at 1 on creation, since
//   creation is the first "reset" of a blank conversation). resolveTurn /
//   failTurn / share resolutions carry the generation of the request they
//   answer; a response arriving after a reset is REJECTED as stale.
// - `at` timestamps are presentation-only metadata. They are stripped by
//   guideMessagesForApi and are never sent to any endpoint or to analytics.
// =============================================================================

// Mirrors the server-side limits (functions/lib/collaborateShared.ts).
export const GUIDE_MAX_MESSAGE_CHARS = 800
export const GUIDE_MAX_VISITOR_TURNS = 12

export type GuideSourceCard = { id: string; label: string; url?: string }

export type GuideUserTurn = { role: 'user'; content: string; at: number }

export type GuideAssistantTurn = {
  role: 'assistant'
  content: string
  at: number
  sourceCards: GuideSourceCard[]
  followUps: string[]
  topic: CollaborateTopic
  modelClass: string
  profileVersion: string
}

export type GuideTurn = GuideUserTurn | GuideAssistantTurn

/** The server answer payload (POST /api/collaborate 200 body, parsed). */
export type GuideAssistantPayload = Omit<GuideAssistantTurn, 'role' | 'at'> & {
  /** Validated 2–9 word, ≤72-character conversation title. */
  heading: string
}

export type GuideStatus = 'idle' | 'pending' | 'error'
export type GuideErrorKind = 'offline' | 'generic'
export type GuideShareStatus = 'idle' | 'sending' | 'done' | 'error'

export type GuideShareState = {
  status: GuideShareStatus
  receiptId: string | null
}

export type GuideConversationState = {
  turns: GuideTurn[]
  heading: string | null
  status: GuideStatus
  error: GuideErrorKind | null
  sessionId: string
  generation: number
  /** Composer text. Survives a failed send (restored by failTurn). */
  draft: string
  /** The last visitor message attempted, for the error card's retry. */
  lastAttempt: string | null
  share: GuideShareState
}

export type GuideConversationDeps = {
  /** Epoch milliseconds for turn timestamps (presentation only). */
  now: () => number
  /** Session id source (crypto.randomUUID in the browser). */
  id: () => string
}

/** A fresh conversation: new session id, generation 1, everything empty. */
export function createGuideConversation(deps: GuideConversationDeps): GuideConversationState {
  return {
    turns: [],
    heading: null,
    status: 'idle',
    error: null,
    sessionId: deps.id(),
    generation: 1,
    draft: '',
    lastAttempt: null,
    share: { status: 'idle', receiptId: null },
  }
}

export function countVisitorTurns(turns: GuideTurn[]): number {
  return turns.reduce((count, turn) => (turn.role === 'user' ? count + 1 : count), 0)
}

export function isGuideLimitReached(state: GuideConversationState): boolean {
  return countVisitorTurns(state.turns) >= GUIDE_MAX_VISITOR_TURNS
}

export function hasGuideConversation(state: GuideConversationState): boolean {
  return state.turns.length > 0
}

export function latestAssistantTurn(turns: GuideTurn[]): GuideAssistantTurn | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i]
    if (turn.role === 'assistant') return turn
  }
  return null
}

/** The wire shape for POST /api/collaborate: role + content only. Never
 *  timestamps, never card metadata. */
export function guideMessagesForApi(turns: GuideTurn[]): { role: 'user' | 'assistant'; content: string }[] {
  return turns.map((turn) => ({ role: turn.role, content: turn.content }))
}

export function setGuideDraft(state: GuideConversationState, draft: string): GuideConversationState {
  return { ...state, draft: draft.slice(0, GUIDE_MAX_MESSAGE_CHARS) }
}

export type BeginTurnResult =
  | { ok: true; state: GuideConversationState }
  | { ok: false; reason: 'empty' | 'pending' | 'limit' }

/** Optimistically append a visitor message and enter the pending state. */
export function beginTurn(
  state: GuideConversationState,
  raw: string,
  deps: GuideConversationDeps,
): BeginTurnResult {
  const content = raw.trim().slice(0, GUIDE_MAX_MESSAGE_CHARS)
  if (!content) return { ok: false, reason: 'empty' }
  if (state.status === 'pending') return { ok: false, reason: 'pending' }
  if (isGuideLimitReached(state)) return { ok: false, reason: 'limit' }
  return {
    ok: true,
    state: {
      ...state,
      turns: [...state.turns, { role: 'user', content, at: deps.now() }],
      status: 'pending',
      error: null,
      draft: '',
      lastAttempt: content,
    },
  }
}

export type ResolveTurnResult = {
  state: GuideConversationState
  /** The answer's canvas topic (caller morphs the scene descriptor). */
  topic: CollaborateTopic
}

/** Accept a server answer. Generation-checked: a response answering a request
 *  from before a reset (or with no turn in flight) is rejected — returns null. */
export function resolveTurn(
  state: GuideConversationState,
  generation: number,
  payload: GuideAssistantPayload,
  deps: GuideConversationDeps,
): ResolveTurnResult | null {
  if (generation !== state.generation || state.status !== 'pending') return null
  const { heading, ...answer } = payload
  return {
    state: {
      ...state,
      turns: [...state.turns, { role: 'assistant', ...answer, at: deps.now() }],
      // Locked to the first accepted answer's heading; later headings ignored.
      heading: state.heading ?? heading,
      status: 'idle',
      error: null,
    },
    topic: payload.topic,
  }
}

/** Reject a failed request. Generation-checked like resolveTurn. Rolls the
 *  optimistic visitor message back and restores the typed draft (unless the
 *  visitor has already typed something new). */
export function failTurn(
  state: GuideConversationState,
  generation: number,
  kind: GuideErrorKind,
): GuideConversationState | null {
  if (generation !== state.generation || state.status !== 'pending') return null
  const last = state.turns[state.turns.length - 1]
  const turns = last && last.role === 'user' ? state.turns.slice(0, -1) : state.turns
  const rolledBack = last && last.role === 'user' ? last.content : null
  return {
    ...state,
    turns,
    status: 'error',
    error: kind,
    draft: state.draft.trim() ? state.draft : (rolledBack ?? state.draft),
  }
}

/** Clear everything — turns, heading, draft, errors, share state — and start a
 *  fresh session. The generation increment is the stale-response guard: any
 *  in-flight request for the old conversation can no longer resolve. Canvas
 *  starter/topic treatments live outside this state; the caller clears them
 *  too. */
export function resetGuideConversation(
  state: GuideConversationState,
  deps: GuideConversationDeps,
): GuideConversationState {
  return {
    turns: [],
    heading: null,
    status: 'idle',
    error: null,
    sessionId: deps.id(),
    generation: state.generation + 1,
    draft: '',
    lastAttempt: null,
    share: { status: 'idle', receiptId: null },
  }
}

/** Enter the share-sending state. Rejects (null) when a share is already in
 *  flight or done, or when the generation is stale. */
export function beginGuideShare(
  state: GuideConversationState,
  generation: number,
): GuideConversationState | null {
  if (generation !== state.generation) return null
  if (state.share.status === 'sending' || state.share.status === 'done') return null
  return { ...state, share: { status: 'sending', receiptId: null } }
}

export function resolveGuideShare(
  state: GuideConversationState,
  generation: number,
  receiptId: string,
): GuideConversationState | null {
  if (generation !== state.generation || state.share.status !== 'sending') return null
  return { ...state, share: { status: 'done', receiptId } }
}

export function failGuideShare(
  state: GuideConversationState,
  generation: number,
): GuideConversationState | null {
  if (generation !== state.generation || state.share.status !== 'sending') return null
  return { ...state, share: { status: 'error', receiptId: null } }
}

const isTopic = (value: unknown): value is CollaborateTopic =>
  typeof value === 'string' && (COLLABORATE_TOPICS as readonly string[]).includes(value)

/** The server validates headings to 2–9 words and ≤72 characters; the client
 *  enforces the same contract before accepting one. */
function parseHeading(value: unknown): string {
  if (typeof value !== 'string') throw new Error('bad response')
  const heading = value.trim()
  const words = heading.length > 0 ? heading.split(/\s+/) : []
  if (heading.length === 0 || heading.length > 72 || words.length < 2 || words.length > 9) {
    throw new Error('bad response')
  }
  return heading
}

/** Bounds-safe parse of the guide response — anything unexpected throws and
 *  the caller falls back to the calm error card. */
export function parseGuideAnswer(data: unknown): GuideAssistantPayload {
  if (typeof data !== 'object' || data === null) throw new Error('bad response')
  const body = data as Record<string, unknown>
  if (typeof body.answer !== 'string' || !body.answer.trim()) throw new Error('bad response')
  const heading = parseHeading(body.heading)
  const sourceCards: GuideSourceCard[] = Array.isArray(body.sourceCards)
    ? body.sourceCards.flatMap((card): GuideSourceCard[] => {
        if (typeof card !== 'object' || card === null) return []
        const c = card as Record<string, unknown>
        if (typeof c.id !== 'string' || typeof c.label !== 'string') return []
        return [{ id: c.id, label: c.label, ...(typeof c.url === 'string' ? { url: c.url } : {}) }]
      })
    : []
  const followUps = Array.isArray(body.followUps)
    ? body.followUps.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, 2)
    : []
  return {
    heading,
    content: body.answer,
    sourceCards,
    followUps,
    topic: isTopic(body.topic) ? body.topic : 'unknown',
    modelClass: typeof body.modelClass === 'string' ? body.modelClass : 'unknown',
    profileVersion: typeof body.profileVersion === 'string' ? body.profileVersion : 'unknown',
  }
}
