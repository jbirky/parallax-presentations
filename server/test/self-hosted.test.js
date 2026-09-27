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

  it('makes a presentation from a template under new ids, with its links and show/hide following them', async () => {
    const template = (await call('POST', '/api/templates', { title: 'Menu', slides: [
      { id: 'menu', elements: [
        { id: 'go', type: 'text', content: '<p><a href="#/s-end">End</a></p>', clickAction: { type: 'slide', slideId: 'end' } },
        { id: 'tab', type: 'shape', clickAction: { type: 'visibility', show: ['panel'] } },
        { id: 'panel', type: 'text', content: '<p>Hi</p>', startHidden: true },
      ] },
      { id: 'end', elements: [] },
    ] })).body
    const made = (await call('POST', '/api/presentations', { templateId: template.id })).body
    const [menu, end] = made.slides
    assert.notEqual(menu.id, 'menu')
    assert.notEqual(end.id, 'end')
    const [go, tab, panel] = menu.elements
    assert.equal(go.content, `<p><a href="#/s-${end.id}">End</a></p>`)
    assert.deepEqual(go.clickAction, { type: 'slide', slideId: end.id })
    assert.notEqual(panel.id, 'panel')
    assert.deepEqual(tab.clickAction, { type: 'visibility', show: [panel.id] })
  })

  it('presents a deck with states and a morphing shape', async () => {
    const { id } = (await call('POST', '/api/presentations', { title: 'States' })).body
    const shape = { id: 'dot', type: 'shape', shape: 'circle', x: 0, y: 0, width: 80, height: 80, text: '<b>x</b>', stateSteps: { 2: 'st_star' },
      states: [{ id: 'st_star', name: 'Star', shape: 'star', fill: '#ff0000', duration: 300 }, { id: 'bad"id', fill: 'red' }] }
    const button = { id: 'go', type: 'shape', shape: 'line-arrow', width: 80, height: 20, strokeDasharray: 'dashed', clickAction: { type: 'visibility', set: [{ id: 'dot', state: 'st_star', mode: 'toggle' }] } }
    await call('PUT', `/api/presentations/${id}`, { slides: [{ id: 's1', elements: [shape, button] }] })
    const res = await fetch(`${base}/api/presentations/${id}/present`)
    const html = await res.text()
    assert.equal(res.status, 200)
    assert.match(html, /data-el="dot" data-st-list="st_star" data-st="" data-st-start=""/)
    assert.match(html, /data-action-set="dot:st_star:toggle"/)
    assert.match(html, /<path d="M[^"]+" data-morph=":[^"|]+\|st_star:[^"]+" \/>/)
    assert.match(html, /:where\(\[data-el="dot"\]\[data-st="st_star"\][^{]*\{ --st-dur:300ms/)
    assert.match(html, /<polyline points=/) // line arrows, which the server's own copy used to leave out
    assert.match(html, /stroke-dasharray="/)
    assert.doesNotMatch(html, /bad"id|<b>x<\/b>/)
    assert.match(html, /<span class="fragment" data-fragment-index="2" data-st-steps="dot:st_star" aria-hidden="true"/)
  })

  it('serves uploads by their names, so none can run as this site', async () => {
    const dir = process.env.SLIDES_UPLOADS_DIR
    fs.writeFileSync(path.join(dir, 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    fs.writeFileSync(path.join(dir, 'fake.png'), '<script>alert(1)</script>')
    fs.writeFileSync(path.join(dir, 'page.xhtml'), '<html xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></html>')
    fs.writeFileSync(path.join(dir, 'doc.pdf'), '%PDF-1.4')
    const get = async name => (await fetch(`${base}/uploads/${name}`)).headers
    const svg = await get('pic.svg')
    assert.equal(svg.get('content-type'), 'image/svg+xml')
    assert.equal(svg.get('content-security-policy'), 'sandbox')
    const png = await get('fake.png')
    assert.equal(png.get('content-type'), 'image/png')
    assert.equal(png.get('x-content-type-options'), 'nosniff')
    const page = await get('page.xhtml')
    assert.equal(page.get('content-type'), 'application/octet-stream')
    assert.equal(page.get('content-disposition'), 'attachment')
    const pdf = await get('doc.pdf')
    assert.equal(pdf.get('content-type'), 'application/pdf')
    assert.equal(pdf.get('content-security-policy'), null) // PDF viewers won't open in a sandbox
  })

  it('answers only this computer, and no other site’s pages', async () => {
    const http = require('http')
    // A raw request, since fetch won't set Host
    const raw = (url, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
      const req = http.request(base + url, { method, headers }, res => { res.resume(); resolve(res.statusCode) })
      req.on('error', reject)
      req.end()
    })
    const port = new URL(base).port
    assert.equal(await raw('/api/presentations'), 200)
    assert.equal(await raw('/api/presentations', { Host: `localhost:${port}` }), 200)
    // A site that points its own name at this computer (DNS rebinding)
    assert.equal(await raw('/api/presentations', { Host: `evil.example:${port}` }), 403)
    assert.equal(await raw('/', { Host: `evil.example:${port}` }), 403)
    // Another site's page, or a sandboxed one
    assert.equal(await raw('/api/presentations', { Origin: 'https://evil.example' }), 403)
    assert.equal(await raw('/api/presentations', { Origin: 'null' }, 'POST'), 403)
    assert.equal(await raw('/api/presentations', { 'Sec-Fetch-Site': 'cross-site' }), 403)
    assert.equal(await raw('/api/presentations', { Origin: base, 'Sec-Fetch-Site': 'same-origin' }), 200)
    // Files a sandboxed deck loads still load
    assert.equal(await raw('/uploads/pic.svg', { Origin: 'null' }), 200)
  })

  it('opens to other names only when told to', () => {
    const { localOnly } = require('../middleware/security')
    const answer = (mw, host) => { let status = 200; mw({ headers: { host }, path: '/' }, { status: s => { status = s; return { type: () => ({ send() {} }) } } }, () => {}); return status }
    assert.equal(answer(localOnly(), '[::1]:3002'), 200)
    assert.equal(answer(localOnly(), 'parallax.lan:3002'), 403)
    assert.equal(answer(localOnly('localhost, parallax.lan'), 'Parallax.LAN:3002'), 200)
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
