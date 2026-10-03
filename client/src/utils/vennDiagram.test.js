import { describe, it, expect, vi } from 'vitest'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import {
  VENN_TEMPLATES, VENN_FIELDS, vennModel, analyzeVenn, drawVenn, vennSvg, vennBox, vennTikz, vennExprTex, vennSteps, vennStepAt, vennStepMarkers,
  defaultVenn, buildUp, toggleRegion, setSetCount, applyLayout, renameSet, addLayer, captionText,
} from './vennDiagram'
import { VENN_LAYOUTS, layoutGeometry, hatchSegments } from './vennGeometry'
import { applyDiagramStep } from './diagramCore'
import { generateRevealHTML, exportPDF } from './generateHTML'

const build = key => VENN_TEMPLATES.find(t => t.key === key).build()
const el = { id: 'vn1', type: 'venn', x: 10, y: 20, width: 400, height: 300, ...build('distributive'), color: '#ffffff', stepStart: 2 }

describe('the model', () => {
  it('fills in what’s missing and drops what it can’t draw', () => {
    const m = vennModel({ sets: [{ id: 'A' }, { id: 'A' }, { id: 'AB' }, { id: 'B', color: 'red' }], shapes: 'x', layers: [{ id: 'l1', expr: 'A', step: 3, until: 1 }, { id: 'bad id!' }], result: { style: 'zigzag' } })
    expect(m.sets.map(s => s.id)).toEqual(['A', 'B'])
    expect(m.sets[1].color).toMatch(/^#/)
    expect(m.shapes).toEqual(VENN_LAYOUTS[2][0].shapes)
    expect(m.layers).toEqual([{ id: 'l1', expr: 'A', style: 'fill', color: null, step: 3, until: 3, panel: 0 }])
    expect(m.result.style).toBe('fill')
    expect(vennModel({}).sets.map(s => s.id)).toEqual(['A', 'B', 'C'])
  })

  it('never has a field the canvas would apply to the element itself', () => {
    expect(VENN_FIELDS).not.toContain('scale')
    expect(VENN_FIELDS).not.toContain('rotation')
    expect(Object.keys(vennModel(el))).not.toContain('scale')
  })

  it('calls a dragged layout custom', () => {
    const shapes = VENN_LAYOUTS[3][0].shapes.map(s => ({ ...s, x: s.x + 0.5 }))
    expect(vennModel({ layout: 'classic', shapes }).layout).toBe('classic')
    expect(vennModel({ layout: 'nonsense', shapes }).layout).toBe('custom')
  })
})

describe('the regions', () => {
  it('draws all 16 regions of four sets, each in one piece', () => {
    const shapes = VENN_LAYOUTS[4][0].shapes
    const g = layoutGeometry(shapes, shapes.map(() => ({ w: 0.3, h: 0.5 })), { w: 0.3, h: 0.5 })
    expect(g.drawn).toBe(0xffff)
    expect(g.geo.regions.slice(1).every(r => r.loops.length === 1)).toBe(true)
    // The outside: the universe with a hole
    expect(g.geo.regions[0].loops).toHaveLength(2)
  })

  it('leaves out regions a layout has no room for', () => {
    const shapes = VENN_LAYOUTS[2].find(l => l.id === 'inside').shapes
    const g = layoutGeometry(shapes, [{ w: 0.3, h: 0.5 }, { w: 0.3, h: 0.5 }], null)
    // A inside B: nothing is in A but not B
    expect(g.drawn).toBe(0b1101)
  })

  it('hatches inside a shape and nowhere else', () => {
    const sq = [[[0, 0], [2, 0], [2, 2], [0, 2]]]
    const segs = hatchSegments(sq, 0, 0.5)
    expect(segs).toHaveLength(4)
    for (const [p, q] of segs) { expect(p[0]).toBeCloseTo(0); expect(q[0]).toBeCloseTo(2) }
    // A hole, even-odd
    const ring = [...sq, [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]]]
    expect(hatchSegments(ring, 0, 0.5).length).toBe(6)
  })
})

