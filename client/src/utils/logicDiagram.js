// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Logic diagram elements, made in LogicEditorModal (toolbar: Diagrams →
// Logic Diagram). logicParts.js has the model and logicSim.js its signals;
// this draws it (logicSvg: the canvas, thumbnails, decks, printed pages,
// PPTX), writes it as CircuiTikZ and its truth table as LaTeX, and has the
// editor's changes to it.
//
// Signals color the wires (1, 0, unknown), light the outputs and show on the
// inputs, and a truth table can stand beside the diagram with the current
// row lit. Inputs flip and clocks tick at steps. A deck's drawing has each
// part once, marked with its step, and each step's signals in a layer of
// their own (data-fx-in), a wire that changed fading in after those before
// it in the logic; diagramCore's step script shows each step's layer.

import { MATH_FONT, texBox, texSvg, texLiteHtml } from './diagramCore'
import { LOGIC_PARTS, pinsOf, endpoints, route, snapTo, logicModel, inputAt } from './logicParts'
import { simulateLogic, everythingAtOnce, truthTable, rowOf, logicDepths } from './logicSim'

export const LOGIC_UNIT = 56   // px per cm in the drawing's own coordinates
const LW = 2
const CAPTION = 0.3

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n1 = v => String(Math.round(v * 10) / 10)
const n2 = v => String(Math.round(v * 100) / 100)

// Signal colors that read on the slide: on a dark one (light ink) brighter
export function signalColors(ink) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ink || '')
  const light = !m || 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16) > 140
  return light ? { hi: '#4ade80', lo: '#5d6a85', unk: '#f5a524' } : { hi: '#16a34a', lo: '#a7b0c2', unk: '#d97706' }
}

// ---------- Questions about a diagram

export function maxStep(m) {
  let s = 0
  for (const p of m.parts) { s = Math.max(s, p.step || 0, ...(p.flips || [])); if (p.kind === 'clock') s = Math.max(s, p.end ?? 8) }
  for (const w of m.wires) s = Math.max(s, w.step || 0)
  for (const n of m.nodes) s = Math.max(s, n.step || 0)
  for (const k of Object.keys(m.captions || {})) s = Math.max(s, +k)
  return s
}
export function logicBounds(m) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of m.parts) {
    const r = p.kind === 'dff' ? 1.1 : 0.9, hh = p.kind === 'dff' ? 1 : Math.max(0.5, ((p.inputs || 2) - 1) * 0.25 + 0.3)
    x0 = Math.min(x0, p.x - r - (p.kind === 'input' || p.kind === 'clock' ? 0.6 : 0)); x1 = Math.max(x1, p.x + r + (p.kind === 'output' ? 0.6 : 0))
    y0 = Math.min(y0, p.y - hh); y1 = Math.max(y1, p.y + hh)
  }
  for (const n of m.nodes) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y) }
  return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 6, y1: 3 }
}
// Pins with no wire driven into them, for the editor to flag
export function floatingPins(m) {
  return simulateLogic(everythingAtOnce(m), 0)[0].floating
}

// ---------- Drawing a part, around its point (X, Y) in px, y down. The body
// (base) is the same at every step; its signals (pin stubs, an input's digit,
// a lit output) are drawn for a step, in its colors.

