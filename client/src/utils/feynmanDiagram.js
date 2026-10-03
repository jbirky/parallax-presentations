// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Feynman diagram elements, made in FeynmanEditorModal (toolbar: Diagrams →
// Feynman Diagram): { type: 'feynman', vertices, edges, captions, color,
// stepStart, dimPast }. Vertices are points in TikZ centimetres, y up; edges
// are lines between two of them in a TikZ-Feynman style (fermion, photon,
// gluon, …), straight, bent into a circular arc, or a loop from a vertex back
// to itself. The element keeps the diagram rather than a picture of it:
// feynmanSvg draws it wherever it appears (the canvas, thumbnails, decks,
// printed pages, PPTX) and feynmanTikz writes it for a paper.
//
// A line or vertex can have a step, the click it appears at (0: from the
// start; a vertex without one comes with its first line), and a step can have
// a caption. Diagram step n is the slide's step stepStart - 1 + n, a hidden
// fragment counted with the slide's others, as equations' are. The server's
// pages have all this through server/services/deck-html.js.

export const UNIT = 64          // px per cm in the drawing's own coordinates
const SNAP = 0.25
const AMP = 0.085, HALF = 0.155 // photon amplitude, half wavelength
const PITCH = 0.19, COIL = 0.1  // gluon coil pitch, radius
const DBL = 0.032               // half the gap of a double line
const LABEL = 0.3               // label size
const CAPTION = 0.27            // caption size
const MATH_FONT = "'Latin Modern Roman', 'Times New Roman', Times, serif"

export const FEYNMAN_COLORS = ['#5aa9ff', '#ff9a52', '#4cc36a', '#c58cff', '#f0c04b', '#ff7aa2']

export const FEYNMAN_TYPES = {
  fermion: { name: 'Fermion', tikz: 'fermion', arrow: 1, fermion: true, key: 'f', usual: 'e, μ, q, t', chips: ['e^-', '\\mu^-', 'q', 't', '\\nu_e'] },
  antifermion: { name: 'Antifermion', tikz: 'anti fermion', arrow: -1, fermion: true, key: 'a', usual: 'e⁺, antiquarks', chips: ['e^+', '\\bar{q}', '\\bar{\\nu}_e'] },
  photon: { name: 'Photon', tikz: 'photon', deco: 'wave', key: 'p', usual: 'γ, Z, W', chips: ['\\gamma', '\\gamma^*', 'Z', 'W^-'] },
  chargedBoson: { name: 'Charged boson', tikz: 'charged boson', deco: 'wave', arrow: 1, usual: 'W⁺, W⁻', chips: ['W^+', 'W^-'] },
  gluon: { name: 'Gluon', tikz: 'gluon', deco: 'coil', key: 'g', usual: 'g', chips: ['g'] },
  scalar: { name: 'Scalar', tikz: 'scalar', dash: '7 5', key: 's', usual: 'H, φ, π⁰', chips: ['H', '\\phi', '\\pi^0'] },
  chargedScalar: { name: 'Charged scalar', tikz: 'charged scalar', dash: '7 5', arrow: 1, usual: 'H⁺, π⁺, K⁺', chips: ['H^+', '\\pi^+', 'K^+'] },
  ghost: { name: 'Ghost', tikz: 'ghost', dash: 'dot', arrow: 1, usual: 'Faddeev–Popov ghost', chips: ['c', '\\bar{c}'] },
  graviton: { name: 'Graviton', tikz: 'graviton', deco: 'wave2', usual: 'graviton', chips: ['h_{\\mu\\nu}'] },
  plain: { name: 'Plain', tikz: 'plain', usual: 'any, or a Majorana line', chips: [] },
  double: { name: 'Double', tikz: 'double', deco: 'double', usual: 'heavy quark, composite', chips: ['Q', 'B'] },
}
export const FEYNMAN_TOOLS = ['fermion', 'antifermion', 'photon', 'chargedBoson', 'gluon', 'scalar', 'chargedScalar', 'ghost', 'graviton', 'plain', 'double']
export const VERTEX_KINDS = [['auto', 'Auto'], ['none', 'None'], ['dot', 'Dot'], ['blob', 'Blob'], ['crossed', 'Crossed'], ['empty', 'Empty'], ['square', 'Square']]
const KIND_R = { blob: 0.36, crossed: 0.125, empty: 0.072 }
const LABEL_AT = { above: [0, 1], below: [0, -1], left: [-1, 0], right: [1, 0] }
export const FEYNMAN_FIELDS = ['vertices', 'edges', 'captions', 'color', 'stepStart', 'dimPast']

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n1 = v => String(Math.round(v * 10) / 10)
const n2 = v => String(Math.round(v * 100) / 100)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// ---------- The diagram from an element, which can come from anyone: every
// field is checked, and lines between vertices that aren't there are dropped

const ID = /^[A-Za-z0-9_-]{1,40}$/
const COLOR = /^#[0-9a-f]{6}$/i
const num = (v, lo, hi, dflt) => (typeof v === 'number' && isFinite(v) ? clamp(v, lo, hi) : dflt)
const int = (v, lo, hi, dflt) => (typeof v === 'number' && isFinite(v) ? clamp(Math.round(v), lo, hi) : dflt)
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

export function feynmanModel(el) {
  const vertices = [], edges = [], ids = new Set()
  for (const v of Array.isArray(el?.vertices) ? el.vertices.slice(0, 500) : []) {
    if (!v || !ID.test(v.id) || ids.has(v.id)) continue
    ids.add(v.id)
    vertices.push({
      id: v.id, x: num(v.x, -1000, 1000, 0), y: num(v.y, -1000, 1000, 0),
      kind: VERTEX_KINDS.some(([k]) => k === v.kind) ? v.kind : 'auto',
      label: str(v.label, 200), labelAt: LABEL_AT[v.labelAt] ? v.labelAt : 'auto',
      color: COLOR.test(v.color || '') ? v.color : null,
      step: v.step == null ? null : int(v.step, 0, 1000, null),
    })
  }
  const edgeIds = new Set()
  for (const e of Array.isArray(el?.edges) ? el.edges.slice(0, 1000) : []) {
    if (!e || !ID.test(e.id) || edgeIds.has(e.id) || !ids.has(e.from) || !ids.has(e.to)) continue
    edgeIds.add(e.id)
    const out = {
      id: e.id, from: e.from, to: e.to,
      particle: FEYNMAN_TYPES[e.particle] ? e.particle : 'plain',
      bend: num(e.bend, -1.6, 1.6, 0),
      label: str(e.label, 200), labelSide: e.labelSide === -1 ? -1 : 1,
      momentum: str(e.momentum, 200), momentumSide: e.momentumSide === 1 ? 1 : -1, momentumReverse: !!e.momentumReverse,
      color: COLOR.test(e.color || '') ? e.color : null,
      step: int(e.step, 0, 1000, 0),
    }
    if (e.from === e.to) { out.loopAngle = int(e.loopAngle, -360, 720, 90); out.loopSize = num(e.loopSize, 0.3, 6, 1.2) }
    edges.push(out)
  }
  const captions = {}
  if (el?.captions && typeof el.captions === 'object') {
    for (const [k, v] of Object.entries(el.captions)) {
      const n = Number(k)
      if (Number.isInteger(n) && n >= 0 && n <= 1000 && typeof v === 'string' && v.trim()) captions[n] = v.slice(0, 500)
    }
  }
  return {
    vertices, edges, captions,
    color: COLOR.test(el?.color || '') ? el.color : '#ffffff',
    stepStart: int(el?.stepStart, 1, 1000, 1),
    dimPast: el?.dimPast !== false,
  }
}

