// The refresh loop, on a self-hosted server's file storage: it fetches the
// live datasets that are due and some deck uses, and leaves the rest. The
// source is a local server. Needs nothing.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const os = require('os')
const fs = require('fs')
const path = require('path')

process.env.PARALLAX_FETCH_ALLOW_PRIVATE = '1'
process.env.PARALLAX_FETCH_GAP_MS = '0'
const FileStorage = require('../storage/file-storage')
const { createLiveDataset, startRefreshLoop } = require('../services/live-datasets')
const { readDatasetFile } = require('../services/dataset-service')

describe('the refresh loop on file storage', () => {
  let source, base, storage, dir
  let csv = 'star,planets\nTRAPPIST-1,7\n'

  before(async () => {
    source = http.createServer((req, res) => res.end(csv))
    await new Promise(resolve => source.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${source.address().port}`
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-refresh-'))
    storage = new FileStorage(dir)
  })
  after(() => source.close())

  const make = name => createLiveDataset(storage, { userId: null, plan: null },
    { name, sourceKind: 'url', source: { url: `${base}/stars.csv` }, schedule: 'daily' }, { localDir: dir })
  const due = id => storage.updateDatasetSource(id, null, { nextFetchAt: new Date(Date.now() - 60000).toISOString() })

  it('fetches what’s due and used by a deck, keeping a version when it changed', async () => {
    const used = await make('stars')
    const unused = await make('spare')
    assert.equal(used.rowCount, 1)
    await storage.linkDatasetToPresentation('deck-1', used.id, null)
    await due(used.id)
    await due(unused.id)

    csv += 'Kepler-90,8\n'
    const loop = startRefreshLoop(storage, { localDir: dir, intervalMs: 1e9, firstAfterMs: 1e9 })
    await loop.tick()
    loop.stop()

    const after = await storage.getDataset(used.id)
    assert.equal(after.rowCount, 2)
    assert.equal((await storage.listDatasetVersions(used.id)).length, 2)
    assert.equal((await storage.listDatasetFetches(used.id))[0].outcome, 'changed')
    assert.ok(Date.parse(after.nextFetchAt) > Date.now() + 23 * 3600 * 1000)
    const table = await readDatasetFile(after.storageKey, after.format, dir)
    assert.deepEqual(table.columns.star, ['TRAPPIST-1', 'Kepler-90'])

    // Not in any deck: left until someone refreshes it
    assert.equal((await storage.listDatasetVersions(unused.id)).length, 1)
    assert.equal((await storage.listDatasetFetches(unused.id)).length, 1)
  })

  it('records a failure and keeps the version it had', async () => {
    const ds = await make('flaky')
    await storage.linkDatasetToPresentation('deck-1', ds.id, null)
    await due(ds.id)
    const saved = csv
    csv = '<html>Maintenance</html>'
    source.removeAllListeners('request')
    source.on('request', (req, res) => { res.writeHead(503); res.end(csv) })
    const loop = startRefreshLoop(storage, { localDir: dir, intervalMs: 1e9, firstAfterMs: 1e9 })
    await loop.tick()
    loop.stop()
    const after = await storage.getDataset(ds.id)
    assert.equal(after.failures, 1)
    assert.match(after.lastError, /answered 503/)
    assert.equal(after.currentVersionId, ds.currentVersionId)
    csv = saved
  })
})
