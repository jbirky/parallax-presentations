// AI access tokens (services/ai-tokens.js) and the account-level MCP server
// behind them (server/mcp/account.js), through HTTP, against a real Postgres.
// Needs TEST_DATABASE_URL, as ai-links.test.js does; without it, the tests
// are skipped.

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { png } = require('./pictures')

// add_image's pictures from the web: https://pictures.test/ answers here,
// before the server takes safeFetch (the real one refuses this machine)
const safeFetchModule = require('../services/safe-fetch')
const realSafeFetch = safeFetchModule.safeFetch
safeFetchModule.safeFetch = async (url, opts) => {
  if (url === 'https://pictures.test/chart.png') return { status: 200, headers: {}, body: png(300, 100) }
  if (url === 'https://pictures.test/page.html') return { status: 200, headers: {}, body: Buffer.from('<html></html>') }
  if (url === 'https://pictures.test/missing.png') return { status: 404, headers: {}, body: Buffer.alloc(0) }
  // An app's Client ID Metadata Document, and Clerk's authorization server
  // metadata (server/mcp/oauth.js)
  if (url === 'https://apps.test/claude.json') return { status: 200, headers: {}, body: Buffer.from(JSON.stringify({ client_id: url, client_name: 'Claude' })) }
  if (url === 'https://clerk.parallax.test/.well-known/oauth-authorization-server') {
    return { status: 200, headers: {}, body: Buffer.from(JSON.stringify({ issuer: 'https://clerk.parallax.test', client_id_metadata_document_supported: true })) }
  }
  return realSafeFetch(url, opts)
}
const { DB, startCloudServer, until } = require('./helpers')
const thumbnails = require('../services/slide-thumbnail')

const skip = DB ? false : 'TEST_DATABASE_URL is not set'
let t, call, createDeck, pool

const SLIDES = [
  {
    id: 'slide-title', layout: 'title', minutes: 1,
    elements: [{ id: 'el-title', type: 'text', x: 80, y: 180, width: 800, height: 120, zIndex: 1, placeholder: 'title', content: '<h2>RC filters</h2>' }],
  },
]

const makeToken = (who, body = { name: 'Claude Code' }) => call(who, 'POST', '/api/me/ai-tokens', body)