function gateGeometry(p, u) {
  const K = LOGIC_PARTS[p.kind], ins = pinsOf(p).filter(x => x.io === 'in'), n = ins.length
  const h = (K.multi ? Math.max(0.47, (n - 1) * 0.25 + 0.22) : 0.36) * u
  return { K, ins, n, h }
}
function partBase(p, u, ink, style, label) {
  const K = LOGIC_PARTS[p.kind], X = p.x * u, Y = -p.y * u, lw = LW
  const stroke = `fill="none" stroke="${esc(ink)}" stroke-width="${n1(lw)}" stroke-linejoin="round"`
  const text = (t, x, y, fs) => `<text x="${n1(x)}" y="${n1(y + fs * 0.34)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(fs)}" fill="${esc(ink)}">${esc(t)}</text>`
  let out = ''
  if (K.gate) {
    const { h } = gateGeometry(p, u), xb = X - 0.5 * u, xf = X + 0.5 * u
    let front = xf
    if (style === 'iec') { out += `<rect x="${n1(X - 0.42 * u)}" y="${n1(Y - h)}" width="${n1(0.84 * u)}" height="${n1(2 * h)}" ${stroke}/>` + text(K.iec, X, Y, 0.3 * u); front = X + 0.42 * u }
    else if (K.gate === 'and') {
      const rx = Math.min(h, 0.55 * u)
      out += `<path d="M${n1(xb)} ${n1(Y - h)}H${n1(xf - rx)}A${n1(rx)} ${n1(h)} 0 0 1 ${n1(xf - rx)} ${n1(Y + h)}H${n1(xb)}Z" ${stroke}/>`
    } else if (K.gate === 'or' || K.gate === 'xor') {
      const c = 0.22 * u
      out += `<path d="M${n1(xb)} ${n1(Y - h)}Q${n1(xb + c)} ${n1(Y)} ${n1(xb)} ${n1(Y + h)}Q${n1(X + 0.15 * u)} ${n1(Y + h)} ${n1(xf)} ${n1(Y)}Q${n1(X + 0.15 * u)} ${n1(Y - h)} ${n1(xb)} ${n1(Y - h)}Z" ${stroke}/>`
      if (K.gate === 'xor') out += `<path d="M${n1(xb - 0.14 * u)} ${n1(Y - h)}Q${n1(xb - 0.14 * u + c)} ${n1(Y)} ${n1(xb - 0.14 * u)} ${n1(Y + h)}" ${stroke}/>`
    } else { out += `<path d="M${n1(X - 0.35 * u)} ${n1(Y - 0.33 * u)}L${n1(X - 0.35 * u)} ${n1(Y + 0.33 * u)}L${n1(X + 0.3 * u)} ${n1(Y)}Z" ${stroke}/>`; front = X + 0.3 * u }
    if (K.inv) out += `<circle cx="${n1(front + 0.08 * u)}" cy="${n1(Y)}" r="${n1(0.08 * u)}" ${stroke}/>`
    if (p.label) out += label(p.label, X, Y - h - 0.24 * u, 0.28 * u)
  } else if (p.kind === 'input' || p.kind === 'clock') {
    out += `<rect x="${n1(X - 0.32 * u)}" y="${n1(Y - 0.27 * u)}" width="${n1(0.64 * u)}" height="${n1(0.54 * u)}" rx="${n1(0.08 * u)}" ${stroke}/>`
    if (p.label) { const b = texBox(p.label, 0.32 * u); out += label(p.label, X - 0.48 * u - b.w / 2, Y, 0.32 * u) }
  } else if (p.kind === 'output') {
    out += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(0.27 * u)}" ${stroke}/>`
    if (p.label) { const b = texBox(p.label, 0.32 * u); out += label(p.label, X + 0.45 * u + b.w / 2, Y, 0.32 * u) }
  } else if (p.kind === 'dff') {
    const x0 = X - 0.6 * u, fs = 0.26 * u
    out += `<rect x="${n1(x0)}" y="${n1(Y - 0.9 * u)}" width="${n1(1.2 * u)}" height="${n1(1.8 * u)}" ${stroke}/>`
    out += text('D', x0 + 0.18 * u, Y - 0.5 * u, fs) + texSvg('Q', X + 0.42 * u, Y - 0.5 * u, fs, ink) + texSvg('\\overline{Q}', X + 0.42 * u, Y + 0.5 * u, fs, ink)
    out += `<path d="M${n1(x0)} ${n1(Y + 0.38 * u)}L${n1(x0 + 0.16 * u)} ${n1(Y + 0.5 * u)}L${n1(x0)} ${n1(Y + 0.62 * u)}" ${stroke}/>`
    if (p.label) out += label(p.label, X, Y - 1.14 * u, 0.28 * u)
  }
  return out
}
// Where a gate's input stubs end: its back, curved for OR and XOR
function backAt(p, u, style, pyPx) {
  const K = LOGIC_PARTS[p.kind], X = p.x * u, Y = -p.y * u
  if (style === 'iec') return X - 0.42 * u
  if (K.gate === 'buf') return X - 0.35 * u
  if (K.gate === 'and') return X - 0.5 * u
  const { h } = gateGeometry(p, u), t = (pyPx - (Y - h)) / (2 * h)
  return X - 0.5 * u - (K.gate === 'xor' ? 0.14 * u : 0) + 2 * t * (1 - t) * 0.22 * u
}
function partSignals(p, u, ink, style, at, color) {
  const K = LOGIC_PARTS[p.kind], X = p.x * u, Y = -p.y * u
  const line = (x1, y1, x2, y2, c) => `<path d="M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}" stroke="${esc(c)}" stroke-width="${n1(LW)}" stroke-linecap="round" fill="none"/>`
  const sig = name => color(at ? at[`${p.id}.${name}`] : undefined)
  let out = ''
  if (K.gate) {
    for (const pin of pinsOf(p).filter(x => x.io === 'in')) { const py = -pin.y * u; out += line(pin.x * u, py, backAt(p, u, style, py), py, sig(pin.name)) }
    const front = style === 'iec' ? X + 0.42 * u : K.gate === 'buf' ? X + 0.3 * u : X + 0.5 * u
    out += line(front + (K.inv ? 0.16 * u : 0), Y, X + 0.75 * u, Y, sig('out'))
  } else if (p.kind === 'input' || p.kind === 'clock') {
    const v = at ? at[`${p.id}.out`] : undefined
    out += line(X + 0.32 * u, Y, X + 0.75 * u, Y, color(v))
    if (p.kind === 'clock') {
      const a = 0.18 * u, b = 0.12 * u
      out += `<path d="M${n1(X - a)} ${n1(Y + b)}H${n1(X - a / 2)}V${n1(Y - b)}H${n1(X + a / 2)}V${n1(Y + b)}H${n1(X + a)}" fill="none" stroke="${esc(v == null ? ink : color(v))}" stroke-width="${n1(LW * 0.9)}" stroke-linejoin="round"/>`
    } else if (v != null) out += `<text x="${n1(X)}" y="${n1(Y + 0.32 * u * 0.34)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(0.32 * u)}" font-weight="700" fill="${esc(color(v))}">${v}</text>`
  } else if (p.kind === 'output') {
    const v = at ? at[`${p.id}.in`] : undefined
    out += line(X - 0.75 * u, Y, X - 0.27 * u, Y, color(v))
    if (v === 1) out += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(0.5 * u)}" fill="${esc(color(1))}" fill-opacity=".18"/><circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(0.27 * u)}" fill="${esc(color(1))}"/>`
    else if (v === null) out += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(0.27 * u)}" fill="none" stroke="${esc(color(null))}" stroke-width="${n1(LW)}" stroke-dasharray="3 3"/>`
  } else if (p.kind === 'dff') {
    for (const pin of pinsOf(p)) {
      const px = pin.x * u, py = -pin.y * u
      out += pin.io === 'in' ? line(px, py, X - 0.6 * u, py, sig(pin.name)) : line(X + 0.6 * u, py, px, py, sig(pin.name))
    }
  }
  return out
}

