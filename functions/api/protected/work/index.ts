/**
 * GET /api/protected/work — list the available protected stories (IDs and
 * non-sensitive titles/summaries) from the bucket's manifests/index.json.
 */

import { protectedJson } from '../../../lib/protectedShared'

type ProtectedEnv = {
  PROTECTED_BUCKET: R2Bucket
}

export const onRequestGet: PagesFunction<ProtectedEnv> = async (context) => {
  const object = await context.env.PROTECTED_BUCKET.get('manifests/index.json')
  if (!object) {
    return protectedJson({ error: 'no protected stories are published' }, 404)
  }
  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'",
    },
  })
}
