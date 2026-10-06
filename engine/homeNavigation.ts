import type { ExperienceSceneKey } from './types'
import type { HomeSectionId } from '../content/home'
import { parseExperienceHashTarget, shouldCanonicalizeCollaborateChat } from './experienceHash'

/** Retired Collaborate landing links now resolve to the homepage phone.
 * Full chat remains a separate view while its conversation is in memory. */
export function collaborateHomeRedirect(hash: string, hasConversationTurns: boolean): string | null {
  const target = parseExperienceHashTarget(hash)
  return target?.key === 'collaborate' &&
    (target.subview !== 'chat' || shouldCanonicalizeCollaborateChat(target, hasConversationTurns))
    ? '#home/collaborate' : null
}

/**
 * Site-wide destination model (homepage-redesign phase 2). Home and Gallery
 * are NOT engine scenes — Home is the root landing (`/`) with in-page
 * sections addressed by `#home/<section>`, Gallery is a plain route — so
 * neither enters ExperienceSceneKey. The hash-routing parser in
 * engine/experienceHash.ts keeps owning the scene modes; parseHomeSection is
 * checked BEFORE it by the shell's navigation coordinator.
 */
export type SiteDestination =
  | { kind: 'home'; section?: HomeSectionId }
  | { kind: 'work'; storyId?: string }
  | { kind: 'scene'; key: Exclude<ExperienceSceneKey, 'work'> }
  | { kind: 'route'; href: '/gallery' }

export function destinationHref(target: SiteDestination): string {
  switch (target.kind) {
    case 'home':
      return target.section ? `/#home/${target.section}` : '/'
    case 'work':
      return target.storyId ? `/#work/${target.storyId}` : '/#work'
    case 'scene':
      return target.key === 'collaborate' ? '/#home/collaborate' : `/#${target.key}`
    case 'route':
      return target.href
  }
}

/** Parse `#home/<section>` hashes. Returns null for anything else so the
 *  experience parser (`parseExperienceHashTarget`) can try next — 'home' is
 *  not a scene key, so the two never collide. */
export function parseHomeSection(hash: string): HomeSectionId | null {
  const match = /^#home\/(work|vibe|gallery|collaborate|about)$/i.exec(hash)
  return match ? (match[1].toLowerCase() as HomeSectionId) : null
}

// --- History state -----------------------------------------------------------
//
// Every pushState in the app historically passed `null` state, so the
// homepage keeps its scroll-restoration data in a single namespaced key
// (`jhHome`) and always merges over the existing state object instead of
// replacing it.

export type HomeHistoryEntry = { key: string; scrollY: number }

const HOME_HISTORY_KEY = 'jhHome'

/** Read the homepage entry data from a history state object (null-safe). */
export function readHomeHistoryEntry(state: unknown): HomeHistoryEntry | null {
  if (typeof state !== 'object' || state === null) return null
  const entry = (state as Record<string, unknown>)[HOME_HISTORY_KEY]
  if (typeof entry !== 'object' || entry === null) return null
  const { key, scrollY } = entry as Record<string, unknown>
  if (typeof key !== 'string' || typeof scrollY !== 'number' || !Number.isFinite(scrollY)) {
    return null
  }
  return { key, scrollY: Math.max(0, scrollY) }
}

/** Stamp the CURRENT history entry with homepage data, preserving any other
 *  state keys already on it. */
export function writeHomeHistoryEntry(entry: HomeHistoryEntry): void {
  const previous = readHomeHistoryEntry(window.history.state)
  if (previous?.key === entry.key && previous.scrollY === entry.scrollY) return
  window.history.replaceState(
    { ...(window.history.state ?? {}), [HOME_HISTORY_KEY]: entry },
    '',
  )
}

/** Scroll events can arrive at 120 Hz. Persist at most four times a second,
 * with an explicit final flush when scrolling stops or the page is left. */
export function createHomeScrollRecorder(
  record: () => void,
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> = setTimeout,
  cancel: (timer: ReturnType<typeof setTimeout>) => void = clearTimeout,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    if (timer !== null) cancel(timer)
    timer = null
    record()
  }
  return {
    schedule: () => {
      if (timer === null) timer = schedule(flush, 250)
    },
    flush,
  }
}

/** State object for a NEW history entry on a homepage URL. */
export function createHomeHistoryState(scrollY = 0): { [HOME_HISTORY_KEY]: HomeHistoryEntry } {
  return {
    [HOME_HISTORY_KEY]: {
      key: `home-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      scrollY,
    },
  }
}
