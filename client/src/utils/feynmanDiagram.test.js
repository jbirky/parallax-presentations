import { describe, it, expect, vi } from 'vitest'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import {
  FEYNMAN_TEMPLATES, FEYNMAN_TYPES, feynmanModel, lineGeometry, wavePoints, coilPoints, basePoints, vertexMap,
  flowWarnings, drawDiagram, feynmanSvg, feynmanBox, feynmanTikz, feynmanSteps, feynmanStepAt, feynmanStepMarkers,
  feynmanDeckScript, applyFeynmanStep, texRuns, defaultFeynman, addVertex, addLine, splitLine, reverseLine,
  mergeDropped, removeParts, mirrorDiagram, rotateDiagram, stepsByTime, vertexStep,
} from './feynmanDiagram'
import { generateRevealHTML, exportPDF } from './generateHTML'

const line = (A, B, extra = {}) => {
  const V = { a: { id: 'a', ...A }, b: { id: 'b', ...B } }
  return lineGeometry(V, { from: 'a', to: 'b', bend: 0, ...extra })
}
const near = (p, q, eps = 1e-6) => Math.hypot(p[0] - q[0], p[1] - q[1]) < eps

describe('geometry', () => {
  it('runs a straight line from end to end', () => {
    const g = line({ x: 0, y: 0 }, { x: 3, y: 4 })
    expect(g.len).toBeCloseTo(5)
    expect(near(g.at(0), [0, 0])).toBe(true)
    expect(near(g.at(1), [3, 4])).toBe(true)
  })

  it('bends a line to its left for a positive bend, and a bend of 1 is a semicircle', () => {
    const g = line({ x: 0, y: 0 }, { x: 2, y: 0 }, { bend: 1 })
    expect(g.len).toBeCloseTo(Math.PI)
    expect(near(g.at(0.5), [1, 1])).toBe(true)
    expect(near(g.at(1), [2, 0])).toBe(true)
    expect(line({ x: 0, y: 0 }, { x: 2, y: 0 }, { bend: -0.5 }).at(0.5)[1]).toBeCloseTo(-0.5)
    // More than a semicircle still ends on its vertex
    const big = line({ x: 0, y: 0 }, { x: 2, y: 0 }, { bend: 1.5 })
    expect(near(big.at(1), [2, 0])).toBe(true)
    expect(big.at(0.5)[1]).toBeCloseTo(1.5)
  })

  it('draws a loop through its vertex', () => {
    const V = { a: { id: 'a', x: 1, y: 1 } }
    const g = lineGeometry(V, { from: 'a', to: 'a', loopAngle: 90, loopSize: 2 })
    expect(near(g.at(0), [1, 1])).toBe(true)
    expect(near(g.at(0.5), [1, 3])).toBe(true)
  })

  it('ends wavy and curly lines exactly on their vertices', () => {
    for (const extra of [{}, { bend: 0.7 }, { bend: -1.2 }]) {
      for (const [A, B] of [[{ x: 0, y: 0 }, { x: 2.37, y: 0.4 }], [{ x: 1, y: 1 }, { x: 1, y: -2 }]]) {
        const g = line(A, B, extra)
        for (const pts of [wavePoints(g), coilPoints(g)]) {
          expect(near(pts[0], [A.x, A.y], 1e-9)).toBe(true)
          expect(near(pts[pts.length - 1], [B.x, B.y], 1e-9)).toBe(true)
        }
      }
    }
  })

  it('keeps an arc on its circle when it is split', () => {
    const m = { vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 4, y: 0 }], edges: [{ id: 'e', from: 'a', to: 'b', particle: 'photon', bend: 1, label: 'q', momentum: '' }], captions: {} }
    const mid = lineGeometry(vertexMap(m), m.edges[0]).at(0.3)
    const vid = splitLine(m, 'e', 0.3)
    const v = m.vertices.find(x => x.id === vid)
    expect(near([v.x, v.y], mid, 0.01)).toBe(true)
    expect(m.edges.map(e => [e.from, e.to])).toEqual([['a', vid], [vid, 'b']])
    // Both pieces bulge through the old arc's top, (2, 2)
    const V = vertexMap(m)
    const second = lineGeometry(V, m.edges[1])
    const top = basePoints(second).reduce((best, p) => (p[1] > best[1] ? p : best))
    expect(top[1]).toBeCloseTo(2, 1)
    // The label stays on the longer piece
    expect(m.edges.map(e => e.label)).toEqual(['', 'q'])
  })
})

