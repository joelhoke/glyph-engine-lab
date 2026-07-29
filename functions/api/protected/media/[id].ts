/**
 * GET /api/protected/media/:id — stream a confidential media object with
 * HTTP Range support (seekable video). The opaque media ID maps to the
 * private R2 key `media/<id>`; IDs are strictly validated, and only
 * allowlisted content types may leave the bucket.
 */

import {
  buildProtectedHeaders,
  isAllowedProtectedMime,
  isValidProtectedId,
  parseRangeHeader,
  protectedJson,
} from '../../../lib/protectedShared'

type ProtectedEnv = {
  PROTECTED_BUCKET: R2Bucket
}

export const onRequestGet: PagesFunction<ProtectedEnv, 'id'> = async (context) => {
  let id = context.params.id
  try {
    id = decodeURIComponent(id)
  } catch {
    return protectedJson({ error: 'invalid media id' }, 400)
  }
  if (!isValidProtectedId(id)) {
    return protectedJson({ error: 'invalid media id' }, 400)
  }

  const head = await context.env.PROTECTED_BUCKET.head(`media/${id}`)
  if (!head) {
    return protectedJson({ error: 'unknown media' }, 404)
  }

  const contentType = head.httpMetadata?.contentType ?? 'application/octet-stream'
  if (!isAllowedProtectedMime(contentType)) {
    return protectedJson({ error: 'unsupported media type' }, 415)
  }

  const baseHeaders = buildProtectedHeaders({
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
  })

  const range = parseRangeHeader(context.request.headers.get('Range'), head.size)
  if (range.kind === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: buildProtectedHeaders({ 'Content-Range': `bytes */${head.size}` }),
    })
  }

  if (range.kind === 'range') {
    const object = await context.env.PROTECTED_BUCKET.get(`media/${id}`, {
      range: { offset: range.start, length: range.end - range.start + 1 },
    })
    if (!object) return protectedJson({ error: 'unknown media' }, 404)
    return new Response(object.body, {
      status: 206,
      headers: buildProtectedHeaders({
        ...baseHeaders,
        'Content-Range': `bytes ${range.start}-${range.end}/${head.size}`,
        'Content-Length': String(range.end - range.start + 1),
      }),
    })
  }

  const object = await context.env.PROTECTED_BUCKET.get(`media/${id}`)
  if (!object) return protectedJson({ error: 'unknown media' }, 404)
  return new Response(object.body, {
    status: 200,
    headers: buildProtectedHeaders({
      ...baseHeaders,
      'Content-Length': String(head.size),
    }),
  })
}
