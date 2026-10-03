// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Circuit diagram elements (circuitDiagram.js): { type: 'circuit', vertices,
// edges, captions, color, symbols, flow, readings, stepStart, dimPast }.
// Vertices are points in TikZ centimetres, y up, each maybe grounded; edges
// are parts between two of them: a wire or a two-terminal component. A part
// runs from `from` to `to`, which for a source is from its negative terminal
// to its positive one, and for a diode from anode to cathode. Here: the
// parts, their values, and the model as checked from what's saved.

export const CIRCUIT_PARTS = {
  wire: { name: 'Wire', key: 'w', kind: 'short' },
  resistor: { name: 'Resistor', key: 'r', tikz: 'R', kind: 'R', unit: 'Ω', dflt: 100, chips: ['R', 'R_1', 'R_2'] },
  capacitor: { name: 'Capacitor', key: 'c', tikz: 'C', kind: 'open', unit: 'F', dflt: 1e-6, chips: ['C', 'C_1'] },
  inductor: { name: 'Inductor', key: 'l', tikz: 'L', kind: 'short', unit: 'H', dflt: 1e-3, chips: ['L', 'L_1'] },
  battery: { name: 'Battery', key: 'b', tikz: 'battery1', kind: 'V', unit: 'V', dflt: 9, polar: true, chips: ['\\mathcal{E}', 'V_0'] },
  vsource: { name: 'DC source', key: 'e', tikz: 'V', kind: 'V', unit: 'V', dflt: 5, polar: true, chips: ['V_s', 'V_1'] },
  acsource: { name: 'AC source', tikz: 'sV', kind: 'V0', unit: 'V', dflt: 10, polar: true, chips: ['V_0', 'v(t)'] },
  isource: { name: 'Current source', key: 'i', tikz: 'I', kind: 'I', unit: 'A', dflt: 0.01, polar: true, chips: ['I_s', 'I_0'] },
  switch: { name: 'Switch', key: 's', tikz: 'nos', kind: 'switch', chips: ['S', 'S_1'] },
  diode: { name: 'Diode', key: 'd', tikz: 'D', kind: 'diode', polar: true, chips: ['D', 'D_1'] },
  lamp: { name: 'Lamp', key: 'x', tikz: 'lamp', kind: 'R', unit: 'Ω', dflt: 12, chips: ['B', 'B_1'] },
  ammeter: { name: 'Ammeter', key: 'a', tikz: 'ammeter', kind: 'short', meter: 'A', chips: ['A'] },
  voltmeter: { name: 'Voltmeter', key: 'm', tikz: 'voltmeter', kind: 'open', meter: 'V', chips: ['V'] },
}
export const CIRCUIT_TOOLS = ['wire', 'resistor', 'capacitor', 'inductor', 'battery', 'vsource', 'acsource', 'isource', 'switch', 'diode', 'lamp', 'ammeter', 'voltmeter', 'ground']
export const CIRCUIT_VERTEX_KINDS = [['auto', 'Auto'], ['none', 'None'], ['dot', 'Dot'], ['terminal', 'Terminal']]
// The rotation of a ground symbol, which points down unturned
export const GROUND_DIRS = { down: 0, left: 90, up: 180, right: -90 }
export const CIRCUIT_FIELDS = ['vertices', 'edges', 'captions', 'color', 'symbols', 'flow', 'readings', 'stepStart', 'dimPast']

// ---------- Values, typed with SI prefixes: 4.7k, 100n, 2.2µ

const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 }
export function parseValue(s) {
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*([pnuµμmkMG])?/.exec(String(s ?? ''))
  return m ? parseFloat(m[1]) * (m[2] ? PREFIX[m[2]] : 1) : null
}
export function formatSI(v, unit) {
  if (v == null || !isFinite(v)) return ''
  const a = Math.abs(v)
  if (a < 1e-13) return `0 ${unit}`
  const steps = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']]
  let pick = steps[steps.length - 1]
  for (const s of steps) if (a >= s[0] * 0.9995) { pick = s; break }
  const num = v / pick[0]
  const str = Math.abs(num) >= 99.95 ? String(Math.round(num)) : String(Number(num.toPrecision(3)))
  return `${str} ${pick[1]}${unit}`
}
// What a part is solved with: its value, or its kind's usual one
export const valueOf = e => { const v = parseValue(e.value); return v == null ? (CIRCUIT_PARTS[e.part].dflt ?? 0) : v }
// A switch's state at a step, after any flip
export const closedAt = (e, step) => !!e.closed !== (e.flipAt != null && step >= e.flipAt)
// Whether a part joins its ends at a step: wires, inductors, ammeters, a closed switch
export const isShort = (e, step) => CIRCUIT_PARTS[e.part].kind === 'short' || (e.part === 'switch' && closedAt(e, step))

// ---------- The circuit from an element, which can come from anyone: every
// field is checked, and parts between vertices that aren't there are dropped

const ID = /^[A-Za-z0-9_-]{1,40}$/
const COLOR = /^#[0-9a-f]{6}$/i
const LABEL_AT = ['above', 'below', 'left', 'right']
const num = (v, lo, hi, dflt) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt)
const int = (v, lo, hi, dflt) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt)
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

export function circuitModel(el) {
  const vertices = [], edges = [], ids = new Set(), edgeIds = new Set()
  for (const v of Array.isArray(el?.vertices) ? el.vertices.slice(0, 500) : []) {
    if (!v || !ID.test(v.id) || ids.has(v.id)) continue
    ids.add(v.id)
    vertices.push({
      id: v.id, x: num(v.x, -1000, 1000, 0), y: num(v.y, -1000, 1000, 0),
      kind: CIRCUIT_VERTEX_KINDS.some(([k]) => k === v.kind) ? v.kind : 'auto',
      ground: GROUND_DIRS[v.ground] !== undefined ? v.ground : null,
      label: str(v.label, 200), labelAt: LABEL_AT.includes(v.labelAt) ? v.labelAt : 'auto',
      step: v.step == null ? null : int(v.step, 0, 1000, null),
    })
  }
  for (const e of Array.isArray(el?.edges) ? el.edges.slice(0, 1000) : []) {
    if (!e || !ID.test(e.id) || edgeIds.has(e.id) || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue
    edgeIds.add(e.id)
    edges.push({
      id: e.id, from: e.from, to: e.to,
      part: CIRCUIT_PARTS[e.part] ? e.part : 'wire',
      label: str(e.label, 200), value: str(e.value, 40), flip: !!e.flip,
      current: str(e.current, 200), voltage: str(e.voltage, 200),
      closed: !!e.closed, flipAt: e.flipAt == null ? null : int(e.flipAt, 1, 1000, null),
      step: int(e.step, 0, 1000, 0),
    })
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
    symbols: el?.symbols === 'iec' ? 'iec' : 'us',
    flow: el?.flow !== false,
    readings: el?.readings !== false,
    stepStart: int(el?.stepStart, 1, 1000, 1),
    // Off unless chosen: the current runs through what came before too
    dimPast: !!el?.dimPast,
  }
}