// ---------- Drawing the diagram: SVG markup in px (UNIT per cm, y down) and
// the box it covers. o:
//   ink, style      line color, 'us' or 'iec' symbols
//   labels          'text', 'deck' or a function from TeX to HTML, as the circuit's
//   values          color wires by signal; table: draw the truth table beside it
//   step            drawn as at a step (default: the start, every part there)
//   deck            for a deck: an id, every part once and each step's signals
//   captions        the step captions under the diagram
//   editor          for the editor: hit areas, sel, warn, grid, view, mark,
//                   accent and warnColor

export function drawLogic(m, o = {}) {
  const u = o.U || LOGIC_UNIT, ink = o.ink || '#ffffff', pal = signalColors(ink)
  const color = o.values ? (v => v === 1 ? pal.hi : v === 0 ? pal.lo : v === null ? pal.unk : ink) : () => ink
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, '') : null
  const step = deck != null ? null : (o.step ?? null)
  const max = maxStep(m)
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const grow = (X, Y, rx = 0, ry = rx) => {
    box.x0 = Math.min(box.x0, X - rx); box.x1 = Math.max(box.x1, X + rx)
    box.y0 = Math.min(box.y0, Y - ry); box.y1 = Math.max(box.y1, Y + ry)
  }
  const label = (tex, X, Y, size) => {
    const b = texBox(tex, size)
    grow(X, Y, b.w / 2, b.h / 2)
    if (o.labels === 'deck' || typeof o.labels === 'function') {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size
      const inner = o.labels === 'deck' ? `<span data-math-latex="${esc(tex)}" style="font-family:${esc(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex)
      return `<foreignObject x="${n1(X - w / 2)}" y="${n1(Y - h / 2)}" width="${n1(w)}" height="${n1(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n1(size / 1.21)}px;color:${esc(ink)}">${inner}</div></foreignObject>`
    }
    return texSvg(tex, X, Y, size, ink)
  }
  for (const p of m.parts) {
    const b = logicBounds({ parts: [p], nodes: [] })
    grow((b.x0 + b.x1) / 2 * u, -(b.y0 + b.y1) / 2 * u, (b.x1 - b.x0) / 2 * u, (b.y1 - b.y0) / 2 * u)
  }
  for (const n of m.nodes) grow(n.x * u, -n.y * u)

  // The states drawn: one (static), or one for each step (deck)
  const flat = everythingAtOnce(m)
  const tt = o.table ? truthTable(m) : null
  const deep = logicDepths(m)
  const states = deck != null ? simulateLogic(m, max) : step == null ? simulateLogic(flat, 0) : simulateLogic(m, step)

  // Each step's signals: wires, junction dots, the parts' stubs and lights,
  // and the truth table's lit row
  const signals = (s, state, prev, model) => {
    const E = endpoints(model, s)
    const shown = x => s == null || (x.step || 0) <= s
    let out = ''
    const fan = {}
    for (const w of model.wires) if (shown(w) && E.has(w.from) && E.has(w.to)) { fan[w.from] = (fan[w.from] || 0) + 1; fan[w.to] = (fan[w.to] || 0) + 1 }
    for (const w of model.wires) {
      if (!shown(w) || !E.has(w.from) || !E.has(w.to)) continue
      const d = route(E.get(w.from), E.get(w.to), w.mx ?? undefined).map((p, i) => `${i ? 'L' : 'M'}${n1(p.x * u)} ${n1(-p.y * u)}`).join('')
      const v = state.wire[w.id], c = color(v), dash = o.values && v === null ? ' stroke-dasharray="5 4"' : ''
      const path = (cls, col, extra = '') => `<path${cls} d="${d}" fill="none" stroke="${esc(col)}" stroke-width="${n1(LW * 1.15)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
      const fresh = deck != null && (w.step || 0) === s && s > 0
      const changed = prev && o.values && prev.wire[w.id] !== undefined && prev.wire[w.id] !== v
      if (deck != null && (fresh || changed)) {
        if (changed) out += path('', color(prev.wire[w.id]))
        out += path(` class="pxlg-sig" style="animation-delay:${(deep(w.from) * 0.14).toFixed(2)}s"`, c, dash)
      } else out += path('', c, dash)
    }
    for (const [id, e] of E) {
      const f = fan[id] || 0
      if ((e.node && f >= 3) || (!e.node && f >= 2)) out += `<circle cx="${n1(e.x * u)}" cy="${n1(-e.y * u)}" r="3.6" fill="${esc(color(state.at[id]))}"/>`
    }
    for (const p of model.parts) if (shown(p)) out += partSignals(p, u, ink, o.style, state.at, color)
    if (tt && tt.rows) {
      const row = rowOf(tt, state)
      if (row >= 0) out += tableRow(row)
    }
    return out
  }
  // The truth table, to the right of the diagram
  let tableBase = '', tableRow = () => ''
  if (tt && tt.rows) {
    const b = logicBounds(m), cw = 0.62 * u, rh = 0.44 * u, cols = tt.ins.length + tt.outs.length
    const x0 = (b.x1 + 0.9) * u, top = -b.y1 * u + 0.1 * u, fs = 0.27 * u
    ;[...tt.ins, ...tt.outs].forEach((p, c) => { tableBase += label(p.label || p.id, x0 + (c + 0.5) * cw, top + rh * 0.5, fs) })
    tableBase += `<path d="M${n1(x0 - 0.08 * u)} ${n1(top + rh)}H${n1(x0 + cols * cw + 0.08 * u)}M${n1(x0 + tt.ins.length * cw)} ${n1(top + 0.06 * u)}V${n1(top + rh * (tt.rows.length + 1))}" stroke="${esc(ink)}" stroke-width="1.2" opacity=".6"/>`
    tt.rows.forEach((r, ri) => r.forEach((v, c) => {
      tableBase += `<text x="${n1(x0 + (c + 0.5) * cw)}" y="${n1(top + rh * (ri + 1.5) + fs * 0.34)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(fs)}" fill="${esc(ink)}">${v == null ? '?' : v}</text>`
    }))
    grow(x0 + cols * cw / 2, top + rh * (tt.rows.length + 1) / 2, cols * cw / 2 + 0.1 * u, rh * (tt.rows.length + 1) / 2)
    tableRow = row => `<rect x="${n1(x0 - 0.08 * u)}" y="${n1(top + rh * (row + 1))}" width="${n1(cols * cw + 0.16 * u)}" height="${n1(rh)}" rx="4" fill="${esc(o.accent || pal.hi)}" fill-opacity=".26"/>`
  }

  let layers = ''
  if (deck != null) {
    for (let s = 0; s <= max; s++) layers += `<g data-fx-in="${s}-${s === max ? '' : s}">${signals(s, states[s], s ? states[s - 1] : null, m)}</g>`
  } else layers = signals(step, states[states.length - 1], null, step == null ? flat : m)

  // Parts, once each
  let bases = ''
  for (const p of m.parts) {
    if (step != null && (p.step || 0) > step) continue
    let g = partBase(p, u, ink, o.style, label)
    if (o.editor) {
      const sel = o.sel && o.sel.kind === 'p' && o.sel.id === p.id
      const hw = (p.kind === 'dff' ? 1.0 : 0.62) * u, hh = (p.kind === 'dff' ? 0.95 : Math.max(0.45, ((p.inputs || 2) - 1) * 0.25 + 0.3)) * u
      if (sel) g = `<rect x="${n1(p.x * u - hw)}" y="${n1(-p.y * u - hh)}" width="${n1(2 * hw)}" height="${n1(2 * hh)}" rx="6" fill="${esc(o.accent)}" fill-opacity=".14" stroke="${esc(o.accent)}" stroke-width="1.5"/>` + g
      g += `<rect data-p="${esc(p.id)}" x="${n1(p.x * u - hw * 0.8)}" y="${n1(-p.y * u - hh * 0.9)}" width="${n1(1.6 * hw)}" height="${n1(1.8 * hh)}" fill="#000" fill-opacity="0"/>`
      if (p.kind === 'input') g += `<rect data-toggle="${esc(p.id)}" x="${n1(p.x * u - 0.32 * u)}" y="${n1(-p.y * u - 0.27 * u)}" width="${n1(0.64 * u)}" height="${n1(0.54 * u)}" fill="#000" fill-opacity="0"><title>Click to set it to ${p.value ? 0 : 1}</title></rect>`
      for (const pin of pinsOf(p)) {
        const id = `${p.id}.${pin.name}`, floating = (o.warn || []).includes(id)
        g += `<circle data-pin="${esc(id)}" cx="${n1(pin.x * u)}" cy="${n1(-pin.y * u)}" r="${floating ? 6 : 2.6}" fill="${floating ? esc(o.warnColor) : 'none'}" fill-opacity="${floating ? '.35' : '0'}" stroke="${esc(floating ? o.warnColor : o.mark)}" stroke-width="1.2"/>`
      }
    }
    bases += deck != null && (p.step || 0) > 0 ? `<g class="pxfx-part pxfx-v" data-fx-at="${p.step}">${g}</g>` : `<g>${g}</g>`
  }

  // The editor's hit areas, selection and handles
  let editor = ''
  if (o.editor) {
    const E = endpoints(m)
    for (const w of m.wires) {
      if (!E.has(w.from) || !E.has(w.to)) continue
      const pts = route(E.get(w.from), E.get(w.to), w.mx ?? undefined)
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${n1(p.x * u)} ${n1(-p.y * u)}`).join('')
      const sel = o.sel && o.sel.kind === 'w' && o.sel.id === w.id
      if (sel) editor += `<path d="${d}" fill="none" stroke="${esc(o.accent)}" stroke-opacity=".3" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`
      editor += `<path data-w="${esc(w.id)}" d="${d}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="14" pointer-events="stroke"/>`
      if (sel && pts.length === 4) editor += `<circle data-h="${esc(w.id)}" cx="${n1(pts[1].x * u)}" cy="${n1(-(pts[1].y + pts[2].y) / 2 * u)}" r="6" fill="${esc(o.accent)}" stroke="#fff" stroke-width="2"><title>Drag to move the upright</title></circle>`
    }
    for (const n of m.nodes) {
      const sel = o.sel && o.sel.kind === 'n' && o.sel.id === n.id
      editor += `<circle data-n="${esc(n.id)}" cx="${n1(n.x * u)}" cy="${n1(-n.y * u)}" r="${sel ? 7 : 5}" fill="${sel ? esc(o.accent) : '#000'}" fill-opacity="${sel ? '.35' : '0'}"/>`
    }
  }
  let grid = ''
  if (o.editor && o.grid && o.view) {
    const v = o.view, gx = v.x0 * u, gy = -(v.y0 + v.h) * u
    grid = `<defs><pattern id="pxlg-g" width="${u / 2}" height="${u / 2}" x="${-u / 4}" y="${-u / 4}" patternUnits="userSpaceOnUse"><circle cx="${u / 4}" cy="${u / 4}" r="1.1" fill="${esc(o.mark)}" fill-opacity=".7"/></pattern></defs><rect x="${n1(gx)}" y="${n1(gy)}" width="${n1(v.w * u)}" height="${n1(v.h * u)}" fill="url(#pxlg-g)"/>`
  }

  // Captions under the diagram, in room kept for them whenever there are any
  let caps = ''
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b)
  if (o.captions && capSteps.length && isFinite(box.x0)) {
    const cs = CAPTION * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8
    const one = (n, cls) => {
      const text = m.captions[n]
      if (o.labels === 'text') return `<text${cls} x="${n1(cx)}" y="${n1(y + cs)}" text-anchor="middle" font-size="${n1(cs)}" fill="${esc(ink)}">${esc(text)}</text>`
      return `<foreignObject${cls} x="${n1(cx - w / 2)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n1(cs)}px;line-height:1.3;color:${esc(ink)}">${esc(text)}</div></foreignObject>`
    }
    if (deck != null) caps = capSteps.map(n => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join('')
    else { const shown = capSteps.filter(n => n <= (step ?? 0)).pop(); if (shown != null) caps = one(shown, '') }
    grow(cx, y + h / 2, w / 2, h / 2)
  }
  if (!isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 6 * u, y1: 3 * u })
  return { svg: grid + `<g pointer-events="none">${layers}</g>` + bases + tableBase + editor + caps, box }
}

