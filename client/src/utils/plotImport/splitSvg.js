// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A matplotlib SVG cut into pieces, all on the same canvas, in the order it
// draws them: runs of what one layer draws, or of what none does (the axes,
// ticks, labels, legend), as toFigure.js has it. One over another they're
// the figure as it was saved, so each layer can come and go on a slide while
// the rest stays exactly as drawn. A layer is the SVG groups plotModel.js
// found drawing it (layer.groups: its line2d, PathCollection,
// LineCollection and patch groups).
//
// matplotlib defines a marker or a glyph once, inside the first group that
// draws it, and reuses it elsewhere; so every <defs> moves to the top first,
// and each piece keeps only the definitions it uses.
//
// The figure's background and the axes' (backdrop: their patch groups,
// plotModel.js) can be left out, clear, as savefig(transparent=True) leaves
// them, and the legends' boxes (frames) left with only their outlines: the
// figure is cut the same way, and a piece left with nothing to draw isn't
// made (keptRuns). A part can be drawn in another color (recolor,
// toFigure.js's recolorOf): its pieces' fills and strokes in its color, its
// markers' too, but not its words. And the figure can be made for a dark
// slide (dark): every gray turned over, black text and lines white and white
// backgrounds black, but for what the data parts draw (data: the layers, a
// figure legend's entries: dataParts), of which only the words are. A
// title's or an axis label's words can be changed (labels: plotModel.js's,
// with text, the new words, and face, the font they're drawn in): they're
// drawn again as matplotlib draws text (glyphs.js), lined up as before.

import { runsOf, planOf, keptRuns } from './toFigure'
import { textOutline, advanceOf, shiftFor } from './glyphs'

