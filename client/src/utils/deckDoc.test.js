import { describe, it, expect, vi } from 'vitest'
import * as Y from 'yjs'
import { createDeckStore, loadDeck, writeDeck, readDeck, trackChanges, withIds, deepEqual, UNDO_STEPS } from './deckDoc'

const el = (id, extra = {}) => ({ id, type: 'text', x: 0, y: 0, width: 100, height: 40, zIndex: 1, content: `<p>${id}</p>`, ...extra })
const slide = (id, elements = [], extra = {}) => ({ id, notes: '', background: { type: 'color', color: '#000000' }, elements, ...extra })
const deck = (extra = {}) => ({
  id: 'p1', title: 'Talk', theme: 'black', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z',
  guides: [{ axis: 'x', position: 480 }],
  slides: [slide('s1', [el('a'), el('b')]), slide('s2', [el('c')]), slide('s3')],
  ...extra,
})

// Changes as the editor makes them: by copying
const editElement = (d, id, patch) => ({
  ...d,
  slides: d.slides.map(s => s.elements.some(e => e.id === id)
    ? { ...s, elements: s.elements.map(e => e.id === id ? { ...e, ...patch } : e) }
    : s),
})
const moveSlide = (d, from, to) => {
  const slides = [...d.slides]
  const [moved] = slides.splice(from, 1)
  slides.splice(to, 0, moved)
  return { ...d, slides }
}
const deleteSlide = (d, id) => ({ ...d, slides: d.slides.filter(s => s.id !== id) })
const slideIds = d => d.slides.map(s => s.id)
const element = (d, id) => d.slides.flatMap(s => s.elements).find(e => e.id === id)
const withoutServerFields = ({ id, createdAt, updatedAt, expiresAt, ...rest }) => rest

const loaded = start => {
  const doc = new Y.Doc()
  loadDeck(doc, start)
  return doc
}
// Two people's copies of one document
function pair(start) {
  const a = loaded(start)
  const b = new Y.Doc()
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
  return [a, b]
}
function sync(a, b) {
  const toB = Y.encodeStateAsUpdate(a, Y.encodeStateVector(b))
  const toA = Y.encodeStateAsUpdate(b, Y.encodeStateVector(a))
  Y.applyUpdate(b, toB)
  Y.applyUpdate(a, toA)
}
// What a write changed: each changed map or array, by path, with its changed keys
function changesOf(doc, write) {
  const seen = []
  const record = name => events => {
    for (const e of [].concat(events)) {
      seen.push({ path: [name, ...e.path].join('/'), keys: e.target instanceof Y.Map ? [...e.keys.keys()].sort() : null, delta: e.target instanceof Y.Array ? e.changes.delta : null })
    }
  }
  const onFields = record('fields'), onOrder = record('slideOrder'), onSlides = record('slides')
  doc.getMap('fields').observe(onFields)
  doc.getArray('slideOrder').observe(onOrder)
  doc.getMap('slides').observeDeep(onSlides)
  write()
  doc.getMap('fields').unobserve(onFields)
  doc.getArray('slideOrder').unobserve(onOrder)
  doc.getMap('slides').unobserveDeep(onSlides)
  return seen
}