// ---------- Labels as SVG text, from a small part of TeX, where KaTeX can't
// be used (PowerPoint, which leaves out HTML inside an SVG)

const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' }
const SYM = { pm: '±', mp: '∓', to: '→', prime: '′', ell: 'ℓ', ast: '∗', times: '×', cdot: '·', infty: '∞', partial: '∂', hbar: 'ℏ', ',': ' ', ';': ' ', ' ': ' ', '!': '', quad: '  ' }
const ACCENT = { bar: 0x304, overline: 0x305, tilde: 0x303, hat: 0x302 }
const UPRIGHT = { mathrm: 1, text: 1, rm: 1, mathbf: 1 }
const COMBINING = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g')

// Runs of text: { t, lvl: 0, 1 (superscript) or -1 (subscript), it: italic }
export function texRuns(src) {
  src = String(src || '')
  const runs = []
  let i = 0
  const push = (t, lvl, it) => {
    if (!t) return
    const r = runs[runs.length - 1]
    if (r && r.lvl === lvl && r.it === it) r.t += t
    else runs.push({ t, lvl, it })
  }
  function atom(lvl, up) {
    const c = src[i]
    if (c === undefined) return
    if (c === '{') { i++; group(lvl, up, '}'); return }
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i))
      if (!m) { i++; return }
      i += m[0].length
      const name = m[1]
      if (ACCENT[name]) {
        const before = runs.length, lastLen = before ? runs[before - 1].t.length : 0
        while (src[i] === ' ') i++
        atom(lvl, up)
        const mark = String.fromCharCode(ACCENT[name])
        if (runs.length > before) { const r = runs[before]; r.t = r.t.slice(0, 1) + mark + r.t.slice(1) }
        else if (before && runs[before - 1].t.length > lastLen) { const r = runs[before - 1]; r.t = r.t.slice(0, lastLen + 1) + mark + r.t.slice(lastLen + 1) }
        return
      }
      if (UPRIGHT[name]) { while (src[i] === ' ') i++; atom(lvl, true); return }
      if (GREEK[name]) { push(GREEK[name], lvl, !up && name[0] === name[0].toLowerCase()); return }
      if (SYM[name] !== undefined) { push(SYM[name], lvl, false); return }
      push(name, lvl, false)
      return
    }
    i++
    if (/[A-Za-z]/.test(c)) push(c, lvl, !up)
    else if (c === '-') push('−', lvl, false)
    else if (c === "'") push('′', lvl, false)
    else if (c === '~') push(' ', lvl, false)
    else if (c !== ' ') push(c, lvl, false)
  }
  function group(lvl, up, end) {
    while (i < src.length && src[i] !== end) {
      if (src[i] === '^' || src[i] === '_') {
        const l = src[i] === '^' ? 1 : -1
        i++
        atom(lvl || l, up)
        continue
      }
      if (src[i] === '}') { i++; continue }
      atom(lvl, up)
    }
    if (end && src[i] === end) i++
  }
  group(0, false, null)
  return runs
}

// About how much room a label takes, in px at font size fs
export function texBox(src, fs) {
  let w = 0, sup = false, sub = false
  for (const r of texRuns(src)) {
    w += r.t.replace(COMBINING, '').length * fs * 0.5 * (r.lvl ? 0.7 : 1)
    if (r.lvl > 0) sup = true
    if (r.lvl < 0) sub = true
  }
  return { w: Math.max(w, fs * 0.4), h: fs * (1 + (sup ? 0.25 : 0) + (sub ? 0.2 : 0)) }
}

function texSvg(src, X, Y, fs, fill) {
  let cur = 0, spans = ''
  for (const r of texRuns(src)) {
    const target = r.lvl > 0 ? -0.42 : r.lvl < 0 ? 0.24 : 0
    const dy = (target - cur) * fs
    cur = target
    spans += `<tspan dy="${n1(dy)}" font-size="${n1(r.lvl ? fs * 0.7 : fs)}" font-style="${r.it ? 'italic' : 'normal'}">${esc(r.t)}</tspan>`
  }
  return `<text x="${n1(X)}" y="${n1(Y + fs * 0.34)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(fs)}" fill="${esc(fill)}">${spans}</text>`
}

// ---------- Geometry. A line is g: g.len, and g.at(t) = [x, y, tx, ty], its
// point and unit tangent a fraction t of the way along it

export function lineGeometry(V, e) {
  const A = V[e.from], B = V[e.to]
  if (!A || !B) return null
  if (e.from === e.to) {
    const r = (e.loopSize || 1.2) / 2, ang = (e.loopAngle ?? 90) * Math.PI / 180
    const cx = A.x + r * Math.cos(ang), cy = A.y + r * Math.sin(ang), a0 = ang + Math.PI
    return { len: 2 * Math.PI * r, curved: true,
      at: t => { const th = a0 - 2 * Math.PI * t; return [cx + r * Math.cos(th), cy + r * Math.sin(th), Math.sin(th), -Math.cos(th)] } }
  }
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-9
  const b = e.bend || 0
  if (Math.abs(b) < 0.02) return { len: d, at: t => [A.x + dx * t, A.y + dy * t, dx / d, dy / d] }
  // An arc whose sagitta is b times half the chord, to the left of A → B
  const h = d / 2, s = b * h, R = (h * h + s * s) / (2 * Math.abs(s))
  const nx = -dy / d, ny = dx / d, off = s - Math.sign(s) * R
  const cx = (A.x + B.x) / 2 + nx * off, cy = (A.y + B.y) / 2 + ny * off
  const th0 = Math.atan2(A.y - cy, A.x - cx), th1 = Math.atan2(B.y - cy, B.x - cx)
  let sw = th1 - th0
  if (s > 0) { while (sw >= 0) sw -= 2 * Math.PI; while (sw < -2 * Math.PI) sw += 2 * Math.PI }
  else { while (sw <= 0) sw += 2 * Math.PI; while (sw > 2 * Math.PI) sw -= 2 * Math.PI }
  const sg = Math.sign(sw)
  return { len: R * Math.abs(sw), curved: true,
    at: t => { const th = th0 + sw * t; return [cx + R * Math.cos(th), cy + R * Math.sin(th), -sg * Math.sin(th), sg * Math.cos(th)] } }
}
const part = (g, t0, t1) => ({ len: g.len * (t1 - t0), curved: g.curved, at: t => g.at(t0 + (t1 - t0) * t) })

