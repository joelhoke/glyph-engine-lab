#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { DatabaseSync } = require('node:sqlite')
const root = path.resolve(__dirname, '..')
const output = path.join(root, 'tmp-verify-request-protection')
fs.mkdirSync(output, { recursive: true })
execFileSync('npx', ['tsc', 'functions/types.d.ts', 'functions/lib/requestProtection.ts', '--outDir', output, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck'], { cwd: root, stdio: 'inherit' })
const { protectMutation } = require(path.join(output, 'requestProtection.js'))
const sqlite = new DatabaseSync(':memory:')
sqlite.exec(fs.readFileSync(path.join(root, 'migrations/0005_request_limits.sql'), 'utf8'))
const db = { prepare(sql) { return { bind(...args) { return {
  async first() { return sqlite.prepare(sql).get(...args) || null },
  async run() { return sqlite.prepare(sql).run(...args) },
} } } } }
let downstream = 0
const waits = []
const env = { CREATIONS_DB: db, PROTOTYPES_AUTH_SECRET: 'test-only-secret' }
async function call({ path = '/api/feedback', method = 'POST', headers = {}, body = '{}', time = 1800000000, bindings = env, local = false } = {}) {
  const request = new Request(`${local ? 'http://localhost:8788' : 'https://joelhoke.me'}${path}`, {
    method, headers: { 'CF-Connecting-IP': '192.0.2.1', ...headers }, ...(method === 'POST' ? { body } : {}),
  })
  return protectMutation({ request, env: bindings, params: {}, waitUntil(p) { waits.push(p) }, async next(nextRequest) {
    downstream++
    return new Response(nextRequest ? await nextRequest.text() : 'read passed')
  } }, time)
}
;(async () => {
  assert.equal((await call({ headers: { Origin: 'https://evil.example' } })).status, 403)
  assert.equal(downstream, 0)
  const results = await Promise.all(Array.from({ length: 8 }, () => call()))
  assert.equal(results.filter(r => r.status === 200).length, 5, 'concurrent writes must not exceed the atomic allowance')
  const blocked = results.find(r => r.status === 429)
  assert.equal(blocked.headers.get('Retry-After'), '600')
  assert.equal(downstream, 5, 'blocked requests never reach expensive handlers')
  assert.equal((await call({ time: 1800000600 })).status, 200, 'new window restores the allowance')
  assert.equal((await call({ path: '/api/feedback/', time: 1800000600 })).status, 200, 'trailing slash shares the same limit')
  assert.equal((await call({ bindings: {} })).status, 503, 'missing storage fails closed')
  assert.equal((await call({ bindings: { CREATIONS_DB: db } })).status, 503, 'missing production secret fails closed')
  assert.equal((await call({ bindings: { ...env, CREATIONS_DB: { prepare() { throw Error('missing table') } } } })).status, 503)
  assert.equal((await call({ method: 'GET', bindings: {} })).status, 200, 'read routes remain available during storage outages')
  assert.equal((await call({ path: '/api/collaborate', body: 'x'.repeat(16385) })).status, 413, 'actual oversized body is rejected without Content-Length')
  const json = '{"message":"Unicode survives: café 🎨"}'
  const response = await call({ path: '/api/collaborate', body: json })
  assert.equal(await response.text(), json, 'middleware preserves request bytes for the handler')
  assert.equal((await call({ local: true, path: '/api/collaborate', headers: { Origin: 'http://localhost:3000' } })).status, 200, 'local Next proxy works')
  const unlock = await Promise.all(Array.from({ length: 6 }, () => call({ path: '/p/test/_unlock' })))
  assert.equal(unlock.filter(r => r.status === 429).length, 1, 'password attempts are limited')
  await Promise.all(waits)
  const rows = sqlite.prepare('SELECT * FROM request_limits').all()
  assert(rows.every(row => /^[a-f0-9]{64}$/.test(row.key)), 'storage contains HMAC identifiers, not IP addresses')
  assert(rows.every(row => row.expires_at >= 1800000600), 'expired rows are cleaned up')
  console.log('PASS: atomic limits, expiry, request bodies, cross-site rejection, local proxy and fail-closed handling')
  sqlite.close()
})().catch(error => { console.error(error); process.exitCode = 1 })