// ---------- The element

const baseOptions = m => ({ ink: m.color, style: m.symbols, values: m.values, table: m.table, captions: true })

// The drawing's box in px, with a margin: the element's shape
export function logicBox(el) {
  const m = logicModel(el)
  const { box } = drawLogic(m, baseOptions(m))
  const pad = 0.2 * LOGIC_UNIT
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad }
}

// The element as an <svg> filling its box. opts: labels, deck (an id: each
// step's signals), step (as at that step; default the start, every part
// there), standalone (with a size, for an image)
export function logicSvg(el, opts = {}) {
  const m = logicModel(el), b = logicBox(el)
  const { svg } = drawLogic(m, { ...baseOptions(m), labels: opts.labels || 'text', deck: opts.deck, step: opts.step ?? null })
  const size = opts.standalone ? ` width="${n1(b.w)}" height="${n1(b.h)}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n1(b.x)} ${n1(b.y)} ${n1(b.w)} ${n1(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`
}

// ---------- Steps

// The diagram steps at which it changes: [[slide step, diagram step]]
export function logicSteps(el) {
  if (el?.type !== 'logic') return []
  const m = logicModel(el), steps = new Set()
  for (const p of m.parts) {
    if (p.step > 0) steps.add(p.step)
    for (const f of p.flips || []) steps.add(f)
    if (p.kind === 'clock') for (let s = Math.max(1, p.start); s <= p.end + 1; s++) steps.add(s)
  }
  for (const w of m.wires) if (w.step > 0) steps.add(w.step)
  for (const n of m.nodes) if (n.step > 0) steps.add(n.step)
  for (const k of Object.keys(m.captions)) if (+k > 0) steps.add(+k)
  return [...steps].filter(s => s <= maxStep(m)).sort((a, b) => a - b).map(s => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1000)
}
export function logicStepAt(el, slideStep) {
  let at = 0
  for (const [n, s] of logicSteps(el)) if (n <= slideStep) at = s
  return at
}
export function logicStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    for (const [n, s] of logicSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}
export function hasLogic(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'logic'))
}

