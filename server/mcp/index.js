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
// Phase 1 of the plan: reading. The AI can read the deck's outline and its
// slides; editing tools come next.

const { Readable } = require('stream')
const { McpServer, createMcpHandler, fromJsonSchema } = require('@modelcontextprotocol/server')
const { findLink } = require('../services/ai-links')
const format = require('./format')
const { linkPageHtml, linkPageMarkdown, PAGE_HEADERS } = require('./link-page')

const GONE = "This AI collaborator link was revoked or has expired, or its presentation is gone. Ask the presentation's owner for a new link."
const INSTRUCTIONS = [
  'This server is one Parallax presentation, shared with you through an AI collaborator link.',
  'Start with get_deck for its outline, then get_slide for what is on a slide.',
  'For now you can read the presentation but not change it: describe the changes you suggest, and the person can make them in Parallax.',
].join(' ')

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
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

const text = s => ({ content: [{ type: 'text', text: s }] })
const failure = s => ({ content: [{ type: 'text', text: s }], isError: true })

// The server for one request: the link's tools, reading its presentation
function buildServer(link, loadDeck) {
  const server = new McpServer({ name: 'parallax', title: 'Parallax', version: '1.0.0' }, { instructions: INSTRUCTIONS })
  server.registerTool('get_deck', {
    title: 'Read the presentation outline',
    description: 'The outline of the presentation: its title, size, theme and font, and each slide in the order shown, with its number, id, title, layout, minutes, the kinds of elements on it, and its outline and speaker notes in short. Start here.',
    inputSchema: NO_INPUT,
    annotations: READ_ONLY,
  }, async () => {
    const deck = await loadDeck(link)
    return deck ? text(format.deckOutline(deck)) : failure(GONE)
  })
  server.registerTool('get_slide', {
    title: 'Read a slide',
    description: "One slide in full: its layout, section, minutes and background, its outline and speaker notes, and each element back to front with its id, type, position and size in pixels, and contents (text as Markdown, with $…$ for math and [@key] for citations). Ends with warnings for elements past the slide's edges and text boxes that overlap.",
    inputSchema: SLIDE_INPUT,
    annotations: READ_ONLY,
  }, async ({ slide }) => {
    const deck = await loadDeck(link)
    if (!deck) return failure(GONE)
    const found = format.findSlide(deck, slide)
    if (!found) {
      const count = format.shownSlides(deck).length
      return failure(`There's no slide ${JSON.stringify(slide)}. The presentation has ${count} slide${count === 1 ? '' : 's'}: give a number from 1 to ${count}, or an id from get_deck.`)
    }
    return text(format.slideDetail(deck, found))
  })
  return server
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
    authInfo: { token: link.id, clientId: link.id, scopes: ['deck:read'], extra: { link } },
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
// written on its page.
function createMcpRoute({ storage, origin }) {
  const loadDeck = link => storage.getPresentation(link.deckId, link.ownerId)
  const handler = createMcpHandler(ctx => buildServer(ctx.authInfo?.extra?.link, loadDeck), {
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

  return async function mcpRoute(req, res) {
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
}

module.exports = { createMcpRoute, buildServer, GONE }