describe('the deck as a Yjs document', () => {
  it('reads back the deck it was loaded with, apart from the server’s fields', () => {
    const d = deck({ annotationSets: [{ id: 'set1', slides: {} }], expiresAt: '2026-10-01T00:00:00Z' })
    const doc = loaded(d)
    expect(readDeck(doc)).toEqual(withoutServerFields(d))
    // which come from the deck before
    expect(readDeck(doc, d)).toEqual(d)
  })

  it('writes only the field that changed', () => {
    const d = deck()
    const doc = loaded(d)
    expect(changesOf(doc, () => writeDeck(doc, d, editElement(d, 'b', { x: 50 }))))
      .toEqual([{ path: 'slides/s1/elements/b', keys: ['x'], delta: null }])
  })

  it('writes nothing for a copy of the same deck', () => {
    const d = deck()
    const doc = loaded(d)
    const before = Y.encodeStateVector(doc)
    writeDeck(doc, d, JSON.parse(JSON.stringify(d)))
    expect(Y.encodeStateVector(doc)).toEqual(before)
  })

  it('moves a slide by taking its id out of the order and putting it back', () => {
    const d = deck()
    const doc = loaded(d)
    const changes = changesOf(doc, () => writeDeck(doc, d, moveSlide(d, 0, 2)))
    expect(changes).toHaveLength(1)
    expect(changes[0].path).toBe('slideOrder')
    const delta = changes[0].delta
    expect(delta.filter(op => op.delete).reduce((n, op) => n + op.delete, 0)).toBe(1)
    expect(delta.filter(op => op.insert).flatMap(op => op.insert)).toEqual(['s1'])
    expect(slideIds(readDeck(doc))).toEqual(['s2', 's3', 's1'])
  })

  it('adds and removes slides and elements', () => {
    const d = deck()
    const doc = loaded(d)
    const next = {
      ...d,
      slides: [
        { ...d.slides[0], elements: [d.slides[0].elements[1], el('new')] },
        slide('s4', [el('d')]),
        d.slides[2],
      ],
    }
    writeDeck(doc, d, next)
    expect(readDeck(doc, d)).toEqual(next)
  })

  it('removes a field set to undefined', () => {
    const d = deck()
    const doc = loaded(d)
    writeDeck(doc, d, editElement(d, 'a', { zIndex: undefined }))
    expect('zIndex' in element(readDeck(doc), 'a')).toBe(false)
  })

  it('stores a value that isn’t a plain object as its JSON', () => {
    const d = deck()
    const doc = loaded(d)
    writeDeck(doc, d, { ...d, when: new Date(0) })
    expect(readDeck(doc).when).toBe('1970-01-01T00:00:00.000Z')
  })

  it('rebuilds only the slides and elements that changed', () => {
    const d = deck()
    const [a, b] = pair(d)
    const changes = trackChanges(b)
    writeDeck(a, d, editElement(d, 'b', { x: 50 }))
    sync(a, b)
    const read = readDeck(b, d, changes.take())
    expect(element(read, 'b').x).toBe(50)
    expect(read.slides[0]).not.toBe(d.slides[0])
    expect(read.slides[0].elements[0]).toBe(d.slides[0].elements[0])
    expect(read.slides[1]).toBe(d.slides[1])
    expect(read.slides[2]).toBe(d.slides[2])
    expect(read.guides).toBe(d.guides)
    expect(read.id).toBe('p1')
    changes.stop()
  })
})

describe('two people editing one deck', () => {
  it('keeps both changes to different fields of one element', () => {
    const d = deck()
    const [a, b] = pair(d)
    writeDeck(a, d, editElement(d, 'a', { x: 10 }))
    writeDeck(b, d, editElement(d, 'a', { content: '<p>hi</p>' }))
    sync(a, b)
    expect(element(readDeck(a), 'a')).toMatchObject({ x: 10, content: '<p>hi</p>' })
    expect(readDeck(b)).toEqual(readDeck(a))
  })

  it('keeps an edit to a slide someone else moved', () => {
    const d = deck()
    const [a, b] = pair(d)
    writeDeck(a, d, moveSlide(d, 0, 2))
    writeDeck(b, d, editElement(d, 'a', { x: 10 }))
    sync(a, b)
    const read = readDeck(a)
    expect(slideIds(read)).toEqual(['s2', 's3', 's1'])
    expect(element(read, 'a').x).toBe(10)
    expect(readDeck(b)).toEqual(read)
  })

  it('lists a slide once when two people move it at once', () => {
    const d = deck()
    const [a, b] = pair(d)
    writeDeck(a, d, moveSlide(d, 0, 1))
    writeDeck(b, d, moveSlide(d, 0, 2))
    sync(a, b)
    const ids = slideIds(readDeck(a))
    expect([...ids].sort()).toEqual(['s1', 's2', 's3'])
    expect(slideIds(readDeck(b))).toEqual(ids)
  })

  it('keeps both slides when two people add one at once', () => {
    const d = deck()
    const [a, b] = pair(d)
    writeDeck(a, d, { ...d, slides: [...d.slides, slide('fromA')] })
    writeDeck(b, d, { ...d, slides: [...d.slides, slide('fromB')] })
    sync(a, b)
    expect([...slideIds(readDeck(a))].sort()).toEqual(['fromA', 'fromB', 's1', 's2', 's3'])
  })

  it('drops an edit to a slide someone else deleted', () => {
    const d = deck()
    const [a, b] = pair(d)
    writeDeck(a, d, deleteSlide(d, 's2'))
    writeDeck(b, d, editElement(d, 'c', { x: 10 }))
    sync(a, b)
    expect(slideIds(readDeck(a))).toEqual(['s1', 's3'])
    expect(readDeck(b)).toEqual(readDeck(a))
  })

  it('merges two copies that each loaded the deck into one deck', () => {
    const d = deck()
    const a = loaded(d)
    const b = loaded(d)
    sync(a, b)
    expect(readDeck(a)).toEqual(withoutServerFields(d))
    expect(readDeck(b)).toEqual(readDeck(a))
  })
})

