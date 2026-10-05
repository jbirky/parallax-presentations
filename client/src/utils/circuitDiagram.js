// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Circuit diagram elements, made in CircuitEditorModal (toolbar: Diagrams →
// Circuit Diagram). circuitParts.js has the model and circuitSolve.js its
// DC steady state; this draws it (circuitSvg: the canvas, thumbnails, decks,
// printed pages, PPTX), writes it as CircuiTikZ, and has the editor's
// changes to it.
//
// Parts and vertices have steps, as a Feynman diagram's do, and a switch can
// flip at one. A deck's drawing has every part, marked with its step, and for
// each run of steps the circuit stays the same over, the current, lamps and
// meter readings it has then (data-fx-in), so the deck needs no solver;
// diagramCore's step script shows each step's.

import { MATH_FONT, texBox, texSvg, texLiteHtml } from './diagramCore'
import { CIRCUIT_PARTS, GROUND_DIRS, circuitModel, parseValue, formatSI, closedAt } from './circuitParts'
import { solveCircuit } from './circuitSolve'

export const CIRCUIT_UNIT = 48  // px per cm in the drawing's own coordinates
export const CIRCUIT_SNAP = 0.5
const BODY = 1.0                // a part's body, along its line
const LW = 2
const LABEL = 0.34
const CAPTION = 0.3
const DIRS = { above: [0, 1], below: [0, -1], left: [-1, 0], right: [1, 0] }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n1 = v => String(Math.round(v * 10) / 10)
const n2 = v => String(Math.round(v * 100) / 100)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// Current shows in amber: brighter on a dark slide, deeper on a light one
export function flowColorFor(ink) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ink || '')
  const light = !m || 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16) > 140
  return light ? '#ffbf47' : '#c26a00'
}

// ---------- Questions about a circuit

export function vertexMap(m) { const V = {}; for (const v of m.vertices) V[v.id] = v; return V }
const shownAt = (s, step) => step == null || s <= step
// Connections at each vertex, ground counting as one
export function connections(m, step = null) {
  const d = {}
  for (const v of m.vertices) d[v.id] = v.ground ? 1 : 0
  for (const e of m.edges) if (shownAt(e.step || 0, step)) { d[e.from] = (d[e.from] || 0) + 1; d[e.to] = (d[e.to] || 0) + 1 }
  return d
}
// 'auto' is a dot where three or more connections meet
export const shownKind = (v, conn) => v.kind && v.kind !== 'auto' ? v.kind : (conn[v.id] >= 3 ? 'dot' : 'none')
export function vertexStep(m, v) {
  if (v.step != null) return v.step
  let s = Infinity
  for (const e of m.edges) if (e.from === v.id || e.to === v.id) s = Math.min(s, e.step || 0)
  return isFinite(s) ? s : 0
}
export function maxStep(m) {
  let s = 0
  for (const e of m.edges) { s = Math.max(s, e.step || 0); if (e.part === 'switch' && e.flipAt != null) s = Math.max(s, e.flipAt) }
  for (const v of m.vertices) if (v.step != null) s = Math.max(s, v.step)
  return s
}
// Ends connected to nothing: not a terminal, not grounded
export function looseEnds(m) {
  const conn = connections(m)
  return m.vertices.filter(v => conn[v.id] === 1 && !v.ground && v.kind !== 'terminal').map(v => v.id)
}
export function circuitBounds(m) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const v of m.vertices) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y - (v.ground ? 0.6 : 0)); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y) }
  return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 6, y1: 3 }
}

// ---------- A part, drawn along its line from (0, 0) to (len, 0) with +y to
// the right of its direction, and placed by a transform. ext is how far it
// reaches to its left and right; glyphs are signs drawn upright, in place;
// a switch's blade is drawn by blade(closed), so a deck can have both.

