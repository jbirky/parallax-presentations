// Presentations past a plan's limit are read-only instead of expiring
// (services/deck-locks.js): the Free plan's owner edits their newest three,
// and the older ones can still be opened, copied and deleted, but not changed,
// by them or anyone they edit with, here or live. Needs TEST_DATABASE_URL, as
// collaboration.test.js describes; skipped without it (and the live part
// without Node 22).

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const Y = require('yjs')
const { DB, startCloudServer, until } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
const nodeMajor = Number(process.versions.node.split('.')[0])

describe('presentations past a plan\'s limit', { skip }, () => {
  let t, call, userId, pool
  let siteAdmin, owner, editor
  const decks = []
  const providers = []
  const save = (who, id, title) => call(who, 'PUT', `/api/presentations/${id}`, { title })
  const lockedIn = async (who) => (await call(who, 'GET', '/api/presentations')).body.filter(p => p.locked).map(p => p.title).sort()

  before(async () => {
    t = await startCloudServer()
    ;({ call, userId, pool } = t)
    ;[siteAdmin, owner, editor] = ['lock-admin', 'lock-owner', 'lock-editor'].map(t.user)
    process.env.ADMIN_USER_IDS = siteAdmin
    for (const who of [siteAdmin, owner, editor]) await call(who, 'GET', '/api/me')
    // Four on the Free plan (three editable), made a moment apart
    for (const title of ['First', 'Second', 'Third', 'Fourth']) {
      const res = await call(owner, 'POST', '/api/presentations', { title })
      assert.equal(res.status, 201, JSON.stringify(res.body))
      assert.equal(res.body.expiresAt, undefined)
      decks.push(res.body.id)
      await new Promise(resolve => setTimeout(resolve, 15))
    }
  })

  after(async () => {
    for (const provider of providers) provider.destroy()
    await t?.stop()
  })

  it('lets the owner make more, and keeps the newest three editable', async () => {
    assert.deepEqual(await lockedIn(owner), ['First'])
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM presentations WHERE id = ANY($1) AND expires_at IS NOT NULL', [decks])
    assert.equal(rows[0].n, 0)
    assert.equal((await save(owner, decks[3], 'Fourth, edited')).status, 200)
    const refused = await save(owner, decks[0], 'First, edited')
    assert.equal(refused.status, 403)
    assert.equal(refused.body.code, 'deck_locked')
    assert.match(refused.body.error, /keeps your 3 newest presentations editable/)
    const access = (await call(owner, 'GET', `/api/presentations/${decks[0]}/collaborators`)).body
    assert.equal(access.locked, true)
    assert.match(access.lockedMessage, /Upgrade, or delete a newer presentation/)
    assert.equal((await call(owner, 'GET', `/api/presentations/${decks[0]}`)).status, 200)
  })

  it('keeps it read-only for the people editing it with its owner', async () => {
    await t.invite(owner, decks[0], editor)
    const refused = await save(editor, decks[0], 'Editor was here')
    assert.equal(refused.status, 403)
    assert.match(refused.body.error, /its owner’s 3 newest/)
    const shared = (await call(editor, 'GET', '/api/presentations')).body.find(p => p.id === decks[0])
    assert.equal(shared.locked, true)
    assert.equal(shared.ownerPlan, undefined)
  })

  it('lets the owner copy one, which pushes another past the limit, and delete one', async () => {
    const copy = await call(owner, 'POST', `/api/presentations/${decks[0]}/duplicate`)
    assert.equal(copy.status, 201, JSON.stringify(copy.body))
    assert.equal((await save(owner, copy.body.id, 'Copy, edited')).status, 200)
    assert.deepEqual(await lockedIn(owner), ['First', 'Second'])
    // Deleting a newer one makes the next one editable again
    assert.equal((await call(owner, 'DELETE', `/api/presentations/${copy.body.id}`)).status, 200)
    assert.deepEqual(await lockedIn(owner), ['First'])
    assert.equal((await save(owner, decks[1], 'Second, edited')).status, 200)
  })

  it('refuses live edits to one past the limit', { skip: nodeMajor < 22 ? 'Hocuspocus needs Node 22' : false }, async () => {
    const deckDoc = require('../services/deck-doc')
    const { HocuspocusProvider } = require('@hocuspocus/provider')
    const connect = (who, id) => new Promise(resolve => {
      const doc = new Y.Doc()
      const provider = new HocuspocusProvider({
        url: `${t.base.replace('http', 'ws')}/collab`, name: id, document: doc, token: who,
        onSynced: () => resolve({ doc }), onAuthenticationFailed: ({ reason }) => resolve({ doc, failed: reason }),
      })
      providers.push(provider)
    })
    const read = doc => deckDoc.readDeck(doc)
    const mine = await connect(owner, decks[0])
    assert.equal(mine.failed, undefined)
    assert.equal(read(mine.doc).title, 'First')
    deckDoc.writeDeck(mine.doc, read(mine.doc), { ...read(mine.doc), title: 'Sneaked in' })
    await new Promise(resolve => setTimeout(resolve, 300))
    const fresh = await connect(owner, decks[0])
    assert.equal(read(fresh.doc).title, 'First')
    // An editable one still takes them
    const open = await connect(owner, decks[3])
    deckDoc.writeDeck(open.doc, read(open.doc), { ...read(open.doc), title: 'Live edit' })
    await until(async () => (await call(owner, 'GET', `/api/presentations/${decks[3]}`)).body.title === 'Live edit', 'the live edit to be saved')
  })

  it('makes them all editable on a plan without a limit', async () => {
    assert.equal((await call(siteAdmin, 'POST', `/api/admin/users/${await userId(owner)}/plan`, { plan: 'pro' })).status, 200)
    assert.deepEqual(await lockedIn(owner), [])
    assert.equal((await save(owner, decks[0], 'First, at last')).status, 200)
    assert.equal((await save(editor, decks[0], 'Editor, at last')).status, 200)
    // Back on Free, the oldest (renamed by now) is read-only again
    assert.equal((await call(siteAdmin, 'POST', `/api/admin/users/${await userId(owner)}/plan`, { plan: 'free' })).status, 200)
    assert.deepEqual(await lockedIn(owner), ['Editor, at last'])
  })
})
