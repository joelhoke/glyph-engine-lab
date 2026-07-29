/**
 * Source-field outcome decision (M9 launch hardening).
 *
 * One pure rule decides whether a decoded source becomes the active target
 * field or whether the scene falls back to the built-in JH logo field:
 *
 * - A successful decode with at least one visible target keeps the source.
 * - Anything else — load/decode/read failure, or a decode that produced zero
 *   visible targets — is a genuine source failure and uses the JH fallback.
 *
 * Resize never consults this rule with stale state: SceneCanvas re-decodes
 * the ACTIVE source (held in stable refs) on every resize, so a healthy Work
 * SVG stays active across resizes and only a genuine decoding failure can
 * switch the scene to the fallback. Extracted from SceneCanvas so the rule
 * is verifiable outside the browser (scripts/verify-svg-resize-fallback.js).
 */

export type SourceDecodeOutcome = {
  /** Whether the decode pipeline completed without an error. */
  ok: boolean
  /** Number of visible targets the decode produced. */
  targetCount: number
  /** Failure detail from the decode pipeline, when it did not complete. */
  error?: string
}

export type SourceFieldDecision =
  | { use: 'source' }
  | { use: 'fallback'; reason: string }

export function resolveSourceFieldDecision(result: SourceDecodeOutcome): SourceFieldDecision {
  if (result.ok && result.targetCount > 0) {
    return { use: 'source' }
  }
  return {
    use: 'fallback',
    reason: result.ok
      ? 'source produced no visible targets'
      : (result.error ?? 'unknown error'),
  }
}
