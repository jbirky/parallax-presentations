// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A logic diagram's signals, step by step (logicParts.js has the model).
// Signals are 0, 1 or null (unknown). Wires joined at pins and junctions make
// nets; a net takes the value of the output driving it, or none. Gates settle
// in rounds until nothing changes, a controlling input deciding a gate by
// itself (a 0 into an AND is 0 whatever the rest), and each step starts from
// where the last settled, so latches and flip-flops remember. A D flip-flop
// takes D on its clock's rising edge; every one whose clock rose samples D
// before any changes, so a shift register shifts one place, and one clocked by
// another's output (a ripple counter) fires in a further round.

import { LOGIC_PARTS, pinsOf, endpoints, inputAt, clockAt } from './logicParts'

export function gateOut(kind, ins) {
  const K = LOGIC_PARTS[kind]
  let v
  if (K.gate === 'and') v = ins.some(x => x === 0) ? 0 : ins.every(x => x === 1) ? 1 : null
  else if (K.gate === 'or') v = ins.some(x => x === 1) ? 1 : ins.every(x => x === 0) ? 0 : null
  else if (K.gate === 'xor') v = ins.some(x => x == null) ? null : ins.reduce((a, b) => a ^ b, 0)
  else v = ins[0] ?? null
  return v == null ? null : K.inv ? 1 - v : v
}

// Each part, wire and junction there from the start
export const everythingAtOnce = m => ({ ...m, parts: m.parts.map(p => ({ ...p, step: 0 })), wires: m.wires.map(w => ({ ...w, step: 0 })), nodes: m.nodes.map(n => ({ ...n, step: 0 })) })

// The states at steps 0..upto: { at (each endpoint's net value), wire (each
// wire's), floating (input pins driven by nothing), conflicts (nets two
// outputs disagree on), oscillates }. override: input values by part id.
export function simulateLogic(m, upto, override = null) {
  const states = [], outVal = {}, ffQ = {}, lastClk = {}
  for (const p of m.parts) if (p.kind === 'dff') ffQ[p.id] = 0
  for (let s = 0; s <= upto; s++) {
    const E = endpoints(m, s)
    const parts = m.parts.filter(p => (p.step || 0) <= s)
    const wires = m.wires.filter(w => (w.step || 0) <= s && E.has(w.from) && E.has(w.to))
    const parent = {}
    for (const id of E.keys()) parent[id] = id
    const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] } return a }
    for (const w of wires) { const a = find(w.from), b = find(w.to); if (a !== b) parent[a] = b }
    const drivers = {}
    for (const [id, e] of E) if (e.io === 'out') (drivers[find(id)] = drivers[find(id)] || []).push(id)
    const conflicts = new Set()
    const netVal = net => {
      const ds = drivers[net]
      if (!ds) return null
      const vals = [...new Set(ds.map(d => outVal[d] ?? null))]
      if (vals.length > 1) { if (!vals.includes(null)) conflicts.add(net); return null }
      return vals[0]
    }
    const pinIn = id => netVal(find(id))
    let oscillates = false
    const relax = (again = true) => {
      for (let iter = 0; iter < 200; iter++) {
        let changed = false
        const set = (id, v) => { if (outVal[id] !== v) { outVal[id] = v; changed = true } }
        for (const p of parts) {
          if (p.kind === 'input') set(`${p.id}.out`, override && override.has(p.id) ? override.get(p.id) : inputAt(p, s))
          else if (p.kind === 'clock') set(`${p.id}.out`, clockAt(p, s))
          else if (p.kind === 'dff') { set(`${p.id}.q`, ffQ[p.id]); set(`${p.id}.qn`, ffQ[p.id] == null ? null : 1 - ffQ[p.id]) }
          else if (LOGIC_PARTS[p.kind].gate) set(`${p.id}.out`, gateOut(p.kind, pinsOf(p).filter(x => x.io === 'in').map(x => pinIn(`${p.id}.${x.name}`))))
        }
        if (!changed) return
      }
      // It never settles (a ring of inverters): its gates are unknown
      oscillates = true
      if (!again) return
      for (const p of parts) if (LOGIC_PARTS[p.kind].gate) outVal[`${p.id}.out`] = null
      relax(false)
    }
    relax()
    for (let round = 0; round < 10; round++) {
      const fired = []
      for (const p of parts) {
        if (p.kind !== 'dff') continue
        const clk = pinIn(`${p.id}.clk`)
        if (s > 0 && lastClk[p.id] === 0 && clk === 1) fired.push([p.id, pinIn(`${p.id}.d`)])
        lastClk[p.id] = clk
      }
      if (!fired.length) break
      for (const [id, d] of fired) ffQ[id] = d
      relax()
    }
    const at = {}, wire = {}
    for (const id of E.keys()) at[id] = netVal(find(id))
    for (const w of wires) wire[w.id] = netVal(find(w.from))
    const floating = parts.flatMap(p => pinsOf(p).filter(x => x.io === 'in' && !drivers[find(`${p.id}.${x.name}`)]).map(x => `${p.id}.${x.name}`))
    states.push({ at, wire, floating, conflicts: conflicts.size, oscillates })
  }
  return states
}

