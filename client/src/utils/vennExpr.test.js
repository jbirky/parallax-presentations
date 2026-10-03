import { describe, it, expect } from 'vitest'
import {
  parse, tokenize, evaluate, format, simplest, cover, fullMask, regionsOf, regionAst, regionNumber, regionPhrase,
  parseNumber, solveFacts, placeMembers, MAX_MEMBERS,
} from './vennExpr'

const ctx3 = { ids: ['A', 'B', 'C'], universe: 'U' }
const mask = (src, ctx = ctx3) => evaluate(parse(src, ctx).ast, ctx.ids.length)
const text = (node, ids = ctx3.ids, comp = 'prime') => format(node, { out: 'text', comp, ids, universe: 'U' })
const simp = (src, ctx = ctx3) => text(simplest(mask(src, ctx), ctx.ids.length), ctx.ids)
const errorOf = src => { try { parse(src, ctx3); return null } catch (e) { return { msg: e.message, at: e.at } } }

describe('reading expressions', () => {
  it('reads TeX, symbols, keyboard characters and words alike', () => {
    const want = mask('A \\cap (B \\cup C)')
    for (const s of ['A ∩ (B ∪ C)', 'A and (B or C)', 'A & (B | C)', 'A(B+C)', 'A \\cap \\left( B \\cup C \\right)', 'a ∩ (b ∪ c)']) expect(mask(s)).toBe(want)
    const neither = mask("(A \\cup B)'")
    for (const s of ['(A ∪ B)′', '(A \\cup B)^c', '(A \\cup B)^{\\complement}', '\\overline{A \\cup B}', "A'B'", '¬A ∧ ¬B', 'not A and not B', '(A ∪ B)ᶜ']) expect(mask(s)).toBe(neither)
    expect(mask('A \\setminus B')).toBe(mask('A - B'))
    expect(mask('A\\B')).toBe(mask('A minus B'))
    expect(mask('A \\triangle B')).toBe(mask('A xor B'))
    expect(mask('A Δ B')).toBe(mask('(A ∖ B) ∪ (B ∖ A)'))
  })

  it('knows the universe and the empty set by their usual names', () => {
    for (const s of ['U', '\\Omega', 'Ω', 'ξ', '\\xi', '\\mathcal{E}', 'A ∪ A′']) expect(mask(s)).toBe(fullMask(3))
    for (const s of ['∅', '\\varnothing', '\\emptyset', '\\{\\}', 'A ∩ ∅', 'A ∩ A′']) expect(mask(s)).toBe(0)
    // A universe named S, where no set is
    expect(mask('S', { ids: ['A', 'B'], universe: 'S' })).toBe(fullMask(2))
  })

  it('reads ∩ before ∪, and ∪ ∖ Δ left to right, and says so', () => {
    const p = parse('A ∪ B ∩ C', ctx3)
    expect(text(p.ast)).toBe('A ∪ (B ∩ C)')
    expect(p.readAs).toBe(true)
    expect(p.notes[0]).toMatch(/∩ is read before ∪/)
    const q = parse('A ∪ B ∖ C', ctx3)
    expect(text(q.ast)).toBe('(A ∪ B) ∖ C')
    expect(q.notes.join(' ')).toMatch(/left to right/)
    expect(parse('A ∩ (B ∪ C)', ctx3).readAs).toBe(false)
  })

  it('reads relations as two sides', () => {
    const p = parse("(A \\cup B)' = A' \\cap B'", ctx3)
    expect(p.ast).toMatchObject({ t: 'rel', op: '=' })
    expect(evaluate(p.ast.a, 3)).toBe(evaluate(p.ast.b, 3))
    expect(parse('A ∩ B \\subseteq A', ctx3).ast.op).toBe('⊆')
    expect(parse('A \\subset B', ctx3).ast.op).toBe('⊆')
    expect(parse('A ⊊ B', ctx3).ast.op).toBe('⊂')
    expect(parse('A != B', ctx3).ast.op).toBe('≠')
  })

  it('points at mistakes, in words', () => {
    expect(errorOf('A ∩ (B ∪ C')).toEqual({ msg: 'This bracket is never closed.', at: 4 })
    expect(errorOf('A ∪')).toMatchObject({ msg: "Something's missing after ∪." })
    expect(errorOf('E ∪ A')).toEqual({ msg: "There's no set E. The sets here are A, B and C.", at: 0 })
    expect(errorOf('A ∩ ∩ B').at).toBe(4)
    expect(errorOf('(A))').msg).toMatch(/never opened/)
    expect(errorOf('A^2').msg).toMatch(/superscript can only be c/)
    expect(errorOf('A_1').msg).toMatch(/one letter/)
    expect(errorOf('Cats ∩ A').msg).toMatch(/isn't an operation or a set/)
    expect(errorOf('\\foo').msg).toMatch(/\\foo/)
    expect(errorOf('').msg).toMatch(/Type an expression/)
    expect(errorOf('A = B = C').msg).toMatch(/One relation/)
  })

  it('finds each set where it’s written, for renaming', () => {
    const sets = tokenize('AB \\cap C', ctx3).filter(t => t.k === 'set')
    expect(sets.map(t => [t.v, t.at])).toEqual([[0, 0], [1, 1], [2, 8]])
  })
})

describe('writing them out', () => {
  it('writes each notation for a complement, in TeX, text and HTML', () => {
    const ast = parse("(A \\cup B)' \\cap C'", ctx3).ast
    const f = (out, comp) => format(ast, { out, comp, ids: ctx3.ids, universe: 'U' })
    expect(f('tex', 'prime')).toBe("(A \\cup B)' \\cap C'")
    expect(f('tex', 'c')).toBe('(A \\cup B)^{c} \\cap C^{c}')
    expect(f('tex', 'bar')).toBe('\\overline{A \\cup B} \\cap \\overline{C}')
    expect(f('text', 'prime')).toBe('(A ∪ B)′ ∩ C′')
    expect(f('text', 'c')).toBe('(A ∪ B)ᶜ ∩ Cᶜ')
    expect(f('html', 'bar')).toBe('<span class="ov"><i>A</i> ∪ <i>B</i></span> ∩ <span class="ov"><i>C</i></span>')
    // A double complement needs braces in TeX
    expect(format(parse("A''", ctx3).ast, { out: 'tex', comp: 'c', ids: ctx3.ids })).toBe('{A^{c}}^{c}')
  })

  it('reads back what it writes', () => {
    for (const s of ['A ∩ (B ∪ C)', "(A ∪ B)' ∩ C", 'A Δ B Δ C', '(A ∖ B) ∖ C', 'U', '∅']) {
      const ast = parse(s, ctx3).ast
      for (const comp of ['prime', 'c', 'bar']) {
        const tex = format(ast, { out: 'tex', comp, ids: ctx3.ids, universe: 'U' })
        expect(mask(tex)).toBe(evaluate(ast, 3))
      }
    }
  })
})

describe('the simplest form', () => {
  it('names a group of regions as simply as it can', () => {
    expect(simp('(A ∖ C) ∪ (B ∖ C)')).toBe('(A ∪ B) ∖ C')
    expect(simp('A ∩ B′ ∩ C′')).toBe('A ∖ (B ∪ C)')
    expect(simp('A′ ∩ B′')).toBe('(A ∪ B)′')
    expect(simp('(A ∩ B) ∪ (A ∩ C)')).toBe('A ∩ (B ∪ C)')
    expect(simp('A ∪ B ∩ C')).toBe('A ∪ (B ∩ C)')
    expect(simp('(A ∖ B) ∪ (B ∖ A)')).toBe('A Δ B')
    expect(simp('A ∪ A′')).toBe('U')
    expect(simp('A ∩ A′')).toBe('∅')
    const four = { ids: ['A', 'B', 'C', 'D'], universe: 'U' }
    expect(simp('A Δ B Δ C Δ D', four)).toBe('A Δ B Δ C Δ D')
  })

  it('simplifies every function of three and four sets back to itself', () => {
    for (const n of [3, 4]) {
      for (let f = 0; f <= fullMask(n); f++) {
        const s = simplest(f, n)
        if (evaluate(s, n) !== f) throw new Error(`${n} sets: ${f} came back as ${evaluate(s, n)}`)
      }
    }
  })

  it('covers a group of regions with terms for TikZ', () => {
    const terms = cover(mask('A ∩ (B ∪ C)'), 3)
    expect(terms).toHaveLength(2)
    for (const r of regionsOf(mask('A ∩ (B ∪ C)'), 3)) expect(terms.some(t => (r & ~t.d) === t.v)).toBe(true)
    expect(cover(0, 3)).toEqual([])
  })
})

describe('naming regions', () => {
  it('numbers three sets the way textbooks do', () => {
    expect([1, 3, 2, 5, 7, 6, 4, 0].map(m => regionNumber(m, 3))).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'])
    expect(regionNumber(0, 2)).toBe('IV')
  })
  it('names a region and says it in words', () => {
    expect(text(regionAst(1, 3))).toBe('A ∩ B′ ∩ C′')
    expect(regionPhrase(1, 3, ctx3.ids)).toBe('A only')
    expect(regionPhrase(3, 3, ctx3.ids)).toBe('A and B only')
    expect(regionPhrase(7, 3, ctx3.ids)).toBe('in all three')
    expect(regionPhrase(0, 3, ctx3.ids)).toBe('in none of them')
    expect(regionPhrase(3, 2, ['A', 'B'])).toBe('in both')
  })
})

describe('numbers in the regions', () => {
  const lang = { ids: ['F', 'S'], universe: 'U' }
  it('reads numbers as they’re written', () => {
    expect(parseNumber('12')).toBe(12)
    expect(parseNumber('0.35')).toBe(0.35)
    expect(parseNumber('35%')).toBe(0.35)
    expect(parseNumber('1/4')).toBe(0.25)
    expect(parseNumber('\\frac{1}{8}')).toBe(0.125)
    expect(parseNumber('x')).toBe(null)
  })

  it('works out each region of a word problem', () => {
    const s = solveFacts('|U| = 40\n|F| = 22\n|S| = 18\n|F \\cap S| = 7', lang, 2, 'counts', mask("(F ∪ S)'", lang))
    expect(s.value).toEqual([7, 15, 11, 7])
    expect(s.shadedTotal).toBe(7)
    expect(s.unknown).toBe(0)
  })

  it('works out three subjects', () => {
    const c = { ids: ['M', 'P', 'C'], universe: 'U' }
    const s = solveFacts('|U| = 100\nn(M) = 45\n|P| = 38\n|C| = 30\n|M ∩ P| = 18\n|M ∩ C| = 12\n|P ∩ C| = 10\n|M ∩ P ∩ C| = 5', c, 3, 'counts', mask('M ∖ (P ∪ C)', c))
    expect(s.value).toEqual([22, 20, 15, 13, 13, 7, 5, 5])
    expect(s.shadedTotal).toBe(20)
  })

  it('settles a total that single regions don’t: inclusion–exclusion', () => {
    const s = solveFacts('|F| = 22\n|S| = 18\n|F ∩ S| = 7', lang, 2, 'counts', mask('F ∪ S', lang))
    expect(s.value).toEqual([null, 15, 11, 7])
    expect(s.shadedTotal).toBe(33)
    expect(s.unknown).toBe(1)
    expect(s.total(mask("(F ∪ S)'", lang))).toBe(null)
  })

  it('solves conditional probabilities, which are still linear', () => {
    const r = { ids: ['R', 'L'], universe: '\\Omega' }
    const s = solveFacts('P(R) = 0.3\nP(L) = 0.25\nP(L | R) = 0.5', r, 2, 'probability', mask('R ∪ L', r))
    expect(s.value.map(v => +v.toFixed(4))).toEqual([0.6, 0.15, 0.1, 0.15])
    expect(s.shadedTotal).toBeCloseTo(0.4)
  })

  it('names facts it can’t read and facts that contradict the ones above', () => {
    const s = solveFacts('|U| = 40\n|F| = 22\n|S| = 18\n|F ∩ S| = 7\n|F ∪ S| = 30\nnonsense\n|Q| = 1', lang, 2, 'counts', 0)
    expect(s.contradictions).toEqual([4])
    expect(s.errors.map(e => e.line)).toEqual([5, 6])
    expect(s.errors[1].msg).toMatch(/no set Q/)
    expect(solveFacts('|F| = 3\n|F| = 3', lang, 2, 'counts', 0).redundant).toEqual([1])
  })

  it('puts listed members in their regions', () => {
    const p = placeMembers({ U: '1..12', A: '2, 4, 6, 8, 10, 12', B: '3, 6, 9, 12' }, ['A', 'B'])
    expect(p.region).toEqual([['1', '5', '7', '11'], ['2', '4', '8', '10'], ['3', '9'], ['6', '12']])
    expect(p.notes).toEqual([])
    expect(placeMembers({ U: '1, 2', A: '1, 3' }, ['A']).notes).toEqual(['3 is in A but not in the universe.'])
    expect(placeMembers({ A: '1..100000' }, ['A']).order).toHaveLength(MAX_MEMBERS)
  })
})
