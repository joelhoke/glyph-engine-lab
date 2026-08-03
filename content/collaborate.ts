// =============================================================================
// Collaborate content — single source of truth for the Collaborate experience.
//
// The headline, the energizing-collaboration statement, every conversation
// starter, and both contact destinations (mailto + copy-to-clipboard) live
// below. Nothing outside this file should need to change when copy evolves.
//
// The conversation starters are currently HIDDEN (COLLABORATE_SHOW_STARTERS
// = false): the conversational piece is being reworked and is not ready for
// launch. The model and plumbing stay intact — flip the flag to bring them
// back; nothing else needs to change.
// =============================================================================

import { SceneDescriptor } from '../engine/sceneConfig'

/** Launch gate for the conversation starters (see header). */
export const COLLABORATE_SHOW_STARTERS = false

export type ConversationStarter = {
  /** Stable, unique identifier — used as the React key and selection state. */
  id: string
  /** The invitation itself, shown on the starter control. */
  label: string
  /** Short, meaningful reply announced (aria-live) when the starter is selected. */
  response: string
  /** Optional glyph motif: when set, selecting this starter swaps the canvas
   *  field's glyph population text (playground.glyphText) to this phrase.
   *  Purely a scene-descriptor override — no renderer features involved. */
  glyphPhrase?: string
}

export type CollaborateContact = {
  /** The address used by both the mailto link and the copy action. */
  email: string
  /** mailto: URL — the primary action; works with JavaScript disabled. */
  mailtoUrl: string
  /** Label for the primary mailto link. */
  primaryLabel: string
  /** Label for the low-friction copy-to-clipboard action. */
  copyLabel: string
  /** Feedback announced when the address is copied successfully. */
  copySuccessMessage: string
  /** Feedback announced when copying fails (the address stays visible to select). */
  copyFailureMessage: string
}

export const COLLABORATE_HEADLINE = "Let's build something interesting together."

export const COLLABORATE_ENERGIZING_STATEMENT =
  'The collaborations that energize me most are the ones where the problem is still a little undefined — where we get to figure out what the thing wants to be, not just decorate what it already is.'

export const CONVERSATION_STARTERS: ConversationStarter[] = [
  {
    id: 'have-an-idea',
    label: 'I have an idea.',
    response:
      'Good — bring the messy version. The early, half-shaped ideas are usually the most fun to work on.',
    glyphPhrase: 'idea idea idea',
  },
  {
    id: 'strange-problem',
    label: 'I have a strange problem.',
    response:
      'Strange problems are my favorite kind. The weirder the constraint, the more interesting the solution tends to be.',
    glyphPhrase: '? ? ?',
  },
  {
    id: 'explore-possible',
    label: "I want to explore what's possible.",
    response:
      "Let's explore. Some of the best work starts with no brief at all — just curiosity and a little time.",
    glyphPhrase: '✳ ✳ ✳',
  },
]

export const COLLABORATE_STARTER_COUNT = CONVERSATION_STARTERS.length

/** Bounds-safe starter lookup — unknown or null ids resolve to null (no selection). */
export function getCollaborateStarter(id: string | null): ConversationStarter | null {
  if (!id) return null
  return CONVERSATION_STARTERS.find((starter) => starter.id === id) ?? null
}

export const COLLABORATE_CONTACT: CollaborateContact = {
  email: 'hello@joelhoke.me',
  mailtoUrl: 'mailto:hello@joelhoke.me',
  primaryLabel: 'Start the conversation',
  copyLabel: 'Copy the address instead',
  copySuccessMessage: 'Address copied — see you in your inbox.',
  copyFailureMessage: "Couldn't copy automatically — the address below is ready to select.",
}

/**
 * Resolve the full scene descriptor for the collaborate mode: the collaborate
 * scene's baseline with the selected starter's glyph phrase merged over the
 * playground glyph text. No starter (or no phrase) keeps the baseline. The
 * base descriptor is never mutated.
 */
export function resolveCollaborateScene(
  base: SceneDescriptor,
  starter: ConversationStarter | null,
): SceneDescriptor {
  return {
    ...base,
    playground: {
      ...base.playground,
      ...(starter?.glyphPhrase ? { glyphText: starter.glyphPhrase } : {}),
    },
    behavior: { ...base.behavior },
    sourceLayout: { ...base.sourceLayout },
    copy: { ...base.copy },
  }
}
