/**
 * `POST /api/collaborate/share` — store an explicitly consented transcript.
 *
 * Only reachable after the visitor checks “Share this conversation with Joel”;
 * conversations are otherwise client-side and ephemeral. Shares live in the
 * separate COLLABORATE_DB D1 database for 180 days (daily cleanup Worker +
 * opportunistic deletion on writes). The reply email is never sent to a model.
 */

import { handleShareRequest } from '../../lib/collaborateShare'

type ShareEnv = {
  COLLABORATE_DB?: D1Database
}

export const onRequestPost: PagesFunction<ShareEnv> = (context) =>
  handleShareRequest(context.request, context.env.COLLABORATE_DB, {
    nowSeconds: () => Math.floor(Date.now() / 1000),
    randomId: () => crypto.randomUUID(),
  })