// ---------- CircuiTikZ, and the truth table as LaTeX

export function logicTikz(el) {
  const m = logicModel(el)
  if (!m.parts.length) return '% An empty diagram'
  const pinRef = id => {
    if (!id.includes('.')) return `(${id})`
    const [pid, pin] = id.split('.'), p = m.parts.find(x => x.id === pid)
    if (p.kind === 'input' || p.kind === 'clock' || p.kind === 'output') return `(${pid})`
    if (p.kind === 'dff') return `(${pid}.${{ d: 'pin 1', clk: 'pin 3', q: 'pin 6', qn: 'pin 4' }[pin]})`
    return `(${pid}.${pin === 'out' ? 'out' : 'in ' + pin.slice(2)})`
  }
  const L = [
    `% \\usepackage[${m.symbols === 'iec' ? 'european' : 'american'}]{circuitikz} and \\usetikzlibrary{calc}`,
    '% CircuiTikZ draws ports at its own size; flip-flop pins: D is pin 1, the clock pin 3, Q pin 6, Q-bar pin 4',
    '\\begin{circuitikz}',
  ]
  for (const p of m.parts) {
    const K = LOGIC_PARTS[p.kind], at = `(${n2(p.x)}, ${n2(p.y)})`
    if (K.gate) L.push(`  \\draw ${at} node[${K.tikz}${K.multi && p.inputs !== 2 ? `, number inputs=${p.inputs}` : ''}] (${p.id}) {}${p.label ? ` node[above=0.5cm] {$${p.label}$}` : ''};`)
    else if (p.kind === 'dff') L.push(`  \\draw ${at} node[flipflop D] (${p.id}) {};`)
    else {
      const pin = pinsOf(p)[0]
      L.push(`  \\draw (${n2(pin.x)}, ${n2(pin.y)}) node[ocirc] (${p.id}) {} node[${p.kind === 'output' ? 'right' : 'left'}] {$${p.label || p.id}$};`)
    }
  }
  for (const n of m.nodes) L.push(`  \\coordinate (${n.id}) at (${n2(n.x)}, ${n2(n.y)});`)
  const E = endpoints(m), fan = {}
  for (const w of m.wires) {
    const a = pinRef(w.from), b = pinRef(w.to)
    L.push(Math.abs(E.get(w.from).y - E.get(w.to).y) < 1e-9 ? `  \\draw ${a} -- ${b};` : `  \\draw ${a} -| ($${a}!0.5!${b}$) |- ${b};`)
    fan[w.from] = (fan[w.from] || 0) + 1; fan[w.to] = (fan[w.to] || 0) + 1
  }
  for (const n of m.nodes) if ((fan[n.id] || 0) >= 3) L.push(`  \\draw (${n.id}) node[circ] {};`)
  L.push('\\end{circuitikz}')
  return L.join('\n')
}
export function logicTableLatex(el) {
  const tt = truthTable(logicModel(el))
  if (!tt.rows) return '% ' + tt.why
  const head = [...tt.ins, ...tt.outs].map(p => `$${p.label || p.id}$`).join(' & ')
  return [`\\begin{tabular}{${'c'.repeat(tt.ins.length)}|${'c'.repeat(tt.outs.length)}}`, `  ${head} \\\\ \\hline`,
    ...tt.rows.map(r => `  ${r.map(v => (v == null ? '?' : v)).join(' & ')} \\\\`), '\\end{tabular}'].join('\n')
}

