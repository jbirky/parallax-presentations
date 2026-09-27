// Pages built from a deck (share links, live sessions) are served in a
// sandbox, since a deck runs its author's code, and what they load from this
// site answers the null origin a sandboxed page has. Against a real Postgres,
// as helpers.js describes; skipped without TEST_DATABASE_URL.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
let t, owner, deck

// Sandboxed, with an origin of its own: never allow-same-origin
function assertSandboxed(res) {
  assert.equal(res.status, 200)
  const csp = res.headers.get('content-security-policy') || ''
  assert.match(csp, /^sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox\b/)
  assert.doesNotMatch(csp, /allow-same-origin|allow-top-navigation/)
}

describe('pages built from a deck', { skip }, () => {
  before(async () => {
    t = await startCloudServer()
    owner = t.user('owner')
    deck = await t.createDeck(owner, 'Sandboxed talk', {
      slides: [{ id: 's1', notes: 'SPEAKER ONLY', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 40, content: '<p>Hi</p>' }] }, { id: 's2', elements: [] }],
    })
  })
  after(() => t?.stop())

  it('serves a share link in a sandbox', async () => {
    const { token } = (await t.call(owner, 'POST', `/api/presentations/${deck}/share`)).body
    const res = await fetch(`${t.base}/share/${token}`)
    assertSandboxed(res)
    const html = await res.text()
    assert.match(html, /<p>Hi<\/p>/)
    // Speaker notes stay with whoever presents: anyone with the link opens this
    assert.doesNotMatch(html, /SPEAKER ONLY/)
    const own = await fetch(`${t.base}/api/presentations/${deck}/present`, { headers: { 'X-Test-User': owner } })
    assert.match(await own.text(), /SPEAKER ONLY/)
  })

  it('serves a live session in a sandbox, and its slide feed to anyone', async () => {
    const { sessionId } = (await t.call(owner, 'POST', `/api/presentations/${deck}/live/start`)).body
    assert.match(sessionId, /^[a-z2-9]{6}$/)
    const page = await fetch(`${t.base}/live/${sessionId}`)
    assertSandboxed(page)
    assert.doesNotMatch(await page.text(), /SPEAKER ONLY/)

    // As the sandboxed page asks: from origin null, not signed in
    const status = await fetch(`${t.base}/api/live/${sessionId}/status`, { headers: { Origin: 'null' } })
    assert.equal(status.status, 200)
    assert.equal(status.headers.get('access-control-allow-origin'), '*')
    assert.equal((await status.json()).currentSlide, 0)

    const stop = new AbortController()
    const stream = await fetch(`${t.base}/api/live/${sessionId}/stream`, { headers: { Origin: 'null' }, signal: stop.signal })
    assert.equal(stream.status, 200)
    assert.equal(stream.headers.get('access-control-allow-origin'), '*')
    const { value } = await stream.body.getReader().read()
    assert.match(Buffer.from(value).toString(), /^data: \{"type":"init","currentSlide":0/)
    stop.abort()

    // Moving the slides takes signing in, as whoever started the session
    const move = await fetch(`${t.base}/api/live/${sessionId}/slide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"flatIndex":1}' })
    assert.equal(move.status, 401)
    const slide = `/api/live/${sessionId}/slide`
    assert.equal((await t.call(t.user('audience'), 'POST', slide, { flatIndex: 1 })).status, 404)
    assert.equal((await t.call(owner, 'POST', slide, { flatIndex: -1 })).status, 400)
    assert.equal((await t.call(owner, 'POST', slide, { flatIndex: 1.5 })).status, 400)
    assert.equal((await t.call(owner, 'POST', slide, { flatIndex: 1 })).status, 200)
    const after = await (await fetch(`${t.base}/api/live/${sessionId}/status`)).json()
    assert.equal(after.currentSlide, 1)
    await t.call(owner, 'POST', `/api/presentations/${deck}/live/stop`, { sessionId })
  })

  it('lets any page load uploads, without credentials, and keeps the API to this site', async () => {
    const boundary = `----parallax${crypto.randomBytes(8).toString('hex')}`
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000'
      + '1f15c4890000000d49444154789c6360000002000100e221bc330000000049454e44ae426082', 'hex')
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="dot.png"\r\nContent-Type: image/png\r\n\r\n`),
      png, Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const { url } = (await t.call(owner, 'POST', `/api/presentations/${deck}/upload`, body, { 'Content-Type': `multipart/form-data; boundary=${boundary}` })).body
    const file = await fetch(t.base + url, { headers: { Origin: 'null' } })
    assert.equal(file.status, 200)
    assert.equal(file.headers.get('access-control-allow-origin'), '*')
    assert.equal(file.headers.get('access-control-allow-credentials'), null)

    const api = await fetch(`${t.base}/api/presentations`, { headers: { Origin: 'null', 'X-Test-User': owner } })
    assert.equal(api.headers.get('access-control-allow-origin'), null)
  })
})
