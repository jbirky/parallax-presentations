import { describe, it, expect, vi } from 'vitest'
import { writeFileSync } from 'fs'
import katex from 'katex'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import {
  parseLatex, pickSource, termIdsIn, badTermIds, selectionBetween, selectionOf, growSelection, selectionRange, selectionHolds,
  selectedTerm, canWrap, selectionForRange, wrapAsTerm, unwrapTerm, newTermId, syncTerms, sentenceParts, linkPhrase,
  unlinkTerm, equationConfig, equationSteps, equationStepMarkers, equationConfigAttr, defaultEquation, EQUATION_COLORS,
  equationDeckScript, equationPrintScript,
} from './equationTerms'
import { generateRevealHTML, exportPDF } from './generateHTML'

const OPTS = {
  displayMode: true,
  throwOnError: true,
  trust: ctx => ctx.command === '\\htmlData',
  strict: code => (code === 'htmlExtension' ? 'ignore' : 'warn'),
  macros: { '\\term': '\\htmlData{term=#1}{#2}' },
}
const render = src => katex.renderToString(src, { ...OPTS, macros: { ...OPTS.macros } })

const EQUATIONS = [
  String.raw`\rho\left(\frac{\partial \mathbf{u}}{\partial t} + (\mathbf{u}\cdot\nabla)\,\mathbf{u}\right) = -\nabla p + \mu\,\nabla^{2}\mathbf{u} + \mathbf{f}`,
  String.raw`K = \left(\frac{2\pi G}{P}\right)^{1/3}\,\frac{m_p \sin i}{\left(M_\star + m_p\right)^{2/3}}\,\frac{1}{\sqrt{1-e^{2}}}`,
  String.raw`\sum\limits_{i=1}^{n} x_i^2 = \int_0^\infty e^{-x^2}\,dx`,
  String.raw`\begin{aligned} f(x) &= x^2 + 3x + 2 \\ &= (x+1)(x+2) \end{aligned}`,
  String.raw`\frac12 + x^2 + f'(x) + \sqrt[3]{y} + \text{if } x > 0`,
  String.raw`\hat{H}\psi = E\psi, \quad \operatorname{tr}(A) = \mathbb{E}[X]`,
  String.raw`\binom{n}{k} \color{red} a + \overbrace{a+b}^{\text{sum}} + \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}`,
  defaultEquation(true).latex,
]

const atomText = (tree, a) => tree.src.slice(a.start, a.end)
const find = (tree, text) => tree.atoms.find(a => atomText(tree, a) === text)

describe('parseLatex', () => {
  it('cuts the source into atoms with the lists inside them', () => {
    const tree = parseLatex(String.raw`\frac{a+b}{c} = x^{2}`)
    expect(tree.root.atoms.map(a => atomText(tree, a))).toEqual([String.raw`\frac{a+b}{c}`, '=', 'x^{2}'])
    const frac = tree.root.atoms[0]
    expect(frac.lists.map(l => l.atoms.map(a => atomText(tree, a)))).toEqual([['a', '+', 'b'], ['c']])
    const pow = tree.root.atoms[2]
    expect(pow.kind).toBe('scripts')
    expect(pow.lists.map(l => [l.braced, l.atoms.map(a => atomText(tree, a))])).toEqual([[false, ['x']], [true, ['2']]])
  })

  it('reads terms, left-right pairs, environments and text', () => {
    const tree = parseLatex(String.raw`\term{t1}{a + b} \left( c \right) \begin{aligned} d &= e \\ f \end{aligned} \text{if x}`)
    const [term, lr, env, text] = tree.root.atoms
    expect(term).toMatchObject({ kind: 'term', term: 't1' })
    expect(atomText(tree, { start: term.body.start, end: term.body.end })).toBe('a + b')
    expect(lr.kind).toBe('leftright')
    expect(atomText(tree, lr)).toBe(String.raw`\left( c \right)`)
    expect(env.kind).toBe('env')
    expect(env.lists.map(l => l.atoms.map(a => atomText(tree, a)))).toEqual([['d'], ['=', 'e'], ['f']])
    expect(text.lists).toEqual([])
  })

  it("doesn't pick a big operator apart from its limits", () => {
    const tree = parseLatex(String.raw`\sum\limits_{i=1}^{n} x`)
    const sum = tree.root.atoms[0]
    expect(atomText(tree, sum)).toBe(String.raw`\sum\limits_{i=1}^{n}`)
    expect(sum.lists.map(l => l.atoms.map(a => atomText(tree, a)))).toEqual([['i', '=', '1'], ['n']])
  })

  it('keeps going through unbalanced or odd input', () => {
    for (const src of ['}', '{', '\\frac{', 'x^', '\\left(', '\\begin{aligned}', '&', '\\\\', '\\', 'a}b{c']) {
      expect(() => parseLatex(src)).not.toThrow()
    }
  })
})

