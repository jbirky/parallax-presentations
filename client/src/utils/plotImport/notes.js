// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Annotations on a kept figure (PlotImportModal.jsx): a callout (words, and
// an arrow from them to a point), a ring round a point, or a box over a
// stretch of the data, with words beside it. Each is pinned to its place in
// the data, through its panel's axes (log ones too), or, on axes whose
// numbers don't read, to its place on the figure; and each is made of the
// slide's own elements in the figure's group (a text box, a line arrow, a
// circle, a rectangle), to restyle and move like any other, coming and going
// at its own steps as a layer does.
//
// A note: { id, kind ('arrow', 'ring', 'box'), panel, at: [x, y] (in the
// data; frac: as shares of the figure's width and height, up from its
// bottom left), to: [x, y] (a box's other corner), text, offset: [dx, dy]
// (where its words' middle is from the point, or from a box's top left
// corner, as shares of the figure's width and height, down positive), step,
// until }. Each of its elements keeps it (figure.note) and what it is of it
// (figure.role: 'text', 'arrow', 'ring', 'box'), to be read back (readNotes).

import { figureLayers, stepsOf, setSteps } from './toFigure'

// A panel's axes, or the figure's own (one panel): { box, x, y }, each axis
// with its scale and range; null for axes whose numbers don't read
export function axesFor(plot, panel) {
  if (!panel) return plot.panels ? null : plot.axes || null
  return plot.panels?.find(p => p.id === panel)?.axes || null
}

const lin = (v, scale) => (scale === 'log' ? Math.log10(v) : v)
const unlin = (v, scale) => (scale === 'log' ? 10 ** v : v)
function forth(axis, b0, b1, v) {
  const [r0, r1] = axis.range.map(r => lin(r, axis.scale))
  return b0 + ((lin(v, axis.scale) - r0) / (r1 - r0)) * (b1 - b0)
}
function back(axis, b0, b1, p) {
  const [r0, r1] = axis.range.map(r => lin(r, axis.scale))
  return unlin(r0 + ((p - b0) / (b1 - b0)) * (r1 - r0), axis.scale)
}

// A point in the data → on the figure (points, up from its bottom left), and back
export const toPage = (axes, [x, y]) => [forth(axes.x, axes.box.x0, axes.box.x1, x), forth(axes.y, axes.box.y0, axes.box.y1, y)]
export const toData = (axes, [px, py]) => [back(axes.x, axes.box.x0, axes.box.x1, px), back(axes.y, axes.box.y0, axes.box.y1, py)]

// A note's point (or a box's corner) on the figure
export function pageOf(plot, note, at = note.at) {
  const axes = !note.frac && axesFor(plot, note.panel)
  if (axes) return toPage(axes, at)
  return [at[0] * plot.size.width, at[1] * plot.size.height]
}

// Where a point on the figure is: { panel, axes, at, frac }, in the panel
// it's over (the innermost, an inset in its parent), else the nearest; at,
// in its data, or as shares of the figure where its axes don't read
export function placeOf(plot, [px, py]) {
  const panels = plot.panels || [{ id: null, box: plot.axes.box, axes: plot.axes }]
  const away = b => Math.hypot(Math.max(b.x0 - px, 0, px - b.x1), Math.max(b.y0 - py, 0, py - b.y1))
  const area = b => (b.x1 - b.x0) * (b.y1 - b.y0)
  const p = [...panels].sort((a, b) => away(a.box) - away(b.box) || area(a.box) - area(b.box))[0]
  const axes = p?.id ? p.axes : axesFor(plot, null)
  if (axes) return { panel: p.id, axes, at: toData(axes, [px, py]), frac: false }
  return { panel: p?.id ?? null, axes: null, at: [px / plot.size.width, py / plot.size.height], frac: true }
}

