// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The outline: notes for planning a talk, a few lines under each slide, kept
// apart from what's on the slides. A deck is read as lines (sections, each
// slide's title, and the slide's outline notes) and changes to those lines
// written back. Nothing here keeps state: the lines are read from the deck
// each time, and each change returns a new deck, so undo and live editing
// take it like any other edit.
//
// The outline never changes what's on a slide. Its notes are the slide's
// outlineNotes, [{ text, level }], which nothing else shows: not the slide,
// not its speaker notes. A slide's title is read from the slide, never
// written: the first heading (h1–h3) of its topmost text box that starts with
// one, or of the box marked outline: 'title'. Besides its notes, the outline
// changes only the plan around the slides: section names, minutes, the talk's
// length, and blank slides added and removed.
//
// Changes take a slide by id, so one made while someone else moves slides
// still lands on the right slide. Each returns { deck, focus: [key, caret] },
// or { refused: why } when it would lose something.

const TITLE_BLOCK = /^H[1-3]$/
export const MAX_LEVEL = 2

// ── Reading ───────────────────────────────────────────────────────────────
// Decks' HTML (other people's, when editing live) is read in a document of
// its own, which loads nothing and runs nothing: an <img onerror> there is inert
let inert = null
const doc = () => inert || (inert = document.implementation.createHTMLDocument(''))
const make = tag => doc().createElement(tag)
function box(html) {
  const d = make('div')
  d.innerHTML = html || ''
  return d
}
const clean = s => String(s || '').replace(/\s+/g, ' ').trim()
export const textOf = html => clean(box(html).textContent)

const firstTag = e => (box(e.content).firstElementChild || {}).tagName || ''

// The text box a slide's title is in, or null
export function titleBox(slide) {
  const texts = (slide.elements || []).filter(e => e.type === 'text')
  return texts.find(e => e.outline === 'title')
    || texts.filter(e => TITLE_BLOCK.test(firstTag(e))).sort((a, b) => (a.y - b.y) || (a.x - b.x))[0]
    || null
}
// A slide's title, as the HTML inside its heading
export function titleOf(slide) {
  const t = titleBox(slide), head = t && box(t.content).firstElementChild
  return head ? head.innerHTML : ''
}

// A slide's outline notes, each { text, level }, whatever was stored
export function notesOf(slide) {
  const ns = Array.isArray(slide && slide.outlineNotes) ? slide.outlineNotes : []
  return ns.filter(x => x && typeof x === 'object').map(x => ({
    text: String(x.text == null ? '' : x.text).replace(/\s*\n\s*/g, ' '),
    level: Math.max(0, Math.min(MAX_LEVEL, Math.floor(Number(x.level)) || 0)),
  }))
}
const hasNotes = s => notesOf(s).some(x => clean(x.text))
// Nothing on it, and nothing written for it
const isBlankSlide = s => !(s.elements || []).length && !clean(s.notes) && !hasNotes(s)

// Slides in the order they're shown: in a 2D deck, column by column, with
// the slides under a column's first marked vertical
export function slideOrder(slides) {
  if (!slides.some(s => s.column !== undefined)) return slides.map((_, index) => ({ index, vertical: false }))
  const cols = new Map()
  slides.forEach((s, i) => { const c = s.column ?? 0; if (!cols.has(c)) cols.set(c, []); cols.get(c).push(i) })
  return [...cols.keys()].sort((a, b) => a - b).flatMap(c => cols.get(c).map((index, k) => ({ index, vertical: k > 0 })))
}

// Slides share a section (the footer's label) while their labels match,
// unless one starts a new section on purpose: so a section stays itself
// while it's renamed, even through a name the one above has
export function sectionStarts(slides, order = slideOrder(slides)) {
  const starts = new Set()
  order.forEach(({ index }, k) => {
    const s = slides[index], prev = k > 0 ? slides[order[k - 1].index] : null
    const label = s.section || ''
    if (prev ? s.sectionStart || label !== (prev.section || '') : label || s.sectionStart) starts.add(index)
  })
  return starts
}
// The slides of the section a slide is in, as indices in showing order
function runOf(slides, index) {
  const order = slideOrder(slides), starts = sectionStarts(slides, order)
  const at = order.findIndex(o => o.index === index)
  let a = at
  while (a > 0 && !starts.has(order[a].index)) a--
  let b = at + 1
  while (b < order.length && !starts.has(order[b].index)) b++
  return order.slice(a, b).map(o => o.index)
}

