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
  }
  if (!isAdapterConfigured(config)) return json(503, { ok: false, error: 'The AI guide is unavailable.' })

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
  const result = await completeWithRouting(candidates, messages, activeIds, config, fetch)

  if (!result.ok) {
    // Both candidates failed (timeout, provider error, rate limit, or invalid
    // structured output) — deterministic email handoff, still a 200 so the
    // conversation UI can show it as an ordinary answer card.
    const body: CollaborateResponseBody = {
      answer: COLLABORATE_FALLBACK_ANSWER,
      sourceCards: [{ id: 'logistics-contact', label: getProfileEntry('logistics-contact')?.evidenceLabel ?? 'Contact' }],
      followUps: COLLABORATE_FALLBACK_FOLLOW_UPS,
      topic: 'logistics',
      modelClass: 'fallback',
      profileVersion: COLLABORATE_PROFILE_VERSION,
    }
    return json(200, body)
  }

  const body: CollaborateResponseBody = {
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
