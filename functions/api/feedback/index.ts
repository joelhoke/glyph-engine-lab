/**
 * `POST /api/feedback` — store a feedback submission in D1.
 *
 * All logic lives in `functions/lib/feedbackShared.ts` (Node-testable); this
 * file only wires the Pages Function context to it. Rate limiting (5 POSTs
 * per 10 minutes per IP → 429) is enforced by a Cloudflare rate-limit rule,
 * not here — see docs/deployment.md.
 */

import { handleFeedbackRequest } from '../../lib/feedbackShared'

type FeedbackEnv = {
  FEEDBACK_DB?: D1Database
}

export const onRequestPost: PagesFunction<FeedbackEnv> = (context) =>
  handleFeedbackRequest(context.request, context.env.FEEDBACK_DB)
