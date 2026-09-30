// What one account can keep outside its plan's storage: templates, saved
// versions, and a dataset's file once another replaces it. Against a real
// Postgres, as helpers.js describes; skipped without TEST_DATABASE_URL.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
let t, owner

function uploadDataset(who, name, csv) {
  const boundary = `----parallax${crypto.randomBytes(8).toString('hex')}`
  const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n`
    + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}.csv"\r\nContent-Type: text/csv\r\n\r\n`
    + `${csv}\r\n--${boundary}--\r\n`)
  return t.call(who, 'POST', '/api/datasets', body, { 'Content-Type': `multipart/form-data; boundary=${boundary}` })
}

describe('limits outside storage', { skip }, () => {
  before(async () => {
    t = await startCloudServer()
    owner = t.user('owner')
    assert.equal((await t.call(owner, 'GET', '/api/me')).status, 200)
  })
  after(() => t?.stop())

  it('keeps 50 saved versions of a presentation', async () => {
    const deck = await t.createDeck(owner, 'Versions')
    for (let i = 0; i < 50; i++) assert.equal((await t.call(owner, 'POST', `/api/presentations/${deck}/snapshot`, { name: `v${i}` })).status, 200)
    const refused = await t.call(owner, 'POST', `/api/presentations/${deck}/snapshot`, { name: 'one more' })
    assert.equal(refused.status, 403)
    assert.match(refused.body.message, /up to 50 saved versions/)
    // Another presentation has its own
    const other = await t.createDeck(owner, 'Other')
    assert.equal((await t.call(owner, 'POST', `/api/presentations/${other}/snapshot`, { name: 'v0' })).status, 200)
  })

  it('keeps 20 templates', async () => {
    for (let i = 0; i < 20; i++) assert.equal((await t.call(owner, 'POST', '/api/templates', { title: `T${i}`, slides: [] })).status, 201)
    const refused = await t.call(owner, 'POST', '/api/templates', { title: 'One more', slides: [] })
    assert.equal(refused.status, 403)
    const deck = await t.createDeck(owner, 'As a template')
    assert.equal((await t.call(owner, 'POST', `/api/presentations/${deck}/save-as-template`, { title: 'Too' })).status, 403)
  })

  it('deletes a dataset’s file when an upload under its name replaces it', async () => {
    const first = (await uploadDataset(owner, 'planets', 'name,moons\r\nMars,2')).body
    const { rows: [{ storage_key: firstKey }] } = await t.pool.query('SELECT storage_key FROM datasets WHERE id = $1', [first.id])
    const fileOf = key => path.join(process.env.SLIDES_DATA_DIR, 'datasets', key.replace('local:', ''))
    assert.ok(fs.existsSync(fileOf(firstKey)))

    const second = (await uploadDataset(owner, 'planets', 'name,moons\r\nMars,2\r\nEarth,1')).body
    assert.equal(second.id, first.id)
    const { rows: [{ storage_key: secondKey }] } = await t.pool.query('SELECT storage_key FROM datasets WHERE id = $1', [first.id])
    assert.notEqual(secondKey, firstKey)
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.ok(!fs.existsSync(fileOf(firstKey)), 'the replaced file is gone')
    assert.ok(fs.existsSync(fileOf(secondKey)))
  })
})