function partShape(part, len, u, k, lw, ink, style) {
  const L = (x1, y1, x2, y2, w = lw) => `<path d="M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}" stroke="${esc(ink)}" stroke-width="${n1(w)}" stroke-linecap="round" fill="none"/>`
  const circ = (cx, r) => `<circle cx="${n1(cx)}" cy="0" r="${n1(r)}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(lw)}"/>`
  const b = part === 'wire' ? 0 : Math.max(Math.min(BODY * u, len - 0.3 * u), Math.min(len * 0.7, 0.5 * u))
  const a = (len - b) / 2, c = len / 2
  const leads = () => L(0, 0, a, 0) + L(a + b, 0, len, 0)
  const out = { body: '', ext: [0.06 * u, 0.06 * u], glyphs: [], a, b }
  if (part === 'wire') { out.body = L(0, 0, len, 0); out.ext = [0.04 * u, 0.04 * u] }
  else if (part === 'resistor') {
    if (style === 'iec') out.body = leads() + `<rect x="${n1(a)}" y="${n1(-0.14 * u)}" width="${n1(b)}" height="${n1(0.28 * u)}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(lw)}"/>`
    else {
      const h = 0.16 * u
      let d = `M${n1(a)} 0`
      for (let i = 0; i < 6; i++) d += `L${n1(a + (2 * i + 1) * b / 12)} ${n1(i % 2 ? h : -h)}`
      out.body = leads() + `<path d="${d}L${n1(a + b)} 0" fill="none" stroke="${esc(ink)}" stroke-width="${n1(lw)}" stroke-linejoin="round"/>`
    }
    out.ext = [0.17 * u, 0.17 * u]
  } else if (part === 'capacitor') {
    const g = 0.08 * u, p = 0.3 * u
    out.body = L(0, 0, c - g, 0) + L(c + g, 0, len, 0) + L(c - g, -p, c - g, p, lw * 1.4) + L(c + g, -p, c + g, p, lw * 1.4)
    out.ext = [p, p]
  } else if (part === 'inductor') {
    if (style === 'iec') { out.body = leads() + `<rect x="${n1(a)}" y="${n1(-0.11 * u)}" width="${n1(b)}" height="${n1(0.22 * u)}" fill="${esc(ink)}"/>`; out.ext = [0.12 * u, 0.12 * u] }
    else {
      const r = b / 8
      let d = `M${n1(a)} 0`
      for (let i = 0; i < 4; i++) d += `A${n1(r)} ${n1(r)} 0 0 1 ${n1(a + (i + 1) * 2 * r)} 0`
      out.body = leads() + `<path d="${d}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(lw)}"/>`
      out.ext = [r + 0.02 * u, 0.04 * u]
    }
  } else if (part === 'battery') {
    // Two cells, from the negative terminal: short plate, long plate, short, long
    const offs = [-0.27, -0.09, 0.09, 0.27].map(o => c + o * u)
    out.body = L(0, 0, offs[0], 0) + L(offs[3], 0, len, 0)
      + offs.map((x, i) => i % 2 ? L(x, -0.32 * u, x, 0.32 * u) : L(x, -0.15 * u, x, 0.15 * u, lw * 2.2)).join('')
    out.glyphs.push([offs[3] + 0.16 * u, -0.34 * u, '+', 0.3 * u])
    out.ext = [0.34 * u, 0.33 * u]
  } else if (['vsource', 'acsource', 'isource', 'ammeter', 'voltmeter', 'lamp'].includes(part)) {
    const r = 0.3 * u
    out.body = L(0, 0, c - r, 0) + L(c + r, 0, len, 0) + circ(c, r)
    out.ext = [r, r]
    if (part === 'vsource') {
      if (style === 'iec') out.body += L(c - r, 0, c + r, 0)
      else { out.glyphs.push([c + 0.15 * u, 0, '+', 0.26 * u]); out.glyphs.push([c - 0.15 * u, 0, '−', 0.26 * u]) }
    } else if (part === 'acsource') {
      let d = ''
      for (let i = 0; i <= 20; i++) { const t = i / 20; d += `${i ? 'L' : 'M'}${n1(c - 0.17 * u + t * 0.34 * u)} ${n1(-0.1 * u * Math.sin(2 * Math.PI * t))}` }
      out.body += `<path d="${d}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(lw * 0.85)}"/>`
    } else if (part === 'isource') {
      if (style === 'iec') out.body += L(c, -r, c, r)
      else out.body += L(c - 0.17 * u, 0, c + 0.08 * u, 0) + `<path d="M${n1(c + 0.19 * u)} 0L${n1(c + 0.05 * u)} ${n1(-0.08 * u)}L${n1(c + 0.05 * u)} ${n1(0.08 * u)}Z" fill="${esc(ink)}"/>`
    } else if (part === 'lamp') {
      const q = 0.21 * u
      out.body += L(c - q, -q, c + q, q, lw * 0.9) + L(c - q, q, c + q, -q, lw * 0.9)
    } else out.glyphs.push([c, 0, CIRCUIT_PARTS[part].meter, 0.3 * u, 600])
  } else if (part === 'switch') {
    const tr = 0.06 * u, x0 = a, x1 = a + b, ang = 28 * Math.PI / 180
    const ring = x => `<circle cx="${n1(x)}" cy="0" r="${n1(tr)}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(lw * 0.8)}"/>`
    out.body = L(0, 0, x0 - tr, 0) + L(x1 + tr, 0, len, 0) + ring(x0) + ring(x1)
    out.blade = closed => closed ? L(x0, 0, x1, 0) : L(x0, 0, x0 + b * Math.cos(ang), -b * Math.sin(ang))
    out.ext = [b * Math.sin(ang) + 0.04 * u, 0.08 * u]
  } else if (part === 'diode') {
    const t = 0.2 * u, h = 0.22 * u
    out.body = L(0, 0, c - t, 0) + L(c + t, 0, len, 0)
      + `<path d="M${n1(c - t)} ${n1(-h)}L${n1(c - t)} ${n1(h)}L${n1(c + t)} 0Z" fill="${style === 'iec' ? 'none' : esc(ink)}" stroke="${esc(ink)}" stroke-width="${n1(lw)}" stroke-linejoin="round"/>` + L(c + t, -h, c + t, h)
    out.ext = [h, h]
  }
  return out
}

// ---------- Drawing: the circuit as SVG markup in px (UNIT per cm, y down),
// and the box it covers. o:
//   ink, lw, style  line color and width, 'us' or 'iec' symbols
//   labels          'text' (SVG text), 'deck' (spans KaTeX fills in) or a
//                   function from TeX to HTML
//   flow, readings  draw the current and lamps, and meter readings
//   sol             the solution to draw them from
//   step, dim       drawn as at a step (default: the end), earlier parts faded
//   deck, runs      for a deck: an id, every part marked with its step, and
//                   [{ from, to, sol }] for each run of steps alike
//   captions        the step captions under the circuit
//   editor          for the editor: hit areas, sel, warn, grid, view, mark,
//                   accent and warnColor

