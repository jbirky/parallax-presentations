// What the cloud's lists of presentations send for each card to draw its
// first slide (server/storage/deck-tile.js): the slide without its
// background, which comes apart as thumbnail, or its notes; and the deck's
// colors, text styles, font and slide size. Against a real Postgres, as
// helpers.js describes; skipped without TEST_DATABASE_URL.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'

describe('the cards in the cloud\'s lists', { skip }, () => {
  let t, owner, editor, admin
  const slides = [
    { id: 's1', notes: 'Speaker only', outlineNotes: 'Plan', background: { type: 'image', image: '/uploads/a.png', size: 'cover' },
      elements: [
        { id: 'e1', type: 'text', content: '<h2>Title</h2>', x: 0, y: 0, width: 900, height: 100 },
        { id: 'e3', type: 'html', content: '<script>/* a long page */</script>', x: 500, y: 200, width: 400, height: 300, zIndex: 2 },
      ] },
    { id: 's2', elements: [{ id: 'e2', type: 'text', content: 'Second' }] },
  ]
  const deck = { slides, themeColors: { background: '#0f2a31' }, textStyles: { h2Size: 48 }, globalFont: 'Jost', slideWidth: 1024, slideHeight: 768 }
  const expectCard = card => {
    // An embed comes as only where it sits: a card draws it as a plain tile
    assert.deepEqual(card.firstSlide, { id: 's1', elements: [slides[0].elements[0], { id: 'e3', type: 'html', x: 500, y: 200, width: 400, height: 300, zIndex: 2 }] })
    assert.deepEqual(card.thumbnail, slides[0].background)
    assert.deepEqual(card.themeColors, deck.themeColors)
    assert.deepEqual(card.textStyles, deck.textStyles)
    assert.equal(card.globalFont, 'Jost')
    assert.equal(card.slideWidth, 1024)
    assert.equal(card.slideHeight, 768)
  }

  before(async () => {
    t = await startCloudServer()
    owner = t.user('tile-owner'); editor = t.user('tile-editor'); admin = t.user('tile-admin')
    for (const who of [owner, editor, admin]) await t.call(who, 'GET', '/api/me')
  })
  after(() => t?.stop())

  it('sends them in the person\'s own list and among the decks shared with them', async () => {
    const id = await t.createDeck(owner, 'Cards')
    assert.equal((await t.call(owner, 'PUT', `/api/presentations/${id}`, deck)).status, 200)
    expectCard((await t.call(owner, 'GET', '/api/presentations')).body.find(p => p.id === id))
    await t.invite(owner, id, editor)
    expectCard((await t.call(editor, 'GET', '/api/presentations')).body.find(p => p.id === id))
  })

  it('sends them for templates and a team\'s presentations', async () => {
    const tmpl = await t.call(owner, 'POST', '/api/templates', { title: 'Card template', ...deck })
    assert.equal(tmpl.status, 201, JSON.stringify(tmpl.body))
    expectCard((await t.call(owner, 'GET', '/api/templates')).body.find(p => p.id === tmpl.body.id))

    process.env.ADMIN_USER_IDS = admin
    const team = (await t.call(admin, 'POST', '/api/admin/teams', { name: `Tiles ${t.run}`, ownerEmail: `${owner}@test.local`, seats: 3 })).body.team.id
    const id = await t.createDeck(owner, 'Team card', { teamId: team })
    await t.call(owner, 'PUT', `/api/presentations/${id}`, deck)
    expectCard((await t.call(owner, 'GET', `/api/teams/${team}/space`)).body.presentations.find(p => p.id === id))
    assert.equal((await t.call(owner, 'POST', `/api/teams/${team}/templates`, { presentationId: id, title: 'Team card template' })).status, 201)
    expectCard((await t.call(owner, 'GET', `/api/teams/${team}/templates`)).body.find(p => p.title === 'Team card template'))
  })
})