describe('pickSource', () => {
  it('draws every equation the same way with each atom marked', () => {
    for (const src of EQUATIONS) {
      const { source, atoms } = pickSource(parseLatex(src))
      expect(atoms.length).toBeGreaterThan(3)
      const html = render(source)
      expect(html).not.toContain('katex-error')
      expect((html.match(/data-pk="/g) || []).length).toBe(atoms.length)
      // The same glyphs as without the markers
      const glyphs = h => h.replace(/<span class="katex-mathml">[\s\S]*?<\/math><\/span>/, '').replace(/<[^>]+>/g, '')
      expect(glyphs(html)).toBe(glyphs(render(src)))
    }
  })
})

describe('selection', () => {
  const tree = parseLatex(String.raw`y = \frac{m_p \sin i}{(M + m)^{2/3}} + c`)
  const m = tree.atoms.find(a => atomText(tree, a) === 'm' && a.parent.parent?.kind === 'scripts')
  const M = find(tree, 'M')

  it('takes the atoms side by side in the deepest list holding both', () => {
    const sel = selectionBetween(find(tree, 'y'), find(tree, '='))
    expect(selectionRange(sel)).toEqual({ start: 0, end: 3 })
    // Numerator to denominator: the fraction
    const frac = selectionBetween(m, M)
    expect(tree.src.slice(selectionRange(frac).start, selectionRange(frac).end)).toBe(String.raw`\frac{m_p \sin i}{(M + m)^{2/3}}`)
    expect(selectionHolds(frac, M)).toBe(true)
    expect(selectionHolds(frac, find(tree, 'c'))).toBe(false)
  })

  it('grows to the whole list, then the atom around it', () => {
    let sel = selectionOf(find(tree, 'i'))
    const text = () => tree.src.slice(selectionRange(sel).start, selectionRange(sel).end)
    sel = growSelection(sel)
    expect(text()).toBe(String.raw`m_p \sin i`)
    sel = growSelection(sel)
    expect(text()).toBe(String.raw`\frac{m_p \sin i}{(M + m)^{2/3}}`)
    sel = growSelection(sel)
    expect(text()).toBe(tree.src)
    expect(growSelection(sel)).toBe(sel)
  })

  it('maps a stretch of the source to atoms', () => {
    const at = (s, e) => { const sel = selectionForRange(tree, s, e); return tree.src.slice(selectionRange(sel).start, selectionRange(sel).end) }
    const i = tree.src.indexOf('m_p')
    expect(at(i, i + 3)).toBe('m_p')
    expect(at(i, i + 8)).toBe(String.raw`m_p \sin`)
    expect(at(i + 1, tree.src.indexOf('M'))).toBe(String.raw`\frac{m_p \sin i}{(M + m)^{2/3}}`)
    expect(selectionForRange(tree, 1, 2)).toBe(null)
  })

  it('knows a selected term', () => {
    const t = parseLatex(String.raw`a + \term{t1}{b + c}`)
    expect(selectedTerm(selectionOf(t.root.atoms[2]))).toBe('t1')
    expect(selectedTerm(growSelection(selectionOf(find(t, 'b'))))).toBe('t1')
    expect(selectedTerm(selectionOf(find(t, 'b')))).toBe(null)
  })

  it("won't wrap structure on its own", () => {
    const t = parseLatex(String.raw`a \over b`)
    expect(canWrap(selectionOf(t.root.atoms[1]))).toBe(false)
    expect(canWrap(selectionOf(t.root.atoms[0]))).toBe(true)
  })
})

describe('changing the source', () => {
  it('wraps a selection as a term, with braces where it was a lone token', () => {
    const src = String.raw`x^2 + \frac12`
    const tree = parseLatex(src)
    const two = tree.atoms.find(a => atomText(tree, a) === '2' && a.parent.parent.kind === 'scripts')
    const out = wrapAsTerm(src, selectionOf(two), 't1')
    expect(out).toBe(String.raw`x^{\term{t1}{2}} + \frac12`)
    const half = parseLatex(out).atoms.find(a => a.kind === 'cmd' && a.name === 'frac')
    const one = half.lists[0].atoms[0]
    const out2 = wrapAsTerm(out, selectionOf(one), 't2')
    expect(out2).toBe(String.raw`x^{\term{t1}{2}} + \frac{\term{t2}{1}}2`)
    expect(render(out2)).toContain('data-term="t2"')
    expect(termIdsIn(out2)).toEqual(['t1', 't2'])
  })

  it('unwraps every place a term is', () => {
    const src = String.raw`\term{a}{x} + \term{b}{\term{a}{y}^2}`
    expect(unwrapTerm(src, 'a')).toBe(String.raw`x + \term{b}{y^2}`)
    expect(unwrapTerm(src, 'b')).toBe(String.raw`\term{a}{x} + \term{a}{y}^2`)
  })

  it('makes ids that are free, and spots bad ones', () => {
    expect(newTermId(String.raw`\term{t1}{a}\term{t3}{b}`, [{ id: 't2' }])).toBe('t4')
    expect(badTermIds(String.raw`\term{1x}{a}\term{ok}{b}\term{a b}{c}`)).toEqual(['1x', 'a b'])
  })

  it('keeps the terms list in step with the source', () => {
    const colors = EQUATION_COLORS.dark
    const terms = [{ id: 't2', label: 'B', note: '', color: colors[0] }, { id: 'gone', label: 'G', note: '', color: colors[1] }]
    const cache = new Map([['t3', { id: 't3', label: 'Remembered', note: '', color: '#123456' }]])
    const out = syncTerms(String.raw`\term{t1}{a} + \term{t2}{b} + \term{t3}{c}`, terms, colors, cache)
    expect(out.map(t => [t.id, t.label, t.color])).toEqual([['t2', 'B', colors[0]], ['t1', '', colors[1]], ['t3', 'Remembered', '#123456']])
  })
})

describe('sentence', () => {
  it('splits phrases from text', () => {
    expect(sentenceParts('A [b c](t1) and [d](t2).')).toEqual([{ text: 'A ' }, { text: 'b c', id: 't1' }, { text: ' and ' }, { text: 'd', id: 't2' }, { text: '.' }])
  })
  it('links, relinks and unlinks phrases', () => {
    expect(linkPhrase('the prior belief', 4, 9, 't3')).toBe('the [prior](t3) belief')
    expect(linkPhrase('the [prior](t3) belief', 6, 8, 't1')).toBe('the [prior](t1) belief')
    expect(unlinkTerm('the [prior](t3) [x](t1)', 't3')).toBe('the prior [x](t1)')
  })
})

describe('config and steps', () => {
  const el = {
    id: 'eq1', type: 'equation', latex: String.raw`\term{t1}{a} + \term{t2}{b} + \term{t3}{c}`,
    terms: [{ id: 't2', label: 'Second', note: 'n', color: '#ff0000' }, { id: 't1', label: 'First', color: 'red; x' }, { id: 'nope', label: 'x' }],
    stepStart: 3, textColor: '#111111', labelStyle: 'nonsense', fontSize: 'big',
  }
  it('keeps checked values only, in the element order, then the source order', () => {
    const cfg = equationConfig(el)
    expect(cfg.terms.map(t => t.id)).toEqual(['t2', 't1', 't3'])
    expect(cfg.terms[0].color).toBe('#ff0000')
    expect(EQUATION_COLORS.light).toContain(cfg.terms[1].color) // dark text: colors for a light slide
    expect(cfg).toMatchObject({ labelStyle: 'callout', interaction: 'steps', stepStart: 3, showAll: true, fontSize: 44 })
  })
  it('steps through the terms, then all of them', () => {
    expect(equationSteps(el)).toEqual([[3, 0], [4, 1], [5, 2], [6, 'all']])
    expect(equationSteps({ ...el, showAll: false })).toEqual([[3, 0], [4, 1], [5, 2]])
    expect(equationSteps({ ...el, interaction: 'hover' })).toEqual([])
    const markers = equationStepMarkers({ elements: [el, { id: 'x', type: 'text' }] })
    expect(markers.match(/data-eq-step="eq1"/g)).toHaveLength(4)
    expect(markers).toContain('data-fragment-index="6"')
  })
  it('escapes the config for an attribute', () => {
    const attr = equationConfigAttr({ ...el, terms: [{ id: 't1', label: '"</script><b>&' }] })
    expect(attr).not.toMatch(/["<>]/)
    const parsed = JSON.parse(attr.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
    expect(parsed.terms[0].label).toBe('"</script><b>&')
  })
  it('has page scripts that parse', () => {
    for (const code of [equationDeckScript(), equationPrintScript()]) {
      expect(() => new Function(code)).not.toThrow()
      expect(code).not.toMatch(/<\/script|<!--/i)
    }
  })
})

describe('in a deck', () => {
  const eq = { id: 'eq1', type: 'equation', x: 10, y: 20, width: 700, height: 300, ...defaultEquation(true), stepStart: 2 }
  const deck = { id: 'p', title: 'T', slides: [{ id: 's1', elements: [eq, { id: 'f', type: 'text', x: 0, y: 0, width: 10, height: 10, content: '<p>x</p>', fragment: true, fragmentIndex: 1 }] }] }

  it('draws the equation from its config, with a hidden fragment per step', () => {
    const html = generateRevealHTML(deck)
    expect(html).toMatch(/<div data-eq="eq1" data-eq-config="[^"]+" style="position:absolute;left:10px;top:20px;[^"]*overflow:visible;"><\/div>/)
    for (const n of [2, 3, 4, 5, 6]) expect(html).toContain(`data-eq-step="eq1" data-eq-step-at="${n}"`)
    expect(html).toContain("querySelectorAll('[data-eq-config]')")
    expect(generateRevealHTML({ ...deck, slides: [{ id: 's1', elements: [] }] })).not.toContain('data-eq-config')
  })

  it('prints a page per step, each equation as it is then', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF(deck)
      const html = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
      // Before any step, after the fragment (1), then steps 2 to 6
      expect([...html.matchAll(/data-eq-at="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '1', '2', '3', '4', '5', '6'])
      expect(html).toContain("eq.step(+at || 0)")
      if (process.env.EQ_PRINT_OUT) writeFileSync(process.env.EQ_PRINT_OUT, html)
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})
