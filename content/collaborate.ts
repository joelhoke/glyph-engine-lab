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
//
// The conversational AI guide is likewise gated (COLLABORATE_AI_GUIDE =
// false). While both flags are off the production experience is unchanged:
// headline, statement, and the two contact routes only.
// =============================================================================

import { SceneDescriptor } from '../engine/sceneConfig'

/** Launch gate for the conversation starters (see header). Enabled alongside
 *  the AI guide: three audience-framed invitations (hiring managers,
 *  early-stage collaborators, small businesses). */
export const COLLABORATE_SHOW_STARTERS = true

/** Preview-only launch gate for the conversational AI guide. Flipping this
 *  requires the launch gates in docs/deployment.md to pass. */
export const COLLABORATE_AI_GUIDE = true

export type ConversationStarter = {
  /** Stable, unique identifier — used as the React key and selection state. */
  id: string
  /** The invitation itself, shown on the starter control. */
  label: string
  /** Short, meaningful reply announced (aria-live) when the starter is selected
   *  (the scripted, non-guide experience). */
  response: string
  /** The actual question submitted to the AI guide when this starter is
   *  selected in guide mode. */
  prompt: string
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
    id: 'hiring-role',
    label: 'I’m hiring for a design role.',
    response:
      'The short version: senior or lead individual-contributor work, on a problem still a little undefined. Ask the guide for the longer one.',
    prompt: 'What kind of role and team brings out Joel’s best work?',
    glyphPhrase: '✳ ✳ ✳',
  },
  {
    id: 'early-stage',
    label: 'I’m building something early-stage.',
    response:
      'Early and half-shaped is a great place to start — that is where Joel does his best work.',
    prompt: 'Would Joel advise or join an early-stage startup?',
    glyphPhrase: 'idea idea idea',
  },
  {
    id: 'small-business',
    label: 'I run a small business and need product help.',
    response:
      'Worth a conversation — Joel can usually tell quickly whether he is the right pair of hands for it.',
    prompt: 'How could Joel help a small business with its product or digital experience?',
    glyphPhrase: '? ? ?',
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

/** Contact routes as labeled inside the AI guide experience — same address
 *  and feedback copy, with labels that make sense alongside the guide. */
export const COLLABORATE_GUIDE_CONTACT: CollaborateContact = {
  ...COLLABORATE_CONTACT,
  primaryLabel: 'Email Joel directly',
  copyLabel: 'Copy Joel’s email.',
}

/** Persistent disclosure shown at the top of the AI guide experience. */
export const COLLABORATE_GUIDE_DISCLOSURE =
  'AI guide to Joel — built from material he has reviewed.'

// -- Chat view copy (behind COLLABORATE_AI_GUIDE) -------------------------------

/** Shown as the chat heading until the first answer's generated title locks. */
export const COLLABORATE_GUIDE_PENDING_HEADING = 'A conversation about Joel'

/** Speaker labels on transcript turns. */
export const COLLABORATE_GUIDE_VISITOR_LABEL = 'You'
export const COLLABORATE_GUIDE_NAME = 'Joel’s Guide'

/** Landing preview card (shown once a conversation exists in memory). */
export const COLLABORATE_GUIDE_PREVIEW_LABEL = 'Conversation in progress'
export const COLLABORATE_GUIDE_RESUME = 'Resume conversation'
export const COLLABORATE_GUIDE_NEW = 'Start new conversation'
export const COLLABORATE_GUIDE_NEW_CONFIRM_PROMPT =
  'Start over? The current conversation will be cleared.'
export const COLLABORATE_GUIDE_NEW_CONFIRM_YES = 'Yes, start new'
export const COLLABORATE_GUIDE_NEW_CONFIRM_CANCEL = 'Keep this conversation'

/** The share control below the composer: a switch (toggling sends nothing),
 *  an explicit share button (the ONLY network call), and its states. */
export const COLLABORATE_GUIDE_SHARE_LABEL = 'Share conversation with Joel'
export const COLLABORATE_GUIDE_SHARE_NOTE =
  'Shared transcripts are kept for 180 days, then deleted. You’ll get a receipt ID you can quote to request earlier deletion.'
export const COLLABORATE_GUIDE_SHARE_EMAIL_LABEL = 'Optional: your email, so Joel can reply'
export const COLLABORATE_GUIDE_SHARE_BUTTON = 'Share conversation'
export const COLLABORATE_GUIDE_SHARE_SENDING = 'Sharing…'
export const COLLABORATE_GUIDE_SHARE_ERROR =
  'Sharing didn’t go through — try again, or use the email route in the transcript above.'

/** Chat chrome. */
export const COLLABORATE_GUIDE_BACK_LABEL = 'Back to Collaborate'
export const COLLABORATE_GUIDE_COMPOSER_LABEL = 'Message Joel’s guide'
export const COLLABORATE_GUIDE_COMPOSER_PLACEHOLDER = 'Ask about Joel’s work…'
export const COLLABORATE_GUIDE_SEND_LABEL = 'Send message'

/** Guide presentation chrome (companion dock / minimized resume / overlay). */
export const COLLABORATE_GUIDE_POP_OUT_LABEL = 'Pop chat out'
export const COLLABORATE_GUIDE_MINIMIZE_LABEL = 'Minimize chat'
export const COLLABORATE_GUIDE_OPEN_FULL_LABEL = 'Open full conversation'
export const COLLABORATE_GUIDE_RESUME_PENDING_STATUS = 'Thinking…'
export const COLLABORATE_GUIDE_RESUME_UNSEEN_STATUS = 'New answer'

/** Announced (visually hidden, polite) when a guide answer arrives; focus is
 *  NOT moved to the answer. */
export const COLLABORATE_GUIDE_ANSWERED_ANNOUNCEMENT = 'Joel’s Guide answered'

// -- Canvas topic treatments -----------------------------------------------------

/** Topics the guide backend assigns to each answer; mirrored in
 *  functions/lib/collaborateProfile.ts. */
export const COLLABORATE_TOPICS = [
  'craft',
  'leadership',
  'collaboration',
  'career-fit',
  'entrepreneurial-fit',
  'logistics',
  'unknown',
] as const

export type CollaborateTopic = (typeof COLLABORATE_TOPICS)[number]

export type CollaborateCanvasTreatment = {
  /** Authored glyph phrase swapped into the field for this topic. Never
   *  visitor text or model text — fixed, on-brand presets only. */
  glyphPhrase: string
  /** Optional gentle behavior tweaks, merged over the collaborate baseline
   *  (already the gentlest mode — keep any overrides subtler still). */
  behavior?: Partial<SceneDescriptor['behavior']>
}

/** Authored per-topic canvas treatments for guide answers. */
export const COLLABORATE_CANVAS_TOPICS: Record<CollaborateTopic, CollaborateCanvasTreatment> = {
  craft: { glyphPhrase: 'craft craft craft' },
  leadership: { glyphPhrase: 'lead lead lead' },
  collaboration: { glyphPhrase: '✳ ✳ ✳' },
  'career-fit': { glyphPhrase: '? ? ?' },
  'entrepreneurial-fit': { glyphPhrase: 'idea idea idea' },
  logistics: { glyphPhrase: '@ @ @' },
  unknown: { glyphPhrase: '· · ·' },
}

/**
 * Resolve the full scene descriptor for the collaborate mode: the collaborate
 * scene's baseline with a glyph phrase merged over the playground glyph text.
 * A guide topic treatment (when provided) wins: its authored glyph phrase
 * overrides `playground.glyphText` and its behavior tweaks merge over the
 * baseline behavior. With no topic, the selected starter's phrase applies;
 * neither keeps the baseline. The base descriptor is never mutated.
 */
export function resolveCollaborateScene(
  base: SceneDescriptor,
  starter: ConversationStarter | null,
  topic?: CollaborateTopic | null,
): SceneDescriptor {
  const treatment = topic ? COLLABORATE_CANVAS_TOPICS[topic] : null
  const glyphText = treatment?.glyphPhrase ?? starter?.glyphPhrase
  return {
    ...base,
    playground: {
      ...base.playground,
      ...(glyphText ? { glyphText } : {}),
    },
    behavior: { ...base.behavior, ...(treatment?.behavior ?? {}) },
    sourceLayout: { ...base.sourceLayout },
    copy: { ...base.copy },
  }
}