export function drawCircuit(m, o = {}) {
  const u = o.U || CIRCUIT_UNIT, k = u / 48, lw = (o.lw || LW) * k, fs = LABEL * u
  const ink = o.ink || '#ffffff', flowColor = o.flowColor || flowColorFor(ink), V = vertexMap(m)
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, '') : null
  const step = deck != null ? null : (o.step ?? null)
  const state = step == null ? Infinity : step
  const conn = connections(m, step)
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
  const plain = (t, X, Y, size, color = ink, weight = 400) => {
    grow(X, Y, Math.max(String(t).length * size * 0.5, size * 0.4) / 2, size * 0.55)
    return `<text x="${n1(X)}" y="${n1(Y + size * 0.34)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(size)}" font-weight="${weight}" fill="${esc(color)}">${esc(t)}</text>`
  }
  const wrap = (s, lines, labels, reveal, isVertex, id) => {
    if (deck != null) {
      const cls = `pxfx-part${isVertex ? ' pxfx-v' : ''}`
      if (s > 0 && reveal) {
        const mid = `pxfxm-${deck}-${id}`
        return `<g class="${cls}" data-fx-at="${s}"><mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><path class="pxfx-reveal" pathLength="1" d="${reveal}" fill="none" stroke="#fff" stroke-width="${n1(46 * k)}" stroke-linecap="round"/></mask><g mask="url(#${mid})">${lines}</g><g class="pxfx-fade">${labels}</g></g>`
      }
      return `<g class="${cls}" data-fx-at="${s}">${lines}${labels}</g>`
    }
    const faded = step != null && o.dim && step > 0 && s < step
    return `<g${faded ? ' opacity=".34"' : ''}>${lines}${labels}</g>`
  }

  let grid = ''
  if (o.editor && o.grid && o.view) {
    const v = o.view, gx = v.x0 * u, gy = -(v.y0 + v.h) * u
    grid = `<defs><pattern id="pxcx-g1" width="${u / 2}" height="${u / 2}" x="${-u / 4}" y="${-u / 4}" patternUnits="userSpaceOnUse"><circle cx="${u / 4}" cy="${u / 4}" r="1" fill="${esc(o.mark)}" fill-opacity=".55"/></pattern>`
      + `<pattern id="pxcx-g2" width="${u}" height="${u}" x="${-u / 2}" y="${-u / 2}" patternUnits="userSpaceOnUse"><circle cx="${u / 2}" cy="${u / 2}" r="1.6" fill="${esc(o.mark)}" fill-opacity=".8"/></pattern></defs>`
      + `<rect x="${n1(gx)}" y="${n1(gy)}" width="${n1(v.w * u)}" height="${n1(v.h * u)}" fill="url(#pxcx-g1)"/><rect x="${n1(gx)}" y="${n1(gy)}" width="${n1(v.w * u)}" height="${n1(v.h * u)}" fill="url(#pxcx-g2)"/>`
  }

  const warn = new Set(o.warn || [])
  const placed = {}   // by part: where its line is, for the current, lamps and readings
  let parts = ''
  for (const e of m.edges) {
    const A = V[e.from], B = V[e.to]
    if (!A || !B || A === B) continue
    const s = e.step || 0
    if (deck == null && !shownAt(s, step)) continue
    const P = CIRCUIT_PARTS[e.part] || CIRCUIT_PARTS.wire
    const X1 = A.x * u, Y1 = -A.y * u, X2 = B.x * u, Y2 = -B.y * u, dx = X2 - X1, dy = Y2 - Y1, len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len, ang = Math.atan2(dy, dx) * 180 / Math.PI
    const G = (sx, sy) => [X1 + ux * sx - uy * sy, Y1 + uy * sx + ux * sy]
    const sh = partShape(e.part, len, u, k, lw, ink, o.style)
    let body = sh.body
    if (sh.blade) {
      if (deck != null && e.flipAt != null) body += `<g data-fx-in="0-${e.flipAt - 1}">${sh.blade(!!e.closed)}</g><g data-fx-in="${e.flipAt}-">${sh.blade(!e.closed)}</g>`
      else body += sh.blade(closedAt(e, state))
    }
    grow(X1, Y1, lw); grow(X2, Y2, lw)
    for (const [gx, gy] of [G(len / 2, -sh.ext[0]), G(len / 2, sh.ext[1])]) grow(gx, gy)
    let lines = ''
    if (o.editor && o.sel && o.sel.kind === 'e' && o.sel.id === e.id) lines += `<path d="M${n1(X1)} ${n1(Y1)}L${n1(X2)} ${n1(Y2)}" stroke="${esc(o.accent)}" stroke-opacity=".3" stroke-width="${n1(16 * k)}" stroke-linecap="round"/>`
    if (o.editor && warn.has(e.id)) lines += `<path d="M${n1(X1)} ${n1(Y1)}L${n1(X2)} ${n1(Y2)}" stroke="${esc(o.warnColor)}" stroke-opacity=".45" stroke-width="${n1(16 * k)}" stroke-linecap="round"/>`
    lines += `<g transform="translate(${n1(X1)} ${n1(Y1)}) rotate(${n1(ang)})">${body}</g>`
    for (const [gxs, gys, t, size, weight] of sh.glyphs) { const [gx, gy] = G(gxs, gys); lines += plain(t, gx, gy, size, ink, weight || 400) }

    // The name on one side, the value (then any reading) on the other
    let labels = ''
    const side = e.flip ? 1 : -1
    const place = (sx, sd, gap, bx) => {
      const extPx = sd < 0 ? sh.ext[0] : sh.ext[1], nx = -uy * sd, ny = ux * sd
      const reach = Math.abs(nx) * bx.w / 2 + Math.abs(ny) * bx.h / 2
      const [px, py] = G(sx, sd * (extPx + gap))
      return [px + nx * reach, py + ny * reach, reach * 2]
    }
    if (e.label && e.part !== 'wire') { const [x, y] = place(len / 2, side, 0.12 * u, texBox(e.label, fs)); labels += label(e.label, x, y, fs) }
    let depth = 0
    const parsed = parseValue(e.value)
    const valueText = P.unit && e.value !== '' ? (parsed != null ? formatSI(parsed, P.unit) : e.value) : ''
    if (valueText) {
      const bx = { w: Math.max(valueText.length * fs * 0.9 * 0.5, fs * 0.4), h: fs * 0.95 }
      const [x, y, d] = place(len / 2, -side, 0.12 * u, bx)
      depth = d
      labels += plain(valueText, x, y, fs * 0.9)
    }
    if (e.current) {
      const sx = e.part === 'wire' ? len * 0.62 : len - sh.a / 2, hs = 0.12 * u
      const [tx, ty] = G(sx + hs * 0.6, 0), [b1x, b1y] = G(sx - hs * 0.6, -hs * 0.65), [b2x, b2y] = G(sx - hs * 0.6, hs * 0.65)
      labels += `<path d="M${n1(tx)} ${n1(ty)}L${n1(b1x)} ${n1(b1y)}L${n1(b2x)} ${n1(b2y)}Z" fill="${esc(ink)}"/>`
      const [x, y] = place(sx, side, 0.16 * u, texBox(e.current, fs * 0.85))
      labels += label(e.current, x, y, fs * 0.85)
    }
    if (e.voltage && e.part !== 'wire') {
      const inset = Math.max(Math.min(sh.a * 0.5, len * 0.2), 0.12 * u), off = -side * (sh.ext[side < 0 ? 1 : 0] + 0.2 * u)
      const [px, py] = G(inset, off), [qx, qy] = G(len - inset, off)
      labels += plain('+', px, py, fs * 0.85) + plain('−', qx, qy, fs * 0.85)
      const [x, y, d] = place(len / 2, -side, 0.12 * u + depth, texBox(e.voltage, fs * 0.9))
      depth += d + 0.06 * u
      labels += label(e.voltage, x, y, fs * 0.9)
    }
    if (o.editor) labels += `<path class="pxcx-hit" data-e="${esc(e.id)}" d="M${n1(X1)} ${n1(Y1)}L${n1(X2)} ${n1(Y2)}" stroke="#000" stroke-opacity="0" stroke-width="${n1(18 * k)}" pointer-events="stroke"/>`
    placed[e.id] = { e, X1, Y1, X2, Y2, len, G, at: s, reading: (text, size) => place(len / 2, -side, 0.12 * u + depth, { w: text.length * size * 0.5, h: size * 1.05 }) }
    parts += wrap(s, lines, labels, `M${n1(X1)} ${n1(Y1)}L${n1(X2)} ${n1(Y2)}`, false, e.id)
  }

  let verts = ''
  for (const v of m.vertices) {
    const s = vertexStep(m, v)
    if (deck == null && !shownAt(s, step)) continue
    const kind = shownKind(v, conn), X = v.x * u, Y = -v.y * u
    let mark = '', labels = ''
    if (v.ground) {
      const g = 0.3 * u
      mark += `<g transform="translate(${n1(X)} ${n1(Y)}) rotate(${GROUND_DIRS[v.ground] ?? 0})" stroke="${esc(ink)}" stroke-width="${n1(lw)}" stroke-linecap="round" fill="none">`
        + `<path d="M0 0V${n1(g)}M${n1(-0.27 * u)} ${n1(g)}H${n1(0.27 * u)}M${n1(-0.17 * u)} ${n1(g + 0.09 * u)}H${n1(0.17 * u)}M${n1(-0.07 * u)} ${n1(g + 0.18 * u)}H${n1(0.07 * u)}"/></g>`
      const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[v.ground]
      grow(X + d[0] * 0.48 * u, Y + d[1] * 0.48 * u, 0.27 * u)
    }
    if (kind === 'dot') { mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(3.4 * k)}" fill="${esc(ink)}"/>`; grow(X, Y, 3.4 * k) }
    else if (kind === 'terminal') { mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(4.2 * k)}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(lw * 0.9)}"/>`; grow(X, Y, 4.2 * k) }
    else if (o.editor && conn[v.id] <= 2) mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="2.6" fill="none" stroke="${esc(o.mark)}" stroke-width="1.1"/>`
    if (v.label) {
      let d = DIRS[v.labelAt]
      if (!d) {
        const legs = []
        for (const e of m.edges) {
          if (deck == null && !shownAt(e.step || 0, step)) continue
          const other = e.from === v.id ? V[e.to] : e.to === v.id ? V[e.from] : null
          if (other) { const l = Math.hypot(other.x - v.x, other.y - v.y) || 1; legs.push([(other.x - v.x) / l, (other.y - v.y) / l]) }
        }
        if (v.ground) legs.push({ down: [0, -1], up: [0, 1], left: [-1, 0], right: [1, 0] }[v.ground])
        d = awayFrom(legs)
      }
      const bx = texBox(v.label, fs), reach = (Math.abs(d[0]) * bx.w / 2 + Math.abs(d[1]) * bx.h / 2) / u, L = 0.16 + reach
      labels += label(v.label, (v.x + d[0] * L) * u, -(v.y + d[1] * L) * u, fs)
    }
    if (o.editor) {
      if (warn.has(v.id)) mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(11 * k)}" fill="none" stroke="${esc(o.warnColor)}" stroke-width="2" stroke-dasharray="4 3"><title>Connected to nothing</title></circle>`
      if (o.sel && o.sel.kind === 'v' && o.sel.id === v.id) mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(9 * k)}" fill="${esc(o.accent)}" fill-opacity=".22" stroke="${esc(o.accent)}" stroke-width="2"/>`
      labels += `<circle data-v="${esc(v.id)}" cx="${n1(X)}" cy="${n1(Y)}" r="${n1(11 * k)}" fill="#000" fill-opacity="0"/>`
    }
    if (mark || labels) verts += wrap(s, mark, labels, null, true, v.id)
  }

  // The current, lamps and meter readings, from a solution
  const overlay = (sol, upTo) => {
    let under = '', over = ''
    if (!sol || (sol.status !== 'ok' && sol.status !== 'still')) return { under, over }
    for (const p of Object.values(placed)) {
      const { e } = p
      if (upTo != null && p.at > upTo) continue
      const I = sol.I[e.id]
      if (I == null) continue
      if (o.flow && e.part === 'lamp' && (sol.P[e.id] || 0) > 1e-4) {
        const bright = clamp(sol.P[e.id] / (sol.P[e.id] + 0.35), 0.25, 1), [cx, cy] = p.G(p.len / 2, 0)
        for (const [r, a] of [[0.72, 0.16], [0.52, 0.24], [0.38, 0.36]]) under += `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r * u)}" fill="#ffcf6b" fill-opacity="${n2(a * bright)}"/>`
      }
      if (o.flow && sol.maxI > 0 && Math.abs(I) > Math.max(1e-9, sol.maxI * 2e-3)) {
        const f = 0.25 + 0.75 * Math.abs(I) / sol.maxI
        const d = I > 0 ? `M${n1(p.X1)} ${n1(p.Y1)}L${n1(p.X2)} ${n1(p.Y2)}` : `M${n1(p.X2)} ${n1(p.Y2)}L${n1(p.X1)} ${n1(p.Y1)}`
        over += `<path class="pxcx-flow" d="${d}" fill="none" stroke="${esc(flowColor)}" stroke-width="${n1(4.2 * k)}" stroke-linecap="round" stroke-dasharray="0.1 14" style="animation-duration:${(0.42 / f).toFixed(2)}s"/>`
      }
      const meter = CIRCUIT_PARTS[e.part].meter
      if (o.readings && meter) {
        const text = meter === 'A' ? formatSI(Math.abs(I), 'A') : formatSI(Math.abs((sol.V[e.from] || 0) - (sol.V[e.to] || 0)), 'V')
        const [x, y] = p.reading(text, fs * 0.92)
        over += plain(text, x, y, fs * 0.92, flowColor, 600)
      }
    }
    return { under, over }
  }
  let under = '', over = ''
  if (o.flow || o.readings) {
    if (deck != null) {
      for (const run of o.runs || []) {
        const lay = overlay(run.sol, run.from)
        const span = `${run.from}-${run.to ?? ''}`
        if (lay.under) under += `<g data-fx-in="${span}">${lay.under}</g>`
        if (lay.over) over += `<g data-fx-in="${span}">${lay.over}</g>`
      }
    } else ({ under, over } = overlay(o.sol, step))
    // Never in the way of the parts under them
    if (under) under = `<g pointer-events="none">${under}</g>`
    if (over) over = `<g pointer-events="none">${over}</g>`
  }

  // Captions under the circuit, in room kept for them whenever there are any
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
    else {
      const shown = capSteps.filter(n => n <= (step ?? maxStep(m))).pop()
      if (shown != null) caps = one(shown, '')
    }
    grow(cx, y + h / 2, w / 2, h / 2)
  }
  if (!isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 6 * u, y1: 3 * u })
  return { svg: grid + under + parts + verts + over + caps, box }
}

