// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Live editing, in the cloud version. Each presentation is a Yjs document (the
// deck model in deck-doc.js) that its editors' browsers keep in step over a
// WebSocket at /collab, served by Hocuspocus. The document is the
// presentation: its state is kept in presentations.ydoc, and
// presentations.data is written from it a couple of seconds after a change
// (at most ten while edits keep coming), so everything that reads data
// (export, share links, GitHub, Zenodo, versions) sees the edits.
//
// A document is built from data the first time the presentation is opened
// live; from then on its ydoc is what counts. A save through the HTTP API (a
// guest, a tab that couldn't connect, a restored version) is applied to the
// document, not written over data, so it reaches everyone editing.
//
// Hocuspocus keeps one copy of each open document per server process, which
// is what lets the server build a document from data without two copies
// racing. Running more than one process would need its Redis extension.

const { randomUUID } = require('crypto')
const Y = require('yjs')
const decoding = require('lib0/decoding')
const { WebSocketServer } = require('ws')
const { Hocuspocus, MessageType } = require('@hocuspocus/server')
const { Forbidden } = require('@hocuspocus/common')
const { loadDeck, writeDeck, readDeck, withIds, META_KEYS } = require('./deck-doc')
const { presentationAccess } = require('./collaboration')
const { isValidUUID } = require('../middleware/security')

const PATH = '/collab'
const MAX_MESSAGE_BYTES = 16 * 1024 * 1024
const META = new Set(META_KEYS)
// As in pg-storage: fields kept in columns don't count as a change
const UNSAVED_FIELDS = `'{id,createdAt,updatedAt,expiresAt,version}'::text[]`

// A presentation's data, or a deck saved through the API, as a deck for the
// document: without the server's fields, a slide from before elements given
// its HTML as a text element (as the editor does when it opens one), and
// every slide and element with an id
function deckFromData(data) {
  const deck = {}
  for (const [key, value] of Object.entries(data || {})) if (!META.has(key)) deck[key] = value
  if (Array.isArray(deck.slides)) {
    deck.slides = deck.slides.map(slide => slide && !Array.isArray(slide.elements)
      ? { ...slide, elements: slide.html ? [{ id: randomUUID(), type: 'text', x: 80, y: 100, width: 800, height: 340, zIndex: 1, content: slide.html }] : [] }
      : slide)
  }
  return withIds(deck, randomUUID)
}

// Limits on the WebSocket, so one visitor can't swamp the server. A tab
// sends at most one message per 30 ms window while something changes
// (utils/liveDeck.js), plus its presence.
const LIMITS = {
  connectsPerMinute: 60,        // new WebSockets per visitor (IP)
  messagesPerSecond: 60,        // per connection, averaged over...
  messageBurst: 600,            // ...this many messages
  bytesPerMinute: 64 * 1024 * 1024,
}
const TooManyMessages = { code: 4429, reason: 'Too many messages' }

// Allows `rate` things a second on average, and `burst` at once
function tokenBucket(rate, burst, now = Date.now) {
  let tokens = burst
  let last = now()
  return (cost = 1) => {
    const t = now()
    tokens = Math.min(burst, tokens + (t - last) / 1000 * rate)
    last = t
    if (tokens < cost) return false
    tokens -= cost
    return true
  }
}

// A tab says who it is in its presence (utils/presence.js), and may only
// say it's the user it signed in as. A message that names anyone else is
// refused, which closes the connection.
function checkPresence(rawMessage, userId) {
  const message = decoding.createDecoder(rawMessage)
  decoding.readVarString(message)
  if (decoding.readVarUint(message) !== MessageType.Awareness) return
  const update = decoding.createDecoder(decoding.readVarUint8Array(message))
  const count = decoding.readVarUint(update)
  for (let i = 0; i < count; i++) {
    decoding.readVarUint(update)
    decoding.readVarUint(update)
    const state = JSON.parse(decoding.readVarString(update))
    if (state && state.user != null && state.user !== userId) throw Forbidden
  }
}

