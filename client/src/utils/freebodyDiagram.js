// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Free-body diagram elements, made in FreebodyEditorModal (toolbar: Diagrams →
// Free-Body Diagram). freebodySolve.js has the model and works out its forces;
// this draws it (freebodySvg: the canvas, thumbnails, decks, printed pages,
// PPTX), writes it as TikZ, and has its templates and the editor's changes.
//
// Arrows are drawn to the diagram's scale (newtons per cm). In a deck each
// force is drawn once, marked with its step: its arrow draws in from where it
// acts, then its label, components and angle mark fade in, by diagramCore's
// step script. The net force is drawn beside the diagram, dashed, so it never
// lies on the forces it sums.

import { MATH_FONT, texBox, texSvg, texLiteHtml } from './diagramCore'
import {
  FORCE_KINDS, freebodyModel, solveFreebody, readNumber, alpha, bodyRot, half, absDeg, axesFrame, contact, boundary,
  uvec, add, sub, mul, dot, len, angOf, wrap180, angDiff,
} from './freebodySolve'

export const FREEBODY_UNIT = 56   // px per cm in the drawing's own coordinates
const DEFAULT_LEN = 1.6          // cm, for a force with no value
const MAX_LEN = 12
const CAPTION = 0.3

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n1 = v => String(Math.round(v * 10) / 10)
const f2 = v => { const r = Math.round(v * 100) / 100; return String(Object.is(r, -0) ? 0 : r) }

// Three significant figures, as the labels and the editor write magnitudes
export function sig3(v) {
  const a = Math.abs(v)
  if (a < 0.005) return '0'
  return a >= 100 ? String(Math.round(v)) : String(Number(v.toPrecision(3)))
}

// ---------- Geometry, in cm

const PUSHABLE = k => !['weight', 'normal', 'friction'].includes(k)
export const isPush = (m, f) => m.model === 'extended' && f.push && PUSHABLE(f.kind)

// A force's arrow: its direction as drawn (reversed when it came out
// negative), length, and where it starts and ends
export function forceGeom(m, f, sol) {
  const mag = sol.mag[f.id]
  let deg = absDeg(m, f)
  if (mag != null && mag < 0) deg += 180
  const u = uvec(deg)
  const L = mag == null ? DEFAULT_LEN : Math.min(MAX_LEN, Math.max(0.3, Math.abs(mag) / m.forceScale))
  let tail = [0, 0]
  if (m.model === 'extended') {
    if (f.kind === 'normal' || f.kind === 'friction') tail = m.surface.kind === 'none' ? boundary(m, mul(u, -1)) : contact(m)
    else if (isPush(m, f)) tail = sub(boundary(m, mul(u, -1)), mul(u, L))
    else if (f.kind !== 'weight') tail = boundary(m, u)
  }
  return { u, deg, L, tail, head: add(tail, mul(u, L)) }
}
// Where a force's rope runs, from the body to its anchor
export function ropeGeom(m, f, sol) {
  const g = forceGeom(m, f, sol), u = uvec(absDeg(m, f))
  const start = m.body.shape === 'dot' ? [0, 0] : boundary(m, u)
  return { u, start, end: add(start, mul(u, Math.max(2.6, g.L + 0.9))) }
}
export function surfaceGeom(m) {
  const k = m.surface.kind
  if (k === 'none') return null
  const a = alpha(m), s = uvec(a), n = uvec(a + 90), P = contact(m)
  if (k === 'incline') {
    const E1 = add(P, mul(s, -3.2)), E2 = add(P, mul(s, 2))
    const low = E1[1] <= E2[1] ? E1 : E2, high = low === E1 ? E2 : E1
    return { k, a, s, n, P, line: [E1, E2], low, high, B: [high[0], low[1]] }
  }
  return { k, a, s, n, P, line: [add(P, mul(s, -2.6)), add(P, mul(s, 2.6))] }
}
// The angle an incline's base and slope make at its foot
function inclineArc(sg) {
  const a0 = sg.B[0] > sg.low[0] ? 0 : 180
  return { a0, d: angDiff(a0, angOf(sub(sg.high, sg.low))) }
}
// Which of a reference line's two directions is nearer the force
export function angleRef(m, f, deg) {
  const a = alpha(m)
  const cands = f.angle === 'level' ? [0, 180] : f.angle === 'vertical' ? [90, -90] : f.angle === 'surface' ? [a, a + 180] : f.angle === 'normal' ? [a + 90, a - 90] : []
  let best = null
  for (const c of cands) if (best == null || Math.abs(angDiff(c, deg)) < Math.abs(angDiff(best, deg))) best = c
  return best
}
// A component's label from its force's: F_N → F_{N,x}
export function compLabel(label, axis) {
  // A subscript in braces, which may hold braces of its own, ends the label
  if (label.endsWith('}')) {
    let depth = 0, i = label.length - 1
    for (; i >= 0; i--) { depth += label[i] === '}' ? 1 : label[i] === '{' ? -1 : 0; if (!depth) break }
    if (i > 0 && label[i - 1] === '_') return `${label.slice(0, i - 1)}_{${label.slice(i + 1, -1)},${axis}}`
  }
  const m = /^(.*)_([A-Za-z0-9])$/.exec(label)
  if (m) return `${m[1]}_{${m[2]},${axis}}`
  return label.includes('_') ? `{${label}}_${axis}` : `${label}_${axis}`
}
function labelText(m, f, sol) {
  const v = sol.mag[f.id]
  return m.values && v != null ? `${f.label} = ${sig3(Math.abs(v))}\\,\\text{N}` : f.label
}
const netLabel = (m, sol) => (m.values ? `${m.net.label} = ${sig3(len(sol.net))}\\,\\text{N}` : m.net.label)
export const netShown = (m, sol) => m.net.show && len(sol.net) > 0.01
// The net force, beside the diagram (box: what's drawn so far, in cm), with
// its label on the side away from the diagram, or above it if it's level
export function netGeom(m, sol, box) {
  if (!netShown(m, sol)) return null
  const u = mul(sol.net, 1 / len(sol.net)), L = Math.min(MAX_LEN, Math.max(0.3, len(sol.net) / m.forceScale))
  const xs = (isFinite(box.x1) ? box.x1 : 1) + 0.8
  const tail = [xs + Math.max(0, -u[0]) * L, -(u[1] * L) / 2]
  let side = [-u[1], u[0]]
  if (Math.abs(side[0]) > 0.2 ? side[0] < 0 : side[1] < 0) side = mul(side, -1)
  return { u, L, tail, head: add(tail, mul(u, L)), mid: add(tail, mul(u, L / 2)), side }
}
// Where the body's label goes: the direction furthest from every arrow
export function bodyLabelAt(m, sol) {
  const dirs = []
  for (const f of m.forces) { const g = forceGeom(m, f, sol); if (len(g.tail) < 0.05) dirs.push(g.deg) }
  if (m.axes !== 'none') { const a = m.axes === 'surface' ? alpha(m) : 0; dirs.push(a, a + 90, a + 180, a - 90) }
  if (!dirs.length) return [0, 0]
  let best = 45, score = -1
  for (let k = 0; k < 16; k++) {
    const c = 45 + k * 22.5, d = Math.min(...dirs.map(x => Math.abs(angDiff(c, x))))
    if (d > score + 1e-6) { score = d; best = c }
  }
  return mul(uvec(best), m.body.shape === 'dot' ? 0.42 : 0.36)
}
export function maxStep(m) {
  let s = 0
  for (const f of m.forces) s = Math.max(s, f.step)
  if (m.net.show) s = Math.max(s, m.net.step)
  for (const k of Object.keys(m.captions || {})) s = Math.max(s, +k)
  return s
}

