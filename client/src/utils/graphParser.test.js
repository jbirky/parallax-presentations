import { describe, it, expect } from 'vitest'
import { createMathParser } from './graphParser'

const P = createMathParser()
const read = (...texts) => P.analyze(texts.map((text, i) => ({ id: 'e' + i, text })))
// The value of y = <expr> at x, with sliders a = 2, b = 3
const at = (expr, x, extra = []) => {
  const a = read('y = ' + expr, 'a = 2', 'b = 3', ...extra)
  const item = a.items[0]
  if (item.kind === 'error') throw new Error(item.error)
  return item.f({ ...P.paramValues(a), x })
}

describe('reading expressions as Desmos does', () => {
  it('multiplies what sits side by side', () => {
    expect(at('2x', 3)).toBe(6)
    expect(at('ab', 0)).toBe(6)
    expect(at('2(x + 1)', 1)).toBe(4)
    expect(at('(x + 1)(x - 1)', 3)).toBe(8)
    expect(at('1/2x', 4)).toBe(2) // (1/2)·x
    expect(at('2πx', 1)).toBeCloseTo(2 * Math.PI)
  })

  it('takes functions with or without parentheses', () => {
    expect(at('sin 2x', 0.3)).toBeCloseTo(Math.sin(0.6))
    expect(at('sin x cos x', 0.3)).toBeCloseTo(Math.sin(0.3) * Math.cos(0.3))
    expect(at('sin^2 x', 0.3)).toBeCloseTo(Math.sin(0.3) ** 2)
    expect(at('sin^-1 x', 0.5)).toBeCloseTo(Math.asin(0.5))
    expect(at('sin^{-1}(x)', 0.5)).toBeCloseTo(Math.asin(0.5))
    expect(at('sin x^2', 2)).toBeCloseTo(Math.sin(4))
    expect(at('√x + 1', 9)).toBe(4)
    expect(at('ln e^x', 2)).toBeCloseTo(2)
    expect(at('log 1000', 0)).toBeCloseTo(3)
  })

  it('reads powers, bars, constants and more-than-one-value functions', () => {
    expect(at('2^-x', 1)).toBe(0.5)
    expect(at('x^2^3', 2)).toBe(256)
    expect(at('-x^2', 3)).toBe(-9)
    expect(at('e^(2x)', 1)).toBeCloseTo(Math.exp(2))
    expect(at('|x - 5|', 2)).toBe(3)
    expect(at('2|x||x|', -3)).toBe(18)
    expect(at('||x| - 4|', -1)).toBe(3)
    expect(at('min(x, 1, a)', 5)).toBe(1)
    expect(at('mod(x, 3)', -1)).toBe(2)
    expect(at('arctan(1, x)', 1)).toBeCloseTo(Math.PI / 4)
    expect(at('x·2 − 1', 2)).toBe(3)
    expect(at('τ', 0)).toBeCloseTo(2 * Math.PI)
  })

  it('reads subscripts and Greek names', () => {
    expect(at('a_1 + a_{12} x', 2, ['a_1 = 1', 'a_{12} = 5'])).toBe(11)
    expect(at('alpha x', 3, ['α = 2'])).toBe(6)
  })

  it('reads piecewise braces, which also restrict a curve', () => {
    expect(at('{x < 0: -x, x^2}', -2)).toBe(2)
    expect(at('{x < 0: -x, x^2}', 3)).toBe(9)
    expect(at('{x > 0: 1}', -1)).toBeNaN()
    expect(at('x^2 {0 < x < 2}', 1)).toBe(1)
    expect(at('x^2 {0 < x < 2}', 3)).toBeNaN()
  })
})