export const inputsOf = m => m.parts.filter(p => p.kind === 'input').sort((a, b) => b.y - a.y || a.x - b.x)
export const outputsOf = m => m.parts.filter(p => p.kind === 'output').sort((a, b) => b.y - a.y || a.x - b.x)

// Nets of the whole diagram, as a find function
function netsOf(m) {
  const E = endpoints(m), parent = {}
  for (const id of E.keys()) parent[id] = id
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] } return a }
  for (const w of m.wires) if (E.has(w.from) && E.has(w.to)) { const a = find(w.from), b = find(w.to); if (a !== b) parent[a] = b }
  return find
}
// A gate's output reaching one of its own inputs, through other gates
export function hasFeedback(m) {
  const find = netsOf(m)
  const gates = m.parts.filter(p => LOGIC_PARTS[p.kind].gate)
  const feeds = new Map(gates.map(g => [g.id, gates.filter(h => pinsOf(h).some(x => x.io === 'in' && find(`${h.id}.${x.name}`) === find(`${g.id}.out`))).map(h => h.id)]))
  const state = {}
  const visit = id => {
    if (state[id] === 1) return true
    if (state[id] === 2) return false
    state[id] = 1
    for (const n of feeds.get(id) || []) if (visit(n)) return true
    state[id] = 2
    return false
  }
  return gates.some(g => visit(g.id))
}
// Every input tried, for a diagram with no memory: { ins, outs, rows } or { why }
export function truthTable(m) {
  if (m.parts.some(p => p.kind === 'dff' || p.kind === 'clock')) return { why: 'It has a flip-flop or a clock, so it remembers: no truth table.' }
  const ins = inputsOf(m), outs = outputsOf(m)
  if (!ins.length || !outs.length) return { why: 'Add inputs and outputs for a truth table.' }
  if (ins.length > 6) return { why: 'More than six inputs: too many rows for a truth table.' }
  if (hasFeedback(m)) return { why: 'It has feedback, so it can remember: no truth table.' }
  const flat = everythingAtOnce(m), rows = []
  for (let k = 0; k < 2 ** ins.length; k++) {
    const vals = ins.map((p, i) => (k >> (ins.length - 1 - i)) & 1)
    const st = simulateLogic(flat, 0, new Map(ins.map((p, i) => [p.id, vals[i]])))[0]
    rows.push([...vals, ...outs.map(o => st.at[`${o.id}.in`])])
  }
  return { ins, outs, rows }
}
// The row of a truth table a state's inputs are on, or -1
export function rowOf(tt, state) {
  if (!tt.rows || !state) return -1
  return tt.rows.findIndex(r => tt.ins.every((p, i) => state.at[`${p.id}.out`] === r[i]))
}
// How deep in the logic each net's driver is, for the order a change runs through
export function logicDepths(m) {
  const find = netsOf(m), level = {}
  for (const p of m.parts) for (const x of pinsOf(p)) if (x.io === 'out' && !LOGIC_PARTS[p.kind].gate) level[find(`${p.id}.${x.name}`)] = 0
  const gates = m.parts.filter(p => LOGIC_PARTS[p.kind].gate)
  for (let i = 0; i < gates.length + 2; i++) {
    for (const g of gates) {
      const ins = pinsOf(g).filter(x => x.io === 'in').map(x => level[find(`${g.id}.${x.name}`)] ?? 0)
      level[find(`${g.id}.out`)] = Math.min(12, 1 + Math.max(0, ...ins))
    }
  }
  return id => level[find(id)] ?? 0
}
