// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { useEffect, useState } from 'react'
import { createDeckStore } from './deckDoc'

// The editor's deck in React state, kept in step with its Yjs document
// (deckDoc.js). setDeck takes a deck or an updater, like a useState setter;
// it and the rest are the same functions on every render.
export function useDeckDoc() {
  const [deck, setDeckState] = useState(null)
  const [store] = useState(() => createDeckStore({ onChange: setDeckState }))
  const [actions] = useState(() => ({
    setDeck: update => {
      const prev = store.get()
      const next = store.set(update)
      if (next !== prev) setDeckState(next)
    },
    resetDeck: next => setDeckState(store.reset(next)),
    // Starts from a live document; returns the deck read from it
    attachDeck: (doc, meta) => {
      const deck = store.attach(doc, meta)
      setDeckState(deck)
      return deck
    },
    undo: () => store.undo(),
    redo: () => store.redo(),
    canUndo: () => store.canUndo(),
    canRedo: () => store.canRedo(),
  }))
  // Closing the document ends its undo history; the next setDeck opens a new one
  useEffect(() => () => store.destroy(), [store])
  return { deck, ...actions }
}