describe('the model', () => {
  it('drops what it cannot draw', () => {
    const m = feynmanModel({
      vertices: [{ id: 'a', x: 0, y: 0 }, { id: 'a', x: 1, y: 1 }, { id: 'bad id"', x: 0, y: 0 }, { id: 'b', x: 1e9, y: 'x', kind: 'sparkle', color: 'red' }],
      edges: [{ id: 'e1', from: 'a', to: 'b', particle: 'tachyon', bend: 9 }, { id: 'e2', from: 'a', to: 'nowhere' }, { id: 'e3', from: 'b', to: 'b', loopSize: 100 }],
      captions: { 1: 'one', x: 'no', 2: '  ', 3: 4 }, color: 'url(#x)', stepStart: -3,
    })
    expect(m.vertices.map(v => v.id)).toEqual(['a', 'b'])
    expect(m.vertices[1]).toMatchObject({ x: 1000, y: 0, kind: 'auto', color: null })
    expect(m.edges.map(e => e.id)).toEqual(['e1', 'e3'])
    expect(m.edges[0]).toMatchObject({ particle: 'plain', bend: 1.6 })
    expect(m.edges[1]).toMatchObject({ loopAngle: 90, loopSize: 6 })
    expect(m.captions).toEqual({ 1: 'one' })
    expect(m.color).toBe('#ffffff')
    expect(m.stepStart).toBe(1)
  })

  it('escapes labels and captions in the drawing', () => {
    const el = { vertices: [{ id: 'a', x: 0, y: 0, label: '<img src=x onerror=alert(1)>' }, { id: 'b', x: 2, y: 0 }], edges: [{ id: 'e', from: 'a', to: 'b', particle: 'fermion', label: '"><script>' }], captions: { 0: '<b>hi</b>' } }
    for (const labels of ['text', 'deck']) {
      const svg = feynmanSvg(el, { labels })
      expect(svg).not.toMatch(/<img|<script|<b>/)
    }
  })
})

describe('the templates', () => {
  it('have fermion arrows that flow through every vertex', () => {
    for (const t of FEYNMAN_TEMPLATES) expect(flowWarnings(t.build()), t.key).toEqual([])
  })

  it('warn where a fermion line is reversed', () => {
    const m = FEYNMAN_TEMPLATES.find(t => t.key === 'ee').build()
    reverseLine(m.edges[0])
    expect(flowWarnings(m)).toEqual(['a'])
  })

  it('draw every line style', () => {
    const m = FEYNMAN_TEMPLATES.find(t => t.key === 'blank').build()
    Object.keys(FEYNMAN_TYPES).forEach((type, i) => {
      const a = addVertex(m, 0, i), b = addVertex(m, 2, i)
      addLine(m, a, b, type)
    })
    const { svg } = drawDiagram(m, { ink: '#fff' })
    expect(svg.match(/<path /g).length).toBeGreaterThan(Object.keys(FEYNMAN_TYPES).length)
    expect(svg).toContain('stroke-dasharray')
  })
})

describe('labels', () => {
  it('reads the TeX of particle names', () => {
    expect(texRuns('e^-')).toEqual([{ t: 'e', lvl: 0, it: true }, { t: '−', lvl: 1, it: false }])
    expect(texRuns('\\gamma')).toEqual([{ t: 'γ', lvl: 0, it: true }])
    expect(texRuns('W^{\\pm}').map(r => r.t)).toEqual(['W', '±'])
    const nu = texRuns('\\bar{\\nu}_e')
    expect(nu[0].t).toBe('ν' + String.fromCharCode(0x304))
    expect(nu[1]).toEqual({ t: 'e', lvl: -1, it: true })
  })

  it('leaves math for the page’s KaTeX in a deck', () => {
    const svg = feynmanSvg(defaultFeynman(true), { labels: 'deck' })
    expect(svg).toContain('data-math-latex="\\mu^-"')
    expect(svg).toContain('<foreignObject')
  })
})

