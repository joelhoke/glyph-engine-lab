#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { DatabaseSync } = require('node:sqlite')
const source = fs.readFileSync('workers/collaborate-cleanup/src/index.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('exports', 'module', compiled)(loaded.exports, loaded)
const worker = loaded.exports.default
const now = Math.floor(Date.now() / 1000)
const dbs = ['collaborate_shares', 'feedback'].map(table => {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ${table} (id TEXT, expires_at INTEGER)`)
  const insert = db.prepare(`INSERT INTO ${table} VALUES (?, ?)`)
  insert.run('expired', now - 100)
  insert.run('current', now + 86400)
  return db
})
const binding = db => ({ prepare(sql) { return { bind(...args) { return {
  async run() { return { meta: db.prepare(sql).run(...args) } },
} } } } })
;(async () => {
  await worker.scheduled({ cron: '17 4 * * *' }, {
    COLLABORATE_DB: binding(dbs[0]), FEEDBACK_DB: binding(dbs[1]),
  })
  for (const [index, table] of ['collaborate_shares', 'feedback'].entries()) {
    assert.deepEqual(dbs[index].prepare(`SELECT id FROM ${table}`).all().map(row => row.id), ['current'])
  }
  dbs[1].prepare('INSERT INTO feedback VALUES (?, ?)').run('expired-again', now - 100)
  await assert.rejects(worker.scheduled({ cron: '17 4 * * *' }, {
    COLLABORATE_DB: { prepare() { return { bind() { return { run: async () => { throw Error('offline') } } } } } },
    FEEDBACK_DB: binding(dbs[1]),
  }), /Retention sweep failed/)
  assert.equal(dbs[1].prepare('SELECT COUNT(*) AS n FROM feedback').get().n, 1, 'feedback sweep completes even if chat storage fails')
  dbs.forEach(db => db.close())
  console.log('PASS: retention removes expired rows, preserves current rows, and isolates database failures')
})().catch(error => { console.error(error); process.exitCode = 1 })
