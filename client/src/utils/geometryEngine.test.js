import { describe, it, expect } from 'vitest'
import { GEO } from './geometryEngine'
import { GEOMETRY_TEMPLATES } from './geometryDiagram'

const build = key => {
  const p = GEO.parse(GEOMETRY_TEMPLATES.find(t => t.key === key).script)
  expect(p.errors).toEqual([])
  return { objs: p.objs, v: GEO.compute(p.objs) }
}
const d = GEO.dist
const move = (objs, name, x, y) => { objs.find(o => o.name === name).args = [x, y]; return GEO.compute(objs) }

describe('the theorems the templates show', () => {
  it('Euclid I.1: the triangle is equilateral, wherever A and B go', () => {
    const { objs, v } = build('euclid')
    expect(d(v.A, v.B)).toBeCloseTo(4)
    expect(d(v.B, v.C)).toBeCloseTo(4)
    expect(d(v.C, v.A)).toBeCloseTo(4)
    expect(v['α'].deg).toBeCloseTo(60)
    const w = move(objs, 'A', -3, 1)
    expect(d(w.B, w.C)).toBeCloseTo(d(w.A, w.B))
    expect(d(w.C, w.A)).toBeCloseTo(d(w.A, w.B))
  })

  it('the compass bisector halves AB at a right angle', () => {
    const { v } = build('bisector')
    expect(d(v.A, v.M)).toBeCloseTo(d(v.M, v.B))
    expect(v['α'].deg).toBeCloseTo(90)
  })

  it('the circumcenter is as far from each corner, on all three bisectors', () => {
    const { objs, v } = build('circum')
    expect(d(v.O, v.B)).toBeCloseTo(d(v.O, v.A))
    expect(d(v.O, v.C)).toBeCloseTo(d(v.O, v.A))
    const w = move(objs, 'C', 1.5, 3.4)
    expect(d(w.O, w.C)).toBeCloseTo(d(w.O, w.A))
    expect(GEO.cross(GEO.sub(w.h.q, w.h.p), GEO.sub(w.O, w.h.p))).toBeCloseTo(0)
  })

  it('the incircle touches AB at a right angle', () => {
    const { v } = build('incircle')
    expect(v['ρ'].deg).toBeCloseTo(90)
    // As far from AC as from AB
    const ac = GEO.sub(v.C, v.A), ai = GEO.sub(v.I, v.A)
    expect(Math.abs(GEO.cross(ac, ai)) / GEO.len(ac)).toBeCloseTo(d(v.I, v.H))
  })

  it('the Euler line: O, G and H in a row, with OH three times OG', () => {
    const { objs, v } = build('euler')
    const check = w => {
      expect(GEO.cross(GEO.sub(w.G, w.O), GEO.sub(w.H, w.O))).toBeCloseTo(0, 9)
      expect(d(w.O, w.H) / d(w.O, w.G)).toBeCloseTo(3)
    }
    check(v)
    check(move(objs, 'C', 0.5, 4))
  })

  it('Thales: the angle in a semicircle is right, wherever C is on it', () => {
    const { objs, v } = build('thales')
    expect(v['γ'].deg).toBeCloseTo(90)
    objs.find(o => o.name === 'C').args[1] = 0.7
    expect(GEO.compute(objs)['γ'].deg).toBeCloseTo(90)
  })

  it('the central angle is twice the inscribed one', () => {
    const { v } = build('inscribed')
    expect(v['θ'].deg / v['γ'].deg).toBeCloseTo(2)
  })

  it('a tangent meets its radius at a right angle', () => {
    const { v } = build('tangents')
    expect(v['β'].deg).toBeCloseTo(90)
    expect(d(v.T, v.U)).toBeGreaterThan(1)
  })
})

