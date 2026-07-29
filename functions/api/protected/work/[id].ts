/**
 * GET /api/protected/work/:id — one story's full manifest. The public,
 * opaque story ID maps to the private R2 key `manifests/<id>.json`; the ID
 * is strictly validated before any bucket access, so traversal and unknown
 * shapes can never reach R2.
 */

import { isValidProtectedId, protectedJson } from '../../../lib/protectedShared'

type ProtectedEnv = {
  PROTECTED_BUCKET: R2Bucket
}

export const onRequestGet: PagesFunction<ProtectedEnv, 'id'> = async (context) => {
  const rawId = context.params.id
  // Decode before validating: encoded separators (%2e%2e%2f, %2f) must fail
  // the same way literal ones do.
  let id = rawId
  try {
    id = decodeURIComponent(rawId)
  } catch {
    return protectedJson({ error: 'invalid story id' }, 400)
  }
  if (!isValidProtectedId(id)) {
    return protectedJson({ error: 'invalid story id' }, 400)
  }

  const object = await context.env.PROTECTED_BUCKET.get(`manifests/${id}.json`)
  if (!object) {
    return protectedJson({ error: 'unknown story' }, 404)
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