// Where a vertex's label goes: away from its parts, preferring up
function awayFrom(dirs) {
  if (!dirs.length) return [0, 1]
  let best = [0, 1], score = -Infinity, sx = 0, sy = 0
  for (const d of dirs) { sx += d[0]; sy += d[1] }
  const sl = Math.hypot(sx, sy)
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, c = [Math.round(Math.cos(a) * 1e6) / 1e6, Math.round(Math.sin(a) * 1e6) / 1e6]
    let gap = Infinity
    for (const d of dirs) gap = Math.min(gap, Math.acos(clamp(c[0] * d[0] + c[1] * d[1], -1, 1)))
    const sc = gap + (sl > 0.2 ? 0.3 * (-(sx * c[0] + sy * c[1]) / sl) : 0) + (i % 2 ? -0.05 : 0) + 0.04 * c[1]
    if (sc > score) { score = sc; best = c }
  }
  return best
}

// ---------- Steps

// The diagram steps at which a circuit changes: [[slide step, diagram step]]
export function circuitSteps(el) {
  if (el?.type !== 'circuit') return []
  const m = circuitModel(el)
  return modelSteps(m).map(s => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1000)
}
function modelSteps(m) {
  const steps = new Set()
  for (const e of m.edges) { if (e.step > 0) steps.add(e.step); if (e.part === 'switch' && e.flipAt != null) steps.add(e.flipAt) }
  for (const v of m.vertices) if (v.step > 0) steps.add(v.step)
  for (const n of Object.keys(m.captions)) if (+n > 0) steps.add(+n)
  return [...steps].sort((a, b) => a - b)
}
export function circuitStepAt(el, slideStep) {
  let at = 0
  for (const [n, s] of circuitSteps(el)) if (n <= slideStep) at = s
  return at
}
// A slide's hidden fragments for its circuits' steps
export function circuitStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    for (const [n, s] of circuitSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}
export function hasCircuits(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'circuit'))
}
// The solution for each run of steps a circuit stays the same over
function solutionRuns(m) {
  const starts = [0, ...modelSteps(m)]
  return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1] - 1 : null, sol: solveCircuit(m, from) }))
}

