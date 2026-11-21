// AI collaborator links (services/ai-links.js) and the MCP server behind them
// (server/mcp), through HTTP, against a real Postgres. Needs
// TEST_DATABASE_URL, as collaboration.test.js does; without it, the tests are
// skipped.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { DB, startCloudServer, until } = require('./helpers')

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
    assert.match(made.body.url, /^https:\/\/parallax-presentations\.com\/mcp\/plx_[A-Za-z0-9_-]{43}$/)
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
    assert.deepEqual(Object.keys(tools).sort(), ['add_element', 'add_slide', 'apply_edits', 'delete_element', 'delete_slide', 'get_deck', 'get_slide',
      'move_slide', 'update_deck', 'update_element', 'update_outline', 'update_slide'])
    for (const name of ['get_deck', 'get_slide']) assert.equal(tools[name].annotations.readOnlyHint, true)
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

  it('refuses MCP requests that are not JSON', async () => {
    const owner = t.user('owner8')
    const id = await createDeck(owner, 'Plain')
    const secret = secretOf((await makeLink(owner, id)).body.url)
    const res = await fetch(`${t.base}/mcp/${secret}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' })
    assert.equal(res.status, 415)
  })
})
