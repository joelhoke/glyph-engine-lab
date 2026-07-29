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
 */
export function parseExperienceHash(hash: string): ExperienceSceneKey | null {
  const normalized = hash.trim().toLowerCase().replace(/^#/, '')
  for (const key of EXPERIENCE_SCENE_KEYS) {
    if (normalized === key) return key
  }
  return null
}
