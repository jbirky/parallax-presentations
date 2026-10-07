// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The editor's answers to parallax.datasets, which HTML, p5 and plugin
// elements' pages ask of the page around them (utils/deckData.js). They come
// from the same data a deck built here would carry, so an element reads in
// the editor exactly what it will in a presented deck.

import { answerDatasets } from '../utils/deckData'
import { embedDataReady } from '../utils/graphData'

// Whether a message came from a frame on this page
function isOurFrame(win) {
  for (const frame of document.getElementsByTagName('iframe')) if (frame.contentWindow === win) return true
  return false
}

// Answers the calls of the frames on this page; getPresentation() is the deck
// being edited. Returns a function that stops
export function installEmbedDatasets(getPresentation) {
  const handler = async e => {
    const m = e.data
    if (!m || m.source !== 'parallax-datasets' || !e.source || !isOurFrame(e.source)) return
    let reply
    try {
      const store = await embedDataReady(getPresentation())
      reply = answerDatasets(store, m.op, m.name, m.opts)
    } catch (err) {
      reply = { error: err.message || 'The data couldn’t be read' }
    }
    try {
      e.source.postMessage({ source: 'parallax-datasets-reply', id: m.id, result: reply.result, error: reply.error }, '*')
    } catch { /* the frame went away */ }
  }
  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}
