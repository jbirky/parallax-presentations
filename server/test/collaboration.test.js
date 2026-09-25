// Editing a presentation with others, through the HTTP API, against a real
// Postgres. Needs TEST_DATABASE_URL: a database for tests, with the migrations
// run (node server/migrations/run.js with DATABASE_URL set to it). It adds
// users and presentations and doesn't clean them up. Without it, the tests
// are skipped.
//
//   TEST_DATABASE_URL=postgres://… node --test server/test/*.test.js
//
// The server runs as helpers.js describes.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
let t, call, userId, createDeck, pool, run

// A one-file multipart body, with its length known up front as the quota needs
function imageUpload() {
  const boundary = `----parallax${crypto.randomBytes(8).toString('hex')}`
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000'
    + '1f15c4890000000d49444154789c6360000002000100e221bc330000000049454e44ae426082', 'hex')
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="dot.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { body, headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } }
}

const upload = (who, id) => {
  const { body, headers } = imageUpload()
  return call(who, 'POST', `/api/presentations/${id}/upload`, body, headers)
}

describe('editing a presentation with others', { skip }, () => {
  let owner, editor, stranger, second, deck, token

  before(async () => {
    t = await startCloudServer()
    ;({ call, userId, createDeck, pool, run } = t)
    ;[owner, editor, stranger, second] = ['owner', 'editor', 'stranger', 'second'].map(t.user)
    // Each user gets a row on their first request
    for (const who of [owner, editor, stranger, second]) assert.equal((await call(who, 'GET', '/api/me')).status, 200)
    deck = await createDeck(owner, `Shared talk ${run}`)
  })

  after(() => t?.stop())

  const editorRoutes = id => [
    ['GET', `/api/presentations/${id}`],
    ['PUT', `/api/presentations/${id}`, { title: 'Taken over' }],
    ['GET', `/api/presentations/${id}/uploads`],
    ['GET', `/api/presentations/${id}/export`],
    ['GET', `/api/presentations/${id}/present`],
    ['POST', `/api/presentations/${id}/snapshot`, { name: 'v1' }],
    ['GET', `/api/presentations/${id}/snapshots`],
    ['GET', `/api/presentations/${id}/datasets`],
    ['GET', `/api/presentations/${id}/plugins`],
    ['GET', `/api/presentations/${id}/collaborators`],
  ]

  it('keeps everyone else out of a presentation', async () => {
    for (const [method, url, body] of editorRoutes(deck)) {
      const res = await call(stranger, method, url, body)
      assert.equal(res.status, 404, `${method} ${url} gave ${res.status}`)
    }
    assert.equal((await upload(stranger, deck)).status, 404)
    assert.equal((await call(owner, 'GET', `/api/presentations/${deck}`)).body.title, `Shared talk ${run}`)
  })

  it('lets the owner turn on an invite link', async () => {
    const res = await call(owner, 'POST', `/api/presentations/${deck}/invite`)
    assert.equal(res.status, 200)
    token = res.body.inviteToken
    assert.match(token, /^[0-9a-f-]{36}$/)
    const info = await call(owner, 'GET', `/api/presentations/${deck}/collaborators`)
    assert.equal(info.body.role, 'owner')
    assert.equal(info.body.inviteToken, token)
    assert.deepEqual(info.body.people.map(p => p.role), ['owner'])
  })

  it('makes whoever opens the link an editor', async () => {
    const preview = await call(editor, 'GET', `/api/invites/${token}`)
    assert.equal(preview.status, 200)
    assert.equal(preview.body.id, deck)
    assert.equal(preview.body.ownerName, owner)
    assert.equal(preview.body.joined, false)

    const joined = await call(editor, 'POST', `/api/invites/${token}/accept`)
    assert.deepEqual(joined.body, { id: deck, title: `Shared talk ${run}`, role: 'editor' })
    // again is fine, and the owner stays owner
    assert.equal((await call(editor, 'POST', `/api/invites/${token}/accept`)).body.role, 'editor')
    assert.equal((await call(owner, 'POST', `/api/invites/${token}/accept`)).body.role, 'owner')
    assert.equal((await call(editor, 'GET', `/api/invites/${token}`)).body.joined, true)

    const info = await call(owner, 'GET', `/api/presentations/${deck}/collaborators`)
    assert.deepEqual(info.body.people.map(p => [p.name, p.role]), [[owner, 'owner'], [editor, 'editor']])
  })

  it('lets an editor open, change and keep versions of it', async () => {
    for (const [method, url, body] of editorRoutes(deck)) {
      const res = await call(editor, method, url, body)
      assert.equal(res.status, 200, `${method} ${url} gave ${res.status}`)
    }
    assert.equal((await call(owner, 'GET', `/api/presentations/${deck}`)).body.title, 'Taken over')
    const info = await call(editor, 'GET', `/api/presentations/${deck}/collaborators`)
    assert.equal(info.body.role, 'editor')
    assert.equal(info.body.you, await userId(editor))
    assert.equal(info.body.inviteToken, null)
  })

  it('lists it on the editor’s dashboard as shared, with its owner', async () => {
    const list = (await call(editor, 'GET', '/api/presentations')).body
    const shared = list.find(p => p.id === deck)
    assert.equal(shared.role, 'editor')
    assert.equal(shared.ownerName, owner)
    assert.equal((await call(owner, 'GET', '/api/presentations')).body.find(p => p.id === deck).role, undefined)
  })

  it('keeps deleting, sharing, presenting live and the invite link with the owner', async () => {
    const ownerRoutes = [
      ['DELETE', `/api/presentations/${deck}`, undefined, 404],
      ['POST', `/api/presentations/${deck}/duplicate`, undefined, 404],
      ['POST', `/api/presentations/${deck}/share`, undefined, 404],
      ['POST', `/api/presentations/${deck}/live/start`, undefined, 404],
      ['POST', `/api/presentations/${deck}/save-as-template`, {}, 404],
      ['POST', `/api/presentations/${deck}/invite`, undefined, 403],
      ['DELETE', `/api/presentations/${deck}/invite`, undefined, 403],
      ['DELETE', `/api/presentations/${deck}/collaborators/${await userId(owner)}`, undefined, 403],
    ]
    for (const [method, url, body, status] of ownerRoutes) {
      const res = await call(editor, method, url, body)
      assert.equal(res.status, status, `${method} ${url} gave ${res.status}`)
    }
    assert.equal((await call(owner, 'GET', `/api/presentations/${deck}`)).status, 200)
  })

  it('refuses a save made from a version someone has saved over', async () => {
    const { version } = (await call(owner, 'GET', `/api/presentations/${deck}`)).body
    const byEditor = await call(editor, 'PUT', `/api/presentations/${deck}`, { title: 'Editor’s title', version })
    assert.equal(byEditor.status, 200)
    assert.equal(byEditor.body.version, version + 1)

    const byOwner = await call(owner, 'PUT', `/api/presentations/${deck}`, { title: 'Owner’s title', version })
    assert.equal(byOwner.status, 409)
    assert.equal(byOwner.body.version, version + 1)
    assert.equal((await call(owner, 'GET', `/api/presentations/${deck}`)).body.title, 'Editor’s title')

    // from the version now it goes through; and a save without a version (a
    // tab from before this) isn't checked
    assert.equal((await call(owner, 'PUT', `/api/presentations/${deck}`, { title: 'Owner’s title', version: version + 1 })).status, 200)
    assert.equal((await call(owner, 'PUT', `/api/presentations/${deck}`, { title: 'Unchecked' })).status, 200)
  })

  it('doesn’t count a save that changes nothing as a new version', async () => {
    const before = (await call(owner, 'GET', `/api/presentations/${deck}`)).body
    const again = await call(owner, 'PUT', `/api/presentations/${deck}`, { ...before, updatedAt: new Date().toISOString() })
    assert.equal(again.status, 200)
    assert.equal(again.body.version, before.version)
    const after = (await call(owner, 'GET', `/api/presentations/${deck}`)).body
    assert.equal(after.version, before.version)
    assert.equal(after.updatedAt, before.updatedAt)
  })

  it('gives a restored version a new version number, which the restorer gets back', async () => {
    const snap = await call(editor, 'POST', `/api/presentations/${deck}/snapshot`, { name: 'before' })
    const { version } = (await call(editor, 'PUT', `/api/presentations/${deck}`, { title: 'After the snapshot' })).body
    const restored = await call(editor, 'POST', `/api/presentations/${deck}/restore/${snap.body.id}`)
    assert.equal(restored.status, 200)
    assert.equal(restored.body.version, version + 1)
    assert.equal(restored.body.title, 'Unchecked')
  })

  it('puts an editor’s uploads on the owner’s storage', async () => {
    const ownerId = await userId(owner)
    const editorId = await userId(editor)
    const fill = id => pool.query(
      `INSERT INTO uploads (presentation_id, user_id, filename, storage_key, content_type, size_bytes)
       VALUES (NULL, $1, $2, $2, 'image/png', $3)`, [id, `full-${run}-${id}`, 200 * 1024 * 1024])
    const empty = id => pool.query('DELETE FROM uploads WHERE user_id = $1', [id])

    await fill(ownerId)
    const refused = await upload(editor, deck)
    assert.equal(refused.status, 413)
    assert.match(refused.body.error, /owner's storage is full/)
    assert.match((await upload(owner, deck)).body.error, /Your storage is full/)
    await empty(ownerId)

    // the editor's own storage doesn't come into it
    await fill(editorId)
    const taken = await upload(editor, deck)
    assert.equal(taken.status, 200, JSON.stringify(taken.body))
    assert.match(taken.body.url, new RegExp(`^/uploads/${deck}/`))
    await empty(editorId)
  })

  it('stops the old link working when the owner makes a new one or turns it off', async () => {
    const renewed = (await call(owner, 'POST', `/api/presentations/${deck}/invite`)).body.inviteToken
    assert.notEqual(renewed, token)
    assert.equal((await call(second, 'GET', `/api/invites/${token}`)).status, 404)
    assert.equal((await call(second, 'POST', `/api/invites/${token}/accept`)).status, 404)
    assert.equal((await call(second, 'POST', `/api/invites/${renewed}/accept`)).status, 200)

    assert.equal((await call(owner, 'DELETE', `/api/presentations/${deck}/invite`)).body.inviteToken, null)
    assert.equal((await call(stranger, 'POST', `/api/invites/${renewed}/accept`)).status, 404)
    assert.equal((await call(stranger, 'GET', `/api/presentations/${deck}`)).status, 404)
  })

  it('lets the owner remove an editor, and an editor leave', async () => {
    const secondId = await userId(second)
    assert.equal((await call(editor, 'DELETE', `/api/presentations/${deck}/collaborators/${secondId}`)).status, 403)
    assert.equal((await call(owner, 'DELETE', `/api/presentations/${deck}/collaborators/${secondId}`)).status, 200)
    assert.equal((await call(second, 'GET', `/api/presentations/${deck}`)).status, 404)
    assert.equal((await call(second, 'GET', '/api/presentations')).body.some(p => p.id === deck), false)

    const editorId = await userId(editor)
    assert.equal((await call(editor, 'DELETE', `/api/presentations/${deck}/collaborators/${editorId}`)).status, 200)
    assert.equal((await call(editor, 'GET', `/api/presentations/${deck}`)).status, 404)
  })

  it('removes the editors with the presentation', async () => {
    const other = await createDeck(owner, `Short-lived ${run}`)
    const { inviteToken } = (await call(owner, 'POST', `/api/presentations/${other}/invite`)).body
    await call(editor, 'POST', `/api/invites/${inviteToken}/accept`)
    assert.equal((await call(owner, 'DELETE', `/api/presentations/${other}`)).status, 200)
    const { rows } = await pool.query('SELECT 1 FROM presentation_collaborators WHERE presentation_id = $1', [other])
    assert.equal(rows.length, 0)
    assert.equal((await call(editor, 'GET', '/api/presentations')).body.some(p => p.id === other), false)
  })
})
