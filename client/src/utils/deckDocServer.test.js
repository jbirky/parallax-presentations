import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import * as Y from 'yjs'
import * as client from './deckDoc'

// The server's copy of the model is CommonJS, with its own copy of yjs; the
// two only ever meet as encoded updates, as over the WebSocket
const require = createRequire(import.meta.url)
const server = require('../../../server/services/deck-doc.js')
const ServerY = require('yjs')
const { serverCopy, SOURCE, TARGET } = require('../../../scripts/copy-deck-doc.js')

const deck = {
  title: 'Talk', theme: 'black', annotationSets: [{ id: 'ink', slides: {} }],
  slides: [
    { id: 's1', notes: 'hi', elements: [{ id: 'e1', type: 'text', x: 1, content: '<p>a</p>' }, { id: 'e2', type: 'shape', x: 2 }] },
    { id: 's2', elements: [] },
  ],
}

describe('the server’s copy of the deck model', () => {
  it('is up to date (if not, run node scripts/copy-deck-doc.js)', () => {
    expect(readFileSync(TARGET, 'utf8')).toBe(serverCopy(readFileSync(SOURCE, 'utf8')))
  })

  it('reads a document the editor wrote', () => {
    const doc = new Y.Doc()
    client.loadDeck(doc, deck)
    client.writeDeck(doc, client.readDeck(doc), { ...deck, title: 'Edited' })
    const serverDoc = new ServerY.Doc()
    ServerY.applyUpdate(serverDoc, Y.encodeStateAsUpdate(doc))
    expect(server.readDeck(serverDoc)).toEqual({ ...deck, title: 'Edited' })
  })

  it('writes changes the editor reads, merged with the editor’s own', () => {
    const doc = new Y.Doc()
    client.loadDeck(doc, deck)
    const serverDoc = new ServerY.Doc()
    ServerY.applyUpdate(serverDoc, Y.encodeStateAsUpdate(doc))

    // the server saves a new title while the editor moves an element
    const current = server.readDeck(serverDoc)
    server.writeDeck(serverDoc, current, { ...current, title: 'Saved on the server' })
    const moved = client.readDeck(doc)
    client.writeDeck(doc, moved, { ...moved, slides: [{ ...moved.slides[0], elements: [{ ...moved.slides[0].elements[0], x: 50 }, moved.slides[0].elements[1]] }, moved.slides[1]] })

    Y.applyUpdate(doc, ServerY.encodeStateAsUpdate(serverDoc, Y.encodeStateVector(doc)))
    ServerY.applyUpdate(serverDoc, Y.encodeStateAsUpdate(doc, ServerY.encodeStateVector(serverDoc)))
    const merged = client.readDeck(doc)
    expect(merged.title).toBe('Saved on the server')
    expect(merged.slides[0].elements[0].x).toBe(50)
    expect(server.readDeck(serverDoc)).toEqual(merged)
  })
})
