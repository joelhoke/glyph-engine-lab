/**
 * `GET /api/creations/:id` — the stored memento state for one listed creation.
 * Missing, unlisted, and malformed IDs all return the same plain 404 so
 * held-for-review rows are indistinguishable from nonexistent ones.
 */

import { buildCreationHeaders, CREATION_STATE_SQL, isValidCreationId } from '../../lib/creations'

type CreationsEnv = {
  CREATIONS_DB?: D1Database
}

function notFound(): Response {
  return new Response('not found', {
    status: 404,
    headers: buildCreationHeaders({ 'content-type': 'text/plain; charset=utf-8' }),
  })
}

export const onRequestGet: PagesFunction<CreationsEnv, 'id'> = async (context) => {
  let id = context.params.id
  try {
    id = decodeURIComponent(id)
  } catch {
    return notFound()
  }
  if (!isValidCreationId(id)) return notFound()

  const db = context.env.CREATIONS_DB
  if (!db)
    return new Response(JSON.stringify({ ok: false, error: 'Creations are unavailable.' }), {
      status: 503,
      headers: buildCreationHeaders({ 'content-type': 'application/json; charset=utf-8' }),
    })

  let row: { state: string } | null
  try {
    row = await db.prepare(CREATION_STATE_SQL).bind(id).first<{ state: string }>()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Creations are unavailable.' }), {
      status: 503,
      headers: buildCreationHeaders({ 'content-type': 'application/json; charset=utf-8' }),
    })
  }
  if (!row || typeof row.state !== 'string') return notFound()

  return new Response(row.state, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  })
}
