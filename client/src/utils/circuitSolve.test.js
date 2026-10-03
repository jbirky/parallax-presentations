import { describe, it, expect } from 'vitest'
import { solveCircuit } from './circuitSolve'
import { circuitModel, parseValue, formatSI } from './circuitParts'
import { CIRCUIT_TEMPLATES } from './circuitDiagram'

const template = key => circuitModel(CIRCUIT_TEMPLATES.find(t => t.key === key).build())
// A circuit from [from, to, part, value, more] parts between named vertices
function circuit(parts, grounds = []) {
  const ids = new Set(parts.flatMap(([a, b]) => [a, b]))
  return circuitModel({
    vertices: [...ids].map((id, i) => ({ id, x: i, y: 0, ground: grounds.includes(id) ? 'down' : null })),
    edges: parts.map(([from, to, part, value = '', more = {}], i) => ({ id: 'e' + (i + 1), from, to, part, value: String(value), ...more })),
  })
}

describe('values', () => {
  it('reads SI prefixes', () => {
    expect(parseValue('4.7k')).toBeCloseTo(4700)
    expect(parseValue('100n')).toBeCloseTo(1e-7)
    expect(parseValue('2.2µ')).toBeCloseTo(2.2e-6)
    expect(parseValue('10 mA')).toBeCloseTo(0.01)
    expect(parseValue('1M')).toBeCloseTo(1e6)
    expect(parseValue('ohm')).toBe(null)
  })
  it('writes them back', () => {
    expect(formatSI(4700, 'Ω')).toBe('4.7 kΩ')
    expect(formatSI(0.3, 'A')).toBe('300 mA')
    expect(formatSI(6.6667, 'V')).toBe('6.67 V')
    expect(formatSI(1e-6, 'F')).toBe('1 µF')
    expect(formatSI(0, 'A')).toBe('0 A')
  })
})

describe('solveCircuit', () => {
  it('solves a series circuit, and a switch opens it', () => {
    const m = template('lamp')
    const s = solveCircuit(m)
    expect(s.status).toBe('ok')
    expect(s.I.e1).toBeCloseTo(0.3)                    // the battery, - to +
    expect(s.I.e5).toBeCloseTo(0.3)                    // the ammeter, a short: from the wires' tree
    expect(s.V.d - s.V.e).toBeCloseTo(3.6)             // across the lamp, which the voltmeter reads
    expect(s.P.e4).toBeCloseTo(1.08)                   // the lamp's power
    expect(solveCircuit(m, 2).status).toBe('still')    // before the switch closes
  })

  it('adds the branch currents into the main line, step by step', () => {
    const m = template('parallel')
    expect([1, 2, 3].map(n => solveCircuit(m, n).I.e2)).toEqual([expect.closeTo(0.6), expect.closeTo(0.9), expect.closeTo(1.1)])
    const s = solveCircuit(m)
    expect(s.I.e5).toBeCloseTo(0.5)                    // the top wire past the first branch
    expect(s.I.e8).toBeCloseTo(0.2)
    expect(s.I.e4).toBeCloseTo(1.1)                    // the return wire
  })

  it('divides a voltage, against ground', () => {
    const s = solveCircuit(template('divider'))
    expect(s.V.a).toBeCloseTo(0)
    expect(s.V.d).toBeCloseTo(20 / 3)
  })

  it('solves an unbalanced Wheatstone bridge', () => {
    const s = solveCircuit(template('bridge'))
    // R and the joined T–B node: 120 Ω on one side, 50 Ω on the other, of 12 V
    const vm = 12 * 50 / 170
    expect(s.I.e7).toBeCloseTo(12 / 170)
    expect(s.I.e5).toBeCloseTo((12 - vm) / 200 - vm / 100)
  })

  it('conducts through a diode one way only', () => {
    const forward = solveCircuit(template('diode'))
    expect(forward.I.e3).toBeCloseTo(4.3 / 430)
    expect(forward.V.c - forward.V.d).toBeCloseTo(0.7, 2)
    const m = template('diode')
    const d = m.edges.find(e => e.part === 'diode');
    [d.from, d.to] = [d.to, d.from]
    expect(solveCircuit(m).status).toBe('still')
  })

  it('has a capacitor block current and an AC source give none, in the steady state', () => {
    expect(solveCircuit(template('rc')).status).toBe('still')
    expect(solveCircuit(template('rlc')).status).toBe('still')
  })

  it('drives a current source through what it meets', () => {
    const s = solveCircuit(circuit([['a', 'b', 'isource', '2m'], ['b', 'a', 'resistor', '1k']], ['a']))
    expect(s.I.e2).toBeCloseTo(0.002)
    expect(s.V.b).toBeCloseTo(2)
  })

  it('reports a source shorted out, sources that disagree, and nothing to solve', () => {
    expect(solveCircuit(circuit([['a', 'b', 'battery', 9], ['b', 'a', 'wire']]))).toMatchObject({ status: 'shorted', id: 'e1' })
    expect(solveCircuit(circuit([['a', 'b', 'battery', 9], ['a', 'b', 'battery', 6]])).status).toBe('conflict')
    expect(solveCircuit(circuit([['a', 'b', 'resistor', 10], ['b', 'a', 'wire']])).status).toBe('nosource')
    expect(solveCircuit(circuitModel({})).status).toBe('empty')
  })

  it('joins every ground into one node', () => {
    // A source and its load on separate grounds still make a loop
    const s = solveCircuit(circuit([['a', 'b', 'battery', 5], ['b', 'c', 'resistor', 10], ['c', 'd', 'wire']], ['a', 'd']))
    expect(s.I.e2).toBeCloseTo(0.5)
    expect(s.I.e3).toBeCloseTo(0.5)
  })

  it('gives a wire that closes a loop of wires no current, and its parallel twin all of it', () => {
    const s = solveCircuit(circuit([['a', 'b', 'battery', 1], ['b', 'c', 'resistor', 1], ['c', 'a', 'wire'], ['c', 'a', 'wire']]))
    expect(Math.abs(s.I.e3) + Math.abs(s.I.e4)).toBeCloseTo(1)
  })
})