describe('what each expression draws', () => {
  const kinds = [
    ['y = x^2', 'explicit', { axis: 'y' }],
    ['x^2 = y', 'explicit', { axis: 'y' }],
    ['x = sin y', 'explicit', { axis: 'x' }],
    ['sin x', 'explicit', { axis: 'y' }],
    ['r = 1 + cos θ', 'polar'],
    ['(cos t, sin t)', 'parametric'],
    ['(cos t, sin t) {t < 3}', 'parametric'],
    ['(1, 2)', 'point'],
    ['x^2 + y^2 = 4', 'implicit'],
    ['y^2 = x', 'explicit', { axis: 'x' }],
    ['y^2 = x^3 - x', 'implicit'],
    ['y < x', 'region', { axis: 'y', side: 'below', strict: true }],
    ['x^2 >= y', 'region', { axis: 'y', side: 'below', strict: false }],
    ['x > y^2', 'region', { axis: 'x', side: 'above', strict: true }],
    ['x^2 + y^2 < 9', 'region', { axis: null }],
    ['-1 < y < x', 'region', { axis: null }],
    ['2 + 3', 'value'],
    ['c = 4', 'param', { slider: true, literal: 4 }],
    ['c = -0.5', 'param', { slider: true, literal: -0.5 }],
    ['c = 2π', 'param', { slider: false }],
    ['f(x) = x^2', 'function', { graph: 'y' }],
    ['g(u, v) = u v', 'function'],
  ]
  it.each(kinds)('%s is %s', (text, kind, extra = {}) => {
    const item = read(text).items[0]
    expect(item.error).toBeUndefined()
    expect(item.kind).toBe(kind)
    expect(item).toMatchObject(extra)
  })

  it('draws a curve with its restriction on both coordinates', () => {
    const item = read('(cos t, sin t) {t < 3}').items[0]
    expect(item.fx({ t: 1 })).toBeCloseTo(Math.cos(1))
    expect(item.fx({ t: 4 })).toBeNaN()
    expect(item.fy({ t: 4 })).toBeNaN()
  })

  it('shades where every part of a chained inequality holds', () => {
    const item = read('-1 < y < x').items[0]
    const inside = (x, y) => item.comps.every(c => c.test({ x, y }))
    expect(inside(2, 0)).toBe(true)
    expect(inside(2, -2)).toBe(false)
    expect(inside(0, 1)).toBe(false)
  })

  it('draws user functions, and uses them in other expressions', () => {
    const a = read('f(x) = x^2 + k', 'y = f(x - 1) + g(2)', 'g(u) = 10u', 'k = 1')
    const env = { ...P.paramValues(a), x: 3 }
    expect(a.items[0].f(env)).toBe(10)
    expect(a.items[1].f(env)).toBe(25)
    expect(a.items[2].graph).toBeUndefined() // not a function of x
  })

  it('works out values defined from sliders, in any order', () => {
    const a = read('c = 2b', 'b = a + 1', 'a = 3')
    expect(P.paramValues(a)).toEqual({ a: 3, b: 4, c: 8 })
    expect(P.paramValues(a, { a: 10 })).toEqual({ a: 10, b: 11, c: 22 })
  })

  it('works out a chain of values listed from the last back to the first', () => {
    const a = read('d = 2c', 'c = 2b', 'b = 2a', 'a = 1', 'y = d x')
    expect(P.paramValues(a)).toEqual({ a: 1, b: 2, c: 4, d: 8 })
    expect(a.items[4].f({ ...P.paramValues(a), x: 1 })).toBe(8)
  })

  it('gives a function that calls one with an error an error of its own, not a crash when drawn', () => {
    const a = read('a = 1', 'a(x) = x', 'f(x) = a(x) + 1', 'y = f(x)')
    expect(a.items[1].error).toMatch(/already a slider/)
    expect(a.items[2].kind).toBe('error')
    expect(a.items[2].error).toMatch(/a\(…\) has an error/)
    expect(a.items[3].kind).toBe('error')
    // and one whose callee fails only as it compiles
    const b = read('g(x) = mod(x)', 'h(x) = g(x) + 1', 'y = h(x) + 2')
    expect(b.items.map(it => it.kind)).toEqual(['error', 'error', 'error'])
  })

  it('lists the names to offer sliders for, and still draws the curve', () => {
    const a = read('y = m x + q', 'm = 2')
    expect(a.missing).toEqual(['q'])
    expect(a.items[0].kind).toBe('explicit')
    expect(a.items[0].missing).toEqual(['q'])
    expect(a.items[0].f({ ...P.paramValues(a), x: 1 })).toBeNaN()
  })

  it('lets points made of sliders be dragged', () => {
    const a = read('(p, q)', '(p, 3)', '(2p, q)', 'p = 1', 'q = 2')
    expect(a.items.slice(0, 3).map(it => [it.dragX, it.dragY])).toEqual([['p', 'q'], ['p', null], [null, 'q']])
  })

  it('says what’s wrong', () => {
    const error = text => read(text, 'a = 1').items[0].error
    expect(error('y = (')).toMatch(/missing/)
    expect(error('y = sin')).toMatch(/sin needs something/)
    expect(error('y = mod(x)')).toMatch(/mod takes 2/)
    expect(error('y = 2 $ x')).toMatch(/“\$”/)
    expect(error('t = 2')).toMatch(/call this something else/)
    expect(error('(1, 2, 3)')).toMatch(/two coordinates/)
    expect(error('(x, 2)')).toMatch(/use t/)
    expect(error('y = (1, 2) + 1')).toMatch(/point/)
    expect(read('a = 1', 'a = 2').items[1].error).toMatch(/defined twice/)
    expect(read('g(x) = g(x) + 1').items[0].error).toMatch(/uses itself/)
    expect(read('f(x) = x', 'y = f').items[1].error).toMatch(/f is a function/)
  })

  it('reads words as letters, never as code', () => {
    // a·l·e·r·t·(1): r and t are curve variables, so it's no curve at all
    expect(read('y = alert(1)').items[0].kind).toBe('error')
    expect(read('y = x; alert(1)').items[0].error).toMatch(/“;”/)
    expect(read('y = x_constructor').items[0].missing).toEqual(['x_constructor'])
  })
})

