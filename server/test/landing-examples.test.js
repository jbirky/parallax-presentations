// The landing page's examples, as an admin edits them from /admin and as the
// landing page and guests see them. Against a real Postgres with migration
// 017, as helpers.js describes; skipped without TEST_DATABASE_URL. Drawing a
// thumbnail needs a Chromium and the built client's libraries (/vendor),
// which tests don't have, so here it fails and says why, and the example
// changes anyway; a thumbnail put in the table is served.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { DB, startCloudServer } = require('./helpers')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
let t, admin, someone, deck, added

const publicList = async () => (await t.call(null, 'GET', '/api/examples')).body

describe('the landing page’s examples', { skip }, () => {
  before(async () => {
    t = await startCloudServer()
    admin = t.user('admin')
    someone = t.user('someone')
    process.env.ADMIN_USER_IDS = admin
    deck = await t.createDeck(admin, `Cell division ${t.run}`, {
      slides: [
        { id: 's1', notes: 'Say this slowly', outlineNotes: [{ text: 'my plan', level: 0 }], background: { type: 'color', color: '#123456' },
          elements: [{ id: 'e1', type: 'text', x: 60, y: 60, width: 600, height: 100, content: '<h2>Mitosis</h2>' }] },
      ],
      annotationSets: [{ id: 'ink', slides: {} }],
    })
  })
  after(async () => {
    // Put the shared table back as it was
    await t.pool.query("DELETE FROM landing_examples WHERE NOT builtin")
    await t.pool.query("UPDATE landing_examples SET hero = (slug = 'hero'), card = (slug <> 'hero'), kind = 'example', deck = NULL, source_presentation_id = NULL, thumbnail = NULL WHERE builtin")
    await t.stop()
  })

  it('is edited only by an admin', async () => {
    assert.equal((await t.call(someone, 'GET', '/api/admin/examples')).status, 404)
    assert.equal((await t.call(someone, 'POST', '/api/admin/examples', { presentationId: deck, title: 'x' })).status, 404)
    const { body } = await t.call(admin, 'GET', '/api/admin/examples')
    assert.equal(body.examples[0].slug, 'hero')
    assert.ok(body.examples.some(e => e.slug === 'venn' && e.builtin && e.card))
  })

  it('starts with the built-in examples on the landing page', async () => {
    const list = await publicList()
    assert.equal(list.hero, 'hero')
    assert.equal(list.examples[0].slug, 'chemistry')
    assert.equal(list.examples.find(e => e.slug === 'venn').thumbnail, '/examples/thumbs/venn.jpg')
    assert.ok(!list.examples.some(e => e.slug === 'hero'))
  })

  it('serves the showcase’s decks, which aren’t in the list, and nothing for a name it doesn’t have', async () => {
    const page = await fetch(`${t.base}/examples/showcase-cite/deck`)
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.match(html, /Missing mass, twice/)
    assert.match(html, /data-slide-id="references"/)
    assert.ok(!(await publicList()).examples.some(e => e.slug.startsWith('showcase-')))
    assert.equal((await fetch(`${t.base}/examples/showcase-code/deck`)).status, 200)
    assert.equal((await fetch(`${t.base}/examples/showcase-nope/deck`)).status, 404)
  })

  it('adds a copy of one of the admin’s presentations, without what’s private to it', async () => {
    const res = await t.call(admin, 'POST', '/api/admin/examples', { presentationId: deck, title: 'Cell division', field: 'Biology', description: 'Mitosis, step by step', tags: 'Diagram, Timeline' })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    added = res.body.example
    assert.match(added.slug, /^cell-division(-\d+)?$/)
    assert.deepEqual(added.tags, ['Diagram', 'Timeline'])
    assert.equal(added.sourcePresentationId, deck)
    assert.equal(added.sourceTitle, `Cell division ${t.run}`)
    assert.equal(added.hasThumbnail, false)
    assert.match(res.body.thumbnailError, /Chromium|couldn’t be drawn/)

    const copy = (await t.call(null, 'GET', `/api/examples/${added.slug}`)).body
    assert.equal(copy.slides[0].notes, '')
    assert.equal(copy.slides[0].outlineNotes, undefined)
    assert.equal(copy.annotationSets, undefined)
    assert.equal(copy.slides[0].elements[0].content, '<h2>Mitosis</h2>')

    const card = (await publicList()).examples.at(-1)
    assert.equal(card.slug, added.slug)
    assert.deepEqual(card.background, { type: 'color', color: '#123456' })
    // A photo background stays in the deck but is left out of the list
    await t.pool.query(`UPDATE landing_examples SET deck = jsonb_set(deck, '{slides,0,background}', $2::jsonb) WHERE slug = $1`,
      [added.slug, JSON.stringify({ type: 'image', src: 'data:image/jpeg;base64,' + 'A'.repeat(4000) })])
    assert.equal((await publicList()).examples.at(-1).background, null)
    assert.equal((await t.call(null, 'GET', `/api/examples/${added.slug}`)).body.slides[0].background.type, 'image')
    await t.pool.query(`UPDATE landing_examples SET deck = jsonb_set(deck, '{slides,0,background}', $2::jsonb) WHERE slug = $1`,
      [added.slug, JSON.stringify({ type: 'color', color: '#123456' })])
    assert.equal(card.thumbnail, null)
    // A thumbnail the server drew is served under a link that names its version
    await t.pool.query('UPDATE landing_examples SET thumbnail = $2, updated_at = NOW() WHERE slug = $1', [added.slug, Buffer.from('ffd8ffe0', 'hex')])
    const drawn = (await publicList()).examples.at(-1).thumbnail
    assert.match(drawn, new RegExp(`^/examples/thumbs/${added.slug}\\.jpg\\?v=\\d+$`))
    const image = await fetch(t.base + drawn)
    assert.equal(image.headers.get('content-type'), 'image/jpeg')
    assert.match(image.headers.get('cache-control'), /immutable/)
    assert.equal(Buffer.from(await image.arrayBuffer()).toString('hex'), 'ffd8ffe0')
    const page = await fetch(`${t.base}/examples/${added.slug}/deck`)
    assert.match(page.headers.get('content-security-policy'), /^sandbox allow-scripts\b/)
    assert.match(await page.text(), /Mitosis/)
    assert.match(await (await fetch(`${t.base}/examples/${added.slug}`)).text(), /<h1>Cell division<\/h1>/)
  })

  it('won’t copy someone else’s presentation, or take a card without a title', async () => {
    const theirs = await t.createDeck(someone, 'Not yours')
    assert.equal((await t.call(admin, 'POST', '/api/admin/examples', { presentationId: theirs, title: 'Mine now' })).status, 404)
    assert.equal((await t.call(admin, 'POST', '/api/admin/examples', { presentationId: deck, title: '  ' })).status, 400)
    const tooMany = await t.call(admin, 'PUT', `/api/admin/examples/${added.slug}`, { tags: 'a,b,c,d,e,f,g' })
    assert.equal(tooMany.status, 400)
  })

  it('changes a card’s words, hides it, puts it first, and at the top of the page', async () => {
    const saved = (await t.call(admin, 'PUT', `/api/admin/examples/${added.slug}`, { title: 'Cell division, live', field: 'Biology' })).body.example
    assert.equal(saved.title, 'Cell division, live')

    await t.call(admin, 'PUT', `/api/admin/examples/${added.slug}`, { card: false })
    assert.ok(!(await publicList()).examples.some(e => e.slug === added.slug))
    await t.call(admin, 'PUT', `/api/admin/examples/${added.slug}`, { card: true })

    const all = (await t.call(admin, 'GET', '/api/admin/examples')).body.examples.map(e => e.slug)
    const order = [added.slug, ...all.filter(s => s !== added.slug)]
    assert.deepEqual((await t.call(admin, 'PUT', '/api/admin/examples/order', { slugs: order })).body.examples.map(e => e.slug), order)
    assert.equal((await publicList()).examples[0].slug, added.slug)

    await t.call(admin, 'PUT', `/api/admin/examples/${added.slug}`, { hero: true })
    const list = await publicList()
    assert.equal(list.hero, added.slug)
    const heroes = (await t.pool.query('SELECT slug FROM landing_examples WHERE hero')).rows
    assert.deepEqual(heroes, [{ slug: added.slug }])
    assert.equal((await t.call(admin, 'DELETE', `/api/admin/examples/${added.slug}`)).status, 400)
    await t.call(admin, 'PUT', '/api/admin/examples/hero', { hero: true })
    assert.equal((await publicList()).hero, 'hero')
  })

  it('takes the presentation’s changes only when asked', async () => {
    const res = await t.call(admin, 'PUT', `/api/presentations/${deck}`, {
      title: `Cell division ${t.run}`,
      slides: [{ id: 's1', notes: '', elements: [{ id: 'e1', type: 'text', x: 60, y: 60, width: 600, height: 100, content: '<h2>Meiosis</h2>' }] }],
    })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    const page = () => fetch(`${t.base}/examples/${added.slug}/deck`).then(r => r.text())
    assert.match(await page(), /Mitosis/)
    assert.equal((await t.call(admin, 'POST', `/api/admin/examples/${added.slug}/refresh`)).status, 200)
    assert.match(await page(), /Meiosis/)
  })

  it('makes an editable copy of a built-in example, which it then comes from', async () => {
    const res = await t.call(admin, 'POST', '/api/admin/examples/venn/copy')
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(res.body.presentation.title, 'Venn diagrams')
    assert.equal(res.body.example.sourcePresentationId, res.body.presentation.id)
    assert.equal(res.body.example.ownDeck, true)
    const own = (await t.call(admin, 'GET', `/api/presentations/${res.body.presentation.id}`)).body
    assert.equal(own.slides.length, 2)
  })

  it('shows a template on the Templates tab, which anyone signed in can copy', async () => {
    // A template's speaker notes are for whoever starts from it
    const talk = await t.createDeck(admin, `Journal club ${t.run}`, {
      slides: [{ id: 's1', notes: 'Click the figure to show the method', outlineNotes: [{ text: 'my plan', level: 0 }],
        elements: [{ id: 'e1', type: 'text', x: 60, y: 60, width: 600, height: 100, content: '<h2>Meiosis</h2>' }] }],
    })
    const res = await t.call(admin, 'POST', '/api/admin/examples', { presentationId: talk, title: 'Journal club', field: 'Talks', description: 'A paper in ten slides', kind: 'template' })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    const template = res.body.example
    assert.equal(template.kind, 'template')
    let list = await publicList()
    assert.deepEqual(list.templates.map(e => e.slug), [template.slug])
    assert.equal(list.templates[0].desc, 'A paper in ten slides')
    // A template's card names its deck's theme; an example's doesn't
    assert.equal(typeof list.templates[0].theme, 'string')
    assert.ok(list.templates[0].theme.length > 0)
    assert.ok(list.examples.every(e => e.theme === undefined))
    assert.ok(!list.examples.some(e => e.slug === template.slug), 'not among the examples')

    // Its own page: the deck, its slides, its theme, and Use this template
    const own = await fetch(`${t.base}/templates/${template.slug}`)
    assert.equal(own.status, 200)
    const ownHtml = await own.text()
    assert.match(ownHtml, /<title>Journal club · Parallax templates<\/title>/)
    assert.match(ownHtml, new RegExp(`<iframe id="deck" src="/examples/${template.slug}/deck"`))
    assert.match(ownHtml, new RegExp(`href="/templates/${template.slug}/use"`))
    assert.match(ownHtml, /aria-label="Slide 1: Meiosis"/)
    assert.match(ownHtml, /content="A paper in ten slides\. A Parallax template/)
    // The deck answers the page that frames it
    assert.match(await (await fetch(`${t.base}/examples/${template.slug}/deck`)).text(), /parallax-deck-go/)
    // Its slides wait for a Chromium, which this server hasn't
    const chromium = process.env.PARALLAX_CHROMIUM
    process.env.PARALLAX_CHROMIUM = '/no/such/chromium'
    try {
      assert.deepEqual((await t.call(null, 'GET', `/templates/${template.slug}/slides.json`)).body, { ready: false, drawing: false })
    } finally {
      if (chromium === undefined) delete process.env.PARALLAX_CHROMIUM; else process.env.PARALLAX_CHROMIUM = chromium
    }
    assert.equal((await t.call(null, 'GET', `/templates/${template.slug}/slides/${template.slug}-000000000000/1.jpg`)).status, 404)
    // An example, or a name it doesn't have, has no template page
    assert.equal((await t.call(null, 'GET', '/templates/venn/slides.json')).status, 404)
    assert.notEqual((await fetch(`${t.base}/templates/venn`)).status, 200)

    // The top of the page is an example
    assert.equal((await t.call(admin, 'PUT', `/api/admin/examples/${template.slug}`, { hero: true })).status, 400)
    assert.equal((await t.call(admin, 'PUT', '/api/admin/examples/hero', { kind: 'template' })).status, 400)
    // A built-in example has no deck of its own to copy until it's given one
    assert.equal((await t.call(admin, 'PUT', '/api/admin/examples/logic', { kind: 'template' })).status, 400)
    assert.equal((await t.call(admin, 'PUT', `/api/admin/examples/${template.slug}`, { kind: 'poster' })).status, 400)

    // Someone signed in copies it: a presentation of theirs, with the speaker
    // notes but not the outline's
    const used = await t.call(someone, 'POST', `/api/landing-templates/${template.slug}/use`)
    assert.equal(used.status, 201, JSON.stringify(used.body))
    assert.equal(used.body.title, 'Journal club')
    const copy = (await t.call(someone, 'GET', `/api/presentations/${used.body.id}`)).body
    assert.match(copy.slides[0].elements[0].content, /Meiosis/)
    assert.equal(copy.slides[0].notes, 'Click the figure to show the method')
    assert.equal(copy.slides[0].outlineNotes, undefined)
    // The presented deck doesn't show them
    const page = await (await fetch(`${t.base}/examples/${template.slug}/deck`)).text()
    assert.match(page, /Meiosis/)
    assert.ok(!page.includes('Click the figure'), 'no notes in the deck page')
    assert.ok((await t.call(someone, 'GET', '/api/presentations')).body.some(p => p.id === used.body.id))
    assert.equal((await t.call(admin, 'GET', `/api/presentations/${used.body.id}`)).status, 404, 'theirs, not the admin’s')

    // Only a template that's shown, and only signed in
    assert.notEqual((await t.call(null, 'POST', `/api/landing-templates/${template.slug}/use`)).status, 201)
    assert.equal((await t.call(someone, 'POST', '/api/landing-templates/venn/use')).status, 404)
    assert.equal((await t.call(someone, 'POST', '/api/landing-templates/no-such-one/use')).status, 404)
    assert.equal((await t.call(someone, 'POST', '/api/landing-templates/Bad!/use')).status, 404)
    await t.call(admin, 'PUT', `/api/admin/examples/${template.slug}`, { card: false })
    assert.equal((await t.call(someone, 'POST', `/api/landing-templates/${template.slug}/use`)).status, 404)
    await t.call(admin, 'PUT', `/api/admin/examples/${template.slug}`, { card: true })

    // Within their plan's presentations
    let last
    for (let i = 0; i < 6; i++) {
      last = await t.call(someone, 'POST', `/api/landing-templates/${template.slug}/use`)
      if (last.status !== 201) break
    }
    assert.equal(last.status, 403)
    assert.match(last.body.message, /limited to \d+ presentations/)

    // Back to an example, without the notes; a template again, with them
    await t.call(admin, 'PUT', `/api/admin/examples/${template.slug}`, { kind: 'example' })
    list = await publicList()
    assert.deepEqual(list.templates, [])
    assert.ok(list.examples.some(e => e.slug === template.slug))
    assert.equal((await t.call(null, 'GET', `/api/examples/${template.slug}`)).body.slides[0].notes, '')
    assert.equal((await t.call(admin, 'PUT', `/api/admin/examples/${template.slug}`, { kind: 'template' })).status, 200)
    assert.equal((await t.call(null, 'GET', `/api/examples/${template.slug}`)).body.slides[0].notes, 'Click the figure to show the method')
    await t.call(admin, 'PUT', `/api/admin/examples/${template.slug}`, { kind: 'example' })
    assert.equal((await t.call(admin, 'DELETE', `/api/admin/examples/${template.slug}`)).status, 200)
  })

  it('deletes an added example, but only hides a built-in one', async () => {
    assert.equal((await t.call(admin, 'DELETE', '/api/admin/examples/venn')).status, 400)
    assert.equal((await t.call(admin, 'DELETE', `/api/admin/examples/${added.slug}`)).status, 200)
    assert.equal((await t.call(null, 'GET', `/api/examples/${added.slug}`)).status, 404)
    assert.equal((await fetch(`${t.base}/examples/${added.slug}`)).status, 404)
    assert.equal((await fetch(`${t.base}/examples/${added.slug}/deck`)).status, 404)
  })
})
