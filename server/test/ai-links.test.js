// AI collaborator links (services/ai-links.js) and the MCP server behind them
// (server/mcp), through HTTP, against a real Postgres. Needs
// TEST_DATABASE_URL, as collaboration.test.js does; without it, the tests are
// skipped.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { DB, startCloudServer, until } = require('./helpers')
const thumbnails = require('../services/slide-thumbnail')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
let t, call, createDeck, pool

const SLIDES = [
  {
    id: 'slide-title', layout: 'title', minutes: 1, notes: 'Welcome everyone',
    outlineNotes: [{ text: 'Why filters matter', level: 0 }],
    elements: [{ id: 'el-title', type: 'text', x: 80, y: 180, width: 800, height: 120, zIndex: 1, placeholder: 'title', content: '<h2>RC <em>filters</em></h2>' }],
  },
  {
    id: 'slide-cutoff', layout: 'title-content', minutes: 3,
    elements: [
      { id: 'el-head', type: 'text', x: 40, y: 30, width: 880, height: 80, zIndex: 1, content: '<h2>The cutoff</h2>' },
      { id: 'el-body', type: 'text', x: 40, y: 120, width: 880, height: 300, zIndex: 2, content: '<ul><li><p>It is <span data-math-latex="f_c = 1/2\\pi RC" data-math-display="false"></span></p></li><li><p>As shown<sup data-cite="smith2020">[1]</sup></p></li></ul>' },
      { id: 'el-wide', type: 'shape', x: 700, y: 400, width: 400, height: 100, zIndex: 3 },
    ],
  },
]

const secretOf = url => url.slice(url.lastIndexOf('/') + 1)
const makeLink = (who, id, body = { name: 'Claude' }) => call(who, 'POST', `/api/presentations/${id}/ai-links`, body)