// userIdForToken(token): the user a sign-in token is for, or null.
// ipOf(req): who's asking, for the connection limit.
function createCollab({ storage, userIdForToken, ipOf = req => req.socket.remoteAddress, debounce = 2000, maxDebounce = 10000, limits = {} }) {
  limits = { ...LIMITS, ...limits }
  const storeKey = id => `onStoreDocument-${id}`

  // Writes the document to ydoc and data. The version goes up, and
  // updated_at moves, only when the presentation changed.
  async function store(id, document) {
    const deck = readDeck(document)
    const changed = `(title IS DISTINCT FROM $3 OR (data - ${UNSAVED_FIELDS}) IS DISTINCT FROM ($4::jsonb - ${UNSAVED_FIELDS}))`
    await storage.query(
      `UPDATE presentations SET
          ydoc = $2,
          updated_at = CASE WHEN ${changed} THEN NOW() ELSE updated_at END,
          version = CASE WHEN ${changed} THEN version + 1 ELSE version END,
          title = $3, data = $4
        WHERE id = $1 AND is_template = false`,
      [id, Buffer.from(Y.encodeStateAsUpdate(document)), deck.title || 'Untitled', JSON.stringify(deck)]
    )
  }

  const hocuspocus = new Hocuspocus({
    quiet: true,
    debounce,
    maxDebounce,
    async onAuthenticate({ token, documentName }) {
      if (!isValidUUID(documentName)) throw Forbidden
      const userId = token ? await userIdForToken(token).catch(() => null) : null
      if (!userId) throw Forbidden
      const access = await presentationAccess(storage, documentName, userId)
      if (!access) throw Forbidden
      return { userId, role: access.role }
    },
    async onLoadDocument({ documentName, document }) {
      const { rows } = await storage.query(
        'SELECT ydoc, data FROM presentations WHERE id = $1 AND is_template = false', [documentName])
      if (!rows.length) throw Forbidden
      const { ydoc, data } = rows[0]
      if (ydoc) {
        try {
          Y.applyUpdate(document, ydoc)
          return document
        } catch (err) {
          console.error(`Live editing: presentation ${documentName}'s ydoc can't be read, so it's built from data:`, err.message)
        }
      }
      loadDeck(document, deckFromData(data))
      return document
    },
    async onStoreDocument({ documentName, document }) {
      await store(documentName, document)
    },
    async beforeHandleMessage({ update, context }) {
      checkPresence(update, context.userId)
    },
  })

  // Stores a document now if a store is waiting, so reading data gets its edits
  async function flush(id) {
    if (hocuspocus.debouncer.isDebounced(storeKey(id))) await hocuspocus.debouncer.executeNow(storeKey(id))
  }

  // A deck saved through the HTTP API, applied to the presentation's document
  // when it has one (open now, or kept in ydoc): what the save has replaces
  // what the document has, field by field, as saving data always did. With
  // baseVersion, a save from an older version is refused. Returns null when
  // there's no document, for the caller to save data itself; else
  // { conflict: true, version } or { saved: true }.
  async function applySave(id, data, { baseVersion } = {}) {
    if (!hocuspocus.documents.has(id)) {
      const { rows } = await storage.query('SELECT ydoc IS NOT NULL AS live FROM presentations WHERE id = $1', [id])
      if (!rows[0]?.live) return null
    }
    const connection = await hocuspocus.openDirectConnection(id, { server: true })
    try {
      if (Number.isInteger(baseVersion)) {
        await flush(id)
        const { rows } = await storage.query('SELECT version FROM presentations WHERE id = $1', [id])
        if (rows[0]?.version !== baseVersion) return { conflict: true, version: rows[0]?.version }
      }
      await connection.transact(doc => {
        const current = readDeck(doc)
        writeDeck(doc, current, { ...current, ...deckFromData(data) })
      })
    } finally {
      await connection.disconnect()
    }
    return { saved: true }
  }

  // After a presentation is deleted: everyone editing it is disconnected
  function closeDocument(id) {
    hocuspocus.closeConnections(id)
  }

  // After an editor is removed: their open editors are disconnected, and
  // can't reconnect
  function disconnectUser(id, userId) {
    const document = hocuspocus.documents.get(id)
    for (const connection of document?.getConnections() || []) {
      if (connection.context?.userId === userId) connection.close(Forbidden)
    }
  }

  // New connections per visitor in the last minute
  const connects = new Map()
  const sweep = setInterval(() => connects.clear(), 60 * 1000)
  sweep.unref()

  // Serves /collab on an HTTP server
  function attach(server) {
    const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES })
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname !== PATH) return socket.destroy()
      const ip = ipOf(req)
      const count = (connects.get(ip) || 0) + 1
      connects.set(ip, count)
      if (count > limits.connectsPerMinute) {
        socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
        return
      }
      sockets.handleUpgrade(req, socket, head, ws => {
        const client = hocuspocus.handleConnection(ws, new Request(url))
        const messages = tokenBucket(limits.messagesPerSecond, limits.messageBurst)
        const bytes = tokenBucket(limits.bytesPerMinute / 60, limits.bytesPerMinute)
        ws.on('message', data => {
          if (!messages() || !bytes(data.byteLength)) return ws.close(TooManyMessages.code, TooManyMessages.reason)
          client.handleMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
        })
        ws.on('close', (code, reason) => client.handleClose({ code, reason: reason.toString() }))
        ws.on('error', err => console.error('Live editing socket error:', err.message))
      })
    })
    return sockets
  }

  // Before the server stops: every open document stored
  async function flushAll() {
    await Promise.all([...hocuspocus.documents.keys()].map(id => flush(id).catch(err =>
      console.error(`Live editing: storing ${id} on shutdown failed:`, err.message))))
  }

  return { hocuspocus, attach, applySave, flush, flushAll, closeDocument, disconnectUser }
}

module.exports = { createCollab, deckFromData, tokenBucket, PATH }