// ---------- The element

const baseOptions = m => ({ ink: m.color, style: m.symbols, captions: true, flow: m.flow, readings: m.readings })

// The drawing's box in px, with a margin: the element's shape
export function circuitBox(el) {
  const m = circuitModel(el)
  const { box } = drawCircuit(m, { ...baseOptions(m), sol: m.flow || m.readings ? solveCircuit(m) : null })
  const pad = 0.2 * CIRCUIT_UNIT
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad }
}

// The element as an <svg> filling its box. opts: labels (as drawCircuit's),
// deck (an id: every part and every step's current), step (as at that
// diagram step; default the end), standalone (with a size, for an image)
export function circuitSvg(el, opts = {}) {
  const m = circuitModel(el), b = circuitBox(el), solved = m.flow || m.readings
  const o = { ...baseOptions(m), labels: opts.labels || 'text' }
  const { svg } = opts.deck != null
    ? drawCircuit(m, { ...o, deck: opts.deck, runs: solved ? solutionRuns(m) : [] })
    : drawCircuit(m, { ...o, step: opts.step ?? null, dim: m.dimPast, sol: solved ? solveCircuit(m, opts.step ?? Infinity) : null })
  const size = opts.standalone ? ` width="${n1(b.w)}" height="${n1(b.h)}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n1(b.x)} ${n1(b.y)} ${n1(b.w)} ${n1(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`
}

