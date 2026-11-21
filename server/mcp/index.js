// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The MCP server behind AI collaborator links (services/ai-links.js), at
// /mcp/<secret>, in the cloud version. An AI chat app that adds a link as a
// connector gets tools for that link's presentation, and nothing else: the
// secret is the sign-in and says which presentation.
//
// One URL, two doors:
// - POST (and a GET asking for an event stream): MCP, served statelessly by
//   the SDK's createMcpHandler, which answers both the 2026-07-28 revision
//   and 2025-era clients
// - any other GET: a page saying what the link is and how to add it, with
//   the deck as text (link-page.js), for a person or an AI reading a link
//   pasted into a chat
//
// The AI reads the deck (get_deck, get_slide) and edits it (edits.js). Its
// edits go into the presentation's live document (collab.js's editDeck), so
// everyone with it open sees them at once, and the link shows in their
// avatars (presence.js). A version is saved before the first edit after a
// quiet spell, so the person can undo a session from History, and an
// element someone has open is never changed under them.

const crypto = require('crypto')
const { Readable } = require('stream')
const { McpServer, createMcpHandler, fromJsonSchema } = require('@modelcontextprotocol/server')
const { findLink } = require('../services/ai-links')
const { deepEqual } = require('../services/deck-doc')
const format = require('./format')
const markdown = require('./markdown')
const { SCHEMAS, DESTRUCTIVE, LAYOUT_LIST, MAX_EDITS, runEdits, EditError } = require('./edits')
const { createPresence } = require('./presence')
const { linkPageHtml, linkPageMarkdown, PAGE_HEADERS } = require('./link-page')
const thumbnails = require('../services/slide-thumbnail')
const { datasetList } = require('./datasets')
const guides = require('./guides')

const GONE = "This AI collaborator link was revoked or has expired, or its presentation is gone. Ask the presentation's owner for a new link."
const INSTRUCTIONS = [
  'This server is one Parallax presentation, shared with you through an AI collaborator link. You can read it and change it; anyone with it open sees your changes as you make them, with you in their avatars under the link\'s name.',
  'Start with get_deck for its outline, and read a slide with get_slide before changing it. Slides are 960×540 pixels. render_slide shows you a slide as presented, to check how it looks after changing it.',
  'Fill slides through their layouts: add_slide takes a layout with its title, subtitle and body, and update_slide changes them. Text in a layout\'s placeholders shrinks to fit, so it needs no positions. add_element and update_element are for anything else.',
  'Text is Markdown, with $…$ for math and [@key] for citations. apply_edits makes several changes at once, all or nothing. import_beamer turns LaTeX Beamer source into slides.',
  'Before your first change in a while, a version of the presentation is saved, so the person can undo your changes from History. A text box someone is typing in is theirs until they finish: if a change is refused for that, try again later or work elsewhere.',
  'Besides text boxes and shapes, add_element adds graphs, equations, tables, code, LaTeX (TikZ), timelines and diagrams (circuit, Feynman, logic, free-body, Venn, timing, geometry), the periodic table and spherical harmonics: read the type\'s guide with get_element_guide first, then check the slide with render_slide. Images, video, molecules, HTML and plugins can\'t be added yet: describe those to the person, who can add them in the editor.',
].join(' ')

// How long without an edit before the next one starts a new session, with a
// version saved first, and how many of those versions a deck keeps
const SESSION_GAP_MS = 30 * 60 * 1000
const KEEP_VERSIONS = 5

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const DELETE = { ...WRITE, destructiveHint: true }
const NO_INPUT = fromJsonSchema({ type: 'object', properties: {}, additionalProperties: false })
const SLIDE_INPUT = fromJsonSchema({
  type: 'object',
  properties: {
    slide: {
      description: 'The slide: its number as shown (1 is the first) or its id from get_deck',
      anyOf: [{ type: 'integer', minimum: 1 }, { type: 'string', minLength: 1, maxLength: 100 }],
    },
  },
  required: ['slide'],
  additionalProperties: false,
})

const GUIDE_INPUT = fromJsonSchema({
  type: 'object',
  properties: { type: { type: 'string', enum: guides.TYPES, description: 'The element type; leave out to list them' } },
  additionalProperties: false,
})

const text = s => ({ content: [{ type: 'text', text: s }] })
const failure = s => ({ content: [{ type: 'text', text: s }], isError: true })

// A tool's work, with the server's own errors logged and not shown
const guarded = (name, work) => async (...args) => {
  try {
    return await work(...args)
  } catch (err) {
    console.error(`AI link tool ${name} failed:`, err.message)
    return failure('Something went wrong on the Parallax server, so that may not have worked. Read the presentation again to check before trying again.')
  }
}

