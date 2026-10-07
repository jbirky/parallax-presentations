// The decks the server builds carry the data their slides read: a graph's
// data lines' columns, and the datasets HTML, p5 and plugin elements name,
// from the version a deck holds or the current one. In the self-hosted
// version, so it needs no database. .env isn't read.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
const fs = require('fs')
const crypto = require('crypto')

const serverDir = path.join(__dirname, '..')
let base, server

function startServer() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parallax-test-'))
  for (const key of ['PARALLAX_MODE', 'PARALLAX_DB', 'DATABASE_URL', 'PARALLAX_STORAGE']) delete process.env[key]
  Object.assign(process.env, {
    NODE_ENV: 'test', SLIDES_DATA_DIR: path.join(tmp, 'data'), SLIDES_UPLOADS_DIR: path.join(tmp, 'uploads'),
  })
  const dotenv = require.resolve('dotenv', { paths: [serverDir] })
  require.cache[dotenv] = { id: dotenv, filename: dotenv, loaded: true, exports: { config: () => ({ parsed: {} }) }, children: [], paths: [] }
  const { app } = require('../index.js')
  return new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
}

async function call(method, url, body, headers) {
  const json = body !== undefined && !Buffer.isBuffer(body)
  const res = await fetch(base + url, {
    method,
    headers: headers || (json ? { 'Content-Type': 'application/json' } : {}),
    body: json ? JSON.stringify(body) : body,
  })
  const text = await res.text()
  let parsed = null
  try { parsed = JSON.parse(text) } catch {}
  return { status: res.status, body: parsed, text }
}

function upload(name, csv) {
  const boundary = `----parallax${crypto.randomBytes(8).toString('hex')}`
  const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\n${name}\r\n`
    + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}.csv"\r\nContent-Type: text/csv\r\n\r\n`
    + `${csv}\r\n--${boundary}--\r\n`)
  return call('POST', '/api/datasets', body, { 'Content-Type': `multipart/form-data; boundary=${boundary}` })
}

// The data a deck's page carries for its elements (#pp-datasets)
function carried(html) {
  const m = html.match(/<script type="application\/json" id="pp-datasets">([\s\S]*?)<\/script>/)
  return m ? JSON.parse(m[1]) : null
}

const at = { x: 10, y: 10, width: 300, height: 200, zIndex: 1 }

describe('the data in the decks the server builds', () => {
  let id, dataset

  before(async () => {
    server = await startServer()
    base = `http://127.0.0.1:${server.address().port}`
    id = (await call('POST', '/api/presentations', { title: 'Planets' })).body.id
    const res = await upload('planets', 'name,period,mass,radius\r\nb,1.5,3.25,1\r\nc,20,400,11')
    assert.equal(res.status, 201, res.text)
    dataset = res.body
    assert.equal((await call('POST', `/api/presentations/${id}/datasets`, { datasetId: dataset.id })).status, 200)
    const slides = [{
      id: 's1',
      elements: [
        { id: 'g1', type: 'graph', ...at, expressions: [{ id: 'd1', data: { dataset: 'planets', x: 'period', y: 'mass', label: 'name' } }] },
        { id: 'h1', type: 'html', ...at, content: '<script>parallax.datasets.query("planets").then(r => document.body.textContent = r.totalRows)</script>' },
      ],
    }]
    assert.equal((await call('PUT', `/api/presentations/${id}`, { slides })).status, 200)
  })
  after(() => server?.close())

  it('writes a graph’s plotted columns into its page, and the datasets elements name into the deck', async () => {
    const page = await call('GET', `/api/presentations/${id}/present`)
    assert.equal(page.status, 200)
    // In the graph's srcdoc, escaped: only the columns it plots
    assert.ok(page.text.includes('&quot;d1&quot;:{&quot;total&quot;:2,'), 'the graph’s rows')
    assert.ok(page.text.includes('&quot;x&quot;:[1.5,20],&quot;y&quot;:[3.25,400],&quot;label&quot;:[&quot;b&quot;,&quot;c&quot;]'))
    const data = carried(page.text)
    assert.deepEqual(data.list.map(d => d.name), ['planets'])
    assert.deepEqual(data.data.planets, { columns: { name: ['b', 'c'], period: [1.5, 20], mass: [3.25, 400], radius: [1, 11] }, totalRows: 2 })
    assert.ok(page.text.includes('window.parallax=window.parallax||Object.freeze({datasets:'))
  })

  it('does so in an exported file (share links: deck-data-cloud.test.js)', async () => {
    const file = await call('GET', `/api/presentations/${id}/export`)
    assert.equal(file.status, 200)
    assert.ok(file.text.includes('&quot;x&quot;:[1.5,20]'))
    assert.equal(carried(file.text).data.planets.columns.mass[1], 400)
  })

  it('reads the version the deck holds', async () => {
    const versions = (await call('GET', `/api/datasets/${dataset.id}/versions`)).body
    assert.equal(versions.length, 1)
    assert.equal((await call('PUT', `/api/presentations/${id}/datasets/${dataset.id}/pin`, { versionId: versions[0].id })).status, 200)
    const page = await call('GET', `/api/presentations/${id}/present`)
    assert.ok(page.text.includes('&quot;x&quot;:[1.5,20]'))
    assert.equal(carried(page.text).data.planets.totalRows, 2)
  })

  it('says on the slide why a graph has no rows, and leaves a deck without datasets as it was', async () => {
    const other = (await call('POST', '/api/presentations', { title: 'No data' })).body.id
    const slides = [{
      id: 's1',
      elements: [
        { id: 'g2', type: 'graph', ...at, expressions: [{ id: 'd2', data: { dataset: 'planets', x: 'period', y: 'mass' } }] },
        { id: 'h2', type: 'html', ...at, content: '<p>"planets"</p>' },
      ],
    }]
    await call('PUT', `/api/presentations/${other}`, { slides })
    const page = await call('GET', `/api/presentations/${other}/present`)
    assert.ok(page.text.includes('No dataset “planets” is linked to this deck'))
    assert.equal(carried(page.text), null)
    assert.ok(!page.text.includes('Object.freeze({datasets:'))
  })
})
