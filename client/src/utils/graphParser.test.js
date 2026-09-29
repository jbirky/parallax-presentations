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
