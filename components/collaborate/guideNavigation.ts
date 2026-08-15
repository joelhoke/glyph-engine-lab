import { WORK_SLIDES, WorkSlide } from '../../content/work'
import { GuideConversationState } from './guideConversation'

/**
 * Pure decisions for the guided chat companion: how the conversation is
 * presented while the visitor browses the site, and which chat source links
 * become intentional in-app Work navigations. No DOM, no React — the shell
 * (PortfolioExperience) feeds real events and viewport widths in; tests feed
 * plain objects.
 */

/** How the guide conversation is presented.
 *  - `page`: the full chat view at `#collaborate/chat`.
 *  - `companion`: a docked right-side panel alongside Work/Vibe (wide
 *    viewports only).
 *  - `minimized`: a bottom resume bar (narrow) or compact pill (wide);
 *    narrow viewports can expand it into a full-viewport modal overlay —
 *    an overlay flag owned by the shell, not a fourth presentation. */
export type GuidePresentation = 'page' | 'companion' | 'minimized'

/** Viewports at or above this width present the docked companion; below it
 *  the conversation minimizes to the resume bar. Matches the CSS breakpoint. */
export const GUIDE_COMPANION_MIN_WIDTH_PX = 960

/** Status surfaced in the minimized chrome — next to the guide title only,
 *  never transcript text. */
export type GuideMinimizedStatus = 'pending' | 'unseen-answer'

/** A validated internal Work destination from a chat source card. */
export type GuideSourceTarget = {
  storyId: string
  slideIndex: number
}

/**
 * Resolve a source-card URL to an internal Work destination. Only curated
 * `#work/<storyId>` links whose story id matches a project slide resolve;
 * external links, bare/unknown ids, nested paths, and non-link sources return
 * null so the caller leaves the native anchor behavior alone.
 */
export function resolveGuideSourceTarget(
  url: string | undefined,
  slides: WorkSlide[] = WORK_SLIDES,
): GuideSourceTarget | null {
  if (!url) return null
  const normalized = url.trim().toLowerCase()
  if (!normalized.startsWith('#work/')) return null
  const storyId = normalized.slice('#work/'.length)
  if (!storyId || storyId.includes('/') || storyId.includes('#') || storyId.includes('?')) {
    return null
  }
  const slideIndex = slides.findIndex(
    (slide) => slide.kind === 'project' && slide.story.id === storyId,
  )
  if (slideIndex < 0) return null
  return { storyId, slideIndex }
}

/** The minimal shape of a click event the predicate needs (React MouseEvent
 *  satisfies it structurally). */
export type PrimaryClickLike = {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
}

/** True only for an unmodified primary-button click — the intentional
 *  navigation gesture. Modified clicks (new tab/window, copy link), secondary
 *  buttons, and already-handled clicks keep the native anchor behavior. */
export function isUnmodifiedPrimaryClick(event: PrimaryClickLike): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  )
}

/** The presentation after leaving the full chat page — via a source
 *  navigation or the header pop-out/minimize control: the docked companion on
 *  wide viewports, the minimized resume bar on narrow ones. */
export function resolveGuideExitPresentation(viewportWidth: number): GuidePresentation {
  return viewportWidth >= GUIDE_COMPANION_MIN_WIDTH_PX ? 'companion' : 'minimized'
}

/**
 * Viewport crossing: an open companion minimizes when the width drops below
 * the breakpoint (never an unexpected modal). Widening never reopens anything
 * — a minimized chat stays minimized until the visitor resumes it.
 */
export function resolveGuideViewportCrossing(
  presentation: GuidePresentation,
  viewportWidth: number,
): GuidePresentation {
  if (presentation === 'companion' && viewportWidth < GUIDE_COMPANION_MIN_WIDTH_PX) {
    return 'minimized'
  }
  return presentation
}

/** What the minimized chrome shows next to the guide title: the pending
 *  request, or a new answer that arrived while the visitor was away. */
export function resolveGuideMinimizedStatus(
  state: Pick<GuideConversationState, 'status'> | null,
  hasUnseenAnswer: boolean,
): GuideMinimizedStatus | null {
  if (state?.status === 'pending') return 'pending'
  if (hasUnseenAnswer) return 'unseen-answer'
  return null
}