// An MCP request the way a 2025-era client sends one: plain JSON-RPC, each
// request on its own (the server keeps no session). The answer may come as
// JSON or as an event stream.
async function rpc(secret, method, params = {}, { notification = false } = {}) {
  const res = await fetch(`${t.base}/mcp/${secret}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(method !== 'initialize' && { 'MCP-Protocol-Version': '2025-11-25' }),
    },
    body: JSON.stringify({ jsonrpc: '2.0', ...(!notification && { id: 1 }), method, params }),
  })
  const text = await res.text()
  let body = null
  if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
    const data = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean)
    body = data.length ? JSON.parse(data[data.length - 1]) : null
  } else {
    try { body = JSON.parse(text) } catch {}
  }
  return { status: res.status, body, headers: res.headers }
}
const initialize = secret => rpc(secret, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
const callTool = (secret, name, args = {}) => rpc(secret, 'tools/call', { name, arguments: args })
const toolText = res => res.body.result.content.map(c => c.text).join('\n')

// A browser with presentation `id` open as `who`, as live.test.js connects
const providers = []
function openLive(who, id) {
  const Y = require('yjs')
  const { HocuspocusProvider } = require('@hocuspocus/provider')
  const doc = new Y.Doc()
  const events = []
  return new Promise(resolve => {
    const provider = new HocuspocusProvider({
      url: `${t.base.replace('http', 'ws')}/collab`, name: id, document: doc, token: who,
      onSynced: () => resolve({ provider, doc, events, deck: () => require('../services/deck-doc').readDeck(doc) }),
      onClose: () => events.push('closed'),
    })
    providers.push(provider)
  })
}
// The AI links a browser sees in its avatars
const aiHere = live => [...live.provider.awareness.getStates().values()].filter(s => s && s.ai)

describe('AI collaborator links', { skip }, () => {
  before(async () => {
    t = await startCloudServer()
    ;({ call, createDeck, pool } = t)
  })
  after(async () => {
    for (const provider of providers) provider.destroy()
    await t?.stop()
  })

  it('lets the owner make a link, shown once, lasting 30 days', async () => {
    const owner = t.user('owner')
    const id = await createDeck(owner, 'Filters talk', { slides: SLIDES })
    const made = await makeLink(owner, id, { name: '  Claude   desktop ' })
    assert.equal(made.status, 201, JSON.stringify(made.body))
    assert.equal(made.body.name, 'Claude desktop')
    // Lower case, so Claude counts it as a custom connector (ai-links.js)
    assert.match(made.body.url, /^https:\/\/parallax-presentations\.com\/mcp\/plx_[a-z2-7]{52}$/)
    assert.equal(made.body.hint, made.body.url.slice(-4))
    const days = (new Date(made.body.expiresAt) - Date.now()) / 864e5
    assert.ok(days > 29.9 && days < 30.1, `expires in ${days} days`)

    const listed = await call(owner, 'GET', `/api/presentations/${id}/ai-links`)
    assert.equal(listed.status, 200)
    assert.deepEqual(listed.body.links.map(l => l.name), ['Claude desktop'])
    assert.equal(listed.body.links[0].url, undefined)
    assert.equal(listed.body.links[0].secret, undefined)
    const { rows } = await pool.query('SELECT token_hash FROM ai_links WHERE id = $1', [made.body.id])
    assert.notEqual(rows[0].token_hash, secretOf(made.body.url))
  })

  it('keeps links to the owner', async () => {
    const owner = t.user('owner2'); const editor = t.user('editor2'); const stranger = t.user('stranger2')
    const id = await createDeck(owner, 'Shared talk')
    await t.invite(owner, id, editor)
    assert.equal((await makeLink(editor, id)).status, 403)
    assert.equal((await call(editor, 'GET', `/api/presentations/${id}/ai-links`)).status, 403)
    assert.equal((await makeLink(stranger, id)).status, 404)
    const made = await makeLink(owner, id)
    assert.equal((await call(editor, 'DELETE', `/api/presentations/${id}/ai-links/${made.body.id}`)).status, 403)
  })

  it('checks the name and lifetime, and how many links a deck has', async () => {
    const owner = t.user('owner3')
    const id = await createDeck(owner, 'Limits')
    assert.equal((await makeLink(owner, id, { name: '   ' })).status, 400)
    assert.equal((await makeLink(owner, id, { name: 'x'.repeat(41) })).status, 400)
    assert.equal((await makeLink(owner, id, { name: 'Claude', days: 5 })).status, 400)
    const never = await makeLink(owner, id, { name: 'Forever', days: null })
    assert.equal(never.status, 201)
    assert.equal(never.body.expiresAt, null)
    const week = await makeLink(owner, id, { name: 'Week', days: 7 })
    assert.ok(Math.abs((new Date(week.body.expiresAt) - Date.now()) / 864e5 - 7) < 0.1)
    for (let i = 0; i < 8; i++) assert.equal((await makeLink(owner, id, { name: `Link ${i}` })).status, 201)
    const full = await makeLink(owner, id, { name: 'One too many' })
    assert.equal(full.status, 409)
    assert.match(full.body.error, /10 AI collaborator links/)
  })

  it('opens as a page with the deck as text and how to connect', async () => {
    const owner = t.user('owner4')
    const id = await createDeck(owner, 'Filters <talk>', { slides: SLIDES })
    const { url } = (await makeLink(owner, id, { name: 'ChatGPT' })).body
    const secret = secretOf(url)
    const res = await fetch(`${t.base}/mcp/${secret}`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /text\/html/)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
    assert.match(res.headers.get('x-robots-tag'), /noindex/)
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/)
    const html = await res.text()
    assert.match(html, /<h1>Filters &lt;talk&gt;<\/h1>/)
    assert.match(html, /made for “ChatGPT”/)
    assert.match(html, /The cutoff/)
    assert.ok(html.includes(`claude mcp add --transport http parallax ${url}`))

    const md = await fetch(`${t.base}/mcp/${secret}?format=md`)
    assert.match(md.headers.get('content-type'), /text\/markdown/)
    const text = await md.text()
    assert.match(text, /^# Filters <talk>/)
    assert.match(text, /\$f_c = 1\/2\\pi RC\$/)
    assert.match(text, /\[@smith2020\]/)

    // A GET for an event stream is MCP's, and the server keeps none
    const stream = await fetch(`${t.base}/mcp/${secret}`, { headers: { Accept: 'text/event-stream' } })
    assert.equal(stream.status, 405)
  })

  it('answers MCP: the tools, the outline and a slide', async () => {
    const owner = t.user('owner5')
    const id = await createDeck(owner, 'Filters talk', { slides: SLIDES })
    const secret = secretOf((await makeLink(owner, id)).body.url)

    const init = await initialize(secret)
    assert.equal(init.status, 200, JSON.stringify(init.body))
    assert.equal(init.body.result.serverInfo.name, 'parallax')
    assert.match(init.body.result.instructions, /You can read it and change it/)
    assert.equal((await rpc(secret, 'notifications/initialized', {}, { notification: true })).status, 202)

    const list = await rpc(secret, 'tools/list')
    assert.equal(list.status, 200, JSON.stringify(list.body))
    const tools = Object.fromEntries(list.body.result.tools.map(tool => [tool.name, tool]))
    assert.deepEqual(Object.keys(tools).sort(), ['add_dataset', 'add_element', 'add_image', 'add_slide', 'apply_edits', 'check_deck', 'deck_preview', 'delete_element', 'delete_slide', 'get_deck', 'get_element_guide',
      'get_slide', 'get_theme', 'import_beamer', 'list_datasets', 'move_slide', 'render_deck', 'render_slide', 'request_upload', 'show_deck', 'update_deck', 'update_element', 'update_outline', 'update_slide'])
    for (const name of ['get_deck', 'get_slide', 'get_theme', 'render_slide', 'render_deck', 'check_deck', 'list_datasets', 'get_element_guide', 'show_deck', 'deck_preview']) assert.equal(tools[name].annotations.readOnlyHint, true)
    assert.ok(tools.add_element.inputSchema.properties.type.enum.includes('circuit'))
    assert.match(toolText(await callTool(secret, 'get_element_guide')), /- \*\*graph\*\* \(Graph\)/)
    assert.match(toolText(await callTool(secret, 'get_element_guide', { type: 'circuit' })), /^# Circuit diagram \(type "circuit"\)[\s\S]*Templates \("template": key, with spec to change it\): lamp \(Switch and lamp\)/)
    assert.equal(tools.add_slide.annotations.readOnlyHint, false)
    assert.equal(tools.add_slide.annotations.destructiveHint, false)
    assert.equal(tools.delete_slide.annotations.destructiveHint, true)
    assert.deepEqual(tools.get_slide.inputSchema.required, ['slide'])
    assert.match(tools.add_slide.inputSchema.properties.layout.description, /two-column \(title, 2 bodies\)/)

    const outline = toolText(await callTool(secret, 'get_deck'))
    assert.match(outline, /^# Filters talk/)
    assert.match(outline, /1\. \*\*RC filters\*\* · `slide-title` · layout title · 1 min · text/)
    assert.match(outline, /2\. \*\*The cutoff\*\* · `slide-cutoff`/)
    assert.match(outline, /Why filters matter/)
    assert.match(outline, /Speaker notes: Welcome everyone/)

    const bySlideId = toolText(await callTool(secret, 'get_slide', { slide: 'slide-cutoff' }))
    const byNumber = toolText(await callTool(secret, 'get_slide', { slide: 2 }))
    assert.equal(bySlideId, byNumber)
    assert.match(byNumber, /## Slide 2 of 2: The cutoff/)
    assert.match(byNumber, /- It is \$f_c = 1\/2\\pi RC\$/)
    assert.match(byNumber, /`el-wide` \(shape\) runs past the slide's right edge by 140 px/)

    const missing = await callTool(secret, 'get_slide', { slide: 9 })
    assert.equal(missing.body.result.isError, true)
    assert.match(toolText(missing), /from 1 to 2/)
    const bad = await callTool(secret, 'get_slide', {})
    assert.ok(bad.body.error || bad.body.result?.isError, JSON.stringify(bad.body))
  })

  it('still takes links made before they were lower case', async () => {
    const owner = t.user('owner-old')
    const id = await createDeck(owner, 'Old link', { slides: SLIDES })
    const made = (await makeLink(owner, id)).body
    const old = 'plx_' + crypto.randomBytes(32).toString('base64url')
    const { hashOf } = require('../services/ai-links')
    await pool.query('UPDATE ai_links SET token_hash = $1, token_hint = $2 WHERE id = $3', [hashOf(old), old.slice(-4), made.id])
    assert.equal((await initialize(old)).status, 200)
    assert.match(toolText(await callTool(old, 'get_deck')), /^# Old link/)
    assert.equal((await initialize(secretOf(made.url))).body?.result, undefined)
  })

  it('reads the deck as it is now', async () => {
    const owner = t.user('owner6')
    const id = await createDeck(owner, 'Before', { slides: SLIDES })
    const secret = secretOf((await makeLink(owner, id)).body.url)
    const deck = (await call(owner, 'GET', `/api/presentations/${id}`)).body
    assert.equal((await call(owner, 'PUT', `/api/presentations/${id}`, { ...deck, title: 'After' })).status, 200)
    assert.match(toolText(await callTool(secret, 'get_deck')), /^# After/)
  })

  it('stops working when revoked, expired, or its deck is deleted, and renews', async () => {
    const owner = t.user('owner7')
    const id = await createDeck(owner, 'Short-lived', { slides: SLIDES })
    const a = (await makeLink(owner, id, { name: 'A' })).body
    const b = (await makeLink(owner, id, { name: 'B', days: 7 })).body

    assert.equal((await fetch(`${t.base}/mcp/${secretOf(a.url)}`)).status, 200)
    // Noted in the background, not in the request's way
    await until(async () => (await pool.query('SELECT last_used_at FROM ai_links WHERE id = $1', [a.id])).rows[0].last_used_at, 'the last use noted')

    assert.equal((await call(owner, 'DELETE', `/api/presentations/${id}/ai-links/${a.id}`)).status, 200)
    const revoked = await fetch(`${t.base}/mcp/${secretOf(a.url)}`)
    assert.equal(revoked.status, 404)
    const gone = (await revoked.json()).error
    assert.equal((await initialize(secretOf(a.url))).status, 404)
    assert.deepEqual((await call(owner, 'GET', `/api/presentations/${id}/ai-links`)).body.links.map(l => l.name), ['B'])

    // Unknown and malformed secrets look the same as a revoked one
    const unknown = await fetch(`${t.base}/mcp/plx_${'A'.repeat(43)}`)
    assert.equal(unknown.status, 404)
    assert.equal((await unknown.json()).error, gone)
    assert.equal((await fetch(`${t.base}/mcp/nonsense`)).status, 404)

    await pool.query("UPDATE ai_links SET expires_at = NOW() - interval '1 minute' WHERE id = $1", [b.id])
    assert.equal((await fetch(`${t.base}/mcp/${secretOf(b.url)}`)).status, 404)
    const listed = (await call(owner, 'GET', `/api/presentations/${id}/ai-links`)).body.links
    assert.equal(listed[0].expired, true)
    const renewed = await call(owner, 'POST', `/api/presentations/${id}/ai-links/${b.id}/renew`, { days: 30 })
    assert.equal(renewed.status, 200)
    assert.equal(renewed.body.expired, false)
    assert.equal((await fetch(`${t.base}/mcp/${secretOf(b.url)}`)).status, 200)

    assert.equal((await call(owner, 'DELETE', `/api/presentations/${id}`)).status, 200)
    assert.equal((await fetch(`${t.base}/mcp/${secretOf(b.url)}`)).status, 404)
  })

  it('edits the deck live, shows the AI in the avatars, and saves a version first', async () => {
    const owner = t.user('owner9')
    const id = await createDeck(owner, 'Filters talk', { slides: SLIDES })
    const link = (await makeLink(owner, id)).body
    const secret = secretOf(link.url)
    const live = await openLive(owner, id)

    const added = await callTool(secret, 'add_slide', { layout: 'title-content', after: 1, title: 'Why it *works*', body: '- Because $x^2$\n- And [@smith2020]' })
    assert.equal(added.body.result.isError, undefined, toolText(added))
    assert.match(toolText(added), /Added slide 2 \(`[0-9a-f-]{36}`\), layout title-content\./)
    assert.match(toolText(added), /a version named "Before Claude's edits" was saved/)

    // The open editor has it at once
    await until(() => live.deck().slides.length === 3, 'the new slide to reach the open editor')
    const slide = live.deck().slides[1]
    const title = slide.elements.find(el => el.placeholder === 'title')
    const body = slide.elements.find(el => el.placeholder === 'body')
    assert.equal(title.content, '<h2>Why it <em>works</em></h2>')
    assert.match(body.content, /^<ul><li><p>Because <span data-math-latex="x\^2"/)
    assert.match(body.content, /<sup data-cite="smith2020"/)

    // with the AI in its avatars, on that slide
    await until(() => aiHere(live).some(s => s.slide === slide.id), 'the AI to show in the avatars')
    assert.deepEqual(aiHere(live)[0].ai, { link: link.id, name: 'Claude' })

    // One version for the session, not one per edit
    const moved = await callTool(secret, 'apply_edits', { edits: [
      { op: 'update_slide', slide: 2, notes: 'Say why' },
      { op: 'move_slide', slide: 2, after: 3 },
      { op: 'update_deck', title: 'RC filters' },
    ] })
    assert.equal(moved.body.result.isError, undefined, toolText(moved))
    assert.doesNotMatch(toolText(moved), /version/)
    await until(() => live.deck().title === 'RC filters', 'the batch to reach the open editor')
    assert.deepEqual(live.deck().slides.map(s => s.notes || ''), ['Welcome everyone', '', 'Say why'])
    const versions = (await call(owner, 'GET', `/api/presentations/${id}/snapshots`)).body
    assert.deepEqual(versions.map(v => v.name), ["Before Claude's edits"])
    assert.equal(versions[0].slideCount, 2)

    // and the reading tools see the edits
    assert.match(toolText(await callTool(secret, 'get_deck')), /^# RC filters[\s\S]*3\. \*\*Why it works\*\* · `[0-9a-f-]{36}`[\s\S]*Speaker notes: Say why/)
    // Revoked, it leaves the avatars
    assert.equal((await call(owner, 'DELETE', `/api/presentations/${id}/ai-links/${link.id}`)).status, 200)
    await until(() => !aiHere(live).length, 'the AI to leave the avatars')
  })

  it('changes nothing when an edit is wrong, and says what to fix', async () => {
    const owner = t.user('owner10')
    const id = await createDeck(owner, 'Careful', { slides: SLIDES })
    const secret = secretOf((await makeLink(owner, id)).body.url)
    const batch = await callTool(secret, 'apply_edits', { edits: [
      { op: 'add_slide', title: 'Fine' },
      { op: 'update_slide', slide: 1, body: '- There is no body here' },
    ] })
    assert.equal(batch.body.result.isError, true)
    assert.match(toolText(batch), /^Edit 2 \(update_slide\): This slide has no body placeholder/)
    const element = await callTool(secret, 'add_element', { slide: 2, type: 'graph' })
    assert.ok(element.body.error || element.body.result.isError)
    const deck = (await call(owner, 'GET', `/api/presentations/${id}`)).body
    assert.equal(deck.slides.length, 2)
    // and saves no version
    assert.deepEqual((await call(owner, 'GET', `/api/presentations/${id}/snapshots`)).body, [])
  })

  it("leaves alone what someone has open, and says who", async () => {
    const owner = t.user('owner11')
    const id = await createDeck(owner, 'Busy', { slides: SLIDES })
    const secret = secretOf((await makeLink(owner, id)).body.url)
    const live = await openLive(owner, id)
    live.provider.awareness.setLocalState({ user: await t.userId(owner), slide: 'slide-cutoff', selected: ['el-body'], editing: 'el-body' })
    await new Promise(resolve => setTimeout(resolve, 200))

    const held = await callTool(secret, 'update_element', { slide: 2, element: 'el-body', text: '- Rewritten' })
    assert.equal(held.body.result.isError, true)
    assert.match(toolText(held), new RegExp(`^${owner} is editing an element this would change \\(\`el-body\` on slide 2\\), so nothing was changed`))
    // Deleting its slide would change it too
    assert.equal((await callTool(secret, 'delete_slide', { slide: 2 })).body.result.isError, true)
    // The rest of the slide is free
    const title = await callTool(secret, 'update_slide', { slide: 2, title: 'The corner frequency' })
    assert.equal(title.body.result.isError, undefined, toolText(title))
    await until(() => live.deck().slides[1].elements[0].content === '<h2>The corner frequency</h2>', 'the free edit to land')
    assert.match(live.deck().slides[1].elements[1].content, /It is/)
  })

  it('closes the connection of a tab that says it is an AI', async () => {
    const owner = t.user('owner12')
    const id = await createDeck(owner, 'Honest', { slides: SLIDES })
    const live = await openLive(owner, id)
    live.provider.awareness.setLocalState({ ai: { link: 'fake', name: 'Claude' }, slide: 'slide-title', selected: [] })
    await until(() => live.events.includes('closed'), 'the connection to be closed')
  })

  it('draws a slide as presented, once until it changes, and says when it cannot', async () => {
    const owner = t.user('owner13')
    const id = await createDeck(owner, 'Pictures', { slides: SLIDES })
    const secret = secretOf((await makeLink(owner, id)).body.url)
    const real = { renderSlide: thumbnails.renderSlide, chromiumPath: thumbnails.chromiumPath }
    const drawn = []
    thumbnails.chromiumPath = () => '/usr/bin/chromium'
    thumbnails.renderSlide = async opts => { drawn.push(opts); return Buffer.from(`picture of ${opts.slideId}`) }
    try {
      const res = await callTool(secret, 'render_slide', { slide: 2 })
      const [words, picture] = res.body.result.content
      assert.equal(words.text, 'Slide 2 of 2, as presented, with all its steps shown.')
      assert.deepEqual([picture.type, picture.mimeType, Buffer.from(picture.data, 'base64').toString()], ['image', 'image/jpeg', 'picture of slide-cutoff'])
      // From the page a share link has, with the server's files where the renderer can reach them
      assert.match(drawn[0].html, /<section data-slide-id="slide-cutoff"/)
      assert.match(drawn[0].origin, /^http:\/\/127\.0\.0\.1:\d+$/)
      assert.deepEqual([drawn[0].width, drawn[0].height], [960, 540])

      await callTool(secret, 'render_slide', { slide: 'slide-cutoff' })
      assert.equal(drawn.length, 1, 'an unchanged slide is not drawn again')
      await callTool(secret, 'update_slide', { slide: 2, notes: 'Changed' })
      await callTool(secret, 'render_slide', { slide: 2 })
      assert.equal(drawn.length, 2, 'a changed deck is drawn again')

      const missing = await callTool(secret, 'render_slide', { slide: 5 })
      assert.equal(missing.body.result.isError, true)
      assert.match(toolText(missing), /from 1 to 2/)

      thumbnails.renderSlide = async () => { throw new thumbnails.ThumbnailError('The slide couldn’t be drawn: Timeout.') }
      const failed = await callTool(secret, 'render_slide', { slide: 1 })
      assert.equal(failed.body.result.isError, true)
      assert.equal(toolText(failed), 'The slide couldn’t be drawn: Timeout. Read the slide with get_slide instead.')

      thumbnails.chromiumPath = () => null
      const none = await callTool(secret, 'render_slide', { slide: 1 })
      assert.equal(none.body.result.isError, true)
      assert.match(toolText(none), /can't draw slides\. Read the slide with get_slide instead/)
    } finally {
      Object.assign(thumbnails, real)
    }
  })

  it('lists the datasets linked to the deck, with their columns and first rows', async () => {
    const owner = t.user('owner14')
    const id = await createDeck(owner, 'Data talk', { slides: SLIDES })
    const secret = secretOf((await makeLink(owner, id)).body.url)
    assert.match(toolText(await callTool(secret, 'list_datasets')), /^No datasets are linked to this presentation\. .*Tools › Datasets…/)

    const boundary = `----parallax${crypto.randomBytes(8).toString('hex')}`
    const csv = 'planet,mass,found\r\nMars,0.107,1659\r\nEarth,1,\r\nKepler-22b,9.1,2011\r\nJupiter,317.8,1610'
    const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nplanets\r\n`
      + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="planets.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`)
    const uploaded = await call(owner, 'POST', '/api/datasets', body, { 'Content-Type': `multipart/form-data; boundary=${boundary}` })
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body))
    assert.equal((await call(owner, 'POST', `/api/presentations/${id}/datasets`, { datasetId: uploaded.body.id })).status, 200)

    const list = toolText(await callTool(secret, 'list_datasets'))
    assert.match(list, /^# Datasets this presentation can use \(1\)/)
    assert.match(list, /## planets\n\n4 rows · from an uploaded file, planets\.csv · data as of \d{4}-\d{2}-\d{2}\./)
    assert.match(list, /\| mass \| float \| 0\.107 to 317\.8 \|/)
    assert.match(list, /\| found \| integer \| 1610 to 2011 \|/)
    assert.match(list, /First 3 rows:\n\n\| planet \| mass \| found \|\n\| --- \| --- \| --- \|\n\| Mars \| 0\.107 \| 1659 \|\n\| Earth \| 1 \|  \|/)

    // A graph's data lines name the deck's datasets and their columns
    const plotted = await callTool(secret, 'add_element', { slide: 2, type: 'graph', spec: { expressions: [{ data: { dataset: 'planets', x: 'found', y: 'mass', mark: 'points' } }], yScale: 'log' } })
    assert.equal(plotted.body.result.isError, undefined, toolText(plotted))
    const wrong = await callTool(secret, 'add_element', { slide: 2, type: 'graph', spec: { expressions: [{ data: { dataset: 'planets', x: 'found', y: 'radius' } }] } })
    assert.equal(wrong.body.result.isError, true)
    assert.match(toolText(wrong), /no column "radius" \(for y\)\. Its columns: planet, mass, found/)
  })

  it('shows the deck in a viewer that follows its changes, from a preview link', async () => {
    const owner = t.user('owner10')
    const id = await createDeck(owner, 'Viewer talk', { slides: SLIDES })
    const link = (await makeLink(owner, id)).body
    const secret = secretOf(link.url)
    // Links name the site's public origin; previews are fetched from this server
    const site = new URL(link.url).origin
    const here = url => t.base + new URL(url).pathname

    // show_deck names the viewer; deck_preview is the viewer's alone
    const tools = Object.fromEntries((await rpc(secret, 'tools/list')).body.result.tools.map(tool => [tool.name, tool]))
    // Its address names the viewer's version, so apps don't keep showing an old page
    const uri = require('../mcp/viewer').VIEWER_URI
    assert.match(uri, /^ui:\/\/parallax\/deck-viewer-[0-9a-f]{10}$/)
    assert.deepEqual(tools.show_deck._meta.ui, { resourceUri: uri })
    assert.deepEqual(tools.deck_preview._meta.ui, { resourceUri: uri, visibility: ['app'] })
    assert.equal(tools.show_deck.inputSchema.required, undefined)

    // The viewer's page, framing pages from this site
    const listed = (await rpc(secret, 'resources/list')).body.result.resources
    assert.deepEqual(listed.map(r => [r.uri, r.mimeType]), [[uri, 'text/html;profile=mcp-app'], ['ui://parallax/deck-viewer', 'text/html;profile=mcp-app']])
    const read = (await rpc(secret, 'resources/read', { uri })).body.result.contents[0]
    const legacy = (await rpc(secret, 'resources/read', { uri: 'ui://parallax/deck-viewer' })).body.result.contents[0]
    assert.equal(legacy.text, read.text, 'the old address gives the current page')
    assert.ok(read.text.includes(`const VERSION = '${uri.slice(-10)}'`))
    assert.equal(read.mimeType, 'text/html;profile=mcp-app')
    assert.deepEqual(read._meta.ui.csp.frameDomains, [site])
    assert.equal(read._meta.ui.csp.resourceDomains[0], site)
    assert.equal(read._meta.ui.csp.connectDomains[0], site)
    for (const d of [...read._meta.ui.csp.resourceDomains, ...read._meta.ui.csp.connectDomains]) assert.match(d, /^https:\/\/[a-z0-9.-]+$/, 'origins only')
    assert.match(read.text, /^<!doctype html>/)
    assert.match(read.text, /'ui\/initialize'/)
    assert.match(read.text, /name: 'deck_preview'/)
    assert.match(read.text, /'ui\/update-model-context'/)
    assert.doesNotMatch(read.text, /https?:\/\//, 'the viewer loads nothing from elsewhere')

    // Before the AI has done anything, the preview says it's nowhere, and
    // asking doesn't put it in the avatars
    const first = (await callTool(secret, 'deck_preview')).body.result
    assert.equal(first.isError, undefined)
    const p = first.structuredContent
    assert.ok(p.url.startsWith(`${site}/ai-preview/${link.id}.`), p.url)
    assert.deepEqual(p.slides, [{ id: 'slide-title', number: 1, title: 'RC filters' }, { id: 'slide-cutoff', number: 2, title: 'The cutoff' }])
    assert.deepEqual([p.title, p.width, p.height, p.ai, p.open, p.editorUrl], ['Viewer talk', 960, 540, null, null, `${site}/dashboard/viewer-talk`])
    assert.equal((await callTool(secret, 'deck_preview')).body.result.structuredContent.version, p.version, 'the same deck, the same version')
    assert.equal((await callTool(secret, 'deck_preview', { slide: 2 })).body.result.structuredContent.open, 'slide-cutoff')
    // How the viewer showed the deck: logged once, never shown
    const logged = []
    const log = console.log
    console.log = (...a) => { if (String(a[0]).startsWith('[mcp viewer]')) logged.push(a.join(' ')); else log(...a) }
    try {
      const probed = (await callTool(secret, 'deck_preview', { probe: { script: 'ok', blocked: ['frame-src x'] } })).body.result
      assert.equal(probed.isError, undefined)
      assert.equal(probed.structuredContent.version, p.version)
      await callTool(secret, 'deck_preview', { probe: { script: 'failed' } })
    } finally { console.log = log }
    assert.equal(logged.length, 1)
    assert.match(logged[0], /"script":"ok"/)
    assert.ok((await callTool(secret, 'deck_preview', { probe: 'not an object' })).body.result?.isError || (await callTool(secret, 'deck_preview', { probe: 'x' })).body.error)

    // show_deck: the outline and the editor; the AI is now on that slide
    const shown = toolText(await callTool(secret, 'show_deck', { slide: 2 }))
    assert.match(shown, /live viewer, at slide 2/)
    assert.ok(shown.includes(`Parallax editor: ${site}/dashboard/viewer-talk`))
    assert.match(shown, /# Viewer talk/)
    assert.equal((await callTool(secret, 'show_deck', { slide: 9 })).body.result.isError, true)
    assert.equal((await callTool(secret, 'deck_preview')).body.result.structuredContent.ai, 'slide-cutoff')

    // The preview: the deck as presented, telling the viewer which slide
    // shows, in a sandbox, and free to be framed
    const page = await fetch(here(p.url))
    assert.equal(page.status, 200)
    assert.match(page.headers.get('content-type'), /text\/html/)
    assert.match(page.headers.get('content-security-policy'), /^sandbox allow-scripts /)
    assert.equal(page.headers.get('x-frame-options'), null)
    assert.equal(page.headers.get('cache-control'), 'no-store')
    const html = await page.text()
    assert.match(html, /Reveal\.initialize/)
    assert.match(html, /parallax-deck-go/)
    assert.match(html, /id="s-slide-cutoff"/)
    assert.match(html, /#fs-btn \{ display: none !important; \}<\/style><\/head>/, 'no Fullscreen button of its own')

    // For the viewer to draw itself where the app won't let it frame the
    // site: the same page, fetched from the app's origin, its links to the
    // site's files made whole
    const inline = await fetch(here(p.url) + '?inline=1', { headers: { Origin: 'https://abc.claudemcpcontent.com' } })
    assert.equal(inline.status, 200)
    assert.equal(inline.headers.get('access-control-allow-origin'), '*')
    const drawn = await inline.text()
    assert.match(drawn, /Reveal\.initialize/)
    assert.match(drawn, /id="s-slide-cutoff"/)
    assert.doesNotMatch(drawn, /["'(=\s]\/(vendor|uploads|examples|api)\//, 'no links to the site left relative')
    if (/["(]\/vendor\//.test(html)) assert.ok(drawn.includes(`${site}/vendor/`))

    // Served before sign-in: a page framed on another site can't follow
    // Clerk's handshake redirect
    const stack = require('../index.js').app._router.stack
    const previewAt = stack.findIndex(layer => layer.route?.path === '/ai-preview/:token')
    assert.ok(previewAt >= 0 && previewAt < stack.findIndex(layer => layer.handle === t.clerkOptions.handler), 'the preview comes before Clerk')

    // A change: a new version
    assert.equal((await callTool(secret, 'update_deck', { title: 'Viewer talk, revised' })).body.result.isError, undefined)
    const after = (await callTool(secret, 'deck_preview')).body.result.structuredContent
    assert.notEqual(after.version, p.version)
    assert.equal(after.title, 'Viewer talk, revised')

    // Wrong, changed and old tokens, and a revoked link's, open nothing
    for (const bad of ['nonsense', `${link.id}.zzzzzz.${'A'.repeat(43)}`, p.url.slice(p.url.lastIndexOf('/') + 1).replace(/.$/, c => (c === 'A' ? 'B' : 'A'))]) {
      assert.equal((await fetch(`${t.base}/ai-preview/${bad}`)).status, 404, bad)
    }
    assert.equal((await call(owner, 'DELETE', `/api/presentations/${id}/ai-links/${link.id}`)).status, 200)
    assert.equal((await fetch(here(p.url))).status, 404)
  })

  it('refuses MCP requests that are not JSON', async () => {
    const owner = t.user('owner8')
    const id = await createDeck(owner, 'Plain')
    const secret = secretOf((await makeLink(owner, id)).body.url)
    const res = await fetch(`${t.base}/mcp/${secret}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' })
    assert.equal(res.status, 415)
  })

  it('reads but doesn\'t change a deck past its owner\'s plan\'s limit', async () => {
    const owner = t.user('owner10')
    await call(owner, 'GET', '/api/me')
    const oldest = await createDeck(owner, 'Oldest', { slides: SLIDES })
    const secret = secretOf((await makeLink(owner, oldest)).body.url)
    // The Free plan keeps three editable: three newer ones make it read-only
    for (const title of ['Newer', 'Newer still', 'Newest']) {
      await new Promise(resolve => setTimeout(resolve, 15))
      await createDeck(owner, title)
    }
    const read = await callTool(secret, 'get_deck')
    assert.equal(read.body.result.isError, undefined, toolText(read))
    const refused = await callTool(secret, 'update_deck', { title: 'Renamed' })
    assert.equal(refused.body.result.isError, true)
    assert.match(toolText(refused), /read-only: the Free plan keeps its owner’s 3 newest presentations editable/)
    assert.equal((await call(owner, 'GET', `/api/presentations/${oldest}`)).body.title, 'Oldest')
  })
})