// The write tools: one per operation in edits.js, and apply_edits for
// several at once
const WRITE_TOOLS = [
  ['update_deck', 'Change the presentation', "Change the presentation's title, theme, font, default transition or planned talk length."],
  ['add_slide', 'Add a slide', `Add a slide in a layout, with its placeholders filled: title, subtitle and body as Markdown. It goes after the slide you name (0 for first), or at the end. Layouts and their placeholders: ${LAYOUT_LIST}.`],
  ['update_slide', 'Change a slide', "Change a slide: its layout (its title and text move into the new layout's placeholders), its title, subtitle and body placeholders (Markdown, replacing what's there), its speaker notes, planned minutes or background color."],
  ['move_slide', 'Move a slide', 'Move a slide to after another slide, or to the start with after: 0.'],
  ['delete_slide', 'Delete a slide', 'Delete a slide and everything on it.'],
  ['add_element', 'Add an element', "Add an element to a slide, at a position in pixels on the 960×540 slide: a text box (Markdown, shrinking to fit its box), a shape, or a graph, equation, table, code block, LaTeX picture, timeline or diagram from its spec (or a diagram's template), as get_element_guide describes. For titles and body text, use the slide's layout placeholders instead (add_slide, update_slide)."],
  ['update_element', 'Change an element', "Change one element on a slide, by its id from get_slide: move or resize it, turn it, fade it, replace a text box's text (Markdown) or a shape's label, change a shape's look, or change a graph's, table's or diagram's spec (the fields given replace its own). Images, video, molecules, HTML and plugins can be moved and resized but not changed inside."],
  ['delete_element', 'Delete an element', 'Delete one element from a slide.'],
  ['update_outline', "Change a slide's outline notes", "Change a slide's outline notes (planning notes for the talk, which never show on the slide), its planned minutes, or its section. Never changes what's on the slide."],
  ['import_beamer', 'Add slides from LaTeX Beamer', "Turn LaTeX Beamer source into slides, as the editor's Beamer import does: each frame a slide, with its title, text, math, lists, columns, tables, blocks, code, overlays as steps, and speaker notes from \\note. Give BibTeX for what it cites, and its references join the bibliography. Figures can't come along: they show as empty boxes for the person to fill. Good for a talk you've drafted in LaTeX, or for a person's existing Beamer slides."],
]
const EDITS_INPUT = fromJsonSchema({
  type: 'object',
  properties: {
    edits: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_EDITS,
      description: 'The edits, in order: each an object with op, the name of one of the other change tools, and that tool\'s fields',
      items: { type: 'object', properties: { op: { type: 'string', enum: WRITE_TOOLS.map(([name]) => name) } }, required: ['op'] },
    },
  },
  required: ['edits'],
  additionalProperties: false,
})

// How many slides a link may have drawn in an hour (a slide drawn already,
// and unchanged since, doesn't count), and how many renders may wait
const RENDERS_PER_HOUR = 30
const MAX_RENDER_QUEUE = 4
const KEEP_RENDERS = 40

const noSlide = (deck, slide) => {
  const count = format.shownSlides(deck).length
  return failure(`There's no slide ${JSON.stringify(slide)}. The presentation has ${count} slide${count === 1 ? '' : 's'}: give a number from 1 to ${count}, or an id from get_deck.`)
}

