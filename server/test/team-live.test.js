// Live editing of a team's decks: a viewer follows along, and the server
// drops their changes. Needs TEST_DATABASE_URL and Node 22, as live.test.js
// describes; skipped without them.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const Y = require('yjs')
const { DB, startCloudServer, until } = require('./helpers')

const nodeMajor = Number(process.versions.node.split('.')[0])
const skip = !DB ? 'TEST_DATABASE_URL is not set' : nodeMajor < 22 ? 'Hocuspocus needs Node 22' : false

describe('live editing a team deck', { skip }, () => {
  let t, call, deckDoc, HocuspocusProvider
  let siteAdmin, owner, viewer, team, deck
  const providers = []

  function connect(who, id) {
    const doc = new Y.Doc()
    return new Promise(resolve => {
      const provider = new HocuspocusProvider({
        url: `${t.base.replace('http', 'ws')}/collab`,
        name: id,
        document: doc,
        token: who,
        onSynced: () => resolve({ provider, doc }),
        onAuthenticationFailed: ({ reason }) => resolve({ provider, doc, failed: reason }),
      })
      providers.push(provider)
    })
  }
  const read = doc => deckDoc.readDeck(doc)
  const rename = (doc, title) => deckDoc.writeDeck(doc, read(doc), { ...read(doc), title })

  before(async () => {
    t = await startCloudServer()
    call = t.call
    deckDoc = require('../services/deck-doc')
    ;({ HocuspocusProvider } = require('@hocuspocus/provider'))
    ;[siteAdmin, owner, viewer] = ['site-admin', 'owner', 'viewer'].map(t.user)
    process.env.ADMIN_USER_IDS = siteAdmin
    for (const who of [siteAdmin, owner, viewer]) await call(who, 'GET', '/api/me')
    team = (await call(siteAdmin, 'POST', '/api/admin/teams', { name: `Live lab ${t.run}`, ownerEmail: `${owner}@test.local`, seats: 2 })).body.team.id
    const { token } = (await call(owner, 'POST', `/api/teams/${team}/invites`, { role: 'viewer' })).body
    await call(viewer, 'POST', `/api/team-invites/${token}/accept`)
    deck = (await call(owner, 'POST', '/api/presentations', { title: 'Lab meeting', teamId: team })).body.id
  })

  after(async () => {
    for (const provider of providers) provider.destroy()
    await t?.stop()
  })

  it('shows a viewer every change, and keeps theirs from anyone else', async () => {
    const owners = await connect(owner, deck)
    const viewers = await connect(viewer, deck)
    assert.equal(viewers.failed, undefined)
    assert.equal(read(viewers.doc).title, 'Lab meeting')

    rename(owners.doc, 'Lab meeting, week 2')
    await until(() => read(viewers.doc).title === 'Lab meeting, week 2', 'the owner\'s change to reach the viewer')

    rename(viewers.doc, 'Viewer was here')
    // Give it time to arrive, if it were going to
    await new Promise(resolve => setTimeout(resolve, 300))
    assert.equal(read(owners.doc).title, 'Lab meeting, week 2')
    const fresh = await connect(owner, deck)
    assert.equal(read(fresh.doc).title, 'Lab meeting, week 2')
  })
})