// ---------- Drawing
//
// o: ink, labels ('text': SVG text; 'deck': spans KaTeX fills in; or a
// function from TeX to HTML), deck (an id: every force, marked with its step),
// step (as at that step; default everything), captions, and for the editor:
// editor, sel, accent, bg.

export function drawFreebody(m, o = {}) {
  const u = o.U || FREEBODY_UNIT, ink = o.ink || m.color
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, '') : null
  const step = deck != null ? null : (o.step ?? null)
  const sol = o.sol || solveFreebody(m)
  const bx = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const ext = (p, r = 0) => { bx.x0 = Math.min(bx.x0, p[0] - r); bx.y0 = Math.min(bx.y0, p[1] - r); bx.x1 = Math.max(bx.x1, p[0] + r); bx.y1 = Math.max(bx.y1, p[1] + r) }
  const X = p => n1(p[0] * u), Y = p => n1(-p[1] * u)
  const fs = 0.4 * u
  const shown = s => step == null || s <= step
  const part = (s, inner) => (deck != null && s > 0 ? `<g class="pxfx-part" data-fx-at="${s}">${inner}</g>` : inner)
  const line = (a, b, attrs) => `<path d="M${X(a)} ${Y(a)}L${X(b)} ${Y(b)}" ${attrs}/>`

  function label(tex, at, dir, size, color) {
    const b = texBox(tex, size)
    const reach = (Math.abs(dir[0]) * b.w / 2 + Math.abs(dir[1]) * b.h / 2) / u + 0.14
    const c = add(at, mul(dir, reach))
    ext([c[0] - b.w / 2 / u, c[1] - b.h / 2 / u]); ext([c[0] + b.w / 2 / u, c[1] + b.h / 2 / u])
    const Xc = c[0] * u, Yc = -c[1] * u
    if (o.labels === 'deck' || typeof o.labels === 'function') {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size
      const inner = o.labels === 'deck' ? `<span data-math-latex="${esc(tex)}" style="font-family:${esc(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex)
      return `<foreignObject x="${n1(Xc - w / 2)}" y="${n1(Yc - h / 2)}" width="${n1(w)}" height="${n1(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n1(size / 1.21)}px;color:${esc(color)}">${inner}</div></foreignObject>`
    }
    return texSvg(tex, Xc, Yc, size, color)
  }
  // An arrow's shaft (which can draw in) and head
  function arrow(t, h, color, w, dash) {
    const v = sub(h, t), L = len(v)
    if (L < 1e-6) return { shaft: '', head: '' }
    const e = mul(v, 1 / L), k = w / 2.6, hl = Math.min(0.3 * k, L * 0.6), hw = 0.115 * k + 0.02
    const base = sub(h, mul(e, hl * 0.82)), p = [-e[1], e[0]], back = sub(h, mul(e, hl))
    const a = add(back, mul(p, hw)), c = sub(back, mul(p, hw))
    ext(h, 0.15); ext(t)
    return {
      shaft: `<path${deck != null && !dash ? ' class="pxfx-reveal" pathLength="1"' : ''} d="M${X(t)} ${Y(t)}L${X(base)} ${Y(base)}" stroke="${esc(color)}" stroke-width="${n1(w * u / 46)}" stroke-linecap="round" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`,
      head: `<path d="M${X(h)} ${Y(h)}L${X(a)} ${Y(a)}L${X(c)} ${Y(c)}Z" fill="${esc(color)}"/>`,
    }
  }
  function hatch(a, b, out) {
    const L = len(sub(b, a)), s = mul(sub(b, a), 1 / L), d = mul(add(out, mul(s, -0.85)), 1 / Math.hypot(1, 0.85))
    let p = ''
    for (let t = 0.12; t < L - 0.05; t += 0.22) { const q = add(a, mul(s, t)), r = add(q, mul(d, 0.24)); p += `M${X(q)} ${Y(q)}L${X(r)} ${Y(r)}`; ext(r) }
    return `<path d="${p}" stroke="${esc(ink)}" stroke-opacity=".5" stroke-width="1.2" fill="none"/>`
  }
  const lw = w => n1(w * u / 46)
  let back = '', mid = '', front = '', top = ''

  // Surroundings
  const sg = surfaceGeom(m)
  if (sg && m.surface.show) {
    if (sg.k === 'incline') {
      const { low, high, B } = sg
      back += `<path d="M${X(low)} ${Y(low)}L${X(B)} ${Y(B)}L${X(high)} ${Y(high)}Z" fill="${esc(ink)}" fill-opacity=".07" stroke="${esc(ink)}" stroke-width="${lw(2)}" stroke-linejoin="round"/>`
      back += hatch(low, B, [0, -1])
      ext(low); ext(high); ext(B)
      const { a0, d } = inclineArc(sg)
      if (Math.abs(d) > 1) {
        const r = 0.85, p0 = add(low, mul(uvec(a0), r)), p1 = add(low, mul(uvec(a0 + d), r))
        back += `<path d="M${X(p0)} ${Y(p0)}A${n1(r * u)} ${n1(r * u)} 0 0 ${d > 0 ? 0 : 1} ${X(p1)} ${Y(p1)}" stroke="${esc(ink)}" stroke-width="${lw(1.4)}" fill="none"/>`
        back += label(m.surface.angleLabel || '\\theta', add(low, mul(uvec(a0 + d / 2), r)), uvec(a0 + d / 2), fs * 0.9, ink)
      }
    } else {
      back += line(sg.line[0], sg.line[1], `stroke="${esc(ink)}" stroke-width="${lw(2)}" stroke-linecap="round"`)
      back += hatch(sg.line[0], sg.line[1], mul(sg.n, -1))
      ext(sg.line[0]); ext(sg.line[1])
    }
  }

  // Axes, through the centre
  if (m.axes !== 'none') {
    const [ex, ey] = axesFrame(m), r = 2.3
    for (const [e, nm] of [[ex, 'x'], [ey, 'y']]) {
      const a = mul(e, -r), b = mul(e, r), p = [-e[1], e[0]], hb = sub(b, mul(e, 0.2))
      mid += line(a, sub(b, mul(e, 0.12)), `stroke="${esc(ink)}" stroke-opacity=".45" stroke-width="${lw(1.2)}"`)
      mid += `<path d="M${X(b)} ${Y(b)}L${X(add(hb, mul(p, 0.07)))} ${Y(add(hb, mul(p, 0.07)))}L${X(sub(hb, mul(p, 0.07)))} ${Y(sub(hb, mul(p, 0.07)))}Z" fill="${esc(ink)}" fill-opacity=".45"/>`
      mid += `<g opacity=".6">${label(nm, b, e, fs * 0.8, ink)}</g>`
      ext(a); ext(b)
    }
  }

  // Ropes, behind the body
  for (const f of m.forces) {
    if (!f.rope || !m.surface.show) continue
    const { u: d, start, end } = ropeGeom(m, f, sol), p = [-d[1], d[0]]
    ext(end, 0.45)
    if (!shown(f.step)) continue
    mid += part(f.step, line(start, end, `stroke="${esc(ink)}" stroke-opacity=".55" stroke-width="${lw(1.6)}"`)
      + line(add(end, mul(p, 0.38)), sub(end, mul(p, 0.38)), `stroke="${esc(ink)}" stroke-width="${lw(2.2)}" stroke-linecap="round"`)
      + hatch(sub(end, mul(p, 0.38)), add(end, mul(p, 0.38)), d))
  }

  // The body
  const [hw, hh] = half(m)
  const bodyHit = o.editor ? ' data-body="1"' : ''
  if (m.body.shape === 'box') {
    const r = bodyRot(m) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r)
    const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [x * cs - y * sn, x * sn + y * cs])
    pts.forEach(p => ext(p))
    mid += `<path${bodyHit} d="M${pts.map(p => `${X(p)} ${Y(p)}`).join('L')}Z" fill="${esc(ink)}" fill-opacity=".1" stroke="${esc(ink)}" stroke-width="${lw(2)}" stroke-linejoin="round"/>`
  } else if (m.body.shape === 'ball') {
    ext([0, 0], hw)
    mid += `<circle${bodyHit} cx="0" cy="0" r="${n1(hw * u)}" fill="${esc(ink)}" fill-opacity=".1" stroke="${esc(ink)}" stroke-width="${lw(2)}"/>`
  }
  if (m.body.shape === 'dot' || m.model === 'particle') {
    const dot0 = m.body.shape === 'dot'
    mid += `<circle cx="0" cy="0" r="${n1((dot0 ? 0.11 : 0.06) * u)}" fill="${esc(ink)}"/>`
    if (dot0 && o.editor) mid += `<circle data-body="1" cx="0" cy="0" r="${n1(0.45 * u)}" fill="#000" fill-opacity="0"/>`
    ext([0, 0], 0.2)
  }
  if (m.body.label) {
    const at = bodyLabelAt(m, sol)
    mid += `<g opacity=".85">${label(m.body.label, at, [0, 0], fs * 0.85, ink)}</g>`
  }

  // Forces
  const [ex, ey] = axesFrame(m)
  for (const f of m.forces) {
    const g = forceGeom(m, f, sol), color = f.color || ink
    if (!shown(f.step)) { ext(g.head, 0.6); ext(g.tail); continue }
    let fade = ''
    // Components along the axes, and the guides to them
    if (f.comps && m.axes !== 'none') {
      const vec = mul(g.u, g.L)
      for (const [e, k, lb] of [[ex, dot(vec, ex), f.compLabels[0] || compLabel(f.label, 'x')], [ey, dot(vec, ey), f.compLabels[1] || compLabel(f.label, 'y')]]) {
        if (Math.abs(k) < 0.08) continue
        const tip = add(g.tail, mul(e, k)), a = arrow(g.tail, tip, color, 1.7, `${n1(6 * u / 46)} ${n1(4 * u / 46)}`)
        fade += line(g.head, tip, `stroke="${esc(color)}" stroke-opacity=".55" stroke-width="${lw(1.1)}" stroke-dasharray="${n1(2 * u / 46)} ${n1(4 * u / 46)}"`) + a.shaft + a.head
        fade += label(lb, tip, mul(e, Math.sign(k)), fs * 0.82, color)
      }
    }
    // The angle it makes with its reference
    if (f.angle !== 'none') {
      const ref = angleRef(m, f, g.deg), d = ref == null ? 0 : angDiff(ref, g.deg)
      if (Math.abs(d) > 1) {
        const r = Math.min(0.75, g.L * 0.55), p0 = add(g.tail, mul(uvec(ref), r)), p1 = add(g.tail, mul(uvec(ref + d), r))
        fade += `<path d="M${X(p0)} ${Y(p0)}A${n1(r * u)} ${n1(r * u)} 0 0 ${d > 0 ? 0 : 1} ${X(p1)} ${Y(p1)}" stroke="${esc(color)}" stroke-width="${lw(1.3)}" fill="none"/>`
        fade += label(f.angleLabel || '\\theta', add(g.tail, mul(uvec(ref + d / 2), r)), uvec(ref + d / 2), fs * 0.8, color)
        if (f.angle === 'level' || f.angle === 'vertical') fade += line(g.tail, add(g.tail, mul(uvec(ref), r + 0.35)), `stroke="${esc(color)}" stroke-opacity=".5" stroke-width="${lw(1.1)}" stroke-dasharray="${n1(3 * u / 46)} ${n1(3 * u / 46)}"`)
      }
    }
    const a = arrow(g.tail, g.head, color, 2.6, '')
    fade = a.head + label(labelText(m, f, sol), g.head, g.u, fs, color) + fade
    let s = ''
    if (o.editor && o.sel === f.id) s += line(g.tail, g.head, `stroke="${esc(o.accent)}" stroke-opacity=".35" stroke-width="12" stroke-linecap="round"`)
    s += a.shaft + (deck != null && f.step > 0 ? `<g class="pxfx-fade">${fade}</g>` : fade)
    if (o.editor) {
      s += `<path data-f="${esc(f.id)}" d="M${X(g.tail)} ${Y(g.tail)}L${X(g.head)} ${Y(g.head)}" stroke="#000" stroke-opacity="0" stroke-width="18" stroke-linecap="round" fill="none"/>`
      if (o.sel === f.id) {
        const hp = isPush(m, f) ? g.tail : g.head
        top += `<circle data-h="${esc(f.id)}" cx="${X(hp)}" cy="${Y(hp)}" r="7" fill="${esc(o.accent)}" stroke="${esc(o.bg || '#fff')}" stroke-width="2"><title>Drag to turn it</title></circle>`
      }
    }
    front += part(f.step, `<g>${s}</g>`)
  }

  // The net force, beside it
  const ng = netGeom(m, sol, { ...bx })
  if (ng) {
    ext(ng.tail); ext(ng.head, 0.15)
    const nl = netLabel(m, sol)
    const lb = label(nl, add(ng.mid, mul(ng.side, 0.05)), ng.side, fs, ink)
    if (shown(m.net.step)) {
      const a = arrow(ng.tail, ng.head, ink, 2.2, `${n1(7 * u / 46)} ${n1(5 * u / 46)}`)
      const inner = a.shaft + a.head + lb
      front += part(m.net.step, deck != null && m.net.step > 0 ? `<g class="pxfx-fade">${inner}</g>` : inner)
    }
  }
  if (!isFinite(bx.x0)) ext([0, 0], 2)
  const box = { x0: bx.x0 * u, x1: bx.x1 * u, y0: -bx.y1 * u, y1: -bx.y0 * u }

  // Captions under the diagram, in room kept for them whenever there are any
  let caps = ''
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b)
  if (o.captions && capSteps.length) {
    const cs = CAPTION * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8
    const one = (n, cls) => {
      const text = m.captions[n]
      if (o.labels === 'text' || !o.labels) return `<text${cls} x="${n1(cx)}" y="${n1(y + cs)}" text-anchor="middle" font-size="${n1(cs)}" fill="${esc(ink)}">${esc(text)}</text>`
      return `<foreignObject${cls} x="${n1(cx - w / 2)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n1(cs)}px;line-height:1.3;color:${esc(ink)}">${esc(text)}</div></foreignObject>`
    }
    if (deck != null) caps = capSteps.map(n => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join('')
    else { const at = capSteps.filter(n => n <= (step ?? 0)).pop(); if (at != null) caps = one(at, '') }
    box.x0 = Math.min(box.x0, cx - w / 2); box.x1 = Math.max(box.x1, cx + w / 2); box.y1 = Math.max(box.y1, y + h)
  }
  return { svg: back + mid + front + top + caps, box, sol, net: ng }
}

// ---------- The element

const baseOptions = m => ({ ink: m.color, captions: true })

// The drawing's box in px, with a margin: the element's shape
export function freebodyBox(el) {
  const m = freebodyModel(el)
  const { box } = drawFreebody(m, baseOptions(m))
  const pad = 0.2 * FREEBODY_UNIT
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad }
}

// The element as an <svg> filling its box. opts: labels, deck (an id: every
// force, marked with its step), step (as at that step; default everything),
// standalone (with a size, for an image)
export function freebodySvg(el, opts = {}) {
  const m = freebodyModel(el), b = freebodyBox(el)
  const { svg } = drawFreebody(m, { ...baseOptions(m), labels: opts.labels || 'text', deck: opts.deck, step: opts.step ?? null })
  const size = opts.standalone ? ` width="${n1(b.w)}" height="${n1(b.h)}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n1(b.x)} ${n1(b.y)} ${n1(b.w)} ${n1(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`
}

// ---------- Steps

// The diagram steps at which it changes: [[slide step, diagram step]]
export function freebodySteps(el) {
  if (el?.type !== 'freebody') return []
  const m = freebodyModel(el), steps = new Set()
  for (const f of m.forces) if (f.step > 0) steps.add(f.step)
  if (m.net.show && m.net.step > 0 && netShown(m, solveFreebody(m))) steps.add(m.net.step)
  for (const k of Object.keys(m.captions)) if (+k > 0) steps.add(+k)
  return [...steps].sort((a, b) => a - b).map(s => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1000)
}
export function freebodyStepAt(el, slideStep) {
  let at = 0
  for (const [n, s] of freebodySteps(el)) if (n <= slideStep) at = s
  return at
}
export function freebodyStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    for (const [n, s] of freebodySteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}
export function hasFreebody(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'freebody'))
}