describe('drawing', () => {
  it('draws every template, with no NaN', () => {
    for (const t of VENN_TEMPLATES) {
      for (const labels of ['text', 'deck']) {
        const svg = vennSvg({ ...t.build(), color: '#ffffff' }, { labels })
        expect(svg).toMatch(/^<svg /)
        expect(svg).not.toMatch(/NaN|undefined|Infinity/)
      }
    }
  })

  it('escapes labels, captions and members', () => {
    const e = { ...build('members'), sets: [{ id: 'A', label: '<img src=x>' }, { id: 'B', label: '"><script>' }], captions: { 0: '<u>x</u> $<b>$' }, members: { A: '<i>1</i>', U: '<i>1</i>' } }
    for (const labels of ['text', 'deck']) expect(vennSvg(e, { labels })).not.toMatch(/<img|<script|<u>|<b>|<i>1/)
  })

  it('shades what the expression names, with hatching as lines', () => {
    const m = vennModel(el)
    const a = analyzeVenn(m)
    expect(a.masks[0]).toBe(0b10101000)
    // At step 1, B and C are hatched
    const s1 = drawVenn(m, { a, step: 1 }).svg
    expect(s1.match(/stroke-linecap="round" fill="none"/g)).toHaveLength(2)
    expect(s1).not.toContain('fill-opacity="0.45"')
    // At the end, the answer is filled in
    expect(drawVenn(m, { a }).svg).toContain('fill-opacity="0.45"')
  })

  it('draws both sides of a relation and whether it holds', () => {
    const d = vennModel(build('demorgan'))
    const a = analyzeVenn(d)
    expect(a.verdict).toMatchObject({ holds: true, short: 'Equal' })
    expect(drawVenn(d, { a }).svg).toContain('✓ Equal')
    const wrong = vennModel({ ...build('demorgan'), expr: "(A \\cup B)' = A' \\cup B'" })
    expect(analyzeVenn(wrong).verdict.text).toBe('A ∩ B′ and A′ ∩ B are shaded only on the right.')
    // A layout that leaves a region out counts it as empty
    const euler = analyzeVenn(vennModel(build('euler')))
    expect(euler.verdict.holds).toBe(true)
    expect(euler.verdict.layoutNote).toMatch(/no room for A ∩ B′/)
  })

  it('writes counts, probabilities and members in their regions', () => {
    const svg = vennSvg(build('subjects'))
    for (const v of ['>20<', '>13<', '>22<', '>5<']) expect(svg).toContain(v)
    expect(vennSvg(build('probability'))).toContain('>0.6<')
    expect(vennSvg(build('members'), { labels: 'text' })).toContain('>3, 9<')
  })

  it('sizes the element to the diagram, its captions and both sides', () => {
    const b = vennBox(el), nocaps = vennBox({ ...el, captions: {} })
    expect(b.h).toBeGreaterThan(nocaps.h)
    const one = vennBox({ ...build('blank'), expr: 'A' }), two = vennBox({ ...build('blank'), expr: 'A = B' })
    expect(two.w).toBeGreaterThan(one.w * 1.8)
  })

  it('writes captions with their maths as text for PowerPoint', () => {
    expect(captionText('So $A \\cup B$ is everything.')).toBe('So A ∪ B is everything.')
  })
})

