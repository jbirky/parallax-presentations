// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The outline: a deck read as lines (sections, slide titles, points, speaker
// notes, and the other things on each slide) and changes to those lines
// written back. Nothing here keeps state: the lines are read from the deck
// each time, and each change returns a new deck, so undo and live editing
// take it like any other edit.
//
// A slide's title is the first heading of its topmost text box that starts
// with one (h1–h3), or of the box marked outline: 'title'. Its points are the
// blocks after that heading in the same box (Parallax's own new slide is one
// box, a heading then text), else the largest other text box with a list,
// else the largest other text box. A point is a list item (nested lists are
// sub-points) or a paragraph, and keeps its inline HTML: marks, math,
// citations. Everything else on a slide is listed, and changed only there.
//
// Changes take a slide by id, so one made while someone else moves slides
// still lands on the right slide. Each returns { deck, focus: [key, caret] },
// or { refused: why } when it would lose something.

const LIST = /^(UL|OL)$/
const TITLE_BLOCK = /^H[1-3]$/
const POINT_BLOCK = /^(P|H[1-6]|BLOCKQUOTE)$/
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
const children = n => Array.from(n.children)
const clean = s => String(s || '').replace(/\s+/g, ' ').trim()
export const textOf = html => clean(box(html).textContent)

// A list item's (or quote's) inline content, in a <p> as TipTap writes it
function contentOf(item) {
  const p = children(item).find(c => c.tagName === 'P')
  if (p) return p
  const q = make('p')
  Array.from(item.childNodes).filter(n => !(n.nodeType === 1 && LIST.test(n.tagName))).forEach(n => q.appendChild(n))
  item.insertBefore(q, item.firstChild)
  return q
}
const subListOf = li => children(li).find(c => LIST.test(c.tagName)) || null

// The points among a text box's blocks, from block `from` on: the node with
// each one's inline content, its level, and the list item it's in
function pointsIn(d, from = 0) {
  const out = []
  const walk = (list, level) => {
    for (const li of children(list)) {
      if (li.tagName !== 'LI') continue
      out.push({ node: contentOf(li), level, li })
      for (const c of children(li)) if (LIST.test(c.tagName)) walk(c, level + 1)
    }
  }
  children(d).slice(from).forEach(b => {
    if (LIST.test(b.tagName)) walk(b, 0)
    else if (POINT_BLOCK.test(b.tagName)) out.push({ node: b.tagName === 'BLOCKQUOTE' ? contentOf(b) : b, level: 0, li: null })
  })
  return out
}

const area = e => (e.width || 0) * (e.height || 0)
const firstTag = e => (box(e.content).firstElementChild || {}).tagName || ''

// Which text box holds the title, which the points (and from which block)
export function slideParts(slide) {
  const elements = slide.elements || []
  const texts = elements.filter(e => e.type === 'text')
  const title = texts.find(e => e.outline === 'title')
    || texts.filter(e => TITLE_BLOCK.test(firstTag(e))).sort((a, b) => (a.y - b.y) || (a.x - b.x))[0]
    || null
  let body = texts.find(e => e.outline === 'body' && e !== title) || null
  if (!body && title && box(title.content).children.length > 1) body = title
  if (!body) {
    const rest = texts.filter(e => e !== title && e.outline !== 'title')
    const lists = rest.filter(e => /<(ul|ol)[\s>]/i.test(e.content || ''))
    body = (lists.length ? lists : rest).slice().sort((a, b) => area(b) - area(a))[0] || null
  }
  return { title, body, from: body && body === title ? 1 : 0, others: elements.filter(e => e !== title && e !== body) }
}

const TYPE_NAMES = {
  text: 'Text', image: 'Image', video: 'Video', audio: 'Audio', shape: 'Shape', table: 'Table', code: 'Code',
  latex: 'LaTeX', markdown: 'Markdown', html: 'HTML', graph: 'Graph', equation: 'Equation', timeline: 'Timeline',
  model: '3D model', molecule: 'Molecule', periodic: 'Periodic table', harmonics: 'Spherical harmonics',
  geometry: 'Geometry', venn: 'Venn diagram', timing: 'Timing diagram', feynman: 'Feynman diagram',
  circuit: 'Circuit', logic: 'Logic diagram', freebody: 'Free-body diagram', tikz: 'TikZ', diagram: 'Diagram',
  drawing: 'Drawing', p5: 'p5 sketch', textpath: 'Text path', text3d: '3D text', kinetic: 'Kinetic text',
}
export function describe(e) {
  const name = TYPE_NAMES[e.type] || (e.type ? e.type[0].toUpperCase() + e.type.slice(1) : 'Element')
  const words = e.type === 'text' ? textOf(e.content) : clean(e.alt || e.label || e.name || '')
  return words ? name + ' · ' + (words.length > 48 ? words.slice(0, 47) + '…' : words) : name
}

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