describe('working it out', () => {
  it('leaves out what doesn’t exist, and brings it back', () => {
    // P inside the circle has no tangents
    const { objs } = build('tangents')
    let v = move(objs, 'P', -1, 0.5)
    expect(v.c && v.d).toBeTruthy()
    expect([v.T, v.U, v.f, v.g, v.r, v['β']]).toEqual([null, null, null, null, null, null])
    v = move(objs, 'P', 3.5, 1)
    expect(v['β'].deg).toBeCloseTo(90)
  })

  it('orders two crossings one way, so a construction keeps its point', () => {
    const a = { c: { x: 0, y: 0 }, r: 4 }, b = { c: { x: 4, y: 0 }, r: 4 }
    const [first, second] = GEO.intersections(a, b)
    expect(first.y).toBeGreaterThan(0)
    expect(second.y).toBeLessThan(0)
    // A segment is only its own length
    expect(GEO.intersections({ kind: 'segment', p: { x: 0, y: 0 }, q: { x: 1, y: 0 } }, { kind: 'line', p: { x: 2, y: -1 }, q: { x: 2, y: 1 } })).toEqual([])
  })

  it('drags a free point, and a point on a curve along it', () => {
    const { objs, v } = build('thales')
    const C = objs.find(o => o.name === 'C')
    expect(GEO.dragTo(C, v, { x: 0, y: 5 })).toBe(true)
    expect(C.args[1]).toBeCloseTo(Math.PI / 2, 2)
    const A = objs.find(o => o.name === 'A')
    GEO.dragTo(A, v, { x: 1.234, y: 2.345 }, 0.5)
    expect(A.args).toEqual([1, 2.5])
    expect(GEO.dragTo(objs.find(o => o.name === 'O'), v, { x: 0, y: 0 })).toBe(false)
  })
})

describe('the script', () => {
  it('reads and writes every template the same', () => {
    for (const t of GEOMETRY_TEMPLATES) {
      const p = GEO.parse(t.script)
      expect(GEO.parse(GEO.serialize(p.objs)).objs).toEqual(p.objs.map((o, i) => ({ ...o, line: i + 1 })))
    }
  })

  it('says what’s wrong with a line', () => {
    const errs = GEO.parse([
      'A = Point(0, 0)',
      'c = Circle(A, X)',
      'nonsense',
      'B = Wobble(A)',
      'A = Point(1, 1)',
      'C = Point(A, 1)',
      'D = Circle(A)',
      '2x = Point(1, 1)',
      'E = Intersect(A, A)',
    ].join('\n')).errors.map(e => [e.line, e.msg])
    expect(errs).toEqual([
      [2, 'X isn’t made before this line'],
      [3, 'Write a line as name = Command(…), like c = Circle(A, B)'],
      [4, expect.stringMatching(/^Wobble isn’t a command/)],
      [5, 'A is named twice'],
      [6, 'Point’s argument 1 is a number, like Point(1, 2)'],
      [7, 'Circle takes 2 or 3 arguments, like Circle(A, B)'],
      [8, expect.stringMatching(/can’t be a name/)],
    ])
    // Points where curves go: worked out as nothing, not an error in the text
    expect(GEO.compute(GEO.parse('A = Point(0, 0)\nE = Intersect(A, A)').objs).E).toBe(null)
  })

  it('takes only the options it knows', () => {
    const o = GEO.parse('A = Point(0, 0) {hidden, color=red, onclick=x, label=P_1}').objs[0]
    expect(o.opts).toEqual({ hidden: true, color: 'red', label: 'P_1' })
  })

  it('writes a point’s name as TeX', () => {
    expect(['A', "A'", 'P1', 'P12', 'M_a', 'α'].map(GEO.labelTex)).toEqual(['A', "A'", 'P_{1}', 'P_{12}', 'M_{a}', 'α'])
  })
})

describe('drawing', () => {
  it('draws every template with nothing unworked', () => {
    for (const t of GEOMETRY_TEMPLATES) {
      const p = GEO.parse(t.script)
      const svg = GEO.render(p.objs, GEO.compute(p.objs), { W: 640, H: 400, view: { x: 0, y: 0, w: 12 }, dark: true, axes: true, grid: true })
      expect(svg).toMatch(/^<svg /)
      expect(svg).not.toMatch(/NaN|undefined|Infinity/)
    }
  })

  it('maps the view: its center to the box’s, its width across it', () => {
    const o = { W: 600, H: 300, view: { x: 2, y: 1, w: 6 } }
    expect(GEO.toScreen(GEO.frame(o), { x: 2, y: 1 })).toEqual({ x: 300, y: 150 })
    expect(GEO.toScreen(GEO.frame(o), { x: 5, y: 1 })).toEqual({ x: 600, y: 150 })
    expect(GEO.toWorld(o, 300, 50)).toEqual({ x: 2, y: 2 })
  })

  it('finds a point before the curve it’s on', () => {
    const { objs, v } = build('euclid')
    const o = { W: 640, H: 400, view: { x: 0, y: 0, w: 12 } }, F = GEO.frame(o), A = GEO.toScreen(F, v.A)
    const hits = GEO.hit(objs, v, o, A.x + 2, A.y + 1)
    expect(hits[0]).toMatchObject({ name: 'A', point: true, free: true })
    expect(hits.some(h => h.name === 's')).toBe(true)
  })
})
