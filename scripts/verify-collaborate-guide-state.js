#!/usr/bin/env node
/**
 * Deterministic verification for components/collaborate/guideConversation.ts:
 * the pure state machine behind the collaborate AI guide chat — turn
 * lifecycle (begin/resolve/fail), heading lock, stale-generation rejection,
 * reset, the 12-visitor-turn cap, the share flow, and the bounds-safe
 * response parser (including the heading contract). Time and ids are injected
 * so every transition is reproducible under Node.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp-verify-guide-state')

try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  execSync(
    `npx tsc "${path.join(projectRoot, 'components', 'collaborate', 'guideConversation.ts')}" --outDir "${tmpDir}" --module commonjs --target es2020 --strict false --esModuleInterop true`,
    { stdio: 'inherit', cwd: projectRoot },
  )
} catch (error) {
  console.error('Compilation failed:', error)
  process.exit(1)
}

const {
  GUIDE_MAX_MESSAGE_CHARS,
  GUIDE_MAX_VISITOR_TURNS,
  createGuideConversation,
  beginTurn,
  resolveTurn,
  failTurn,
  resetGuideConversation,
  setGuideDraft,
  countVisitorTurns,
  isGuideLimitReached,
  hasGuideConversation,
  latestAssistantTurn,
  guideMessagesForApi,
  beginGuideShare,
  resolveGuideShare,
  failGuideShare,
  parseGuideAnswer,
} = require(path.join(tmpDir, 'components', 'collaborate', 'guideConversation.js'))

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
  } else {
    console.log(`PASS: ${message}`)
  }
}

function makeDeps() {
  let tick = 0
  let idCounter = 0
  return {
    now: () => (tick += 1000),
    id: () => `session-${(idCounter += 1)}`,
  }
}

const deps = makeDeps()

function sampleAnswer(overrides = {}) {
  return {
    heading: 'Joel’s best work',
    content: 'A thoughtful answer about Joel.',
    sourceCards: [{ id: 'story-01', label: 'Case study', url: '#work/story-01' }],
    followUps: ['Follow-up one?', 'Follow-up two?'],
    topic: 'craft',
    modelClass: 'frontier',
    profileVersion: 'v1',
    ...overrides,
  }
}

// --- Creation ---------------------------------------------------------------

let state = createGuideConversation(deps)
assert(
  state.turns.length === 0 &&
    state.heading === null &&
    state.status === 'idle' &&
    state.error === null &&
    state.draft === '' &&
    state.lastAttempt === null &&
    state.share.status === 'idle' &&
    state.share.receiptId === null,
  'a fresh conversation is empty and idle',
)
assert(state.sessionId === 'session-1', 'the session id comes from the injected id source')
assert(state.generation === 1, 'a fresh conversation starts at generation 1')
assert(!hasGuideConversation(state), 'an empty conversation reports no conversation')

// --- beginTurn ---------------------------------------------------------------

const emptyBegin = beginTurn(state, '   ', deps)
assert(!emptyBegin.ok && emptyBegin.reason === 'empty', 'a blank message is rejected as empty')

state = setGuideDraft(state, 'ignored draft')
const begun = beginTurn(state, '  How does Joel lead?  ', deps)
assert(begun.ok, 'a real message begins a turn')
state = begun.state
assert(
  state.turns.length === 1 &&
    state.turns[0].role === 'user' &&
    state.turns[0].content === 'How does Joel lead?',
  'beginTurn appends the trimmed visitor message',
)
assert(
  typeof state.turns[0].at === 'number',
  'the visitor turn carries an injected presentation timestamp',
)
assert(
  state.status === 'pending' && state.error === null && state.draft === '',
  'beginTurn enters pending and clears the draft',
)
assert(state.lastAttempt === 'How does Joel lead?', 'the last attempt is recorded for retry')
assert(hasGuideConversation(state), 'a started conversation reports a conversation')

const pendingBegin = beginTurn(state, 'another', deps)
assert(
  !pendingBegin.ok && pendingBegin.reason === 'pending',
  'a second send while pending is rejected',
)

const longMessage = 'x'.repeat(GUIDE_MAX_MESSAGE_CHARS + 50)
const longState = beginTurn(createGuideConversation(deps), longMessage, deps)
assert(
  longState.ok && longState.state.turns[0].content.length === GUIDE_MAX_MESSAGE_CHARS,
  'visitor messages are capped at 800 characters',
)

// --- resolveTurn: success + heading lock ------------------------------------

const resolved = resolveTurn(state, state.generation, sampleAnswer(), deps)
assert(resolved !== null, 'the in-flight answer resolves')
assert(resolved.topic === 'craft', 'resolveTurn returns the canvas topic')
state = resolved.state
assert(
  state.turns.length === 2 && state.turns[1].role === 'assistant',
  'resolveTurn appends the assistant turn',
)
assert(state.heading === 'Joel’s best work', 'the first answer locks the heading')
assert(state.status === 'idle' && state.error === null, 'resolveTurn returns to idle')
assert(latestAssistantTurn(state.turns).topic === 'craft', 'latestAssistantTurn finds the answer')

// later headings are ignored — the heading stays locked to the first answer
const second = beginTurn(state, 'Tell me more', deps)
state = second.state
const resolvedAgain = resolveTurn(
  state,
  state.generation,
  sampleAnswer({ heading: 'A different title', topic: 'leadership' }),
  deps,
)
state = resolvedAgain.state
assert(state.heading === 'Joel’s best work', 'later headings are ignored (heading stays locked)')
assert(state.turns.length === 4, 'the second exchange appends normally')

// a resolve with no turn in flight is rejected
const idleResolve = resolveTurn(state, state.generation, sampleAnswer(), deps)
assert(idleResolve === null, 'resolveTurn without a pending turn is rejected')

// --- failTurn: rollback + draft restore + retry ------------------------------

const failedAttemptState = beginTurn(state, 'This one fails', deps).state
const failed = failTurn(failedAttemptState, failedAttemptState.generation, 'offline')
assert(failed !== null, 'a failing in-flight turn fails cleanly')
assert(
  failed.turns.length === 4 && failed.turns.every((turn, i) => turn === state.turns[i]),
  'failTurn rolls the optimistic visitor message back',
)
assert(failed.status === 'error' && failed.error === 'offline', 'failTurn records the error kind')
assert(failed.draft === 'This one fails', 'failTurn restores the rolled-back message as the draft')
assert(failed.lastAttempt === 'This one fails', 'the failed attempt stays available for retry')

// a typed draft is never overwritten by the rollback
const withDraft = setGuideDraft(failed, 'something new')
const failedAgain = failTurn(
  beginTurn(withDraft, 'Second failure', deps).state,
  withDraft.generation,
  'generic',
)
assert(failedAgain.draft === 'Second failure', 'rollback restores the failed message when the draft was consumed')
const preserveDraftBase = setGuideDraft(failedAgain, 'visitor typing')
const preserveAttempt = beginTurn(preserveDraftBase, 'Third failure', deps).state
const preserveWithNewDraft = setGuideDraft(preserveAttempt, 'already retyped')
const preserved = failTurn(preserveWithNewDraft, preserveAttempt.generation, 'generic')
assert(preserved.draft === 'already retyped', 'an existing non-empty draft survives the rollback')

// --- stale-generation guard ---------------------------------------------------

const staleBase = beginTurn(failed, 'In-flight before reset', deps).state
const staleGeneration = staleBase.generation
const reset = resetGuideConversation(staleBase, deps)
assert(
  reset.generation === staleGeneration + 1,
  'reset increments the generation',
)
assert(reset.sessionId !== staleBase.sessionId, 'reset issues a fresh session id')
assert(
  reset.turns.length === 0 &&
    reset.heading === null &&
    reset.draft === '' &&
    reset.error === null &&
    reset.status === 'idle' &&
    reset.lastAttempt === null &&
    reset.share.status === 'idle' &&
    reset.share.receiptId === null,
  'reset clears turns, heading, draft, errors, and share state',
)
assert(
  resolveTurn(reset, staleGeneration, sampleAnswer(), deps) === null,
  'a response from before the reset is rejected as stale (resolve)',
)
assert(
  failTurn(reset, staleGeneration, 'generic') === null,
  'a failure from before the reset is rejected as stale (fail)',
)
assert(
  resolveTurn(staleBase, staleGeneration + 99, sampleAnswer(), deps) === null,
  'a mismatched generation never resolves',
)

// --- visitor-turn counting + the 12-turn cap ---------------------------------

assert(countVisitorTurns(state.turns) === 2, 'visitor turns are counted correctly')

let capped = createGuideConversation(deps)
for (let i = 0; i < GUIDE_MAX_VISITOR_TURNS; i += 1) {
  capped = beginTurn(capped, `Question ${i + 1}`, deps).state
  capped = resolveTurn(capped, capped.generation, sampleAnswer(), deps).state
}
assert(countVisitorTurns(capped.turns) === GUIDE_MAX_VISITOR_TURNS, 'twelve full exchanges fit')
assert(isGuideLimitReached(capped), 'the limit reports reached at 12 visitor turns')
const overLimit = beginTurn(capped, 'One too many', deps)
assert(!overLimit.ok && overLimit.reason === 'limit', 'the 13th visitor message is rejected')

// --- wire shape: timestamps never leave the client ----------------------------

const wire = guideMessagesForApi(capped.turns)
assert(wire.length === GUIDE_MAX_VISITOR_TURNS * 2, 'the wire history covers every turn')
assert(
  wire.every(
    (message) =>
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string' &&
      !('at' in message) &&
      Object.keys(message).length === 2,
  ),
  'guideMessagesForApi sends role + content only — never timestamps',
)

// --- share flow -----------------------------------------------------------------

let sharing = createGuideConversation(deps)
sharing = beginTurn(sharing, 'Shareable question', deps).state
sharing = resolveTurn(sharing, sharing.generation, sampleAnswer(), deps).state

const sending = beginGuideShare(sharing, sharing.generation)
assert(sending !== null && sending.share.status === 'sending', 'share enters the sending state')
assert(
  beginGuideShare(sending, sharing.generation) === null,
  'a second share submit while sending is rejected',
)
const shared = resolveGuideShare(sending, sharing.generation, 'receipt-123')
assert(
  shared !== null && shared.share.status === 'done' && shared.share.receiptId === 'receipt-123',
  'a successful share records the receipt id',
)
assert(
  beginGuideShare(shared, sharing.generation) === null,
  'sharing an already-shared conversation is rejected',
)

const failingShare = beginGuideShare(sharing, sharing.generation)
const shareFailed = failGuideShare(failingShare, sharing.generation)
assert(
  shareFailed !== null && shareFailed.share.status === 'error' && shareFailed.share.receiptId === null,
  'a failed share surfaces the error state',
)

const shareReset = resetGuideConversation(sharing, deps)
assert(
  resolveGuideShare(shareReset, sharing.generation, 'receipt-late') === null,
  'a share receipt arriving after a reset is rejected as stale',
)

// --- draft bounds ---------------------------------------------------------------

const slicedDraft = setGuideDraft(createGuideConversation(deps), 'y'.repeat(900))
assert(slicedDraft.draft.length === GUIDE_MAX_MESSAGE_CHARS, 'the draft is capped at 800 characters')

// --- parseGuideAnswer: contract + bounds ---------------------------------------

const parsed = parseGuideAnswer({
  heading: '  Joel’s best work  ',
  answer: 'The answer text.',
  sourceCards: [
    { id: 'a', label: 'A', url: '#work/a' },
    { id: 'b', label: 'B' },
    { nope: true },
    null,
  ],
  followUps: ['One?', 'Two?', 'Three?'],
  topic: 'leadership',
  modelClass: 'frontier',
  profileVersion: 'v2',
})
assert(parsed.heading === 'Joel’s best work', 'the parser trims the heading')
assert(
  parsed.sourceCards.length === 2 &&
    parsed.sourceCards[0].url === '#work/a' &&
    !('url' in parsed.sourceCards[1]),
  'the parser filters malformed source cards and keeps url optional',
)
assert(parsed.followUps.length === 2, 'follow-ups are capped at two')
assert(parsed.topic === 'leadership', 'a known topic parses through')

const unknownTopic = parseGuideAnswer({ heading: 'Valid heading here', answer: 'ok', topic: 'nope' })
assert(unknownTopic.topic === 'unknown', 'an unknown topic degrades to "unknown"')

function assertThrows(payload, message) {
  let threw = false
  try {
    parseGuideAnswer(payload)
  } catch {
    threw = true
  }
  assert(threw, message)
}

assertThrows(null, 'a null body is rejected')
assertThrows({ heading: 'Valid heading here' }, 'a missing answer is rejected')
assertThrows({ heading: 'Valid heading here', answer: '   ' }, 'a blank answer is rejected')
assertThrows({ answer: 'ok' }, 'a missing heading is rejected')
assertThrows({ answer: 'ok', heading: 'Oneword' }, 'a one-word heading is rejected')
assertThrows(
  { answer: 'ok', heading: 'one two three four five six seven eight nine ten' },
  'a ten-word heading is rejected',
)
assertThrows(
  { answer: 'ok', heading: `long ${'heading '.repeat(12)}`.trim() },
  'a heading over 72 characters is rejected',
)
assert(
  parseGuideAnswer({ answer: 'ok', heading: 'heading '.repeat(8).trim() }).heading.length <= 72,
  'an eight-word heading within the 72-character bound parses',
)

if (failures > 0) {
  console.error(`\n${failures} verification(s) failed.`)
  process.exit(1)
}

console.log('\nAll guide conversation state verifications passed.')
