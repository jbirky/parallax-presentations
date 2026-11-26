// Folders for a person's own presentations, and nesting in a team's,
// through the HTTP API against a real Postgres. Needs TEST_DATABASE_URL, as
// collaboration.test.js describes; skipped without it.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'

describe('folders', { skip }, () => {
  let t, call, createDeck, userId
  let me, someone, siteAdmin

  const mkdir = async (who, name, parentId = null) => {
    const res = await call(who, 'POST', '/api/folders', { name, parentId })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    return res.body.id
  }
  const mine = async who => Object.fromEntries((await call(who, 'GET', '/api/presentations')).body.map(p => [p.title, p.folderId]))
  const folderList = async who => (await call(who, 'GET', '/api/folders')).body.folders

  before(async () => {
    t = await startCloudServer()
    ;({ call, createDeck, userId } = t)
    ;[me, someone, siteAdmin] = ['me', 'someone', 'site-admin'].map(t.user)
    process.env.ADMIN_USER_IDS = siteAdmin
    for (const who of [me, someone, siteAdmin]) await call(who, 'GET', '/api/me')
    // More presentations than the free plan's three
    assert.equal((await call(siteAdmin, 'POST', `/api/admin/users/${await userId(me)}/plan`, { plan: 'pro' })).status, 200)
  })

  after(() => t?.stop())

  it('keeps a person\'s own folders, nested, to themselves', async () => {
    const talks = await mkdir(me, 'Talks')
    const year = await mkdir(me, '2026', talks)
    const list = await folderList(me)
    assert.deepEqual(list.map(f => [f.name, f.parentId]), [['2026', talks], ['Talks', null]])
    assert.deepEqual(await folderList(someone), [])
    assert.equal((await call(me, 'POST', '/api/folders', { name: 'talks' })).status, 409)
    // The same name is fine in another folder
    assert.equal((await call(me, 'POST', '/api/folders', { name: 'Talks', parentId: year })).status, 201)
    assert.equal((await call(me, 'POST', '/api/folders', { name: ' ' })).status, 400)
    assert.equal((await call(someone, 'POST', '/api/folders', { name: 'Sneaky', parentId: talks })).status, 404)
    assert.equal((await call(someone, 'PATCH', `/api/folders/${talks}`, { name: 'Mine now' })).status, 404)
    assert.equal((await call(someone, 'DELETE', `/api/folders/${talks}`)).status, 404)
  })

  it('makes presentations in a folder and files them in others', async () => {
    const drafts = await mkdir(me, 'Drafts')
    const made = await call(me, 'POST', '/api/presentations', { title: 'Colloquium', folderId: drafts })
    assert.equal(made.status, 201)
    assert.equal(made.body.folderId, drafts)
    assert.equal((await mine(me)).Colloquium, drafts)
    // Not into someone else's folder
    assert.equal((await call(someone, 'POST', '/api/presentations', { title: 'No', folderId: drafts })).status, 404)

    const done = await mkdir(me, 'Given')
    assert.equal((await call(me, 'PUT', `/api/presentations/${made.body.id}/location`, { teamId: null, folderId: done })).status, 200)
    assert.equal((await mine(me)).Colloquium, done)
    assert.equal((await call(me, 'PUT', `/api/presentations/${made.body.id}/location`, { teamId: null, folderId: null })).status, 200)
    assert.equal((await mine(me)).Colloquium, null)
    // Someone else can't file it, nor file theirs in a folder of mine
    assert.equal((await call(someone, 'PUT', `/api/presentations/${made.body.id}/location`, { teamId: null, folderId: null })).status, 404)
    const theirs = await createDeck(someone, 'Theirs')
    assert.equal((await call(someone, 'PUT', `/api/presentations/${theirs}/location`, { teamId: null, folderId: done })).status, 404)
  })

  it('copies a presentation into the same folder', async () => {
    const papers = await mkdir(me, 'Papers')
    const id = (await call(me, 'POST', '/api/presentations', { title: 'Journal club', folderId: papers })).body.id
    const copy = await call(me, 'POST', `/api/presentations/${id}/duplicate`)
    assert.equal(copy.status, 201)
    assert.equal(copy.body.folderId, papers)
    assert.equal((await mine(me))['Journal club (copy)'], papers)
  })

  it('moves folders into others, but never into themselves', async () => {
    const outer = await mkdir(me, 'Outer')
    const inner = await mkdir(me, 'Inner', outer)
    assert.equal((await call(me, 'PATCH', `/api/folders/${outer}`, { parentId: outer })).status, 400)
    assert.equal((await call(me, 'PATCH', `/api/folders/${outer}`, { parentId: inner })).status, 400)
    const moved = await call(me, 'PATCH', `/api/folders/${inner}`, { parentId: null, name: 'Inner, now outside' })
    assert.equal(moved.status, 200)
    assert.deepEqual([moved.body.name, moved.body.parentId], ['Inner, now outside', null])
    assert.equal((await call(me, 'PATCH', `/api/folders/${outer}`, { parentId: 'nope' })).status, 400)
  })

  it('moves what\'s in a deleted folder up into its parent', async () => {
    const top = await mkdir(me, 'Archive')
    const middle = await mkdir(me, 'Old talks', top)
    const bottom = await mkdir(me, 'Very old talks', middle)
    const deck = (await call(me, 'POST', '/api/presentations', { title: 'First talk', folderId: middle })).body.id
    assert.equal((await call(me, 'DELETE', `/api/folders/${middle}`)).status, 200)
    assert.equal((await mine(me))['First talk'], top)
    assert.equal((await folderList(me)).find(f => f.id === bottom).parentId, top)
    assert.ok(!(await folderList(me)).some(f => f.id === middle))
    assert.ok(deck)
  })

  it('nests a team\'s folders too, and moves a deleted one\'s decks up a level', async () => {
    const team = (await call(siteAdmin, 'POST', '/api/admin/teams', { name: `Lab ${t.run}`, ownerEmail: `${me}@test.local`, seats: 2 })).body.team.id
    const talks = (await call(me, 'POST', `/api/teams/${team}/folders`, { name: 'Talks' })).body.id
    const year = (await call(me, 'POST', `/api/teams/${team}/folders`, { name: '2026', parentId: talks })).body.id
    const deck = (await call(me, 'POST', '/api/presentations', { title: 'AAS talk', teamId: team, folderId: year })).body.id
    // A team's folders aren't anyone's own
    assert.equal((await call(me, 'PUT', `/api/presentations/${deck}/location`, { teamId: null, folderId: talks })).status, 404)
    assert.equal((await call(me, 'PATCH', `/api/teams/${team}/folders/${talks}`, { parentId: year })).status, 400)
    assert.equal((await call(me, 'DELETE', `/api/teams/${team}/folders/${year}`)).status, 200)
    const space = (await call(me, 'GET', `/api/teams/${team}/space`)).body
    assert.equal(space.presentations.find(p => p.id === deck).folderId, talks)

    // Taken out of the team into one of their own folders
    const mineFolder = await mkdir(me, 'From the lab')
    const out = await call(me, 'PUT', `/api/presentations/${deck}/location`, { teamId: null, folderId: mineFolder })
    assert.equal(out.status, 200, JSON.stringify(out.body))
    assert.equal((await mine(me))['AAS talk'], mineFolder)
    assert.ok(await userId(me))
  })
})
