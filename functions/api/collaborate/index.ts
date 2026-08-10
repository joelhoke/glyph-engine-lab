/**
 * `POST /api/collaborate` — one turn of the AI guide to Joel.
 *
 * Thin handler: all validation, prompt construction, routing, and structured
 * output checks live in functions/lib/ (Node-testable). Non-streaming by
 * design — the server validates the whole answer before anything is shown.
 *
 * Failure ladder: preferred candidate → other policy candidate → deterministic
 * email handoff. Missing gateway config → 503 (the client keeps the scripted
 * starters and direct-email route). Rate limiting (30 turns / 10 min / IP) is
 * a Cloudflare WAF rule; the $ monthly cap is an AI Gateway spend limit — see
 * docs/deployment.md.
 */

import {
  COLLABORATE_FALLBACK_ANSWER,
  COLLABORATE_FALLBACK_FOLLOW_UPS,
  COLLABORATE_FALLBACK_HEADING,
  COLLABORATE_MAX_BODY_BYTES,
  COLLABORATE_PROFILE_VERSION,
  CollaborateResponseBody,
  ROUTING_POLICY,
  buildModelMessages,
  classifyRoutingCategory,
  validateCollaborateRequest,
} from '../../lib/collaborateShared'
import { getActiveProfileEntries, getProfileEntry } from '../../lib/collaborateProfile'
import {
  AdapterConfig,
  completeWithRouting,
  isAdapterConfigured,
} from '../../lib/modelAdapters'

type CollaborateEnv = {
  CF_ACCOUNT_ID?: string
  AIG_GATEWAY_ID?: string
  AIG_TOKEN?: string
  DEEPSEEK_API_KEY?: string
  OPENAI_API_KEY?: string
  MOONSHOT_API_KEY?: string
  /** Upstream model id override for the Kimi adapter (hosted names change). */
  MOONSHOT_MODEL?: string
  /** Full-URL overrides — local preview/mocks only; production goes through
   *  the AI Gateway URLs constructed from CF_ACCOUNT_ID + AIG_GATEWAY_ID. */
  AIG_DEEPSEEK_URL?: string
  AIG_OPENAI_URL?: string
  AIG_MOONSHOT_URL?: string
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export const onRequestPost: PagesFunction<CollaborateEnv> = async (context) => {
  const config: AdapterConfig = {
    accountId: context.env.CF_ACCOUNT_ID,
    gatewayId: context.env.AIG_GATEWAY_ID,
    gatewayToken: context.env.AIG_TOKEN,
    deepseekApiKey: context.env.DEEPSEEK_API_KEY,
    openaiApiKey: context.env.OPENAI_API_KEY,
    moonshotApiKey: context.env.MOONSHOT_API_KEY,
    moonshotModel: context.env.MOONSHOT_MODEL,
    deepseekUrl: context.env.AIG_DEEPSEEK_URL,
    openaiUrl: context.env.AIG_OPENAI_URL,
    moonshotUrl: context.env.AIG_MOONSHOT_URL,
  }
  if (!isAdapterConfigured(config)) {
    // TEMPORARY preview debug: report which config keys are missing (names only).
    const missing = [
      ['CF_ACCOUNT_ID', config.accountId],
      ['AIG_GATEWAY_ID', config.gatewayId],
      ['AIG_TOKEN', config.gatewayToken],
      ['MOONSHOT_API_KEY', config.moonshotApiKey],
    ].filter(([, v]) => !v).map(([k]) => k)
    return json(503, { ok: false, error: 'The AI guide is unavailable.', missing })
  }

  const contentType = context.request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json'))
    return json(415, { ok: false, error: 'Expected application/json.' })

  let raw: unknown
  try {
    const text = await context.request.text()
    if (text.length > COLLABORATE_MAX_BODY_BYTES) return json(400, { ok: false, error: 'Payload too large.' })
    raw = JSON.parse(text)
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON.' })
  }

  const validated = validateCollaborateRequest(raw)
  if (validated.ok === false) return json(400, { ok: false, error: validated.error })

  const today = new Date().toISOString().slice(0, 10)
  const entries = getActiveProfileEntries(today)
  const activeIds = new Set(entries.map((e) => e.id))

  const latestVisitorText = [...validated.request.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const category = classifyRoutingCategory(latestVisitorText)
  const candidates = ROUTING_POLICY[category]

  const messages = buildModelMessages(entries, validated.request.messages)
  // Thinking models (kimi-k2.6) can exceed the 12s adapter default; give each
  // candidate 30s. The failure ladder still bounds total latency by candidate
  // count, and the WAF/session limits bound abuse.
  const result = await completeWithRouting(candidates, messages, activeIds, config, fetch, { timeoutMs: 30000 })

  if (!result.ok) {
    // Both candidates failed (timeout, provider error, rate limit, or invalid
    // structured output) — deterministic email handoff, still a 200 so the
    // conversation UI can show it as an ordinary answer card.
    // TEMPORARY preview debug: why every candidate failed (messages only).
    const body: CollaborateResponseBody & { debugErrors: string[] } = {
      heading: COLLABORATE_FALLBACK_HEADING,
      answer: COLLABORATE_FALLBACK_ANSWER,
      sourceCards: [{ id: 'logistics-contact', label: getProfileEntry('logistics-contact')?.evidenceLabel ?? 'Contact' }],
      followUps: COLLABORATE_FALLBACK_FOLLOW_UPS,
      topic: 'logistics',
      modelClass: 'fallback',
      profileVersion: COLLABORATE_PROFILE_VERSION,
      debugErrors: (result as { errors: string[] }).errors,
    }
    return json(200, body)
  }

  const body: CollaborateResponseBody = {
    heading: result.answer.heading,
    answer: result.answer.answer,
    sourceCards: result.answer.sourceIds.map((id) => {
      const entry = getProfileEntry(id)
      return {
        id,
        label: entry?.evidenceLabel ?? id,
        ...(entry?.evidenceUrl ? { url: entry.evidenceUrl } : {}),
      }
    }),
    followUps: result.answer.followUps,
    topic: result.answer.topic,
    modelClass: result.modelClass,
    profileVersion: COLLABORATE_PROFILE_VERSION,
  }
  return json(200, body)
}