// The server for one request: the link's tools for its presentation.
// loadDeck(link), write(link, edits) and render(link, slide, local) do the
// work (createMcpRoute); local is this server's address for its own
// renderer.
function buildServer(link, { loadDeck, write, touch, render, datasets }, local) {
  const server = new McpServer({ name: 'parallax', title: 'Parallax', version: '1.0.0' }, { instructions: INSTRUCTIONS })
  server.registerTool('get_deck', {
    title: 'Read the presentation outline',
    description: 'The outline of the presentation: its title, size, theme and font, and each slide in the order shown, with its number, id, title, layout, minutes, the kinds of elements on it, and its outline and speaker notes in short. Start here.',
    inputSchema: NO_INPUT,
    annotations: READ_ONLY,
  }, guarded('get_deck', async () => {
    const deck = await loadDeck(link)
    if (!deck) return failure(GONE)
    touch(link, {})
    return text(format.deckOutline(deck))
  }))
  server.registerTool('get_slide', {
    title: 'Read a slide',
    description: "One slide in full: its layout, section, minutes and background, its outline and speaker notes, and each element back to front with its id, type, position and size in pixels, whether it starts hidden, what clicking or hovering on it does (such as tabs showing and hiding panels), and its contents (text as Markdown, with $…$ for math and [@key] for citations). Ends with warnings for elements past the slide's edges and text boxes that overlap while both show.",
    inputSchema: SLIDE_INPUT,
    annotations: READ_ONLY,
  }, guarded('get_slide', async ({ slide }) => {
    const deck = await loadDeck(link)
    if (!deck) return failure(GONE)
    const found = format.findSlide(deck, slide)
    if (!found) return noSlide(deck, slide)
    touch(link, { slide: found.slide.id })
    return text(format.slideDetail(deck, found))
  }))
  server.registerTool('render_slide', {
    title: 'See a slide',
    description: 'A picture of one slide as it looks when presented, with all its steps shown, for checking layout after changing it: text that overflows or wraps badly, overlaps, and how diagrams and graphs came out. It takes several seconds, so check the slides you changed rather than every slide.',
    inputSchema: SLIDE_INPUT,
    annotations: READ_ONLY,
  }, guarded('render_slide', async ({ slide }) => render(link, slide, local)))
  server.registerTool('get_element_guide', {
    title: 'Read how to add an element',
    description: `How to write the spec add_element takes for a graph, equation, table, code block, LaTeX picture, timeline or diagram: its fields, grammar, templates and an example. Without a type, lists the types. Types: ${guides.TYPES.join(', ')}.`,
    inputSchema: GUIDE_INPUT,
    annotations: READ_ONLY,
  }, guarded('get_element_guide', async ({ type }) => text(guides.guideText(type))))
  server.registerTool('list_datasets', {
    title: 'List the datasets',
    description: 'The datasets linked to the presentation, which its graphs can plot: each one\'s name, columns with their types and ranges, row count, where its data comes from and how old it is, and its first rows.',
    inputSchema: NO_INPUT,
    annotations: READ_ONLY,
  }, guarded('list_datasets', async () => datasets(link)))
  for (const [name, title, description] of WRITE_TOOLS) {
    server.registerTool(name, {
      title,
      description,
      inputSchema: fromJsonSchema(SCHEMAS[name]),
      annotations: DESTRUCTIVE.has(name) ? DELETE : WRITE,
    }, guarded(name, async input => write(link, [{ op: name, ...input }])))
  }
  server.registerTool('apply_edits', {
    title: 'Make several changes at once',
    description: `Make several changes in one go, all or nothing: up to ${MAX_EDITS} edits, each an object with op (${WRITE_TOOLS.map(([n]) => n).join(', ')}) and that tool's fields. They run in order, and slide numbers in each are read as the presentation is after the ones before it.`,
    inputSchema: EDITS_INPUT,
    annotations: DELETE,
  }, guarded('apply_edits', async ({ edits }) => write(link, edits)))
  return server
}

// ── Edits ──

class HeldError extends Error {
  constructor(held) { super('held'); this.held = held }
}

function elementsById(deck) {
  const byId = new Map()
  for (const slide of deck.slides || []) for (const el of slide?.elements || []) if (el) byId.set(String(el.id), { el, slide })
  return byId
}

// The elements people hold that next changes or removes
function heldChanges(prev, next, held) {
  if (!held.size) return []
  const before = elementsById(prev)
  const after = elementsById(next)
  const out = []
  for (const [id, userId] of held) {
    const was = before.get(id)
    if (!was) continue
    const now = after.get(id)
    if (!now || !deepEqual(was.el, now.el)) out.push({ id, userId, slide: was.slide })
  }
  return out
}

// Request headers passed on to the SDK
const SKIP_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'cookie', 'keep-alive', 'upgrade'])

// Serves one request through the SDK's fetch-shaped handler
async function serve(handler, req, res, link) {
  const controller = new AbortController()
  res.on('close', () => { if (!res.writableEnded) controller.abort() })
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value != null && !SKIP_HEADERS.has(key)) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const post = req.method === 'POST'
  const request = new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`, {
    method: req.method,
    headers,
    body: post ? JSON.stringify(req.body ?? null) : undefined,
    signal: controller.signal,
  })
  const response = await handler.fetch(request, {
    authInfo: { token: link.id, clientId: link.id, scopes: ['deck:read', 'deck:write'], extra: { link, local: `http://127.0.0.1:${req.socket.localPort}` } },
    ...(post && { parsedBody: req.body }),
  })
  res.status(response.status)
  response.headers.forEach((value, key) => res.setHeader(key, value))
  if (!response.body || req.method === 'HEAD') return res.end()
  const body = Readable.fromWeb(response.body)
  body.on('error', () => res.end())
  body.pipe(res)
}

