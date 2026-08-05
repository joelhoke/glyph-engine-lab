#!/usr/bin/env node
// =============================================================================
// Local mock model server for the Collaborate AI guide preview.
//
// Speaks BOTH provider wire formats the function's adapters use, so the whole
// conversation loop (validation → routing → fallback → answer cards) works
// locally with no gateway credentials:
//
//   POST /openai/responses              → Responses API shape (output_text)
//   POST /deepseek/chat/completions     → Chat Completions shape
//
// Answers are canned but valid per functions/lib/collaborateShared.ts
// validateModelAnswer: real pack source IDs, third person, ≤220 words.
//
// Test knobs (put the token anywhere in your visitor message):
//   mock_fail_openai  → OpenAI route 500s; DeepSeek fallback answers
//   mock_invalid      → OpenAI returns malformed JSON; fallback answers
//   mock_fail_all     → both routes 500; deterministic email handoff
//
// Usage: node scripts/dev/mock-collaborate-model.mjs [port]   (default 8790)
// =============================================================================

import http from 'node:http'

const PORT = Number(process.argv[2]) || 8790

function answerFor(text) {
  const t = text.toLowerCase()
  if (/\b(startups?|founder|founding|co-?found|advis|venture|consult|equity|early-?stage)\b/.test(t)) {
    return {
      heading: 'Joel and early-stage ventures',
      answer:
        'Joel welcomes serious exploratory conversations about early-stage products, startups, advisory work, and new ventures — especially where the problem is still undefined and design can shape what the thing becomes. What the guide cannot do is speak to his availability, compensation, equity, or any commitment; those go straight to Joel at hello@joelhoke.me.',
      sourceIds: ['entrepreneurial-interest', 'entrepreneurial-boundaries'],
      followUps: [
        'What early-stage problems interest Joel?',
        'How could Joel help a founding team?',
      ],
      topic: 'entrepreneurial-fit',
    }
  }
  if (/\b(lead|leadership|manage|mentor)\b/.test(t)) {
    return {
      heading: 'How Joel leads in craft',
      answer:
        'Joel has led as a hands-on lead designer: owning UX and strategy while staying in the craft himself — developing architectural models and interactive prototypes, presenting at conference level, and aligning cross-functional teams around shared patterns rather than directing from a distance.',
      sourceIds: ['leadership-craft'],
      followUps: [
        'How does Joel stay hands-on?',
        'What has Joel shipped recently?',
      ],
      topic: 'leadership',
    }
  }
  if (/\b(email|contact|reach|follow up)\b/.test(t)) {
    return {
      heading: 'Reaching Joel directly',
      answer:
        'The best way to reach Joel is email: hello@joelhoke.me. Anything the guide cannot answer — compensation, equity, availability, contractual questions, or anything time-sensitive — should go straight to him.',
      sourceIds: ['logistics-contact'],
      followUps: ['Email Joel directly', 'What can the guide answer?'],
      topic: 'logistics',
    }
  }
  return {
    heading: 'How Joel approaches ambiguity',
    answer:
      'Joel is most energized by problems that are still a little undefined. As lead designer for Microsoft’s Global Operations work he designed two agent-integrated operational dashboards that synthesized information spread across 48+ Power BI dashboards, starting from workshops and qualitative research, then iterating architectural models and interactive prototypes with research and design together.',
    sourceIds: ['approach-ambiguity', 'msft-global-operations'],
    followUps: [
      'How does Joel handle ambiguity?',
      'Has Joel designed with AI?',
    ],
    topic: 'craft',
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('POST only')
    return
  }
  const body = await new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
  })

  // Find the latest visitor text across both wire formats.
  let visitorText = ''
  try {
    const parsed = JSON.parse(body)
    const messages = parsed.messages ?? parsed.input ?? []
    for (const m of messages) {
      const content =
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map((p) => p.text ?? '').join(' ')
            : ''
      if (m.role === 'user') visitorText = content
    }
  } catch {
    /* empty visitor text → default answer */
  }

  const isOpenAI = req.url.startsWith('/openai/')
  if (visitorText.includes('mock_fail_all') || (visitorText.includes('mock_fail_openai') && isOpenAI)) {
    res.writeHead(500, { 'content-type': 'application/json' }).end('{"error":"mock failure"}')
    return
  }

  const payload = visitorText.includes('mock_invalid') && isOpenAI
    ? '{"answer": 42, "nope": true}'
    : JSON.stringify(answerFor(visitorText))

  const wire = isOpenAI
    ? { output_text: payload, usage: { input_tokens: 900, output_tokens: 120 } }
    : {
        choices: [{ message: { role: 'assistant', content: payload } }],
        usage: { prompt_tokens: 900, completion_tokens: 120 },
      }
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(wire))
})

server.listen(PORT, () => {
  console.log(`Mock collaborate model server on http://localhost:${PORT}`)
  console.log('  POST /openai/responses')
  console.log('  POST /deepseek/chat/completions')
  console.log('  knobs: mock_fail_openai | mock_invalid | mock_fail_all')
})
