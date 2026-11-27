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
//
// In apps that show MCP Apps, show_deck opens the deck viewer (viewer.js)
// in the chat, which follows the AI's changes from /ai-preview/<token>.

const { McpServer, createMcpHandler, fromJsonSchema } = require('@modelcontextprotocol/server')
const { findLink, findLinkById } = require('../services/ai-links')
const deckLocks = require('../services/deck-locks')
const { deepEqual } = require('../services/deck-doc')
const format = require('./format')
const markdown = require('./markdown')
const { SCHEMAS, DESTRUCTIVE, LAYOUTS, LAYOUT_LIST, MAX_EDITS, runEdits, EditError } = require('./edits')
const { createPresence } = require('./presence')
const { linkPageHtml, linkPageMarkdown, PAGE_HEADERS } = require('./link-page')
const thumbnails = require('../services/slide-thumbnail')
const { datasetList } = require('./datasets')
const guides = require('./guides')
const review = require('./review')
const images = require('./images')
const { safeFetch } = require('../services/safe-fetch')
const { planFor } = require('../services/plans')
const { presentationAccess } = require('../services/collaboration')
const viewer = require('./viewer')
const { READ_ONLY, WRITE, DELETE, text, failure, guarded, serve, wantsStream } = require('./common')
const { createAccountRoute } = require('./account')

const GONE = "This AI collaborator link was revoked or has expired, or its presentation is gone. Ask the presentation's owner for a new link."
const INSTRUCTIONS = [
  'This server is one Parallax presentation, shared with you through an AI collaborator link. You can read it and change it; anyone with it open sees your changes as you make them, with you in their avatars under the link\'s name.',
  'Start with get_deck for its outline, and read a slide with get_slide before changing it. Slides are 960×540 pixels. render_slide shows you a slide as presented, to check how it looks after changing it.',
  'Fill slides through their layouts: add_slide takes a layout with its title, subtitle and body, and update_slide changes them. Text in a layout\'s placeholders shrinks to fit, so it needs no positions. add_element and update_element are for anything else.',
  'Text is Markdown, with $…$ for math and [@key] for citations. apply_edits makes several changes at once, all or nothing. import_beamer turns LaTeX Beamer source into slides.',
  'get_theme shows the presentation\'s theme, and what its stylesheet can target; update_deck gives it a theme, text styles, colors of its own (themeColors) and a stylesheet (themeCss), scoped to its slides.',
  'show_deck shows the presentation to the person in the chat, live, in apps that show MCP Apps (claude.ai and ChatGPT among them): call it once when you start changing it, so they can watch your changes land, and it tells you which slide they\'re looking at.',
  'Before your first change in a while, a version of the presentation is saved, so the person can undo your changes from History. A text box someone is typing in is theirs until they finish: if a change is refused for that, try again later or work elsewhere.',
  'Besides text boxes and shapes, add_element adds graphs, equations, tables, code, LaTeX (TikZ), timelines, HTML embeds (your own HTML and JavaScript, such as a JSXGraph or D3 plot) and diagrams (circuit, Feynman, logic, free-body, Venn, timing, geometry), the periodic table and spherical harmonics: read the type\'s guide with get_element_guide first, then check the slide with render_slide. add_image adds a picture from a public https URL, as base64, or from a file sent with request_upload. Video, molecules and plugins can\'t be added yet: describe those to the person, who can add them in the editor.',
].join(' ')

// How long without an edit before the next one starts a new session, with a
// version saved first, and how many of those versions a deck keeps
const SESSION_GAP_MS = 30 * 60 * 1000
const KEEP_VERSIONS = 5

