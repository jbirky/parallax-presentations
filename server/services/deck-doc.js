// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/copy-deck-doc.js from client/src/utils/deckDoc.js; edit
// that, then run the script.

// The deck as a Yjs document, which is what editors share when they edit a
// deck live (server/services/collab.js). The editor keeps the deck as plain
// JSON and changes it by copying, as it always has; each change is compared
// with the one before by id and written to the document, whose UndoManager is
// the editor's undo. The server has a copy of everything above "The editor's
// deck" below, written by scripts/copy-deck-doc.js.
//
//   doc.getMap('fields')       the deck's own fields: title, theme, footer…
//   doc.getArray('slideOrder') slide ids, in order
//   doc.getMap('slides')       slide id → Y.Map {
//                                fields:       Y.Map of the slide's fields
//                                elementOrder: Y.Array of element ids
//                                elements:     element id → Y.Map of its fields }
//
// Each field holds its whole JSON value, so when two people change different
// fields of one element both changes stay, and the same field goes to
// whoever wrote last. Orders hold ids, so moving a slide moves only its id
// and an edit to a slide someone else moved still lands. Two people moving
// the same slide at once can leave its id in the order twice; reading keeps
// the first.

const Y = require('yjs')

// Kept by the server, not part of the document
const META_KEYS = ['id', 'createdAt', 'updatedAt', 'expiresAt', 'version']
// Present-mode ink: saved with the deck, but not an undo step
const UNTRACKED_KEYS = ['annotationSets']

// Transaction origins. The editor's edits are undo steps; loading a deck and
// ink aren't. Any other origin (undo and redo, and later other people) means
// the editor's JSON is behind the document.
const EDIT = 'edit'
const QUIET = 'quiet'

const META = new Set(META_KEYS)
const UNTRACKED = new Set(UNTRACKED_KEYS)
const trackedDeckField = key => key !== 'slides' && !META.has(key) && !UNTRACKED.has(key)
const untrackedDeckField = key => UNTRACKED.has(key)
const slideField = key => key !== 'elements'
const anyField = () => true

const isObject = v => v !== null && typeof v === 'object'
const keyOf = item => String(item.id)

function deepEqual(a, b) {
  if (a === b) return true
  if (!isObject(a) || !isObject(b)) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
    return true
  }
  const keys = Object.keys(a).filter(k => a[k] !== undefined)
  if (keys.length !== Object.keys(b).filter(k => b[k] !== undefined).length) return false
  return keys.every(k => deepEqual(a[k], b[k]))
}

// Yjs takes plain objects and arrays; anything else (a Date, say) goes in as
// the JSON it would be saved as
function storable(value) {
  if (!isObject(value) || Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype) return value
  return JSON.parse(JSON.stringify(value))
}

// Gives every slide, and every element in a slide, an id of its own. Returns
// the deck itself when nothing needed one. The elements of a slide that is
// one of checked's own slides, the deck before, were checked then.
function withIds(deck, makeId = () => crypto.randomUUID(), checked = null) {
  if (!Array.isArray(deck?.slides)) return deck
  const hasId = item => (typeof item.id === 'string' && item.id !== '') || Number.isFinite(item.id)
  const checkedSlides = new Set(Array.isArray(checked?.slides) ? checked.slides : [])
  const slideIds = new Set()
  let changed = false
  const slides = deck.slides.map(slide => {
    if (!isObject(slide)) return slide
    let next = slide
    if (!hasId(next) || slideIds.has(keyOf(next))) next = { ...next, id: makeId() }
    slideIds.add(keyOf(next))
    if (Array.isArray(next.elements) && !checkedSlides.has(slide)) {
      const elementIds = new Set()
      let renamed = false
      const elements = next.elements.map(el => {
        if (!isObject(el)) return el
        if (!hasId(el) || elementIds.has(keyOf(el))) { el = { ...el, id: makeId() }; renamed = true }
        elementIds.add(keyOf(el))
        return el
      })
      if (renamed) next = { ...next, elements }
    }
    if (next !== slide) changed = true
    return next
  })
  return changed ? { ...deck, slides } : deck
}

// ── Writing ─────────────────────────────────────────────────────────────────