const NS = 'http://www.w3.org/2000/svg'
// What draws, and what holds what's only drawn where it's used
const DRAWS = new Set(['path', 'use', 'text', 'image', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'])
const ASIDE = new Set(['defs', 'clipPath', 'marker', 'symbol', 'pattern', 'mask', 'style', 'metadata', 'title', 'desc', 'linearGradient', 'radialGradient', 'filter'])

export class SplitError extends Error {}

// { pieces: [{ part, run, svg, backdrop, inked, labels }], plan, width,
// height, type, ext } (width and height: the viewBox's, for the shape on the
// slide; backdrop: that a piece has a background or a legend's box in it,
// clear or not; inked: that it's drawn differently for a dark slide; labels:
// the ids of the titles and labels in it)
export function splitSvg(text, layers, { backdrop = [], frames = [], clear = false, recolor = new Map(), dark = false, dataParts = new Set(), labels = [], Parser = globalThis.DOMParser, Serializer = globalThis.XMLSerializer } = {}) {
  const doc = new Parser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg || svg.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new SplitError('This file isn’t an SVG that could be read')
  if (!layers.length || layers.some(l => !l.groups || !l.groups.length)) throw new SplitError('Only a figure saved by matplotlib can be kept as it is')
  hoistDefs(doc, svg)
  const source = new Serializer().serializeToString(doc)
  const fresh = () => new Parser().parseFromString(source, 'image/svg+xml')

  const owner = new Map()
  for (const l of layers) for (const g of l.groups) owner.set(g, l.id)
  const els = drawn(svg)
  const back = within(els, backdrop)
  const frame = within(els, frames)
  const words = els.map(inWords)
  const labelOf = new Map(labels.filter(l => l.gid).map(l => [l.gid, l]))
  const label = els.map(el => { for (let e = el; e && e.nodeType === 1; e = e.parentNode) { const l = labelOf.get(e.getAttribute('id')); if (l) return l } return null })
  const runs = runsOf(els.map(el => partOf(el, owner))).map(r => {
    let n = 0, framed = false, worded = false
    const named = new Set()
    for (let i = r.from; i <= r.to; i++) { if (back[i]) n++; if (frame[i]) framed = true; if (words[i]) worded = true; if (label[i]) named.add(label[i]) }
    return { ...r, backdrop: n > 0 || framed, inked: !dataParts.has(r.part) || worded, labels: [...named], empty: clear && n === r.size }
  })
  const height = viewBoxOf(svg)[1]

  const pieces = keptRuns(runs).map(r => {
    const d = fresh()
    drawn(d.documentElement).forEach((el, i) => {
      if (i < r.from || i > r.to || (clear && back[i])) el.remove()
      else if (clear && frame[i]) setPaint(el, 'fill', 'none')
    })
    for (const l of r.labels) if (l.text !== undefined) relabelSvg(d, l, height)
    dropEmpty(d)
    pruneDefs(d)
    const swap = recolor.get(r.part)
    if (swap) recolorSvg(d, swap.from, swap.to)
    if (dark) darkSvg(d, dataParts.has(r.part))
    return { part: r.part, run: r.run, svg: new Serializer().serializeToString(d), backdrop: r.backdrop, inked: r.inked, labels: r.labels.map(l => l.id) }
  })

  const [width] = viewBoxOf(svg)
  return { pieces, plan: planOf(runs), width, height, type: 'image/svg+xml', ext: 'svg' }
}

// An SVG's width and height: its viewBox's, else its own
function viewBoxOf(svg) {
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  return [vb.length === 4 && vb[2] > 0 ? vb[2] : parseFloat(svg.getAttribute('width')) || 0,
    vb.length === 4 && vb[3] > 0 ? vb[3] : parseFloat(svg.getAttribute('height')) || 0]
}

// A title's or axis label's words drawn again: label.text, in label.face.
// matplotlib draws words as their glyphs, in a group placed at their start
// (translate, rotate, then scale to their size from 100 points), each glyph
// at its place along the line; so where they started, how long they were and
// how they're turned is read from there (else, words set another way, such as
// math, from where the reading found them). The new ones start where they keep
// the same point lined up with the axes (label.align), in the old ones' color
function relabelSvg(doc, label, height) {
  const g = [...doc.getElementsByTagName('g')].find(e => e.getAttribute('id') === label.gid)
  if (!g) return
  const inner = [...g.children].find(c => c.localName === 'g' && /translate\(/.test(c.getAttribute('transform') || ''))
  const m = inner && /^\s*translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)\s*\)(?:\s*rotate\(\s*([-\d.e]+)\s*\))?\s*scale\(\s*([-\d.e]+)/.exec(inner.getAttribute('transform'))
  let x, y, turn, size, width
  if (m) {
    x = +m[1]; y = +m[2]; turn = +(m[3] || 0); size = +m[4] * 100
    let end = 0
    for (const u of inner.getElementsByTagName('use')) {
      const code = /-([0-9a-f]+)$/i.exec(u.getAttribute('xlink:href') || u.getAttribute('href') || '')
      const at = +(/translate\(\s*([-\d.e]+)/.exec(u.getAttribute('transform') || '')?.[1] || 0)
      end = Math.max(end, at + (code ? advanceOf(label.face, String.fromCodePoint(parseInt(code[1], 16))) : 60))
    }
    width = end * size / 100
  } else {
    x = label.x; y = height - label.y; turn = -label.angle; size = label.size; width = label.w
  }
  const style = inner?.getAttribute('style') || null
  for (const c of [...g.childNodes]) {
    if (c.nodeType === 8) c.nodeValue = ` ${String(label.text).replace(/--/g, '- -')} `
    else c.remove()
  }
  if (!String(label.text).trim()) return
  const out = textOutline(label.face, label.text, size)
  const a = turn * Math.PI / 180, shift = shiftFor(label.align, width, out.width)
  const NS_ = g.namespaceURI || NS
  const words = doc.createElementNS(NS_, 'g')
  words.setAttribute('transform', `translate(${num(x + Math.cos(a) * shift)} ${num(y + Math.sin(a) * shift)})${turn ? ` rotate(${num(turn)})` : ''}`)
  if (style) words.setAttribute('style', style)
  const path = doc.createElementNS(NS_, 'path')
  path.setAttribute('d', out.d)
  words.appendChild(path)
  g.appendChild(words)
}
const num = v => String(Math.round(v * 1e6) / 1e6)

// Of what's drawn, whether each is in one of these groups
function within(els, groups) {
  const ids = new Set(groups)
  return els.map(el => {
    for (let e = el; e && e.nodeType === 1; e = e.parentNode) if (ids.has(e.getAttribute('id'))) return true
    return false
  })
}

// What's drawn, in the order it's drawn
function drawn(svg) {
  const out = []
  const walk = el => {
    for (const child of [...el.children]) {
      if (ASIDE.has(child.localName)) continue
      if (DRAWS.has(child.localName)) out.push(child)
      else walk(child)
    }
  }
  walk(svg)
  return out
}

// The layer whose group it's in, or 'base'
function partOf(el, owner) {
  for (let e = el; e && e.nodeType === 1; e = e.parentNode) {
    const id = e.getAttribute('id')
    if (id && owner.has(id)) return owner.get(id)
  }
  return 'base'
}

// A piece's drawing in another color: from → to wherever it fills or
// strokes (in a style, or as an attribute), in the definitions it uses (its
// markers) too; not in its words (a legend entry's label), which keep theirs
function recolorSvg(doc, from, to) {
  const swap = v => v.replace(/(fill|stroke)(\s*:\s*)(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g, (m, k, sep, c) => (hexColor(c) === from ? `${k}${sep}${to}` : m))
  for (const el of doc.getElementsByTagName('*')) {
    if (inWords(el)) continue
    const style = el.getAttribute('style')
    if (style) el.setAttribute('style', swap(style))
    for (const a of ['fill', 'stroke']) if (hexColor(el.getAttribute(a)) === from) el.setAttribute(a, to)
  }
}
// #rgb or #rrggbb as #rrggbb, else null
function hexColor(v) {
  const c = String(v || '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(c)) return c
  return /^#[0-9a-f]{3}$/.test(c) ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : null
}
const inWords = el => { for (let e = el; e && e.nodeType === 1; e = e.parentNode) if (/^text_\d+$/.test(e.getAttribute('id') || '')) return true; return false }

// A piece made for a dark slide: every gray it draws with (black words,
// spines and ticks, white backgrounds, a legend's box and its light gray
// outline) turned over, light for dark; colors as they were. wordsOnly: a
// data part's, whose words only are (its markers, its definitions, stay)
function darkSvg(doc, wordsOnly) {
  const svg = doc.documentElement
  for (const el of drawn(svg)) {
    if (el.localName === 'image' || (wordsOnly && !inWords(el))) continue
    for (const prop of ['fill', 'stroke']) { const turned = turnGray(paintOf(el, prop)); if (turned) setPaint(el, prop, turned) }
  }
  if (wordsOnly) return
  // The definitions what's drawn uses (a tick's marker) have their own
  const defs = [...svg.children].find(n => n.localName === 'defs')
  for (const el of defs ? [...defs.getElementsByTagName('*')] : []) {
    for (const prop of ['fill', 'stroke']) { const turned = turnGray(ownPaint(el, prop)); if (turned) setPaint(el, prop, turned) }
  }
}
// A gray (near enough: its channels within GRAY of each other) turned over;
// null for a color, or no paint
const GRAY = 16
function turnGray(paint) {
  const hex = hexColor({ black: '#000000', white: '#ffffff' }[paint] || paint)
  if (!hex) return null
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  if (Math.max(...rgb) - Math.min(...rgb) > GRAY) return null
  return `#${rgb.map(c => (255 - c).toString(16).padStart(2, '0')).join('')}`
}
// A fill or a stroke as drawn: its own, else what it's in has, else SVG's
// own (a black fill, no stroke)
function paintOf(el, prop) {
  for (let e = el; e && e.nodeType === 1; e = e.parentNode) { const own = ownPaint(e, prop); if (own && own !== 'inherit') return own }
  return prop === 'fill' ? '#000000' : 'none'
}
// An element's own fill or stroke, in its style or as an attribute
function ownPaint(el, prop) {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(el.getAttribute('style') || '')
  return ((m ? m[1] : el.getAttribute(prop)) || '').trim().toLowerCase() || null
}
function setPaint(el, prop, value) {
  const style = el.getAttribute('style') || ''
  const re = new RegExp(`((?:^|;)\\s*${prop}\\s*:\\s*)[^;]+`)
  const base = style.trim().replace(/;\s*$/, '')
  el.setAttribute('style', re.test(style) ? style.replace(re, `$1${value}`) : base ? `${base}; ${prop}: ${value}` : `${prop}: ${value}`)
  el.removeAttribute(prop)
}

// Groups with nothing left in them, gone (the innermost first)
function dropEmpty(doc) {
  for (const g of [...doc.getElementsByTagName('g')].reverse()) if (!g.children.length) g.remove()
}

// Every <defs>'s contents into one at the top: a definition used outside the
// group that holds it still has one when that group goes
function hoistDefs(doc, svg) {
  const top = doc.createElementNS(NS, 'defs')
  for (const defs of [...svg.getElementsByTagName('defs')]) {
    while (defs.firstChild) top.appendChild(defs.firstChild)
    defs.remove()
  }
  svg.insertBefore(top, svg.firstChild)
}

// The definitions nothing left uses, gone
function pruneDefs(doc) {
  const svg = doc.documentElement
  const defs = [...svg.childNodes].find(n => n.nodeType === 1 && n.localName === 'defs')
  if (!defs) return
  const byName = new Map()
  for (const d of defs.children) { const id = d.getAttribute('id'); if (id) byName.set(id, d) }
  const used = new Set()
  const visit = el => {
    for (const id of refsOf(el)) {
      if (used.has(id) || !byName.has(id)) continue
      used.add(id)
      visit(byName.get(id))
    }
  }
  for (const el of svg.getElementsByTagName('*')) {
    if (defs.contains(el)) continue
    visit(el)
  }
  for (const [id, d] of byName) if (!used.has(id)) d.remove()
}

// The ids an element and what's inside it refer to: href="#id", url(#id)
function refsOf(el) {
  const out = []
  for (const e of [el, ...el.getElementsByTagName('*')]) {
    for (const a of e.attributes) {
      if ((a.name === 'href' || a.name === 'xlink:href') && a.value.startsWith('#')) out.push(a.value.slice(1))
      for (const m of a.value.matchAll(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g)) out.push(m[1])
    }
  }
  return out
}
