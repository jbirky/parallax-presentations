// Live editing (services/collab.js), with Hocuspocus providers like the
// browsers', against the Postgres in TEST_DATABASE_URL; the server runs as
// helpers.js describes. Hocuspocus needs Node 22, so the tests are skipped on
// older versions, and without the database.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('crypto')
const Y = require('yjs')
const { DB, startCloudServer, until } = require('./helpers')

const nodeMajor = Number(process.versions.node.split('.')[0])
const skip = !DB ? 'TEST_DATABASE_URL is not set' : nodeMajor < 22 ? 'Hocuspocus needs Node 22' : false

let t, call, deckDoc, HocuspocusProvider
const providers = []

// A browser editing presentation `id` as `who`: resolves once it has synced,
// or once it's refused, with `failed` set
function connect(who, id) {
  const doc = new Y.Doc()
  const events = []
  return new Promise(resolve => {
    const provider = new HocuspocusProvider({
      url: `${t.base.replace('http', 'ws')}/collab`,
      name: id,
      document: doc,
      token: who,
      onSynced: () => resolve({ provider, doc, events }),
      onAuthenticationFailed: ({ reason }) => { events.push('refused'); resolve({ provider, doc, events, failed: reason }) },
      onClose: () => events.push('closed'),
    })
    providers.push(provider)
  })
}
const read = doc => deckDoc.readDeck(doc)
// A change in a browser, made as the editor makes it: by copying the deck
function edit(doc, change) {
  const before = read(doc)
  deckDoc.writeDeck(doc, before, change(before))
}
const renamed = title => deck => ({ ...deck, title })
const sent = ({ provider }) => until(() => !provider.hasUnsyncedChanges, 'the change to reach the server')

const el = (id, extra = {}) => ({ id, type: 'text', x: 0, y: 0, width: 100, height: 40, zIndex: 1, content: `<p>${id}</p>`, ...extra })
const slides = () => [{ id: 's1', notes: '', elements: [el('e1'), el('e2')] }, { id: 's2', notes: '', elements: [el('e3')] }]

