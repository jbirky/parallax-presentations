import { describe, it, expect, vi } from 'vitest'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import {
  LOGIC_TEMPLATES, logicSvg, logicBox, logicTikz, logicTableLatex, logicSteps, logicStepAt, logicStepMarkers, defaultLogic, drawLogic,
  addLogicPart, addLogicNode, logicWireAt, splitLogicWire, nearestEnd, removeLogic, floatingPins,
} from './logicDiagram'
import { logicModel, LOGIC_PARTS, route } from './logicParts'
import { applyDiagramStep } from './diagramCore'
import { generateRevealHTML, exportPDF } from './generateHTML'

const build = key => LOGIC_TEMPLATES.find(t => t.key === key).build()

describe('the model', () => {
  it('drops what it cannot draw', () => {
    const m = logicModel({
      parts: [{ id: 'a', kind: 'and', inputs: 9 }, { id: 'a', kind: 'or' }, { id: 'b.c', kind: 'not' }, { id: 'z', kind: 'teleporter' }, { id: 'i', kind: 'input', value: 7, flips: [3, 1, 3, 0, 'x'] }],
      nodes: [{ id: 'a', x: 1 }, { id: 'n', x: 2, y: 1 }],
      wires: [{ id: 'w1', from: 'i.out', to: 'a.in1' }, { id: 'w2', from: 'a.in3', to: 'n' }, { id: 'w3', from: 'n', to: 'n' }, { id: 'w4', from: 'n', to: 'a.in2', mx: 'left' }],
    })
    expect(m.parts.map(p => p.id)).toEqual(['a', 'i'])
    expect(m.parts[0].inputs).toBe(4)
    expect(m.parts[1]).toMatchObject({ value: 1, flips: [1, 3] })
    expect(m.nodes.map(n => n.id)).toEqual(['n'])
    expect(m.wires.map(w => w.id)).toEqual(['w1', 'w2', 'w4'])
    expect(m.wires[2].mx).toBe(null)
  })

  it('escapes labels and captions', () => {
    const el = { parts: [{ id: 'i', kind: 'input', label: '<img src=x>' }, { id: 'g', kind: 'and', label: '"><script>' }], captions: { 0: '<u>x</u>' } }
    for (const labels of ['text', 'deck']) expect(logicSvg(el, { labels })).not.toMatch(/<img|<script|<u>/)
  })
})

describe('drawing', () => {
  it('draws every part in both symbol sets', () => {
    for (const style of ['us', 'iec']) {
      const m = { parts: [], nodes: [], wires: [], captions: {} }
      Object.keys(LOGIC_PARTS).forEach((kind, i) => addLogicPart(m, kind, 0, i * 3))
      expect(drawLogic(m, { style }).svg.match(/<(path|rect|circle) /g).length).toBeGreaterThan(Object.keys(LOGIC_PARTS).length * 2)
    }
  })

  it('colors wires by signal, lights outputs and draws the truth table', () => {
    const el = defaultLogic(true)
    el.parts.find(p => p.id === 'B').value = 1
    const svg = logicSvg(el)
    expect(svg).toContain('stroke="#4ade80"')                        // B's wires, high
    expect(svg).toContain('fill="#4ade80"')                          // S lit
    expect(svg.match(/<text [^>]*>[01]<\/text>/g).length).toBeGreaterThanOrEqual(16 + 2)   // the table, and the inputs' digits
    expect(logicSvg({ ...el, values: false })).not.toContain('stroke="#4ade80"')
  })

  it('draws unknown signals dashed', () => {
    expect(logicSvg(build('latch'))).toContain('stroke-dasharray="5 4"')
  })

  it('sizes the element to the diagram and its table', () => {
    const b = logicBox(defaultLogic(true)), plain = logicBox({ ...defaultLogic(true), table: false })
    expect(b.w).toBeGreaterThan(plain.w + 2 * 56)
  })
})