// ---------- CircuiTikZ, every part a path between its two points

const UNIT_TEX = { 'Ω': '\\Omega', V: '\\mathrm{V}', A: '\\mathrm{A}', F: '\\mathrm{F}', H: '\\mathrm{H}' }
function valueTex(e) {
  const P = CIRCUIT_PARTS[e.part], v = parseValue(e.value)
  if (!P.unit || e.value === '') return ''
  if (v == null) return `\\text{${e.value.replace(/[\\{}$%&#_^~]/g, '')}}`
  const [num, rest] = formatSI(v, P.unit).split(' ')
  const prefix = rest.slice(0, rest.length - P.unit.length)
  return `${num}\\,${prefix === 'µ' ? '\\mu' : prefix ? `\\mathrm{${prefix}}` : ''}${UNIT_TEX[P.unit]}`
}
export function circuitTikz(el) {
  const m = circuitModel(el)
  if (!m.edges.length) return '% An empty circuit'
  const V = vertexMap(m), conn = connections(m)
  const at = v => `(${n2(v.x)}, ${n2(v.y)})`
  const L = [
    `% \\usepackage[${m.symbols === 'iec' ? 'european' : 'american'}]{circuitikz}`,
    '% Sources are drawn from their - terminal to their + one; check voltage dir in your CircuiTikZ',
    '\\begin{circuitikz}',
  ]
  for (const e of m.edges) {
    const A = V[e.from], B = V[e.to]
    if (e.part === 'wire' && !e.current) { L.push(`  \\draw ${at(A)} -- ${at(B)};`); continue }
    const P = CIRCUIT_PARTS[e.part]
    let name = P.tikz || 'short'
    if (e.part === 'switch') name = e.flipAt != null ? (e.closed ? 'opening switch' : 'closing switch') : (e.closed ? 'ncs' : 'nos')
    const o = [name], here = e.flip ? '_' : '', there = e.flip ? '^' : ''
    if (e.label) o.push(`l${here}=$${e.label}$`)
    const val = valueTex(e)
    if (val) o.push(`a${there}=$${val}$`)
    if (e.current) o.push(`i=$${e.current}$`)
    if (e.voltage) o.push(`v=$${e.voltage}$`)
    L.push(`  \\draw ${at(A)} to[${o.join(', ')}] ${at(B)};`)
  }
  for (const v of m.vertices) {
    const kind = shownKind(v, conn), nodes = []
    if (v.ground) nodes.push(`node[ground${GROUND_DIRS[v.ground] ? `, rotate=${-GROUND_DIRS[v.ground]}` : ''}] {}`)
    if (kind === 'dot') nodes.push('node[circ] {}')
    if (kind === 'terminal') nodes.push('node[ocirc] {}')
    if (v.label) nodes.push(`node[${DIRS[v.labelAt] ? v.labelAt : 'above'}] {$${v.label}$}`)
    if (nodes.length) L.push(`  \\draw ${at(v)} ${nodes.join(' ')};`)
  }
  L.push('\\end{circuitikz}')
  return L.join('\n')
}

// ---------- Templates (cm, y up)

