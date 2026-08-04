/**
 * collaborate-cleanup — daily scheduled Worker.
 *
 * Deletes expired rows from collaborate_shares in the COLLABORATE_DB D1
 * database. Timestamps are Unix SECONDS; expires_at = created_at + 180 days
 * (see migrations/0002_create_collaborate_shares.sql). Writes also delete
 * expired rows opportunistically (functions/lib/collaborateShare.ts) — this
 * Worker is the authoritative daily sweep.
 *
 * Dependency-free by design: minimal D1/scheduled types are declared inline
 * instead of pulling in @cloudflare/workers-types.
 */

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  run(): Promise<{ meta?: { changes?: number } }>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface Env {
  COLLABORATE_DB: D1Database
}

const DELETE_EXPIRED_SQL = 'DELETE FROM collaborate_shares WHERE expires_at < ?'

export default {
  async scheduled(event: { cron: string }, env: Env): Promise<void> {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const result = await env.COLLABORATE_DB.prepare(DELETE_EXPIRED_SQL).bind(nowSeconds).run()
    console.log(
      `collaborate-cleanup: deleted ${result.meta?.changes ?? 0} expired share(s) ` +
        `(cron "${event.cron}", now ${nowSeconds})`,
    )
  },
}
