// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Venn diagram elements, made in VennEditorModal (toolbar: Diagrams → Venn
// Diagram). An element holds up to four sets, the shapes they're drawn as,
// and one set expression: the regions it names are shaded. vennExpr.js reads
// expressions and works out the numbers in the regions; vennGeometry.js has
// the regions' outlines. This draws it (vennSvg: the canvas, thumbnails,
// decks, printed pages, PPTX), writes it as TikZ, builds steps from the
// expression, and has its templates and the editor's changes.
//
// Layers add shading, each from the step it appears at until the step it
// goes after, so a slide can build an answer up. An expression with = or ⊆
// draws both sides, and a verdict on whether the relation holds. In a deck
// everything is drawn once, marked with its steps (diagramCore's step
// script shows it); nothing is worked out there.

import { MATH_FONT, texBox, texSvg, texLiteHtml, texRuns } from './diagramCore'
import {
  parse, tokenize, evaluate, format, simplest, cover, popcount, fullMask, has, regionsOf, regionAst, regionNumber,
  solveFacts, placeMembers, listNames,
} from './vennExpr'
import { VENN_LAYOUTS, layoutGeometry, regionPolys, hatchSegments, dotPoints } from './vennGeometry'

export const VENN_UNIT = 56   // px per cm in the drawing's own coordinates
export const VENN_FIELDS = ['sets', 'layout', 'shapes', 'universe', 'notation', 'outlines', 'expr', 'builtFrom', 'result', 'layers', 'regions', 'facts', 'members', 'verdict', 'captions', 'color', 'stepStart', 'dimPast']
export const SET_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7']
export const SHADE_COLOR = '#818cf8'
export const VENN_SWATCHES = ['#818cf8', '#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#94a3b8']
export const VENN_STYLES = [
  { id: 'fill', name: 'Solid' }, { id: 'hatch-ne', name: 'Lines ╱' }, { id: 'hatch-nw', name: 'Lines ╲' },
  { id: 'hatch-h', name: 'Lines ─' }, { id: 'hatch-v', name: 'Lines │' }, { id: 'dots', name: 'Dots' }, { id: 'outline', name: 'Outline' },
]
const STYLE_IDS = VENN_STYLES.map(s => s.id)
const HATCH_DEG = { 'hatch-ne': 45, 'hatch-nw': 135, 'hatch-h': 0, 'hatch-v': 90 }
const TIKZ_PATTERN = { 'hatch-ne': 'north east lines', 'hatch-nw': 'north west lines', 'hatch-h': 'horizontal lines', 'hatch-v': 'vertical lines', dots: 'dots' }
export const UNIVERSE_LABELS = ['U', 'S', '\\Omega', '\\xi', '\\mathcal{E}']
const REL_TEX = { '=': '=', '≠': '\\neq', '⊆': '\\subseteq', '⊇': '\\supseteq', '⊂': '\\subsetneq', '⊃': '\\supsetneq' }
const REL_TEXT = { '=': ' = ', '≠': ' ≠ ', '⊆': ' ⊆ ', '⊇': ' ⊇ ', '⊂': ' ⊊ ', '⊃': ' ⊋ ' }
const GAP = 1.6            // cm between the two sides of a relation
const LABEL_FS = 0.46      // cm, set labels
const UNIVERSE_FS = 0.44
const CAPTION = 0.3
const OK = '#22c55e', BAD = '#ef4444'

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n1 = v => String(Math.round(v * 10) / 10)
const f2 = v => { const r = Math.round(v * 100) / 100; return String(Object.is(r, -0) ? 0 : r) }

// ---------- The model

const HEX = /^#[0-9a-f]{6}$/i
const ID = /^[A-Za-z0-9_-]{1,40}$/
const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
const int = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d)
const str = (v, max, d = '') => (typeof v === 'string' ? v.slice(0, max) : d)
const oneOf = (v, list, d) => (list.includes(v) ? v : d)

// The element's diagram, with anything it can't draw left out or set to its default
export function vennModel(el) {
  const sets = []
  for (const s of Array.isArray(el?.sets) ? el.sets.slice(0, 4) : []) {
    if (!s || !/^[A-Za-z]$/.test(s.id) || sets.some(x => x.id === s.id)) continue
    sets.push({ id: s.id, label: str(s.label, 80, s.id), color: HEX.test(s.color || '') ? s.color : SET_COLORS[sets.length] })
  }
  if (!sets.length) for (const id of ['A', 'B', 'C']) sets.push({ id, label: id, color: SET_COLORS[sets.length] })
  const n = sets.length
  const presets = VENN_LAYOUTS[n]
  let layout = typeof el?.layout === 'string' ? el.layout : presets[0].id
  let shapes = Array.isArray(el?.shapes) && el.shapes.length === n
    ? el.shapes.map(s => ({ x: num(s?.x, -20, 20, 0), y: num(s?.y, -20, 20, 0), rx: num(s?.rx, 0.3, 6, 1.5), ry: num(s?.ry, 0.3, 6, 1.5), rot: num(s?.rot, -180, 180, 0) }))
    : null
  if (!shapes) {
    const p = presets.find(l => l.id === layout) || presets[0]
    layout = p.id
    shapes = p.shapes.map(s => ({ ...s }))
  } else if (layout !== 'custom' && !presets.some(l => l.id === layout)) layout = 'custom'
  const u = el?.universe || {}, r = el?.result || {}, g = el?.regions || {}, v = el?.verdict || {}
  const layers = [], ids = new Set()
  for (const L of Array.isArray(el?.layers) ? el.layers.slice(0, 40) : []) {
    if (!L || !ID.test(L.id) || ids.has(L.id)) continue
    ids.add(L.id)
    const step = int(L.step, 0, 1000, 0)
    const until = Number.isInteger(L.until) ? Math.min(1000, Math.max(step, L.until)) : null
    layers.push({ id: L.id, expr: str(L.expr, 400), style: oneOf(L.style, STYLE_IDS, 'fill'), color: HEX.test(L.color || '') ? L.color : null, step, until, panel: L.panel === 1 ? 1 : 0 })
  }
  const captions = {}
  for (const [k, c] of Object.entries(el?.captions && typeof el.captions === 'object' ? el.captions : {})) {
    const i = Number(k)
    if (Number.isInteger(i) && i >= 0 && i <= 1000 && typeof c === 'string' && c.trim()) captions[i] = c.slice(0, 300)
  }
  const members = {}
  const mem = el?.members && typeof el.members === 'object' ? el.members : {}
  for (const k of ['U', ...sets.map(s => s.id)]) if (typeof mem[k] === 'string' && mem[k].trim()) members[k] = mem[k].slice(0, 600)
  const rs = Array.isArray(r.steps) ? r.steps : []
  return {
    sets, layout, shapes,
    universe: { show: u.show !== false, label: str(u.label, 40, 'U').trim() || 'U' },
    notation: { complement: oneOf(el?.notation?.complement, ['prime', 'c', 'bar'], 'prime') },
    outlines: oneOf(el?.outlines, ['ink', 'sets'], 'ink'),
    expr: str(el?.expr, 400),
    // The expression Build It Up wrote the steps for, to say when they're out of date
    builtFrom: str(el?.builtFrom, 400),
    result: { style: oneOf(r.style, STYLE_IDS, 'fill'), color: HEX.test(r.color || '') ? r.color : null, steps: [int(rs[0], 0, 1000, 0), int(rs[1], 0, 1000, 0)] },
    layers,
    regions: {
      label: oneOf(g.label, ['none', 'roman', 'name'], 'none'),
      values: oneOf(g.values, ['none', 'counts', 'probability', 'elements'], 'none'),
      reveal: oneOf(g.reveal, ['together', 'inside-out'], 'together'),
      step: int(g.step, 0, 1000, 0),
    },
    facts: (Array.isArray(el?.facts) ? el.facts : []).filter(f => typeof f === 'string').slice(0, 40).map(f => f.slice(0, 160)),
    members,
    verdict: { show: v.show !== false, step: int(v.step, 0, 1000, 0) },
    captions,
    color: HEX.test(el?.color || '') ? el.color : '#ffffff',
    stepStart: int(el?.stepStart, 1, 1000, 1),
    dimPast: !!el?.dimPast,
  }
}

