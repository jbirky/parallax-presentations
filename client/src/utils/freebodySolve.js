// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Free-body diagrams: the model (one body, the surface or ropes around it,
// and the forces on it), its geometry, and the solver that works out the
// forces left unknown. freebodyDiagram.js draws it.
//
// Lengths are in cm with y up, magnitudes in newtons, angles in degrees
// counterclockwise. A surface is a line at angle α with the body on the side
// of its normal (α + 90°): a floor at 0°, an incline at θ, a wall on the left
// at −90° and a ceiling at 180°. A force's direction is an angle from the
// horizontal or from the surface, so the normal force (90° from the surface)
// and friction (along it) follow an incline as it tilts.

export const G = 9.8

export const FORCE_KINDS = {
  weight: { name: 'Weight', key: 'w', label: 'F_g', chips: ['F_g', 'mg', 'W', 'F_G'] },
  normal: { name: 'Normal', key: 'n', label: 'F_N', chips: ['F_N', 'N', 'n', 'F_{\\perp}'] },
  friction: { name: 'Friction', key: 'f', label: 'f', chips: ['f', 'f_s', 'f_k', 'F_f'] },
  tension: { name: 'Tension', key: 't', label: 'T', chips: ['T', 'T_1', 'T_2', 'F_T'] },
  applied: { name: 'Applied', key: 'a', label: 'F_{\\text{app}}', chips: ['F', 'F_{\\text{app}}', 'P', 'F_{\\text{push}}'] },
  drag: { name: 'Drag', key: 'd', label: 'F_D', chips: ['F_D', 'F_{\\text{air}}', 'D', 'bv'] },
  spring: { name: 'Spring', key: 's', label: 'F_s', chips: ['F_s', 'kx', 'F_{\\text{sp}}'] },
  custom: { name: 'Other', key: 'o', label: 'F', chips: ['F', 'qE', 'F_E', 'F_B', 'F_b'] },
}
export const FORCE_KIND_ORDER = ['weight', 'normal', 'friction', 'tension', 'applied', 'drag', 'spring', 'custom']
export const FORCE_COLORS = ['#e5484d', '#3b82f6', '#16a34a', '#d97706', '#9333ea']

// What an element keeps of its diagram, for the editor to load and save
export const FREEBODY_FIELDS = ['body', 'surface', 'model', 'axes', 'motion', 'forceScale', 'values', 'net', 'forces', 'captions', 'color', 'stepStart', 'dimPast']

const ID = /^[A-Za-z0-9_-]{1,40}$/
const HEX = /^#[0-9a-f]{6}$/i
const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
const int = (v, lo, hi, d) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d)
const str = (v, max, d = '') => (typeof v === 'string' ? v.slice(0, max) : d)
const oneOf = (v, list, d) => (list.includes(v) ? v : d)
// A number as typed: kept as text, read when solving
const typed = (v, d = '') => (typeof v === 'number' && isFinite(v) ? String(v) : typeof v === 'string' ? v.slice(0, 20) : d)
export const readNumber = s => {
  if (s == null || String(s).trim() === '') return null
  const v = parseFloat(String(s).replace(',', '.'))
  return isFinite(v) ? v : null
}

// The element's diagram, with anything it can't draw left out or set to its default
export function freebodyModel(el) {
  const b = el?.body || {}, s = el?.surface || {}, n = el?.net || {}
  const forces = [], ids = new Set()
  for (const f of Array.isArray(el?.forces) ? el.forces.slice(0, 40) : []) {
    if (!f || !ID.test(f.id) || ids.has(f.id) || !FORCE_KINDS[f.kind]) continue
    ids.add(f.id)
    let magMode = oneOf(f.magMode, ['given', 'solve', 'mass', 'mu'], 'given')
    if ((magMode === 'mass' && f.kind !== 'weight') || (magMode === 'mu' && f.kind !== 'friction')) magMode = 'given'
    const cl = Array.isArray(f.compLabels) ? f.compLabels : []
    forces.push({
      id: f.id, kind: f.kind, label: str(f.label, 120, FORCE_KINDS[f.kind].label), magMode, mag: typed(f.mag), mu: typed(f.mu, '0.3'),
      dir: { from: oneOf(f.dir?.from, ['level', 'surface'], 'level'), deg: num(f.dir?.deg, -360, 360, 0) },
      push: !!f.push, comps: !!f.comps, compLabels: [str(cl[0], 120), str(cl[1], 120)],
      angle: oneOf(f.angle, ['none', 'level', 'vertical', 'surface', 'normal'], 'none'), angleLabel: str(f.angleLabel, 60, '\\theta'),
      rope: !!f.rope, color: HEX.test(f.color || '') ? f.color : null, step: int(f.step, 0, 1000, 0),
    })
  }
  const captions = {}
  for (const [k, v] of Object.entries(el?.captions && typeof el.captions === 'object' ? el.captions : {})) {
    const i = Number(k)
    if (Number.isInteger(i) && i >= 0 && i <= 1000 && typeof v === 'string' && v.trim()) captions[i] = v.slice(0, 300)
  }
  return {
    body: { shape: oneOf(b.shape, ['box', 'ball', 'dot'], 'box'), w: num(b.w, 0.3, 6, 1.6), h: num(b.h, 0.3, 6, 1), label: str(b.label, 60, 'm'), mass: typed(b.mass) },
    surface: { kind: oneOf(s.kind, ['none', 'floor', 'incline', 'wall', 'ceiling'], 'floor'), angle: num(s.angle, -60, 60, 30), angleLabel: str(s.angleLabel, 60, '\\theta'), show: s.show !== false },
    model: oneOf(el?.model, ['particle', 'extended'], 'particle'),
    axes: oneOf(el?.axes, ['none', 'level', 'surface'], 'level'),
    motion: oneOf(el?.motion, ['rest', 'slide', 'free'], 'rest'),
    forceScale: num(el?.forceScale, 0.01, 1e6, 10),
    values: !!el?.values,
    net: { show: n.show !== false, step: int(n.step, 0, 1000, 0), label: str(n.label, 60, 'F_{\\text{net}}') },
    forces,
    captions,
    color: HEX.test(el?.color || '') ? el.color : '#ffffff',
    stepStart: int(el?.stepStart, 1, 1000, 1),
    dimPast: !!el?.dimPast,
  }
}