function template(key, name, verts, edges, captions = {}) {
  return { key, name, build() {
    return {
      vertices: verts.map(([id, x, y, more]) => ({ id, x, y, kind: 'auto', ground: null, label: '', labelAt: 'auto', step: null, ...(more || {}) })),
      edges: edges.map(([from, to, part, more], i) => ({ id: 'e' + (i + 1), from, to, part, label: '', value: '', flip: false, current: '', voltage: '', closed: false, flipAt: null, step: 0, ...(more || {}) })),
      captions: { ...captions },
    }
  } }
}
export const CIRCUIT_TEMPLATES = [
  template('lamp', 'Switch and lamp', [['a', 0, 0], ['b', 0, 3], ['c', 2.5, 3], ['d', 5, 3], ['e', 5, 0], ['f', 2.5, 0], ['g', 6.5, 3], ['h', 6.5, 0]],
    [['a', 'b', 'battery', { label: '\\mathcal{E}', value: '9', step: 1 }], ['b', 'c', 'switch', { label: 'S', flipAt: 3, step: 1 }], ['c', 'd', 'resistor', { label: 'R', value: '18', step: 1 }],
      ['d', 'e', 'lamp', { label: 'B', value: '12', step: 1 }], ['e', 'f', 'ammeter', { step: 1 }], ['f', 'a', 'wire', { step: 1 }],
      ['d', 'g', 'wire', { step: 2 }], ['g', 'h', 'voltmeter', { flip: true, step: 2 }], ['h', 'e', 'wire', { step: 2 }]],
    { 1: 'A battery, a switch, a resistor and a lamp in series,', 2: 'with a voltmeter across the lamp.', 3: 'Close the switch: 300 mA flows, and the lamp lights.' }),
  template('parallel', 'Parallel branches', [['a', 0, 0], ['b', 0, 3], ['c', 2.5, 3], ['d', 4.5, 3], ['e', 6.5, 3], ['f', 2.5, 0], ['g', 4.5, 0], ['h', 6.5, 0]],
    [['a', 'b', 'battery', { label: '\\mathcal{E}', value: '6', step: 1 }], ['b', 'c', 'ammeter', { step: 1 }], ['c', 'f', 'resistor', { label: 'R_1', value: '10', step: 1 }], ['f', 'a', 'wire', { step: 1 }],
      ['c', 'd', 'wire', { step: 2 }], ['d', 'g', 'resistor', { label: 'R_2', value: '20', step: 2 }], ['g', 'f', 'wire', { step: 2 }],
      ['d', 'e', 'wire', { step: 3 }], ['e', 'h', 'resistor', { label: 'R_3', value: '30', step: 3 }], ['h', 'g', 'wire', { step: 3 }]],
    { 1: 'One resistor draws 600 mA.', 2: 'A second branch adds 300 mA,', 3: 'and a third 200 mA: 1.1 A from the battery.' }),
  template('divider', 'Voltage divider', [['a', 0, 0, { ground: 'down' }], ['b', 0, 4], ['c', 3, 4], ['d', 3, 2], ['e', 3, 0], ['o', 5.5, 2, { label: 'V_\\mathrm{out}', labelAt: 'right' }], ['p', 5.5, 0]],
    [['a', 'b', 'vsource', { label: 'V_s', value: '10' }], ['b', 'c', 'wire'], ['c', 'd', 'resistor', { label: 'R_1', value: '1k' }], ['d', 'e', 'resistor', { label: 'R_2', value: '2k' }],
      ['e', 'a', 'wire'], ['d', 'o', 'wire'], ['o', 'p', 'voltmeter'], ['p', 'e', 'wire']]),
  template('bridge', 'Wheatstone bridge', [['L', 0, 1.5], ['T', 2, 3.5], ['R', 4, 1.5], ['B', 2, -0.5], ['p', 0, -2], ['q', 4, -2]],
    [['L', 'T', 'resistor', { label: 'R_1', value: '100' }], ['T', 'R', 'resistor', { label: 'R_2', value: '200' }], ['B', 'L', 'resistor', { label: 'R_3', value: '100' }],
      ['R', 'B', 'resistor', { label: 'R_x', value: '300' }], ['T', 'B', 'ammeter', { label: 'G' }], ['L', 'p', 'wire'], ['p', 'q', 'battery', { label: '\\mathcal{E}', value: '12' }], ['q', 'R', 'wire']]),
  template('diode', 'Diode and resistor', [['a', 0, 0], ['b', 0, 3], ['c', 2.5, 3], ['d', 5, 3], ['e', 5, 0]],
    [['a', 'b', 'vsource', { label: 'V_s', value: '5' }], ['b', 'c', 'resistor', { label: 'R', value: '430' }], ['c', 'd', 'diode', { label: 'D' }], ['d', 'e', 'ammeter'], ['e', 'a', 'wire']]),
  template('rc', 'RC circuit', [['a', 0, 0], ['b', 0, 3], ['c', 2.5, 3], ['d', 5, 3], ['e', 5, 0]],
    [['a', 'b', 'battery', { label: '\\mathcal{E}', value: '9', step: 1 }], ['b', 'c', 'switch', { label: 'S', flipAt: 2, step: 1 }], ['c', 'd', 'resistor', { label: 'R', value: '10k', step: 1 }],
      ['d', 'e', 'capacitor', { label: 'C', value: '100u', voltage: 'V_C', step: 1 }], ['e', 'a', 'wire', { step: 1 }]],
    { 2: 'Closing the switch charges C through R. Once it has charged, no current flows.' }),
  template('rlc', 'Series RLC (AC)', [['a', 0, 0], ['b', 0, 3], ['c', 2.5, 3], ['d', 5, 3], ['e', 5, 0]],
    [['a', 'b', 'acsource', { label: 'v(t)' }], ['b', 'c', 'resistor', { label: 'R', value: '50' }], ['c', 'd', 'inductor', { label: 'L', value: '10m' }],
      ['d', 'e', 'capacitor', { label: 'C', value: '1u' }], ['e', 'a', 'wire', { current: 'i(t)' }]]),
  { key: 'blank', name: 'Blank', build: () => ({ vertices: [], edges: [], captions: {} }) },
]