describe('fields, systems and slope fields', () => {
  const kinds = (...texts) => read(...texts).items.map(it => it.kind + (it.error ? ': ' + it.error : ''))

  it('reads vector fields, named, bare or as a gradient', () => {
    expect(kinds('F(x, y) = (-y, x)')).toEqual(['vector'])
    expect(kinds('(-y, x)', '(cos t, sin t)', '(2, 3)')).toEqual(['vector', 'parametric', 'point'])
    expect(kinds('f(x, y) = x^2 - y^2', '∇f', 'grad f')).toEqual(['function', 'vector', 'vector'])
    const g = read('f(x, y) = x^2 - y^2', '∇f').items[1], o = [0, 0]
    g.F({}, 1.5, 2, o)
    expect(o[0]).toBeCloseTo(3, 7)
    expect(o[1]).toBeCloseTo(-4, 7)
  })

  it('pairs x′ and y′ into a system on the first of the two', () => {
    expect(kinds("x' = y", "y' = -sin x - c y", 'c = 0.2')).toEqual(['system', 'partner', 'param'])
    expect(kinds('dy/dt = -x', 'dx/dt = y')).toEqual(['system', 'partner'])
    expect(kinds('ẋ = y', 'ẏ = -x')).toEqual(['system', 'partner'])
    expect(kinds("(x′, y′) = (y, -x)")).toEqual(['system'])
    const r = read("x' = y", "y' = -sin x - c y", 'c = 0.5'), o = [0, 0]
    r.items[0].F(P.paramValues(r), 1, 2, o)
    expect(o).toEqual([2, -Math.sin(1) - 1])
    expect(r.items[0].partner).toBe(r.items[1].id)
    expect(r.items[1].partnerOf).toBe(r.items[0].id)
  })

  it('reads polar systems in Cartesian, with μ as a slider', () => {
    const r = read("r′ = μ r - r^3", 'θ′ = 1', 'μ = 0.25'), o = [0, 0]
    expect(r.items.map(it => it.kind)).toEqual(['system', 'partner', 'param'])
    expect(r.items[0].polar).toBe(true)
    r.items[0].F(P.paramValues(r), 0.5, 0, o)
    expect(o[0]).toBeCloseTo(0.25 * 0.5 - 0.125, 12)
    expect(o[1]).toBeCloseTo(0.5, 12)
    expect(r.items[2].name).toBe('mu')
  })

  it('reads slope fields and their solutions, and paths', () => {
    expect(kinds("y' = x - y", 'y(0) = 1')).toEqual(['slope', 'solution'])
    expect(kinds('dy/dx = x - y', 'y(-2) = a', 'a = 1')).toEqual(['slope', 'solution', 'param'])
    const r = read('dy/dx = x - y', 'y(-2) = a', 'a = 1')
    expect(r.items[1]).toMatchObject({ owner: r.items[0].id, dragY: 'a' })
    expect(r.items[1].x0({})).toBe(-2)
    const t = read("x' = y", "y' = -x", '(x, y)(0) = (p, 1)', 'p = 2')
    expect(t.items[2]).toMatchObject({ kind: 'trajectory', owner: t.items[0].id, dragX: 'p', dragY: null })
    expect(t.items[2].px(P.paramValues(t))).toBe(2)
  })

  it('follows the field above a path, or else the one below', () => {
    const r = read('(x, y)(0) = (1, 0)', 'F(x, y) = (1, 0)', 'G(x, y) = (0, 1)', '(x, y)(0) = (2, 0)')
    expect(r.items[0].owner).toBe(r.items[1].id)
    expect(r.items[3].owner).toBe(r.items[2].id)
  })

  it('restricts a field as Graph restricts a curve', () => {
    const f = read('F(x, y) = (1, x) {x > 0}').items[0], o = [0, 0]
    f.F({}, 2, 0, o)
    expect(o).toEqual([1, 2])
    f.F({}, -2, 0, o)
    expect(o.every(Number.isNaN)).toBe(true)
  })

  it('offers sliders, and says what’s wrong', () => {
    expect(read("x' = a y", "y' = -x").missing).toEqual(['a'])
    const error = (...texts) => read(...texts).items.find(it => it.error)?.error
    expect(error("x' = y")).toMatch(/needs a y′/)
    expect(error("x' = y", "y' = -x + cos t")).toMatch(/doesn’t change with t/)
    expect(error('(x, y)(0) = (1, 0)')).toMatch(/needs a field/)
    expect(error('y(0) = 1')).toMatch(/needs a slope field/)
    expect(error('∇g')).toMatch(/isn’t defined/)
    expect(error("x' = y", "x' = 2", "y' = 1")).toMatch(/defined twice/)
    expect(error('F(x, y) = (1, 2)', 'F(x, y) = (2, 1)')).toMatch(/defined twice/)
    expect(error('(x, y)(0) = (x, 1)', 'F(x, y) = (1, 2)')).toMatch(/numbers or sliders/)
    // A point with x in it is still a mistaken point
    expect(error('(x, 2)')).toMatch(/F\(x, y\)/)
  })

  it('leaves Graph’s other lines as they were', () => {
    expect(kinds('y = x^2', 'x^2 + y^2 = 9', 'f(x) = x', 'r = 2', 'y < x')).toEqual(['explicit', 'implicit', 'function', 'polar', 'region'])
  })
})