export const ctxOf = m => ({ ids: m.sets.map(s => s.id), universe: m.universe.label })
// out: 'tex', 'text' or 'html'
export const styleOf = (m, out) => ({ out, comp: m.notation.complement, ids: m.sets.map(s => s.id), universe: m.universe.label })
// A rewritten expression keeps the syntax it was typed in
export const inputSyntax = m => (/\\/.test(m.expr) || !m.expr.trim() ? 'tex' : 'text')
const labelSize = (tex, fs) => { const b = texBox(tex, fs * VENN_UNIT); return { w: b.w / VENN_UNIT, h: fs * 1.15 } }

export function vennGeometry(m) {
  return layoutGeometry(m.shapes, m.sets.map(s => labelSize(s.label, LABEL_FS)), m.universe.show ? labelSize(m.universe.label, UNIVERSE_FS) : null)
}

// ---------- Everything worked out from the model

export function analyzeVenn(m) {
  const n = m.sets.length, ctx = ctxOf(m), all = fullMask(n)
  const a = { n, all, ctx, sides: [], masks: [], rel: null, err: null, parsed: null, layers: [], warnings: [], notes: [] }
  try {
    const p = parse(m.expr, ctx)
    a.parsed = p
    if (p.ast.t === 'rel') { a.rel = p.ast.op; a.sides = [p.ast.a, p.ast.b] } else a.sides = [p.ast]
    a.masks = a.sides.map(s => evaluate(s, n))
  } catch (e) { if (!e.venn) throw e; a.err = e }
  a.layers = m.layers.map(L => {
    try {
      const p = parse(L.expr, ctx)
      if (p.ast.t === 'rel') return { L, err: 'A layer shades one set, not a relation.' }
      return { L, mask: evaluate(p.ast, n), ast: p.ast }
    } catch (e) { if (!e.venn) throw e; return { L, err: e.message } }
  })
  a.g = vennGeometry(m)
  a.visible = a.g.drawn & (m.universe.show ? all : all & ~1)
  const nameOf = r => format(regionAst(r, n), styleOf(m, 'text'))
  const listMask = mask => listNames(regionsOf(mask, n).map(nameOf))
  a.nameOf = nameOf
  a.listMask = listMask
  a.masks.forEach((mask, p) => {
    const lost = mask & ~a.g.drawn
    const several = popcount(lost) > 1
    if (lost) a.notes.push(`${listMask(lost)} ${several ? 'are' : 'is'} shaded${a.rel ? (p ? ' on the right' : ' on the left') : ''}, but this layout leaves no room for ${several ? 'them' : 'it'}, so ${several ? 'they count' : 'it counts'} as empty.`)
    if (!m.universe.show && (mask & 1)) a.warnings.push(`The outside, ${nameOf(0)}, is shaded, but the universe isn’t drawn.`)
  })
  if (a.rel) a.verdict = verdictOf(a.rel, a.masks[0], a.masks[1], a.g.drawn, all, listMask)
  const shaded = a.masks.length === 1 ? a.masks[0] : null
  if (m.regions.values === 'counts' || m.regions.values === 'probability') a.num = solveFacts(m.facts.join('\n'), ctx, n, m.regions.values, shaded)
  if (m.regions.values === 'elements') a.mem = placeMembers(m.members, ctx.ids)
  a.maxStep = maxStep(m, a)
  a.staleBuild = m.layers.length > 0 && !!m.builtFrom && m.builtFrom !== m.expr
  return a
}

