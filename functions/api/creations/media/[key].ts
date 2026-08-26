/**
 * `GET /api/creations/media/:key` — stream a public creation media object
 * (thumbnail, clip video, or source image) with HTTP Range support so clips
 * are seekable in a <video> tag. Keys are strictly validated before any R2
 * access and the Content-Type is derived from the extension allowlist, never
 * from stored metadata. Objects are content-addressed by random creation ID,
 * so responses are immutable and cached for a year.
 */

import { isValidMediaKey, MEDIA_KEY_EXT_TO_MIME } from '../../../lib/creations'
import { parseRangeHeader } from '../../../lib/protectedShared'

type MediaEnv = {
  CREATIONS_BUCKET?: R2Bucket
}

function notFound(): Response {
  return new Response('not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

function buildMediaHeaders(contentType: string, extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  }
}

export const onRequestGet: PagesFunction<MediaEnv, 'key'> = async (context) => {
  let key = context.params.key
  try {
    key = decodeURIComponent(key)
  } catch {
    return notFound()
  }
  if (!isValidMediaKey(key)) return notFound()

  const bucket = context.env.CREATIONS_BUCKET
  if (!bucket)
    return new Response(JSON.stringify({ ok: false, error: 'Creations are unavailable.' }), {
      status: 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    })

  const ext = key.split('.').pop() as string
  const contentType = MEDIA_KEY_EXT_TO_MIME[ext]
  if (!contentType) return notFound()

  const head = await bucket.head(key)
  if (!head) return notFound()

  const range = parseRangeHeader(context.request.headers.get('Range'), head.size)
  if (range.kind === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: buildMediaHeaders(contentType, { 'Content-Range': `bytes */${head.size}` }),
    })
  }

  if (range.kind === 'range') {
    const object = await bucket.get(key, {
      range: { offset: range.start, length: range.end - range.start + 1 },
    })
    if (!object) return notFound()
    return new Response(object.body, {
      status: 206,
      headers: buildMediaHeaders(contentType, {
        'Content-Range': `bytes ${range.start}-${range.end}/${head.size}`,
        'Content-Length': String(range.end - range.start + 1),
      }),
    })
  }

  const object = await bucket.get(key)
  if (!object) return notFound()
  return new Response(object.body, {
    status: 200,
    headers: buildMediaHeaders(contentType, { 'Content-Length': String(head.size) }),
  })
}
