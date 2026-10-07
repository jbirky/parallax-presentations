// Datasets' versions: an upload is its dataset's version 1, a replacement
// leaves one version, and storage counts every version kept. Against a real
// Postgres, as helpers.js describes; skipped without TEST_DATABASE_URL.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
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

describe('dataset versions', { skip }, () => {
  before(async () => {
    t = await startCloudServer()
    owner = t.user('versions')
    assert.equal((await t.call(owner, 'GET', '/api/me')).status, 200)
  })
  after(() => t?.stop())

  it('stores an upload as its dataset’s version 1, column by column', async () => {
    const res = await uploadDataset(owner, 'moons', 'planet,moons\r\nMars,2\r\nEarth,1')
    assert.equal(res.status, 201, JSON.stringify(res.body))
    const ds = res.body
    assert.equal(ds.format, 'columns')
    assert.equal(ds.sourceKind, 'upload')
    assert.equal(ds.rowCount, 2)
    const { rows } = await t.pool.query('SELECT id, storage_key, byte_size FROM dataset_versions WHERE dataset_id = $1', [ds.id])
    assert.equal(rows.length, 1)
    assert.equal(ds.currentVersionId, rows[0].id)
    assert.equal(ds.storageKey, rows[0].storage_key)
    const data = await t.call(owner, 'GET', `/api/datasets/${ds.id}/data?orderBy=moons`)
    assert.deepEqual(data.body, { columns: { planet: ['Earth', 'Mars'], moons: [1, 2] }, totalRows: 2 })
  })

  it('keeps one version when an upload replaces another, and counts it in storage', async () => {
    const first = (await uploadDataset(owner, 'rings', 'planet,rings\r\nSaturn,7')).body
    const second = (await uploadDataset(owner, 'rings', 'planet,rings\r\nSaturn,7\r\nUranus,13')).body
    assert.equal(second.id, first.id)
    const { rows } = await t.pool.query('SELECT id, byte_size FROM dataset_versions WHERE dataset_id = $1', [first.id])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, second.currentVersionId)
    assert.equal(second.rowCount, 2)
    const { storageUsedBytes } = require('../middleware/upload-quota')
    const { rows: all } = await t.pool.query(
      'SELECT COALESCE(SUM(v.byte_size), 0)::bigint AS n FROM dataset_versions v JOIN datasets d ON d.id = v.dataset_id WHERE d.user_id = $1',
      [await t.userId(owner)])
    assert.equal(await storageUsedBytes({ query: (...a) => t.pool.query(...a) }, await t.userId(owner)), Number(all[0].n))
  })

  it('deletes every version’s row with the dataset', async () => {
    const ds = (await uploadDataset(owner, 'gone', 'a\r\n1')).body
    assert.equal((await t.call(owner, 'DELETE', `/api/datasets/${ds.id}`)).status, 200)
    const { rows } = await t.pool.query('SELECT 1 FROM dataset_versions WHERE dataset_id = $1', [ds.id])
    assert.equal(rows.length, 0)
  })
})