export function basePoints(g, off = 0) {
  const n = g.curved ? 72 : 1, pts = []
  for (let i = 0; i <= n; i++) { const [x, y, tx, ty] = g.at(i / n); pts.push([x - ty * off, y + tx * off]) }
  return pts
}
// A whole number of half waves, so the line ends on its vertices
export function wavePoints(g, off = 0) {
  const k = Math.max(2, Math.round(g.len / HALF)), n = k * 10, pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y, tx, ty] = g.at(t), o = AMP * Math.sin(Math.PI * k * t) + off
    pts.push([x - ty * o, y + tx * o])
  }
  return pts
}
// A whole number of coils, growing over the first half coil and shrinking
// over the last, so the line starts and ends on its vertices
export function coilPoints(g) {
  const L = g.len, N = Math.max(2, Math.round(L / PITCH)), n = N * 20, pts = []
  for (let i = 0; i <= n; i++) {
    const u = i / n, th = 2 * Math.PI * N * u
    const q = Math.min(u, 1 - u) * N * 2, w = q >= 1 ? 1 : q * q * (3 - 2 * q)
    const s = u * L - COIL * w * Math.sin(th), o = -COIL * w * Math.cos(th)
    const tc = clamp(s / L, 0, 1), [x, y, tx, ty] = g.at(tc), ex = s - tc * L
    pts.push([x + tx * ex - ty * o, y + ty * ex + tx * o])
  }
  return pts
}
const decoAmp = t => t.deco === 'wave' ? AMP : t.deco === 'wave2' ? AMP + DBL : t.deco === 'coil' ? COIL + 0.02 : t.deco === 'double' ? DBL : 0

// The fraction of the way along a line nearest point p, away from its ends
export function nearestOnLine(g, p) {
  let best = 0.5, bd = Infinity
  for (let i = 0; i <= 80; i++) { const t = i / 80, [x, y] = g.at(t), d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = t } }
  return clamp(best, 0.08, 0.92)
}

// ---------- Questions about a diagram

export function vertexMap(m) { const V = {}; for (const v of m.vertices) V[v.id] = v; return V }
export function degrees(m) {
  const d = {}
  for (const v of m.vertices) d[v.id] = 0
  for (const e of m.edges) { d[e.from] = (d[e.from] || 0) + 1; d[e.to] = (d[e.to] || 0) + 1 }
  return d
}
// 'auto' is a dot where three or more lines meet
export const shownKind = (v, deg) => v.kind && v.kind !== 'auto' ? v.kind : (deg[v.id] >= 3 ? 'dot' : 'none')
export function vertexStep(m, v) {
  if (v.step != null) return v.step
  let s = Infinity
  for (const e of m.edges) if (e.from === v.id || e.to === v.id) s = Math.min(s, e.step || 0)
  return isFinite(s) ? s : 0
}
export function maxStep(m) {
  let s = 0
  for (const e of m.edges) s = Math.max(s, e.step || 0)
  for (const v of m.vertices) if (v.step != null) s = Math.max(s, v.step)
  return s
}
// Vertices where fermion arrows don't flow through: as many in as out
export function flowWarnings(m) {
  const bad = []
  for (const v of m.vertices) {
    let inn = 0, out = 0, deg = 0
    for (const e of m.edges) {
      if (e.from !== v.id && e.to !== v.id) continue
      deg += e.from === e.to ? 2 : 1
      const t = FEYNMAN_TYPES[e.particle]
      if (!t || !t.fermion) continue
      const src = t.arrow > 0 ? e.from : e.to, dst = t.arrow > 0 ? e.to : e.from
      if (dst === v.id) inn++
      if (src === v.id) out++
    }
    if (deg >= 2 && inn !== out) bad.push(v.id)
  }
  return bad
}
// The directions a vertex's lines leave it in
function legDirections(m, V, v) {
  const dirs = []
  for (const e of m.edges) {
    if (e.from !== v.id && e.to !== v.id) continue
    const g = lineGeometry(V, e)
    if (!g) continue
    if (e.from === v.id) { const [, , tx, ty] = g.at(0.01); dirs.push([tx, ty]) }
    if (e.to === v.id) { const [, , tx, ty] = g.at(0.99); dirs.push([-tx, -ty]) }
  }
  return dirs
}
// Where a vertex's label goes: away from its lines, preferring up
function labelDirection(m, V, v) {
  if (LABEL_AT[v.labelAt]) return LABEL_AT[v.labelAt]
  const dirs = legDirections(m, V, v)
  if (!dirs.length) return [0, 1]
  let sx = 0, sy = 0
  for (const d of dirs) { sx += d[0]; sy += d[1] }
  const sl = Math.hypot(sx, sy)
  if (dirs.length === 1) return [-sx / sl, -sy / sl]
  let best = [0, 1], score = -Infinity
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8, c = [Math.cos(a), Math.sin(a)]
    let gap = Infinity
    for (const d of dirs) gap = Math.min(gap, Math.acos(clamp(c[0] * d[0] + c[1] * d[1], -1, 1)))
    const sc = gap + (sl > 0.2 ? 0.25 * (-(sx * c[0] + sy * c[1]) / sl) : 0) + 0.06 * c[1]
    if (sc > score) { score = sc; best = c }
  }
  return best
}
// The diagram's extent in cm, its vertices and curves
export function diagramBounds(m) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const V = vertexMap(m)
  for (const v of m.vertices) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y) }
  for (const e of m.edges) {
    const g = lineGeometry(V, e)
    if (!g || !g.curved) continue
    for (let i = 0; i <= 24; i++) { const [x, y] = g.at(i / 24); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  }
  if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 5, y1: 2.5 }
  return { x0, y0, x1, y1 }
}

// ---------- Drawing: the diagram as SVG markup in px (UNIT per cm, y down),
// and the box it covers. o:
//   ink, lw         line color and width
//   labels          'text' (SVG text), 'deck' (spans the page's KaTeX fills
//                   in) or a function from TeX to HTML
//   deck            for a presented deck: an id, and every part is drawn,
//                   marked with its step (applyFeynmanStep shows them)
//   step, dim       drawn as it is at a step, earlier parts faded with dim
//   captions        draw the step captions under the diagram
//   editor          for the editor: hit areas, vertex marks, sel, warn,
//                   grid and view, in the colors mark, accent and warnColor