function verdictOf(op, L, R, drawn, all, listMask) {
  const judge = room => {
    const onlyL = L & ~R & room, onlyR = R & ~L & room
    const holds = op === '=' ? !onlyL && !onlyR : op === '≠' ? !!(onlyL || onlyR) : op === '⊆' ? !onlyL : op === '⊇' ? !onlyR : op === '⊂' ? !onlyL && !!onlyR : !onlyR && !!onlyL
    return { holds, onlyL, onlyR }
  }
  const v = judge(drawn), anyway = judge(all)
  const isAre = mask => (popcount(mask) > 1 ? 'are' : 'is')
  let text
  if (op === '=' || op === '≠') {
    if (!v.onlyL && !v.onlyR) text = 'Both sides shade the same regions.'
    else text = [v.onlyL && `${listMask(v.onlyL)} ${isAre(v.onlyL)} shaded only on the left.`, v.onlyR && `${listMask(v.onlyR)} ${isAre(v.onlyR)} shaded only on the right.`].filter(Boolean).join(' ')
  } else if (op === '⊆' || op === '⊂') {
    text = v.onlyL ? `${listMask(v.onlyL)} ${isAre(v.onlyL)} shaded on the left but not on the right.` : 'Every region shaded on the left is shaded on the right.'
    if (op === '⊂' && !v.onlyL && !v.onlyR) text += ' But the sides are equal, so it isn’t a proper subset.'
  } else {
    text = v.onlyR ? `${listMask(v.onlyR)} ${isAre(v.onlyR)} shaded on the right but not on the left.` : 'Every region shaded on the right is shaded on the left.'
    if (op === '⊃' && !v.onlyL && !v.onlyR) text += ' But the sides are equal, so it isn’t a proper superset.'
  }
  const short = op === '=' ? (v.holds ? 'Equal' : 'Not equal') : op === '≠' ? (v.holds ? 'Not equal' : 'Equal after all') : (v.holds ? 'Holds' : 'Doesn’t hold')
  const layoutNote = v.holds !== anyway.holds ? `Only because this layout leaves no room for ${listMask(all & ~drawn & (L ^ R))}.` : ''
  return { holds: v.holds, text, short, layoutNote }
}

export function valueStep(m, n, r) {
  return m.regions.reveal === 'inside-out' ? m.regions.step + (n - popcount(r)) : m.regions.step
}
export function maxStep(m, a) {
  let s = 0
  for (const L of m.layers) { s = Math.max(s, L.step); if (L.until != null) s = Math.max(s, L.until) }
  for (let p = 0; p < Math.max(1, a.sides.length); p++) s = Math.max(s, m.result.steps[p])
  if (a.rel && m.verdict.show) s = Math.max(s, m.verdict.step)
  if (m.regions.values !== 'none') s = Math.max(s, valueStep(m, a.n, 0))
  for (const k of Object.keys(m.captions)) s = Math.max(s, +k)
  return Math.min(s, 1000)
}
export function fmtValue(v, mode) {
  if (v == null) return '?'
  if (mode === 'probability') return String(+v.toFixed(3))
  return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(2)
}

// ---------- Drawing

// The outline of a group of regions as one even-odd path, in px
function regionPath(a, mask, off, u) {
  const g = a.g, X = x => n1((x + off) * u), Y = y => n1(-y * u)
  let d = ''
  for (const r of g.geo.regions) {
    if (!has(mask, r.m) || !has(a.visible, r.m)) continue
    for (const loop of r.loops) {
      if (loop[0].rect) { const b = loop[0].rect; d += `M${X(b.x0)} ${Y(b.y0)}H${X(b.x1)}V${Y(b.y1)}H${X(b.x0)}Z`; continue }
      loop.forEach((seg, k) => {
        const arc = seg.arc, s = g.shapes[arc.i]
        if (k === 0) d += `M${X(seg.start[0])} ${Y(seg.start[1])}`
        const cmd = (p, large) => `A${n1(s.rx * u)} ${n1(s.ry * u)} ${n1(-s.rot)} ${large ? 1 : 0} ${seg.fwd ? 0 : 1} ${X(p[0])} ${Y(p[1])}`
        if (arc.full) d += cmd(g.fns[arc.i].at(arc.t0 + Math.PI), false) + cmd(seg.end, false)
        else d += cmd(seg.end, arc.t1 - arc.t0 > Math.PI)
      })
      d += 'Z'
    }
  }
  return d
}

// The drawing's frame in cm: one side, or two with room between, and room
// under them for the verdict
export function vennFrame(m, a) {
  const box = a.g.box, W = box.x1 - box.x0
  const panels = a.rel ? 2 : 1
  const offs = panels === 2 ? [0, W + GAP] : [0]
  const verdict = a.rel && m.verdict.show ? 0.85 : 0
  return { box, W, panels, offs, x0: box.x0 - 0.12, x1: box.x1 + offs[panels - 1] + 0.12, y0: box.y0 - 0.12 - verdict, y1: box.y1 + 0.12 }
}