const noteKey = (id, n) => id + ':o' + n

// Every line, in order. A slide with no notes has an empty one to type the
// first into (blank: true). referencesCount: the references slide made from
// the deck's citations, shown last when there is one
export function outlineLines(deck, { referencesCount = 0 } = {}) {
  const slides = (deck && deck.slides) || []
  const order = slideOrder(slides), starts = sectionStarts(slides, order), out = []
  order.forEach(({ index, vertical }, k) => {
    const s = slides[index], id = s.id
    if (starts.has(index)) out.push({ kind: 'section', key: 'sec:' + id, slideId: id, index, text: s.section || '' })
    out.push({ kind: 'slide', key: id, slideId: id, index, n: k + 1, vertical, html: titleOf(s) })
    const ns = notesOf(s)
    if (!ns.length) out.push({ kind: 'note', key: noteKey(id, 0), slideId: id, index, n: 0, level: 0, text: '', blank: true })
    ns.forEach((x, n) => out.push({ kind: 'note', key: noteKey(id, n), slideId: id, index, n, level: x.level, text: x.text }))
  })
  if (referencesCount > 0) out.push({ kind: 'references', key: 'references', index: slides.length, n: order.length + 1, count: referencesCount })
  return out
}

// Minutes planned: the total, and each section's
export function timing(deck) {
  const slides = (deck && deck.slides) || [], order = slideOrder(slides), starts = sectionStarts(slides, order)
  const sections = []
  let total = 0
  order.forEach(({ index }, k) => {
    const s = slides[index], m = Number(s.minutes) > 0 ? Number(s.minutes) : 0
    if (k === 0 || starts.has(index)) sections.push({ label: s.section || '', minutes: 0, slideId: s.id })
    sections[sections.length - 1].minutes += m
    total += m
  })
  return { total, sections, target: Number(deck && deck.timerDuration != null ? deck.timerDuration : 20) || 0 }
}

// ── Writing ───────────────────────────────────────────────────────────────
const slideIndex = (deck, id) => deck.slides.findIndex(s => s.id === id)
function withSlide(deck, id, fn) {
  return { ...deck, slides: deck.slides.map(s => (s.id === id ? fn(s) : s)) }
}
// A slide's notes as a list to change; none left takes the field away
function withNotes(deck, id, fn) {
  return withSlide(deck, id, s => {
    const ns = notesOf(s)
    fn(ns)
    const next = { ...s, outlineNotes: ns }
    if (!ns.length) delete next.outlineNotes
    return next
  })
}
const newId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))

// A blank slide after the one at `after`, in its column, section and background
function blankSlideAfter(deck, after) {
  const like = deck.slides[after]
  const s = {
    id: newId(),
    ...(like && like.column !== undefined ? { column: like.column } : {}),
    elements: [],
    notes: '',
    background: like && like.background ? { ...like.background } : { type: 'color', color: '#1e1e2e' },
    ...(like && like.section ? { section: like.section } : {}),
  }
  const slides = deck.slides.slice()
  slides.splice(after + 1, 0, s)
  return { deck: { ...deck, slides }, slide: s }
}
// A slide leaving its place hands on a section it started on purpose
function handOnStart(slides, index) {
  const s = slides[index]
  if (!s.sectionStart) return slides
  const order = slideOrder(slides), at = order.findIndex(o => o.index === index), next = order[at + 1] && slides[order[at + 1].index]
  if (next && (next.section || '') === (s.section || '') && !next.sectionStart) return slides.map(x => (x === next ? { ...x, sectionStart: true } : x))
  return slides
}
function removeSlideAt(deck, index) {
  const slides = handOnStart(deck.slides, index).slice()
  slides.splice(index, 1)
  return { ...deck, slides }
}
// A blank slide goes, the cursor going to the end of the line before it; one
// with anything on it or written for it stays
function removeBlankSlide(deck, i) {
  const s = deck.slides[i]
  if (deck.slides.length < 2) return { refused: 'A deck keeps at least one slide' }
  if (!isBlankSlide(s)) return { refused: 'This slide has things on it, so the outline keeps it. Delete it in Slides.' }
  const lines = outlineLines(deck), at = lines.findIndex(L => L.kind === 'slide' && L.slideId === s.id)
  const before = lines.slice(0, at).filter(L => L.slideId !== s.id).pop()
  return { deck: removeSlideAt(deck, i), focus: before ? [before.key, 'end'] : null }
}

