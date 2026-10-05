import { describe, it, expect, vi } from 'vitest'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import {
  CIRCUIT_TEMPLATES, circuitSvg, circuitBox, circuitTikz, circuitSteps, circuitStepAt, circuitStepMarkers, defaultCircuit,
  looseEnds, addVertex, addPart, splitWire, wireAt, junctionPoint, routeWire, mergeDropped, removeParts, changePart, drawCircuit,
} from './circuitDiagram'
import { circuitModel, CIRCUIT_PARTS } from './circuitParts'
import { applyDiagramStep, diagramDeckScript } from './diagramCore'
import { generateRevealHTML, exportPDF } from './generateHTML'

const build = key => CIRCUIT_TEMPLATES.find(t => t.key === key).build()

describe('the model', () => {
  it('drops what it cannot draw', () => {
    const m = circuitModel({
      vertices: [{ id: 'a', x: 0, y: 0, ground: 'sideways' }, { id: 'a', x: 1, y: 1 }, { id: 'b', x: 2, y: 0, kind: 'star' }],
      edges: [{ id: 'e1', from: 'a', to: 'b', part: 'flux capacitor', flipAt: 0 }, { id: 'e2', from: 'a', to: 'a', part: 'wire' }, { id: 'e3', from: 'a', to: 'z' }],
      symbols: 'japanese', color: 'red', flow: 0,
    })
    expect(m.vertices.map(v => [v.id, v.ground, v.kind])).toEqual([['a', null, 'auto'], ['b', null, 'auto']])
    expect(m.edges).toHaveLength(1)
    expect(m.edges[0]).toMatchObject({ part: 'wire', flipAt: 1 })
    expect(m).toMatchObject({ symbols: 'us', color: '#ffffff', flow: true, readings: true })
  })

  it('escapes labels, values and captions', () => {
    const el = { vertices: [{ id: 'a', x: 0, y: 0, label: '<img src=x>' }, { id: 'b', x: 2, y: 0 }], edges: [{ id: 'e', from: 'a', to: 'b', part: 'resistor', label: '"><script>', value: '<b>' }], captions: { 0: '<u>x</u>' } }
    for (const labels of ['text', 'deck']) expect(circuitSvg(el, { labels })).not.toMatch(/<img|<script|<b>|<u>/)
  })
})

describe('drawing', () => {
  it('draws every part in both symbol sets', () => {
    for (const style of ['us', 'iec']) {
      const m = { vertices: [], edges: [], captions: {} }
      Object.keys(CIRCUIT_PARTS).forEach((part, i) => addPart(m, addVertex(m, 0, i), addVertex(m, 2, i), part))
      const { svg } = drawCircuit(m, { style })
      expect(svg.match(/<path /g).length).toBeGreaterThan(Object.keys(CIRCUIT_PARTS).length * 2)
    }
  })

  it('shows the current, a lit lamp and meter readings when the circuit is solved', () => {
    const svg = circuitSvg(defaultCircuit(true))
    expect(svg.match(/class="pxcx-flow"/g).length).toBeGreaterThan(4)
    expect(svg).toContain('>300 mA<')
    expect(svg).toContain('>3.6 V<')
    expect(svg).toContain('fill="#ffcf6b"')
    const plain = circuitSvg({ ...defaultCircuit(true), flow: false, readings: false })
    expect(plain).not.toContain('pxcx-flow')
    expect(plain).not.toContain('>300 mA<')
  })

  it('draws a step as it is then: before the switch closes, nothing flows', () => {
    const el = defaultCircuit(true)
    const before = circuitSvg(el, { step: 2 }), after = circuitSvg(el, { step: 3 })
    expect(before).not.toContain('pxcx-flow')
    expect(before).toContain('>0 A<')
    expect(after).toContain('pxcx-flow')
    expect(before.match(/viewBox="[^"]+"/)[0]).toBe(after.match(/viewBox="[^"]+"/)[0])
  })

  it('sizes the element to the drawing', () => {
    const b = circuitBox(defaultCircuit(true))
    expect(b.w).toBeGreaterThan(6.5 * 48)
    expect(b.h).toBeGreaterThan(3 * 48)
  })
})

describe('CircuiTikZ', () => {
  it('writes each part as a path between its points', () => {
    const tikz = circuitTikz(defaultCircuit(true))
    expect(tikz).toContain('\\usepackage[american]{circuitikz}')
    expect(tikz).toContain('\\draw (0, 0) to[battery1, l=$\\mathcal{E}$, a=$9\\,\\mathrm{V}$] (0, 3);')
    expect(tikz).toContain('\\draw (0, 3) to[closing switch, l=$S$] (2.5, 3);')
    expect(tikz).toContain('\\draw (2.5, 3) to[R, l=$R$, a=$18\\,\\Omega$] (5, 3);')
    expect(tikz).toContain('\\draw (2.5, 0) -- (0, 0);')
    expect(tikz).toContain('\\draw (5, 3) node[circ] {};')
    expect(tikz).toContain('to[voltmeter] (6.5, 0)')
  })

  it('writes prefixes, grounds, European symbols and labels', () => {
    const el = { ...build('divider'), symbols: 'iec' }
    const tikz = circuitTikz(el)
    expect(tikz).toContain('[european]')
    expect(tikz).toContain('a=$1\\,\\mathrm{k}\\Omega$')
    // A grounded corner has three connections, so a dot as well
    expect(tikz).toContain('\\draw (0, 0) node[ground] {} node[circ] {};')
    expect(tikz).toContain('node[right] {$V_\\mathrm{out}$}')
  })
})