export const notesOf = s => (s.notes ? String(s.notes).split('\n') : [])

// Every line, in order. referencesCount: the references slide made from the
// deck's citations, shown last when there is one
export function outlineLines(deck, { referencesCount = 0 } = {}) {
  const slides = (deck && deck.slides) || []
  const order = slideOrder(slides), starts = sectionStarts(slides, order), out = []
  order.forEach(({ index, vertical }, k) => {
    const s = slides[index], id = s.id
    if (starts.has(index)) out.push({ kind: 'section', key: 'sec:' + id, slideId: id, index, text: s.section || '' })
    const { title, body, from, others } = slideParts(s)
    const head = title && box(title.content).firstElementChild
    out.push({ kind: 'slide', key: id, slideId: id, index, n: k + 1, vertical, html: head ? head.innerHTML : '', elementId: title ? title.id : null })
    if (body) pointsIn(box(body.content), from).forEach((p, j) => out.push({ kind: 'point', key: id + ':p' + j, slideId: id, index, j, level: Math.min(p.level, MAX_LEVEL), html: p.node.innerHTML, elementId: body.id }))
    others.forEach(e => out.push({ kind: 'item', key: 'el:' + e.id, slideId: id, index, elementId: e.id, label: describe(e) }))
    notesOf(s).forEach((text, n) => out.push({ kind: 'note', key: id + ':n' + n, slideId: id, index, n, text }))
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
function withElement(deck, id, elementId, fn) {
  return withSlide(deck, id, s => ({ ...s, elements: s.elements.map(e => (e.id === elementId ? fn(e) : e)) }))
}
const newId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))
const topZ = s => (s.elements || []).reduce((z, e) => Math.max(z, e.zIndex || 0), 0)

// A slide's points as a list to change, then written back to its box
function editPoints(deck, id, fn) {
  const i = slideIndex(deck, id)
  if (i < 0) return null
  const { body, from } = slideParts(deck.slides[i])
  if (!body) return null
  const d = box(body.content)
  const ps = pointsIn(d, from)
  const r = fn(ps, d)
  if (r === false) return null
  children(d).forEach(b => { if (LIST.test(b.tagName) && !b.children.length) b.remove() })
  return withElement(deck, id, body.id, e => ({ ...e, content: d.innerHTML }))
}
function liFor(html) {
  const li = make('li'), p = make('p')
  p.innerHTML = html
  li.appendChild(p)
  return li
}
// Points [{ html, level }] added after a box's last point, in its last list
// when it ends with one
function appendPoints(d, from, items) {
  if (!items.length) return
  let list = children(d).slice(from).filter(b => LIST.test(b.tagName)).pop()
  if (!list || list !== d.lastElementChild) { list = make('ul'); d.appendChild(list) }
  const stack = [list]
  items.forEach(it => {
    const level = Math.max(0, Math.min(it.level, stack.length))
    stack.length = level + 1
    if (!stack[level]) {
      const parent = stack[level - 1].lastElementChild
      let sub = parent && subListOf(parent)
      if (!sub) { sub = make('ul'); (parent || stack[level - 1]).appendChild(sub) }
      stack[level] = sub
    }
    stack[level].appendChild(liFor(it.html))
  })
}
// Moves a list item into the one before it, or out to its parent's list,
// as a word processor does
function indentItem(li) {
  const prev = li.previousElementSibling
  if (!prev || prev.tagName !== 'LI') return false
  let sub = subListOf(prev)
  if (!sub) { sub = make(li.parentNode.tagName); prev.appendChild(sub) }
  sub.appendChild(li)
  return true
}
function outdentItem(li) {
  const list = li.parentNode, parent = list && list.parentNode
  if (!parent || parent.tagName !== 'LI') return false
  const later = []
  for (let n = li.nextElementSibling; n; n = n.nextElementSibling) later.push(n)
  if (later.length) {
    let sub = subListOf(li)
    if (!sub) { sub = make(list.tagName); li.appendChild(sub) }
    later.forEach(n => sub.appendChild(n))
  }
  parent.after(li)
  if (!list.children.length) list.remove()
  return true
}
// Takes a point out, its sub-points moving up into its place
function removeItem(p) {
  if (!p.li) { p.node.remove(); return }
  const sub = subListOf(p.li)
  if (sub) children(sub).forEach(c => p.li.parentNode.insertBefore(c, p.li))
  const list = p.li.parentNode
  p.li.remove()
  if (!list.children.length && list.parentNode && list.parentNode.tagName === 'LI') list.remove()
}

// The default box for slides the outline makes, scaled to the deck's size
function outlineBox(slideW, slideH, html, z = 1) {
  return { id: newId(), type: 'text', x: Math.round(60 * slideW / 960), y: Math.round(40 * slideH / 540), width: Math.round(840 * slideW / 960), height: Math.round(440 * slideH / 540), zIndex: z, content: html }
}
// A new slide at `at`, in the column, section and background of `like`,
// with a title and points
function newSlide(deck, at, like, titleHtml, items, { slideW = 960, slideH = 540 } = {}) {
  const d = box('<h2>' + titleHtml + '</h2>')
  appendPoints(d, 1, items)
  const s = {
    id: newId(),
    ...(like && like.column !== undefined ? { column: like.column } : {}),
    elements: [outlineBox(slideW, slideH, d.innerHTML)],
    notes: '',
    background: like && like.background ? { ...like.background } : { type: 'color', color: '#1e1e2e' },
    ...(like && like.section ? { section: like.section } : {}),
  }
  const slides = deck.slides.slice()
  slides.splice(at, 0, s)
  return { deck: { ...deck, slides }, slide: s }
}
const newSlideAfter = (deck, after, titleHtml, items, opts) => newSlide(deck, after + 1, deck.slides[after], titleHtml, items, opts)
// Nothing typed: no text, math or citation
const isBlank = html => !textOf(html) && !/data-(math|cite)/.test(html)
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

// Typing into a line
export function setTitle(deck, slideId, html, opts = {}) {
  const i = slideIndex(deck, slideId)
  if (i < 0) return deck
  const { title } = slideParts(deck.slides[i])
  if (title) {
    return withElement(deck, slideId, title.id, e => {
      const d = box(e.content)
      let h = d.firstElementChild
      if (!h) { h = make('h2'); d.appendChild(h) }
      h.innerHTML = html
      return { ...e, content: d.innerHTML }
    })
  }
  if (!textOf(html)) return deck
  // A slide with no title gets a box for one along its top
  const { slideW = 960, slideH = 540 } = opts
  return withSlide(deck, slideId, s => ({
    ...s,
    elements: [...s.elements, { id: newId(), type: 'text', outline: 'title', x: Math.round(60 * slideW / 960), y: Math.round(30 * slideH / 540), width: Math.round(840 * slideW / 960), height: Math.round(84 * slideH / 540), zIndex: topZ(s) + 1, content: '<h2>' + html + '</h2>' }],
  }))
}
export function setPoint(deck, slideId, j, html) {
  return editPoints(deck, slideId, ps => { if (!ps[j]) return false; ps[j].node.innerHTML = html }) || deck
}
export function setNote(deck, slideId, n, text) {
  return withSlide(deck, slideId, s => { const ns = notesOf(s); ns[n] = text; return { ...s, notes: ns.join('\n') } })
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

// Enter: a new line of the same kind, the text after the cursor going to it
export function enter(deck, line, before, after, opts = {}) {
  const i = slideIndex(deck, line.slideId)
  if (i < 0) return { deck }
  if (line.kind === 'slide') {
    // At the start of a title, a new slide goes before this one (and takes
    // over starting its section)
    if (isBlank(before) && !isBlank(after)) {
      const cur = deck.slides[i]
      const r = newSlide(deck, i, cur, '', [], opts)
      let slides = r.deck.slides
      if (cur.sectionStart) slides = slides.map(x => (x.id === r.slide.id ? { ...x, sectionStart: true } : x.id === cur.id ? { ...x, sectionStart: false } : x))
      return { deck: { ...deck, slides }, focus: [line.key, 0] }
    }
    const d1 = setTitle(deck, line.slideId, before, opts)
    const r = newSlideAfter(d1, i, after, [], opts)
    return { deck: r.deck, focus: [r.slide.id, 0] }
  }
  if (line.kind === 'point') {
    if (isBlank(before) && isBlank(after)) return outdent(deck, line, opts)
    const d = editPoints(deck, line.slideId, ps => {
      const p = ps[line.j]
      if (!p) return false
      p.node.innerHTML = before
      if (p.li) {
        const li = liFor(after)
        const sub = subListOf(p.li)
        // A point with sub-points gets its new one as the first of them
        if (sub) sub.insertBefore(li, sub.firstElementChild); else p.li.after(li)
      } else {
        const q = make('p')
        q.innerHTML = after
        p.node.after(q)
      }
    })
    return d ? { deck: d, focus: [line.slideId + ':p' + (line.j + 1), 0] } : { deck }
  }
  if (line.kind === 'note') {
    const d = withSlide(deck, line.slideId, s => { const ns = notesOf(s); ns.splice(line.n, 1, before, after); return { ...s, notes: ns.join('\n') } })
    return { deck: d, focus: [line.slideId + ':n' + (line.n + 1), 0] }
  }
  return { deck }
}

// Tab: a point under the one above it; a slide into the slide above, as a point
export function indent(deck, line, opts = {}) {
  const i = slideIndex(deck, line.slideId)
  if (i < 0) return { deck }
  if (line.kind === 'point') {
    let why = null
    const d = editPoints(deck, line.slideId, ps => {
      const p = ps[line.j]
      if (!p) return false
      if (!p.li) { why = 'Only a point in a list can go under another'; return false }
      if (p.level >= MAX_LEVEL) return false
      if (!indentItem(p.li)) { why = 'The first point in a list has nothing above it to go under'; return false }
    })
    return d ? { deck: d, focus: [line.key, null] } : why ? { refused: why } : { deck }
  }
  if (line.kind === 'slide') {
    const order = slideOrder(deck.slides), at = order.findIndex(o => o.index === i)
    if (at <= 0) return { refused: 'The first slide has no slide above it to join' }
    const s = deck.slides[i], { title, body, from, others } = slideParts(s)
    const kept = others.map(describe)
    if (clean(s.notes)) kept.push('speaker notes')
    if (kept.length) return { refused: 'Slide ' + (at + 1) + ' has ' + listOf(kept) + ', which would be lost as a point. Move ' + (kept.length > 1 ? 'them' : 'it') + ' to another slide first.' }
    const prev = deck.slides[order[at - 1].index]
    const head = title && box(title.content).firstElementChild
    const items = [{ html: head ? head.innerHTML : '', level: 0 }]
    if (body) pointsIn(box(body.content), from).forEach(p => items.push({ html: p.node.innerHTML, level: Math.min(p.level + 1, MAX_LEVEL) }))
    const prevParts = slideParts(prev)
    const before = prevParts.body ? pointsIn(box(prevParts.body.content), prevParts.from).length : 0
    let d = addPoints(deck, prev, items, opts)
    d = removeSlideAt(d, slideIndex(d, s.id))
    return { deck: d, focus: [prev.id + ':p' + before, 'start'] }
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
const listOf = xs => { const u = [...new Set(xs)]; return u.length < 3 ? u.join(' and ') : u.slice(0, -1).join(', ') + ' and ' + u[u.length - 1] }
// Points added at the end of a slide's, in its box of points, else under its
// title, else in a box of their own
function addPoints(deck, slide, items, { slideW = 960, slideH = 540 } = {}) {
  const { title, body, from } = slideParts(slide)
  const target = body || title
  if (target) {
    return withElement(deck, slide.id, target.id, e => {
      const d = box(e.content)
      appendPoints(d, body ? from : 1, items)
      return { ...e, content: d.innerHTML }
    })
  }
  const d = box('')
  appendPoints(d, 0, items)
  return withSlide(deck, slide.id, s => ({ ...s, elements: [...s.elements, { ...outlineBox(slideW, slideH, d.innerHTML, topZ(s) + 1), outline: 'body' }] }))
}

// Shift+Tab: a sub-point up a level; a point becomes a slide of its own,
// taking the points below it; a slide starts a section
export function outdent(deck, line, opts = {}) {
  const i = slideIndex(deck, line.slideId)
  if (i < 0) return { deck }
  if (line.kind === 'point') {
    if (line.level > 0) {
      const d = editPoints(deck, line.slideId, ps => { const p = ps[line.j]; if (!p || !p.li || !outdentItem(p.li)) return false })
      return d ? { deck: d, focus: [line.key, null] } : { deck }
    }
    let html = '', moved = []
    const d = editPoints(deck, line.slideId, (ps, root) => {
      const p = ps[line.j]
      if (!p) return false
      html = p.node.innerHTML
      // Its sub-points become the new slide's points, then the points after it
      const rest = ps.slice(line.j + 1)
      let k = 0
      while (k < rest.length && rest[k].level > p.level) { moved.push({ html: rest[k].node.innerHTML, level: rest[k].level - 1 }); k++ }
      rest.slice(k).forEach(q => moved.push({ html: q.node.innerHTML, level: q.level }))
      const gone = [p, ...rest]
      gone.forEach(q => (q.li ? q.li.remove() : q.node.remove()))
      // Lists left empty go too
      Array.from(root.querySelectorAll('ul, ol')).reverse().forEach(l => { if (!l.children.length) l.remove() })
    })
    if (!d) return { deck }
    const r = newSlideAfter(d, slideIndex(d, line.slideId), html, moved, opts)
    return { deck: r.deck, focus: [r.slide.id, 'start'] }
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

// Backspace at the start of a line: an empty line goes; a point joins the
// one above; a sub-point goes up a level. Null when it does nothing.
export function backspace(deck, line, isEmpty, prevKey) {
  const i = slideIndex(deck, line.slideId)
  if (i < 0) return null
  const s = deck.slides[i]
  if (line.kind === 'point') {
    if (isEmpty) {
      const d = editPoints(deck, line.slideId, ps => { if (!ps[line.j]) return false; removeItem(ps[line.j]) })
      return d ? { deck: d, focus: prevKey ? [prevKey, 'end'] : null } : null
    }
    if (line.level > 0) return outdent(deck, line)
    if (line.j === 0) return null
    let at = 0
    const d = editPoints(deck, line.slideId, ps => {
      const p = ps[line.j], q = ps[line.j - 1]
      if (!p || !q || (p.li && subListOf(p.li))) return false
      at = clean(q.node.textContent).length
      while (p.node.firstChild) q.node.appendChild(p.node.firstChild)
      removeItem(p)
    })
    return d ? { deck: d, focus: [line.slideId + ':p' + (line.j - 1), at] } : null
  }
  if (line.kind === 'slide' && isEmpty) {
    const { body, from, others } = slideParts(s)
    const hasPoints = body && pointsIn(box(body.content), from).some(p => clean(p.node.textContent))
    if (hasPoints || others.length || clean(s.notes) || deck.slides.length < 2) return { refused: 'This slide still has things on it, so Backspace keeps it' }
    return { deck: removeSlideAt(deck, i), focus: prevKey ? [prevKey, 'end'] : null }
  }
  if (line.kind === 'note' && isEmpty) {
    return { deck: withSlide(deck, line.slideId, x => { const ns = notesOf(x); ns.splice(line.n, 1); return { ...x, notes: ns.join('\n') } }), focus: prevKey ? [prevKey, 'end'] : null }
  }
  if (line.kind === 'section' && isEmpty) {
    const r = indent(deck, line)
    return { deck: r.deck, focus: prevKey ? [prevKey, 'end'] : r.focus }
  }
  return null
}

// ── A line's inline HTML ──────────────────────────────────────────────────
// What a line keeps of what's typed into it: TipTap's marks, links, math and
// citations; anything else is unwrapped to its text
const INLINE = {
  STRONG: [], B: [], EM: [], I: [], U: [], S: [], CODE: [], BR: [], SUB: [],
  A: ['href', 'target', 'rel'],
  SPAN: ['style', 'class', 'data-math-latex', 'data-math-display', 'data-math-fontsize', 'data-math-color', 'data-cite'],
  MARK: ['style', 'data-color'],
  SUP: ['style', 'data-cite'],
}
// The zero-width space a line puts beside math and citations, so the cursor
// has somewhere to go at its ends; never written back
export const CARET_SLOT = String.fromCharCode(0x200b)
const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'SVG', 'MATH', 'TEXTAREA', 'SELECT'])
export function cleanInline(html) {
  const src = box(html), out = make('div')
  const copy = (from, to) => Array.from(from.childNodes).forEach(n => {
    if (n.nodeType === 3) { to.appendChild(doc().createTextNode(n.textContent.split(CARET_SLOT).join(''))); return }
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
  // The <br> a browser leaves at the end of an edited line
  while (out.lastChild && out.lastChild.nodeName === 'BR') out.removeChild(out.lastChild)
  return out.innerHTML
}
// The same HTML as reading it back from the deck gives
export const normalizeInline = html => box(html).innerHTML

// For showing in a line: math and citations become pieces that can't be
// typed into, each keeping the HTML it's written back as
export function atomize(html) {
  const d = box(html)
  d.querySelectorAll('span[data-math-latex], sup[data-cite], span[data-cite]').forEach(a => {
    const src = a.outerHTML
    a.setAttribute('data-outline-src', src)
    a.setAttribute('contenteditable', 'false')
  })
  return d.innerHTML
}
// A line's HTML, from what's in it
export function lineHtml(el) {
  const c = doc().importNode(el, true)
  c.querySelectorAll('[data-outline-src]').forEach(a => {
    const t = box(a.getAttribute('data-outline-src'))
    a.replaceWith(...Array.from(t.childNodes))
  })
  return cleanInline(c.innerHTML)
}