// o: ink, labels ('text': SVG text; 'deck': spans KaTeX fills in; or a
// function from TeX to HTML), deck (an id: everything, marked with its
// steps), step (as at that step; default the last), captions, a (the
// analysis, if it's already been done), and for the editor: hover
// ({ p, r }), sel (a set), accent.
export function drawVenn(m, o = {}) {
  const u = VENN_UNIT, ink = o.ink || m.color
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, '') : null
  const a = o.a || analyzeVenn(m)
  const g = a.g, n = a.n, fr = vennFrame(m, a), box = g.box
  const step = deck != null ? null : (o.step == null ? a.maxStep : o.step)
  const shown = (at, until) => deck != null || (step >= at && (until == null || step <= until))
  // What holds from a step on (and, with until, up to a step)
  const part = (at, until, inner) => {
    if (deck == null) return inner
    let s = at > 0 ? `<g class="pxvn-in">${inner}</g>` : inner
    if (until != null) s = `<g data-fx-in="0-${until}">${s}</g>`
    return at > 0 ? `<g class="pxfx-part" data-fx-at="${at}">${s}</g>` : s
  }
  function label(tex, cx, cy, size, color) {
    if (o.labels === 'deck' || typeof o.labels === 'function') {
      const b = texBox(tex, size), w = b.w * 2 + size * 2, h = b.h * 1.6 + size
      const inner = o.labels === 'deck' ? `<span data-math-latex="${esc(tex)}" style="font-family:${esc(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex)
      return `<foreignObject x="${n1(cx - w / 2)}" y="${n1(cy - h / 2)}" width="${n1(w)}" height="${n1(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n1(size / 1.21)}px;color:${esc(color)}">${inner}</div></foreignObject>`
    }
    return texSvg(tex, cx, cy, size, color)
  }
  const text = (t, cx, cy, size, color, extra = '') => `<text x="${n1(cx)}" y="${n1(cy + size * 0.34)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(size)}" fill="${esc(color)}"${extra}>${esc(t)}</text>`
  function shade(mask, style, color, off) {
    mask &= a.visible
    if (!mask) return ''
    if (style === 'fill' || style === 'outline') {
      const d = regionPath(a, mask, off, u)
      return style === 'fill'
        ? `<path d="${d}" fill-rule="evenodd" fill="${esc(color)}" fill-opacity="0.45"/>`
        : `<path d="${d}" fill-rule="evenodd" fill="none" stroke="${esc(color)}" stroke-width="5" stroke-linejoin="round"/>`
    }
    const polys = regionPolys(g, mask & a.visible)
    const X = x => n1((x + off) * u), Y = y => n1(-y * u)
    if (style === 'dots') {
      const r = 0.035 * u
      let d = ''
      for (const [x, y] of dotPoints(polys, 0.18)) d += `M${n1((x + off) * u - r)} ${Y(y)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(2 * r)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-2 * r)} 0`
      return d ? `<path d="${d}" fill="${esc(color)}"/>` : ''
    }
    let d = ''
    for (const [p, q] of hatchSegments(polys, HATCH_DEG[style], 0.15)) d += `M${X(p[0])} ${Y(p[1])}L${X(q[0])} ${Y(q[1])}`
    return d ? `<path d="${d}" stroke="${esc(color)}" stroke-width="1.8" stroke-linecap="round" fill="none"/>` : ''
  }

  let svg = ''
  for (let p = 0; p < fr.panels; p++) {
    const off = fr.offs[p]
    const X = x => (x + off) * u, Y = y => -y * u
    if (m.universe.show) svg += `<rect x="${n1(X(box.x0))}" y="${n1(Y(box.y1))}" width="${n1((box.x1 - box.x0) * u)}" height="${n1((box.y1 - box.y0) * u)}" fill="none" stroke="${esc(ink)}" stroke-width="2"/>`
    // Shading, under the outlines: the expression's, then the layers in order
    const items = []
    if (a.masks[p] != null) items.push({ mask: a.masks[p], style: m.result.style, color: m.result.color || SHADE_COLOR, at: m.result.steps[p], until: null })
    for (const l of a.layers) {
      if (l.err || (fr.panels === 2 && l.L.panel !== p)) continue
      items.push({ mask: l.mask, style: l.L.style, color: l.L.color || SHADE_COLOR, at: l.L.step, until: l.L.until })
    }
    for (const it of items) {
      if (!shown(it.at, it.until)) continue
      const s = shade(it.mask, it.style, it.color, off)
      if (s) svg += part(it.at, it.until, s)
    }
    if (o.hover && o.hover.p === p && o.hover.r != null && has(a.visible, o.hover.r)) {
      svg += `<path d="${regionPath(a, 1 << o.hover.r, off, u)}" fill-rule="evenodd" fill="${esc(o.accent)}" fill-opacity="0.16" stroke="${esc(o.accent)}" stroke-width="2.5" stroke-dasharray="7 5"/>`
    }
    // The sets and their labels
    g.shapes.forEach((s, i) => {
      const color = m.outlines === 'sets' ? m.sets[i].color : ink
      const cx = n1(X(s.x)), cy = n1(Y(s.y)), rot = Math.abs(s.rot) > 1e-9 ? ` transform="rotate(${n1(-s.rot)} ${cx} ${cy})"` : ''
      svg += `<ellipse cx="${cx}" cy="${cy}" rx="${n1(s.rx * u)}" ry="${n1(s.ry * u)}"${rot} fill="none" stroke="${esc(color)}" stroke-width="2.4"/>`
      if (o.sel === i) svg += `<ellipse cx="${cx}" cy="${cy}" rx="${n1(s.rx * u + 6)}" ry="${n1(s.ry * u + 6)}"${rot} fill="none" stroke="${esc(o.accent)}" stroke-width="1.6" stroke-dasharray="6 4"/>`
      const l = g.labels[i]
      svg += label(m.sets[i].label, X(l.x), Y(l.y), LABEL_FS * u, color)
    })
    if (g.ulab) svg += label(m.universe.label, X(g.ulab.x), Y(g.ulab.y), UNIVERSE_FS * u, ink)
    // What's written in the regions
    const vals = m.regions.values, named = m.regions.label !== 'none'
    if (named || vals !== 'none') {
      for (let r = 0; r < (1 << n); r++) {
        const pole = g.poles[r]
        if (!has(a.visible, r) || !pole) continue
        const cx = X(pole.x), cy = Y(pole.y)
        let value = '', rows = []
        if ((vals === 'counts' || vals === 'probability') && a.num) value = fmtValue(a.num.value[r], vals)
        if (vals === 'elements' && a.mem) {
          const items = a.mem.region[r], per = items.length <= 3 ? items.length : items.length <= 6 ? 3 : 4
          for (let k = 0; k < items.length; k += per) rows.push(items.slice(k, k + per).join(',\\ '))
        }
        const vh = value ? 0.42 : rows.length * 0.36
        const nameFs = (m.regions.label === 'name' ? 0.27 : 0.25) * u
        const top = cy - (vh * u + (named ? nameFs * 1.2 : 0)) / 2
        if (named) {
          const ny = top + nameFs * 0.6
          svg += `<g opacity="0.7">${m.regions.label === 'roman' ? text(regionNumber(r, n), cx, ny, nameFs, ink, ' letter-spacing="0.5"') : label(format(regionAst(r, n), styleOf(m, 'tex')), cx, ny, nameFs, ink)}</g>`
        }
        const vy = top + (named ? nameFs * 1.2 : 0)
        const at = valueStep(m, n, r)
        if (value && shown(at, null)) svg += part(at, null, text(value, cx, vy + 0.21 * u, 0.42 * u, ink, a.num.value[r] == null ? ' opacity="0.55"' : ''))
        if (rows.length && shown(at, null)) svg += part(at, null, rows.map((row, k) => label(row, cx, vy + (k + 0.5) * 0.36 * u, 0.32 * u, ink)).join(''))
      }
    }
  }
  // Between the sides, and under them
  if (a.rel) {
    svg += label(REL_TEX[a.rel], (box.x1 + GAP / 2) * u, -((box.y0 + box.y1) / 2) * u, 0.95 * u, ink)
    if (m.verdict.show && a.verdict && shown(m.verdict.step, null)) {
      const v = a.verdict
      svg += part(m.verdict.step, null, text(`${v.holds ? '✓' : '✗'} ${v.short}`, ((fr.x0 + fr.x1) / 2) * u, -(box.y0 - 0.48) * u, 0.4 * u, v.holds ? OK : BAD))
    }
  }
  const pbox = { x0: fr.x0 * u, x1: fr.x1 * u, y0: -fr.y1 * u, y1: -fr.y0 * u }

  // Captions under the diagram, in room kept for them whenever there are any
  const capSteps = Object.keys(m.captions).map(Number).sort((x, y) => x - y)
  if (o.captions && capSteps.length) {
    const cs = CAPTION * u, w = Math.max(pbox.x1 - pbox.x0, 6 * u), cx = (pbox.x0 + pbox.x1) / 2, y = pbox.y1 + cs * 0.6, h = cs * 2.8
    const one = (k, cls) => {
      const t = m.captions[k]
      if (o.labels === 'text' || !o.labels) return `<text${cls} x="${n1(cx)}" y="${n1(y + cs)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(cs)}" fill="${esc(ink)}">${esc(captionText(t))}</text>`
      return `<foreignObject${cls} x="${n1(cx - w / 2)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n1(cs)}px;line-height:1.3;color:${esc(ink)}">${captionHtml(t, o.labels)}</div></foreignObject>`
    }
    if (deck != null) svg += capSteps.map(k => one(k, ` class="pxfx-cap" data-fx-cap="${k}"`)).join('')
    else { const at = capSteps.filter(k => k <= step).pop(); if (at != null) svg += one(at, '') }
    pbox.x0 = Math.min(pbox.x0, cx - w / 2); pbox.x1 = Math.max(pbox.x1, cx + w / 2); pbox.y1 = Math.max(pbox.y1, y + h)
  }
  return { svg, box: pbox, a, frame: fr }
}

// A caption: text with $…$ for maths
function captionHtml(t, labels) {
  return String(t).split(/(\$[^$]*\$)/).map(seg => {
    if (!(seg.length > 1 && seg.startsWith('$') && seg.endsWith('$'))) return esc(seg)
    const tex = seg.slice(1, -1)
    return labels === 'deck' ? `<span data-math-latex="${esc(tex)}" style="font-family:${esc(MATH_FONT)}">${texLiteHtml(tex)}</span>` : labels(tex)
  }).join('')
}
export function captionText(t) {
  return String(t).split(/(\$[^$]*\$)/).map(seg => (seg.length > 1 && seg.startsWith('$') && seg.endsWith('$') ? texRuns(seg.slice(1, -1)).map(r => r.t).join('') : seg)).join('')
}

// ---------- The element

const baseOptions = m => ({ ink: m.color, captions: true })

// The drawing's box in px, with a margin: the element's shape
export function vennBox(el) {
  const m = vennModel(el)
  const { box } = drawVenn(m, baseOptions(m))
  const pad = 0.15 * VENN_UNIT
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad }
}

// The element as an <svg> filling its box. opts: labels, deck (an id:
// everything, marked with its steps), step (as at that step; default the
// last), standalone (with a size, for an image)
export function vennSvg(el, opts = {}) {
  const m = vennModel(el), b = vennBox(el)
  const { svg } = drawVenn(m, { ...baseOptions(m), labels: opts.labels || 'text', deck: opts.deck, step: opts.step ?? null })
  const size = opts.standalone ? ` width="${n1(b.w)}" height="${n1(b.h)}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n1(b.x)} ${n1(b.y)} ${n1(b.w)} ${n1(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`
}

