// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The deck viewer: an MCP App (io.modelcontextprotocol/ui, the 2026-01-26
// MCP Apps spec) that shows an AI collaborator link's presentation in the
// chat, live, in apps that show MCP Apps (claude.ai and ChatGPT among them).
//
// show_deck (index.js) names the viewer's page, ui://parallax/deck-viewer
// (deck-viewer.html), which the app draws in a sandboxed frame. The page
// frames the presentation as presented, from a short-lived preview link,
// /ai-preview/<token>: read only, and for that link's deck alone. Every few
// seconds it asks deck_preview, a tool only the viewer sees, for the deck's
// version and a fresh link, and reloads when the version changes, at the
// slide the AI changed (or where the person was), so the AI's edits show as
// they land. It tells the AI which slide the person is looking at.
//
// A preview link names the AI link and when it stops working, signed with a
// key this process makes when it starts; the AI link must still work when
// the page is asked for. A restart only means the viewer's next link is
// signed with the new key.

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const VIEWER_URI = 'ui://parallax/deck-viewer'
const VIEWER_MIME = 'text/html;profile=mcp-app'
const PREVIEW_PATH = '/ai-preview/'
const PREVIEW_TTL_MS = 30 * 60 * 1000

let page = null
const viewerHtml = () => page || (page = fs.readFileSync(path.join(__dirname, 'deck-viewer.html'), 'utf8'))

// The resource's metadata for the app: the viewer frames pages from this
// site, and draws its own frame. It may also load files from the site and
// ask it for things, for showing the deck where the app won't frame it
const viewerMeta = origin => ({
  ui: { csp: { frameDomains: [origin], resourceDomains: [origin], connectDomains: [origin] }, prefersBorder: false },
})

// Preview tokens: <link id>.<expiry, seconds in base 36>.<HMAC-SHA256>
const TOKEN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{43})$/
function previewTokens({ key = crypto.randomBytes(32), ttlMs = PREVIEW_TTL_MS, now = Date.now } = {}) {
  const sign = data => crypto.createHmac('sha256', key).update(data).digest('base64url')
  return {
    make(linkId) {
      const data = `${linkId}.${Math.ceil((now() + ttlMs) / 1000).toString(36)}`
      return `${data}.${sign(data)}`
    },
    // The link id a token is for, or null for a token that's wrong or old
    check(token) {
      const m = typeof token === 'string' && TOKEN.exec(token)
      if (!m) return null
      const expected = Buffer.from(sign(`${m[1]}.${m[2]}`))
      const given = Buffer.from(m[3])
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null
      if (parseInt(m[2], 36) * 1000 <= now()) return null
      return m[1]
    },
  }
}

// The deck's version: a hash of what's in it, leaving out what changes on
// every save without changing the deck
function deckVersion(deck) {
  const { version, createdAt, updatedAt, expiresAt, ...content } = deck
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')
}

// The deck's page, for the viewer's frame: without its Fullscreen button,
// which can't work in the app's frames (the viewer asks the app instead)
const FOR_VIEWER = '<style>#fs-btn { display: none !important; }</style>'
const forViewer = html => html.replace('</head>', `${FOR_VIEWER}</head>`)

// The editor, open at a deck, as the app's own address bar has it
// (client/src/App.jsx): /dashboard/<its title, slugified>
const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'
const editorUrl = (origin, deck) => `${origin}/dashboard/${slugify(deck.title)}`

module.exports = {
  VIEWER_URI, VIEWER_MIME, PREVIEW_PATH, PREVIEW_TTL_MS,
  viewerHtml, viewerMeta, previewTokens, deckVersion, forViewer, editorUrl, slugify,
}
