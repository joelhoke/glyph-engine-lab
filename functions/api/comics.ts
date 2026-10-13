import { COMICS_KEY, MAX_SNAPSHOT_BYTES, isComicSnapshot } from '../../lib/comics.mjs'

type ComicsEnv = { ABOUT_BUCKET?: R2Bucket }

export const onRequestGet: PagesFunction<ComicsEnv> = async ({ env }) => {
  try {
    const object = await env.ABOUT_BUCKET?.get(COMICS_KEY)
    if (!object || object.size > MAX_SNAPSHOT_BYTES) throw new Error('Snapshot unavailable')
    const snapshot: unknown = await new Response(object.body).json()
    if (!isComicSnapshot(snapshot) || !snapshot.fetchedAt) throw new Error('Snapshot invalid')
    return new Response(JSON.stringify(snapshot), { headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch {
    return new Response(JSON.stringify({ error: 'Pull list temporarily unavailable' }), { status: 503, headers: {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  }
}

export const onRequest: PagesFunction<ComicsEnv> = context => {
  if (context.request.method === 'GET') return onRequestGet(context)
  return new Response(null, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } })
}