describe('steps', () => {
  const el = { id: 'cx1', type: 'circuit', x: 10, y: 20, width: 400, height: 260, ...defaultCircuit(true), stepStart: 2 }

  it('count parts, switch flips and captions, from stepStart', () => {
    expect(circuitSteps(el)).toEqual([[2, 1], [3, 2], [4, 3]])
    expect(circuitStepAt(el, 1)).toBe(0)
    expect(circuitStepAt(el, 4)).toBe(3)
    expect(circuitStepMarkers({ elements: [el] }).match(/data-fx-step="cx1"/g)).toHaveLength(3)
  })

  it('has a deck drawing that shows each step, with its own current', async () => {
    const { Window } = await import('happy-dom')
    const win = new Window()
    win.document.body.innerHTML = circuitSvg(el, { deck: 'cx1', labels: 'deck' })
    const root = win.document.body.firstElementChild
    const shown = sel => [...root.querySelectorAll(sel)].filter(n => !n.classList.contains('pxfx-off') && !n.closest('.pxfx-off'))
    applyDiagramStep(root, 2, false, false)
    expect(shown('.pxcx-flow')).toHaveLength(0)            // the switch is still open
    expect(shown('text').map(t => t.textContent)).toContain('0 A')
    applyDiagramStep(root, 3, true, false)
    expect(shown('.pxcx-flow').length).toBeGreaterThan(4)
    expect(shown('text').map(t => t.textContent)).toContain('300 mA')
    expect(shown('text').map(t => t.textContent)).not.toContain('0 A')
    // The switch's blade: open until step 3, closed from then
    expect(root.querySelectorAll('[data-fx-in="0-2"]').length).toBeGreaterThan(0)
    expect(root.querySelector('[data-fx-in="0-2"]').classList.contains('pxfx-off')).toBe(true)
  })

  it('in a deck: the element, its steps and the shared script', () => {
    const deck = { id: 'p', title: 'T', slides: [{ id: 's1', elements: [el] }] }
    const html = generateRevealHTML(deck)
    expect(html).toMatch(/<div data-fx="cx1" data-fx-dim="0" style="position:absolute;left:10px;top:20px;[^"]*overflow:visible;[^"]*"><svg /)
    for (const n of [2, 3, 4]) expect(html).toContain(`data-fragment-index="${n}" data-fx-step="cx1"`)
    expect(html).toContain("querySelectorAll('[data-fx]')")
    expect(() => new Function(diagramDeckScript())).not.toThrow()
  })

  it('prints a page per step, each with its own readings', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [el] }] })
      const html = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
      expect([...html.matchAll(/data-cx-at-page="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '1', '2', '3'])
      expect(html.match(/>300 mA</g)).toHaveLength(1)
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})

describe('editing', () => {
  it('routes a wire with one right angle, horizontal first when wider', () => {
    expect(routeWire({ x: 0, y: 0 }, { x: 3, y: 1 })).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 1 }])
    expect(routeWire({ x: 0, y: 0 }, { x: 1, y: 3 })).toEqual([{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 1, y: 3 }])
    expect(routeWire({ x: 0, y: 0 }, { x: 1, y: 3 }, true)).toHaveLength(2)
  })

  it('splits a wire at a grid point on it, for a junction', () => {
    const m = build('lamp')
    const hit = wireAt(m, { x: 1.2, y: 0.05 })
    expect(hit.e.id).toBe('e6')
    const pt = junctionPoint(m, hit)
    expect(pt).toEqual({ x: 1, y: 0 })
    const vid = splitWire(m, hit.e.id, pt)
    expect(m.edges.filter(e => e.from === vid || e.to === vid)).toHaveLength(2)
  })

  it('turns a wire into a part, with a value that fits', () => {
    const m = build('lamp')
    const e = m.edges.find(x => x.id === 'e6')
    changePart(e, 'resistor')
    expect(e).toMatchObject({ part: 'resistor', value: '100' })
    changePart(e, 'switch')
    expect(e.value).toBe('')
  })

  it('finds loose ends, and removes what is left with nothing', () => {
    const m = build('lamp')
    expect(looseEnds(m)).toEqual([])
    removeParts(m, { kind: 'e', id: 'e9' })
    expect(looseEnds(m).sort()).toEqual(['h'])
    removeParts(m, { kind: 'e', id: 'e8' })
    expect(m.vertices.some(v => v.id === 'h')).toBe(false)
  })

  it('joins a vertex dropped on another, keeping its ground', () => {
    const m = build('divider')
    m.vertices.find(v => v.id === 'p').x = 3.05
    m.vertices.find(v => v.id === 'p').ground = 'down'
    expect(mergeDropped(m, 'p')).toBe('e')
    expect(m.vertices.find(v => v.id === 'e').ground).toBe('down')
  })
})
