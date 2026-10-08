// Live datasets through the API: made from a source's first fetch, refreshed
// into new versions only when the data changes, kept when a fetch fails,
// pinned for a deck, and their header secret never sent back. The source is
// a local server, which PARALLAX_FETCH_ALLOW_PRIVATE lets the server reach.
// Against a real Postgres, as helpers.js describes; skipped without
// TEST_DATABASE_URL.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const crypto = require('crypto')
const { DB, DB_UNVERIFIED, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
let t, owner, other, source, base, ds
const seen = []  // requests the source got

// What the source serves; tests change it
const served = { csv: 'name,mass\nb,2\na,1\n', etag: null, status: 200 }
const ARCHIVE_ERROR = '<?xml version="1.0"?><VOTABLE><RESOURCE><INFO name="QUERY_STATUS" value="ERROR">ORA-00904: \'NOSUCHCOL\': invalid identifier</INFO></RESOURCE></VOTABLE>'

function uploadDataset(who, name, csv) {
  const boundary = `----parallax${crypto.randomBytes(8).toString('hex')}`
  const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n`
    + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}.csv"\r\nContent-Type: text/csv\r\n\r\n`
    + `${csv}\r\n--${boundary}--\r\n`)
  return t.call(who, 'POST', '/api/datasets', body, { 'Content-Type': `multipart/form-data; boundary=${boundary}` })
}

// Lets a refresh run again at once: refreshing by hand waits a minute
const forgetLastFetch = id => t.pool.query("UPDATE dataset_fetches SET started_at = started_at - interval '2 minutes' WHERE dataset_id = $1", [id])
async function refresh(who, id) {
  await forgetLastFetch(id)
  return t.call(who, 'POST', `/api/datasets/${id}/refresh`)
}
const versionsOf = async id => (await t.call(owner, 'GET', `/api/datasets/${id}/versions`)).body