// Makes ymap hold obj's fields that pass include. prev, the JSON the map
// matched before, lets a field that is the same value as before be skipped
// without comparing it.
function writeFields(ymap, obj, prev, include) {
  for (const key of Object.keys(obj)) {
    if (!include(key)) continue
    const value = obj[key]
    if (prev && prev[key] === value) continue
    if (value === undefined) ymap.delete(key)
    else if (!deepEqual(ymap.get(key), value)) ymap.set(key, storable(value))
  }
  for (const key of [...ymap.keys()]) {
    if (include(key) && obj[key] === undefined) ymap.delete(key)
  }
}

const sameIds = (a, b) => a.length === b.length && a.every((id, i) => id === b[i])

// Makes yarr hold ids. What the two share at the start and end stays put, and
// a single move is one id taken out and put back, so that someone else's
// change to the order nearby survives.
function writeOrder(yarr, ids) {
  const cur = yarr.toArray()
  if (sameIds(cur, ids)) return
  let start = 0
  while (start < cur.length && start < ids.length && cur[start] === ids[start]) start++
  let end = 0
  while (end < cur.length - start && end < ids.length - start &&
    cur[cur.length - 1 - end] === ids[ids.length - 1 - end]) end++
  const was = cur.slice(start, cur.length - end)
  const now = ids.slice(start, ids.length - end)
  if (was.length === now.length && was.length > 1) {
    const last = was.length - 1
    if (was[0] === now[last] && sameIds(was.slice(1), now.slice(0, last))) {
      yarr.delete(start, 1)
      yarr.insert(start + last, [was[0]])
      return
    }
    if (was[last] === now[0] && sameIds(was.slice(0, last), now.slice(1))) {
      yarr.delete(start + last, 1)
      yarr.insert(start, [was[last]])
      return
    }
  }
  if (was.length) yarr.delete(start, was.length)
  if (now.length) yarr.insert(start, now)
}

// Makes an order and a map of items by id hold items: removes the ones gone,
// writes the ones that changed since prevById, and puts them in order
function writeList(order, map, items, prevById, write) {
  const ids = items.map(keyOf)
  const keep = new Set(ids)
  for (const id of [...map.keys()]) if (!keep.has(id)) map.delete(id)
  for (const item of items) {
    const prev = prevById.get(keyOf(item))
    if (prev === item && map.has(keyOf(item))) continue
    write(map, item, prev)
  }
  writeOrder(order, ids)
}

function writeElement(map, el, prev) {
  let y = map.get(keyOf(el))
  if (!y) {
    y = new Y.Map()
    map.set(keyOf(el), y)
    prev = null
  }
  writeFields(y, el, prev, anyField)
}

function writeSlide(map, slide, prev) {
  let y = map.get(keyOf(slide))
  if (!y) {
    y = new Y.Map()
    map.set(keyOf(slide), y)
    y.set('fields', new Y.Map())
    y.set('elementOrder', new Y.Array())
    y.set('elements', new Y.Map())
    prev = null
  }
  writeFields(y.get('fields'), slide, prev, slideField)
  if (prev && prev.elements === slide.elements) return
  const elements = (slide.elements || []).filter(isObject)
  const prevById = new Map((prev?.elements || []).filter(isObject).map(el => [keyOf(el), el]))
  writeList(y.get('elementOrder'), y.get('elements'), elements, prevById, writeElement)
}

function writeTracked(doc, prev, next) {
  writeFields(doc.getMap('fields'), next, prev, trackedDeckField)
  if (prev && prev.slides === next.slides) return
  const slides = (next.slides || []).filter(isObject)
  const prevById = new Map((prev?.slides || []).filter(isObject).map(s => [keyOf(s), s]))
  writeList(doc.getArray('slideOrder'), doc.getMap('slides'), slides, prevById, writeSlide)
}

// Fills an empty document with deck, as a change nobody can undo
function loadDeck(doc, deck) {
  doc.transact(() => {
    writeTracked(doc, null, deck)
    writeFields(doc.getMap('fields'), deck, null, untrackedDeckField)
  }, QUIET)
}

