// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A matplotlib SVG cut into its base (the axes, ticks, labels, legend, and
// whatever isn't a layer) and one SVG per layer, all on the same canvas: one
// over another they're the figure as it was saved, so each layer can come
// and go on a slide while the rest stays exactly as drawn. A layer is the
// SVG groups plotModel.js found drawing it (layer.groups: its line2d,
// PathCollection, LineCollection and patch groups).
//
// matplotlib defines a marker or a glyph once, inside the first group that
// draws it, and reuses it elsewhere; so every <defs> moves to the top first,
// and each SVG keeps only the definitions it uses.

const NS = 'http://www.w3.org/2000/svg'
const KEEP = new Set(['defs', 'style', 'metadata', 'title', 'desc'])

export class SplitError extends Error {}

// { base, layers: [{ id, svg }], width, height } (width and height: the
// viewBox's, for the shape on the slide)
export function splitSvg(text, layers, { Parser = globalThis.DOMParser, Serializer = globalThis.XMLSerializer } = {}) {
  const doc = new Parser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg || svg.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new SplitError('This file isn’t an SVG that could be read')
  if (!layers.length || layers.some(l => !l.groups || !l.groups.length)) throw new SplitError('Only a figure saved as SVG by matplotlib can be kept as it is')
  hoistDefs(doc, svg)
  const source = new Serializer().serializeToString(doc)
  const fresh = () => new Parser().parseFromString(source, 'image/svg+xml')

  const all = new Set(layers.flatMap(l => l.groups))
  // The base: everything but the layers
  const baseDoc = fresh()
  for (const id of all) byId(baseDoc, id)?.remove()
  pruneDefs(baseDoc)

  const out = layers.map(layer => {
    const d = fresh()
    const keep = new Set(layer.groups)
    keepOnly(d.documentElement, keep)
    pruneDefs(d)
    return { id: layer.id, svg: new Serializer().serializeToString(d) }
  })

  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const width = vb.length === 4 && vb[2] > 0 ? vb[2] : parseFloat(svg.getAttribute('width')) || 0
  const height = vb.length === 4 && vb[3] > 0 ? vb[3] : parseFloat(svg.getAttribute('height')) || 0
  return { base: new Serializer().serializeToString(baseDoc), layers: out, width, height }
}

const byId = (doc, id) => [...doc.getElementsByTagName('*')].find(e => e.getAttribute('id') === id) || null

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

// Only the kept groups, and the groups around them
function keepOnly(el, keep) {
  for (const child of [...el.childNodes]) {
    if (child.nodeType !== 1) { if (child.nodeType === 3 && child.nodeValue.trim()) child.remove(); continue }
    if (KEEP.has(child.localName)) continue
    if (keep.has(child.getAttribute('id'))) continue
    if (holds(child, keep)) keepOnly(child, keep)
    else child.remove()
  }
}
const holds = (el, keep) => [...el.getElementsByTagName('*')].some(e => keep.has(e.getAttribute('id')))

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
