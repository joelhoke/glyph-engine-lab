import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { COMICS_KEY, COMICS_USERNAME, MAX_SNAPSHOT_BYTES, upcomingWednesday, normalizeComics, isComicSnapshot } from '../../lib/comics.mjs'

const exec = promisify(execFile)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export async function withRetry(task, { attempts = 3, wait = sleep } = {}) {
  for (let attempt = 1; ; attempt++) {
    try { return await task() } catch (error) {
      if (attempt >= attempts) throw error
      await wait(attempt * 2000)
    }
  }
}

// Upload is deliberately last: fetch/validation failures never replace good data.
export async function refresh({ fetchComics, publish, now = new Date(), wait = sleep }) {
  const releaseDate = upcomingWednesday(now)
  const comics = await withRetry(async () => normalizeComics(await fetchComics(releaseDate)), { wait })
  const snapshot = { username: COMICS_USERNAME, releaseDate, fetchedAt: now.toISOString(), comics }
  const body = JSON.stringify(snapshot)
  if (!isComicSnapshot(snapshot) || Buffer.byteLength(body) > MAX_SNAPSHOT_BYTES) throw new Error('Invalid snapshot')
  await withRetry(() => publish(body), { wait })
  return snapshot
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const outputIndex = process.argv.indexOf('--output')
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null
  if (outputIndex >= 0 && (!output || output.startsWith('--'))) throw new Error('--output requires a file path')
  let publish = async body => { if (output) await writeFile(output, body + '\n') }
  if (!dryRun) {
    for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) if (!process.env[key]) throw new Error(`Missing ${key}`)
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
      region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, maxAttempts: 1,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    })
    publish = body => client.send(new PutObjectCommand({
      Bucket: 'jh-about', Key: COMICS_KEY, Body: body, ContentType: 'application/json', CacheControl: 'public, max-age=300',
    }), { abortSignal: AbortSignal.timeout(30000) })
  }
  const snapshot = await refresh({
    fetchComics: async date => {
      const { stdout } = await exec(process.execPath, [fileURLToPath(new URL('./fetch.mjs', import.meta.url)), date], { timeout: 45000, maxBuffer: MAX_SNAPSHOT_BYTES, killSignal: 'SIGKILL' })
      return JSON.parse(stdout)
    }, publish,
  })
  console.log(`${dryRun ? 'Checked' : 'Published'} ${snapshot.comics.length} comics for ${snapshot.releaseDate}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => { console.error('Comic refresh failed:', error.message); process.exitCode = 1 })
}