// ---------- TikZ: plain TikZ with arrows.meta and patterns, each force an
// arrow in polar form from where it acts

function anchorFor(v) {
  const a = ((angOf(v) % 360) + 360) % 360
  return ['right', 'above right', 'above', 'above left', 'left', 'below left', 'below', 'below right'][Math.round(a / 45) % 8]
}
export function freebodyTikz(el) {
  const m = freebodyModel(el), sol = solveFreebody(m)
  const P = p => `(${f2(p[0])},${f2(p[1])})`
  const deg = d => f2(wrap180(d))
  const colors = []
  const col = c => { if (!c) return ''; let i = colors.indexOf(c); if (i < 0) { colors.push(c); i = colors.length - 1 } return `, color=fbc${i + 1}` }
  const body = []
  const sg = surfaceGeom(m)
  if (sg && m.surface.show) {
    if (sg.k === 'incline') {
      const { low, high, B } = sg
      body.push(`  % Incline at ${f2(alpha(m))}°`)
      body.push(`  \\fill[pattern=north east lines] ${P(low)} -- ${P(B)} -- ${P(add(B, [0, -0.2]))} -- ${P(add(low, [0, -0.2]))} -- cycle;`)
      body.push(`  \\draw[thick, fill=black!5] ${P(low)} -- ${P(B)} -- ${P(high)} -- cycle;`)
      const { a0, d } = inclineArc(sg)
      if (Math.abs(d) > 1) {
        body.push(`  \\draw ${P(add(low, mul(uvec(a0), 0.85)))} arc[start angle=${deg(a0)}, end angle=${f2(wrap180(a0) + d)}, radius=0.85];`)
        body.push(`  \\node at ${P(add(low, mul(uvec(a0 + d / 2), 1.2)))} {$${m.surface.angleLabel || '\\theta'}$};`)
      }
    } else {
      const out = mul(sg.n, -0.2)
      body.push(`  % ${{ floor: 'Floor', wall: 'Wall', ceiling: 'Ceiling' }[sg.k]}`)
      body.push(`  \\fill[pattern=north east lines] ${P(sg.line[0])} -- ${P(sg.line[1])} -- ${P(add(sg.line[1], out))} -- ${P(add(sg.line[0], out))} -- cycle;`)
      body.push(`  \\draw[thick] ${P(sg.line[0])} -- ${P(sg.line[1])};`)
    }
    for (const f of m.forces) {
      if (!f.rope) continue
      const { u, start, end } = ropeGeom(m, f, sol), p = [-u[1], u[0]]
      body.push(`  \\draw[gray, thick] ${P(start)} -- ${P(end)};  % rope`)
      body.push(`  \\fill[pattern=north east lines] ${P(add(end, mul(p, 0.38)))} -- ${P(sub(end, mul(p, 0.38)))} -- ${P(add(sub(end, mul(p, 0.38)), mul(u, 0.2)))} -- ${P(add(add(end, mul(p, 0.38)), mul(u, 0.2)))} -- cycle;`)
      body.push(`  \\draw[very thick] ${P(add(end, mul(p, 0.38)))} -- ${P(sub(end, mul(p, 0.38)))};`)
    }
  }
  if (m.axes !== 'none') {
    const [ex, ey] = axesFrame(m)
    body.push('  % Axes')
    body.push(`  \\draw[->, gray] ${P(mul(ex, -2.3))} -- ${P(mul(ex, 2.3))} node[${anchorFor(ex)}] {$x$};`)
    body.push(`  \\draw[->, gray] ${P(mul(ey, -2.3))} -- ${P(mul(ey, 2.3))} node[${anchorFor(ey)}] {$y$};`)
  }
  const [hw, hh] = half(m)
  body.push('  % Body')
  if (m.body.shape === 'box') body.push(`  \\draw[thick, fill=black!10${bodyRot(m) ? `, rotate=${f2(bodyRot(m))}` : ''}] (${f2(-hw)},${f2(-hh)}) rectangle (${f2(hw)},${f2(hh)});`)
  else if (m.body.shape === 'ball') body.push(`  \\draw[thick, fill=black!10] (0,0) circle (${f2(hw)});`)
  if (m.body.shape === 'dot' || m.model === 'particle') body.push('  \\fill (0,0) circle (1.6pt);')
  if (m.body.label) body.push(`  \\node at ${P(bodyLabelAt(m, sol))} {$${m.body.label}$};`)
  if (m.forces.length) body.push('  % Forces')
  const [ex, ey] = axesFrame(m)
  for (const f of m.forces) {
    const g = forceGeom(m, f, sol), c = col(f.color)
    body.push(`  \\draw[force${c}] ${P(g.tail)} -- ++(${deg(g.deg)}:${f2(g.L)}) node[${anchorFor(g.u)}] {$${labelText(m, f, sol)}$};`)
    if (f.comps && m.axes !== 'none') {
      const vec = mul(g.u, g.L)
      for (const [e, k, lb] of [[ex, dot(vec, ex), f.compLabels[0] || compLabel(f.label, 'x')], [ey, dot(vec, ey), f.compLabels[1] || compLabel(f.label, 'y')]]) {
        if (Math.abs(k) < 0.08) continue
        const tip = add(g.tail, mul(e, k))
        body.push(`  \\draw[component${c}] ${P(g.tail)} -- ${P(tip)} node[${anchorFor(mul(e, Math.sign(k)))}] {$${lb}$};`)
        body.push(`  \\draw[guide${c}] ${P(g.head)} -- ${P(tip)};`)
      }
    }
    if (f.angle !== 'none') {
      const ref = angleRef(m, f, g.deg), d = ref == null ? 0 : angDiff(ref, g.deg), r = Math.min(0.75, g.L * 0.55)
      if (Math.abs(d) > 1) {
        body.push(`  \\draw[thin${c}] ${P(add(g.tail, mul(uvec(ref), r)))} arc[start angle=${deg(ref)}, end angle=${f2(wrap180(ref) + d)}, radius=${f2(r)}];`)
        body.push(`  \\node[${c ? c.slice(2) + ', ' : ''}${anchorFor(uvec(ref + d / 2))}, inner sep=1pt] at ${P(add(g.tail, mul(uvec(ref + d / 2), r)))} {$${f.angleLabel || '\\theta'}$};`)
      }
    }
  }
  const ng = drawFreebody(m, { ink: '#000000', sol }).net
  if (ng) {
    body.push('  % Net force, beside the diagram')
    body.push(`  \\draw[force, dashed] ${P(ng.tail)} -- ++(${deg(angOf(ng.u))}:${f2(ng.L)}) node[midway, ${anchorFor(ng.side)}] {$${netLabel(m, sol)}$};`)
  }
  const out = [
    `% Free-body diagram, from Parallax. Arrows are ${f2(m.forceScale)} N per cm.`,
    '% \\usepackage{tikz} \\usetikzlibrary{arrows.meta, patterns}',
    ...colors.map((c, i) => `\\definecolor{fbc${i + 1}}{HTML}{${c.slice(1).toUpperCase()}}`),
    '\\begin{tikzpicture}[>={Stealth[length=7pt, width=6pt]},',
    '  force/.style={->, line width=1.2pt},',
    '  component/.style={->, densely dashed},',
    '  guide/.style={densely dotted, thin}]',
    ...body,
    '\\end{tikzpicture}',
  ]
  // \text needs amsmath; \mathrm doesn't
  return out.join('\n').replace(/\\text\{/g, '\\mathrm{')
}

// ---------- Templates

const F = (id, kind, o) => ({
  id, kind, label: FORCE_KINDS[kind].label, magMode: 'given', mag: '', mu: '0.3', dir: { from: 'level', deg: 0 }, push: false,
  comps: false, compLabels: ['', ''], angle: 'none', angleLabel: '\\theta', rope: false, color: null, step: 0, ...o,
})
const level = deg => ({ from: 'level', deg })
const along = deg => ({ from: 'surface', deg })
const base = extra => ({
  body: { shape: 'box', w: 1.6, h: 1, label: 'm', mass: '5' },
  surface: { kind: 'floor', angle: 30, angleLabel: '\\theta', show: true },
  model: 'particle', axes: 'level', motion: 'rest', forceScale: 15, values: false,
  net: { show: true, step: 0, label: 'F_{\\text{net}}' }, forces: [], captions: {}, ...extra,
})
export const FREEBODY_TEMPLATES = [
  { key: 'incline', name: 'Block at rest on an incline', build: () => base({
    surface: { kind: 'incline', angle: 30, angleLabel: '\\theta', show: true }, axes: 'surface',
    forces: [
      F('f1', 'weight', { label: 'mg', magMode: 'mass', dir: level(-90), comps: true, compLabels: ['mg\\sin\\theta', 'mg\\cos\\theta'], angle: 'normal', step: 1 }),
      F('f2', 'normal', { label: 'F_N', magMode: 'solve', dir: along(90), step: 2 }),
      F('f3', 'friction', { label: 'f_s', magMode: 'solve', dir: along(0), step: 3 }),
    ],
    captions: { 1: 'Gravity pulls it straight down: mg sin θ along the slope, mg cos θ into it.', 2: 'The slope pushes back, perpendicular to its surface.', 3: 'Static friction holds it: every component balances.' },
  }) },
  { key: 'slide', name: 'Block sliding down, with friction', build: () => base({
    body: { shape: 'box', w: 1.6, h: 1, label: 'm', mass: '4' },
    surface: { kind: 'incline', angle: 35, angleLabel: '\\theta', show: true }, axes: 'surface', motion: 'slide', forceScale: 12, values: true,
    net: { show: true, step: 4, label: 'F_{\\text{net}}' },
    forces: [
      F('f1', 'weight', { label: 'mg', magMode: 'mass', dir: level(-90), step: 1 }),
      F('f2', 'normal', { label: 'F_N', magMode: 'solve', dir: along(90), step: 2 }),
      F('f3', 'friction', { label: 'f_k', magMode: 'mu', mu: '0.25', dir: along(0), step: 3 }),
    ],
    captions: { 1: 'Its weight.', 2: 'The normal force balances the part of the weight into the slope.', 3: 'Kinetic friction, μk times the normal force, acts up the slope.', 4: 'What’s left accelerates it down the slope.' },
  }) },
  { key: 'sled', name: 'Sled pulled at an angle', build: () => base({
    body: { shape: 'box', w: 1.8, h: 0.8, label: 'm', mass: '20' }, forceScale: 50, motion: 'slide', values: true,
    net: { show: true, step: 4, label: 'F_{\\text{net}}' },
    forces: [
      F('f1', 'weight', { label: 'mg', magMode: 'mass', dir: level(-90), step: 1 }),
      F('f2', 'tension', { label: 'T', mag: '80', dir: level(30), rope: true, comps: true, compLabels: ['T\\cos\\theta', 'T\\sin\\theta'], angle: 'level', angleLabel: '30^\\circ', color: '#3b82f6', step: 2 }),
      F('f3', 'normal', { label: 'F_N', magMode: 'solve', dir: along(90), step: 3 }),
      F('f4', 'friction', { label: 'f_k', magMode: 'mu', mu: '0.15', dir: along(180), step: 3 }),
    ],
    captions: { 1: 'A 20 kg sled on snow, with μk = 0.15.', 2: 'An 80 N pull at 30°: part forward, part lifting.', 3: 'The lift lowers the normal force, and friction with it.', 4: 'The net force speeds it up.' },
  }) },
  { key: 'sign', name: 'Sign hanging from two ropes', build: () => base({
    surface: { kind: 'none', angle: 0, angleLabel: '\\theta', show: true },
    body: { shape: 'box', w: 1.8, h: 0.9, label: 'm', mass: '10' }, forceScale: 25, values: true,
    forces: [
      F('f1', 'weight', { label: 'mg', magMode: 'mass', dir: level(-90), step: 1 }),
      F('f2', 'tension', { label: 'T_1', magMode: 'solve', dir: level(135), rope: true, angle: 'level', angleLabel: '45^\\circ', step: 2 }),
      F('f3', 'tension', { label: 'T_2', magMode: 'solve', dir: level(60), rope: true, angle: 'level', angleLabel: '60^\\circ', step: 2 }),
    ],
    captions: { 1: 'A 10 kg sign: its weight pulls straight down.', 2: 'The tensions are whatever balances it, and the steeper rope takes more.' },
  }) },
  { key: 'fall', name: 'Ball falling with air resistance', build: () => base({
    surface: { kind: 'none', angle: 0, angleLabel: '\\theta', show: true },
    body: { shape: 'ball', w: 1, h: 1, label: '', mass: '0.5' }, forceScale: 2.5, motion: 'free', values: true,
    net: { show: true, step: 3, label: 'F_{\\text{net}}' },
    forces: [
      F('f1', 'weight', { label: 'mg', magMode: 'mass', dir: level(-90), step: 1 }),
      F('f2', 'drag', { label: 'F_D', mag: '3', dir: level(90), step: 2 }),
    ],
    captions: { 1: 'Gravity: 4.9 N down.', 2: 'Air resistance, 3 N, opposes the fall.', 3: 'The net force is less than its weight, so it falls with less than g.' },
  }) },
  { key: 'blank', name: 'Blank: a block on a floor', build: () => base({ forces: [] }) },
]

// A new diagram: the first template, in the slide's text color
export function defaultFreebody(dark = true) {
  return { ...FREEBODY_TEMPLATES[0].build(), color: dark ? '#ffffff' : '#1a1a1a', stepStart: 1, dimPast: false }
}

// ---------- Editor helpers: changes to a diagram, made in place

export function newForceId(m) {
  const used = new Set(m.forces.map(f => f.id))
  let n = 1
  while (used.has('f' + n)) n++
  return 'f' + n
}
// A new force of a kind, in its usual direction, with its usual way of
// getting its size for the diagram's surface and motion
export function addForce(m, kind, extra = {}) {
  const surf = m.surface.kind !== 'none', hasMass = readNumber(m.body.mass) != null
  const upSlope = along(m.surface.kind === 'incline' && alpha(m) < 0 ? 180 : 0)
  const o = {
    weight: { magMode: hasMass ? 'mass' : 'given', mag: '50', dir: level(-90), label: hasMass ? 'mg' : 'F_g' },
    normal: surf ? { magMode: m.motion === 'free' ? 'given' : 'solve', mag: '50', dir: along(90) } : { mag: '20', dir: level(90) },
    friction: { magMode: m.motion === 'rest' ? 'solve' : 'mu', mu: '0.3', mag: '10', dir: m.surface.kind === 'incline' ? upSlope : along(180) },
    tension: { mag: '30', dir: level(surf ? 30 : 90), rope: true },
    applied: { mag: '20', dir: level(0) },
    drag: { mag: '5', dir: level(90) },
    spring: { mag: '10', dir: surf ? along(180) : level(180) },
    custom: { mag: '10', dir: level(45) },
  }[kind] || {}
  const f = F(newForceId(m), kind, { ...o, ...extra })
  m.forces.push(f)
  return f
}
// Turns a force so its head (a push's tail) is at p, in cm; a given
// magnitude is sized to it too. Angles snap to 5° in the force's own frame,
// and to horizontal, vertical, along the surface and off it within 4°,
// unless free
export function aimForce(m, f, p, sol, free = false) {
  const fromContact = m.model === 'extended' && (f.kind === 'normal' || f.kind === 'friction') && m.surface.kind !== 'none'
  let v = sub(p, fromContact ? contact(m) : [0, 0])
  if (isPush(m, f)) v = mul(v, -1)
  if (len(v) < 0.05) return
  let deg = angOf(v)
  const a = alpha(m), frame = f.dir.from === 'surface' ? a : 0
  if (!free) {
    let best = null
    for (const c of [0, 90, 180, -90, a, a + 90, a + 180, a - 90]) {
      const d = Math.abs(angDiff(c, deg))
      if (d < 4 && (best == null || d < best.d)) best = { c, d }
    }
    deg = best ? best.c : frame + Math.round(angDiff(frame, deg) / 5) * 5
  }
  const reversed = sol.mag[f.id] != null && sol.mag[f.id] < 0
  f.dir.deg = wrap180(deg - frame + (reversed ? 180 : 0))
  if (f.magMode === 'given') {
    let L = len(v)
    if (m.model === 'extended' && !fromContact && f.kind !== 'weight') L -= len(boundary(m, uvec(deg)))
    const q = m.forceScale >= 10 ? 1 : 0.1
    f.mag = String(Number((Math.max(q, Math.round(Math.max(0.3, L) * m.forceScale / q) * q)).toFixed(q < 1 ? 1 : 0)))
  }
}
