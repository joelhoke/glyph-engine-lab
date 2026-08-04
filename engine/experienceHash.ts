import { ExperienceSceneKey } from './types'

/**
 * Pure helpers for synchronizing the active experience mode with the URL hash.
 * Hash (not query) routing keeps the static export safe: the server never sees
 * the fragment, so every deep link serves the same prerendered page.
 */

export const EXPERIENCE_SCENE_KEYS: ExperienceSceneKey[] = ['work', 'vibe', 'collaborate']

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
}

/**
 * Parse a location hash into a mode plus an optional work story id
 * (`#work/<storyId>`). Bounds-safe: only the first path segment selects the
 * mode, only the second is carried as the story id, and anything else is
 * ignored. Returns null for empty or unrecognized hashes.
 */
export function parseExperienceHashTarget(hash: string): ExperienceHashTarget | null {
  const normalized = hash.trim().toLowerCase().replace(/^#/, '')
  const [head, storySegment] = normalized.split('/')
  for (const key of EXPERIENCE_SCENE_KEYS) {
    if (head === key) {
      return {
        key,
        storyId: key === 'work' && storySegment ? storySegment : null,
      }
    }
  }
  return null
}