// Writes what changed from prev, the deck the document matched, to next.
// Ink goes in a transaction of its own, which undo doesn't track.
function writeDeck(doc, prev, next) {
  doc.transact(() => writeTracked(doc, prev, next), EDIT)
  doc.transact(() => writeFields(doc.getMap('fields'), next, prev, untrackedDeckField), QUIET)
}

// ── Reading ─────────────────────────────────────────────────────────────────

// The ids in an order that still have an item, each once
function readOrder(yarr, map) {
  const seen = new Set()
  return yarr.toArray().filter(id => {
    if (seen.has(id) || !map.has(id)) return false
    seen.add(id)
    return true
  })
}

// Notes what changes in the document between reads, so a read can reuse the
// JSON of every slide and element that didn't change. take() returns what
// changed since it was last called and starts over.
function trackChanges(doc) {
  let changes
  const reset = () => { changes = { fields: false, order: false, slides: new Map() } }
  reset()
  // slide id → { all: rebuild every element } | { elements: the ids to rebuild }
  const slideChange = id => {
    if (!changes.slides.has(id)) changes.slides.set(id, { all: false, elements: new Set() })
    return changes.slides.get(id)
  }
  const onFields = () => { changes.fields = true }
  const onOrder = () => { changes.order = true }
  const onSlides = events => {
    for (const event of events) {
      const [slideId, part, elementId] = event.path
      if (slideId === undefined) {
        for (const id of event.keys.keys()) slideChange(id).all = true
      } else if (part === 'elements' && elementId !== undefined) {
        slideChange(slideId).elements.add(elementId)
      } else if (part === 'elements') {
        const change = slideChange(slideId)
        for (const id of event.keys.keys()) change.elements.add(id)
      } else if (part === undefined) {
        slideChange(slideId).all = true
      } else {
        slideChange(slideId)
      }
    }
  }
  doc.getMap('fields').observe(onFields)
  doc.getArray('slideOrder').observe(onOrder)
  doc.getMap('slides').observeDeep(onSlides)
  return {
    take() { const taken = changes; reset(); return taken },
    stop() {
      doc.getMap('fields').unobserve(onFields)
      doc.getArray('slideOrder').unobserve(onOrder)
      doc.getMap('slides').unobserveDeep(onSlides)
    },
  }
}

function readSlide(y, id, prev, change) {
  const slide = y.get('fields').toJSON()
  if (slide.id === undefined) slide.id = id
  const elements = y.get('elements')
  const prevById = new Map((prev?.elements || []).filter(isObject).map(el => [keyOf(el), el]))
  slide.elements = readOrder(y.get('elementOrder'), elements).map(elementId => {
    const reuse = prevById.get(elementId)
    if (reuse && change && !change.all && !change.elements.has(elementId)) return reuse
    const el = elements.get(elementId).toJSON()
    if (el.id === undefined) el.id = elementId
    return el
  })
  return slide
}

// The document as the editor's JSON. With prev, the JSON before, and changes,
// what trackChanges saw since then, everything that didn't change is prev's
// own objects, so the editor redraws only what did. The server's fields come
// from prev.
function readDeck(doc, prev = null, changes = null) {
  const deck = {}
  for (const key of META_KEYS) if (prev?.[key] !== undefined) deck[key] = prev[key]
  if (prev && changes && !changes.fields) {
    for (const key of Object.keys(prev)) if (key !== 'slides' && !META.has(key)) deck[key] = prev[key]
  } else {
    Object.assign(deck, doc.getMap('fields').toJSON())
  }
  if (prev && changes && !changes.order && changes.slides.size === 0) {
    deck.slides = prev.slides
    return deck
  }
  const slides = doc.getMap('slides')
  const prevById = new Map((prev?.slides || []).filter(isObject).map(s => [keyOf(s), s]))
  deck.slides = readOrder(doc.getArray('slideOrder'), slides).map(id => {
    const reuse = prevById.get(id)
    const change = changes?.slides.get(id)
    if (reuse && changes && !change) return reuse
    return readSlide(slides.get(id), id, reuse, change)
  })
  return deck
}

module.exports = { META_KEYS, UNTRACKED_KEYS, EDIT, QUIET, deepEqual, withIds, loadDeck, writeDeck, trackChanges, readDeck }