// ---------- Steps

// The diagram steps at which it changes: [[slide step, diagram step]]
export function vennSteps(el) {
  if (el?.type !== 'venn') return []
  const m = vennModel(el), a = analyzeVenn(m), steps = new Set()
  const add = k => { if (k > 0 && k <= a.maxStep) steps.add(k) }
  for (const l of a.layers) if (!l.err) { add(l.L.step); if (l.L.until != null) add(l.L.until + 1) }
  a.masks.forEach((_, p) => add(m.result.steps[p]))
  if (m.regions.values !== 'none') for (let r = 0; r < (1 << a.n); r++) if (has(a.visible, r)) add(valueStep(m, a.n, r))
  if (a.rel && m.verdict.show) add(m.verdict.step)
  for (const k of Object.keys(m.captions)) add(+k)
  return [...steps].sort((x, y) => x - y).map(s => [m.stepStart - 1 + s, s]).filter(([k]) => k <= 1000)
}
export function vennStepAt(el, slideStep) {
  let at = 0
  for (const [k, s] of vennSteps(el)) if (k <= slideStep) at = s
  return at
}
export function vennStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    for (const [k, s] of vennSteps(el)) html += `<span class="fragment" data-fragment-index="${k}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}
export function hasVenn(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'venn'))
}

// ---------- TikZ: each set a path macro, and each shaded piece one term of
// the simplest cover, as a scope of clips. Outside a set is the universe and
// the set clipped together with the even-odd rule. Without Beamer steps, the
// picture is the build's last step.

export function vennTikz(el, opts = {}) {
  const m = vennModel(el), a = analyzeVenn(m)
  if (a.err) return `% Fix the expression to get TikZ: ${a.err.message}`
  const g = a.g, n = a.n, box = g.box, ids = m.sets.map(s => s.id), fr = vennFrame(m, a)
  const colors = new Map()
  const cname = (hex, want) => {
    const key = hex.replace('#', '').toUpperCase()
    if (!colors.has(key)) colors.set(key, want)
    return colors.get(key)
  }
  let layerNo = 0
  const setColor = i => (m.outlines === 'sets' ? cname(m.sets[i].color, 'venn' + ids[i]) : null)
  const shapeDef = s => Math.abs(s.rx - s.ry) < 1e-6
    ? `(${f2(s.x)},${f2(s.y)}) circle [radius=${f2(s.rx)}]`
    : `(${f2(s.x)},${f2(s.y)}) ellipse [x radius=${f2(s.rx)}, y radius=${f2(s.ry)}, rotate=${f2(s.rot)}]`
  const plain = node => format(node, styleOf(m, 'text'))
  const over = (at, until) => {
    if (!opts.beamer || (at <= 0 && until == null)) return null
    return `<${at + 1}-${until != null ? until + 1 : ''}>`
  }
  const final = (at, until) => a.maxStep >= at && (until == null || a.maxStep <= until)
  let patterns = false
  function fill(mask, style, color, comment, at, until, ind) {
    mask &= a.visible
    const terms = cover(mask, n)
    if (!terms.length) return []
    const cn = cname(color, colors.size ? 'vennShade' + (++layerNo) : 'vennShade')
    const paint = style === 'fill' ? `\\fill[${cn}!45] \\universe;`
      : style === 'outline' ? `\\draw[${cn}, line width=2.4pt] \\universe ${ids.map(id => `\\set${id}`).join(' ')};`
        : `\\fill[pattern=${TIKZ_PATTERN[style]}, pattern color=${cn}] \\universe;`
    if (TIKZ_PATTERN[style]) patterns = true
    const ov = over(at, until), pad = ov ? ind + '  ' : ind
    const out = [`${ind}% ${comment}`]
    if (ov) out.push(`${ind}\\only${ov}{`)
    for (const t of terms) {
      const clips = []
      let inverse = false
      for (let i = 0; i < n; i++) {
        if ((t.d >> i) & 1) continue
        if ((t.v >> i) & 1) clips.push(`\\clip \\set${ids[i]};`)
        else { clips.push(`\\clip \\universe \\set${ids[i]};`); inverse = true }
      }
      if (!clips.length) { out.push(pad + paint); continue }
      out.push(`${pad}\\begin{scope}${inverse ? '[even odd rule]' : ''}`)
      for (const c of clips) out.push(`${pad}  ${c}`)
      out.push(`${pad}  ${paint}`, `${pad}\\end{scope}`)
    }
    if (ov) out.push(`${ind}}`)
    return out
  }
  const body = []
  for (let p = 0; p < fr.panels; p++) {
    const ind = fr.panels === 2 ? '    ' : '  '
    if (fr.panels === 2) body.push(`  \\begin{scope}${p ? `[xshift=${f2(fr.offs[p])}cm]` : ''}  % ${p ? 'right' : 'left'} side`)
    if (a.masks[p] != null && (opts.beamer || final(m.result.steps[p], null))) body.push(...fill(a.masks[p], m.result.style, m.result.color || SHADE_COLOR, plain(a.sides[p]), m.result.steps[p], null, ind))
    for (const l of a.layers) {
      if (l.err || (fr.panels === 2 && l.L.panel !== p)) continue
      if (!opts.beamer && !final(l.L.step, l.L.until)) continue
      body.push(...fill(l.mask, l.L.style, l.L.color || SHADE_COLOR, plain(l.ast), l.L.step, l.L.until, ind))
    }
    body.push(`${ind}% The sets${m.universe.show ? ' and the universe' : ''}`)
    ids.forEach((id, i) => { const c = setColor(i); body.push(`${ind}\\draw${c ? `[${c}]` : ''} \\set${id};`) })
    if (m.universe.show) body.push(`${ind}\\draw \\universe;`)
    g.labels.forEach((l, i) => { const c = setColor(i); body.push(`${ind}\\node${c ? `[${c}]` : ''} at (${f2(l.x)},${f2(l.y)}) {$${m.sets[i].label}$};`) })
    if (g.ulab) body.push(`${ind}\\node at (${f2(g.ulab.x)},${f2(g.ulab.y)}) {$${m.universe.label}$};`)
    const vals = m.regions.values
    if (m.regions.label !== 'none' || vals !== 'none') {
      body.push(`${ind}% ${vals === 'none' ? 'Region labels' : vals === 'elements' ? 'Members' : 'What each region holds'}`)
      for (let r = 0; r < (1 << n); r++) {
        const pole = g.poles[r]
        if (!has(a.visible, r) || !pole) continue
        const parts = []
        if (m.regions.label === 'roman') parts.push(`\\textsc{${regionNumber(r, n).toLowerCase()}}`)
        if (m.regions.label === 'name') parts.push(`\\scriptsize$${format(regionAst(r, n), styleOf(m, 'tex'))}$`)
        if ((vals === 'counts' || vals === 'probability') && a.num) parts.push(`$${fmtValue(a.num.value[r], vals)}$`)
        if (vals === 'elements' && a.mem && a.mem.region[r].length) {
          const items = a.mem.region[r], per = items.length <= 3 ? items.length : items.length <= 6 ? 3 : 4, rows = []
          for (let k = 0; k < items.length; k += per) rows.push(items.slice(k, k + per).map(x => `$${x}$`).join(', '))
          parts.push(rows.join('\\\\'))
        }
        if (!parts.length) continue
        const node = `\\node[align=center, font=\\small] at (${f2(pole.x)},${f2(pole.y)}) {${parts.join('\\\\')}};`
        const ov = vals !== 'none' ? over(valueStep(m, n, r), null) : null
        body.push(ov ? `${ind}\\only${ov}{${node}}` : ind + node)
      }
    }
    if (fr.panels === 2) body.push('  \\end{scope}')
  }
  if (a.rel) body.push(`  \\node[font=\\Large] at (${f2(box.x1 + GAP / 2)},${f2((box.y0 + box.y1) / 2)}) {$${REL_TEX[a.rel]}$};`)
  const all = body.join('\n')
  const needs = ['\\usepackage{tikz}']
  if (patterns) needs.push('\\usetikzlibrary{patterns}')
  if (/\\text\b|\\text\{|\\subsetneq|\\supsetneq|\\mathbin/.test(all + m.sets.map(s => s.label).join(''))) needs.push('\\usepackage{amsmath,amssymb}')
  const head = [
    `% Venn diagram: ${a.rel ? plain({ t: 'rel', op: a.rel, a: a.sides[0], b: a.sides[1] }) : plain(a.sides[0])}`,
    `% Needs ${needs.join(', ')}`,
    '\\begin{tikzpicture}[line width=0.8pt]',
  ]
  for (const [hex, name] of colors) head.push(`  \\definecolor{${name}}{HTML}{${hex}}`)
  head.push(`  \\def\\universe{(${f2(box.x0)},${f2(box.y0)}) rectangle (${f2(box.x1)},${f2(box.y1)})}`)
  g.shapes.forEach((s, i) => head.push(`  \\def\\set${ids[i]}{${shapeDef(s)}}`))
  return head.concat(body, ['\\end{tikzpicture}']).join('\n')
}

// The expression as TeX, in the diagram's notation
export function vennExprTex(el) {
  const m = vennModel(el)
  try {
    const p = parse(m.expr, ctxOf(m))
    return format(p.ast, styleOf(m, 'tex'))
  } catch { return m.expr }
}

// ---------- Build It Up: steps from the expression's tree. For each
// operation, from the inside out, one step hatches its operands in two
// directions and the next fills in the result. A set or the complement of a
// set is hatched directly; a complement of something already filled just
// replaces it.

const isLiteral = nd => nd.t === 'set' || nd.t === 'U' || nd.t === 'empty' || (nd.t === 'not' && nd.a.t === 'set')
function opCaption(m, nd) {
  const t = x => '$' + format(x, styleOf(m, 'tex')) + '$'
  switch (nd.t) {
    case 'or': return `${t(nd)} is everything in ${t(nd.a)} or ${t(nd.b)}, or both.`
    case 'and': return `${t(nd)} is where the two overlap.`
    case 'diff': return `${t(nd)} is what's in ${t(nd.a)} but not in ${t(nd.b)}.`
    case 'xor': return `${t(nd)} is what's in exactly one of them.`
    case 'not': return `${t(nd)} is everything outside ${t(nd.a)}.`
  }
  return t(nd)
}
// detail: 'every' (each operation) or 'sides' (one step per side). Changes m in place.
export function buildUp(m, detail = 'every') {
  const a = analyzeVenn(m)
  if (a.err) return false
  const out = inputSyntax(m)
  const fmt = nd => format(nd, styleOf(m, out))
  const capT = nd => '$' + format(nd, styleOf(m, 'tex')) + '$'
  const layers = [], captions = {}, ends = []
  let step = 0, k = 0
  const HATCH = ['hatch-ne', 'hatch-nw'], SPARE = [SET_COLORS[0], SET_COLORS[1]]
  const colorOf = (nd, j) => (nd.t === 'set' ? m.sets[nd.i].color : nd.t === 'not' && nd.a.t === 'set' ? m.sets[nd.a.i].color : SPARE[j])
  const newId = () => { const used = new Set(m.layers.map(l => l.id).concat(layers.map(l => l.id))); while (used.has('l' + (++k))); return 'l' + k }
  a.sides.forEach((root, p) => {
    const side = a.rel ? (p ? 'On the right, ' : 'On the left, ') : ''
    if (detail === 'sides' || isLiteral(root)) {
      step++
      ends[p] = step
      captions[step] = side ? `${side}${capT(root)}.` : `Shade ${capT(root)}.`
      return
    }
    const visit = (nd, isRoot) => {
      if (isLiteral(nd)) return null
      const kids = nd.t === 'not' ? [nd.a] : [nd.a, nd.b]
      const solids = kids.map(c => visit(c, false))
      step++
      if (nd.t === 'not' && solids[0]) solids[0].until = step - 1
      else {
        kids.forEach((c, j) => {
          if (solids[j]) solids[j].until = step - 1
          layers.push({ id: newId(), expr: fmt(c), style: nd.t === 'not' ? 'hatch-ne' : HATCH[j], color: colorOf(c, j), step, until: step, panel: p })
        })
        const first = side && !layers.some(l => l.panel === p && l.step < step)
        const say = nd.t === 'not' ? `start from ${capT(kids[0])}.` : `shade ${capT(kids[0])} one way and ${capT(kids[1])} the other.`
        captions[step] = first ? side + say : say[0].toUpperCase() + say.slice(1)
        step++
      }
      captions[step] = opCaption(m, nd)
      if (isRoot) { ends[p] = step; return null }
      const solid = { id: newId(), expr: fmt(nd), style: 'fill', color: null, step, until: null, panel: p }
      layers.push(solid)
      return solid
    }
    visit(root, true)
  })
  m.layers = layers
  m.result.steps = [ends[0] || 0, ends[1] || 0]
  m.captions = captions
  m.builtFrom = m.expr
  if (a.rel) {
    step++
    m.verdict.step = step
    m.verdict.show = true
    captions[step] = analyzeVenn(m).verdict?.text || ''
  }
  return true
}