export function drawDiagram(m, o = {}) {
  const u = o.U || UNIT, k = u / 64, V = vertexMap(m), deg = degrees(m)
  const lw = o.lw || 2.2, fs = LABEL * u
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, '') : null
  const stepped = deck == null && o.step != null
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const grow = (X, Y, rx = 0, ry = rx) => {
    box.x0 = Math.min(box.x0, X - rx); box.x1 = Math.max(box.x1, X + rx)
    box.y0 = Math.min(box.y0, Y - ry); box.y1 = Math.max(box.y1, Y + ry)
  }
  const P = (pts, measure = true) => {
    let d = ''
    pts.forEach((p, i) => {
      const X = p[0] * u, Y = -p[1] * u
      if (measure) grow(X, Y, lw)
      d += (i ? 'L' : 'M') + n1(X) + ' ' + n1(Y)
    })
    return d
  }
  const stroke = (d, ink, extra = '', w = lw) => `<path d="${d}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`
  const label = (tex, X, Y, size, ink) => {
    const b = texBox(tex, size)
    grow(X, Y, b.w / 2, b.h / 2)
    if (o.labels === 'deck' || typeof o.labels === 'function') {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size
      const inner = o.labels === 'deck' ? `<span data-math-latex="${esc(tex)}">${esc(tex)}</span>` : o.labels(tex)
      return `<foreignObject x="${n1(X - w / 2)}" y="${n1(Y - h / 2)}" width="${n1(w)}" height="${n1(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n1(size / 1.21)}px;color:${esc(ink)}">${inner}</div></foreignObject>`
    }
    return texSvg(tex, X, Y, size, ink)
  }
  const visible = s => !stepped || s <= o.step
  // A part (a line or a vertex) as the mode wants it
  const wrap = (s, lines, labels, revealPts, isVertex, id) => {
    if (deck != null) {
      const cls = `pxfx-part${isVertex ? ' pxfx-v' : ''}`
      if (s > 0 && revealPts) {
        const mid = `pxfxm-${deck}-${id}`
        return `<g class="${cls}" data-fx-at="${s}"><mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><path class="pxfx-reveal" pathLength="1" d="${P(revealPts, false)}" fill="none" stroke="#fff" stroke-width="${n1(40 * k)}" stroke-linecap="round"/></mask><g mask="url(#${mid})">${lines}</g><g class="pxfx-fade">${labels}</g></g>`
      }
      return `<g class="${cls}" data-fx-at="${s}">${lines}${labels}</g>`
    }
    const faded = stepped && o.dim && o.step > 0 && s < o.step
    return `<g${faded ? ' opacity=".34"' : ''}>${lines}${labels}</g>`
  }
  let out = ''

  if (o.editor && o.grid && o.view) {
    const v = o.view, gx = v.x0 * u, gy = -(v.y0 + v.h) * u
    out += `<defs><pattern id="pxfx-g1" width="${u / 2}" height="${u / 2}" x="${-u / 4}" y="${-u / 4}" patternUnits="userSpaceOnUse"><circle cx="${u / 4}" cy="${u / 4}" r="1" fill="${esc(o.mark)}" fill-opacity=".5"/></pattern>`
      + `<pattern id="pxfx-g2" width="${u}" height="${u}" x="${-u / 2}" y="${-u / 2}" patternUnits="userSpaceOnUse"><circle cx="${u / 2}" cy="${u / 2}" r="1.7" fill="${esc(o.mark)}" fill-opacity=".75"/></pattern></defs>`
      + `<rect x="${n1(gx)}" y="${n1(gy)}" width="${n1(v.w * u)}" height="${n1(v.h * u)}" fill="url(#pxfx-g1)"/>`
      + `<rect x="${n1(gx)}" y="${n1(gy)}" width="${n1(v.w * u)}" height="${n1(v.h * u)}" fill="url(#pxfx-g2)"/>`
  }

  // Lines
  for (const e of m.edges) {
    const g0 = lineGeometry(V, e)
    if (!g0) continue
    const s = e.step || 0
    if (!visible(s)) continue
    const t = FEYNMAN_TYPES[e.particle] || FEYNMAN_TYPES.plain
    const ink = e.color || o.ink || '#ffffff'
    const loop = e.from === e.to
    // Lines stop at the edge of a blob or a circled vertex
    const trim = id => (KIND_R[shownKind(V[id], deg)] || 0) / g0.len
    const t0 = loop ? 0 : Math.min(0.45, trim(e.from)), t1 = loop ? 1 : 1 - Math.min(0.45, trim(e.to))
    const g = t0 > 0 || t1 < 1 ? part(g0, t0, t1) : g0

    let lines = ''
    if (o.editor && o.sel && o.sel.kind === 'e' && o.sel.id === e.id) lines += `<path d="${P(basePoints(g0))}" fill="none" stroke="${esc(o.accent)}" stroke-opacity=".32" stroke-width="${n1(14 * k)}" stroke-linecap="round"/>`
    if (t.deco === 'wave') lines += stroke(P(wavePoints(g)), ink)
    else if (t.deco === 'wave2') lines += stroke(P(wavePoints(g, DBL)), ink) + stroke(P(wavePoints(g, -DBL)), ink)
    else if (t.deco === 'coil') lines += stroke(P(coilPoints(g)), ink)
    else if (t.deco === 'double') lines += stroke(P(basePoints(g, DBL)), ink, '', lw * 0.8) + stroke(P(basePoints(g, -DBL)), ink, '', lw * 0.8)
    else if (t.dash === 'dot') lines += stroke(P(basePoints(g)), ink, ` stroke-dasharray="0.1 ${n1(6 * k)}"`, lw * 1.45)
    else if (t.dash) lines += stroke(P(basePoints(g)), ink, ` stroke-dasharray="${t.dash.split(' ').map(x => n1(x * k)).join(' ')}"`)
    else lines += stroke(P(basePoints(g)), ink)

    if (t.arrow) {
      const [x, y, tx, ty] = g.at(0.5), X = x * u, Y = -y * u
      const dx = tx * t.arrow, dy = -ty * t.arrow, nx = -dy, ny = dx, aL = 7.5 * k, aW = 5.4 * k
      lines += `<path d="M${n1(X + dx * aL)} ${n1(Y + dy * aL)}L${n1(X - dx * aL * 0.75 + nx * aW)} ${n1(Y - dy * aL * 0.75 + ny * aW)}L${n1(X - dx * aL * 0.75 - nx * aW)} ${n1(Y - dy * aL * 0.75 - ny * aW)}Z" fill="${esc(ink)}"/>`
    }

    let labels = ''
    const amp = decoAmp(t), ms = e.momentumSide || -1, ls = e.labelSide || 1
    if (e.momentum) {
      const off = amp + 0.2, pts = []
      for (let i = 0; i <= 18; i++) { const [x, y, tx, ty] = g.at(0.3 + 0.4 * i / 18); pts.push([x - ty * off * ms, y + tx * off * ms]) }
      if (e.momentumReverse) pts.reverse()
      const a = pts[pts.length - 2], b = pts[pts.length - 1]
      const hx = (b[0] - a[0]) * u, hy = -(b[1] - a[1]) * u, hl = Math.hypot(hx, hy) || 1, ux = hx / hl, uy = hy / hl
      const BX = b[0] * u, BY = -b[1] * u, hs = 6 * k
      labels += stroke(P(pts), ink, '', 1.4 * k)
      labels += `<path d="M${n1(BX - ux * hs - uy * hs * 0.6)} ${n1(BY - uy * hs + ux * hs * 0.6)}L${n1(BX)} ${n1(BY)}L${n1(BX - ux * hs + uy * hs * 0.6)} ${n1(BY - uy * hs - ux * hs * 0.6)}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(1.4 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`
      const [x, y, tx, ty] = g.at(0.5), nX = -ty * ms, nY = tx * ms
      const bx = texBox(e.momentum, fs * 0.85), ext = (Math.abs(nX) * bx.w / 2 + Math.abs(nY) * bx.h / 2) / u
      const L = off + 0.1 + ext
      labels += label(e.momentum, (x + nX * L) * u, -(y + nY * L) * u, fs * 0.85, ink)
    }
    if (e.label) {
      const [x, y, tx, ty] = g.at(0.5), nX = -ty * ls, nY = tx * ls
      const bx = texBox(e.label, fs), ext = (Math.abs(nX) * bx.w / 2 + Math.abs(nY) * bx.h / 2) / u
      const L = amp + 0.13 + ext + (e.momentum && ms === ls ? 0.5 : 0)
      labels += label(e.label, (x + nX * L) * u, -(y + nY * L) * u, fs, ink)
    }
    if (o.editor) labels += `<path class="pxfx-hit" data-e="${esc(e.id)}" d="${P(basePoints(g0), false)}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="${n1(16 * k)}" pointer-events="stroke"/>`
    out += wrap(s, lines, labels, basePoints(g0), false, e.id)
  }

  // Vertices
  const warn = new Set(o.warn || [])
  for (const v of m.vertices) {
    const s = vertexStep(m, v)
    if (!visible(s)) continue
    const kind = shownKind(v, deg), ink = v.color || o.ink || '#ffffff', X = v.x * u, Y = -v.y * u
    let mark = ''
    if (kind === 'dot') { mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(4.3 * k)}" fill="${esc(ink)}"/>`; grow(X, Y, 4.3 * k) }
    else if (kind === 'empty') { const r = KIND_R.empty * u; mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(r)}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(1.8 * k)}"/>`; grow(X, Y, r) }
    else if (kind === 'square') { mark += `<rect x="${n1(X - 4.6 * k)}" y="${n1(Y - 4.6 * k)}" width="${n1(9.2 * k)}" height="${n1(9.2 * k)}" fill="${esc(ink)}"/>`; grow(X, Y, 4.6 * k) }
    else if (kind === 'crossed') {
      const r = KIND_R.crossed * u, c = r * 0.7
      mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(r)}" fill="none" stroke="${esc(ink)}" stroke-width="${n1(1.8 * k)}"/><path d="M${n1(X - c)} ${n1(Y - c)}L${n1(X + c)} ${n1(Y + c)}M${n1(X - c)} ${n1(Y + c)}L${n1(X + c)} ${n1(Y - c)}" stroke="${esc(ink)}" stroke-width="${n1(1.6 * k)}"/>`
      grow(X, Y, r)
    } else if (kind === 'blob') {
      const r = KIND_R.blob * u
      mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(r)}" fill="${esc(ink)}" fill-opacity=".22" stroke="${esc(ink)}" stroke-width="${n1(2 * k)}"/>`
      grow(X, Y, r)
    } else if (o.editor) mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="3" fill="none" stroke="${esc(o.mark)}" stroke-width="1.2"/>`
    let labels = ''
    if (v.label) {
      const d = labelDirection(m, V, v)
      const bx = texBox(v.label, fs), ext = (Math.abs(d[0]) * bx.w / 2 + Math.abs(d[1]) * bx.h / 2) / u
      const L = (KIND_R[kind] || (kind === 'none' ? 0 : 0.07)) + 0.12 + ext
      labels += label(v.label, (v.x + d[0] * L) * u, -(v.y + d[1] * L) * u, fs, ink)
    }
    if (o.editor) {
      if (warn.has(v.id)) mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(13 * k)}" fill="none" stroke="${esc(o.warnColor)}" stroke-width="2" stroke-dasharray="4 3"><title>Fermion arrows don’t flow through this vertex</title></circle>`
      if (o.sel && o.sel.kind === 'v' && o.sel.id === v.id) mark += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(10 * k)}" fill="${esc(o.accent)}" fill-opacity=".22" stroke="${esc(o.accent)}" stroke-width="2"/>`
      labels += `<circle data-v="${esc(v.id)}" cx="${n1(X)}" cy="${n1(Y)}" r="${n1(12 * k)}" fill="#000" fill-opacity="0"/>`
    }
    out += wrap(s, mark, labels, null, true, v.id)
  }

  // The selected line's handle: its bend, or a loop's size and direction
  if (o.editor && o.sel && o.sel.kind === 'e') {
    const e = m.edges.find(x => x.id === o.sel.id), g = e && lineGeometry(V, e)
    if (g) {
      const [x, y] = g.at(0.5), loop = e.from === e.to
      out += `<circle data-h="${loop ? 'loop' : 'bend'}" cx="${n1(x * u)}" cy="${n1(-y * u)}" r="${n1(6.5 * k)}" fill="${esc(o.accent)}" stroke="#fff" stroke-width="2"><title>${loop ? 'Drag to turn and resize the loop' : 'Drag to bend the line'}</title></circle>`
    }
  }

  // Captions under the diagram, in room kept for them whenever there are any
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b)
  if (o.captions && capSteps.length && isFinite(box.x0)) {
    const cs = CAPTION * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8
    const one = (n, cls) => {
      const text = m.captions[n]
      if (o.labels === 'text') return `<text${cls} x="${n1(cx)}" y="${n1(y + cs)}" text-anchor="middle" font-size="${n1(cs)}" fill="${esc(o.ink || '#ffffff')}">${esc(text)}</text>`
      return `<foreignObject${cls} x="${n1(cx - w / 2)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n1(cs)}px;line-height:1.3;color:${esc(o.ink || '#ffffff')}">${esc(text)}</div></foreignObject>`
    }
    if (deck != null) out += capSteps.map(n => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join('')
    else {
      const cur = stepped ? o.step : maxStep(m)
      const shown = capSteps.filter(n => n <= cur).pop()
      if (shown != null) out += one(shown, '')
    }
    grow(cx, y + h / 2, w / 2, h / 2)
  }

  if (!isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 5 * u, y1: 2.5 * u })
  return { svg: out, box }
}

