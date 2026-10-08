// The landing page's statistics on /admin, through the real route, from a
// stand-in Umami that wants a sign-in and lets its token expire once.
// Against a real Postgres, as helpers.js describes; skipped without
// TEST_DATABASE_URL.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
const WEBSITE = 'ca976091-851a-4e54-b53e-6fa9a8bd8b79'
let t, admin, someone, umami
const asked = []
let tokens = 0, expireNext = false

const ANSWERS = {
  stats: { pageviews: 40, visitors: 20, visits: 25, bounces: 10, totaltime: 1500, comparison: { pageviews: 30, visitors: 16, visits: 20, bounces: 9, totaltime: 900 } },
  pageviews: { pageviews: [], sessions: [] },
  'metrics:event': [{ x: 'try', y: 6 }, { x: 'guest-start', y: 3 }],
  'metrics:referrer': [], 'metrics:country': [], 'metrics:device': [],
  'event-data/values:open-example': [{ value: 'venn', total: 7 }],
  'event-data/values:example-to-editor': [], 'event-data/values:guest-start': [],
  active: { visitors: 1 },
}

describe('the landing page statistics', { skip }, () => {
  before(async () => {
    umami = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://umami')
      res.setHeader('Content-Type', 'application/json')
      if (url.pathname === '/api/auth/login') {
        let body = ''
        req.on('data', c => { body += c })
        return req.on('end', () => {
          const { username, password } = JSON.parse(body)
          if (username !== 'parallax-app' || password !== 'secret') { res.statusCode = 401; return res.end('{}') }
          res.end(JSON.stringify({ token: `token-${++tokens}` }))
        })
      }
      if (req.headers.authorization !== `Bearer token-${tokens}` || expireNext) { expireNext = false; res.statusCode = 401; return res.end('{}') }
      const m = url.pathname.match(new RegExp(`^/api/websites/${WEBSITE}/(.+)$`))
      if (!m) { res.statusCode = 404; return res.end('{}') }
      const key = m[1] === 'metrics' ? `metrics:${url.searchParams.get('type')}` : m[1] === 'event-data/values' ? `${m[1]}:${url.searchParams.get('event')}` : m[1]
      asked.push(key)
      res.end(JSON.stringify(ANSWERS[key] ?? null))
    })
    await new Promise(resolve => umami.listen(0, '127.0.0.1', resolve))
    t = await startCloudServer()
    admin = t.user('admin')
    someone = t.user('someone')
    Object.assign(process.env, {
      ADMIN_USER_IDS: admin, UMAMI_URL: `http://127.0.0.1:${umami.address().port}`, UMAMI_WEBSITE_ID: WEBSITE,
      UMAMI_STATS_USER: 'parallax-app', UMAMI_STATS_PASSWORD: 'secret',
    })
    // An account made now, and a guest's, which isn't one
    await t.call(someone, 'GET', '/api/me')
    await t.pool.query("INSERT INTO users (email, name, auth_provider, plan) VALUES ($1, 'Guest', 'guest', 'guest')", [`guest-${t.run}@guest.invalid`])
  })
  after(async () => {
    await t.pool.query('DELETE FROM users WHERE email = $1', [`guest-${t.run}@guest.invalid`])
    await t.stop()
    umami.close()
  })

  it('is only for an admin, over 7, 30 or 90 days', async () => {
    assert.equal((await t.call(someone, 'GET', '/api/admin/stats?days=30')).status, 404)
    assert.equal((await t.call(admin, 'GET', '/api/admin/stats?days=5')).status, 400)
  })

  it('reads Umami as its account, signing in again when the token runs out', async () => {
    const first = await t.call(admin, 'GET', '/api/admin/stats?days=7')
    assert.equal(first.status, 200, JSON.stringify(first.body))
    assert.equal(first.body.totals.visitors, 20)
    assert.deepEqual(first.body.events, { try: 6, 'guest-start': 3 })
    assert.deepEqual(first.body.examples, [{ slug: 'venn', title: 'Venn diagrams', opened: 7, toEditor: 0, guestStarts: 0 }])
    assert.equal(first.body.daily.length, 8)
    assert.ok(first.body.accounts.signups >= 1, 'the account made just now counts')
    const { rows: [{ n }] } = await t.pool.query("SELECT COUNT(*)::int AS n FROM users WHERE auth_provider IS DISTINCT FROM 'guest' AND created_at >= NOW() - INTERVAL '7 days'")
    assert.equal(first.body.accounts.signups, n, 'guests aren’t accounts')
    assert.equal(tokens, 1)

    expireNext = true
    const later = await t.call(admin, 'GET', '/api/admin/stats?days=30')
    assert.equal(later.status, 200, JSON.stringify(later.body))
    assert.equal(tokens, 2)
  })

  it('keeps an answer for a minute', async () => {
    const before = asked.length
    await t.call(admin, 'GET', '/api/admin/stats?days=7')
    assert.equal(asked.length, before)
  })

  it('says why when Umami turns the account away', async () => {
    process.env.UMAMI_STATS_PASSWORD = 'wrong'
    expireNext = true
    const res = await t.call(admin, 'GET', '/api/admin/stats?days=90')
    assert.equal(res.status, 502)
    assert.match(res.body.error, /sign-in/)
    process.env.UMAMI_STATS_PASSWORD = 'secret'
  })
})