describe('live datasets', { skip }, () => {
  before(async () => {
    source = http.createServer((req, res) => {
      seen.push({ url: req.url, headers: req.headers })
      if (req.url.startsWith('/tap/sync')) {
        const q = new URL(req.url, 'http://x').searchParams.get('QUERY')
        if (/nosuchcol/.test(q)) { res.writeHead(400, { 'Content-Type': 'application/xml' }); return res.end(ARCHIVE_ERROR) }
        return res.end('pl_name,pl_orbper\nb,4.2\n')
      }
      if (req.url === '/fail') { res.writeHead(500); return res.end('Internal Server Error') }
      if (req.url === '/planets.csv') {
        if (served.etag && req.headers['if-none-match'] === served.etag) { res.writeHead(304); return res.end() }
        res.writeHead(served.status, { 'Content-Type': 'text/csv', ...(served.etag && { ETag: served.etag }) })
        return res.end(served.csv)
      }
      res.writeHead(404); res.end()
    })
    await new Promise(resolve => source.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${source.address().port}`
    Object.assign(process.env, {
      PARALLAX_LIVE_DATASETS: 'on', PARALLAX_FETCH_ALLOW_PRIVATE: '1', PARALLAX_FETCH_GAP_MS: '0',
      PARALLAX_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    })
    t = await startCloudServer()
    owner = t.user('live')
    other = t.user('other')
    for (const who of [owner, other]) assert.equal((await t.call(who, 'GET', '/api/me')).status, 200)
  })
  after(() => { t?.stop(); source?.close() })

  it('offers live datasets within the plan’s allowance', async () => {
    const res = await t.call(owner, 'GET', '/api/datasets/sources')
    assert.equal(res.body.enabled, true)
    assert.deepEqual(res.body.schedules, ['daily', 'weekly', 'manual'])
    assert.deepEqual(res.body.allowance, { used: 0, limit: 1, plan: 'Free' })
    assert.ok(res.body.presets.some(p => p.url === 'https://exoplanetarchive.ipac.caltech.edu/TAP'))
  })

  it('tests a source without saving anything', async () => {
    const res = await t.call(owner, 'POST', '/api/datasets/sources/test', { sourceKind: 'url', source: { url: `${base}/planets.csv` } })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.rowCount, 2)
    assert.deepEqual(res.body.rows, [{ name: 'b', mass: 2 }, { name: 'a', mass: 1 }])
    assert.deepEqual(res.body.columns.map(c => c.name), ['name', 'mass'])
    assert.equal((await t.call(owner, 'GET', '/api/datasets')).body.length, 0)
  })

  it('says why a TAP query failed, in the service’s words', async () => {
    const res = await t.call(owner, 'POST', '/api/datasets/sources/test',
      { sourceKind: 'tap', source: { service: `${base}/tap`, query: 'select nosuchcol from ps' } })
    assert.equal(res.status, 422)
    assert.match(res.body.error, /refused the query: ORA-00904: 'NOSUCHCOL': invalid identifier/)
    const ok = await t.call(owner, 'POST', '/api/datasets/sources/test',
      { sourceKind: 'tap', source: { service: `${base}/tap`, query: 'select pl_name, pl_orbper from ps' } })
    assert.deepEqual(ok.body.rows, [{ pl_name: 'b', pl_orbper: 4.2 }])
  })

  it('makes a live dataset from its first fetch, in key order', async () => {
    const hourly = await t.call(owner, 'POST', '/api/datasets/live',
      { name: 'Planets', sourceKind: 'url', source: { url: `${base}/planets.csv`, keyColumn: 'name' }, schedule: 'hourly' })
    assert.equal(hourly.status, 422)
    assert.match(hourly.body.error, /Free plan refreshes at most daily/)

    const res = await t.call(owner, 'POST', '/api/datasets/live',
      { name: 'Planets', sourceKind: 'url', source: { url: `${base}/planets.csv`, keyColumn: 'name' }, schedule: 'daily' })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    ds = res.body
    assert.equal(ds.name, 'planets')
    assert.equal(ds.sourceKind, 'url')
    assert.equal(ds.schedule, 'daily')
    assert.equal(ds.filename, 'planets.csv')
    assert.ok(Date.parse(ds.nextFetchAt) > Date.now() + 23 * 3600 * 1000)
    const data = await t.call(owner, 'GET', `/api/datasets/${ds.id}/data`)
    assert.deepEqual(data.body.columns, { name: ['a', 'b'], mass: [1, 2] })
    const fetches = (await t.call(owner, 'GET', `/api/datasets/${ds.id}/fetches`)).body
    assert.deepEqual(fetches.map(f => f.outcome), ['changed'])
  })

  it('keeps to the plan’s number of live datasets, and won’t take an upload over one', async () => {
    const res = await t.call(owner, 'POST', '/api/datasets/live', { name: 'more', sourceKind: 'url', source: { url: `${base}/planets.csv` } })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'live_limit')
    const upload = await uploadDataset(owner, 'planets', 'name\r\nx')
    assert.equal(upload.status, 409)
    assert.match(upload.body.error, /live dataset/)
  })

  it('keeps the current version while the data is unchanged, and adds one when it changes', async () => {
    // Same data, rows in another order: the key column makes it the same
    served.csv = 'name,mass\na,1\nb,2\n'
    let res = await refresh(owner, ds.id)
    assert.equal(res.body.outcome, 'unchanged', JSON.stringify(res.body))
    assert.equal((await versionsOf(ds.id)).length, 1)

    // A 304 for the version's ETag
    served.etag = '"v1"'
    served.csv = 'name,mass\na,1\nb,2\nc,3\n'
    res = await refresh(owner, ds.id)
    assert.equal(res.body.outcome, 'changed')
    res = await refresh(owner, ds.id)
    assert.equal(res.body.outcome, 'unchanged')
    assert.equal(seen.at(-1).headers['if-none-match'], '"v1"')
    served.etag = null

    const versions = await versionsOf(ds.id)
    assert.equal(versions.length, 2)
    assert.equal(versions[0].current, true)
    assert.equal(versions[0].rowCount, 3)
    assert.equal(res.body.dataset.rowCount, 3)
    assert.equal(seen.at(-1).headers['user-agent'].startsWith('Parallax/'), true)
  })

  it('refreshes by hand at most once a minute', async () => {
    await forgetLastFetch(ds.id)
    assert.equal((await t.call(owner, 'POST', `/api/datasets/${ds.id}/refresh`)).status, 200)
    const again = await t.call(owner, 'POST', `/api/datasets/${ds.id}/refresh`)
    assert.equal(again.status, 429)
  })

  it('keeps the last good version when a fetch fails, and tries again later', async () => {
    served.status = 503
    const res = await refresh(owner, ds.id)
    assert.equal(res.body.outcome, 'failed')
    assert.match(res.body.error, /answered 503/)
    const after = res.body.dataset
    assert.equal(after.failures, 1)
    assert.match(after.lastError, /answered 503/)
    const wait = Date.parse(after.nextFetchAt) - Date.now()
    assert.ok(wait > 14 * 60 * 1000 && wait < 16 * 60 * 1000, `retries in ${wait} ms`)
    const data = await t.call(owner, 'GET', `/api/datasets/${ds.id}/data`)
    assert.equal(data.body.totalRows, 3)
    served.status = 200
    const fixed = await refresh(owner, ds.id)
    assert.equal(fixed.body.dataset.failures, 0)
    assert.equal(fixed.body.dataset.lastError, null)
  })

  it('pins a version for one deck, and never prunes a pinned version', async () => {
    const deck = await t.createDeck(owner, 'Exoplanets')
    assert.equal((await t.call(owner, 'POST', `/api/presentations/${deck}/datasets`, { datasetId: ds.id })).status, 200)
    const [newest, oldest] = await versionsOf(ds.id)
    const pin = await t.call(owner, 'PUT', `/api/presentations/${deck}/datasets/${ds.id}/pin`, { versionId: oldest.id })
    assert.equal(pin.status, 200)
    const deckData = async q => (await t.call(owner, 'GET', `/api/presentations/${deck}/datasets/${ds.id}/data${q || ''}`)).body.totalRows
    assert.equal(await deckData(), 2)
    assert.equal(await deckData('?version=current'), 3)
    assert.equal((await t.call(owner, 'GET', `/api/datasets/${ds.id}/data`)).body.totalRows, 3)
    const listed = (await t.call(owner, 'GET', `/api/presentations/${deck}/datasets`)).body
    assert.equal(listed[0].pinnedVersionId, oldest.id)

    // Six more changes: the newest 5 stay, and the pinned one
    for (let i = 0; i < 6; i++) {
      served.csv += `x${i},${i}\n`
      assert.equal((await refresh(owner, ds.id)).body.outcome, 'changed')
    }
    const versions = await versionsOf(ds.id)
    assert.equal(versions.length, 6)
    assert.ok(versions.some(v => v.id === oldest.id && v.pinnedBy.includes(deck)))
    assert.ok(!versions.some(v => v.id === newest.id), 'an unpinned old version is gone')
    assert.equal(await deckData(), 2)

    assert.equal((await t.call(owner, 'PUT', `/api/presentations/${deck}/datasets/${ds.id}/pin`, { versionId: null })).status, 200)
    assert.equal(await deckData(), 9)
    const bad = await t.call(owner, 'PUT', `/api/presentations/${deck}/datasets/${ds.id}/pin`, { versionId: crypto.randomUUID() })
    assert.equal(bad.status, 404)
  })

  it('sends a header secret to the source, and never back to the browser', async () => {
    const res = await t.call(owner, 'PATCH', `/api/datasets/${ds.id}/source`, { secret: 'X-Api-Key: s3cret-value' })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.dataset.hasSecret, true)
    assert.equal(seen.at(-1).headers['x-api-key'], 's3cret-value')
    for (const url of ['/api/datasets', `/api/datasets/${ds.id}`, `/api/datasets/${ds.id}/versions`, `/api/datasets/${ds.id}/fetches`]) {
      assert.ok(!JSON.stringify((await t.call(owner, 'GET', url)).body).includes('s3cret'), url)
    }
    const { rows } = await t.pool.query('SELECT source_secret FROM datasets WHERE id = $1', [ds.id])
    assert.match(rows[0].source_secret, /^enc:/)
    assert.ok(!rows[0].source_secret.includes('s3cret'))
    assert.equal((await t.call(owner, 'PATCH', `/api/datasets/${ds.id}/source`, { secret: '' })).body.dataset.hasSecret, false)
    assert.equal((await t.call(owner, 'PATCH', `/api/datasets/${ds.id}/source`, { secret: 'no colon' })).status, 422)
  })

  it('keeps one owner’s live dataset from everyone else', async () => {
    for (const [method, url] of [['GET', `/api/datasets/${ds.id}/versions`], ['GET', `/api/datasets/${ds.id}/fetches`],
      ['POST', `/api/datasets/${ds.id}/refresh`], ['PATCH', `/api/datasets/${ds.id}/source`]]) {
      assert.equal((await t.call(other, method, url, method === 'PATCH' ? { schedule: 'weekly' } : undefined)).status, 404, `${method} ${url}`)
    }
  })

  it('lets two servers on one database claim a due dataset only once', async () => {
    const PgStorage = require('../storage/pg-storage')
    const a = new PgStorage(DB_UNVERIFIED), b = new PgStorage(DB_UNVERIFIED)
    try {
      await t.pool.query("UPDATE datasets SET next_fetch_at = NOW() - interval '1 minute', fetch_lease_until = NULL WHERE id = $1", [ds.id])
      const [x, y] = await Promise.all([a.claimDueDatasets(10, 60), b.claimDueDatasets(10, 60)])
      assert.equal([...x, ...y].filter(id => id === ds.id).length, 1)
      assert.deepEqual(await a.claimDueDatasets(10, 60), [])
    } finally {
      await t.pool.query('UPDATE datasets SET fetch_lease_until = NULL WHERE id = $1', [ds.id])
      await a.pool.end(); await b.pool.end()
    }
  })

  it('deletes a live dataset with all its versions', async () => {
    assert.equal((await t.call(owner, 'DELETE', `/api/datasets/${ds.id}`)).status, 200)
    const { rows } = await t.pool.query('SELECT 1 FROM dataset_versions WHERE dataset_id = $1', [ds.id])
    assert.equal(rows.length, 0)
  })
})
