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
// them: the figure is cut the same way, and a piece left with nothing to
// draw isn't made (keptRuns). A part can be drawn in another color
// (recolor, toFigure.js's recolorOf): its pieces' fills and strokes in its
// color, its markers' too, but not its words.

import { runsOf, planOf, keptRuns } from './toFigure'

const NS = 'http://www.w3.org/2000/svg'
// What draws, and what holds what's only drawn where it's used
const DRAWS = new Set(['path', 'use', 'text', 'image', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'])
const ASIDE = new Set(['defs', 'clipPath', 'marker', 'symbol', 'pattern', 'mask', 'style', 'metadata', 'title', 'desc', 'linearGradient', 'radialGradient', 'filter'])

export class SplitError extends Error {}

// { pieces: [{ part, run, svg, backdrop }], plan, width, height, type, ext }
// (width and height: the viewBox's, for the shape on the slide; backdrop:
// that a piece has a background in it, clear or not)
export function splitSvg(text, layers, { backdrop = [], clear = false, recolor = new Map(), Parser = globalThis.DOMParser, Serializer = globalThis.XMLSerializer } = {}) {
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
  const back = backdropOf(els, backdrop)
  const runs = runsOf(els.map(el => partOf(el, owner))).map(r => {
    let n = 0
    for (let i = r.from; i <= r.to; i++) if (back[i]) n++
    return { ...r, backdrop: n > 0, empty: clear && n === r.size }
  })

  const pieces = keptRuns(runs).map(r => {
    const d = fresh()
    drawn(d.documentElement).forEach((el, i) => { if (i < r.from || i > r.to || (clear && back[i])) el.remove() })
    dropEmpty(d)
    pruneDefs(d)
    const swap = recolor.get(r.part)
    if (swap) recolorSvg(d, swap.from, swap.to)
    return { part: r.part, run: r.run, svg: new Serializer().serializeToString(d), backdrop: r.backdrop }
  })

  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const width = vb.length === 4 && vb[2] > 0 ? vb[2] : parseFloat(svg.getAttribute('width')) || 0
  const height = vb.length === 4 && vb[3] > 0 ? vb[3] : parseFloat(svg.getAttribute('height')) || 0
  return { pieces, plan: planOf(runs), width, height, type: 'image/svg+xml', ext: 'svg' }
}

// Of what's drawn, whether each is in a background's group
function backdropOf(els, groups) {
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