describe('TikZ-Feynman', () => {
  it('writes every vertex at its position and every line in its style', () => {
    const tikz = feynmanTikz(defaultFeynman(true))
    expect(tikz).toContain('\\begin{feynman}')
    expect(tikz).toContain('\\vertex (i1) at (0, 2) {\\(e^-\\)};')
    expect(tikz).toContain('\\vertex[dot] (a) at (1.5, 1) {};')
    expect(tikz).toContain("(a) -- [photon, edge label=\\(\\gamma\\), momentum'=\\(q\\)] (b)")
    expect(tikz).toContain('(f2) -- [fermion] (b)')
    expect(tikz.trim().endsWith('\\end{tikzpicture}')).toBe(true)
  })

  it('writes bends, semicircles, loops, vertex styles and colors', () => {
    const el = {
      vertices: [{ id: 'a', x: 0, y: 0, kind: 'blob' }, { id: 'b', x: 2, y: 0, label: 'x', labelAt: 'below' }],
      edges: [
        { id: 'e1', from: 'a', to: 'b', particle: 'gluon', bend: 1 },
        { id: 'e2', from: 'a', to: 'b', particle: 'scalar', bend: -0.4142 },
        { id: 'e3', from: 'b', to: 'b', particle: 'photon', loopAngle: 90, loopSize: 1.2, color: '#ff0000' },
      ],
    }
    const tikz = feynmanTikz(el)
    expect(tikz).toContain('\\vertex[blob] (a) at (0, 0) {};')
    // Three line ends meet at b, so it has a dot
    expect(tikz).toContain('\\vertex[dot, label={below:\\(x\\)}] (b) at (2, 0) {};')
    expect(tikz).toContain('(a) -- [gluon, half left] (b)')
    expect(tikz).toContain('(a) -- [scalar, bend right=45] (b)')
    expect(tikz).toContain('(b) -- [photon, out=135, in=45, loop, min distance=1.2cm, color={rgb,255:red,255;green,0;blue,0}] (b)')
  })
})

describe('editing', () => {
  it('bends a second line between the same vertices away from the first', () => {
    const m = { vertices: [], edges: [], captions: {} }
    const a = addVertex(m, 0, 0), b = addVertex(m, 2, 0)
    addLine(m, a, b, 'fermion')
    expect(addLine(m, b, a, 'fermion').bend).toBe(0.8)
    // The same bend from the other end: the mirror image of the second
    expect(addLine(m, a, b, 'photon').bend).toBe(0.8)
    expect(addLine(m, a, b, 'scalar').bend).toBe(1.4)
  })

  it('merges a vertex dropped on another', () => {
    const m = FEYNMAN_TEMPLATES.find(t => t.key === 'ee').build()
    const f1 = m.vertices.find(v => v.id === 'f1')
    f1.x = 5.1; f1.y = 0.05
    expect(mergeDropped(m, 'f1')).toBe('f2')
    expect(m.vertices.some(v => v.id === 'f1')).toBe(false)
    expect(m.edges.filter(e => e.from === 'f2' || e.to === 'f2')).toHaveLength(2)
  })

  it('removes a vertex with its lines and the vertices left alone', () => {
    const m = FEYNMAN_TEMPLATES.find(t => t.key === 'ee').build()
    removeParts(m, { kind: 'v', id: 'b' })
    expect(m.vertices.map(v => v.id).sort()).toEqual(['a', 'i1', 'i2'])
    expect(m.edges).toHaveLength(2)
  })

  it('mirrors and rotates about the diagram’s middle, keeping its shape', () => {
    const m = FEYNMAN_TEMPLATES.find(t => t.key === 'self').build()
    mirrorDiagram(m)
    expect(m.vertices.find(v => v.id === 'i').x).toBe(5)
    // The photon still bulges upward
    expect(lineGeometry(vertexMap(m), m.edges[3]).at(0.5)[1]).toBeGreaterThan(0.5)
    rotateDiagram(m)
    const xs = m.vertices.map(v => v.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0)
  })

  it('numbers steps by time, left to right', () => {
    const m = FEYNMAN_TEMPLATES.find(t => t.key === 'ggf').build()
    const before = m.edges.map(e => e.step)
    for (const e of m.edges) e.step = 0
    stepsByTime(m)
    expect(m.edges.map(e => e.step)).toEqual(before)
  })
})

