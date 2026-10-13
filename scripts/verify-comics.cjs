const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const ts = require('typescript')

async function main() {
  const { upcomingWednesday, isComicSnapshot, normalizeComics, comicCoverUrl } = await import('../lib/comics.mjs')
  const { refresh } = await import('./comics/refresh.mjs')
  for (const [instant, expected] of [
    ['2026-09-30T06:59:59Z', '2026-09-30'], // Tuesday Seattle
    ['2026-10-01T06:59:59Z', '2026-09-30'], // Wednesday Seattle
    ['2026-10-01T07:00:00Z', '2026-10-07'], // Thursday Seattle
    ['2026-12-31T08:00:00Z', '2027-01-06'],
    ['2026-03-08T10:00:00Z', '2026-03-11'], // DST begins
    ['2026-11-01T09:00:00Z', '2026-11-04'], // DST ends
  ]) assert.equal(upcomingWednesday(new Date(instant)), expected)
  const fallback = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/comics-fallback.json')))
  assert.ok(isComicSnapshot(fallback))
  assert.equal(fallback.fetchedAt, null)
  const sample = fallback.comics[0]
  assert.equal(normalizeComics([sample, sample]).length, 1)
  assert.equal(comicCoverUrl(null), null)
  assert.equal(comicCoverUrl('https://evil.test/image'), null)
  const cover = comicCoverUrl(sample.cover)
  assert.equal(new URL(cover).searchParams.get('jh-cover'), '1')
  assert.equal(comicCoverUrl(cover), cover, 'Stable cover URLs share cache entries across consumers')
  for (const invalid of [null, {}, [{ ...sample, name: '' }], [{ ...sample, url: 'javascript:alert(1)' }], [{ ...sample, cover: 'https://evil.test/image' }]]) assert.throws(() => normalizeComics(invalid))
  assert.equal(isComicSnapshot({ ...fallback, releaseDate: '2026-02-31' }), false)
  let published = 'previous snapshot'
  let calls = 0
  const wait = async () => {}
  await assert.rejects(refresh({ fetchComics: async () => { calls++; throw new Error('upstream down') }, publish: async body => { published = body }, wait }))
  assert.equal(calls, 3)
  assert.equal(published, 'previous snapshot')
  await assert.rejects(refresh({ fetchComics: async () => [{}], publish: async body => { published = body }, wait }))
  assert.equal(published, 'previous snapshot')
  calls = 0
  const snapshot = await refresh({ fetchComics: async () => { if (++calls === 1) throw new Error('transient'); return [] }, publish: async body => { published = body }, now: new Date('2026-09-30T20:00:00Z'), wait })
  assert.equal(calls, 2)
  assert.deepEqual(JSON.parse(published).comics, [])
  let uploads = 0
  await assert.rejects(refresh({ fetchComics: async () => [sample], publish: async () => { uploads++; throw new Error('storage unavailable') }, wait }))
  assert.equal(uploads, 3)

  // Transpile the actual Pages handler and import without filesystem fixtures.
  const source = fs.readFileSync(path.join(__dirname, '../functions/api/comics.ts'), 'utf8').replace('../../lib/comics.mjs', pathToFileURL(path.join(__dirname, '../lib/comics.mjs')).href)
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const { onRequest } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  const request = new Request('https://example.test/api/comics')
  const object = value => ({ size: Buffer.byteLength(JSON.stringify(value)), body: new Response(JSON.stringify(value)).body })
  for (const comics of [[], [sample]]) {
    const value = { ...snapshot, comics }
    const response = await onRequest({ request, env: { ABOUT_BUCKET: { get: async () => object(value) } } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=300')
    assert.deepEqual(await response.json(), value)
  }
  for (const env of [{}, { ABOUT_BUCKET: { get: async () => null } }, { ABOUT_BUCKET: { get: async () => { throw new Error('storage') } } }, { ABOUT_BUCKET: { get: async () => object(fallback) } }, { ABOUT_BUCKET: { get: async () => ({ size: 999999 }) } }, { ABOUT_BUCKET: { get: async () => object({}) } }]) {
    const response = await onRequest({ request, env })
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
  }
  assert.equal((await onRequest({ request: new Request(request.url, { method: 'POST' }), env: {} })).status, 405)
  console.log('Comic checks passed: dates, validation, retries, atomic publication, empty lists, and API failure states.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
