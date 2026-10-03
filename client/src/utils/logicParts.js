// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Logic diagram elements (logicDiagram.js): { type: 'logic', parts, nodes,
// wires, captions, color, symbols, values, table, stepStart }. A part (a
// gate, an input, an output, a clock or a D flip-flop) sits at a point in
// TikZ centimetres, y up, and has pins at fixed places around it; a wire
// runs between two pins ('g1.in2', 'A.out') or junctions (nodes), across,
// down and across, with its upright at mx. Gates face right. Here: the
// parts, their pins, and the model as checked from what's saved.

export const LOGIC_PARTS = {
  input: { name: 'Input', key: 'i', tikz: 'ocirc' },
  output: { name: 'Output', key: 'o', tikz: 'ocirc' },
  clock: { name: 'Clock', key: 'k', tikz: 'ocirc' },
  and: { name: 'AND', key: 'a', gate: 'and', multi: true, iec: '&', tikz: 'and port' },
  or: { name: 'OR', key: 'r', gate: 'or', multi: true, iec: '≥1', tikz: 'or port' },
  not: { name: 'NOT', key: 'n', gate: 'buf', inv: true, iec: '1', tikz: 'not port' },
  nand: { name: 'NAND', gate: 'and', inv: true, multi: true, iec: '&', tikz: 'nand port' },
  nor: { name: 'NOR', gate: 'or', inv: true, multi: true, iec: '≥1', tikz: 'nor port' },
  xor: { name: 'XOR', key: 'x', gate: 'xor', multi: true, iec: '=1', tikz: 'xor port' },
  xnor: { name: 'XNOR', gate: 'xor', inv: true, multi: true, iec: '=1', tikz: 'xnor port' },
  buf: { name: 'Buffer', gate: 'buf', iec: '1', tikz: 'buffer port' },
  dff: { name: 'D flip-flop', key: 'f', tikz: 'flipflop D' },
}
export const LOGIC_TOOLS = ['wire', 'input', 'output', 'clock', 'and', 'or', 'not', 'nand', 'nor', 'xor', 'xnor', 'buf', 'dff']
export const LOGIC_GATES = Object.keys(LOGIC_PARTS).filter(k => LOGIC_PARTS[k].gate)
export const LOGIC_FIELDS = ['parts', 'nodes', 'wires', 'captions', 'color', 'symbols', 'values', 'table', 'stepStart']
export const LOGIC_SNAP = 0.25

// A part's pins, where wires join it: { name, x, y, io: 'in' | 'out' }
export function pinsOf(p) {
  const K = LOGIC_PARTS[p.kind]
  if (K.gate) {
    const n = K.multi ? Math.min(4, Math.max(2, p.inputs || 2)) : 1
    const ins = Array.from({ length: n }, (_, i) => ({ name: 'in' + (i + 1), x: p.x - 0.75, y: p.y + ((n - 1) / 2 - i) * 0.5, io: 'in' }))
    return [...ins, { name: 'out', x: p.x + 0.75, y: p.y, io: 'out' }]
  }
  if (p.kind === 'input' || p.kind === 'clock') return [{ name: 'out', x: p.x + 0.75, y: p.y, io: 'out' }]
  if (p.kind === 'output') return [{ name: 'in', x: p.x - 0.75, y: p.y, io: 'in' }]
  return [
    { name: 'd', x: p.x - 1, y: p.y + 0.5, io: 'in' }, { name: 'clk', x: p.x - 1, y: p.y - 0.5, io: 'in' },
    { name: 'q', x: p.x + 1, y: p.y + 0.5, io: 'out' }, { name: 'qn', x: p.x + 1, y: p.y - 0.5, io: 'out' },
  ]
}
// Every place a wire can end, by id: pins ('part.pin') and junctions, those
// there by a step (or all)
export function endpoints(m, step = null) {
  const E = new Map()
  for (const p of m.parts) if (step == null || (p.step || 0) <= step) for (const pin of pinsOf(p)) E.set(`${p.id}.${pin.name}`, { ...pin, part: p })
  for (const n of m.nodes) if (step == null || (n.step || 0) <= step) E.set(n.id, { x: n.x, y: n.y, node: n })
  return E
}
export const snapTo = v => Math.round(v / LOGIC_SNAP) * LOGIC_SNAP
// A wire's corners: across, down at mx (by default halfway), and across
export function route(P, Q, mx) {
  if (Math.abs(P.y - Q.y) < 1e-9) return [P, Q]
  const x = mx ?? snapTo((P.x + Q.x) / 2)
  return [P, { x, y: P.y }, { x, y: Q.y }, Q].filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 1e-9)
}
// An input at a step: its start, flipped at each step listed; a clock: high at
// start, then low, and so on until end
export const inputAt = (p, s) => { let v = p.value ? 1 : 0; for (const f of p.flips || []) if (f <= s) v = 1 - v; return v }
export const clockAt = (p, s) => { const a = p.start ?? 1, b = p.end ?? 8; return s >= a && s <= b ? ((s - a) % 2 === 0 ? 1 : 0) : 0 }