// The layer's data point nearest a point on the figure, within `within`
// points, in the panel it's in: { layer, at } or null
export function snapTo(plot, panel, axes, [px, py], within) {
  if (!axes) return null
  let best = null, gap = within
  for (const layer of figureLayers(plot).filter(l => (l.panel ?? null) === (panel ?? null))) {
    const { x, y, x2 } = layer.data
    for (let i = 0; i < x.length; i++) {
      const dx = x2 ? (x[i] + x2[i]) / 2 : x[i]
      if (!isFinite(dx) || !isFinite(y[i])) continue
      const [qx, qy] = toPage(axes, [dx, y[i]])
      const d = Math.hypot(qx - px, qy - py)
      if (d < gap) { gap = d; best = { layer, at: [dx, y[i]] } }
    }
  }
  return best
}

// Words' size on the slide, about a figure's own (its labels'), but no
// smaller than reads from the back of a room
export const noteSize = (plot, box) => Math.max(16, Math.round((plot.labels?.[0]?.size || 10) * (box.width / plot.size.width) * 1.25))

// Where a note's words go, first: a callout's up and to the right of its
// point (to its left in the right of the figure, below it near the top); a
// ring's beside it; a box's over its top left corner
export function defaultOffset(plot, note, box) {
  const [px, py] = pageOf(plot, note)
  const fx = px / plot.size.width, fy = 1 - py / plot.size.height
  const [bw, bh] = wordsBox(note.text, noteSize(plot, box))
  const tw = bw / box.width / 2, th = bh / box.height / 2
  if (note.kind === 'box') return [tw, -th - 0.01]
  if (note.kind === 'ring') return fx > 0.7 ? [-(0.035 + tw), -0.04] : [0.035 + tw, -0.04]
  return [fx > 0.65 ? -(0.06 + tw) : 0.06 + tw, fy < 0.3 ? 0.12 : -0.12]
}

const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// How wide words are, roughly (a little over), at a size, in the slide's sans-serif
const wordsWidth = (s, fs) => Math.max(fs, String(s || '').length * fs * 0.6)
// A text box's padding, as the slide draws one (x, y)
const PAD = [12, 8]
// A text box's words, plain
export const plainText = html => String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()

