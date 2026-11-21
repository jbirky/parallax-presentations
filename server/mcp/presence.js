// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// AI collaborator links in the avatars. While a link is in use, the server
// holds a presence state for it in its presentation's live room, beside
// each editor's tab (client/src/utils/presence.js):
//
//   { ai: { link: link id, name: the link's name }, slide: slide id,
//     selected: [the element ids it changed last] }
//
// Tabs show it under the link's name with an AI badge, on the slide the AI
// last read or changed. Only the server can say it's an AI (collab.js
// refuses tabs that do). It leaves IDLE_MS after the link's last request.
//
// Awareness drops a state that isn't renewed within 30 seconds, so it's sent
// again every REFRESH_MS while it stays. A presentation no one has open has
// no room; the state goes in when someone opens it, at the next renewal.

const { randomInt } = require('crypto')
const encoding = require('lib0/encoding')
const { applyAwarenessUpdate } = require('y-protocols/awareness')

const IDLE_MS = 2 * 60 * 1000
const REFRESH_MS = 15 * 1000
const ORIGIN = 'ai-link'

// An awareness update for one client: its id, a clock that only goes up, and
// its state (null for gone)
function awarenessUpdate(clientId, clock, state) {
  const e = encoding.createEncoder()
  encoding.writeVarUint(e, 1)
  encoding.writeVarUint(e, clientId)
  encoding.writeVarUint(e, clock)
  encoding.writeVarString(e, JSON.stringify(state))
  return encoding.toUint8Array(e)
}

function createPresence(collab, { idleMs = IDLE_MS, refreshMs = REFRESH_MS, now = Date.now } = {}) {
  // link id → { deckId, clientId, clock, state, lastActive }
  const entries = new Map()
  let timer = null

  function send(entry, state) {
    entry.clock += 1
    const document = collab.hocuspocus.documents.get(entry.deckId)
    if (document) applyAwarenessUpdate(document.awareness, awarenessUpdate(entry.clientId, entry.clock, state), ORIGIN)
  }

  function leave(linkId) {
    const entry = entries.get(linkId)
    if (!entry) return
    entries.delete(linkId)
    send(entry, null)
    if (!entries.size && timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function renew() {
    const t = now()
    for (const [linkId, entry] of entries) {
      if (t - entry.lastActive >= idleMs) leave(linkId)
      else send(entry, entry.state)
    }
  }

  // The link made a request: it's here, on `slide` if given, with
  // `selected` the elements it just changed. Reading another slide clears
  // what it had changed.
  function touch(link, { slide, selected } = {}) {
    let entry = entries.get(link.id)
    if (entry && entry.deckId !== link.deckId) {
      leave(link.id)
      entry = null
    }
    if (!entry) {
      entry = { deckId: link.deckId, clientId: randomInt(1, 2 ** 31), clock: 0, state: null, lastActive: 0 }
      entries.set(link.id, entry)
    }
    const was = entry.state || { slide: null, selected: [] }
    const nextSlide = slide !== undefined ? slide : was.slide
    entry.state = {
      ai: { link: link.id, name: link.name },
      slide: nextSlide,
      selected: selected !== undefined ? selected : nextSlide === was.slide ? was.selected : [],
    }
    entry.lastActive = now()
    send(entry, entry.state)
    if (!timer) {
      timer = setInterval(renew, refreshMs)
      timer.unref?.()
    }
  }

  // Before the server stops
  function stop() {
    for (const linkId of [...entries.keys()]) leave(linkId)
  }

  return { touch, leave, stop, renew, entries }
}

module.exports = { createPresence, awarenessUpdate, IDLE_MS, REFRESH_MS }