// ---------- The diagram from an element, which can come from anyone: every
// field is checked, and wires to pins or junctions that aren't there are dropped

const ID = /^[A-Za-z0-9_-]{1,40}$/
const COLOR = /^#[0-9a-f]{6}$/i
const num = (v, lo, hi, dflt) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt)
const int = (v, lo, hi, dflt) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt)
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

export function logicModel(el) {
  const parts = [], nodes = [], wires = [], ids = new Set()
  for (const p of Array.isArray(el?.parts) ? el.parts.slice(0, 300) : []) {
    if (!p || !ID.test(p.id) || ids.has(p.id) || !LOGIC_PARTS[p.kind]) continue
    ids.add(p.id)
    const K = LOGIC_PARTS[p.kind]
    const out = { id: p.id, kind: p.kind, x: num(p.x, -1000, 1000, 0), y: num(p.y, -1000, 1000, 0), label: str(p.label, 200), step: int(p.step, 0, 1000, 0) }
    if (K.multi) out.inputs = int(p.inputs, 2, 4, 2)
    if (p.kind === 'input') {
      out.value = p.value ? 1 : 0
      out.flips = [...new Set((Array.isArray(p.flips) ? p.flips : []).filter(f => Number.isInteger(f) && f >= 1 && f <= 1000))].sort((a, b) => a - b).slice(0, 200)
    }
    if (p.kind === 'clock') { out.start = int(p.start, 0, 1000, 1); out.end = Math.max(out.start, int(p.end, 0, 1000, 8)) }
    parts.push(out)
  }
  for (const n of Array.isArray(el?.nodes) ? el.nodes.slice(0, 500) : []) {
    if (!n || !ID.test(n.id) || ids.has(n.id)) continue
    ids.add(n.id)
    nodes.push({ id: n.id, x: num(n.x, -1000, 1000, 0), y: num(n.y, -1000, 1000, 0), step: int(n.step, 0, 1000, 0) })
  }
  const E = endpoints({ parts, nodes })
  const wireIds = new Set()
  for (const w of Array.isArray(el?.wires) ? el.wires.slice(0, 1000) : []) {
    if (!w || !ID.test(w.id) || wireIds.has(w.id) || !E.has(w.from) || !E.has(w.to) || w.from === w.to) continue
    wireIds.add(w.id)
    wires.push({ id: w.id, from: w.from, to: w.to, mx: typeof w.mx === 'number' && isFinite(w.mx) ? num(w.mx, -1000, 1000, 0) : null, step: int(w.step, 0, 1000, 0) })
  }
  const captions = {}
  if (el?.captions && typeof el.captions === 'object') {
    for (const [k, v] of Object.entries(el.captions)) {
      const n = Number(k)
      if (Number.isInteger(n) && n >= 0 && n <= 1000 && typeof v === 'string' && v.trim()) captions[n] = v.slice(0, 500)
    }
  }
  return {
    parts, nodes, wires, captions,
    color: COLOR.test(el?.color || '') ? el.color : '#ffffff',
    symbols: el?.symbols === 'iec' ? 'iec' : 'us',
    values: el?.values !== false,
    table: !!el?.table,
    stepStart: int(el?.stepStart, 1, 1000, 1),
  }
}