describe('steps', () => {
  it('counts when layers come and go, the answer and captions, from stepStart', () => {
    expect(vennSteps(el)).toEqual([[2, 1], [3, 2], [4, 3], [5, 4]])
    expect(vennStepAt(el, 3)).toBe(2)
    expect(vennStepAt(el, 1)).toBe(0)
    expect(vennStepMarkers({ elements: [el] }).match(/data-fx-step="vn1"/g)).toHaveLength(4)
    // Numbers revealed inside out: a step per ring
    expect(vennSteps({ type: 'venn', ...build('subjects') }).map(([, s]) => s)).toEqual([1, 2, 3, 4, 5])
  })

  it('has a deck drawing that shows each step’s shading', async () => {
    const { Window } = await import('happy-dom')
    const win = new Window()
    win.document.body.innerHTML = vennSvg(el, { deck: 'vn1', labels: 'deck' })
    const root = win.document.body.firstElementChild
    // A part that's on, and not gone (its data-fx-in range over)
    const shown = () => [...root.querySelectorAll('.pxfx-part')].filter(p => !p.classList.contains('pxfx-off') && !p.querySelector('[data-fx-in].pxfx-off')).length
    applyDiagramStep(root, 0, false, false)
    expect(shown()).toBe(0)
    applyDiagramStep(root, 1, true, false)
    expect(shown()).toBe(2)
    expect(root.querySelector('.pxfx-new .pxvn-in')).not.toBe(null)
    // B and C go when B ∪ C is filled in
    applyDiagramStep(root, 2, true, false)
    expect(shown()).toBe(1)
    applyDiagramStep(root, 4, true, false)
    expect(shown()).toBe(1)
    expect([...root.querySelectorAll('[data-fx-cap]')].filter(c => !c.classList.contains('pxfx-off')).map(c => c.getAttribute('data-fx-cap'))).toEqual(['4'])
  })

  it('in a deck: the element, its steps and the shared script', () => {
    const html = generateRevealHTML({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [el] }] })
    expect(html).toMatch(/<div data-fx="vn1" data-fx-dim="0" style="position:absolute;left:10px;top:20px;[^"]*overflow:visible;[^"]*"><svg /)
    for (const n of [2, 3, 4, 5]) expect(html).toContain(`data-fragment-index="${n}" data-fx-step="vn1"`)
    expect(html).toContain("querySelectorAll('[data-fx]')")
  })

  it('prints a page per step', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [el] }] })
      const html = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
      expect([...html.matchAll(/data-vn-at-page="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '1', '2', '3', '4'])
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})

describe('TikZ', () => {
  it('clips each term of the cover, and the outside of a set with the even-odd rule', () => {
    const tikz = vennTikz({ ...build('blank'), expr: 'A \\setminus (B \\cup C)' })
    expect(tikz).toContain('\\def\\setA{(-0.9,0.52) circle [radius=1.5]}')
    expect(tikz).toContain('\\begin{scope}[even odd rule]\n    \\clip \\setA;\n    \\clip \\universe \\setB;\n    \\clip \\universe \\setC;\n    \\fill[vennShade!45] \\universe;\n  \\end{scope}')
    expect(tikz).not.toContain('patterns')
  })

  it('draws the last step, or every step with Beamer', () => {
    const plain = vennTikz(el), beamer = vennTikz(el, { beamer: true })
    expect(plain).not.toContain('pattern=')
    expect(plain).not.toContain('\\only')
    expect(beamer).toContain('\\usetikzlibrary{patterns}')
    expect(beamer).toContain('\\only<2-2>{')
    expect(beamer).toContain('\\only<5->{')
  })

  it('writes ellipses, both sides and the expression', () => {
    expect(vennTikz(build('odd'))).toContain('ellipse [x radius=2.4, y radius=1.56, rotate=-50]')
    expect(vennTikz(build('demorgan'))).toContain('[xshift=')
    expect(vennTikz({ expr: 'A ∪' })).toMatch(/^% Fix the expression/)
    expect(vennExprTex({ ...build('blank'), expr: 'A ∪ B ∩ C', notation: { complement: 'c' } })).toBe('A \\cup (B \\cap C)')
  })
})

describe('Build It Up', () => {
  it('hatches each operation’s two sides, then fills in its result', () => {
    const m = vennModel({ ...build('blank'), expr: 'A \\cap (B \\cup C)' })
    buildUp(m, 'every')
    expect(m.layers.map(l => [l.expr, l.style, l.step, l.until])).toEqual([
      ['B', 'hatch-ne', 1, 1], ['C', 'hatch-nw', 1, 1], ['B \\cup C', 'fill', 2, 2], ['A', 'hatch-ne', 3, 3], ['B \\cup C', 'hatch-nw', 3, 3],
    ])
    expect(m.result.steps[0]).toBe(4)
    expect(captionText(m.captions[2])).toBe('B ∪ C is everything in B or C, or both.')
    // Remembering what they were built for, to say when the expression has moved on
    expect(analyzeVenn(m).staleBuild).toBe(false)
    m.expr = 'A \\cup B'
    expect(analyzeVenn(m).staleBuild).toBe(true)
    expect(vennModel(m).builtFrom).toBe('A \\cap (B \\cup C)')
  })

  it('builds the left side, the right, then the verdict', () => {
    const m = vennModel(build('demorgan'))
    expect(m.result.steps).toEqual([3, 5])
    expect(m.verdict.step).toBe(6)
    expect(m.layers.filter(l => l.panel === 1).map(l => l.expr)).toEqual(["A'", "B'"])
    const short = vennModel({ ...build('blank'), expr: 'A = B' })
    buildUp(short, 'sides')
    expect([short.result.steps, short.verdict.step]).toEqual([[1, 2], 3])
  })
})

describe('the editor’s changes', () => {
  it('rewrites the expression when a region is clicked, in its own syntax', () => {
    const m = vennModel({ ...build('blank'), expr: '(A ∖ C) ∪ (B ∖ C) ∪ (A ∩ B ∩ C)' })
    toggleRegion(m, analyzeVenn(m), 0, 7)   // A ∩ B ∩ C
    expect(m.expr).toBe('(A ∪ B) ∖ C')
    const t = vennModel({ ...build('blank'), expr: 'A \\cap B \\cap C' })
    toggleRegion(t, analyzeVenn(t), 0, 3)   // A ∩ B ∩ C′
    expect(t.expr).toBe('A \\cap B')
    // One side of a relation, keeping the other as written
    const r = vennModel({ ...build('blank'), expr: 'A = A \\cup B' })
    toggleRegion(r, analyzeVenn(r), 1, 2)
    expect(r.expr).toBe('A = A \\cup (B \\cap C)')
  })

  it('changes the number of sets and the layout', () => {
    const m = vennModel(build('blank'))
    m.expr = 'A \\cup B'
    setSetCount(m, 2)
    expect([m.sets.length, m.shapes.length, m.expr]).toEqual([2, 2, 'A \\cup B'])
    m.expr = 'A \\cup B'
    setSetCount(m, 4)
    expect(m.sets.map(s => s.id)).toEqual(['A', 'B', 'C', 'D'])
    applyLayout(m, 'nope')
    expect(m.layout).toBe('ellipses')
    const one = vennModel(build('blank'))
    one.expr = 'C'
    setSetCount(one, 1)
    expect(one.expr).toBe("A'")
  })

  it('renames a set everywhere it’s used', () => {
    const m = vennModel({ ...build('blank'), expr: 'AB \\cap C', facts: ['|A ∩ B| = 3'], members: { A: '1, 2' }, layers: [{ id: 'l1', expr: "A'" }] })
    expect(renameSet(m, 0, 'F')).toBe(null)
    expect(m.expr).toBe('FB \\cap C')
    expect(m.facts).toEqual(['|F ∩ B| = 3'])
    expect(m.members).toEqual({ F: '1, 2' })
    expect(m.layers[0].expr).toBe("F'")
    expect(m.sets[0]).toMatchObject({ id: 'F', label: 'F' })
    expect(renameSet(m, 1, 'C')).toMatch(/already C/)
    expect(renameSet(m, 1, 'U')).toMatch(/universe/)
    expect(renameSet(m, 1, 'xy')).toMatch(/one letter/)
  })

  it('adds a layer after everything else', () => {
    const m = vennModel(el)
    expect(addLayer(m, analyzeVenn(m))).toMatchObject({ id: 'l6', step: 5, style: 'outline' })
  })

  it('starts a new diagram from the first template in the slide’s color', () => {
    expect(defaultVenn(false)).toMatchObject({ color: '#1a1a1a', stepStart: 1, expr: 'A \\cap (B \\cup C)' })
    expect(defaultVenn(true).layers).toHaveLength(5)
  })
})
