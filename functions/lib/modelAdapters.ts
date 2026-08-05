// =============================================================================
// Collaborate AI guide — model adapters.
//
// The two V1 candidates use different wire formats, so each gets an
// application-level adapter behind the shared ModelAdapter interface:
//   - deepseek/deepseek-v4-pro — Chat Completions (Cloudflare hosts it on
//     Fireworks infrastructure; verify zero-data-retention terms before launch)
//   - openai/gpt-5.6-luna — the Responses API with store: false
//
// Both are called through Cloudflare AI Gateway (authenticated access,
// metadata-only observability, spend limits, retries, health fallback).
// cf-aig-collect-log-payload is always false: raw prompts and answers must
// never be logged by the gateway.
//
// Everything takes injected config + fetch so the verify scripts run it under
// Node with mocked transport. No env access happens here — the Pages Function
// maps context.env into AdapterConfig.
// =============================================================================

import {
  COLLABORATE_TOPICS,
  ModelAnswer,
  validateModelAnswer,
} from './collaborateShared'

export type AdapterMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type AdapterConfig = {
  /** Cloudflare account + AI Gateway ids, and the gateway auth token. */
  accountId?: string
  gatewayId?: string
  gatewayToken?: string
  /** Provider API keys (gateway passes them upstream; BYOK at the gateway also works). */
  deepseekApiKey?: string
  openaiApiKey?: string
  /** Full-URL overrides for tests or non-gateway routing. */
  deepseekUrl?: string
  openaiUrl?: string
}

export type AdapterUsage = { inputTokens?: number; outputTokens?: number }

export type AdapterResult =
  | { ok: true; text: string; usage: AdapterUsage }
  | { ok: false; error: string }

export type ModelAdapter = {
  /** Stable id — appears in routing policy, responses, and share metadata. */
  id: string
  complete(
    input: { messages: AdapterMessage[]; maxTokens: number; timeoutMs: number },
    config: AdapterConfig,
    fetchImpl: typeof fetch,
  ): Promise<AdapterResult>
}

export type FetchLike = typeof fetch

const DEFAULT_TIMEOUT_MS = 12000

export function isAdapterConfigured(config: AdapterConfig): boolean {
  return Boolean(config.accountId && config.gatewayId && config.gatewayToken)
}

