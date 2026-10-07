// In the cloud version, a deck's data comes from its owner's datasets in
// every page the server builds from it: a share link, which no one is signed
// in to, and Present for an editor who isn't the owner. Against a real
// Postgres, as helpers.js describes; skipped without TEST_DATABASE_URL.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
let t, owner, editor

function upload(who, name, csv) {
  const boundary = `----parallax${crypto.randomBytes(8).toString('hex')}`
  const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n`
    + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}.csv"\r\nContent-Type: text/csv\r\n\r\n`
    + `${csv}\r\n--${boundary}--\r\n`)
  return t.call(who, 'POST', '/api/datasets', body, { 'Content-Type': `multipart/form-data; boundary=${boundary}` })
}

async function page(who, url) {
  const res = await fetch(t.base + url, { headers: who ? { 'X-Test-User': who } : {} })
  return { status: res.status, text: await res.text() }
}

function carried(html) {
  const m = html.match(/<script type="application\/json" id="pp-datasets">([\s\S]*?)<\/script>/)
  return m ? JSON.parse(m[1]) : null
}

const at = { x: 10, y: 10, width: 300, height: 200, zIndex: 1 }

describe('the data in the cloud’s deck pages', { skip }, () => {
  let id

  before(async () => {
    t = await startCloudServer()
    owner = t.user('data-owner')
    editor = t.user('data-editor')
    assert.equal((await t.call(owner, 'GET', '/api/me')).status, 200)
    assert.equal((await t.call(editor, 'GET', '/api/me')).status, 200)
    const ds = await upload(owner, 'planets', 'name,period,mass\r\nb,1.5,3.25\r\nc,20,400')
    assert.equal(ds.status, 201, JSON.stringify(ds.body))
    id = await t.createDeck(owner, 'Planets')
    assert.equal((await t.call(owner, 'POST', `/api/presentations/${id}/datasets`, { datasetId: ds.body.id, alias: 'worlds' })).status, 200)
    const deck = (await t.call(owner, 'GET', `/api/presentations/${id}`)).body
    const slides = [{
      id: 's1',
      elements: [
        { id: 'g1', type: 'graph', ...at, expressions: [{ id: 'd1', data: { dataset: 'worlds', x: 'period', y: 'mass' } }] },
        { id: 'p1', type: 'p5', ...at, content: 'parallax.datasets.query("worlds")' },
      ],
    }]
    const saved = await t.call(owner, 'PUT', `/api/presentations/${id}`, { slides, version: deck.version })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
    await t.invite(owner, id, editor)
  })
  after(() => t?.stop())

  it('writes the owner’s data into a share link’s page', async () => {
    const share = await t.call(owner, 'POST', `/api/presentations/${id}/share`)
    assert.equal(share.status, 200, JSON.stringify(share.body))
    const res = await page(null, `/share/${share.body.token}`)
    assert.equal(res.status, 200)
    assert.ok(res.text.includes('&quot;x&quot;:[1.5,20],&quot;y&quot;:[3.25,400]'), 'the graph’s rows')
    const data = carried(res.text)
    assert.deepEqual(data.list.map(d => d.name), ['worlds'])
    assert.deepEqual(data.data.worlds, { columns: { name: ['b', 'c'], period: [1.5, 20], mass: [3.25, 400] }, totalRows: 2 })
  })

  it('and into Present for an editor, who has no datasets of their own', async () => {
    const res = await page(editor, `/api/presentations/${id}/present`)
    assert.equal(res.status, 200)
    assert.ok(res.text.includes('&quot;x&quot;:[1.5,20]'))
    assert.equal(carried(res.text).data.worlds.totalRows, 2)
  })
})
