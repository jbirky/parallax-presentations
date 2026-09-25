// The self-hosted version (no sign-in, presentations as files) still opens,
// saves and uploads to presentations as before, and has no editing with
// others. Needs no database. .env isn't read.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
const fs = require('fs')

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

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, body: json }
}

describe('the self-hosted version', () => {
  before(async () => {
    server = await startServer()
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server?.close())

  it('opens and saves a presentation, with no version check', async () => {
    const created = await call('POST', '/api/presentations', { title: 'Local talk' })
    assert.equal(created.status, 201)
    const { id } = created.body
    const saved = await call('PUT', `/api/presentations/${id}`, { title: 'Renamed' })
    assert.equal(saved.status, 200)
    const opened = await call('GET', `/api/presentations/${id}`)
    assert.equal(opened.body.title, 'Renamed')
    assert.equal(opened.body.version, undefined)
    assert.equal((await call('GET', `/api/presentations/${id}/snapshots`)).status, 200)
    assert.ok((await call('GET', '/api/presentations')).body.some(p => p.id === id))
  })

  it('has no editing with others', async () => {
    const { id } = (await call('POST', '/api/presentations', { title: 'Another' })).body
    for (const [method, url] of [
      ['GET', `/api/presentations/${id}/collaborators`],
      ['POST', `/api/presentations/${id}/invite`],
      ['GET', '/api/invites/5f0c6b9e-4a1d-4c8e-9b7a-2d3e4f5a6b7c'],
      ['POST', '/api/invites/5f0c6b9e-4a1d-4c8e-9b7a-2d3e4f5a6b7c/accept'],
    ]) {
      assert.equal((await call(method, url)).status, 404, `${method} ${url}`)
    }
  })
})