// A note's elements on the figure at box (the slide's px), in its group:
// [{ ...element }], ids from newId (or old, by role, to keep them). ink: its
// color (white on a figure made for a dark slide)
export function noteElements(plot, note, { box, groupId, meta = {}, z = 10, dark = false, newId = () => crypto.randomUUID(), old = {} } = {}) {
  const W = plot.size.width, H = plot.size.height
  const onSlide = ([px, py]) => [box.x + (px / W) * box.width, box.y + (1 - py / H) * box.height]
  const ink = dark ? '#ffffff' : '#000000'
  const fs = noteSize(plot, box)
  const lw = Math.max(2, Math.round(fs / 8))
  const [ax, ay] = onSlide(pageOf(plot, note))
  const out = []
  const element = (role, fields) => {
    const el = { ...(old[role] || {}), id: old[role]?.id || newId(), ...fields, zIndex: z + out.length, groupId, figure: { ...meta, part: 'note', run: 0, role, note: { ...note } } }
    setSteps(el, stepsOf(note))
    out.push(el)
    return el
  }
  const shape = (shapeName, fields) => shapeElement(shapeName, ink, fields)
  const name = nameOf(note)

  // What it marks: a ring round the point, a box over the stretch
  let corner = [ax, ay]
  if (note.kind === 'ring') {
    const d = Math.round(fs * 1.8)
    element('ring', shape('circle', { x: Math.round(ax - d / 2), y: Math.round(ay - d / 2), width: d, height: d, fill: 'none', stroke: ink, strokeWidth: lw, name: `${name} · ring` }))
  } else if (note.kind === 'box') {
    const [bx, by] = onSlide(pageOf(plot, note, note.to || note.at))
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by)
    corner = [x0, y0]
    element('box', shape('rect', { x: Math.round(x0), y: Math.round(y0), width: Math.max(4, Math.round(x1 - x0)), height: Math.max(4, Math.round(y1 - y0)), fill: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', stroke: ink, strokeWidth: Math.max(1, lw - 1), name: `${name} · box` }))
  }

  // Its words, where they go from the point (or the box's corner)
  if (note.text) {
    const [tw, th] = wordsBox(note.text, fs)
    const [dx, dy] = note.offset || defaultOffset(plot, note, box)
    const cx = corner[0] + dx * box.width, cy = corner[1] + dy * box.height
    const text = element('text', {
      type: 'text', x: Math.round(cx - tw / 2), y: Math.round(cy - th / 2), width: tw, height: th,
      content: `<p style="text-align: center; font-size: ${fs}px; line-height: ${fs + 10}px"><span style="color: ${ink}; font-size: ${fs}px">${escape(note.text)}</span></p>`, name,
    })
    // A callout's arrow: from the edge of its words to just short of the point
    if (note.kind === 'arrow') {
      const arrow = arrowBetween(insetWords(text), [ax, ay], lw)
      if (arrow) element('arrow', shape('line-arrow', { ...arrow, fill: 'none', stroke: ink, strokeWidth: lw, name: `${name} · arrow` }))
    }
  } else if (note.kind === 'arrow') {
    // No words: an arrow from up and to the left
    const from = { x: ax - fs * 3.2, y: ay - fs * 3.2, width: 0, height: 0 }
    const arrow = arrowBetween(from, [ax, ay], lw)
    if (arrow) element('arrow', shape('line-arrow', { ...arrow, fill: 'none', stroke: ink, strokeWidth: lw, name: `${name} · arrow` }))
  }
  return out
}

const shapeElement = (shape, ink, fields) => ({ type: 'shape', shape, opacity: 1, text: '', fontSize: 16, textColor: ink, borderRadius: 0, ...fields })
const nameOf = note => (note.text ? `Annotation: ${note.text}` : 'Annotation')

// Whether a note's place and words are as they were (its steps aside)
const sameNote = (a, b) => JSON.stringify([a.kind, a.panel, a.at, a.to, !!a.frac, a.text, a.offset]) === JSON.stringify([b.kind, b.panel, b.at, b.to, !!b.frac, b.text, b.offset])

// A figure's notes' elements, after its pieces (from z). A note read back
// (read: readNotes's, by id) and not changed since keeps its elements as
// they are on the slide (restyled, its words moved), its arrow drawn again
// from where its words are now; a new note, a changed one, or every one when
// the figure's ink changed (restyle), is made afresh, its elements' ids kept
export function notesOnFigure(plot, notes, { box, groupId, meta = {}, z = 10, dark = false, read = new Map(), restyle = false, newId = () => crypto.randomUUID() } = {}) {
  const out = []
  const stamp = (el, note, role) => {
    const done = { ...el, zIndex: z + out.length, groupId, figure: { ...meta, part: 'note', run: 0, role, note: { ...note } } }
    setSteps(done, stepsOf(note))
    out.push(done)
  }
  for (const note of notes) {
    const was = read.get(note.id)
    if (was && !restyle && sameNote(was.note, note)) {
      for (const role of ['ring', 'box', 'text']) if (was.elements[role]) stamp(was.elements[role], note, role)
      const text = was.elements.text
      if (note.kind === 'arrow' && text) {
        const old = was.elements.arrow
        const lw = old?.strokeWidth || Math.max(2, Math.round(noteSize(plot, box) / 8))
        const place = arrowBetween(insetWords(text), pointOf(plot, note, box), lw)
        if (place) stamp({ ...(old || shapeElement('line-arrow', dark ? '#ffffff' : '#000000', { fill: 'none', stroke: dark ? '#ffffff' : '#000000', strokeWidth: lw, name: `${nameOf(note)} · arrow` })), id: old?.id || newId(), ...place }, note, 'arrow')
      }
      continue
    }
    out.push(...noteElements(plot, note, { box, groupId, meta, z: z + out.length, dark, newId, old: was?.elements || {} }))
  }
  return out
}

// An arrow's ends, from the edge of a box of words (x, y, width, height) to
// just short of a point: [[sx, sy], [ex, ey]], or null when they touch
export function arrowEnds(text, [ax, ay]) {
  const cx = text.x + text.width / 2, cy = text.y + text.height / 2
  const dx = ax - cx, dy = ay - cy
  const len = Math.hypot(dx, dy)
  if (!len) return null
  // Out of the words' box, and a little more
  const t = Math.min(dx ? (text.width / 2) / Math.abs(dx) : Infinity, dy ? (text.height / 2) / Math.abs(dy) : Infinity)
  if (t >= 1) return null
  const s = [cx + dx * t + (dx / len) * 4, cy + dy * t + (dy / len) * 4]
  const e = [ax - (dx / len) * 3, ay - (dy / len) * 3]
  return Math.hypot(e[0] - s[0], e[1] - s[1]) < 10 ? null : [s, e]
}

// A line arrow's place (a line across its box, turned about its middle) from
// the edge of a text box to just short of a point; null when they touch
export function arrowBetween(text, at, lw = 2) {
  const ends = arrowEnds(text, at)
  if (!ends) return null
  const [[sx, sy], [ex, ey]] = ends
  const width = Math.round(Math.hypot(ex - sx, ey - sy) + 2 * lw), height = Math.max(16, lw * 8)
  const mx = (sx + ex) / 2, my = (sy + ey) / 2
  const turn = Math.round(((Math.atan2(ey - sy, ex - sx) * 180) / Math.PI + 360) % 360)
  return { x: Math.round(mx - width / 2), y: Math.round(my - height / 2), width, height, rotation: turn }
}

// Where a note's point (or a box's top left corner) is on the slide, the
// figure at box
export function cornerOf(plot, note, box) {
  const W = plot.size.width, H = plot.size.height
  const onSlide = ([px, py]) => [box.x + (px / W) * box.width, box.y + (1 - py / H) * box.height]
  const at = onSlide(pageOf(plot, note))
  if (note.kind !== 'box') return at
  const far = onSlide(pageOf(plot, note, note.to || note.at))
  return [Math.min(at[0], far[0]), Math.min(at[1], far[1])]
}

// A note's point on the slide
export function pointOf(plot, note, box) {
  const [px, py] = pageOf(plot, note)
  return [box.x + (px / plot.size.width) * box.width, box.y + (1 - py / plot.size.height) * box.height]
}

// The text box for a note's words at a size, its padding in it: [width, height]
export const wordsBox = (text, fs) => [Math.round(wordsWidth(text, fs) + 2 * PAD[0] + 8), Math.round(fs + 10 + 2 * PAD[1] + 2)]
// The words in a text box, inside its padding
export const insetWords = r => ({ x: r.x + PAD[0], y: r.y + PAD[1], width: Math.max(0, r.width - 2 * PAD[0]), height: Math.max(0, r.height - 2 * PAD[1]) })

// The notes a figure's elements have, as they are now: { note, elements:
// { [role]: element } }, its words as the text box has them, and where they
// are from its point as the text box is (moved on the slide, say)
export function readNotes(elements, plot, box) {
  const byNote = new Map()
  for (const e of elements || []) {
    const n = e.figure?.part === 'note' && e.figure.note
    if (!n?.id) continue
    if (!byNote.has(n.id)) byNote.set(n.id, { note: { ...n }, elements: {} })
    byNote.get(n.id).elements[e.figure.role] = e
  }
  for (const { note, elements: els } of byNote.values()) {
    const text = els.text
    if (!text) continue
    const words = plainText(text.content)
    if (words && words !== note.text) note.text = words
    if (plot && box) {
      const corner = cornerOf(plot, note, box)
      note.offset = [(text.x + text.width / 2 - corner[0]) / box.width, (text.y + text.height / 2 - corner[1]) / box.height]
    }
  }
  return [...byNote.values()]
}
