/** Daily retention sweep for consented transcripts and feedback. */
export default {
  async scheduled(event: { cron: string }, env: RetentionEnv): Promise<void> {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const results = await Promise.allSettled([
      env.COLLABORATE_DB.prepare('DELETE FROM collaborate_shares WHERE expires_at < ?')
        .bind(nowSeconds).run(),
      env.FEEDBACK_DB.prepare('DELETE FROM feedback WHERE expires_at < ?')
        .bind(nowSeconds).run(),
    ])
    const tables = ['collaborate_shares', 'feedback']
    results.forEach((result, index) => {
      console.log(JSON.stringify({
        event: 'retention-sweep', table: tables[index], cron: event.cron,
        success: result.status === 'fulfilled',
        deleted: result.status === 'fulfilled' ? result.value.meta.changes : null,
      }))
    })
    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('Retention sweep failed; inspect database bindings and schema')
    }
  },
}