const wantsStream = req => /text\/event-stream/i.test(req.get('accept') || '')
const wantsMarkdown = req => req.query.format === 'md'
  || (/text\/markdown/i.test(req.get('accept') || '') && !/text\/html/i.test(req.get('accept') || ''))

// The /mcp/:secret route. origin(req): the site's origin, for the link
// written on its page. collab: live editing (services/collab.js), which
// edits go through. deckPage(deck, ownerId): the deck's presented page, as
// share links have it, for render_slide. localDir: where datasets' files
// are kept without R2. The route's leave(linkId) takes a
// revoked link out of the avatars.
function createMcpRoute({ storage, origin, collab, deckPage, localDir, renderer = thumbnails }) {
  const loadDeck = link => storage.getPresentation(link.deckId, link.ownerId)
  const presence = collab ? createPresence(collab) : null
  const touch = (link, where) => presence?.touch(link, where)
  markdown.ready().catch(err => console.error('AI links: loading marked failed:', err.message))

  // A version of the deck before a session's first edit, named for the
  // link, and only the latest KEEP_VERSIONS of those kept, so they don't use
  // up the deck's versions. Returns its name, or null when the link edited
  // within SESSION_GAP_MS.
  async function sessionVersion(link) {
    const { rows } = await storage.query(
      `WITH prev AS (SELECT id, last_edit_at FROM ai_links WHERE id = $1 FOR UPDATE)
       UPDATE ai_links a SET last_edit_at = NOW() FROM prev WHERE a.id = prev.id RETURNING prev.last_edit_at AS prev`,
      [link.id])
    const prev = rows[0]?.prev
    if (prev && Date.now() - new Date(prev).getTime() < SESSION_GAP_MS) return null
    const name = `Before ${link.name}'s edits`
    const saved = await storage.createSnapshot(link.deckId, name, link.ownerId, { aiLinkId: link.id })
    await storage.query(
      `DELETE FROM snapshots WHERE id IN (
         SELECT id FROM snapshots WHERE presentation_id = $1 AND ai_link_id IS NOT NULL ORDER BY created_at DESC OFFSET $2)`,
      [link.deckId, KEEP_VERSIONS])
    return saved ? name : null
  }

  // "Alex is editing …, so nothing was changed"
  async function heldMessage(held, deck) {
    const ids = [...new Set(held.map(h => h.userId))]
    const { rows } = await storage.query('SELECT id, name FROM users WHERE id = ANY($1::uuid[])', [ids]).catch(() => ({ rows: [] }))
    const nameOf = id => rows.find(r => r.id === id)?.name || 'Someone'
    const names = [...new Set(ids.map(nameOf))]
    const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    const what = held.map(h => `\`${h.id}\` on slide ${format.shownSlides(deck).find(s => s.slide.id === h.slide.id)?.number ?? '?'}`).join(', ')
    return `${who} ${names.length === 1 ? 'is' : 'are'} editing ${held.length === 1 ? 'an element' : 'elements'} this would change (${what}), so nothing was changed. Try again in a minute, or leave ${held.length === 1 ? 'it' : 'them'} alone and change the rest.`
  }

  // Makes edits for a link: checked against the deck first, so a mistake
  // costs nothing, then made on the live document, all or nothing
  async function write(link, edits) {
    await markdown.ready()
    const current = await loadDeck(link)
    if (!current) return failure(GONE)
    if (!collab) return failure('Editing through a link needs live editing, which this server doesn\'t have.')
    const datasets = (await storage.getPresentationDatasets(link.deckId).catch(() => null))?.map(d => ({ name: d.alias || d.name, columns: d.columns || [] })) ?? null
    try {
      runEdits(structuredClone(current), edits, { datasets })
    } catch (err) {
      if (err instanceof EditError) return failure(err.message)
      throw err
    }
    const saved = await sessionVersion(link)
    let outcome
    try {
      outcome = await collab.editDeck(link.deckId, (deck, held) => {
        const next = structuredClone(deck)
        const result = runEdits(next, edits, { datasets })
        const blocked = heldChanges(deck, next, held)
        if (blocked.length) throw new HeldError(blocked)
        return { deck: next, result }
      }, { aiLink: link.id })
    } catch (err) {
      if (err instanceof EditError) return failure(err.message)
      if (err instanceof HeldError) return failure(await heldMessage(err.held, current))
      if (err && err.reason === 'Forbidden') return failure(GONE)
      throw err
    }
    touch(link, { ...(outcome.slideId ? { slide: outcome.slideId } : {}), selected: outcome.elementIds })
    const lines = [...outcome.lines]
    if (saved) lines.push('', `First, a version named "${saved}" was saved, so the person can undo these changes from History.`)
    return text(lines.join('\n'))
  }

  // Slides drawn lately, by the deck as it was and the slide, so asking
  // again for one that hasn't changed costs nothing; and when each link last
  // had slides drawn
  const renders = new Map()
  const rendered = new Map()

  async function render(link, slide, local) {
    const deck = await loadDeck(link)
    if (!deck) return failure(GONE)
    const found = format.findSlide(deck, slide)
    if (!found) return noSlide(deck, slide)
    touch(link, { slide: found.slide.id })
    const sw = Number(deck.slideWidth) || 960, sh = Number(deck.slideHeight) || 540
    const width = 960, height = Math.min(1440, Math.max(270, Math.round(960 * sh / sw)))
    const { version, createdAt, updatedAt, expiresAt, ...content } = deck
    const key = `${crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')}|${found.slide.id}`
    const says = `Slide ${found.number} of ${format.shownSlides(deck).length}, as presented, with all its steps shown.`
    const picture = image => ({ content: [{ type: 'text', text: says }, { type: 'image', data: image.toString('base64'), mimeType: 'image/jpeg' }] })
    if (renders.has(key)) {
      const image = renders.get(key)
      renders.delete(key)
      renders.set(key, image)
      return picture(image)
    }
    if (!deckPage || !renderer.chromiumPath()) return failure('This Parallax server can\'t draw slides. Read the slide with get_slide instead.')
    const hour = Date.now() - 60 * 60 * 1000
    const times = (rendered.get(link.id) || []).filter(t => t > hour)
    if (times.length >= RENDERS_PER_HOUR) {
      const wait = Math.ceil((times[0] - hour) / 60000)
      return failure(`That's ${RENDERS_PER_HOUR} slides drawn in the last hour, the most a link can have. Try again in ${wait} minute${wait === 1 ? '' : 's'}, or read the slide with get_slide.`)
    }
    if (renderer.queueLength() >= MAX_RENDER_QUEUE) return failure('The server is busy drawing other slides. Try again in a minute.')
    rendered.set(link.id, [...times, Date.now()])
    let image
    try {
      image = await renderer.renderSlide({ html: await deckPage(deck, link.ownerId), origin: local, slideId: found.slide.id, width, height })
    } catch (err) {
      if (err instanceof renderer.ThumbnailError) return failure(`${err.message.replace(/\.$/, '')}. Read the slide with get_slide instead.`)
      throw err
    }
    renders.set(key, image)
    if (renders.size > KEEP_RENDERS) renders.delete(renders.keys().next().value)
    return picture(image)
  }

  async function datasets(link) {
    if (!(await loadDeck(link))) return failure(GONE)
    return text(await datasetList(storage, link.deckId, { ownerId: link.ownerId, localDir }))
  }

  const tools = { loadDeck, write, touch, render, datasets }
  const handler = createMcpHandler(ctx => buildServer(ctx.authInfo?.extra?.link, tools, ctx.authInfo?.extra?.local), {
    onerror: err => console.error('AI link MCP request failed:', err.message),
  })

  async function sendPage(req, res, link) {
    const deck = await loadDeck(link)
    if (!deck) return res.status(404).json({ error: GONE })
    const page = {
      title: deck.title || 'Untitled',
      linkName: link.name,
      url: `${origin(req)}/mcp/${req.params.secret}`,
      deckText: format.deckMarkdown(deck),
    }
    res.set(PAGE_HEADERS)
    if (wantsMarkdown(req)) return res.type('text/markdown; charset=utf-8').send(linkPageMarkdown(page))
    res.type('html').send(linkPageHtml(page))
  }

  async function mcpRoute(req, res) {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' })
    try {
      const link = await findLink(storage, req.params.secret)
      if (!link) return res.status(404).json({ error: GONE })
      if ((req.method === 'GET' || req.method === 'HEAD') && !wantsStream(req)) return await sendPage(req, res, link)
      if (req.method === 'POST' && !req.is('application/json')) {
        return res.status(415).json({ error: 'MCP requests are JSON (Content-Type: application/json)' })
      }
      await serve(handler, req, res, link)
    } catch (err) {
      console.error('AI link request failed:', err.message)
      if (!res.headersSent) res.status(500).json({ error: 'Something went wrong' })
      else res.end()
    }
  }
  mcpRoute.leave = linkId => presence?.leave(linkId)
  mcpRoute.presence = presence
  return mcpRoute
}

module.exports = { createMcpRoute, buildServer, GONE }
