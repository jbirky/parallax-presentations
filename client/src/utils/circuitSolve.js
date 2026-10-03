// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A circuit's DC steady state at a step (circuitParts.js has the model):
// the voltage at each vertex and the current through each part, from the
// parts drawn by then, with each switch as it is then.
//
// Wires, closed switches, ammeters and inductors join the vertices at their
// ends into one node, and every ground is one node. Modified nodal analysis
// then solves the rest: resistors and lamps, voltage and current sources,
// and diodes, which conduct with a 0.7 V drop or not at all, settled by
// trying until each agrees with its own voltage and current. Capacitors are
// open and AC sources 0 V, as in the steady state. The current in each wire
// comes after, from Kirchhoff's current law across the wires' spanning tree.
//
// Returns { status, V, I, P, maxI }: status 'ok', 'still' (nothing flows),
// 'empty', 'nosource', 'shorted' (with the source's id) or 'conflict'; V by
// vertex id in volts; I by part id in amps, from `from` to `to`; P, the power
// in each resistor and lamp, in watts.

import { CIRCUIT_PARTS, valueOf, closedAt, isShort } from './circuitParts'

const VF = 0.7      // a diode's drop when on
const GON = 1e3     // and its conductance then
const LEAK = 1e-12  // from every node to ground, so a part left floating can still be solved

function gauss(A, b) {
  const n = b.length
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    if (Math.abs(A[p][c]) < 1e-14) return null
    if (p !== c) { [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]] }
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c]
      if (!f) continue
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]
      b[r] -= f * b[c]
    }
  }
  const x = new Float64Array(n)
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]
    x[r] = s / A[r][r]
  }
  return x
}

