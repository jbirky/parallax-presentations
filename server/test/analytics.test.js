// The landing page's analytics: the server hands out Umami's script and
// passes events on to Umami, here a stand-in that records what it's sent.
// Self-hosted, so it needs no database. .env isn't read.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const path = require('path')
const os = require('os')
const fs = require('fs')

const serverDir = path.join(__dirname, '..')
const WEBSITE = 'ca976091-851a-4e54-b53e-6fa9a8bd8b79'
let base, server, umami
const received = []

before(async () => {
  umami = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      received.push({ method: req.method, url: req.url, headers: req.headers, body })
      if (req.url === '/script.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end('/* umami */') }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ cache: 'token-1' }))
    })
  })
  await new Promise(resolve => umami.listen(0, '127.0.0.1', resolve))

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parallax-test-'))
  for (const key of ['PARALLAX_MODE', 'PARALLAX_DB', 'DATABASE_URL', 'PARALLAX_STORAGE']) delete process.env[key]
  Object.assign(process.env, {
    NODE_ENV: 'test', SLIDES_DATA_DIR: path.join(tmp, 'data'), SLIDES_UPLOADS_DIR: path.join(tmp, 'uploads'),
    UMAMI_URL: `http://127.0.0.1:${umami.address().port}/`, UMAMI_WEBSITE_ID: WEBSITE,
  })
  const dotenv = require.resolve('dotenv', { paths: [serverDir] })
  require.cache[dotenv] = { id: dotenv, filename: dotenv, loaded: true, exports: { config: () => ({ parsed: {} }) }, children: [], paths: [] }
  const { app } = require('../index.js')
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => { server?.close(); umami?.close() })

const send = (website, headers = {}) => fetch(`${base}/stats/api/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Test', ...headers },
  body: JSON.stringify({ type: 'event', payload: { website, hostname: 'parallax-presentations.com', url: '/', name: 'try', data: { from: 'hero' } } }),
})

describe('analytics', () => {
  it('tells the page where Umami’s script is, and serves it from this site', async () => {
    assert.deepEqual(await (await fetch(`${base}/api/analytics`)).json(), { websiteId: WEBSITE, script: '/stats/script.js' })
    const script = await fetch(`${base}/stats/script.js`)
    assert.equal(script.status, 200)
    assert.match(script.headers.get('content-type'), /javascript/)
    assert.equal(await script.text(), '/* umami */')
    await fetch(`${base}/stats/script.js`)
    assert.equal(received.filter(r => r.url === '/script.js').length, 1, 'fetched from Umami once, then kept')
  })

  it('passes events on to Umami, with who sent them', async () => {
    const res = await send(WEBSITE, { 'CF-Connecting-IP': '203.0.113.7', 'x-umami-cache': 'token-0', 'x-umami-hostname': 'parallax-presentations.com' })
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { cache: 'token-1' })
    const got = received.at(-1)
    assert.equal(got.url, '/api/send')
    assert.equal(got.headers['cf-connecting-ip'], '203.0.113.7')
    assert.equal(got.headers['user-agent'], 'Mozilla/5.0 Test')
    assert.equal(got.headers['x-umami-cache'], 'token-0')
    assert.equal(got.headers['x-umami-hostname'], 'parallax-presentations.com')
    assert.deepEqual(JSON.parse(got.body).payload.data, { from: 'hero' })
  })

  it('passes on nothing for another website', async () => {
    const before = received.length
    assert.equal((await send('3f816c73-39d2-40d7-86bb-1117e33777cb')).status, 400)
    assert.equal(received.length, before)
  })
})
