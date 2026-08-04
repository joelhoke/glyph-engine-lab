import { ExperienceSceneKey } from './types'

/**
 * Pure helpers for synchronizing the active experience mode with the URL hash.
 * Hash (not query) routing keeps the static export safe: the server never sees
 * the fragment, so every deep link serves the same prerendered page.
 */

export const EXPERIENCE_SCENE_KEYS: ExperienceSceneKey[] = ['work', 'vibe', 'collaborate']

/** The collaborate mode's nested chat subview hash. */
export const COLLABORATE_CHAT_HASH = '#collaborate/chat'

export function formatExperienceHash(key: ExperienceSceneKey): string {
  return `#${key}`
}

/**
 * Parse a location hash into an experience mode. Returns null for empty or
 * unrecognized hashes so callers can leave the current mode untouched.
 * Work story deep links (`#work/<storyId>`) parse as the work mode — use
 * parseExperienceHashTarget to recover the story id.
 */
export function parseExperienceHash(hash: string): ExperienceSceneKey | null {
  return parseExperienceHashTarget(hash)?.key ?? null
}

export type ExperienceHashTarget = {
  key: ExperienceSceneKey
  /** Story id from a `#work/<storyId>` deep link, or null for bare modes.
   *  Not validated here — callers resolve it against the slide list and
   *  treat unknown ids as a bare `#work`. */
  storyId: string | null
  /** Nested subview within a mode. Only `chat` under `#collaborate/chat` is
   *  recognized today; unknown nested segments degrade to the bare mode. */
  subview?: 'chat'
}

/**
 * Parse a location hash into a mode plus an optional work story id
 * (`#work/<storyId>`) or collaborate subview (`#collaborate/chat`).
 * Bounds-safe: only the first path segment selects the mode, only the second
 * is carried as the story id / subview, and anything else is ignored. Returns
 * null for empty or unrecognized hashes.
 */
export function parseExperienceHashTarget(hash: string): ExperienceHashTarget | null {
  const normalized = hash.trim().toLowerCase().replace(/^#/, '')
  const [head, storySegment] = normalized.split('/')
  for (const key of EXPERIENCE_SCENE_KEYS) {
    if (head === key) {
      return {
        key,
        storyId: key === 'work' && storySegment ? storySegment : null,
        ...(key === 'collaborate' && storySegment === 'chat'
          ? { subview: 'chat' as const }
          : {}),
      }
    }
  }
  return null
}

/**
 * Canonicalization guard for the collaborate chat subview: the chat deep link
 * is only meaningful while a conversation exists in memory. A direct load or
 * reload of `#collaborate/chat` (no turns — page memory is session-only)
 * resolves to the bare `#collaborate` landing via history.replaceState in the
 * shell; this pure decision keeps that rule testable.
 */
export function shouldCanonicalizeCollaborateChat(
  target: ExperienceHashTarget | null,
  hasConversationTurns: boolean,
): boolean {
  return (
    !!target && target.key === 'collaborate' && target.subview === 'chat' && !hasConversationTurns
  )
}