// ---------- Vectors and angles

const D2R = Math.PI / 180
export const uvec = deg => [Math.cos(deg * D2R), Math.sin(deg * D2R)]
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
export const mul = (a, k) => [a[0] * k, a[1] * k]
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1]
export const len = a => Math.hypot(a[0], a[1])
export const angOf = v => Math.atan2(v[1], v[0]) / D2R
export const wrap180 = d => { d = ((d + 180) % 360 + 360) % 360 - 180; return d === -180 ? 180 : d }
export const angDiff = (a, b) => wrap180(b - a)

// ---------- The body and its surface

// The surface's angle
export function alpha(m) {
  const k = m.surface.kind
  return k === 'incline' ? m.surface.angle : k === 'wall' ? -90 : k === 'ceiling' ? 180 : 0
}
// A body against a surface is turned to it
export const bodyRot = m => (m.surface.kind === 'none' ? 0 : alpha(m))
// Half its width and height, before it's turned
export function half(m) {
  const b = m.body
  if (b.shape === 'dot') return [0.09, 0.09]
  if (b.shape === 'ball') return [b.h / 2, b.h / 2]
  return [b.w / 2, b.h / 2]
}
export const absDeg = (m, f) => (f.dir.from === 'surface' ? alpha(m) : 0) + f.dir.deg
export function axesFrame(m) {
  const a = m.axes === 'surface' ? alpha(m) : 0
  return [uvec(a), uvec(a + 90)]
}
// Where the body touches its surface
export function contact(m) {
  return mul(uvec(alpha(m) + 90), -half(m)[1])
}
// Where a ray from the centre in direction u leaves the body
export function boundary(m, u) {
  const [hw, hh] = half(m)
  if (m.body.shape !== 'box') return mul(u, hw)
  const r = -bodyRot(m) * D2R
  const lx = u[0] * Math.cos(r) - u[1] * Math.sin(r), ly = u[0] * Math.sin(r) + u[1] * Math.cos(r)
  const t = Math.min(Math.abs(lx) > 1e-9 ? hw / Math.abs(lx) : Infinity, Math.abs(ly) > 1e-9 ? hh / Math.abs(ly) : Infinity)
  return mul(u, t)
}

// ---------- The solver
//
// Each magnitude is a constant (given, or mg), an unknown (worked out), or
// μ times the normal force's, so ΣF = ma is two linear equations. At rest
// a = 0; sliding, a lies along the surface and is one more unknown; free,
// nothing is worked out and a = ΣF/m. Two unknowns are solved exactly; one
// takes the part of the equation along its own line, and what's left over is
// the net force.
//
// Notes are { text, labels }: text with {0}, {1} where the labels (TeX) go.