export function solveCircuit(m, step = Infinity) {
  const edges = m.edges.filter(e => (e.step || 0) <= step && e.from !== e.to && CIRCUIT_PARTS[e.part])
  if (!edges.length) return { status: 'empty' }
  const kind = e => CIRCUIT_PARTS[e.part].kind
  const ids = new Set()
  for (const e of edges) { ids.add(e.from); ids.add(e.to) }
  const grounded = m.vertices.filter(v => v.ground && ids.has(v.id)).map(v => v.id)
  const GND = ':ground' // no vertex id has a colon
  const parent = { [GND]: GND }
  for (const id of ids) parent[id] = id
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] } return a }
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b }
  const shorts = []
  for (const e of edges) if (isShort(e, step)) { unite(e.from, e.to); shorts.push([e.from, e.to, e.id]) }
  for (const g of grounded) { unite(g, GND); shorts.push([g, GND, null]) }

  const sources = edges.filter(e => ['V', 'V0', 'I'].includes(kind(e)))
  if (!sources.length) return { status: 'nosource' }
  const vsrc = edges.filter(e => kind(e) === 'V' || kind(e) === 'V0')
  for (const e of vsrc) if (find(e.from) === find(e.to)) return { status: 'shorted', id: e.id }

  // 0 V: ground, or the first source's negative terminal
  const ref = grounded.length ? find(GND) : find(sources[0].from)
  const nodeOf = {}
  let N = 0
  for (const id of [...ids, GND]) { const r = find(id); if (r !== ref && nodeOf[r] == null) nodeOf[r] = N++ }
  const ix = id => { const r = find(id); return r === ref ? -1 : nodeOf[r] }
  const S = N + vsrc.length
  const diodes = edges.filter(e => kind(e) === 'diode')
  const on = new Map(diodes.map(d => [d.id, true]))
  let x = null
  const volt = id => { const i = ix(id); return i < 0 ? 0 : x[i] }

  for (let iter = 0; iter < 30; iter++) {
    const A = Array.from({ length: S }, () => new Float64Array(S)), z = new Float64Array(S)
    const conductance = (a, b, g) => {
      if (a >= 0) A[a][a] += g
      if (b >= 0) A[b][b] += g
      if (a >= 0 && b >= 0) { A[a][b] -= g; A[b][a] -= g }
    }
    for (let i = 0; i < N; i++) A[i][i] += LEAK
    for (const e of edges) {
      const a = ix(e.from), b = ix(e.to)
      if (kind(e) === 'R') conductance(a, b, 1 / Math.max(1e-6, valueOf(e)))
      else if (kind(e) === 'diode' && on.get(e.id)) {
        conductance(a, b, GON)
        if (a >= 0) z[a] += GON * VF
        if (b >= 0) z[b] -= GON * VF
      } else if (kind(e) === 'I') {
        const I = valueOf(e)
        if (a >= 0) z[a] -= I
        if (b >= 0) z[b] += I
      }
    }
    vsrc.forEach((e, k) => {
      const p = ix(e.to), n = ix(e.from), r = N + k
      if (p >= 0) { A[p][r] += 1; A[r][p] += 1 }
      if (n >= 0) { A[n][r] -= 1; A[r][n] -= 1 }
      z[r] = kind(e) === 'V0' ? 0 : valueOf(e)
    })
    x = gauss(A, z)
    if (!x) return { status: 'conflict' }
    let changed = false
    for (const d of diodes) {
      const dv = volt(d.from) - volt(d.to)
      if (on.get(d.id) && GON * (dv - VF) < -1e-9) { on.set(d.id, false); changed = true }
      else if (!on.get(d.id) && dv > VF + 1e-6) { on.set(d.id, true); changed = true }
    }
    if (!changed) break
  }

  const V = {}, I = {}, P = {}, inj = {}
  for (const id of ids) V[id] = volt(id)
  for (const e of edges) {
    if (isShort(e, step)) continue
    const dv = volt(e.from) - volt(e.to)
    let c = 0
    if (kind(e) === 'R') { const R = Math.max(1e-6, valueOf(e)); c = dv / R; P[e.id] = c * c * R }
    else if (kind(e) === 'diode') c = on.get(e.id) ? GON * (dv - VF) : 0
    else if (kind(e) === 'I') c = valueOf(e)
    else if (kind(e) === 'V' || kind(e) === 'V0') c = -x[N + vsrc.indexOf(e)]
    I[e.id] = c
    // Through the part from `from` to `to`: out of one end, into the other
    inj[e.from] = (inj[e.from] || 0) - c
    inj[e.to] = (inj[e.to] || 0) + c
  }

  // The current in each wire (and closed switch, ammeter, inductor): across
  // the wires' spanning tree, an edge carries what the vertices beyond it
  // take in from the parts. A wire that closes a loop of wires carries none.
  const adj = {}
  for (const [a, b, id] of shorts) {
    (adj[a] = adj[a] || []).push([b, id, 1])
    ;(adj[b] = adj[b] || []).push([a, id, -1])
  }
  const seen = new Set()
  for (const [start] of shorts) {
    if (seen.has(start)) continue
    const order = [start], via = { [start]: null }
    seen.add(start)
    for (let q = 0; q < order.length; q++) {
      for (const [next, id, dir] of adj[order[q]] || []) {
        if (seen.has(next)) continue
        seen.add(next)
        order.push(next)
        via[next] = [order[q], id, dir]
      }
    }
    const beyond = {}
    for (let q = order.length - 1; q >= 0; q--) {
      const node = order[q]
      beyond[node] = (beyond[node] || 0) + (inj[node] || 0)
      if (!via[node]) continue
      const [toward, id, dir] = via[node]
      // That much leaves the subtree at node, toward its parent
      if (id) I[id] = dir === 1 ? -beyond[node] : beyond[node]
      beyond[toward] = (beyond[toward] || 0) + beyond[node]
    }
  }
  // Below a nanoamp is the leak to ground, not a current
  for (const e of edges) if (I[e.id] == null || Math.abs(I[e.id]) < 1e-9) I[e.id] = 0
  const maxI = Math.max(0, ...edges.map(e => Math.abs(I[e.id])))
  return { status: maxI < 1e-9 ? 'still' : 'ok', V, I, P, maxI }
}