// Typing into a line
export function setNote(deck, slideId, n, text) {
  return withNotes(deck, slideId, ns => {
    while (ns.length <= n) ns.push({ text: '', level: 0 })
    ns[n] = { ...ns[n], text: String(text || '').replace(/\s*\n\s*/g, ' ') }
  })
}
export function setSectionName(deck, slideId, name) {
  const i = slideIndex(deck, slideId)
  if (i < 0) return deck
  const run = new Set(runOf(deck.slides, i))
  return { ...deck, slides: deck.slides.map((s, k) => (run.has(k) ? { ...s, section: name, ...(k === i ? { sectionStart: true } : {}) } : s)) }
}
export function setMinutes(deck, slideId, minutes) {
  return withSlide(deck, slideId, s => {
    const next = { ...s }
    if (minutes == null || !(Number(minutes) >= 0)) delete next.minutes
    else next.minutes = Math.round(Number(minutes) * 100) / 100
    return next
  })
}
export function setTarget(deck, minutes) {
  return { ...deck, timerDuration: Math.max(0, Number(minutes) || 0) }
}

// Enter. On a slide's title, a blank slide after it. On a note, a new note
// after it, the text after the cursor going to it; on an empty note, the note
// moves up a level, and at the end of a slide's notes goes, a blank slide
// coming after the slide in its place.
export function enter(deck, line, before = '', after = '') {
  const i = slideIndex(deck, line.slideId)
  if (i < 0) return { deck }
  if (line.kind === 'slide') {
    const r = blankSlideAfter(deck, i)
    return { deck: r.deck, focus: [noteKey(r.slide.id, 0), 0] }
  }
  if (line.kind === 'note') {
    const ns = notesOf(deck.slides[i])
    if (!clean(before) && !clean(after)) {
      if (line.level > 0) return outdent(deck, line)
      if (line.n >= ns.length - 1) {
        const d = line.blank ? deck : withNotes(deck, line.slideId, xs => xs.splice(line.n, 1))
        const r = blankSlideAfter(d, i)
        return { deck: r.deck, focus: [noteKey(r.slide.id, 0), 0] }
      }
    }
    const d = withNotes(deck, line.slideId, xs => {
      while (xs.length <= line.n) xs.push({ text: '', level: 0 })
      const level = xs[line.n].level
      xs.splice(line.n, 1, { text: before, level }, { text: after, level })
    })
    return { deck: d, focus: [noteKey(line.slideId, line.n + 1), 0] }
  }
  return { deck }
}

// A note and the notes under it, as indices in the slide's notes
function branch(ns, n) {
  let end = n + 1
  while (end < ns.length && ns[end].level > ns[n].level) end++
  return [n, end]
}

// Tab: a note goes under the one above it, taking its own with it; a section
// break goes, its slides joining the section above
export function indent(deck, line) {
  const i = slideIndex(deck, line.slideId)
  if (i < 0) return { deck }
  if (line.kind === 'note') {
    const ns = notesOf(deck.slides[i]), x = ns[line.n]
    if (!x || line.n === 0 || x.level >= MAX_LEVEL || x.level > ns[line.n - 1].level) return { deck }
    const [a, b] = branch(ns, line.n)
    return { deck: withNotes(deck, line.slideId, xs => { for (let k = a; k < b; k++) xs[k].level = Math.min(MAX_LEVEL, xs[k].level + 1) }) }
  }
  if (line.kind === 'section') {
    // No section break here: its slides join the section above
    const order = slideOrder(deck.slides), at = order.findIndex(o => o.index === i)
    const label = at > 0 ? deck.slides[order[at - 1].index].section || '' : ''
    const run = new Set(runOf(deck.slides, i))
    const slides = deck.slides.map((s, k) => {
      if (!run.has(k)) return s
      const next = { ...s, section: label }
      if (k === i) delete next.sectionStart
      if (!label) delete next.section
      return next
    })
    return { deck: { ...deck, slides }, focus: [line.slideId, 'start'] }
  }
  return { deck }
}