// ---------- Templates (cm, y up)

function template(key, name, parts, nodes, wires, extra = {}) {
  return { key, name, build() {
    return {
      parts: parts.map(([id, kind, x, y, more]) => ({
        id, kind, x, y, label: '', step: 0, ...(LOGIC_PARTS[kind].multi ? { inputs: 2 } : {}),
        ...(kind === 'input' ? { value: 0, flips: [] } : {}), ...(kind === 'clock' ? { start: 1, end: 8 } : {}), ...(more || {}),
      })),
      nodes: nodes.map(([id, x, y]) => ({ id, x, y, step: 0 })),
      wires: wires.map(([from, to, more], i) => ({ id: 'w' + (i + 1), from, to, mx: null, step: 0, ...(more || {}) })),
      captions: { ...(extra.captions || {}) },
      table: !!extra.table,
    }
  } }
}
export const LOGIC_TEMPLATES = [
  template('half', 'Half adder',
    [['A', 'input', 0, 2, { label: 'A', flips: [2] }], ['B', 'input', 0, 0, { label: 'B', flips: [1, 2, 3] }], ['g1', 'xor', 3, 1.75], ['g2', 'and', 3, 0.25], ['S', 'output', 5.25, 1.75, { label: 'S' }], ['C', 'output', 5.25, 0.25, { label: 'C' }]],
    [['nA', 1.25, 2], ['nB', 1.75, 0]],
    [['A.out', 'nA'], ['nA', 'g1.in1'], ['nA', 'g2.in1', { mx: 1.25 }], ['B.out', 'nB'], ['nB', 'g2.in2'], ['nB', 'g1.in2', { mx: 1.75 }], ['g1.out', 'S.in'], ['g2.out', 'C.in']],
    { table: true, captions: { 0: '0 + 0: sum 0, carry 0', 1: '0 + 1: sum 1', 2: '1 + 0: sum 1', 3: '1 + 1: sum 0, carry 1' } }),
  template('mux', '2-to-1 multiplexer',
    [['D0', 'input', 0, 3, { label: 'D_0', value: 1 }], ['Sel', 'input', 0, 1.75, { label: 'S', flips: [1, 3] }], ['D1', 'input', 0, 0.5, { label: 'D_1', flips: [2] }], ['inv', 'not', 2.5, 2.5],
      ['g1', 'and', 4.5, 2.75], ['g2', 'and', 4.5, 0.75], ['g3', 'or', 7, 1.75], ['Y', 'output', 9, 1.75, { label: 'Y' }]],
    [['j', 1.25, 1.75]],
    [['D0.out', 'g1.in1'], ['Sel.out', 'j'], ['j', 'inv.in1', { mx: 1.25 }], ['j', 'g2.in1', { mx: 1.25 }], ['inv.out', 'g1.in2'], ['D1.out', 'g2.in2'],
      ['g1.out', 'g3.in1', { mx: 5.75 }], ['g2.out', 'g3.in2', { mx: 5.75 }], ['g3.out', 'Y.in']],
    { table: true, captions: { 0: 'S = 0 passes D₀', 1: 'S = 1 passes D₁', 2: 'D₁ rises, and Y with it', 3: 'Back to D₀' } }),
  template('latch', 'SR latch (NOR)',
    [['R', 'input', 0, 2.75, { label: 'R', flips: [3, 4] }], ['S', 'input', 0, 0.25, { label: 'S', flips: [1, 2] }], ['g1', 'nor', 3, 2.5], ['g2', 'nor', 3, 0.5],
      ['Q', 'output', 6, 2.5, { label: 'Q' }], ['Qn', 'output', 6, 0.5, { label: '\\overline{Q}' }]],
    [['q', 4.5, 2.5], ['k1', 4.5, 1.75], ['k2', 1.75, 1.75], ['qn', 4.5, 0.5], ['k3', 4.5, 1.25], ['k4', 1.5, 1.25]],
    [['R.out', 'g1.in1'], ['S.out', 'g2.in2'], ['g1.out', 'q'], ['q', 'Q.in'], ['q', 'k1'], ['k1', 'k2'], ['k2', 'g2.in1', { mx: 1.75 }],
      ['g2.out', 'qn'], ['qn', 'Qn.in'], ['qn', 'k3'], ['k3', 'k4'], ['k4', 'g1.in2', { mx: 1.5 }]],
    { captions: { 0: 'With both inputs low, Q could be either.', 1: 'S sets it: Q = 1.', 2: 'S goes low, and the latch remembers.', 3: 'R resets it: Q = 0.', 4: 'And it holds.' } }),
  template('counter', '2-bit ripple counter',
    [['clk', 'clock', 0, 1, { label: '\\mathrm{CLK}', start: 1, end: 8 }], ['f1', 'dff', 3, 1.5], ['f2', 'dff', 7, 1.5], ['Q0', 'output', 5.75, 3.5, { label: 'Q_0' }], ['Q1', 'output', 9.75, 3.5, { label: 'Q_1' }]],
    [['a1', 4.5, 1], ['a2', 4.5, 2.75], ['a3', 1.5, 2.75], ['b1', 8.5, 1], ['b2', 8.5, 2.75], ['b3', 5.5, 2.75]],
    [['clk.out', 'f1.clk'], ['f1.qn', 'a1'], ['a1', 'a2'], ['a2', 'a3'], ['a3', 'f1.d', { mx: 1.5 }], ['a1', 'f2.clk'],
      ['f2.qn', 'b1'], ['b1', 'b2'], ['b2', 'b3'], ['b3', 'f2.d', { mx: 5.5 }], ['f1.q', 'Q0.in', { mx: 4.25 }], ['f2.q', 'Q1.in', { mx: 8.25 }]],
    { captions: { 1: 'The clock rises: count 1.', 3: 'Q₀ falls, so its inverse rises and clocks Q₁: count 2.', 5: 'Count 3.', 7: 'And back to 0.' } }),
  { key: 'blank', name: 'Blank', build: () => ({ parts: [], nodes: [], wires: [], captions: {}, table: false }) },
]