// ---------- The element

// The drawing's box in px, with a margin: the element's shape
export function feynmanBox(el) {
  const { box } = drawDiagram(feynmanModel(el), { captions: true })
  const pad = 0.18 * UNIT
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad }
}

// The element as an <svg> filling its box. opts: labels (as drawDiagram's),
// deck (an id: every part, for applyFeynmanStep), step (as at that diagram
// step), standalone (with a width and height, for an image)
export function feynmanSvg(el, opts = {}) {
  const m = feynmanModel(el)
  const b = feynmanBox(el)
  const { svg } = drawDiagram(m, { ink: m.color, labels: opts.labels || 'text', captions: true, deck: opts.deck, step: opts.step, dim: m.dimPast })
  const size = opts.standalone ? ` width="${n1(b.w)}" height="${n1(b.h)}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n1(b.x)} ${n1(b.y)} ${n1(b.w)} ${n1(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`
}

// ---------- TikZ-Feynman, with every vertex where it's drawn, so pdfLaTeX
// compiles it without TikZ-Feynman's LuaLaTeX layout

function tikzColor(c) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c || '')
  return m ? `color={rgb,255:red,${parseInt(m[1], 16)};green,${parseInt(m[2], 16)};blue,${parseInt(m[3], 16)}}` : null
}
function tikzDirection(d) {
  const a = (Math.atan2(d[1], d[0]) * 180 / Math.PI + 360) % 360
  return ['right', 'above right', 'above', 'above left', 'left', 'below left', 'below', 'below right'][Math.round(a / 45) % 8]
}
export function feynmanTikz(el) {
  const m = feynmanModel(el)
  if (!m.vertices.length) return '% An empty diagram'
  const V = vertexMap(m), deg = degrees(m), names = {}, used = new Set()
  m.vertices.forEach((v, i) => {
    let n = /^[A-Za-z][A-Za-z0-9]*$/.test(v.id) && v.id.length <= 12 ? v.id : 'v' + (i + 1)
    while (used.has(n)) n += 'x'
    used.add(n); names[v.id] = n
  })
  const L = ['% \\usepackage{tikz-feynman}', '\\begin{tikzpicture}', '  \\begin{feynman}']
  for (const v of m.vertices) {
    const kind = shownKind(v, deg)
    const style = { dot: 'dot', blob: 'blob', crossed: 'crossed dot', empty: 'empty dot', square: 'square dot' }[kind]
    const opts = style ? [style] : []
    let text = style ? ' {}' : ''
    if (v.label) {
      // An external leg's label is its vertex's text, as TikZ-Feynman's examples write it
      if (deg[v.id] <= 1 && !style && v.labelAt === 'auto') text = ` {\\(${v.label}\\)}`
      else opts.push(`label={${tikzDirection(labelDirection(m, V, v))}:\\(${v.label}\\)}`)
    }
    const col = tikzColor(v.color)
    if (col) opts.push(col)
    L.push(`    \\vertex${opts.length ? '[' + opts.join(', ') + ']' : ''} (${names[v.id]}) at (${n2(v.x)}, ${n2(v.y)})${text};`)
  }
  if (m.edges.length) {
    L.push('    \\diagram* {')
    L.push(m.edges.map(e => {
      const t = FEYNMAN_TYPES[e.particle], o = [t.tikz]
      if (e.from === e.to) o.push(`out=${e.loopAngle + 45}, in=${e.loopAngle - 45}, loop, min distance=${n2(e.loopSize)}cm`)
      else if (Math.abs(e.bend) >= 0.02) {
        const side = e.bend > 0 ? 'left' : 'right'
        if (Math.abs(Math.abs(e.bend) - 1) < 0.03) o.push(`half ${side}`)
        else o.push(`bend ${side}=${Math.round(2 * Math.atan(Math.abs(e.bend)) * 180 / Math.PI)}`)
      }
      if (e.label) o.push(`edge label${e.labelSide < 0 ? "'" : ''}=\\(${e.label}\\)`)
      if (e.momentum) o.push(`${e.momentumReverse ? 'reversed ' : ''}momentum${e.momentumSide > 0 ? '' : "'"}=\\(${e.momentum}\\)`)
      const col = tikzColor(e.color)
      if (col) o.push(col)
      return `      (${names[e.from]}) -- [${o.join(', ')}] (${names[e.to]})`
    }).join(',\n'))
    L.push('    };')
  }
  L.push('  \\end{feynman}', '\\end{tikzpicture}')
  return L.join('\n')
}