// Tools' inputs, as JSON Schema (fromJsonSchema makes them the SDK's when a
// server registers them; account.js adds a deck to each)
const NO_INPUT = { type: 'object', properties: {}, additionalProperties: false }
const SLIDE_INPUT = ({
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

const UPLOAD_INPUT = ({
  type: 'object',
  properties: {
    filename: { type: 'string', minLength: 1, maxLength: 200, description: `The file's name, such as figure3.png: a picture (${images.IMAGE_EXTENSIONS.join(', ')})` },
  },
  required: ['filename'],
  additionalProperties: false,
})
const IMAGE_INPUT = ({
  type: 'object',
  properties: {
    slide: SLIDE_INPUT.properties.slide,
    upload: { type: 'string', maxLength: 300, description: 'A picture sent with request_upload: the upload path its answer gave, /uploads/…' },
    url: { type: 'string', maxLength: 2000, description: 'A picture on the web, by its https address: the server fetches it once and keeps a copy with the presentation' },
    data: { type: 'string', maxLength: Math.ceil(images.MAX_INLINE_BYTES / 3) * 4 + 4, description: 'A picture as base64 (PNG, JPEG, GIF, WebP or SVG), up to 2 MB: for small pictures you made yourself' },
    alt: { type: 'string', minLength: 1, maxLength: 300, description: 'What the picture shows, for people who can\'t see it' },
    fit: { type: 'string', enum: ['contain', 'cover'], description: 'contain (the whole picture shows, the default) or cover (it fills the box, cropped)' },
    x: { type: 'number', description: 'Left edge, in pixels from the slide\'s left (the slide is 960 wide)' },
    y: { type: 'number', description: 'Top edge, in pixels from the slide\'s top (the slide is 540 tall)' },
    width: { type: 'number', description: 'Width in pixels; with no size, it fills the space under a title, keeping its shape' },
    height: { type: 'number', description: 'Height in pixels' },
  },
  required: ['slide', 'alt'],
  additionalProperties: false,
})

const RANGE_INPUT = ({
  type: 'object',
  properties: {
    from: { type: 'integer', minimum: 1, description: 'The first slide to show, by number (1 when left out)' },
    to: { type: 'integer', minimum: 1, description: 'The last slide to show, by number; at most 30 slides a picture' },
  },
  additionalProperties: false,
})

const SHOW_INPUT_SLIDE = {
  description: 'A slide to open at: its number as shown (1 is the first) or its id from get_deck. Leave out to open at the first slide.',
  anyOf: [{ type: 'integer', minimum: 1 }, { type: 'string', minLength: 1, maxLength: 100 }],
}
const SHOW_INPUT = ({
  type: 'object',
  properties: { slide: SHOW_INPUT_SLIDE },
  additionalProperties: false,
})

// deck_preview's: show_deck's, and once, for the server's log, how the
// viewer showed the deck (deck-viewer.html's report)
const PREVIEW_INPUT = ({
  type: 'object',
  properties: {
    slide: SHOW_INPUT_SLIDE,
    probe: { type: 'object', description: 'For the viewer: how it showed the deck, for the server log' },
    viewer: { type: 'string', maxLength: 40, description: "For the viewer: its version, for the server log" },
  },
  additionalProperties: false,
})

const GUIDE_INPUT = ({
  type: 'object',
  properties: { type: { type: 'string', enum: guides.TYPES, description: 'The element type; leave out to list them' } },
  additionalProperties: false,
})


// How a link's viewer showed the deck in the app, and what the app said it
// allows (deck-viewer.html's report), logged once a link while the server
// runs
// What a link's viewer does, now and then: at most a line a minute a link
const noted = new Map()
function note(link, what) {
  const key = `${link.id} ${what}`
  if (Date.now() - (noted.get(key) || 0) < 60 * 1000) return
  if (noted.size > 2000) noted.clear()
  noted.set(key, Date.now())
  console.log(`[mcp viewer] link ${link.id.slice(0, 8)}: ${what}`)
}

const probed = new Set()
function noteProbe(link, probe) {
  if (probed.has(link.id) || probed.size > 1000) return
  probed.add(link.id)
  let found
  try { found = JSON.stringify(probe).slice(0, 8000) } catch { return }
  console.log(`[mcp viewer] link ${link.id.slice(0, 8)}: how the viewer showed the deck: ${found}`)
}
// What a tool says when its presentation is gone: for a link, that the link
// stopped working; for a token, link.gone (account.js)
const goneOf = link => link.gone || GONE

// The write tools: one per operation in edits.js, and apply_edits for
// several at once
const WRITE_TOOLS = [
  ['update_deck', 'Change the presentation', "Change the presentation's title, theme, font, text styles (the size of every slide's titles, headings and body text, and the headings' font and weight), its own colors over the theme's (themeColors), its stylesheet (themeCss, scoped to its slides: read get_theme first), default transition or planned talk length."],
  ['add_slide', 'Add a slide', `Add a slide in a layout, with its placeholders filled: title, subtitle and body as Markdown. It goes after the slide you name (0 for first), or at the end. Layouts and their placeholders: ${LAYOUT_LIST}.`],
  ['update_slide', 'Change a slide', "Change a slide: its layout (its title and text move into the new layout's placeholders), its title, subtitle and body placeholders (Markdown, replacing what's there), its speaker notes, planned minutes or background color."],
  ['move_slide', 'Move a slide', 'Move a slide to after another slide, or to the start with after: 0.'],
  ['delete_slide', 'Delete a slide', 'Delete a slide and everything on it.'],
  ['add_element', 'Add an element', "Add an element to a slide, at a position in pixels on the 960×540 slide: a text box (Markdown, shrinking to fit its box), a shape, or a graph, equation, table, code block, LaTeX picture, timeline, HTML embed or diagram from its spec (or a diagram's template), as get_element_guide describes. For titles and body text, use the slide's layout placeholders instead (add_slide, update_slide)."],
  ['update_element', 'Change an element', "Change one element on a slide, by its id from get_slide: move or resize it, turn it, fade it, replace a text box's text (Markdown) or a shape's label, change a shape's look, or change a graph's, table's, HTML embed's or diagram's spec (the fields given replace its own). Images, video, molecules and plugins can be moved and resized but not changed inside."],
  ['delete_element', 'Delete an element', 'Delete one element from a slide.'],
  ['update_outline', "Change a slide's outline notes", "Change a slide's outline notes (planning notes for the talk, which never show on the slide), its planned minutes, or its section. Never changes what's on the slide."],
  ['import_beamer', 'Add slides from LaTeX Beamer', "Turn LaTeX Beamer source into slides, as the editor's Beamer import does: each frame a slide, with its title, text, math, lists, columns, tables, blocks, code, overlays as steps, and speaker notes from \\note. Give BibTeX for what it cites, and its references join the bibliography. Figures can't come along: they show as empty boxes for the person to fill. Good for a talk you've drafted in LaTeX, or for a person's existing Beamer slides."],
]
const EDITS_INPUT = ({
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
// render_deck: slides a picture, and pictures a link may have in an hour
const SHEET_SLIDES = 30
const SHEETS_PER_HOUR = 6
const MAX_RENDER_QUEUE = 4
const KEEP_RENDERS = 40

const noSlide = (deck, slide) => {
  const count = format.shownSlides(deck).length
  return failure(`There's no slide ${JSON.stringify(slide)}. The presentation has ${count} slide${count === 1 ? '' : 's'}: give a number from 1 to ${count}, or an id from get_deck.`)
}

// The tools on one presentation, each { name, title, description, input
// (JSON Schema), annotations, _meta, write, run(link, input) }. The link says
// which presentation, and who's asking: an AI collaborator link, or an AI
// access token on one of its person's presentations (account.js). A tool
// marked deckless needs no presentation, and one marked app is for the deck
// viewer, not the AI. loadDeck(link), write(link, edits), render(link, slide,
// local), datasets(link) and preview(link, site, slide) do the work
// (createMcpRoute); local is this server's address for its own renderer, and
// site the site's public origin. With viewer: false (the account server,
// which no MCP App host reaches yet), show_deck gives the editor's link.
function deckTools({ loadDeck, write, touch, render, renderSheet, datasets, preview, requestUpload, addImage }, { local, site, viewer: live = true } = {}) {
  const read = (name, title, description, input, run, more = {}) => ({ name, title, description, input, annotations: READ_ONLY, run, ...more })
  return [
    read('get_deck', 'Read the presentation outline',
      'The outline of the presentation: its title, size, theme and font, and each slide in the order shown, with its number, id, title, layout, minutes, the kinds of elements on it, and its outline and speaker notes in short. Start here.',
      NO_INPUT, async link => {
        const deck = await loadDeck(link)
        if (!deck) return failure(goneOf(link))
        touch(link, {})
        return text(format.deckOutline(deck))
      }),
    read('get_theme', "Read the presentation's theme",
      "The presentation's theme: its base theme, the colors slides show and the deck's own colors, its font and text styles, its stylesheet (themeCss) with any rules left out when it's drawn, and what a stylesheet's rules can target (slides, layouts, text boxes, placeholders and color variables). Read it before setting themeColors or themeCss with update_deck.",
      NO_INPUT, async link => {
        const deck = await loadDeck(link)
        if (!deck) return failure(goneOf(link))
        touch(link, {})
        return text(format.themeText(deck, LAYOUTS))
      }),
    read('get_slide', 'Read a slide',
      "One slide in full: its layout, section, minutes and background, its outline and speaker notes, and each element back to front with its id, type, position and size in pixels, whether it starts hidden, what clicking or hovering on it does (such as tabs showing and hiding panels), and its contents (text as Markdown, with $…$ for math and [@key] for citations). Ends with warnings for elements past the slide's edges and text boxes that overlap while both show.",
      SLIDE_INPUT, async (link, { slide }) => {
        const deck = await loadDeck(link)
        if (!deck) return failure(goneOf(link))
        const found = format.findSlide(deck, slide)
        if (!found) return noSlide(deck, slide)
        touch(link, { slide: found.slide.id })
        return text(format.slideDetail(deck, found))
      }),
    read('render_slide', 'See a slide',
      'A picture of one slide as it looks when presented, with all its steps shown, for checking layout after changing it: text that overflows or wraps badly, overlaps, and how diagrams and graphs came out. It takes several seconds, so check the slides you changed rather than every slide.',
      SLIDE_INPUT, (link, { slide }) => render(link, slide, local)),
    read('render_deck', 'See the whole presentation',
      `A picture of every slide at once, small and numbered, as presented with all their steps shown: for reviewing a deck's flow, consistency and density in one look, before checking single slides closely with render_slide. Up to ${SHEET_SLIDES} slides a picture; give from and to for a longer deck. It takes a few seconds a slide.`,
      RANGE_INPUT, (link, { from, to } = {}) => renderSheet(link, { from, to }, local)),
    read('check_deck', 'Check the presentation',
      "Problems on every slide, found without drawing it: elements past the slide's edges, text boxes that overlap, slides with no title, too many words, text set too small, images without alt text, citations the bibliography doesn't have, content slides without speaker notes, and the slides' minutes against the talk's length. Quick: use it first when reviewing, then look with render_deck.",
      NO_INPUT, async link => {
        const deck = await loadDeck(link)
        if (!deck) return failure(goneOf(link))
        touch(link, {})
        return text(review.checkDeck(deck))
      }),
    live
      ? read('show_deck', 'Show the presentation',
        "Show the presentation to the person, live: in apps that show MCP Apps (claude.ai and ChatGPT among them), a viewer in the chat that follows your changes as you make them and tells you which slide they're looking at. Elsewhere, the person gets a link to open it in the Parallax editor. Returns the outline, as get_deck does. Call it once when you start changing the presentation, or with a slide to show them one.",
        SHOW_INPUT, async (link, { slide } = {}) => {
          const deck = await loadDeck(link)
          if (!deck) return failure(goneOf(link))
          const found = slide != null ? format.findSlide(deck, slide) : null
          if (slide != null && !found) return noSlide(deck, slide)
          touch(link, found ? { slide: found.slide.id } : {})
          note(link, 'show_deck')
          return text([
            `If this app shows MCP Apps, the presentation is showing for the person in a live viewer${found ? `, at slide ${found.number}` : ''}: it updates as you change the presentation.`,
            `Otherwise, they can open it in the Parallax editor: ${viewer.editorUrl(site, deck)}`,
            '',
            format.deckOutline(deck),
          ].join('\n'))
        }, { _meta: { ui: { resourceUri: viewer.VIEWER_URI }, 'ui/resourceUri': viewer.VIEWER_URI } })
      : read('show_deck', 'Show the presentation',
        "A link for the person to open the presentation in the Parallax editor, where they see your changes as you make them, and its outline, as get_deck gives. Give them the link when you start changing a presentation.",
        SHOW_INPUT, async (link, { slide } = {}) => {
          const deck = await loadDeck(link)
          if (!deck) return failure(goneOf(link))
          const found = slide != null ? format.findSlide(deck, slide) : null
          if (slide != null && !found) return noSlide(deck, slide)
          touch(link, found ? { slide: found.slide.id } : {})
          return text([
            `The person can open it in the Parallax editor, and watch your changes land: ${viewer.editorUrl(site, deck)}`,
            '',
            format.deckOutline(deck),
          ].join('\n'))
        }),
    read('deck_preview', 'Preview for the viewer',
      "For the presentation viewer that show_deck opens, not for you: a short-lived link to the presentation as presented, and its version, so the viewer can follow changes.",
      PREVIEW_INPUT, async (link, { slide, probe, viewer: version } = {}) => {
        if (version) note(link, `viewer ${version} opened (the server has ${viewer.VIEWER_VERSION})`)
        if (probe) noteProbe(link, probe)
        return preview(link, site, slide)
      }, { app: true, _meta: { ui: { resourceUri: viewer.VIEWER_URI, visibility: ['app'] } } }),
    read('get_element_guide', 'Read how to add an element',
      `How to write the spec add_element takes for a graph, equation, table, code block, LaTeX picture, timeline, HTML embed or diagram: its fields, grammar, templates and an example. Without a type, lists the types. Types: ${guides.TYPES.join(', ')}.`,
      GUIDE_INPUT, async (link, { type } = {}) => text(guides.guideText(type)), { deckless: true }),
    read('list_datasets', 'List the datasets',
      'The datasets linked to the presentation, which its graphs can plot: each one\'s name, columns with their types and ranges, row count, where its data comes from and how old it is, and its first rows.',
      NO_INPUT, link => datasets(link)),
    {
      name: 'request_upload',
      title: 'Get an address to upload a file',
      description: "A one-time address for sending one picture from your computer to the presentation, good for 10 minutes: in a terminal, `curl -sS -T <file> <address>`. Its answer gives the upload's path, for add_image. For pictures on the web, give add_image their address instead.",
      input: UPLOAD_INPUT,
      annotations: WRITE,
      write: true,
      run: (link, { filename }) => requestUpload(link, filename, site),
    },
    {
      name: 'add_image',
      title: 'Add a picture',
      description: 'Add a picture to a slide, with alt text: one sent with request_upload (upload), one on the web (url, fetched once and kept with the presentation), or a small one as base64 (data). With no size it fills the space under the slide\'s title, keeping its shape. Check it with render_slide.',
      input: IMAGE_INPUT,
      annotations: WRITE,
      write: true,
      run: (link, input) => addImage(link, input),
    },
    ...WRITE_TOOLS.map(([name, title, description]) => ({
      name, title, description, input: SCHEMAS[name],
      annotations: DESTRUCTIVE.has(name) ? DELETE : WRITE,
      write: true,
      run: (link, input) => write(link, [{ op: name, ...input }]),
    })),
    {
      name: 'apply_edits',
      title: 'Make several changes at once',
      description: `Make several changes in one go, all or nothing: up to ${MAX_EDITS} edits, each an object with op (${WRITE_TOOLS.map(([n]) => n).join(', ')}) and that tool's fields. They run in order, and slide numbers in each are read as the presentation is after the ones before it.`,
      input: EDITS_INPUT,
      annotations: DELETE,
      write: true,
      run: (link, { edits }) => write(link, edits),
    },
  ]
}

// The deck viewer's page, as MCP Apps hosts fetch it (show_deck's _meta)
function registerViewer(server, site) {
  server.registerResource('deck-viewer', viewer.VIEWER_URI, {
    title: 'Presentation viewer',
    description: 'The presentation as presented, following the changes the AI makes',
    mimeType: viewer.VIEWER_MIME,
    _meta: viewer.viewerMeta(site),
  }, async () => ({
    contents: [{ uri: viewer.VIEWER_URI, mimeType: viewer.VIEWER_MIME, text: viewer.viewerHtml(), _meta: viewer.viewerMeta(site) }],
  }))
  // The address tools had before it named the viewer's version
  server.registerResource('deck-viewer-legacy', viewer.LEGACY_VIEWER_URI, {
    title: 'Presentation viewer',
    description: 'The presentation as presented, following the changes the AI makes',
    mimeType: viewer.VIEWER_MIME,
    _meta: viewer.viewerMeta(site),
  }, async () => ({
    contents: [{ uri: viewer.LEGACY_VIEWER_URI, mimeType: viewer.VIEWER_MIME, text: viewer.viewerHtml(), _meta: viewer.viewerMeta(site) }],
  }))
}

// The server for one request through a link: the link's tools for its
// presentation, and the deck viewer
function buildServer(link, tools, extra = {}) {
  const server = new McpServer({ name: 'parallax', title: 'Parallax', version: '1.0.0' }, { instructions: INSTRUCTIONS })
  for (const tool of deckTools(tools, extra)) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: fromJsonSchema(tool.input),
      annotations: tool.annotations,
      ...(tool._meta && { _meta: tool._meta }),
    }, guarded(tool.name, async (input = {}) => tool.run(link, input)))
  }
  registerViewer(server, extra.site)
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

const wantsMarkdown = req => req.query.format === 'md'
  || (/text\/markdown/i.test(req.get('accept') || '') && !/text\/html/i.test(req.get('accept') || ''))

// The /mcp/:secret route. origin(req): the site's origin, for the link
// written on its page. collab: live editing (services/collab.js), which
// edits go through. deckPage(deck, ownerId): the deck's presented page, as
// share links have it, for render_slide; with { bridge: true }, for the
// deck viewer, telling the page around it which slide shows. sandbox: the
// Content-Security-Policy a deck's page is served with. localDir: where
// datasets' files are kept without R2. The route's leave(linkId) takes a
// revoked link out of the avatars, and its preview serves the viewer's
// /ai-preview/:token.
function createMcpRoute({ storage, origin, collab, deckPage, sandbox = 'sandbox allow-scripts', localDir, renderer = thumbnails, previews = viewer.previewTokens(), createDeck, uploads, fetchImage = safeFetch }) {
  const loadDeck = link => storage.getPresentation(link.deckId, link.ownerId)
  const presence = collab ? createPresence(collab) : null
  const touch = (link, where) => presence?.touch(link, where)
  markdown.ready().catch(err => console.error('AI links: loading marked failed:', err.message))

  // A version of the deck before a session's first edit, named for the
  // link, and only the latest KEEP_VERSIONS of those kept, so they don't use
  // up the deck's versions. Returns its name, or null when the link edited
  // within SESSION_GAP_MS.
  async function sessionVersion(link) {
    if (link.tokenId) return tokenSessionVersion(link)
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

  // The same for an AI access token (account.js), per presentation it edits
  async function tokenSessionVersion(link) {
    const { rows } = await storage.query(
      `WITH prev AS (SELECT last_edit_at FROM ai_token_edits WHERE token_id = $1 AND presentation_id = $2 FOR UPDATE),
            next AS (INSERT INTO ai_token_edits (token_id, presentation_id, last_edit_at) VALUES ($1, $2, NOW())
                     ON CONFLICT (token_id, presentation_id) DO UPDATE SET last_edit_at = NOW())
       SELECT (SELECT last_edit_at FROM prev) AS prev`,
      [link.tokenId, link.deckId])
    const prev = rows[0]?.prev
    if (prev && Date.now() - new Date(prev).getTime() < SESSION_GAP_MS) return null
    const name = `Before ${link.name}'s edits`
    const saved = await storage.createSnapshot(link.deckId, name, link.ownerId, { aiTokenId: link.tokenId })
    await storage.query(
      `DELETE FROM snapshots WHERE id IN (
         SELECT id FROM snapshots WHERE presentation_id = $1 AND ai_token_id IS NOT NULL ORDER BY created_at DESC OFFSET $2)`,
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
  async function write(link, edits, { internal = false } = {}) {
    // A token that may only read, or on a presentation its person only views
    if (link.readOnly) return failure(link.readOnly)
    await markdown.ready()
    const current = await loadDeck(link)
    if (!current) return failure(goneOf(link))
    // Past its owner's plan's limit, a presentation is read-only (deck-locks.js)
    if (await deckLocks.isDeckLocked(storage, link.deckId)) return failure(deckLocks.lockedMessage(link.ownerPlan, { own: !!link.tokenId && link.userId === link.ownerId }))
    if (!collab) return failure('Editing through a link needs live editing, which this server doesn\'t have.')
    const datasets = (await storage.getPresentationDatasets(link.deckId).catch(() => null))?.map(d => ({ name: d.alias || d.name, columns: d.columns || [] })) ?? null
    try {
      runEdits(structuredClone(current), edits, { datasets, internal })
    } catch (err) {
      if (err instanceof EditError) return failure(err.message)
      throw err
    }
    const saved = await sessionVersion(link)
    let outcome
    try {
      outcome = await collab.editDeck(link.deckId, (deck, held) => {
        const next = structuredClone(deck)
        const result = runEdits(next, edits, { datasets, internal })
        const blocked = heldChanges(deck, next, held)
        if (blocked.length) throw new HeldError(blocked)
        return { deck: next, result }
      }, link.tokenId ? { aiToken: link.tokenId } : { aiLink: link.id })
    } catch (err) {
      if (err instanceof EditError) return failure(err.message)
      if (err instanceof HeldError) return failure(await heldMessage(err.held, current))
      if (err && err.reason === 'Forbidden') return failure(goneOf(link))
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
    if (!deck) return failure(goneOf(link))
    const found = format.findSlide(deck, slide)
    if (!found) return noSlide(deck, slide)
    touch(link, { slide: found.slide.id })
    const sw = Number(deck.slideWidth) || 960, sh = Number(deck.slideHeight) || 540
    const width = 960, height = Math.min(1440, Math.max(270, Math.round(960 * sh / sw)))
    const key = `${viewer.deckVersion(deck)}|${found.slide.id}`
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

  // render_deck's pictures lately, by the deck as it was and the slides, and
  // when each link last had one drawn
  const sheets = new Map()
  const sheeted = new Map()

  async function renderSheet(link, { from, to } = {}, local) {
    const deck = await loadDeck(link)
    if (!deck) return failure(goneOf(link))
    const shown = format.shownSlides(deck)
    if (!shown.length) return failure('The presentation has no slides yet.')
    const first = Math.max(1, from || 1)
    if (first > shown.length) return failure(`The presentation has ${shown.length} slide${shown.length === 1 ? '' : 's'}: from is at most ${shown.length}.`)
    const last = Math.min(shown.length, to || shown.length, first + SHEET_SLIDES - 1)
    if (last < first) return failure('to comes before from.')
    touch(link, {})
    const chosen = shown.slice(first - 1, last)
    const sw = Number(deck.slideWidth) || 960, sh = Number(deck.slideHeight) || 540
    const width = 960, height = Math.min(1440, Math.max(270, Math.round(960 * sh / sw)))
    const more = last < shown.length ? ` Slides ${last + 1}–${shown.length} aren't in it: call again with from ${last + 1}.` : ''
    const says = `Slides ${first}–${last} of ${shown.length}, as presented, with all their steps shown, numbered as get_deck numbers them.${more}`
    const picture = image => ({ content: [{ type: 'text', text: says }, { type: 'image', data: image.toString('base64'), mimeType: 'image/jpeg' }] })
    const key = `${viewer.deckVersion(deck)}|${first}-${last}`
    if (sheets.has(key)) return picture(sheets.get(key))
    if (!deckPage || !renderer.chromiumPath()) return failure('This Parallax server can\'t draw slides. Use check_deck and get_slide instead.')
    const hour = Date.now() - 60 * 60 * 1000
    const times = (sheeted.get(link.id) || []).filter(t => t > hour)
    if (times.length >= SHEETS_PER_HOUR) {
      const wait = Math.ceil((times[0] - hour) / 60000)
      return failure(`That's ${SHEETS_PER_HOUR} pictures of the whole deck in the last hour, the most a link can have. Try again in ${wait} minute${wait === 1 ? '' : 's'}, or draw single slides with render_slide.`)
    }
    if (renderer.queueLength() >= MAX_RENDER_QUEUE) return failure('The server is busy drawing other slides. Try again in a minute.')
    sheeted.set(link.id, [...times, Date.now()])
    let image
    try {
      image = await renderer.renderSheet({
        html: await deckPage(deck, link.ownerId), origin: local, width, height,
        slides: chosen.map(({ slide, number }) => ({ id: slide.id, label: `${number} · ${format.titleOf(slide) || '(no title)'}` })),
      })
    } catch (err) {
      if (err instanceof renderer.ThumbnailError) return failure(`${err.message.replace(/\.$/, '')}. Use check_deck and get_slide instead.`)
      throw err
    }
    sheets.set(key, image)
    if (sheets.size > 8) sheets.delete(sheets.keys().next().value)
    return picture(image)
  }

  // ── Pictures (add_image, request_upload, PUT /mcp/upload/<ticket>) ──
  // uploads, from server/index.js: store({ buffer, filename, deckId,
  // ownerId }) keeps a file with a presentation's uploads and gives its
  // path; exists(deckId, src) says whether a path is one of them; room(access,
  // bytes) says why a file won't fit the plan, or null.
  const tickets = images.uploadTickets()
  // Pictures' sizes in pixels, by their paths, as they were uploaded
  const sizes = new Map()
  const noteSize = (src, info) => {
    if (info.width && info.height) sizes.set(src, { width: info.width, height: info.height })
    if (sizes.size > 2000) sizes.delete(sizes.keys().next().value)
  }
  // The person whose access a link or token has on its presentation
  const accessOf = link => presentationAccess(storage, link.deckId, link.userId || link.ownerId)
  // Why a link or token can't change its presentation now, or null
  async function cantWrite(link) {
    if (link.readOnly) return link.readOnly
    if (await deckLocks.isDeckLocked(storage, link.deckId)) return deckLocks.lockedMessage(link.ownerPlan, { own: !!link.tokenId && link.userId === link.ownerId })
    return null
  }
  const fileLimit = access => Math.min(images.MAX_IMAGE_BYTES, planFor(access.ownerPlan).maxFileBytes || images.MAX_IMAGE_BYTES)
  const megabytes = n => `${Math.round(n / 1024 / 1024 * 10) / 10} MB`

  async function requestUpload(link, filename, site) {
    if (!uploads) return failure('This Parallax server can\'t take uploads through AI tools.')
    if (!(await loadDeck(link))) return failure(goneOf(link))
    const why = await cantWrite(link)
    if (why) return failure(why)
    const ext = require('path').extname(filename).toLowerCase()
    if (!images.IMAGE_EXTENSIONS.includes(ext)) return failure(`request_upload takes pictures: ${images.IMAGE_EXTENSIONS.join(', ')}. Turn a PDF figure into a PNG first (for example pdftoppm -png -r 200).`)
    const access = await accessOf(link)
    if (!access) return failure(goneOf(link))
    const ticket = tickets.make(link.id, { link, access, filename })
    if (!ticket) return failure('There are 20 upload addresses waiting to be used already. Use those, or wait 10 minutes.')
    const address = `${site}/mcp/upload/${ticket}`
    return text([
      `Send the file to this address within 10 minutes, once: up to ${megabytes(fileLimit(access))}.`,
      '',
      `curl -sS -T ${JSON.stringify(filename)} ${address}`,
      '',
      'Its answer is JSON with upload, the path to give add_image, and the picture\'s width and height in pixels.',
    ].join('\n'))
  }

  async function addImage(link, input) {
    if (!uploads) return failure('This Parallax server can\'t take pictures through AI tools.')
    const deck = await loadDeck(link)
    if (!deck) return failure(goneOf(link))
    const sources = ['upload', 'url', 'data'].filter(k => input[k] !== undefined)
    if (sources.length !== 1) return failure('Give the picture one way: upload (from request_upload), url (an https address) or data (base64).')
    if (!format.findSlide(deck, input.slide)) return noSlide(deck, input.slide)
    const why = await cantWrite(link)
    if (why) return failure(why)
    let src
    let size = null
    if (input.upload !== undefined) {
      src = String(input.upload).trim()
      if (!src.startsWith(`/uploads/${link.deckId}/`) || !(await uploads.exists(link.deckId, src))) {
        return failure("That upload isn't one of this presentation's. Send the file with request_upload, then give the upload path its answer gave.")
      }
      size = sizes.get(src) || null
    } else {
      const access = await accessOf(link)
      if (!access) return failure(goneOf(link))
      const limit = fileLimit(access)
      let bytes
      let name = 'image'
      if (input.url !== undefined) {
        let url
        try { url = new URL(input.url) } catch { return failure('url must be an https address.') }
        if (url.protocol !== 'https:') return failure('url must be an https address.')
        name = require('path').basename(url.pathname).replace(/\.[^.]*$/, '') || 'image'
        try {
          const res = await fetchImage(url.href, { maxBytes: limit, totalMs: 20000 })
          if (res.status !== 200) return failure(`${url.host} answered ${res.status} for that address, so there's no picture to add.`)
          bytes = res.body
        } catch (err) {
          return failure(`The picture couldn't be fetched: ${String(err.message || err).split('\n')[0]}`)
        }
      } else {
        bytes = Buffer.from(String(input.data).replace(/^data:[^,]*,/, ''), 'base64')
        if (bytes.length > images.MAX_INLINE_BYTES) return failure('data takes pictures up to 2 MB. Send a bigger one with request_upload.')
      }
      const info = images.imageInfo(bytes)
      if (!info) return failure('That isn\'t a PNG, JPEG, GIF, WebP or SVG picture.')
      const full = await uploads.room(access, bytes.length)
      if (full) return failure(full)
      src = await uploads.store({ buffer: bytes, filename: name.replace(/[^\w.-]+/g, '-').slice(0, 80) + info.ext, deckId: link.deckId, ownerId: access.ownerId })
      noteSize(src, info)
      size = sizes.get(src) || null
    }
    const { slide, alt, fit, x, y, width, height } = input
    return write(link, [{ op: 'add_image', slide, src, alt, ...(fit && { fit }), ...(size && { size }), x, y, width, height }], { internal: true })
  }

  // PUT /mcp/upload/<ticket>: the file a request_upload address is for, as
  // its body (curl -T). Answers JSON: { upload, type, width, height, bytes }.
  async function uploadRoute(req, res) {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' })
    const refuse = (status, error) => {
      res.set('Connection', 'close')
      res.status(status).json({ error })
      req.resume()
    }
    try {
      if (req.method !== 'PUT' && req.method !== 'POST') return refuse(405, 'Send the file with PUT, as curl -T does.')
      const found = tickets.take(req.params.ticket)
      if (!found || !uploads) return refuse(404, 'This upload address was used already, has expired, or never was one. Ask request_upload for a new one.')
      const { link, access, filename } = found
      const length = Number(req.get('content-length'))
      const limit = fileLimit(access)
      if (!length) return refuse(411, 'Send the file with its length, as curl -T does.')
      if (length > limit) return refuse(413, `The file is ${megabytes(length)}; files are limited to ${megabytes(limit)}.`)
      const full = await uploads.room(access, length)
      if (full) return refuse(413, full)
      const chunks = []
      let got = 0
      for await (const chunk of req) {
        got += chunk.length
        if (got > limit) return refuse(413, `Files are limited to ${megabytes(limit)}.`)
        chunks.push(chunk)
      }
      const bytes = Buffer.concat(chunks)
      const info = images.imageInfo(bytes)
      if (!info) return res.status(415).json({ error: 'That isn\'t a PNG, JPEG, GIF, WebP or SVG picture.' })
      if (!(await loadDeck(link))) return res.status(404).json({ error: goneOf(link) })
      const base = require('path').basename(filename).replace(/\.[^.]*$/, '').replace(/[^\w.-]+/g, '-').slice(0, 80) || 'image'
      const src = await uploads.store({ buffer: bytes, filename: base + info.ext, deckId: link.deckId, ownerId: access.ownerId })
      noteSize(src, info)
      res.status(201).json({ upload: src, type: info.mime, width: info.width, height: info.height, bytes: bytes.length })
    } catch (err) {
      console.error('MCP upload failed:', err.message)
      if (!res.headersSent) res.status(500).json({ error: 'Something went wrong' })
    }
  }

  async function datasets(link) {
    if (!(await loadDeck(link))) return failure(goneOf(link))
    return text(await datasetList(storage, link.deckId, { ownerId: link.ownerId, localDir }))
  }

  // For the viewer (deck_preview): a preview link, the deck's version, its
  // slides, and the slide the AI is on while it's working. Not the AI's own
  // request, so the link's avatar isn't touched.
  async function preview(link, site, slide) {
    const deck = await loadDeck(link)
    if (!deck) return failure(goneOf(link))
    const shown = format.shownSlides(deck)
    const ids = new Set(shown.map(s => String(s.slide.id)))
    const aiSlide = presence?.entries.get(link.id)?.state?.slide
    const data = {
      url: `${site}${viewer.PREVIEW_PATH}${previews.make(link.id)}`,
      version: viewer.deckVersion(deck),
      title: deck.title || 'Untitled',
      width: Number(deck.slideWidth) || 960,
      height: Number(deck.slideHeight) || 540,
      slides: shown.map(s => ({ id: String(s.slide.id), number: s.number, title: format.titleOf(s.slide) })),
      editorUrl: viewer.editorUrl(site, deck),
      ai: aiSlide != null && ids.has(String(aiSlide)) ? String(aiSlide) : null,
      open: slide != null ? String(format.findSlide(deck, slide)?.slide.id ?? '') || null : null,
    }
    return { content: [{ type: 'text', text: `A preview of "${data.title}" for the viewer, ${shown.length} slide${shown.length === 1 ? '' : 's'}.` }], structuredContent: data }
  }

  // GET /ai-preview/:token: the deck as presented, for the viewer to frame.
  // Read only, for the link's deck, while the token and the link last. It
  // can be framed anywhere: the app draws the viewer in frames of its own,
  // on origins it picks, and the page changes nothing and shows only what
  // whoever holds the token can open anyway. In its sandbox, as share links'
  // pages are.
  async function previewPage(req, res) {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' })
    res.removeHeader('X-Frame-Options')
    const gone = () => res.status(404).type('text').send('This preview has expired. The viewer gets a new one by itself.')
    try {
      const linkId = previews.check(req.params.token)
      const link = linkId && await findLinkById(storage, linkId)
      if (!link) return gone()
      const deck = await loadDeck(link)
      if (!deck || !deckPage) return gone()
      // ?inline=1: for the viewer to draw itself (deck-viewer.html)
      let html = viewer.forViewer(await deckPage(deck, link.ownerId, { bridge: true }))
      if (req.query.inline === '1') html = viewer.forInline(html, origin(req))
      res.set('Content-Security-Policy', sandbox).type('html').send(html)
    } catch (err) {
      console.error('AI link preview failed:', err.message)
      if (!res.headersSent) res.status(500).type('text').send('Something went wrong')
    }
  }

  const tools = { loadDeck, write, touch, render, renderSheet, datasets, preview, requestUpload, addImage }
  const handler = createMcpHandler(ctx => buildServer(ctx.authInfo?.extra?.link, tools, ctx.authInfo?.extra), {
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
      await serve(handler, req, res, { token: link.id, clientId: link.id, scopes: ['deck:read', 'deck:write'], extra: { link, site: origin(req) } })
    } catch (err) {
      console.error('AI link request failed:', err.message)
      if (!res.headersSent) res.status(500).json({ error: 'Something went wrong' })
      else res.end()
    }
  }
  // /mcp: the account-level server behind AI access tokens (account.js), on
  // the same tools
  const account = createAccountRoute({ storage, tools, deckTools, origin, createDeck })

  mcpRoute.leave = linkId => presence?.leave(linkId)
  mcpRoute.preview = previewPage
  mcpRoute.account = account
  mcpRoute.upload = uploadRoute
  mcpRoute.presence = presence
  return mcpRoute
}

module.exports = { createMcpRoute, buildServer, deckTools, GONE, INSTRUCTIONS }