// An MCP request to /mcp with a token, as ai-links.test.js sends them
async function rpc(secret, method, params = {}, { notification = false } = {}) {
  const res = await fetch(`${t.base}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(secret && { Authorization: `Bearer ${secret}` }),
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

// A browser with presentation `id` open as `who`, as ai-links.test.js opens it
const providers = []
function openLive(who, id) {
  const Y = require('yjs')
  const { HocuspocusProvider } = require('@hocuspocus/provider')
  const doc = new Y.Doc()
  return new Promise(resolve => {
    const provider = new HocuspocusProvider({
      url: `${t.base.replace('http', 'ws')}/collab`, name: id, document: doc, token: who,
      onSynced: () => resolve({ provider, doc, deck: () => require('../services/deck-doc').readDeck(doc) }),
    })
    providers.push(provider)
  })
}
const aiHere = live => [...live.provider.awareness.getStates().values()].filter(s => s && s.ai)

describe('AI access tokens', { skip }, () => {
  before(async () => {
    t = await startCloudServer()
    ;({ call, createDeck, pool } = t)
  })
  after(async () => {
    for (const provider of providers) provider.destroy()
    await t?.stop()
  })

  it('lets a person make a token, shown once, lasting 90 days, to read and write', async () => {
    const me = t.user('maker')
    const made = await makeToken(me, { name: '  Claude   Code ' })
    assert.equal(made.status, 201, JSON.stringify(made.body))
    assert.equal(made.body.name, 'Claude Code')
    assert.match(made.body.secret, /^plx_pat_[a-z2-7]{52}$/)
    assert.equal(made.body.hint, made.body.secret.slice(-4))
    assert.equal(made.body.server, 'https://parallax-presentations.com/mcp')
    assert.deepEqual(made.body.scopes, ['decks:read', 'decks:write'])
    const days = (new Date(made.body.expiresAt) - Date.now()) / 864e5
    assert.ok(days > 89.9 && days < 90.1, `expires in ${days} days`)

    const listed = await call(me, 'GET', '/api/me/ai-tokens')
    assert.equal(listed.status, 200)
    assert.deepEqual(listed.body.tokens.map(x => x.name), ['Claude Code'])
    assert.equal(listed.body.tokens[0].secret, undefined)
    const { rows } = await pool.query('SELECT token_hash FROM ai_tokens WHERE id = $1', [made.body.id])
    assert.notEqual(rows[0].token_hash, made.body.secret)
    // Someone else's list doesn't have it, and they can't revoke it
    const other = t.user('other')
    assert.deepEqual((await call(other, 'GET', '/api/me/ai-tokens')).body.tokens, [])
    assert.equal((await call(other, 'DELETE', `/api/me/ai-tokens/${made.body.id}`)).status, 404)
  })

  it('checks the name, lifetime and scopes, and how many tokens a person has', async () => {
    const me = t.user('limits')
    assert.equal((await makeToken(me, { name: '  ' })).status, 400)
    assert.equal((await makeToken(me, { name: 'x'.repeat(41) })).status, 400)
    assert.equal((await makeToken(me, { name: 'Claude', days: 7 })).status, 400)
    assert.equal((await makeToken(me, { name: 'Claude', days: null })).body.expiresAt != null, true)
    assert.equal((await makeToken(me, { name: 'Claude', scopes: ['everything'] })).status, 400)
    const reader = await makeToken(me, { name: 'Reader', scopes: [], days: 365 })
    assert.deepEqual(reader.body.scopes, ['decks:read'])
    for (let i = 0; i < 8; i++) assert.equal((await makeToken(me, { name: `T${i}` })).status, 201)
    assert.equal((await makeToken(me, { name: 'One too many' })).status, 409)
  })

  it('needs a working token', async () => {
    const none = await rpc(null, 'initialize', {})
    assert.equal(none.status, 401)
    assert.match(none.headers.get('www-authenticate'), /^Bearer/)
    assert.match(none.body.error, /Authorization: Bearer/)
    const wrong = await rpc('plx_pat_' + 'a'.repeat(52), 'initialize', {})
    assert.equal(wrong.status, 401)
    assert.match(wrong.body.error, /revoked or has expired/)

    const me = t.user('checker')
    const { secret, id } = (await makeToken(me)).body
    const checked = await fetch(`${t.base}/mcp`, { headers: { Authorization: `Bearer ${secret}` } })
    assert.equal(checked.status, 200)
    assert.deepEqual(await checked.json(), { server: 'Parallax', token: 'Claude Code', scopes: ['decks:read', 'decks:write'] })

    assert.equal((await call(me, 'DELETE', `/api/me/ai-tokens/${id}`)).status, 200)
    assert.equal((await rpc(secret, 'initialize')).status, 401)
    assert.deepEqual((await call(me, 'GET', '/api/me/ai-tokens')).body.tokens, [])

    const expired = (await makeToken(me, { name: 'Old' })).body
    await pool.query("UPDATE ai_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [expired.id])
    assert.equal((await rpc(expired.secret, 'initialize')).status, 401)
  })

  it('says how an AI chat app signs in, and lets it sign in with OAuth', async () => {
    const meta = await fetch(`${t.base}/.well-known/oauth-protected-resource/mcp`)
    assert.equal(meta.status, 200)
    assert.deepEqual(await meta.json(), {
      resource: 'https://parallax-presentations.com/mcp',
      authorization_servers: ['https://clerk.parallax.test'],
      bearer_methods_supported: ['header'],
      scopes_supported: ['profile', 'email'],
      resource_name: 'Parallax',
      resource_documentation: 'https://parallax-presentations.com/docs/tutorials/ai-agents',
    })
    assert.equal((await fetch(`${t.base}/.well-known/oauth-protected-resource`)).status, 200)
    const server = await (await fetch(`${t.base}/.well-known/oauth-authorization-server`)).json()
    assert.equal(server.issuer, 'https://clerk.parallax.test')

    const none = await rpc(null, 'initialize', {})
    assert.equal(none.status, 401)
    assert.equal(none.headers.get('www-authenticate'), 'Bearer resource_metadata="https://parallax-presentations.com/.well-known/oauth-protected-resource/mcp"')
    const refused = await rpc('oat-not-one', 'initialize', {})
    assert.equal(refused.status, 401)
    assert.match(refused.headers.get('www-authenticate'), /^Bearer error="invalid_token", resource_metadata=/)

    // Someone signing in through Claude for the first time gets an account,
    // and Claude a row under AI access
    const me = t.user('chatter')
    const token = `oat:${me}:https://apps.test/claude.json`
    const init = await initialize(token)
    assert.equal(init.status, 200, JSON.stringify(init.body))
    assert.equal(t.clerkOptions.authenticateRequest.acceptsToken, 'oauth_token')
    assert.equal(t.clerkOptions.authenticateRequest.audience, 'https://parallax-presentations.com/mcp')
    const checked = await fetch(`${t.base}/mcp`, { headers: { Authorization: `Bearer ${token}` } })
    assert.deepEqual(await checked.json(), { server: 'Parallax', token: 'Claude', scopes: ['decks:read', 'decks:write'] })
    const listed = (await call(me, 'GET', '/api/me/ai-tokens')).body
    assert.equal(listed.signIn, true)
    assert.deepEqual(listed.tokens, [])
    assert.deepEqual(listed.apps.map(a => [a.name, a.host, a.off]), [['Claude', 'apps.test', false]])

    // It works as a token does, under its own name
    const made = await callTool(token, 'create_deck', { title: 'From claude.ai' })
    assert.equal(made.body.result.isError, undefined, toolText(made))
    const id = /id, the deck for the other tools: (\S+)/.exec(toolText(made))[1]
    const added = await callTool(token, 'add_slide', { deck: id, layout: 'title-content', title: 'Hello' })
    assert.match(toolText(added), /a version named "Before Claude's edits" was saved/)
    // A client registered with Clerk goes by the name Clerk has for it
    assert.equal((await initialize(`oat:${me}:client_abc`)).status, 200)
    assert.deepEqual((await call(me, 'GET', '/api/me/ai-tokens')).body.apps.map(a => a.name).sort(), ['App client_abc', 'Claude'])

    // Turned off, it can't sign in, until it's allowed again
    const app = listed.apps[0]
    assert.equal((await call(t.user('other'), 'DELETE', `/api/me/ai-tokens/${app.id}`)).status, 404)
    assert.equal((await call(me, 'DELETE', `/api/me/ai-tokens/${app.id}`)).status, 200)
    const off = await rpc(token, 'initialize', {})
    assert.equal(off.status, 403)
    assert.match(off.body.error, /Claude was turned off in Parallax, under AI access/)
    assert.equal((await call(me, 'GET', '/api/me/ai-tokens')).body.apps.find(a => a.id === app.id).off, true)
    assert.equal((await call(me, 'POST', `/api/me/ai-tokens/${app.id}/allow`)).status, 200)
    assert.equal((await initialize(token)).status, 200)
    assert.equal((await call(me, 'POST', `/api/me/ai-tokens/${app.id}/allow`)).status, 404)
  })

  it('answers MCP with the account tools, and the deck tools taking a deck', async () => {
    const { secret } = (await makeToken(t.user('lister'))).body
    const init = await initialize(secret)
    assert.equal(init.status, 200, JSON.stringify(init.body))
    assert.match(init.body.result.instructions, /list_decks lists their presentations/)
    assert.match(init.body.result.instructions, /add_image adds a picture[\s\S]*add_dataset adds data/)
    assert.doesNotMatch(init.body.result.instructions, /Images, video/)
    const tools = (await rpc(secret, 'tools/list')).body.result.tools
    const names = tools.map(x => x.name)
    assert.deepEqual(names.slice(0, 4), ['list_decks', 'create_deck', 'list_templates', 'list_themes'])
    for (const name of ['get_deck', 'get_slide', 'render_slide', 'render_deck', 'check_deck', 'show_deck', 'add_slide', 'apply_edits', 'get_element_guide', 'list_datasets', 'request_upload', 'add_image', 'add_dataset']) assert.ok(names.includes(name), name)
    assert.ok(!names.includes('deck_preview'))
    const byName = Object.fromEntries(tools.map(x => [x.name, x]))
    assert.deepEqual(byName.get_slide.inputSchema.required, ['deck', 'slide'])
    assert.deepEqual(byName.get_deck.inputSchema.required, ['deck'])
    assert.equal(byName.get_element_guide.inputSchema.properties.deck, undefined)
    assert.equal(byName.show_deck._meta, undefined)
    assert.equal(byName.delete_slide.annotations.destructiveHint, true)
  })

  it("lists and opens the person's decks, shared ones too, and no one else's", async () => {
    const me = t.user('reader'); const friend = t.user('friend'); const stranger = t.user('stranger')
    const mine = await createDeck(me, 'Filters talk', { slides: SLIDES })
    const theirs = await createDeck(friend, 'Lasers talk')
    await t.invite(friend, theirs, me)
    const hidden = await createDeck(stranger, 'Secret talk')
    const { secret } = (await makeToken(me)).body

    const list = toolText(await callTool(secret, 'list_decks'))
    assert.match(list, /^2 presentations/)
    assert.match(list, new RegExp(`Lasers talk — id ${theirs} \\(shared by [^,]+, 1 slide, changed \\d{4}-\\d\\d-\\d\\d\\)`))
    assert.match(list, new RegExp(`Filters talk — id ${mine} \\(theirs, 1 slide`))
    assert.doesNotMatch(list, /Secret talk/)
    assert.match(toolText(await callTool(secret, 'list_decks', { query: 'laser' })), /^1 presentation with "laser"/)

    // By id or by title
    assert.match(toolText(await callTool(secret, 'get_deck', { deck: mine })), /^# Filters talk/)
    assert.match(toolText(await callTool(secret, 'get_deck', { deck: 'lasers TALK' })), /^# Lasers talk/)
    const nope = await callTool(secret, 'get_deck', { deck: hidden })
    assert.equal(nope.body.result.isError, true)
    assert.match(toolText(nope), /There's no presentation "[0-9a-f-]{36}" that Claude Code can open/)
    assert.equal((await callTool(secret, 'get_deck', { deck: 'Secret talk' })).body.result.isError, true)
    await createDeck(me, 'Filters talk')
    assert.match(toolText(await callTool(secret, 'get_deck', { deck: 'Filters talk' })), /2 presentations are called "Filters talk". Name one by its id/)
    // A deck tool without a deck is refused by its schema
    assert.equal((await callTool(secret, 'get_deck', {})).body.result.isError, true)
  })

  it('edits a deck live under its name, saving a version first', async () => {
    const me = t.user('editor')
    const id = await createDeck(me, 'Filters talk', { slides: SLIDES })
    const token = (await makeToken(me)).body
    const live = await openLive(me, id)

    const added = await callTool(token.secret, 'add_slide', { deck: id, layout: 'title-content', title: 'The cutoff', body: '- $f_c = 1/2\\pi RC$' })
    assert.equal(added.body.result.isError, undefined, toolText(added))
    assert.match(toolText(added), /a version named "Before Claude Code's edits" was saved/)
    await until(() => live.deck().slides.length === 2, 'the new slide to reach the open editor')
    await until(() => aiHere(live).length === 1, 'the token to show in the avatars')
    assert.deepEqual(aiHere(live)[0].ai, { link: token.id, name: 'Claude Code' })

    const again = await callTool(token.secret, 'update_deck', { deck: id, title: 'RC filters' })
    assert.equal(again.body.result.isError, undefined, toolText(again))
    assert.doesNotMatch(toolText(again), /version/)
    const versions = (await call(me, 'GET', `/api/presentations/${id}/snapshots`)).body
    assert.deepEqual(versions.map(v => v.name), ["Before Claude Code's edits"])
    const { rows } = await pool.query('SELECT ai_token_id FROM snapshots WHERE presentation_id = $1', [id])
    assert.deepEqual(rows.map(r => r.ai_token_id), [token.id])

    // Revoked, it leaves the avatars
    assert.equal((await call(me, 'DELETE', `/api/me/ai-tokens/${token.id}`)).status, 200)
    await until(() => !aiHere(live).length, 'the token to leave the avatars')
  })

  it('changes nothing with a read-only token', async () => {
    const me = t.user('readonly')
    const id = await createDeck(me, 'Filters talk', { slides: SLIDES })
    const { secret } = (await makeToken(me, { name: 'Reader', scopes: ['decks:read'] })).body
    assert.match(toolText(await callTool(secret, 'get_deck', { deck: id })), /^# Filters talk/)
    const refused = await callTool(secret, 'update_deck', { deck: id, title: 'Renamed' })
    assert.equal(refused.body.result.isError, true)
    assert.match(toolText(refused), /can read presentations but not change them/)
    const made = await callTool(secret, 'create_deck', { title: 'New' })
    assert.equal(made.body.result.isError, true)
    assert.equal((await call(me, 'GET', `/api/presentations/${id}`)).body.title, 'Filters talk')
  })

  it('makes decks, blank in a theme or from a template, within the plan', async () => {
    const me = t.user('creator')
    await call(me, 'GET', '/api/me')
    const { secret } = (await makeToken(me)).body
    const made = await callTool(secret, 'create_deck', { title: 'Optics lecture', theme: 'bauhaus' })
    assert.equal(made.body.result.isError, undefined, toolText(made))
    const id = /Its id, the deck for the other tools: ([0-9a-f-]{36})/.exec(toolText(made))[1]
    assert.match(toolText(made), /^Made "Optics lecture", 1 slide, in the Bauhaus theme\./)
    const deck = (await call(me, 'GET', `/api/presentations/${id}`)).body
    assert.equal(deck.title, 'Optics lecture')
    assert.equal(deck.theme, 'bauhaus')
    assert.equal(deck.slides[0].layout, 'title')

    const unknown = await callTool(secret, 'create_deck', { title: 'X', template: 'no-such-template' })
    assert.match(toolText(unknown), /There's no template "no-such-template"/)
    assert.equal((await callTool(secret, 'create_deck', { title: 'X', template: 'a', theme: 'black' })).body.result.isError, true)

    // The Free plan keeps three editable: a fourth would lock the oldest
    await createDeck(me, 'Two')
    await createDeck(me, 'Three')
    const refused = await callTool(secret, 'create_deck', { title: 'Four' })
    assert.equal(refused.body.result.isError, true)
    assert.match(toolText(refused), /has 3 presentations, and the Free plan keeps the 3 newest editable/)
  })

  it('lists the themes and the templates', async () => {
    const { secret } = (await makeToken(t.user('browser'))).body
    const themes = toolText(await callTool(secret, 'list_themes'))
    assert.match(themes, /^\d+ themes, by id:/)
    assert.match(themes, /- bauhaus: Bauhaus, light — Lowercase headings/)
    assert.match(themes, /- black: Black, dark \(a reveal.js theme/)
    const templates = await callTool(secret, 'list_templates')
    assert.equal(templates.body.result.isError, undefined, toolText(templates))
  })

  it('checks a whole deck, and draws it in one picture', async () => {
    const me = t.user('reviewer')
    const id = await createDeck(me, 'Filters talk', { slides: [...SLIDES, { id: 'slide-two', layout: 'title-content', elements: [] }], talkMinutes: 10 })
    const { secret } = (await makeToken(me)).body
    const checked = toolText(await callTool(secret, 'check_deck', { deck: id }))
    assert.match(checked, /problems? found on 2 slides/)
    assert.match(checked, /The slides' minutes add up to 1, against a 10-minute talk/)

    const real = { renderSheet: thumbnails.renderSheet, chromiumPath: thumbnails.chromiumPath }
    const drawn = []
    thumbnails.chromiumPath = () => '/usr/bin/chromium'
    thumbnails.renderSheet = async opts => { drawn.push(opts); return Buffer.from('a sheet') }
    try {
      const res = await callTool(secret, 'render_deck', { deck: id })
      const [words, picture] = res.body.result.content
      assert.equal(words.text, 'Slides 1–2 of 2, as presented, with all their steps shown, numbered as get_deck numbers them.')
      assert.equal(Buffer.from(picture.data, 'base64').toString(), 'a sheet')
      assert.deepEqual(drawn[0].slides, [{ id: 'slide-title', label: '1 · RC filters' }, { id: 'slide-two', label: '2 · (no title)' }])
      assert.match(drawn[0].html, /<section data-slide-id="slide-two"/)
      await callTool(secret, 'render_deck', { deck: id })
      assert.equal(drawn.length, 1, 'an unchanged deck is not drawn again')
      assert.deepEqual((await callTool(secret, 'render_deck', { deck: id, from: 2 })).body.result.content[0].text.slice(0, 15), 'Slides 2–2 of 2')
      assert.match(toolText(await callTool(secret, 'render_deck', { deck: id, from: 3 })), /from is at most 2/)
      thumbnails.chromiumPath = () => null
      assert.match(toolText(await callTool(secret, 'render_deck', { deck: id, to: 1 })), /can't draw slides\. Use check_deck and get_slide instead/)
    } finally {
      Object.assign(thumbnails, real)
    }
  })

  it('takes pictures: uploaded with curl, from the web, or as base64', async () => {
    const me = t.user('pictures')
    const id = await createDeck(me, 'Filters talk', { slides: SLIDES })
    const other = await createDeck(me, 'Other talk', { slides: SLIDES })
    const { secret } = (await makeToken(me)).body

    const asked = await callTool(secret, 'request_upload', { deck: id, filename: 'figure 3.png' })
    assert.equal(asked.body.result.isError, undefined, toolText(asked))
    const address = /curl -sS -T "figure 3.png" (\S+)/.exec(toolText(asked))[1]
    assert.match(address, /^https:\/\/parallax-presentations\.com\/mcp\/upload\/[a-z2-7]{39}$/)
    const local = address.replace('https://parallax-presentations.com', t.base)
    const put = body => fetch(local, { method: 'PUT', body })
    const sent = await put(png(800, 450))
    assert.equal(sent.status, 201)
    const upload = await sent.json()
    assert.match(upload.upload, new RegExp(`^/uploads/${id}/figure-3-?[0-9a-f-]*\\.png$|^/uploads/${id}/[0-9a-f-]+\\.png$`))
    assert.deepEqual([upload.type, upload.width, upload.height], ['image/png', 800, 450])
    assert.equal((await put(png(10, 10))).status, 404, 'an address works once')
    assert.match(toolText(await callTool(secret, 'request_upload', { deck: id, filename: 'paper.pdf' })), /takes pictures.*pdftoppm/)

    // Not a picture: refused, and nothing kept
    const notPicture = /(\S+)$/.exec(toolText(await callTool(secret, 'request_upload', { deck: id, filename: 'x.png' })).split('\n')[2])[1].replace('https://parallax-presentations.com', t.base)
    assert.equal((await fetch(notPicture, { method: 'PUT', body: '%PDF-1.7' })).status, 415)

    const added = await callTool(secret, 'add_image', { deck: id, slide: 1, upload: upload.upload, alt: 'The cutoff, measured' })
    assert.equal(added.body.result.isError, undefined, toolText(added))
    let el = (await call(me, 'GET', `/api/presentations/${id}`)).body.slides[0].elements.find(e => e.type === 'image')
    assert.deepEqual({ src: el.src, alt: el.alt, fit: el.objectFit, w: el.width, h: el.height }, { src: upload.upload, alt: 'The cutoff, measured', fit: 'contain', w: 676, h: 380 })
    // The file is served where the slide looks for it
    assert.equal((await fetch(t.base + upload.upload)).status, 200)

    const elsewhere = await callTool(secret, 'add_image', { deck: other, slide: 1, upload: upload.upload, alt: 'x' })
    assert.match(toolText(elsewhere), /isn't one of this presentation's/)
    assert.match(toolText(await callTool(secret, 'add_image', { deck: id, slide: 1, url: 'https://pictures.test/chart.png', data: 'AA==', alt: 'x' })), /one way/)

    const fetched = await callTool(secret, 'add_image', { deck: id, slide: 1, url: 'https://pictures.test/chart.png', alt: 'A chart', x: 100, y: 200, width: 600 })
    assert.equal(fetched.body.result.isError, undefined, toolText(fetched))
    el = (await call(me, 'GET', `/api/presentations/${id}`)).body.slides[0].elements.filter(e => e.type === 'image')[1]
    assert.match(el.src, new RegExp(`^/uploads/${id}/.+\\.png$`))
    assert.deepEqual([el.x, el.y, el.width, el.height], [100, 200, 600, 200])
    assert.match(toolText(await callTool(secret, 'add_image', { deck: id, slide: 1, url: 'https://pictures.test/page.html', alt: 'x' })), /isn't a PNG, JPEG, GIF, WebP or SVG/)
    assert.match(toolText(await callTool(secret, 'add_image', { deck: id, slide: 1, url: 'https://pictures.test/missing.png', alt: 'x' })), /answered 404/)
    assert.match(toolText(await callTool(secret, 'add_image', { deck: id, slide: 1, url: 'http://pictures.test/chart.png', alt: 'x' })), /https address/)

    const inline = await callTool(secret, 'add_image', { deck: id, slide: 1, data: png(20, 20).toString('base64'), alt: 'A dot' })
    assert.equal(inline.body.result.isError, undefined, toolText(inline))
    assert.match(toolText(await callTool(secret, 'add_image', { deck: id, slide: 9, data: png(20, 20).toString('base64'), alt: 'x' })), /from 1 to 1/)

    // A token that only reads gets no address and adds nothing
    const reader = (await makeToken(me, { name: 'Reader', scopes: ['decks:read'] })).body.secret
    assert.match(toolText(await callTool(reader, 'request_upload', { deck: id, filename: 'a.png' })), /can read presentations but not change them/)
    assert.match(toolText(await callTool(reader, 'add_image', { deck: id, slide: 1, data: png(5, 5).toString('base64'), alt: 'x' })), /can read presentations but not change them/)
  })

  it('adds data as datasets, inline or uploaded, that graphs plot by name', async () => {
    const me = t.user('data')
    const id = await createDeck(me, 'Planets talk', { slides: SLIDES })
    const { secret } = (await makeToken(me)).body
    const csv = 'period,mass\n1.5,0.8\n3.2,1.4\n10.1,2.2\n'
    const added = await callTool(secret, 'add_dataset', { deck: id, name: 'planets', data: csv })
    assert.equal(added.body.result.isError, undefined, toolText(added))
    assert.match(toolText(added), /^Added the dataset "planets" to the presentation\.\n\n## planets\n\n3 rows/)
    assert.match(toolText(added), /\| period \| float \| 1\.5 to 10\.1 \|/)
    // A name already used gets _2, never replacing the person's dataset
    const again = toolText(await callTool(secret, 'add_dataset', { deck: id, name: 'Planets', data: csv }))
    assert.match(again, /^Added the dataset "planets_2" to the presentation \(the name graphs plot it by\)/)
    assert.deepEqual((await call(me, 'GET', `/api/presentations/${id}/datasets`)).body.map(d => d.name).sort(), ['planets', 'planets_2'])
    assert.match(toolText(await callTool(secret, 'list_datasets', { deck: id })), /Datasets this presentation can use \(2\)/)

    // A graph plots it
    const graph = await callTool(secret, 'add_element', { deck: id, slide: 1, type: 'graph', spec: { expressions: [{ data: { dataset: 'planets', x: 'period', y: 'mass', mark: 'points' } }] } })
    assert.equal(graph.body.result.isError, undefined, toolText(graph))

    assert.match(toolText(await callTool(secret, 'add_dataset', { deck: id, name: 'broken', data: '{not json', format: 'json' })), /^The data couldn't be read/)

    // A data file through an upload address becomes a dataset too
    const asked = toolText(await callTool(secret, 'request_upload', { deck: id, filename: 'orbits.csv', name: 'orbits' }))
    assert.match(asked, /Its answer is JSON with dataset/)
    const address = /(\S+)$/.exec(asked.split('\n')[2])[1].replace('https://parallax-presentations.com', t.base)
    const sent = await fetch(address, { method: 'PUT', body: 'a,b\n1,2\n3,4\n' })
    assert.equal(sent.status, 201)
    assert.deepEqual(await sent.json(), { dataset: 'orbits', rows: 2, columns: ['a', 'b'], next: 'Plot it with a Graph data line (get_element_guide with type graph); list_datasets describes it.' })
    assert.match(toolText(await callTool(secret, 'request_upload', { deck: id, filename: 'notes.docx' })), /takes pictures .* and data \(\.csv, \.tsv, \.json\)/)

    const reader = (await makeToken(me, { name: 'Reader', scopes: ['decks:read'] })).body.secret
    assert.match(toolText(await callTool(reader, 'add_dataset', { deck: id, name: 'x', data: csv })), /can read presentations but not change them/)
  })

  it('reads the element guides without a deck', async () => {
    const { secret } = (await makeToken(t.user('guide'))).body
    assert.match(toolText(await callTool(secret, 'get_element_guide', { type: 'circuit' })), /circuit/i)
  })
})