// ---------- Steps in a presented deck

// The slide steps at which a diagram changes: [[slide step, diagram step]]
export function feynmanSteps(el) {
  if (el?.type !== 'feynman') return []
  const m = feynmanModel(el), steps = new Set()
  for (const e of m.edges) if (e.step > 0) steps.add(e.step)
  for (const v of m.vertices) if (v.step > 0) steps.add(v.step)
  for (const n of Object.keys(m.captions)) if (+n > 0) steps.add(+n)
  return [...steps].sort((a, b) => a - b).map(s => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1000)
}
// The diagram's step when the slide is at slideStep
export function feynmanStepAt(el, slideStep) {
  let at = 0
  for (const [n, s] of feynmanSteps(el)) if (n <= slideStep) at = s
  return at
}
// A slide's hidden fragments for its diagrams' steps
export function feynmanStepMarkers(slide) {
  let html = ''
  for (const el of slide?.elements || []) {
    const id = String(el.id || '').replace(/[^A-Za-z0-9_-]/g, '')
    for (const [n, s] of feynmanSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`
  }
  return html
}
export function hasFeynman(presentation) {
  return (presentation?.slides || []).some(s => (s.elements || []).some(el => el.type === 'feynman'))
}

// Shows a deck-drawn diagram (drawDiagram's deck mode) at step cur: later
// parts hidden, earlier ones faded with dim, and with animate this step's
// lines drawn in. A page runs it from its source, so it uses nothing else.
export function applyFeynmanStep(root, cur, animate, dim) {
  var parts = root.querySelectorAll('.pxfx-part'), i, p, at, best = -1
  for (i = 0; i < parts.length; i++) {
    p = parts[i]
    at = +p.getAttribute('data-fx-at') || 0
    p.classList.toggle('pxfx-off', at > cur)
    p.classList.toggle('pxfx-past', !!dim && cur > 0 && at < cur)
    p.classList.remove('pxfx-new')
    if (animate && at === cur && at > 0) { void p.getBoundingClientRect(); p.classList.add('pxfx-new') }
  }
  var caps = root.querySelectorAll('[data-fx-cap]')
  for (i = 0; i < caps.length; i++) { at = +caps[i].getAttribute('data-fx-cap'); if (at <= cur && at > best) best = at }
  for (i = 0; i < caps.length; i++) caps[i].classList.toggle('pxfx-off', +caps[i].getAttribute('data-fx-cap') !== best)
}

export const FEYNMAN_CSS = [
  '.pxfx-part.pxfx-off,.pxfx-cap.pxfx-off{visibility:hidden}',
  '.pxfx-part{transition:opacity .35s ease}',
  '.pxfx-part.pxfx-past{opacity:.34}',
  '.pxfx-reveal{stroke-dasharray:1 1;stroke-dashoffset:0}',
  '.pxfx-new .pxfx-reveal{animation:pxfx-draw .75s ease-in-out both}',
  '.pxfx-new .pxfx-fade,.pxfx-new.pxfx-v{animation:pxfx-fade .35s .45s ease-out both}',
  '@keyframes pxfx-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}',
  '@keyframes pxfx-fade{from{opacity:0}to{opacity:1}}',
  '@media (prefers-reduced-motion:reduce){.pxfx-new .pxfx-reveal,.pxfx-new .pxfx-fade,.pxfx-new.pxfx-v{animation:none}.pxfx-part{transition:none}}',
].join('\n')

// In a deck with diagrams: tells each its slide's step, drawing in a step's
// lines when it's stepped to
let deckScript = null
export function feynmanDeckScript() {
  if (!deckScript) deckScript = `
    (function() {
      var apply = (${applyFeynmanStep.toString()});
      var css = document.createElement('style');
      css.textContent = ${JSON.stringify(FEYNMAN_CSS)};
      document.head.appendChild(css);
      var items = [];
      document.querySelectorAll('[data-fx]').forEach(function(el) {
        items.push({ el: el, id: el.getAttribute('data-fx'), dim: el.getAttribute('data-fx-dim') === '1', at: -1 });
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-fx-step]').forEach(function(m) {
          if (m.getAttribute('data-fx-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-fx-step-at') || 0);
        });
        return n;
      }
      function sync(ev) {
        var forward = !!ev && ev.type === 'fragmentshown';
        items.forEach(function(item) {
          var n = stepOf(item);
          if (n === item.at) return;
          apply(item.el, n, forward && n > item.at, item.dim);
          item.at = n;
        });
      }
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
      sync();
    })();
`
  return deckScript
}

// ---------- Templates (cm, y up)

function template(key, name, verts, edges, captions) {
  return { key, name, build() {
    return {
      vertices: verts.map(([id, x, y, label]) => ({ id, x, y, kind: 'auto', label: label || '', labelAt: 'auto', color: null, step: null })),
      edges: edges.map(([from, to, particle, opts], i) => ({ id: 'e' + (i + 1), from, to, particle, bend: 0, label: '', labelSide: 1, momentum: '', momentumSide: -1, momentumReverse: false, color: null, step: 0, ...(opts || {}) })),
      captions: { ...(captions || {}) },
    }
  } }
}
export const FEYNMAN_TEMPLATES = [
  template('ee', 'e⁺e⁻ → μ⁺μ⁻', [['i1', 0, 2, 'e^-'], ['i2', 0, 0, 'e^+'], ['a', 1.5, 1], ['b', 3.6, 1], ['f1', 5.1, 2, '\\mu^-'], ['f2', 5.1, 0, '\\mu^+']],
    [['i1', 'a', 'fermion', { step: 1 }], ['a', 'i2', 'fermion', { step: 1 }], ['a', 'b', 'photon', { label: '\\gamma', momentum: 'q', step: 2 }], ['b', 'f1', 'fermion', { step: 3 }], ['f2', 'b', 'fermion', { step: 3 }]],
    { 1: 'An electron and a positron annihilate', 2: 'into a virtual photon,', 3: 'which makes a muon pair.' }),
  template('ggf', 'Gluon fusion to a Higgs', [['g1', 0, 2.6, 'g'], ['g2', 0, -0.6, 'g'], ['a', 2, 2], ['b', 2, 0], ['c', 3.6, 1], ['h', 5.6, 1, 'H']],
    [['g1', 'a', 'gluon', { step: 1 }], ['g2', 'b', 'gluon', { step: 1 }], ['a', 'c', 'fermion', { label: 't', step: 2 }], ['c', 'b', 'fermion', { step: 2 }], ['b', 'a', 'fermion', { step: 2 }], ['c', 'h', 'scalar', { step: 3 }]],
    { 1: 'Two gluons, one from each proton,', 2: 'fuse through a loop of top quarks', 3: 'and make a Higgs boson.' }),
  template('compton', 'Compton scattering', [['i', 0, 0, 'e^-'], ['a', 1.6, 0], ['b', 3.4, 0], ['f', 5, 0, 'e^-'], ['g1', 0.2, 1.8, '\\gamma'], ['g2', 4.8, 1.8, '\\gamma']],
    [['i', 'a', 'fermion', { step: 1 }], ['g1', 'a', 'photon', { step: 1 }], ['a', 'b', 'fermion', { label: 'e^-', labelSide: -1, step: 2 }], ['b', 'f', 'fermion', { step: 3 }], ['b', 'g2', 'photon', { step: 3 }]],
    { 1: 'An electron absorbs a photon,', 2: 'travels as a virtual electron', 3: 'and emits a photon.' }),
  template('moller', 'Møller scattering (t-channel)', [['i1', 0, 2.6, 'e^-'], ['a', 2.4, 2.2], ['f1', 4.8, 2.6, 'e^-'], ['i2', 0, -0.4, 'e^-'], ['b', 2.4, 0], ['f2', 4.8, -0.4, 'e^-']],
    [['i1', 'a', 'fermion', { step: 1 }], ['i2', 'b', 'fermion', { step: 1 }], ['a', 'b', 'photon', { label: '\\gamma', momentum: 'q', step: 2 }], ['a', 'f1', 'fermion', { step: 3 }], ['b', 'f2', 'fermion', { step: 3 }]],
    { 1: 'Two electrons approach,', 2: 'exchange a virtual photon', 3: 'and scatter.' }),
  template('self', 'Electron self-energy', [['i', 0, 0, 'e^-'], ['a', 1.4, 0], ['b', 3.6, 0], ['f', 5, 0, 'e^-']],
    [['i', 'a', 'fermion', { step: 1 }], ['a', 'b', 'fermion', { step: 1 }], ['b', 'f', 'fermion', { step: 1 }], ['a', 'b', 'photon', { bend: 1, label: '\\gamma', step: 2 }]],
    { 1: 'An electron propagates,', 2: 'emitting and reabsorbing a virtual photon.' }),
  template('vacpol', 'Vacuum polarization', [['i', 0, 1], ['a', 1.6, 1], ['b', 3.4, 1], ['f', 5, 1]],
    [['i', 'a', 'photon', { label: '\\gamma', step: 1 }], ['a', 'b', 'fermion', { bend: 1, label: 'e^-', step: 2 }], ['b', 'a', 'fermion', { bend: 1, label: 'e^+', step: 2 }], ['b', 'f', 'photon', { label: '\\gamma', step: 3 }]],
    { 1: 'A photon', 2: 'briefly becomes an electron–positron pair', 3: 'and carries on.' }),
  template('vertex', 'QED vertex correction', [['g', 2.5, 3.1, '\\gamma'], ['v', 2.5, 2], ['a', 1.4, 0.9], ['b', 3.6, 0.9], ['i', 0.4, -0.3, 'e^-'], ['f', 4.6, -0.3, 'e^-']],
    [['i', 'a', 'fermion', { step: 1 }], ['a', 'v', 'fermion', { step: 1 }], ['v', 'b', 'fermion', { step: 1 }], ['b', 'f', 'fermion', { step: 1 }], ['g', 'v', 'photon', { step: 1 }], ['a', 'b', 'photon', { label: '\\gamma', labelSide: -1, step: 2 }]],
    { 1: 'An electron scatters off a photon.', 2: 'A virtual photon across the vertex is the one-loop correction behind g − 2.' }),
  template('beta', 'β⁻ decay', [['i', 0, 0, 'd'], ['v1', 2, 0.5], ['u', 4.8, 0, 'u'], ['v2', 3.2, 2.1], ['e', 4.8, 3, 'e^-'], ['n', 4.8, 1.4, '\\bar{\\nu}_e']],
    [['i', 'v1', 'fermion', { step: 1 }], ['v1', 'u', 'fermion', { step: 1 }], ['v1', 'v2', 'photon', { label: 'W^-', step: 2 }], ['v2', 'e', 'fermion', { step: 3 }], ['v2', 'n', 'antifermion', { step: 3 }]],
    { 1: 'A down quark turns into an up quark', 2: 'by emitting a virtual W⁻,', 3: 'which decays to an electron and an electron antineutrino.' }),
  { key: 'blank', name: 'Blank', build: () => ({ vertices: [], edges: [], captions: {} }) },
]

// A new diagram: the first template, in the slide's text color
export function defaultFeynman(dark = true) {
  return { ...FEYNMAN_TEMPLATES[0].build(), color: dark ? '#ffffff' : '#1a1a1a', stepStart: 1, dimPast: true }
}

// ---------- Editor helpers: changes to a diagram { vertices, edges, captions },
// made in place

export function newPartId(m, prefix) {
  const used = new Set([...m.vertices.map(v => v.id), ...m.edges.map(e => e.id)])
  let n = m.vertices.length + m.edges.length + 1, id
  do { id = prefix + n++ } while (used.has(id))
  return id
}
export const snapTo = v => Math.round(v / SNAP) * SNAP
const round2 = v => Math.round(v * 100) / 100

export function addVertex(m, x, y) {
  const v = { id: newPartId(m, 'v'), x: round2(x), y: round2(y), kind: 'auto', label: '', labelAt: 'auto', color: null, step: null }
  m.vertices.push(v)
  return v.id
}
export function addLine(m, from, to, particle) {
  const e = { id: newPartId(m, 'e'), from, to, particle, bend: 0, label: '', labelSide: 1, momentum: '', momentumSide: -1, momentumReverse: false, color: null, step: 0 }
  if (from === to) { e.loopAngle = 90; e.loopSize = 1.2 }
  m.edges.push(e)
  bendAwayFromTwins(m, e)
  return e
}
// A second line between the same two vertices bends away from those there
function bendAwayFromTwins(m, e) {
  if (e.from === e.to) return
  const taken = m.edges.filter(x => x !== e && ((x.from === e.from && x.to === e.to) || (x.from === e.to && x.to === e.from)))
    .map(x => Math.round((x.from === e.from ? x.bend || 0 : -(x.bend || 0)) * 10) / 10)
  if (!taken.length) return
  for (const b of [0, 0.8, -0.8, 1.4, -1.4]) if (!taken.includes(b)) { e.bend = b; return }
}
// Splits a line at a fraction t along it into two lines of its style; an
// arc's pieces stay on its circle. Returns the new vertex's id.
export function splitLine(m, edgeId, t) {
  const e = m.edges.find(x => x.id === edgeId)
  const g = e && lineGeometry(vertexMap(m), e)
  if (!g || e.from === e.to) return null
  const [x, y] = g.at(t)
  const vid = addVertex(m, x, y)
  const e2 = { ...e, id: newPartId(m, 'e'), from: vid }
  e.to = vid
  if (e.bend) {
    const phi = 4 * Math.atan(Math.abs(e.bend)), sg = Math.sign(e.bend)
    e.bend = sg * Math.tan(phi * t / 4)
    e2.bend = sg * Math.tan(phi * (1 - t) / 4)
  }
  // The label and momentum stay on the longer piece
  if (t < 0.5) { e.label = ''; e.momentum = '' } else { e2.label = ''; e2.momentum = '' }
  m.edges.splice(m.edges.indexOf(e) + 1, 0, e2)
  return vid
}
export function reverseLine(e) {
  [e.from, e.to] = [e.to, e.from]
  e.bend = -(e.bend || 0)
  e.labelSide = -(e.labelSide || 1)
  e.momentumSide = -(e.momentumSide || -1)
  e.momentumReverse = !e.momentumReverse
}
// A vertex dropped on another becomes it; returns the one kept, or null
export function mergeDropped(m, id) {
  const v = m.vertices.find(w => w.id === id)
  const target = v && m.vertices.find(w => w.id !== id && Math.hypot(w.x - v.x, w.y - v.y) < 0.13)
  if (!target) return null
  m.edges = m.edges.filter(e => !((e.from === id && e.to === target.id) || (e.to === id && e.from === target.id)))
  for (const e of m.edges) {
    if (e.from === id) e.from = target.id
    if (e.to === id) e.to = target.id
    if (e.from === e.to && e.loopAngle == null) { e.loopAngle = 90; e.loopSize = 1.2 }
  }
  m.vertices = m.vertices.filter(w => w.id !== id)
  if (!target.label && v.label) target.label = v.label
  return target.id
}
export function removeParts(m, sel) {
  if (sel.kind === 'e') m.edges = m.edges.filter(e => e.id !== sel.id)
  else {
    m.edges = m.edges.filter(e => e.from !== sel.id && e.to !== sel.id)
    m.vertices = m.vertices.filter(v => v.id !== sel.id)
  }
  // A vertex without lines is nothing to draw
  const used = new Set()
  for (const e of m.edges) { used.add(e.from); used.add(e.to) }
  m.vertices = m.vertices.filter(v => used.has(v.id))
}
// Mirrored left to right, which reverses time
export function mirrorDiagram(m) {
  const b = diagramBounds(m), cx = snapTo((b.x0 + b.x1) / 2)
  for (const v of m.vertices) {
    v.x = round2(2 * cx - v.x)
    if (v.labelAt === 'left') v.labelAt = 'right'
    else if (v.labelAt === 'right') v.labelAt = 'left'
  }
  for (const e of m.edges) {
    e.bend = -(e.bend || 0); e.labelSide = -(e.labelSide || 1); e.momentumSide = -(e.momentumSide || -1)
    if (e.loopAngle != null) e.loopAngle = (540 - e.loopAngle) % 360
  }
}
// A quarter turn anticlockwise, from an s-channel picture to a t-channel one
export function rotateDiagram(m) {
  const b = diagramBounds(m), cx = snapTo((b.x0 + b.x1) / 2), cy = snapTo((b.y0 + b.y1) / 2)
  const turn = { above: 'left', left: 'below', below: 'right', right: 'above' }
  for (const v of m.vertices) {
    const x = v.x - cx, y = v.y - cy
    v.x = round2(cx - y); v.y = round2(cy + x)
    if (turn[v.labelAt]) v.labelAt = turn[v.labelAt]
  }
  for (const e of m.edges) if (e.loopAngle != null) e.loopAngle = (e.loopAngle + 90) % 360
}
// Steps from left to right, by where the middle of each line is
export function stepsByTime(m) {
  const V = vertexMap(m)
  const keys = m.edges.map(e => { const g = lineGeometry(V, e); return g ? g.at(0.5)[0] : 0 })
  const starts = []
  for (const k of [...keys].sort((a, b) => a - b)) if (!starts.length || k - starts[starts.length - 1] > 0.9) starts.push(k)
  m.edges.forEach((e, i) => { let n = 0; starts.forEach((s, j) => { if (keys[i] >= s - 1e-9) n = j }); e.step = n + 1 })
  for (const v of m.vertices) v.step = null
}
