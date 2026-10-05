import { describe, it, expect } from 'vitest'
import { simulateLogic, truthTable, hasFeedback, gateOut, rowOf, logicDepths } from './logicSim'
import { logicModel, pinsOf } from './logicParts'
import { LOGIC_TEMPLATES } from './logicDiagram'

const template = key => logicModel(LOGIC_TEMPLATES.find(t => t.key === key).build())
const values = (m, ids, upto) => simulateLogic(m, upto).map(s => ids.map(id => s.at[id] ?? '?').join(''))
// A diagram from parts [id, kind, more] and wires [from, to]; positions don't matter here
const diagram = (parts, wires) => logicModel({
  parts: parts.map(([id, kind, more], i) => ({ id, kind, x: 0, y: -i * 2, ...(more || {}) })),
  wires: wires.map(([from, to], i) => ({ id: 'w' + i, from, to })),
})

describe('gates', () => {
  it('follow their truth tables, with unknowns where they decide nothing', () => {
    expect([[0, 0], [0, 1], [1, 0], [1, 1]].map(ins => gateOut('and', ins))).toEqual([0, 0, 0, 1])
    expect([[0, 0], [0, 1], [1, 0], [1, 1]].map(ins => gateOut('nor', ins))).toEqual([1, 0, 0, 0])
    expect([[0, 0], [0, 1], [1, 0], [1, 1]].map(ins => gateOut('xnor', ins))).toEqual([1, 0, 0, 1])
    expect(gateOut('and', [0, null])).toBe(0)
    expect(gateOut('or', [1, null])).toBe(1)
    expect(gateOut('and', [1, null])).toBe(null)
    expect(gateOut('xor', [1, null])).toBe(null)
    expect(gateOut('not', [null])).toBe(null)
  })
})

describe('simulateLogic', () => {
  it('adds two bits, step by step', () => {
    expect(values(template('half'), ['S.in', 'C.in'], 3)).toEqual(['00', '10', '10', '01'])
  })

  it('passes the selected input', () => {
    expect(values(template('mux'), ['Y.in'], 3)).toEqual(['1', '0', '1', '1'])
  })

  it('has an SR latch start unknown, then set, hold, reset and hold', () => {
    expect(values(template('latch'), ['Q.in', 'Qn.in'], 4)).toEqual(['??', '10', '10', '01', '01'])
  })

  it('counts with a ripple counter, on rising clock edges', () => {
    expect(values(template('counter'), ['Q1.in', 'Q0.in'], 8)).toEqual(['00', '01', '01', '10', '10', '11', '11', '00', '00'])
  })

  it('shifts a shift register one place per clock, not two', () => {
    const m = diagram(
      [['D', 'input', { flips: [1, 3] }], ['k', 'clock', { start: 2, end: 9 }], ['f1', 'dff'], ['f2', 'dff'], ['f3', 'dff']],
      [['D.out', 'f1.d'], ['f1.q', 'f2.d'], ['f2.q', 'f3.d'], ['k.out', 'f1.clk'], ['k.out', 'f2.clk'], ['k.out', 'f3.clk']],
    )
    // D is 1 at steps 1 and 2; the clock rises at 2, 4, 6, 8
    expect(values(m, ['f1.q', 'f2.q', 'f3.q'], 8).filter((_, s) => s % 2 === 0)).toEqual(['000', '100', '010', '001', '000'])
  })

  it('adds three bits with a full adder', () => {
    const m = diagram(
      [['A', 'input'], ['B', 'input'], ['Ci', 'input'], ['x1', 'xor'], ['x2', 'xor'], ['a1', 'and'], ['a2', 'and'], ['o', 'or'], ['S', 'output'], ['Co', 'output']],
      [['A.out', 'x1.in1'], ['B.out', 'x1.in2'], ['x1.out', 'x2.in1'], ['Ci.out', 'x2.in2'], ['x2.out', 'S.in'],
        ['A.out', 'a1.in1'], ['B.out', 'a1.in2'], ['x1.out', 'a2.in1'], ['Ci.out', 'a2.in2'], ['a1.out', 'o.in1'], ['a2.out', 'o.in2'], ['o.out', 'Co.in']],
    )
    const tt = truthTable(m)
    expect(tt.rows.map(r => r.join(''))).toEqual(['00000', '00110', '01010', '01101', '10010', '10101', '11001', '11111'])
  })

  it('flags what can’t settle, outputs that disagree, and inputs driven by nothing', () => {
    const ring = diagram([['n1', 'not'], ['n2', 'not'], ['n3', 'not']], [['n1.out', 'n2.in1'], ['n2.out', 'n3.in1'], ['n3.out', 'n1.in1']])
    expect(simulateLogic(ring, 0)[0].oscillates).toBe(false)   // all unknown: nothing to change
    // Settled while A is 0; A rising makes it a ring of three inverters, which never settles
    const kicked = diagram([['A', 'input', { flips: [1] }], ['g', 'nand', {}], ['n2', 'not'], ['n3', 'not']], [['A.out', 'g.in1'], ['g.out', 'n2.in1'], ['n2.out', 'n3.in1'], ['n3.out', 'g.in2']])
    const [before, after] = simulateLogic(kicked, 1)
    expect(before).toMatchObject({ oscillates: false })
    expect(after.oscillates).toBe(true)
    expect(after.at['g.out']).toBe(null)
    const fight = diagram([['A', 'input', { value: 1 }], ['B', 'input'], ['Y', 'output']], [['A.out', 'Y.in'], ['B.out', 'Y.in']])
    expect(simulateLogic(fight, 0)[0]).toMatchObject({ conflicts: 1 })
    const lone = diagram([['g', 'and']], [])
    expect(simulateLogic(lone, 0)[0].floating).toEqual(['g.in1', 'g.in2'])
  })
})

describe('truth tables', () => {
  it('come from every input, with the row now lit', () => {
    const m = template('half'), tt = truthTable(m)
    expect(tt.rows).toEqual([[0, 0, 0, 0], [0, 1, 1, 0], [1, 0, 1, 0], [1, 1, 0, 1]])
    expect(simulateLogic(m, 3).map(s => rowOf(tt, s))).toEqual([0, 1, 2, 3])
  })

  it('are left out of what remembers', () => {
    expect(hasFeedback(template('latch'))).toBe(true)
    expect(truthTable(template('latch')).why).toMatch(/feedback/)
    expect(truthTable(template('counter')).why).toMatch(/remembers/)
  })
})

describe('depth', () => {
  it('counts gates from the inputs', () => {
    const m = template('mux'), depth = logicDepths(m)
    expect(depth('Sel.out')).toBe(0)
    expect(depth('inv.out')).toBe(1)
    expect(depth('g1.out')).toBe(2)
    expect(depth('g3.out')).toBe(3)
    expect(pinsOf(m.parts.find(p => p.id === 'g3')).map(x => x.name)).toEqual(['in1', 'in2', 'out'])
  })
})