// A new diagram: the first template, in the slide's text color
export function defaultLogic(dark = true) {
  return { ...LOGIC_TEMPLATES[0].build(), color: dark ? '#ffffff' : '#1a1a1a', symbols: 'us', values: true, stepStart: 1 }
}

// ---------- Editor helpers: changes to a diagram { parts, nodes, wires, captions }, made in place

export function newLogicId(m, prefix) {
  const used = new Set([...m.parts.map(x => x.id), ...m.nodes.map(x => x.id), ...m.wires.map(x => x.id)])
  let n = 1, id
  do { id = prefix + n++ } while (used.has(id))
  return id
}
export function addLogicPart(m, kind, x, y) {
  const prefix = { input: 'in', output: 'out', clock: 'clk', dff: 'ff' }[kind] || 'g'
  const p = { id: newLogicId(m, prefix), kind, x: snapTo(x), y: snapTo(y), label: '', step: 0 }
  if (LOGIC_PARTS[kind].multi) p.inputs = 2
  if (kind === 'input') { p.value = 0; p.flips = []; p.label = String.fromCharCode(65 + m.parts.filter(q => q.kind === 'input').length % 26) }
  if (kind === 'output') { const n = m.parts.filter(q => q.kind === 'output').length; p.label = n ? `Y_${n}` : 'Y' }
  if (kind === 'clock') { p.start = 1; p.end = 8; p.label = '\\mathrm{CLK}' }
  m.parts.push(p)
  return p
}
export function addLogicNode(m, x, y) {
  const near = m.nodes.find(n => Math.hypot(n.x - x, n.y - y) < 0.05)
  if (near) return near.id
  const n = { id: newLogicId(m, 'n'), x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, step: 0 }
  m.nodes.push(n)
  return n.id
}
// The wire under a point: { w, q (the point on it, on the grid along it), mx }
export function logicWireAt(m, p, tol = 0.16) {
  const E = endpoints(m)
  let best = null
  for (const w of m.wires) {
    if (!E.has(w.from) || !E.has(w.to)) continue
    const pts = route(E.get(w.from), E.get(w.to), w.mx ?? undefined)
    for (let i = 0; i + 1 < pts.length; i++) {
      const A = pts[i], B = pts[i + 1], dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy
      if (!l2) continue
      const t = Math.min(1, Math.max(0, ((p.x - A.x) * dx + (p.y - A.y) * dy) / l2))
      const q = { x: A.x + dx * t, y: A.y + dy * t }, d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < tol && (!best || d < best.d)) best = { w, d, q: { x: dx ? snapTo(q.x) : q.x, y: dy ? snapTo(q.y) : q.y }, mx: w.mx ?? (pts.length === 4 ? pts[1].x : null) }
    }
  }
  return best
}
// Splits a wire at a point on it, with a junction there; its two halves keep its shape
export function splitLogicWire(m, hit) {
  const nid = addLogicNode(m, hit.q.x, hit.q.y)
  const w = m.wires.find(x => x.id === hit.w.id)
  const w2 = { id: newLogicId(m, 'w'), from: nid, to: w.to, mx: hit.mx, step: w.step || 0 }
  w.mx = hit.mx
  w.to = nid
  m.wires.push(w2)
  return nid
}
// The pin or junction nearest a point, if one is close
export function nearestEnd(m, p, tol = 0.22) {
  let best = null, bd = tol
  for (const [id, e] of endpoints(m)) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = id } }
  return best
}
// Drops wires to pins that have gone, and junctions with no wires
export function pruneLogic(m) {
  const E = endpoints(m)
  m.wires = m.wires.filter(w => E.has(w.from) && E.has(w.to))
  const used = new Set()
  for (const w of m.wires) { used.add(w.from); used.add(w.to) }
  m.nodes = m.nodes.filter(n => used.has(n.id))
}
export function removeLogic(m, sel) {
  if (sel.kind === 'p') m.parts = m.parts.filter(p => p.id !== sel.id)
  else if (sel.kind === 'n') m.wires = m.wires.filter(w => w.from !== sel.id && w.to !== sel.id)
  else m.wires = m.wires.filter(w => w.id !== sel.id)
  pruneLogic(m)
}
// The input's state at step 0 shown on its box; used by the editor's toggle
export const startValue = p => inputAt(p, 0)