export function solveFreebody(m) {
  const fs = m.forces, mass = readNumber(m.body.mass)
  const out = { mag: {}, how: {}, notes: [], net: [0, 0], acc: null, status: 'ok', unknowns: 0 }
  const note = (text, ...labels) => { if (!out.notes.some(n => n.text === text && n.labels.join() === labels.join())) out.notes.push({ text, labels }) }
  const normal = fs.find(f => f.kind === 'normal')
  const vars = [], expr = {}
  for (const f of fs) {
    if (f.magMode === 'solve' && m.motion !== 'free') { expr[f.id] = { c: 0, k: { [vars.length]: 1 } }; vars.push({ id: f.id, label: f.label }) }
  }
  for (const f of fs) {
    if (expr[f.id] !== undefined || f.magMode === 'mu') continue
    if (f.magMode === 'mass') {
      expr[f.id] = mass != null ? { c: mass * G, k: {} } : null
      if (mass == null) note('{0} is mg, but the body has no mass yet.', f.label)
    } else if (f.magMode === 'given') {
      const v = readNumber(f.mag)
      expr[f.id] = v != null ? { c: v, k: {} } : null
    } else {
      expr[f.id] = null
      note('Nothing is worked out in free motion: give {0} a value.', f.label)
    }
  }
  for (const f of fs) {
    if (f.magMode !== 'mu') continue
    const mu = readNumber(f.mu), ne = normal ? expr[normal.id] : null
    if (!normal) note('{0} is μ times the normal force, but there’s no normal force.', f.label)
    expr[f.id] = mu != null && ne ? { c: mu * ne.c, k: Object.fromEntries(Object.entries(ne.k).map(([i, v]) => [i, mu * v])) } : null
  }
  const s = uvec(alpha(m))
  let accVar = -1
  if (m.motion === 'slide') {
    if (mass == null) note('Give the body a mass to work out how fast it slides.')
    else { accVar = vars.length; vars.push({ acc: true, label: 'a' }) }
  }
  // A x = b, a row for x and one for y
  const n = vars.length
  const A = [new Array(n).fill(0), new Array(n).fill(0)], b = [0, 0]
  for (const f of fs) {
    const e = expr[f.id]
    if (!e) continue
    const u = uvec(absDeg(m, f))
    for (let r = 0; r < 2; r++) {
      b[r] -= u[r] * e.c
      for (const [k, v] of Object.entries(e.k)) A[r][k] += u[r] * v
    }
  }
  if (accVar >= 0) for (let r = 0; r < 2; r++) A[r][accVar] -= mass * s[r]
  out.unknowns = n
  let x = null
  if (n === 0) x = []
  else if (n === 1) {
    const c = [A[0][0], A[1][0]], cc = dot(c, c)
    if (cc > 1e-12) x = [dot(b, c) / cc]
    else { out.status = 'unsolved'; note('{0} has nothing to balance: it doesn’t enter the sums.', vars[0].label) }
  } else if (n === 2) {
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    if (Math.abs(det) < 1e-9) {
      out.status = 'unsolved'
      note('{0} and {1} act along one line, so they can’t both be worked out.', vars[0].label, vars[1].label)
    } else x = [(b[0] * A[1][1] - A[0][1] * b[1]) / det, (A[0][0] * b[1] - b[0] * A[1][0]) / det]
  } else {
    out.status = 'unsolved'
    note(`${n} unknowns: only two can be worked out. Give the others values.`)
  }
  const value = e => {
    if (!e) return null
    let v = e.c
    for (const [k, c] of Object.entries(e.k)) { if (!x) return null; v += c * x[k] }
    return isFinite(v) ? v : null
  }
  for (const f of fs) {
    const v = value(expr[f.id])
    out.mag[f.id] = v
    // Where it came from: its magMode, or 'none' for a given force with no value
    out.how[f.id] = v == null && f.magMode === 'given' ? 'none' : f.magMode
    if (v == null && f.magMode === 'given') note('{0} has no value, so it isn’t counted.', f.label)
    if (v != null && v < -1e-9) {
      if (f.kind === 'normal') note('{0} comes out negative: the body would leave the surface.', f.label)
      else if (f.kind === 'tension') note('{0} comes out negative: a rope can only pull.', f.label)
      else if (f.kind === 'friction') note('{0} comes out negative, so friction points the other way. It’s drawn that way.', f.label)
      else if (f.magMode === 'solve') note('{0} comes out negative, so it points the other way. It’s drawn that way.', f.label)
    }
    if (v != null) out.net = add(out.net, mul(uvec(absDeg(m, f)), v))
  }
  if (Math.abs(out.net[0]) < 1e-9) out.net[0] = 0
  if (Math.abs(out.net[1]) < 1e-9) out.net[1] = 0
  if (m.motion === 'rest') {
    out.acc = [0, 0]
    if (len(out.net) > 1e-6 && n === 1 && x) note('With only {0} unknown, the forces can’t balance: what’s left is the net force.', vars[0].label)
  } else if (m.motion === 'slide') out.acc = accVar >= 0 && x ? mul(s, x[accVar]) : null
  else out.acc = mass ? mul(out.net, 1 / mass) : null
  return out
}

// Where the net force points, in words
export function netDirection(m, net) {
  const L = len(net)
  if (L < 1e-9) return ''
  const u = mul(net, 1 / L)
  if (m.surface.kind === 'incline' && Math.abs(dot(u, uvec(alpha(m)))) > 0.999) return net[1] < 0 ? 'down the slope' : 'up the slope'
  if (Math.abs(u[1]) < 1e-6) return u[0] > 0 ? 'to the right' : 'to the left'
  if (Math.abs(u[0]) < 1e-6) return u[1] > 0 ? 'up' : 'down'
  return `at ${Math.round(wrap180(angOf(net)))}° from the horizontal`
}