describe('live editing', { skip }, () => {
  let owner, editor, stranger, deck

  before(async () => {
    t = await startCloudServer()
    call = t.call
    deckDoc = require('../services/deck-doc')
    ;({ HocuspocusProvider } = require('@hocuspocus/provider'))
    ;[owner, editor, stranger] = ['owner', 'editor', 'stranger'].map(t.user)
    for (const who of [owner, editor, stranger]) assert.equal((await call(who, 'GET', '/api/me')).status, 200)
    deck = await t.createDeck(owner, 'Live talk', { slides: slides() })
    await t.invite(owner, deck, editor)
  })

  after(async () => {
    for (const provider of providers) provider.destroy()
    await t?.stop()
  })

  it('keeps each editor’s copy in step', async () => {
    const a = await connect(owner, deck)
    const b = await connect(editor, deck)
    assert.equal(a.failed, undefined)
    assert.equal(read(a.doc).title, 'Live talk')
    assert.deepEqual(read(b.doc), read(a.doc))

    edit(a.doc, renamed('Renamed live'))
    await until(() => read(b.doc).title === 'Renamed live', 'the rename to reach the other editor')

    // two changes to one element at once both land
    edit(a.doc, d => ({ ...d, slides: d.slides.map(s => ({ ...s, elements: s.elements.map(e => e.id === 'e1' ? { ...e, x: 50 } : e) })) }))
    edit(b.doc, d => ({ ...d, slides: d.slides.map(s => ({ ...s, elements: s.elements.map(e => e.id === 'e1' ? { ...e, content: '<p>Both</p>' } : e) })) }))
    const both = doc => read(doc).slides[0].elements[0]
    await until(() => both(a.doc).content === '<p>Both</p>' && both(b.doc).x === 50, 'both changes to reach both editors')
    assert.deepEqual(read(a.doc), read(b.doc))
    a.provider.destroy()
    b.provider.destroy()
  })

  it('writes the edits to the presentation, for everything that reads it', async () => {
    const opened = (await call(owner, 'GET', `/api/presentations/${deck}`)).body
    assert.equal(opened.title, 'Renamed live')
    assert.equal(opened.slides[0].elements[0].content, '<p>Both</p>')
    const listed = (await call(editor, 'GET', '/api/presentations')).body.find(p => p.id === deck)
    assert.equal(listed.title, 'Renamed live')

    // an edit still waiting to be stored is stored before a read
    const a = await connect(owner, deck)
    edit(a.doc, renamed('Not stored yet'))
    await sent(a)
    assert.equal((await call(editor, 'GET', `/api/presentations/${deck}`)).body.title, 'Not stored yet')
    edit(a.doc, renamed('Renamed live'))
    await sent(a)
    a.provider.destroy()
  })

  it('refuses someone without access, and a token for no one', async () => {
    assert.ok((await connect(stranger, deck)).failed)
    assert.ok((await connect(`nobody-${t.run}`, deck)).failed)
    assert.ok((await connect(owner, randomUUID())).failed)
    assert.ok((await connect(owner, 'not-a-presentation')).failed)
  })

  it('brings a save through the API to everyone editing, and still refuses one from an old version', async () => {
    const a = await connect(owner, deck)
    const saved = await call(editor, 'PUT', `/api/presentations/${deck}`, { title: 'From the API' })
    assert.equal(saved.status, 200)
    assert.equal(saved.body.title, 'From the API')
    await until(() => read(a.doc).title === 'From the API', 'the saved title to reach the editor')
    // what the save left out stays
    assert.equal(read(a.doc).slides.length, 2)

    const { version } = (await call(editor, 'GET', `/api/presentations/${deck}`)).body
    edit(a.doc, renamed('Newer, live'))
    await sent(a)
    const stale = await call(editor, 'PUT', `/api/presentations/${deck}`, { title: 'From an old copy', version })
    assert.equal(stale.status, 409)
    assert.equal(read(a.doc).title, 'Newer, live')
    a.provider.destroy()
  })

  it('restores a version into the live document', async () => {
    const snap = (await call(owner, 'POST', `/api/presentations/${deck}/snapshot`, { name: 'v1' })).body
    const a = await connect(editor, deck)
    edit(a.doc, renamed('After the version'))
    await sent(a)
    const restored = await call(owner, 'POST', `/api/presentations/${deck}/restore/${snap.id}`)
    assert.equal(restored.status, 200)
    assert.equal(restored.body.title, 'Newer, live')
    await until(() => read(a.doc).title === 'Newer, live', 'the restored version to reach the editor')
    a.provider.destroy()
  })

  it('keeps the document itself, and opens it from there next time', async () => {
    await until(async () => (await t.pool.query('SELECT ydoc IS NOT NULL AS kept FROM presentations WHERE id = $1', [deck])).rows[0].kept, 'the document to be stored')
    // with no one editing, data changed underneath is ignored
    await new Promise(resolve => setTimeout(resolve, 300))
    await t.pool.query(`UPDATE presentations SET data = jsonb_set(data, '{title}', '"Changed underneath"') WHERE id = $1`, [deck])
    const a = await connect(owner, deck)
    assert.equal(read(a.doc).title, 'Newer, live')
    a.provider.destroy()
  })

  it('builds the document from the presentation the first time, slides from before elements included', async () => {
    const ownerId = await t.userId(owner)
    const { rows } = await t.pool.query(
      `INSERT INTO presentations (user_id, title, data) VALUES ($1, 'Old deck', $2) RETURNING id`,
      [ownerId, JSON.stringify({ title: 'Old deck', slides: [{ id: 'old', html: '<p>From before elements</p>' }] })])
    const old = rows[0].id
    const stored = async () => (await t.pool.query('SELECT ydoc IS NOT NULL AS kept, version FROM presentations WHERE id = $1', [old])).rows[0]
    const a = await connect(owner, old)
    const [slide] = read(a.doc).slides
    assert.equal(slide.elements.length, 1)
    assert.equal(slide.elements[0].content, '<p>From before elements</p>')

    // opening it writes nothing; the first change does
    await new Promise(resolve => setTimeout(resolve, 300))
    assert.deepEqual(await stored(), { kept: false, version: 0 })
    edit(a.doc, renamed('Old deck, edited'))
    await sent(a)
    a.provider.destroy()
    await until(async () => (await stored()).kept, 'the document to be stored')
    assert.equal((await stored()).version, 1)
    assert.equal((await call(owner, 'DELETE', `/api/presentations/${old}`)).status, 200)
  })

  it('keeps two editors in step through the editor’s own code', async () => {
    // client/src's modules, as the browser runs them
    const { connectLive } = await import('../../client/src/utils/liveDeck.js')
    const { createDeckStore } = await import('../../client/src/utils/deckDoc.js')
    const open = who => new Promise((resolve, reject) => {
      const seen = []
      const store = createDeckStore({ onChange: deck => seen.push(deck) })
      const connection = connectLive({
        id: deck, token: async () => who, url: `${t.base.replace('http', 'ws')}/collab`,
        onSynced: doc => resolve({ store, seen, connection, deck: store.attach(doc, { id: deck }) }),
        onRefused: () => reject(new Error(`${who} was refused`)),
      })
    })
    const a = await open(owner)
    const b = await open(editor)
    assert.equal(b.deck.title, a.deck.title)

    a.store.set(d => ({ ...d, title: 'Through the editor' }))
    await until(() => b.store.get().title === 'Through the editor', 'the rename to reach the other editor')
    assert.equal(b.seen.at(-1).title, 'Through the editor')
    // undo is each editor's own
    b.store.set(d => ({ ...d, theme: 'white' }))
    await until(() => a.store.get().theme === 'white', 'the theme to reach the first editor')
    a.store.undo()
    await until(() => b.store.get().title !== 'Through the editor', 'the undo to reach the other editor')
    assert.equal(b.store.get().theme, 'white')
    a.connection.disconnect()
    b.connection.disconnect()
  })

  it('tells each editor where the others are, until they leave', async () => {
    const a = await connect(owner, deck)
    const b = await connect(editor, deck)
    const state = { user: 'u-owner', slide: 's1', selected: ['e1'], editing: 'e1' }
    a.provider.awareness.setLocalState(state)
    const seen = () => [...b.provider.awareness.getStates().values()].find(s => s.user === 'u-owner')
    await until(() => seen()?.editing === 'e1', 'the other editor to see what the first is doing')
    assert.deepEqual(seen(), state)
    // gone when they disconnect, which lets go of what they had open
    a.provider.destroy()
    await until(() => !seen(), 'the first editor to be gone')
    b.provider.destroy()
  })

  it('disconnects an editor the owner removes, for good', async () => {
    const other = await t.createDeck(owner, 'Short collaboration', { slides: slides() })
    await t.invite(owner, other, editor)
    const a = await connect(owner, other)
    const b = await connect(editor, other)
    assert.equal((await call(owner, 'DELETE', `/api/presentations/${other}/collaborators/${await t.userId(editor)}`)).status, 200)
    await until(() => b.events.includes('closed'), 'the removed editor to be disconnected')
    edit(b.doc, renamed('Sneaked in'))
    await new Promise(resolve => setTimeout(resolve, 500))
    assert.equal(read(a.doc).title, 'Short collaboration')
    a.provider.destroy()
    b.provider.destroy()
    assert.equal((await call(owner, 'DELETE', `/api/presentations/${other}`)).status, 200)
  })

  it('disconnects everyone when the owner deletes the presentation', async () => {
    const doomed = await t.createDeck(owner, 'Doomed', { slides: slides() })
    await t.invite(owner, doomed, editor)
    const b = await connect(editor, doomed)
    assert.equal((await call(owner, 'DELETE', `/api/presentations/${doomed}`)).status, 200)
    await until(() => b.events.includes('closed'), 'the editor to be disconnected')
    b.provider.destroy()
    assert.ok((await connect(editor, doomed)).failed)
  })
})