describe('3D graphs', () => {
  const read3 = (...texts) => P.analyze(texts.map((text, i) => ({ id: 'e' + i, text })), { dims: 3 })
  const kinds3 = (...texts) => read3(...texts).items.map(it => it.kind + (it.axis ? '(' + it.axis + ')' : '') + (it.error ? ': ' + it.error : ''))

  it('reads surfaces along each axis, and in r and θ', () => {
    expect(kinds3('z = sin x cos y', 'x^2 + y^2', 'x = y z', 'y = x^2 + z', 'z = 8 - r^2 {r < 4}')).toEqual(['surface(z)', 'surface(z)', 'surface(x)', 'surface(y)', 'surface(z)'])
    const r = read3('z = a x y', 'a = 2'), E = { ...P.paramValues(r), x: 3, y: 4 }
    expect(r.items[0].f(E)).toBe(24)
    expect(r.items[1].kind).toBe('param')
  })

  it('reads parametric surfaces, curves, points and implicit surfaces', () => {
    expect(kinds3('(cos u, sin u, v)', '(cos t, sin t, t/5)', '(1, 2, 3)', 'x^2 + y^2 + z^2 = 25', 'r = 4'))
      .toEqual(['psurface', 'curve3', 'point3', 'implicit3', 'implicit3'])
    const s = read3('x^2 + y^2 + z^2 = 25').items[0]
    expect(s.F({ x: 3, y: 4, z: 0 })).toBe(0)
  })

  it('draws f(x, y) = … as a surface, and keeps z, u, v and w from being sliders', () => {
    const r = read3('f(x, y) = x - y', 'z + u + v = k')
    expect(r.items[0]).toMatchObject({ kind: 'function', graph: 'z' })
    expect(r.items[0].f({ x: 5, y: 2 })).toBe(3)
    expect(r.missing).toEqual(['k'])
    expect(read3('w = 2').items[0].kind).not.toBe('param')
    // In 2D the same letters are sliders
    expect(read('y = z u').missing).toEqual(['z', 'u'])
  })

  it('says what doesn’t work in 3D', () => {
    const error = (...texts) => read3(...texts).items.find(it => it.error)?.error
    expect(error('(1, 2)')).toMatch(/three coordinates/)
    expect(error('z < x')).toMatch(/2D only/)
    expect(error("x' = y", "y' = -x")).toMatch(/switch this graph to 2D/)
    expect(error('z + 1')).toMatch(/equation/)
    expect(error('(x, y, z)')).toMatch(/numbers or sliders/)
    expect(error('x + w = 3')).toMatch(/line of its own/)
    expect(error('w = t')).toMatch(/uses x, y, z/)
  })

  it('reads a value in space, w = F(x, y, z) or f(x, y, z) = …', () => {
    const r = read3('w = x y z + a', 'a = 1', 'f(x, y, z) = x^2 + y^2 - z^2', 'r = 2 + w')
    expect(r.items[0]).toMatchObject({ kind: 'field3', name: 'w' })
    expect(r.items[0].f({ ...P.paramValues(r), x: 1, y: 2, z: 3 })).toBe(7)
    expect(r.items[2]).toMatchObject({ kind: 'function', graph: 'w', name: 'f' })
    expect(r.items[2].f({ x: 1, y: 2, z: 3 })).toBe(-4)
    expect(r.items[3].kind).toBe('error')
    // r and θ, and restrictions, as for surfaces
    const c = read3('w = r cos θ {z > 0}').items[0]
    expect(c.kind).toBe('field3')
    expect(c.f({ x: 3, y: 4, z: 1, r: 5, theta: Math.atan2(4, 3) })).toBeCloseTo(3)
    expect(c.f({ x: 3, y: 4, z: -1, r: 5, theta: 0 })).toBeNaN()
    // In 2D, w is a slider still
    expect(read('y = w x').missing).toEqual(['w'])
  })

  it('compiles a surface’s or curve’s color function, and a value’s slices', () => {
    const r = P.analyze([
      { id: 'a', text: 'x^2 + y^2 + z^2 = 9', surface: { color: 'function', colorBy: 'f(x, y, z) + k' } },
      { id: 'b', text: 'f(x, y, z) = x y z' },
      { id: 'c', text: '(cos t, sin t, t)', surface: { color: 'function', colorBy: 't^2' } },
      { id: 'd', text: '(cos u, sin u, v)', surface: { color: 'function', colorBy: 'u + v' } },
      { id: 'e', text: 'z = x', surface: { color: 'function', colorBy: 'u' } },
      { id: 'g', text: 'w = x', volume: { at: { x: '2c', y: '', z: 'x' } } },
      { id: 'h', text: 'z = y', surface: { color: 'height', colorBy: 'x' } },
    ], { dims: 3 })
    const [a, , c, d, e, g, h] = r.items
    expect(a.colorF({ x: 1, y: 2, z: 3, k: 1 })).toBe(7)
    expect(c.colorF({ t: 3 })).toBe(9)
    expect(d.colorF({ u: 1, v: 2 })).toBe(3)
    // u belongs to parametric surfaces; the surface itself still draws
    expect(e.kind).toBe('surface')
    expect(e.colorF).toBeUndefined()
    expect(e.colorError).toMatch(/can use x, y, z, r, θ and sliders/)
    expect(g.at.x({ c: 1.5 })).toBe(3)
    expect(g.at.y).toBeUndefined()
    expect(g.atError).toMatch(/a number, or uses sliders/)
    // Only when coloring by a function
    expect(h.colorF).toBeUndefined()
    expect(r.missing.sort()).toEqual(['c', 'k'])
  })
})

describe('data lines', () => {
  it('read as data, with nothing to parse, beside the rest in 2D and 3D', () => {
    for (const dims of [2, 3]) {
      const r = P.analyze([
        { id: 'd', data: { dataset: 'exoplanets', x: 'pl_orbper', y: 'pl_bmasse' } },
        { id: 'f', text: dims === 3 ? 'z = x' : 'y = 2x' },
        { id: 'm', text: 'm = 3', slider: {} },
      ], { dims })
      expect(r.items.map(i => i.kind)).toEqual(['data', dims === 3 ? 'surface' : 'explicit', 'param'])
      expect(r.items[0].error).toBeUndefined()
      expect(r.missing).toEqual([])
    }
  })
})