describe('steps', () => {
  const el = { id: 'lg1', type: 'logic', x: 10, y: 20, width: 500, height: 260, ...defaultLogic(true), stepStart: 2 }

  it('count flips, clock ticks, parts and captions, from stepStart', () => {
    expect(logicSteps(el)).toEqual([[2, 1], [3, 2], [4, 3]])
    expect(logicStepAt(el, 3)).toBe(2)
    expect(logicSteps({ type: 'logic', ...build('counter') }).map(([, s]) => s)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(logicStepMarkers({ elements: [el] }).match(/data-fx-step="lg1"/g)).toHaveLength(3)
  })

  it('has a deck drawing that shows each step’s signals', async () => {
    const { Window } = await import('happy-dom')
    const win = new Window()
    win.document.body.innerHTML = logicSvg(el, { deck: 'lg1', labels: 'deck' })
    const root = win.document.body.firstElementChild
    const shownDigits = () => [...root.querySelectorAll('[data-fx-in]')].filter(g => !g.classList.contains('pxfx-off')).flatMap(g => [...g.querySelectorAll('text')].map(t => t.textContent))
    applyDiagramStep(root, 0, false, false)
    expect(shownDigits()).toEqual(['0', '0'])
    applyDiagramStep(root, 3, true, false)
    expect(shownDigits()).toEqual(['1', '1'])
    // A changed wire fades in after those before it
    expect(root.querySelector('[data-fx-in="3-"] .pxlg-sig')).not.toBe(null)
  })

  it('in a deck: the element, its steps and the shared script', () => {
    const html = generateRevealHTML({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [el] }] })
    expect(html).toMatch(/<div data-fx="lg1" data-fx-dim="0" style="position:absolute;left:10px;top:20px;[^"]*overflow:visible;[^"]*"><svg /)
    for (const n of [2, 3, 4]) expect(html).toContain(`data-fragment-index="${n}" data-fx-step="lg1"`)
    expect(html).toContain("querySelectorAll('[data-fx]')")
  })

  it('prints a page per step, each with its signals', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [el] }] })
      const html = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
      expect([...html.matchAll(/data-lg-at-page="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '1', '2', '3'])
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})

describe('CircuiTikZ and the truth table', () => {
  it('writes gates as ports and wires between anchors', () => {
    const tikz = logicTikz(defaultLogic(true))
    expect(tikz).toContain('\\draw (3, 1.75) node[xor port] (g1) {};')
    expect(tikz).toContain('\\draw (0.75, 2) node[ocirc] (A) {} node[left] {$A$};')
    expect(tikz).toContain('\\coordinate (nA) at (1.25, 2);')
    expect(tikz).toContain('\\draw (nA) -| ($(nA)!0.5!(g2.in 1)$) |- (g2.in 1);')
    expect(tikz).toContain('\\draw (g1.out) -- (S);')
    expect(tikz).toContain('\\draw (nA) node[circ] {};')
    expect(logicTikz({ parts: [{ id: 'g', kind: 'and', inputs: 3 }, { id: 'f', kind: 'dff', x: 3 }] })).toMatch(/and port, number inputs=3[\s\S]*flipflop D/)
  })

  it('writes the truth table as a tabular', () => {
    expect(logicTableLatex(defaultLogic(true))).toBe(['\\begin{tabular}{cc|cc}', '  $A$ & $B$ & $S$ & $C$ \\\\ \\hline', '  0 & 0 & 0 & 0 \\\\', '  0 & 1 & 1 & 0 \\\\', '  1 & 0 & 1 & 0 \\\\', '  1 & 1 & 0 & 1 \\\\', '\\end{tabular}'].join('\n'))
    expect(logicTableLatex(build('latch'))).toMatch(/^% It has feedback/)
  })
})

describe('editing', () => {
  it('routes a wire across, down and across', () => {
    expect(route({ x: 0, y: 0 }, { x: 2, y: 1 })).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }])
    expect(route({ x: 0, y: 0 }, { x: 2, y: 1 }, 0.5)[1]).toEqual({ x: 0.5, y: 0 })
  })

  it('splits a wire with a junction, keeping its shape', () => {
    const m = build('mux')
    const hit = logicWireAt(m, { x: 5.75, y: 2.4 })
    expect(hit.w.id).toBe('w7')
    const before = route({ x: 5.25, y: 2.75 }, { x: 6.25, y: 2 }, 5.75)
    const nid = splitLogicWire(m, hit)
    expect(m.nodes.find(n => n.id === nid)).toMatchObject({ x: 5.75, y: 2.5 })
    expect(m.wires.filter(w => w.from === nid || w.to === nid).map(w => w.mx)).toEqual([5.75, 5.75])
    expect(before).toHaveLength(4)
  })

  it('finds pins near a point, and removes a part with its wires', () => {
    const m = build('half')
    expect(nearestEnd(m, { x: 2.3, y: 1.95 })).toBe('g1.in1')
    removeLogic(m, { kind: 'p', id: 'g1' })
    expect(m.wires.some(w => w.from.startsWith('g1.') || w.to.startsWith('g1.'))).toBe(false)
    expect(floatingPins(m)).toEqual(['S.in'])
    addLogicNode(m, 9, 9)
    removeLogic(m, { kind: 'w', id: 'none' })
    expect(m.nodes.some(n => n.x === 9)).toBe(false)
  })
})