// ---------- Templates: the cases the design was checked against

const base = (n, extra = {}, layout) => {
  const p = VENN_LAYOUTS[n].find(l => l.id === layout) || VENN_LAYOUTS[n][0]
  const ids = ['A', 'B', 'C', 'D'].slice(0, n)
  return { sets: ids.map((id, i) => ({ id, label: id, color: SET_COLORS[i] })), layout: p.id, shapes: p.shapes.map(s => ({ ...s })), ...extra }
}
const built = (el, detail) => { const m = vennModel(el); buildUp(m, detail); return m }
export const VENN_TEMPLATES = [
  { key: 'distributive', name: 'A ∩ (B ∪ C), built up', build: () => built(base(3, { expr: 'A \\cap (B \\cup C)' }), 'every') },
  { key: 'demorgan', name: 'De Morgan’s law', build: () => built(base(2, { expr: "(A \\cup B)' = A' \\cap B'" }), 'every') },
  {
    key: 'languages', name: 'Survey: two languages',
    build: () => base(2, {
      sets: [{ id: 'F', label: '\\text{French}', color: SET_COLORS[0] }, { id: 'S', label: '\\text{Spanish}', color: SET_COLORS[1] }],
      expr: "(F \\cup S)'", result: { style: 'fill', steps: [4, 0] },
      regions: { label: 'none', values: 'counts', reveal: 'inside-out', step: 1 },
      facts: ['|U| = 40', '|F| = 22', '|S| = 18', '|F \\cap S| = 7'],
      captions: { 1: 'Start in the middle: $7$ take both.', 2: 'So $22 - 7 = 15$ take only French, and $18 - 7 = 11$ only Spanish.', 3: 'That leaves $40 - 33 = 7$ outside both.', 4: "$|(F \\cup S)'| = 7$ students take neither." },
    }),
  },
  {
    key: 'subjects', name: 'Survey: three subjects',
    build: () => base(3, {
      sets: [{ id: 'M', label: '\\text{Maths}', color: SET_COLORS[0] }, { id: 'P', label: '\\text{Physics}', color: SET_COLORS[1] }, { id: 'C', label: '\\text{Chemistry}', color: SET_COLORS[2] }],
      expr: 'M \\setminus (P \\cup C)', result: { style: 'fill', steps: [5, 0] },
      regions: { label: 'none', values: 'counts', reveal: 'inside-out', step: 1 },
      facts: ['|U| = 100', '|M| = 45', '|P| = 38', '|C| = 30', '|M \\cap P| = 18', '|M \\cap C| = 12', '|P \\cap C| = 10', '|M \\cap P \\cap C| = 5'],
      captions: { 1: '$5$ students take all three.', 2: 'Take $5$ off each pair: $13$, $7$ and $5$ take exactly two.', 3: 'Then the single subjects.', 4: '$22$ take none of them.', 5: 'So $20$ take only maths.' },
    }),
  },
  {
    key: 'members', name: 'Members: multiples of 2 and 3',
    build: () => base(2, {
      expr: 'A \\setminus B', result: { style: 'fill', steps: [1, 0] },
      members: { U: '1..12', A: '2, 4, 6, 8, 10, 12', B: '3, 6, 9, 12' },
      regions: { label: 'none', values: 'elements', reveal: 'together', step: 0 },
      captions: { 1: '$A \\setminus B = \\{2, 4, 8, 10\\}$: even, but not a multiple of 3.' },
    }),
  },
  {
    key: 'probability', name: 'Probability: rain and lateness',
    build: () => base(2, {
      sets: [{ id: 'R', label: '\\text{Rain}', color: SET_COLORS[0] }, { id: 'L', label: '\\text{Late}', color: SET_COLORS[1] }],
      universe: { show: true, label: '\\Omega' }, expr: 'R \\cup L',
      regions: { label: 'none', values: 'probability', reveal: 'together', step: 0 },
      facts: ['P(R) = 0.3', 'P(L) = 0.25', 'P(L | R) = 0.5'],
      captions: { 0: '$P(R \\cup L) = 0.4$: the chance of rain, of lateness, or both.' },
    }),
  },
  { key: 'odd', name: 'Four sets: the odd regions', build: () => base(4, { expr: 'A \\triangle B \\triangle C \\triangle D' }) },
  { key: 'euler', name: 'A inside B: an Euler diagram', build: () => built(base(2, { expr: 'A \\cap B = A' }, 'inside'), 'sides') },
  { key: 'blank', name: 'Blank: three sets', build: () => base(3, { expr: '' }) },
]