function gatewayUrl(config: AdapterConfig, providerPath: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/${providerPath}`
}

function gatewayHeaders(config: AdapterConfig, providerKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    // Never log raw prompts/answers at the gateway (they are logged by default).
    'cf-aig-collect-log-payload': 'false',
  }
  if (config.gatewayToken) headers['cf-aig-authorization'] = `Bearer ${config.gatewayToken}`
  if (providerKey) headers['authorization'] = `Bearer ${providerKey}`
  return headers
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  return `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`
}

/** JSON schema for the structured output (OpenAI Responses strict mode). */
export const MODEL_ANSWER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    heading: { type: 'string', maxLength: 72 },
    answer: { type: 'string' },
    sourceIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
    followUps: { type: 'array', items: { type: 'string', maxLength: 42 }, minItems: 2, maxItems: 2 },
    topic: { type: 'string', enum: [...COLLABORATE_TOPICS] },
  },
  required: ['heading', 'answer', 'sourceIds', 'followUps', 'topic'],
  additionalProperties: false,
} as const

// -- DeepSeek: Chat Completions --------------------------------------------------

export const deepseekAdapter: ModelAdapter = {
  id: 'deepseek/deepseek-v4-pro',
  async complete(input, config, fetchImpl) {
    const url = config.deepseekUrl ?? gatewayUrl(config, 'deepseek/chat/completions')
    let res: Response
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: gatewayHeaders(config, config.deepseekApiKey),
        body: JSON.stringify({
          model: 'deepseek-v4-pro',
          messages: input.messages,
          response_format: { type: 'json_object' },
          max_tokens: input.maxTokens,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(input.timeoutMs || DEFAULT_TIMEOUT_MS),
      })
    } catch (err) {
      return { ok: false, error: `request failed: ${String(err)}` }
    }
    if (!res.ok) return { ok: false, error: await readError(res) }
    let data: any
    try {
      data = await res.json()
    } catch {
      return { ok: false, error: 'non-JSON provider response' }
    }
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'empty completion' }
    return {
      ok: true,
      text,
      usage: {
        inputTokens: data?.usage?.prompt_tokens,
        outputTokens: data?.usage?.completion_tokens,
      },
    }
  },
}

// -- OpenAI: Responses API --------------------------------------------------------

type ResponsesContentPart = { type?: string; text?: string }
type ResponsesOutputItem = { type?: string; content?: ResponsesContentPart[] }

export function extractResponsesText(data: any): string | null {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text
  const output: ResponsesOutputItem[] = Array.isArray(data?.output) ? data.output : []
  const parts: string[] = []
  for (const item of output) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue
    for (const part of item.content) {
      if ((part?.type === 'output_text' || part?.type === 'text') && typeof part.text === 'string')
        parts.push(part.text)
    }
  }
  return parts.length ? parts.join('') : null
}

export const openaiAdapter: ModelAdapter = {
  id: 'openai/gpt-5.6-luna',
  async complete(input, config, fetchImpl) {
    const url = config.openaiUrl ?? gatewayUrl(config, 'openai/responses')
    let res: Response
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: gatewayHeaders(config, config.openaiApiKey),
        body: JSON.stringify({
          model: 'gpt-5.6-luna',
          store: false,
          input: input.messages.map((m) => ({
            role: m.role,
            content: [{ type: 'input_text', text: m.content }],
          })),
          text: {
            format: {
              type: 'json_schema',
              name: 'collaborate_answer',
              strict: true,
              schema: MODEL_ANSWER_JSON_SCHEMA,
            },
          },
          max_output_tokens: input.maxTokens,
        }),
        signal: AbortSignal.timeout(input.timeoutMs || DEFAULT_TIMEOUT_MS),
      })
    } catch (err) {
      return { ok: false, error: `request failed: ${String(err)}` }
    }
    if (!res.ok) return { ok: false, error: await readError(res) }
    let data: any
    try {
      data = await res.json()
    } catch {
      return { ok: false, error: 'non-JSON provider response' }
    }
    const text = extractResponsesText(data)
    if (!text) return { ok: false, error: 'empty completion' }
    return {
      ok: true,
      text,
      usage: { inputTokens: data?.usage?.input_tokens, outputTokens: data?.usage?.output_tokens },
    }
  },
}

export const MODEL_ADAPTERS: Record<string, ModelAdapter> = {
  [deepseekAdapter.id]: deepseekAdapter,
  [openaiAdapter.id]: openaiAdapter,
}

// -- Routed completion with fallback -----------------------------------------------

export type RoutedCompletion =
  | { ok: true; answer: ModelAnswer; modelClass: string; usage: AdapterUsage }
  | { ok: false; errors: string[] }

/**
 * Try the policy-ordered candidate adapters for a category: on timeout,
 * provider error, rate limit, or invalid structured output, move to the next
 * passing candidate. The caller turns { ok: false } into the deterministic
 * email handoff.
 */
export async function completeWithRouting(
  candidateIds: string[],
  messages: AdapterMessage[],
  activeSourceIds: ReadonlySet<string>,
  config: AdapterConfig,
  fetchImpl: FetchLike,
  options: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<RoutedCompletion> {
  const errors: string[] = []
  for (const id of candidateIds) {
    const adapter = MODEL_ADAPTERS[id]
    if (!adapter) {
      errors.push(`${id}: not a known adapter`)
      continue
    }
    const result = await adapter.complete(
      {
        messages,
        maxTokens: options.maxTokens ?? 700,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      },
      config,
      fetchImpl,
    )
    if (result.ok === false) {
      errors.push(`${id}: ${result.error}`)
      continue
    }
    const validated = validateModelAnswer(result.text, activeSourceIds)
    if (validated.ok === false) {
      errors.push(`${id}: invalid structured output (${validated.error})`)
      continue
    }
    return { ok: true, answer: validated.answer, modelClass: id, usage: result.usage }
  }
  return { ok: false, errors }
}
