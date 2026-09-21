#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const out = fs.mkdtempSync(path.join(root, 'tmp-verify-phone-keypad-'))
try {
  execFileSync(path.join(root, 'node_modules/.bin/tsc'), ['components/home/phoneKeypad.ts', 'components/home/usePhoneKeypad.ts', 'components/home/HomePhoneChat.tsx', '--outDir', out,
    '--module', 'commonjs', '--target', 'es2020', '--jsx', 'react-jsx', '--esModuleInterop', '--skipLibCheck'], { cwd: root, stdio: 'inherit' })
  const { typePhoneKey, phoneBackspace, PHONE_KEYS } = require(path.join(out, 'components/home/phoneKeypad.js'))
  let draft = '', tap = null, now = 0
  const press = (key, delay = 100, uppercase = false, limit = 1000) => {
    now += delay
    const next = typePhoneKey(draft, key, tap, now, uppercase, limit)
    draft = next.draft; tap = next.tap
  }
  press('4'); press('4'); press('3'); press('3'); press('5'); press('5'); press('5')
  press('5', 1000); press('5'); press('5'); press('6'); press('6'); press('6')
  assert.equal(draft, 'hello', 'multi-tap types across keys and repeated letters')
  press('0'); press('9'); press('9'); press('9'); press('9')
  assert.equal(draft, 'hello z')
  assert.equal(PHONE_KEYS.find(k => k.key === '7').letters, 'PQRS')
  assert.equal(PHONE_KEYS.find(k => k.key === '9').letters, 'WXYZ')
  draft = ''; tap = null
  for (let i = 0; i < 4; i++) press('2')
  assert.equal(draft, '2', 'number is available after its letters')
  press('2'); assert.equal(draft, 'a', 'cycle wraps')
  draft = 'typed externally'
  press('2'); assert.equal(draft, 'typed externallya', 'native composer edit ends the old cycle')
  press('2', 100, true); assert.equal(draft, 'typed externallyaA', 'case switch starts a fresh character')
  assert.equal(phoneBackspace('Hi 🌊'), 'Hi ', 'backspace preserves surrogate pairs')
  draft = 'a'; tap = { key: '2', index: 0, at: now, draft: 'a', uppercase: false }
  press('2', 100, false, 1); assert.equal(draft, 'b', 'can cycle the last character at the limit')
  press('3', 100, false, 1); assert.equal(draft, 'b', 'cannot exceed the draft limit')
  assert.equal(typePhoneKey('unchanged', 'unknown', null, 0, false, 100).draft, 'unchanged')
  // Exercise the actual hook across several native model-key events before
  // React receives new props: it must read the current controller draft.
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const { usePhoneKeypad } = require(path.join(out, 'components/home/usePhoneKeypad.js'))
  const HomePhoneChat = require(path.join(out, 'components/home/HomePhoneChat.js')).default
  const { createGuideConversation, setGuideDraft } = require(path.join(out, 'components/collaborate/guideConversation.js'))
  let latest = createGuideConversation({ now: () => 1, id: () => 'phone-test' })
  const guide = { state: latest, getState: () => latest, inline: true,
    onDraftChange: value => { latest = setGuideDraft(latest, value) },
    onSend() { throw new Error('This regression must never submit a message') },
    onRetry() {}, onExpand() {}, onPopOut() {}, onReturn() {} }
  let onKey
  function Probe() { onKey = usePhoneKeypad(guide); return null }
  renderToStaticMarkup(React.createElement(Probe))
  onKey('2'); onKey('3')
  assert.equal(latest.draft, 'ad', 'rapid physical key presses use current state without waiting for render')
  onKey('backspace'); assert.equal(latest.draft, 'a')
  onKey('backspace'); assert.equal(latest.draft, '', 'final physical backspace empties the draft')
  onKey('backspace'); assert.equal(latest.draft, '', 'backspace on empty stays empty')
  const emptyHtml = renderToStaticMarkup(React.createElement(HomePhoneChat, { guide: { ...guide, state: latest } }))
  assert.match(emptyHtml, /data-empty="true"/)
  assert.match(emptyHtml, /home-phone-input-placeholder[^>]*>Ask a question…/)
  assert.match(emptyHtml, /<textarea[^>]*><\/textarea>/)
  onKey('2'); assert.equal(latest.draft, 'a', 'typing after deleting everything starts a new multi-tap cycle')
  const typedHtml = renderToStaticMarkup(React.createElement(HomePhoneChat, { guide: { ...guide, state: latest } }))
  assert(!typedHtml.includes('home-phone-input-placeholder'), 'placeholder disappears once a character is entered')
  console.log('PASS: multi-tap words, spacing, four-letter keys, numbers, case, external edits, rapid native key events, final-backspace placeholder, and length limits')
} finally { fs.rmSync(out, { recursive: true, force: true }) }