// A new diagram: the first template, in the slide's text color
export function defaultVenn(dark = true) {
  return { ...vennModel(VENN_TEMPLATES[0].build()), color: dark ? '#ffffff' : '#1a1a1a', stepStart: 1, dimPast: false }
}

// ---------- Editor helpers: changes to a diagram, made in place

const DEFAULT_EXPR = {
  1: ids => `${ids[0]}'`,
  2: ids => `${ids[0]} \\cap ${ids[1]}`,
  3: ids => `${ids[0]} \\cap (${ids[1]} \\cup ${ids[2]})`,
  4: ids => `(${ids[0]} \\cap ${ids[1]}) \\setminus (${ids[2]} \\cup ${ids[3]})`,
}
// A region shaded or cleared on one side, and the expression rewritten as
// the simplest one for what's shaded there
export function toggleRegion(m, a, p, r) {
  if (a.err || p >= a.masks.length) return
  const masks = a.masks.slice()
  masks[p] ^= 1 << r
  const st = styleOf(m, inputSyntax(m))
  const side = q => (q === p ? format(simplest(masks[q], a.n), st) : format(a.sides[q], st))
  m.expr = a.rel ? side(0) + (st.out === 'tex' ? ` ${REL_TEX[a.rel]} ` : REL_TEXT[a.rel]) + side(1) : side(0)
}
export function setSetCount(m, n) {
  if (n === m.sets.length || n < 1 || n > 4) return
  const sets = []
  for (let i = 0; i < n; i++) {
    if (m.sets[i]) { sets.push(m.sets[i]); continue }
    const id = 'ABCDEFGHJKLMNPQRSTVWXYZ'.split('').find(c => !sets.some(s => s.id === c) && !m.sets.some(s => s.id === c) && c !== m.universe.label)
    sets.push({ id, label: id, color: SET_COLORS[i] })
  }
  m.sets = sets
  const L = VENN_LAYOUTS[n][0]
  m.layout = L.id
  m.shapes = L.shapes.map(s => ({ ...s }))
  try { parse(m.expr, ctxOf(m)) } catch { m.expr = DEFAULT_EXPR[n](sets.map(s => s.id)) }
  m.layers = []
  m.captions = {}
  m.result.steps = [0, 0]
  m.verdict.step = 0
}
export function applyLayout(m, id) {
  const L = VENN_LAYOUTS[m.sets.length].find(l => l.id === id)
  if (!L) return
  m.layout = L.id
  m.shapes = L.shapes.map(s => ({ ...s }))
}
export const layoutName = (L, m) => L.name.replace('{0}', m.sets[0]?.id || 'A').replace('{1}', m.sets[1]?.id || 'B')