// A new circuit: the first template, in the slide's text color
export function defaultCircuit(dark = true) {
  return { ...CIRCUIT_TEMPLATES[0].build(), color: dark ? '#ffffff' : '#1a1a1a', symbols: 'us', flow: true, readings: true, stepStart: 1, dimPast: false }
}

// ---------- Editor helpers: changes to a circuit { vertices, edges, captions }, made in place

export const snapTo = v => Math.round(v / CIRCUIT_SNAP) * CIRCUIT_SNAP
const round2 = v => Math.round(v * 100) / 100

export function newPartId(m, prefix) {
  const used = new Set([...m.vertices.map(v => v.id), ...m.edges.map(e => e.id)])
  let n = m.vertices.length + m.edges.length + 1, id
  do { id = prefix + n++ } while (used.has(id))
  return id
}
// A vertex at (x, y), or the one already there
export function addVertex(m, x, y, more = {}) {
  const near = m.vertices.find(v => Math.hypot(v.x - x, v.y - y) < 0.05)
  if (near) { Object.assign(near, more); return near.id }
  const v = { id: newPartId(m, 'v'), x: round2(x), y: round2(y), kind: 'auto', ground: null, label: '', labelAt: 'auto', step: null, ...more }
  m.vertices.push(v)
  return v.id
}
export function addPart(m, from, to, part) {
  const P = CIRCUIT_PARTS[part]
  const e = { id: newPartId(m, 'e'), from, to, part, label: '', value: P.unit ? String(P.dflt) : '', flip: false, current: '', voltage: '', closed: false, flipAt: null, step: 0 }
  m.edges.push(e)
  return e
}
// Turns a part into another kind, keeping a value that still makes sense
export function changePart(e, part) {
  const P = CIRCUIT_PARTS[part]
  e.part = part
  if (!P.unit) e.value = ''
  else if (parseValue(e.value) == null) e.value = String(P.dflt)
}
// The wire under a point, and the fraction along it
export function wireAt(m, p, tol = 0.2) {
  const V = vertexMap(m)
  let best = null
  for (const e of m.edges) {
    if (e.part !== 'wire') continue
    const A = V[e.from], B = V[e.to], dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy
    if (!l2) continue
    const t = ((p.x - A.x) * dx + (p.y - A.y) * dy) / l2
    if (t <= 0.02 || t >= 0.98) continue
    const d = Math.hypot(A.x + dx * t - p.x, A.y + dy * t - p.y)
    if (d < tol && (!best || d < best.d)) best = { e, t, d }
  }
  return best
}
// Where on that wire a junction goes: on the grid when the wire runs along it
export function junctionPoint(m, hit, free = false) {
  const V = vertexMap(m), A = V[hit.e.from], B = V[hit.e.to]
  let x = A.x + (B.x - A.x) * hit.t, y = A.y + (B.y - A.y) * hit.t
  if (!free) {
    if (A.y === B.y && Math.abs(A.x - B.x) > 2 * CIRCUIT_SNAP) x = clamp(snapTo(x), Math.min(A.x, B.x) + CIRCUIT_SNAP, Math.max(A.x, B.x) - CIRCUIT_SNAP)
    else if (A.x === B.x && Math.abs(A.y - B.y) > 2 * CIRCUIT_SNAP) y = clamp(snapTo(y), Math.min(A.y, B.y) + CIRCUIT_SNAP, Math.max(A.y, B.y) - CIRCUIT_SNAP)
  }
  return { x: round2(x), y: round2(y) }
}
// Splits a wire at a point; returns the vertex there
export function splitWire(m, edgeId, pt) {
  const e = m.edges.find(x => x.id === edgeId)
  const vid = addVertex(m, pt.x, pt.y)
  if (!e || vid === e.from || vid === e.to) return vid
  const e2 = { ...e, id: newPartId(m, 'e'), from: vid }
  e.to = vid
  m.edges.splice(m.edges.indexOf(e) + 1, 0, e2)
  return vid
}
// A wire turns one right angle on its way, horizontal first when it's wider
// than tall; straight is a straight line
export function routeWire(a, b, straight = false) {
  if (straight || Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9) return [a, b]
  return [a, Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y }, b]
}
// A vertex dropped on another becomes it; returns the one kept, or null
export function mergeDropped(m, id) {
  const v = m.vertices.find(w => w.id === id)
  const target = v && m.vertices.find(w => w.id !== id && Math.hypot(w.x - v.x, w.y - v.y) < 0.13)
  if (!target) return null
  m.edges = m.edges.filter(e => !((e.from === id && e.to === target.id) || (e.to === id && e.from === target.id)))
  for (const e of m.edges) { if (e.from === id) e.from = target.id; if (e.to === id) e.to = target.id }
  m.vertices = m.vertices.filter(w => w.id !== id)
  if (!target.label && v.label) target.label = v.label
  if (!target.ground && v.ground) target.ground = v.ground
  return target.id
}
// Removes a part or a vertex with its parts; a vertex left with nothing on it goes too, unless grounded
export function removeParts(m, sel) {
  if (sel.kind === 'e') m.edges = m.edges.filter(e => e.id !== sel.id)
  else {
    m.edges = m.edges.filter(e => e.from !== sel.id && e.to !== sel.id)
    m.vertices = m.vertices.filter(v => v.id !== sel.id)
  }
  const used = new Set()
  for (const e of m.edges) { used.add(e.from); used.add(e.to) }
  m.vertices = m.vertices.filter(v => used.has(v.id) || v.ground)
}