describe('withIds', () => {
  let n = 0
  const makeId = () => `new${++n}`

  it('gives a slide or element with no id, or one already used, an id of its own', () => {
    n = 0
    const d = { slides: [
      { elements: [{ type: 'text' }, { id: 'x' }, { id: 'x' }] },
      { id: 's', elements: [{ id: 'x' }] },
      { id: 's', elements: [] },
    ] }
    const fixed = withIds(d, makeId)
    expect(fixed.slides.map(s => s.id)).toEqual(['new1', 's', 'new4'])
    expect(fixed.slides[0].elements.map(e => e.id)).toEqual(['new2', 'x', 'new3'])
    // ids only have to be unique within a slide
    expect(fixed.slides[1]).toBe(d.slides[1])
  })

  it('returns the same deck when every id is its own, numbers included', () => {
    const d = deck({ slides: [slide(7, [el(1), el('2')])] })
    expect(withIds(d, makeId)).toBe(d)
  })
})

describe('the editor’s deck', () => {
  it('undoes and redoes an edit, and tells the editor', () => {
    const onChange = vi.fn()
    const store = createDeckStore({ onChange })
    const d = deck()
    store.set(d)
    expect(store.canUndo()).toBe(false)
    store.set(prev => editElement(prev, 'a', { x: 5 }))
    expect(store.canUndo()).toBe(true)

    const undone = store.undo()
    expect(element(undone, 'a').x).toBe(0)
    expect(onChange).toHaveBeenLastCalledWith(undone)
    expect(store.get()).toBe(undone)
    // everything else is the deck it was
    expect(undone.slides[1]).toBe(d.slides[1])
    expect(undone.id).toBe('p1')
    expect(store.canUndo()).toBe(false)

    expect(element(store.redo(), 'a').x).toBe(5)
    expect(store.canRedo()).toBe(false)
    expect(store.undo()).not.toBeNull()
    expect(store.undo()).toBeNull()
  })

  it('makes edits less than half a second apart one step', () => {
    const store = createDeckStore()
    store.set(deck())
    store.set(prev => editElement(prev, 'a', { x: 1 }))
    store.set(prev => editElement(prev, 'a', { x: 2 }))
    store.stopCapturing()
    store.set(prev => editElement(prev, 'a', { x: 3 }))
    expect(element(store.undo(), 'a').x).toBe(2)
    expect(element(store.undo(), 'a').x).toBe(0)
  })

  // Values the document still holds after they were replaced, so undo can put them back
  const keptValues = doc => {
    let n = 0
    doc.store.clients.forEach(structs => structs.forEach(s => {
      if (s instanceof Y.Item && s.deleted && s.content instanceof Y.ContentAny) n += s.content.getLength()
    }))
    return n
  }

  it('keeps only the text from before a step, not each keystroke’s', () => {
    const store = createDeckStore()
    store.set(deck())
    for (let i = 1; i <= 50; i++) store.set(prev => editElement(prev, 'a', { content: `<p>${'x'.repeat(i)}</p>` }))
    expect(keptValues(store.doc)).toBe(1)
    expect(element(store.undo(), 'a').content).toBe('<p>a</p>')
    expect(element(store.redo(), 'a').content).toBe(`<p>${'x'.repeat(50)}</p>`)
  })

  it(`keeps the last ${UNDO_STEPS} steps, and frees what older ones kept`, () => {
    const store = createDeckStore()
    store.set(deck())
    for (let i = 1; i <= UNDO_STEPS + 20; i++) {
      store.set(prev => editElement(prev, 'a', { x: i }))
      store.stopCapturing()
    }
    expect(keptValues(store.doc)).toBe(UNDO_STEPS)
    let undone
    for (let i = 0; i < UNDO_STEPS; i++) undone = store.undo()
    expect(element(undone, 'a').x).toBe(20)
    expect(store.undo()).toBeNull()
  })

  it('undoes deleting a slide, with its elements, in its place', () => {
    const store = createDeckStore()
    const d = deck()
    store.set(d)
    store.set(prev => deleteSlide(prev, 's1'))
    const undone = store.undo()
    expect(slideIds(undone)).toEqual(['s1', 's2', 's3'])
    expect(undone.slides[0]).toEqual(d.slides[0])
  })

  it('undoes moving a slide', () => {
    const store = createDeckStore()
    store.set(deck())
    store.set(prev => moveSlide(prev, 2, 0))
    expect(slideIds(store.undo())).toEqual(['s1', 's2', 's3'])
  })

  it('leaves ink out of undo', () => {
    const store = createDeckStore()
    store.set(deck())
    store.set(prev => editElement(prev, 'a', { x: 5 }))
    store.stopCapturing()
    const ink = [{ id: 'set1', slides: { s1: { paths: [[0, 0, 1, 1]] } } }]
    store.set(prev => ({ ...prev, annotationSets: ink }))
    // ink alone isn't a step, and undoing the edit keeps the ink
    const undone = store.undo()
    expect(element(undone, 'a').x).toBe(0)
    expect(undone.annotationSets).toEqual(ink)
    expect(store.canUndo()).toBe(false)
  })

  it('starts a new document, with no undo, for another deck', () => {
    const store = createDeckStore()
    store.set(deck())
    store.set(prev => editElement(prev, 'a', { x: 5 }))
    const first = store.doc
    store.set(deck({ id: 'p2' }))
    expect(store.doc).not.toBe(first)
    expect(store.canUndo()).toBe(false)
    expect(readDeck(store.doc)).toEqual(withoutServerFields(deck({ id: 'p2' })))
  })

  it('treats the same content loaded again as no change', () => {
    const store = createDeckStore()
    store.set(deck())
    store.set(JSON.parse(JSON.stringify(deck())))
    expect(store.canUndo()).toBe(false)
  })

  it('gives slides and elements missing an id one before writing them', () => {
    let n = 0
    const store = createDeckStore({ makeId: () => `id${++n}` })
    store.set({ id: 'p1', slides: [{ elements: [{ type: 'text' }] }] })
    expect(store.get().slides[0].id).toBe('id1')
    expect(readDeck(store.doc).slides[0].elements[0].id).toBe('id2')
    // and in a slide changed later
    store.set(prev => ({ ...prev, slides: [{ ...prev.slides[0], elements: [...prev.slides[0].elements, { type: 'shape' }] }] }))
    expect(store.get().slides[0].elements.map(e => e.id)).toEqual(['id2', 'id3'])
  })

  it('starts over from a deck, with no undo', () => {
    const store = createDeckStore()
    store.set(deck())
    store.set(prev => editElement(prev, 'a', { x: 5 }))
    const first = store.doc
    const fresh = deck({ title: 'Their version' })
    expect(store.reset(fresh)).toBe(fresh)
    expect(store.doc).not.toBe(first)
    expect(store.canUndo()).toBe(false)
    expect(readDeck(store.doc).title).toBe('Their version')
  })

  it('leaves the server’s version number out of the document', () => {
    const store = createDeckStore()
    store.set(deck({ version: 3 }))
    expect(readDeck(store.doc).version).toBeUndefined()
    store.set(prev => editElement(prev, 'a', { x: 5 }))
    expect(store.undo().version).toBe(3)
  })

  it('takes a document filled elsewhere, and follows the changes that arrive in it', () => {
    const onChange = vi.fn()
    const store = createDeckStore({ onChange })
    const live = new Y.Doc()
    loadDeck(live, deck())
    const attached = store.attach(live, { id: 'p1', version: 9, title: 'not this' })
    expect(store.doc).toBe(live)
    expect(attached).toEqual({ ...withoutServerFields(deck()), id: 'p1', version: 9 })

    // a change from someone else, then one here: undo takes back only this one
    live.transact(() => live.getMap('fields').set('theme', 'white'), 'server')
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'white' }))
    store.set(prev => editElement(prev, 'a', { x: 5 }))
    const undone = store.undo()
    expect(element(undone, 'a').x).toBe(0)
    expect(undone.theme).toBe('white')
    expect(undone.id).toBe('p1')
  })

  it('reopens after being closed', () => {
    const store = createDeckStore()
    store.set(deck())
    store.destroy()
    expect(store.doc).toBeNull()
    store.set(prev => editElement(prev, 'a', { x: 5 }))
    expect(element(readDeck(store.doc), 'a').x).toBe(5)
  })
})

describe('deepEqual', () => {
  it('compares JSON values, treating an undefined field as missing', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(deepEqual({ a: [1] }, { a: { 0: 1 } })).toBe(false)
    expect(deepEqual({ a: null }, { a: {} })).toBe(false)
  })
})
