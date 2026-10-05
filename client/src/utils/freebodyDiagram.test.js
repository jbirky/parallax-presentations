import { describe, it, expect, vi } from 'vitest'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import {
  FREEBODY_TEMPLATES, freebodySvg, freebodyBox, freebodyTikz, freebodySteps, freebodyStepAt, freebodyStepMarkers, defaultFreebody,
  drawFreebody, addForce, aimForce, compLabel, forceGeom, netGeom,
} from './freebodyDiagram'
import { freebodyModel, solveFreebody } from './freebodySolve'
import { applyDiagramStep } from './diagramCore'
import { generateRevealHTML, exportPDF } from './generateHTML'

const build = key => FREEBODY_TEMPLATES.find(t => t.key === key).build()
const el = { id: 'fb1', type: 'freebody', x: 10, y: 20, width: 400, height: 300, ...build('incline'), color: '#ffffff', stepStart: 2 }

describe('drawing', () => {
  it('draws every template, with no NaN', () => {
    for (const t of FREEBODY_TEMPLATES) {
      for (const labels of ['text', 'deck']) {
        const svg = freebodySvg({ ...t.build(), color: '#ffffff' }, { labels })
        expect(svg).toMatch(/^<svg /)
        expect(svg).not.toMatch(/NaN|undefined|Infinity/)
      }
    }
  })

  it('escapes labels and captions', () => {
    const e = { forces: [{ id: 'a', kind: 'applied', mag: '5', label: '<img src=x>' }], body: { label: '"><script>' }, captions: { 0: '<u>x</u>' } }
    for (const labels of ['text', 'deck']) expect(freebodySvg(e, { labels })).not.toMatch(/<img|<script|<u>/)
  })

  it('draws arrows to scale and the net force beside the diagram', () => {
    const m = freebodyModel(build('sled')), s = solveFreebody(m)
    const g = forceGeom(m, m.forces[1], s)
    expect(g.L).toBeCloseTo(80 / 50)
    const { net } = drawFreebody(m, { sol: s })
    // To the right of everything else, pointing right
    expect(net.u[0]).toBeCloseTo(1)
    expect(net.tail[0]).toBeGreaterThan(g.head[0])
    expect(netGeom(freebodyModel(build('incline')), solveFreebody(freebodyModel(build('incline'))), { x1: 1 })).toBe(null)
  })

  it('names components after their force', () => {
    expect(compLabel('F_N', 'x')).toBe('F_{N,x}')
    expect(compLabel('F_{\\text{app}}', 'y')).toBe('F_{\\text{app},y}')
    expect(compLabel('T', 'x')).toBe('T_x')
  })

  it('sizes the element to the diagram and its captions', () => {
    const b = freebodyBox(el), nocaps = freebodyBox({ ...el, captions: {} })
    expect(b.w).toBeGreaterThan(100)
    expect(b.h).toBeGreaterThan(nocaps.h)
  })
})

describe('steps', () => {
  it('counts forces, the net force and captions, from stepStart', () => {
    expect(freebodySteps(el)).toEqual([[2, 1], [3, 2], [4, 3]])
    expect(freebodyStepAt(el, 3)).toBe(2)
    // The net force's step counts only when there is one to draw
    expect(freebodySteps({ type: 'freebody', ...build('slide') }).map(([, s]) => s)).toEqual([1, 2, 3, 4])
    expect(freebodyStepMarkers({ elements: [el] }).match(/data-fx-step="fb1"/g)).toHaveLength(3)
  })

  it('has a deck drawing that shows each step’s forces', async () => {
    const { Window } = await import('happy-dom')
    const win = new Window()
    win.document.body.innerHTML = freebodySvg(el, { deck: 'fb1', labels: 'deck' })
    const root = win.document.body.firstElementChild
    const hidden = () => root.querySelectorAll('.pxfx-part.pxfx-off').length
    applyDiagramStep(root, 0, false, false)
    expect(hidden()).toBe(3)
    applyDiagramStep(root, 2, true, false)
    expect(hidden()).toBe(1)
    expect(root.querySelector('.pxfx-new .pxfx-reveal')).not.toBe(null)
    // The caption of the latest step with one
    expect([...root.querySelectorAll('[data-fx-cap]')].filter(c => !c.classList.contains('pxfx-off')).map(c => c.getAttribute('data-fx-cap'))).toEqual(['2'])
  })

  it('in a deck: the element, its steps and the shared script', () => {
    const html = generateRevealHTML({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [el] }] })
    expect(html).toMatch(/<div data-fx="fb1" data-fx-dim="0" style="position:absolute;left:10px;top:20px;[^"]*overflow:visible;[^"]*"><svg /)
    for (const n of [2, 3, 4]) expect(html).toContain(`data-fragment-index="${n}" data-fx-step="fb1"`)
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
      expect([...html.matchAll(/data-fb-at-page="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '1', '2', '3'])
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})

describe('TikZ', () => {
  it('writes each force as a polar arrow from where it acts', () => {
    const tikz = freebodyTikz({ ...build('sled'), color: '#ffffff' })
    expect(tikz).toContain('\\usetikzlibrary{arrows.meta, patterns}')
    expect(tikz).toContain('\\draw[force] (0,0) -- ++(-90:3.92) node[below] {$mg = 196\\,\\mathrm{N}$};')
    expect(tikz).toContain('\\draw[force, color=fbc1] (0,0) -- ++(30:1.6) node[above right] {$T = 80\\,\\mathrm{N}$};')
    expect(tikz).toContain('\\definecolor{fbc1}{HTML}{3B82F6}')
    expect(tikz).toContain('% Net force, beside the diagram')
    expect(tikz).not.toContain('\\text{')
  })
})

describe('the editor’s changes', () => {
  it('adds forces in their usual directions', () => {
    const m = freebodyModel(build('blank'))
    expect(addForce(m, 'weight')).toMatchObject({ id: 'f1', magMode: 'mass', label: 'mg', dir: { from: 'level', deg: -90 } })
    expect(addForce(m, 'normal')).toMatchObject({ id: 'f2', magMode: 'solve', dir: { from: 'surface', deg: 90 } })
    expect(addForce(m, 'friction')).toMatchObject({ magMode: 'solve', dir: { from: 'surface', deg: 180 } })
    expect(solveFreebody(m).mag.f2).toBeCloseTo(49)
  })

  it('turns and sizes a force toward a point, snapping its angle', () => {
    const m = freebodyModel({ forceScale: 10, forces: [{ id: 'a', kind: 'applied', mag: '20', dir: { deg: 0 } }] })
    const f = m.forces[0]
    aimForce(m, f, [1.5, 1.52], solveFreebody(m))
    expect(f.dir.deg).toBe(45)
    expect(f.mag).toBe('21')
    // Within 4° of straight up, it's straight up
    aimForce(m, f, [0.1, 2], solveFreebody(m))
    expect(f.dir.deg).toBe(90)
    aimForce(m, f, [0.1, 2], solveFreebody(m), true)
    expect(f.dir.deg).toBeCloseTo(87.14, 1)
  })

  it('starts a new diagram from the first template in the slide’s color', () => {
    expect(defaultFreebody(false)).toMatchObject({ color: '#1a1a1a', stepStart: 1 })
    expect(defaultFreebody(true).forces).toHaveLength(3)
  })
})