// Shift+Tab: a note comes up a level, taking its own with it; a slide starts
// a section
export function outdent(deck, line) {
  const i = slideIndex(deck, line.slideId)
  if (i < 0) return { deck }
  if (line.kind === 'note') {
    const ns = notesOf(deck.slides[i])
    if (!ns[line.n] || ns[line.n].level === 0) return { deck }
    const [a, b] = branch(ns, line.n)
    return { deck: withNotes(deck, line.slideId, xs => { for (let k = a; k < b; k++) xs[k].level = Math.max(0, xs[k].level - 1) }) }
  }
  if (line.kind === 'slide') {
    const starts = sectionStarts(deck.slides)
    if (starts.has(i)) return { deck, focus: ['sec:' + line.slideId, 'all'] }
    const run = runOf(deck.slides, i), from = run.indexOf(i), moving = new Set(run.slice(from))
    const slides = deck.slides.map((s, k) => (moving.has(k) ? { ...s, section: 'New section', ...(k === i ? { sectionStart: true } : {}) } : s))
    return { deck: { ...deck, slides }, focus: ['sec:' + line.slideId, 'all'] }
  }
  return { deck }
}

// Backspace at the start of a line: an empty note goes; a note joins the one
// above, or comes up a level; a blank slide goes, from its title or its empty
// note line. Null when it does nothing.
export function backspace(deck, line, isEmpty, prevKey) {
  const i = slideIndex(deck, line.slideId)
  if (i < 0) return null
  if (line.kind === 'slide') return removeBlankSlide(deck, i)
  if (line.kind === 'note') {
    if (line.blank) return isBlankSlide(deck.slides[i]) ? removeBlankSlide(deck, i) : null
    const ns = notesOf(deck.slides[i]), x = ns[line.n]
    if (!x) return null
    if (isEmpty) return { deck: withNotes(deck, line.slideId, xs => xs.splice(line.n, 1)), focus: prevKey ? [prevKey, 'end'] : null }
    if (x.level > 0) return outdent(deck, line)
    if (line.n === 0 || branch(ns, line.n)[1] > line.n + 1) return null
    const at = ns[line.n - 1].text.length
    const d = withNotes(deck, line.slideId, xs => { xs[line.n - 1].text += xs[line.n].text; xs.splice(line.n, 1) })
    return { deck: d, focus: [noteKey(line.slideId, line.n - 1), at] }
  }
  if (line.kind === 'section' && isEmpty) {
    const r = indent(deck, line)
    return { deck: r.deck, focus: prevKey ? [prevKey, 'end'] : r.focus }
  }
  return null
}

// ── A title's inline HTML ─────────────────────────────────────────────────
// What a title line shows of the slide's heading: TipTap's marks, links, math
// and citations; anything else is unwrapped to its text
const INLINE = {
  STRONG: [], B: [], EM: [], I: [], U: [], S: [], CODE: [], BR: [], SUB: [],
  A: ['href', 'target', 'rel'],
  SPAN: ['style', 'class', 'data-math-latex', 'data-math-display', 'data-math-fontsize', 'data-math-color', 'data-cite'],
  MARK: ['style', 'data-color'],
  SUP: ['style', 'data-cite'],
}
const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'SVG', 'MATH', 'TEXTAREA', 'SELECT'])
export function cleanInline(html) {
  const src = box(html), out = make('div')
  const copy = (from, to) => Array.from(from.childNodes).forEach(n => {
    if (n.nodeType === 3) { to.appendChild(doc().createTextNode(n.textContent)); return }
    if (n.nodeType !== 1) return
    if (DROP.has(n.tagName)) return
    const allowed = INLINE[n.tagName]
    if (!allowed) { copy(n, to); return }
    const e = make(n.tagName.toLowerCase())
    Array.from(n.attributes).forEach(({ name, value }) => {
      if (!allowed.includes(name)) return
      if (name === 'href' && !/^(https?:|mailto:|#)/i.test(value.trim())) return
      e.setAttribute(name, value)
    })
    copy(n, e)
    to.appendChild(e)
  })
  copy(src, out)
  // A break at the end of a heading
  while (out.lastChild && out.lastChild.nodeName === 'BR') out.removeChild(out.lastChild)
  return out.innerHTML
}
