// The server in cloud mode for tests, against the Postgres in
// TEST_DATABASE_URL (a database for tests, with the migrations run). Clerk is
// stubbed out: a request's user is its X-Test-User header, and a live editing
// token is the user's Clerk ID. .env isn't read, and R2 is off.

const assert = require('node:assert/strict')
const path = require('path')
const os = require('os')
const fs = require('fs')
const crypto = require('crypto')

const DB = process.env.TEST_DATABASE_URL
const serverDir = path.join(__dirname, '..')

function stub(moduleName, exports) {
  const file = require.resolve(moduleName, { paths: [serverDir] })
  require.cache[file] = { id: file, filename: file, loaded: true, exports, children: [], paths: [] }
}

// Starts the server; resolves to { base, server, pool, run, call, … }
async function startCloudServer() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parallax-test-'))
  Object.assign(process.env, {
    PARALLAX_MODE: 'cloud', PARALLAX_DB: 'postgres', DATABASE_URL: DB, NODE_ENV: 'test',
    SLIDES_DATA_DIR: path.join(tmp, 'data'), SLIDES_UPLOADS_DIR: path.join(tmp, 'uploads'),
  })
  delete process.env.PARALLAX_STORAGE
  stub('dotenv', { config: () => ({ parsed: {} }) })
  stub('@clerk/express', {
    clerkMiddleware: () => (req, res, next) => { req.testUser = req.get('X-Test-User') || null; next() },
    getAuth: req => ({ userId: req.testUser }),
    requireAuth: () => (req, res, next) => next(),
    verifyToken: async token => ({ sub: token }),
    clerkClient: { users: { getUser: async id => ({ emailAddresses: [{ emailAddress: `${id}@test.local` }], firstName: id, lastName: '', imageUrl: '' }) } },
  })
  // The server's cleanup timers mustn't keep the tests running
  const setIntervalBefore = global.setInterval
  global.setInterval = (...args) => setIntervalBefore(...args).unref()
  const { app, attachLiveEditing } = require('../index.js')
  global.setInterval = setIntervalBefore

  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  attachLiveEditing(server)
  const base = `http://127.0.0.1:${server.address().port}`
  const { Pool } = require('pg')
  const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } })
  const run = crypto.randomBytes(4).toString('hex')

  async function call(who, method, url, body, headers = {}) {
    const raw = Buffer.isBuffer(body)
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(who && { 'X-Test-User': who }),
        ...(body !== undefined && !raw && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { status: res.status, body: json }
  }

  async function userId(who) {
    const { rows } = await pool.query('SELECT id FROM users WHERE auth_id = $1', [who])
    return rows[0].id
  }

  async function createDeck(who, title, extra = {}) {
    const res = await call(who, 'POST', '/api/presentations', { title, ...extra })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    return res.body.id
  }

  // Makes `who` an editor of `id`, which `owner` owns
  async function invite(owner, id, who) {
    const { inviteToken } = (await call(owner, 'POST', `/api/presentations/${id}/invite`)).body
    assert.equal((await call(who, 'POST', `/api/invites/${inviteToken}/accept`)).status, 200)
  }

  async function stop() {
    server.close()
    await pool.end()
  }

  return { base, server, pool, run, user: name => `${name}-${run}`, call, userId, createDeck, invite, stop }
}

// Waits until check() is truthy, or fails after `ms`
async function until(check, what, ms = 5000) {
  const end = Date.now() + ms
  for (;;) {
    const value = await check()
    if (value) return value
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

module.exports = { DB, startCloudServer, until }
