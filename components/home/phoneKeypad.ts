/** Classic multi-tap SMS input. The number is the final entry in each cycle. */
export const PHONE_KEYS = [
  { key: '1', letters: '.,?!', cycle: '.,?!1' },
  { key: '2', letters: 'ABC', cycle: 'abc2' },
  { key: '3', letters: 'DEF', cycle: 'def3' },
  { key: '4', letters: 'GHI', cycle: 'ghi4' },
  { key: '5', letters: 'JKL', cycle: 'jkl5' },
  { key: '6', letters: 'MNO', cycle: 'mno6' },
  { key: '7', letters: 'PQRS', cycle: 'pqrs7' },
  { key: '8', letters: 'TUV', cycle: 'tuv8' },
  { key: '9', letters: 'WXYZ', cycle: 'wxyz9' },
  { key: '*', letters: '+ / @', cycle: '*+/@' },
  { key: '0', letters: 'SPACE', cycle: ' 0' },
] as const

export type PhoneTap = { key: string; index: number; at: number; draft: string; uppercase: boolean }
export const PHONE_TAP_WINDOW_MS = 900

export function typePhoneKey(draft: string, key: string, previous: PhoneTap | null, now: number, uppercase: boolean, limit: number) {
  const button = PHONE_KEYS.find(button => button.key === key)
  if (!button) return { draft, tap: null }
  const cycling = previous && previous.key === key && previous.draft === draft && previous.uppercase === uppercase &&
    now >= previous.at && now - previous.at < PHONE_TAP_WINDOW_MS
  const index = cycling ? (previous.index + 1) % button.cycle.length : 0
  const prefix = cycling ? draft.slice(0, -1) : draft
  const character = uppercase ? button.cycle[index].toUpperCase() : button.cycle[index]
  if (prefix.length + character.length > limit) return { draft, tap: previous }
  const next = prefix + character
  return { draft: next, tap: { key, index, at: now, draft: next, uppercase } }
}

export function phoneBackspace(draft: string) {
  return Array.from(draft).slice(0, -1).join('')
}
