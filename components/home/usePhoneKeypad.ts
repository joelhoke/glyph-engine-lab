'use client'

import { useCallback, useRef } from 'react'
import { GUIDE_MAX_MESSAGE_CHARS, isGuideLimitReached } from '../collaborate/guideConversation'
import type { HomeGuideBridge } from './HomePhoneChat'
import { phoneBackspace, typePhoneKey, type PhoneTap } from './phoneKeypad'
import type { PhoneModelKey } from './renderers/phoneModelKeys'

/** The physical model's Easter egg shares the regular composer/controller. */
export function usePhoneKeypad(guide: HomeGuideBridge) {
  const uppercase = useRef(false)
  const lastTap = useRef<PhoneTap | null>(null)
  return useCallback((key: PhoneModelKey) => {
    const state = guide.getState()
    if (key === 'chat' || key === 'popout') {
      lastTap.current = null
      if (!guide.inline) guide.onReturn()
      else if (key === 'chat') guide.onExpand()
      else guide.onPopOut()
      return
    }
    if (key === 'send' && !guide.inline) { lastTap.current = null; guide.onReturn(); return }
    if (!guide.inline || !state || state.status === 'pending' || isGuideLimitReached(state)) return
    if (key === 'send') {
      lastTap.current = null
      if (state.draft.trim()) guide.onSend(state.draft)
    } else if (key === 'backspace') {
      lastTap.current = null
      guide.onDraftChange(phoneBackspace(state.draft))
    } else if (key === '#') {
      lastTap.current = null
      uppercase.current = !uppercase.current
    } else {
      const next = typePhoneKey(state.draft, key, lastTap.current, Date.now(), uppercase.current, GUIDE_MAX_MESSAGE_CHARS)
      lastTap.current = next.tap
      guide.onDraftChange(next.draft)
    }
  }, [guide])
}
