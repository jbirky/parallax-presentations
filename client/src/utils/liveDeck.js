// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Live editing, in the cloud version: the presentation's Yjs document (see
// deckDoc.js) kept in step with the server's over a WebSocket, and through it
// with everyone else editing (server/services/collab.js). The document starts
// empty and is filled by the server; the editor never fills it itself, so two
// people opening a presentation at once can't each add its slides.

import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'

export const FLUSH_MS = 30

export const liveUrl = (location = window.location) =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/collab`

// Connects presentation `id`. `token` is a function giving the sign-in token.
//   onSynced(doc)     the document has arrived; called once
//   onStatus(status)  'connecting', 'connected' or 'disconnected'
//   onUnsent(n)       how many changes the server hasn't confirmed yet
//   onRefused()       the server won't let this user in: they were removed,
//                     or the presentation was deleted
// Returns { doc, awareness, disconnect }: awareness is where each tab says
// where it is and what it's doing (utils/presence.js).
export function connectLive({ id, token, onSynced, onStatus = () => {}, onUnsent = () => {}, onRefused = () => {}, url = liveUrl() }) {
  const doc = new Y.Doc()
  let synced = false
  const provider = new HocuspocusProvider({
    url,
    name: id,
    document: doc,
    token,
    // Changes (a drag, typing) and presence within 30 ms go as one message;
    // the last one always goes
    flushDelay: FLUSH_MS,
    onSynced: ({ state }) => {
      if (!state || synced) return
      synced = true
      onSynced(doc)
    },
    onStatus: ({ status }) => onStatus(status),
    onUnsyncedChanges: ({ number }) => onUnsent(number),
    onAuthenticationFailed: () => onRefused(),
  })
  return { doc, awareness: provider.awareness, disconnect: () => provider.destroy() }
}