// A set's letter changed, in every expression, fact and member list that
// uses it. Returns why it can't be, or null.
export function renameSet(m, i, to) {
  const from = m.sets[i]?.id
  if (!from || from === to) return null
  if (!/^[A-Za-z]$/.test(to)) return 'A set’s letter must be one letter.'
  if (m.sets.some((s, j) => j !== i && s.id === to)) return `Another set is already ${to}.`
  if (to === m.universe.label) return `${to} is the universe’s label.`
  const ctx = ctxOf(m)
  // By token where the expression reads, so the A in AB changes and the a in \cap doesn't
  const swapIn = s => {
    try {
      let out = s
      tokenize(s, ctx).filter(t => t.k === 'set' && t.v === i).sort((x, y) => y.at - x.at).forEach(t => { out = out.slice(0, t.at) + to + out.slice(t.at + t.len) })
      return out
    } catch {
      return s.replace(new RegExp(`(?<![A-Za-z\\\\])${from}(?![A-Za-z])`, 'g'), to)
    }
  }
  m.expr = swapIn(m.expr)
  for (const L of m.layers) L.expr = swapIn(L.expr)
  m.facts = m.facts.map(f => f.replace(new RegExp(`(?<![A-Za-z\\\\])${from}(?![A-Za-z])`, 'g'), to))
  if (m.members[from] != null) { m.members[to] = m.members[from]; delete m.members[from] }
  if (m.sets[i].label === from) m.sets[i].label = to
  m.sets[i].id = to
  return null
}
// A new layer, after everything else
export function addLayer(m, a) {
  const used = new Set(m.layers.map(l => l.id))
  let k = 1
  while (used.has('l' + k)) k++
  const L = { id: 'l' + k, expr: m.sets[0].id, style: 'outline', color: '#ec4899', step: a.maxStep + 1, until: null, panel: 0 }
  m.layers.push(L)
  return L
}