describe('steps', () => {
  const el = { id: 'fd1', type: 'feynman', x: 10, y: 20, width: 500, height: 300, ...defaultFeynman(true), stepStart: 2 }

  it('counts from stepStart, and a vertex comes with its first line', () => {
    expect(feynmanSteps(el)).toEqual([[2, 1], [3, 2], [4, 3]])
    expect(feynmanStepAt(el, 1)).toBe(0)
    expect(feynmanStepAt(el, 3)).toBe(2)
    expect(feynmanStepAt(el, 99)).toBe(3)
    const m = feynmanModel(el)
    expect(vertexStep(m, m.vertices.find(v => v.id === 'f1'))).toBe(3)
    expect(feynmanStepMarkers({ elements: [el] }).match(/data-fx-step="fd1"/g)).toHaveLength(3)
  })

  it('draws a step without the parts that come later', () => {
    const at1 = feynmanSvg(el, { step: 1 }), all = feynmanSvg(el)
    expect(at1.match(/<path /g).length).toBeLessThan(all.match(/<path /g).length)
    // The same box at every step, so printed pages line up
    expect(at1.match(/viewBox="[^"]+"/)[0]).toBe(all.match(/viewBox="[^"]+"/)[0])
    // The last caption shows once every step has been
    expect(all).toContain('which makes a muon pair.')
    expect(at1).toContain('An electron and a positron annihilate')
    expect(at1).not.toContain('muon pair')
  })

  it('shows a deck-drawn diagram at its step', async () => {
    const { Window } = await import('happy-dom')
    const win = new Window()
    win.document.body.innerHTML = feynmanSvg(el, { deck: 'fd1', labels: 'deck' })
    const root = win.document.body.firstElementChild
    const off = () => [...root.querySelectorAll('.pxfx-part')].filter(p => p.classList.contains('pxfx-off')).length
    applyFeynmanStep(root, 0, false, true)
    const hiddenAt0 = off()
    expect(hiddenAt0).toBeGreaterThan(0)
    applyFeynmanStep(root, 2, true, true)
    expect(off()).toBeLessThan(hiddenAt0)
    expect(root.querySelectorAll('.pxfx-new').length).toBeGreaterThan(0)
    expect(root.querySelectorAll('.pxfx-past').length).toBeGreaterThan(0)
    const shownCaps = [...root.querySelectorAll('[data-fx-cap]')].filter(c => !c.classList.contains('pxfx-off')).map(c => c.getAttribute('data-fx-cap'))
    expect(shownCaps).toEqual(['2'])
    applyFeynmanStep(root, 3, false, false)
    expect(off()).toBe(0)
    expect(root.querySelectorAll('.pxfx-new, .pxfx-past').length).toBe(0)
  })

  it('has a deck script that parses', () => {
    expect(() => new Function(feynmanDeckScript())).not.toThrow()
    expect(feynmanDeckScript()).not.toMatch(/<\/script|<!--/i)
  })

  it('sizes the element to the drawing', () => {
    const b = feynmanBox(el)
    expect(b.w).toBeGreaterThan(5.1 * 64)
    expect(b.h).toBeGreaterThan(2 * 64)
  })
})

describe('in a deck', () => {
  const el = { id: 'fd1', type: 'feynman', x: 10, y: 20, width: 500, height: 300, ...defaultFeynman(true), stepStart: 2 }
  const deck = { id: 'p', title: 'T', slides: [{ id: 's1', elements: [el, { id: 'f', type: 'text', x: 0, y: 0, width: 10, height: 10, content: '<p>x</p>', fragment: true, fragmentIndex: 1 }] }] }

  it('draws every part, with a hidden fragment per step and the script that shows them', () => {
    const html = generateRevealHTML(deck)
    expect(html).toMatch(/<div data-fx="fd1" data-fx-dim="1" style="position:absolute;left:10px;top:20px;[^"]*overflow:visible;[^"]*"><svg /)
    for (const n of [2, 3, 4]) expect(html).toContain(`data-fragment-index="${n}" data-fx-step="fd1"`)
    expect(html).toContain("querySelectorAll('[data-fx]')")
    expect(generateRevealHTML({ ...deck, slides: [{ id: 's1', elements: [] }] })).not.toContain("querySelectorAll('[data-fx]')")
  })

  it('prints a page per step, the diagram as it is then', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF(deck)
      const html = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
      // Before any step, after the fragment (1, no diagram step yet), then steps 1 to 3
      expect([...html.matchAll(/data-fx-at-page="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '0', '1', '2', '3'])
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})
