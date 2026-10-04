import { describe, it, expect, vi } from 'vitest'
import { Window } from 'happy-dom'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import {
  TIMING_TEMPLATES, TIMING_FIELDS, parseTiming, drawTiming, timingSvg, timingBox, timingModel, timingSteps, timingStepAt,
  timingStepMarkers, hasTiming, timingCycles, stepsByCycle, defaultTiming,
} from './timingDiagram'
import { applyDiagramStep, DIAGRAM_CSS } from './diagramCore'
import { generateRevealHTML, exportPDF } from './generateHTML'
import { supportsClickAction } from './clickActions'

const tpl = key => TIMING_TEMPLATES.find(t => t.key === key).source
const el = (over = {}) => ({ id: 'tm-1', type: 'timing', x: 10, y: 20, width: 800, height: 300, ...defaultTiming(true), ...over })

describe('reading WaveJSON', () => {
  it('takes WaveDrom’s relaxed JSON', () => {
    const p = parseTiming("{ signal: [ { name: 'clk', wave: 'p...' }, ], // a clock\n }")
    expect(p.kind).toBe('signal')
    expect(p.json.signal[0].wave).toBe('p...')
    expect(parseTiming('{ reg: [{ bits: 8, name: "data" }] }').kind).toBe('reg')
    expect(parseTiming('{ assign: [["out", ["&", "a", "b"]]] }').kind).toBe('assign')
  })

  it('says what’s wrong, and where', () => {
    expect(parseTiming('{ signal: [ { name: x } ').error).toMatch(/^Line 1: invalid character 'x'/)
    expect(parseTiming('{ signal: [\n  { name: "a", wave: "01" },\n  { name: "b" wave: "1" }\n] }').error).toMatch(/^Line 3:/)
    expect(parseTiming('[]').error).toMatch(/Write an object/)
    expect(parseTiming('{ signal: {} }').error).toMatch(/signal must be a list/)
    expect(parseTiming('{ signal: [{ name: "a", wave: 3 }] }').error).toMatch(/a's wave must be a string/)
    expect(parseTiming('{ wave: "01" }').error).toMatch(/Nothing to draw/)
  })

  it('keeps to sizes it can draw', () => {
    expect(parseTiming(`{ signal: [{ wave: '${'01'.repeat(300)}' }] }`).error).toMatch(/up to 400 are drawn/)
    expect(parseTiming(`{ signal: [${'{ wave: "1" },'.repeat(81)}] }`).error).toMatch(/81 signals/)
    expect(parseTiming('{ signal: [], config: { hscale: 50 } }').error).toMatch(/hscale/)
    expect(parseTiming('{ reg: [{ bits: 600 }] }').error).toMatch(/600 bits/)
    expect(parseTiming('x'.repeat(50000)).error).toMatch(/up to 40,000/)
  })
})

describe('drawing', () => {
  it('draws every template in both colors, as plain shapes', () => {
    for (const t of TIMING_TEMPLATES) {
      for (const theme of ['dark', 'light']) {
        const svg = timingSvg(el({ source: t.source, theme }))
        expect(svg).toMatch(/^<svg /)
        expect(svg).not.toMatch(/NaN|undefined|Infinity/)
        // Nothing the editor's cleaning drops, nothing that styles the rest of a page
        expect(svg).not.toMatch(/<use|<style|\sclass="s\d|xlink:href/)
        // No id but its own
        for (const [, id] of svg.matchAll(/\sid="([^"]+)"/g)) expect(id).toMatch(/^tmtm-1c-/)
      }
    }
  })

  it('takes the skin’s styles as attributes, and leaves out WaveDrom’s white page', () => {
    const light = timingSvg(el({ source: tpl('clock-data'), theme: 'light' }))
    expect(light).toContain('stroke="#000"')
    expect(light).toContain('fill="#ffffb4"') // the "3" bus color
    expect(light).not.toMatch(/fill:\s*white/)
    const dark = timingSvg(el({ source: tpl('clock-data'), theme: 'dark' }))
    expect(dark).toContain('stroke="#ffffff"')
    // What WaveDrom writes into its code, recolored for a dark slide: the arrows and their heads
    expect(dark).not.toMatch(/#0041c4/i)
    expect(dark).toMatch(/marker id="tmtm-1c-arrowhead"[^>]*fill:#79b8ff/)
  })

  it('gives two diagrams on a slide ids of their own', () => {
    const a = timingSvg({ ...el(), id: 'a' }), b = timingSvg({ ...el(), id: 'b' })
    const ids = s => [...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
    expect(ids(a).length).toBeGreaterThan(0)
    expect(ids(a).filter(id => ids(b).includes(id))).toEqual([])
  })

  it('escapes names and labels once, and drops markup that isn’t drawing', () => {
    const svg = timingSvg(el({
      source: `{ signal: [
        { name: 'a<b & "c"', wave: '01.', data: ['x'] },
        { name: 'd', wave: '=.', data: ['</svg><script>steal()</script>'] },
        { name: ['tspan', { onclick: 'steal()', style: 'fill:url(http://evil/x)' }, 'n'], wave: '1' },
        { name: ['script', {}, 'steal()'], wave: '0' },
      ] }`,
    }))
    expect(svg).toContain('a&lt;b &amp; &quot;c&quot;')
    expect(svg).not.toMatch(/<script|onclick|evil|&amp;lt;/)
    expect(svg).toContain('&lt;/svg&gt;&lt;script&gt;steal()')
  })

  it('draws a register’s fields and logic, with no steps', () => {
    const reg = timingSvg(el({ source: tpl('register'), steps: [{ to: 2 }] }))
    expect(reg).toContain('opcode')
    expect(reg).toContain('fill="#e8ecf3"') // its text, light on a dark slide
    expect(reg).not.toMatch(/stroke="black"/)
    expect(reg).not.toContain('clipPath')
    expect(timingSvg(el({ source: '{ assign: [["out", ["|", ["&", "a", "b"], ["~", "c"]]]] }' }))).toMatch(/^<svg /)
  })

  it('draws a placeholder with the problem when the source can’t be drawn', () => {
    const svg = timingSvg(el({ source: '{ signal: [ oops ] }' }))
    expect(svg).toContain('Timing diagram')
    expect(svg).toMatch(/Line 1/)
    expect(timingBox(el({ source: 'nope' }))).toEqual({ w: 480, h: 120 })
  })

  it('knows its cycles and how wide one is', () => {
    const d = drawTiming(el({ source: tpl('spi') }))
    expect(d.lanes.period).toBe(40)
    expect(timingCycles(el({ source: tpl('spi') }))).toBe(11)
    expect(drawTiming(el({ source: "{ signal: [{ wave: 'p...' }], config: { hscale: 2 } }" })).lanes.period).toBe(80)
  })
})

describe('steps', () => {
  const stepped = el({ source: tpl('spi'), stepStart: 2, revealFrom: 1, steps: [{ to: 3, caption: 'CS falls' }, { to: 6 }, { to: 11, caption: 'All 8 bits' }] })

  it('counts from the slide step they start at', () => {
    expect(timingSteps(stepped)).toEqual([[2, 1], [3, 2], [4, 3]])
    expect([0, 1, 2, 3, 4, 9].map(n => timingStepAt(stepped, n))).toEqual([0, 0, 1, 2, 3, 3])
    expect(timingSteps({ ...stepped, type: 'venn' })).toEqual([])
    expect(timingStepMarkers({ elements: [stepped] })).toContain('data-fragment-index="2" data-fx-step="tm-1" data-fx-step-at="1"')
    expect(hasTiming({ slides: [{ elements: [stepped] }] })).toBe(true)
  })

  it('reveals the waveforms to a cycle, with a cursor and the latest caption', () => {
    const at2 = timingSvg(stepped, { step: 2 })
    expect(at2).toMatch(/<clipPath id="tmtm-1s2-reveal" clipPathUnits="userSpaceOnUse"><rect x="-4" y="-10000" width="244" height="20000"\/><\/clipPath>/)
    expect(at2.match(/clip-path="url\(#tmtm-1s2-reveal\)"/g).length).toBeGreaterThanOrEqual(4)
    expect(at2).toMatch(/<line x1="300.5"[^>]*stroke-dasharray="4 3"/)
    expect(at2).toContain('>CS falls</text>')
    expect(at2).not.toContain('All 8 bits')
    // The last step shows everything, so no cursor at the end
    expect(timingSvg(stepped, { step: 3 })).not.toMatch(/stroke-dasharray="4 3"/)
    expect(timingSvg({ ...stepped, cursor: false }, { step: 2 })).not.toMatch(/stroke-dasharray="4 3"/)
  })

  it('makes each step’s part of a deck show at its step', () => {
    const win = new Window()
    win.document.body.innerHTML = `<style>${DIAGRAM_CSS}</style><div id="d">${timingSvg(stepped, { deck: 'tm-1' })}</div>`
    const root = win.document.getElementById('d')
    const shown = () => [...root.querySelectorAll('clipPath rect')].filter(r => !r.classList.contains('pxfx-off')).map(r => r.getAttribute('width'))
    const caption = () => [...root.querySelectorAll('[data-fx-cap]')].filter(t => !t.classList.contains('pxfx-off')).map(t => t.textContent)
    applyDiagramStep(root, 0, false, false)
    expect(shown()).toEqual(['44'])
    expect(caption()).toEqual([])
    applyDiagramStep(root, 1, true, false)
    expect(shown()).toEqual(['124'])
    expect(caption()).toEqual(['CS falls'])
    applyDiagramStep(root, 2, true, false)
    expect(shown()).toEqual(['244'])
    expect(caption()).toEqual(['CS falls'])
    applyDiagramStep(root, 3, true, false)
    expect(shown()).toEqual(['444'])
    expect(caption()).toEqual(['All 8 bits'])
  })

  it('makes steps a cycle or a few apart', () => {
    expect(stepsByCycle(el({ source: tpl('spi') }), 4).map(s => s.to)).toEqual([4, 8, 11])
    expect(stepsByCycle(el({ source: tpl('spi') }), 1)).toHaveLength(11)
  })

  it('leaves room under the diagram for captions', () => {
    const plain = timingBox(el({ source: tpl('spi') }))
    expect(timingBox(stepped).h).toBe(plain.h + 30)
    expect(timingBox(el({ source: tpl('spi'), steps: [{ to: 3 }] })).h).toBe(plain.h)
  })

  it('goes in a deck, with the steps’ script', () => {
    const html = generateRevealHTML({ title: 'T', slides: [{ id: 's1', elements: [stepped] }] })
    expect(html).toContain('data-fx="tm-1" data-fx-dim="0"')
    expect(html).toContain('data-fx-step="tm-1" data-fx-step-at="3"')
    expect(html).toContain("querySelectorAll('[data-fx]')")
    expect(html).toContain('data-fx-in="3-"')
  })

  it('prints a page per step', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [stepped] }] })
      const html = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
      expect([...html.matchAll(/data-tm-at-page="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '1', '2', '3'])
      expect(html).not.toContain('data-fx-in')
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})

describe('the element', () => {
  it('starts from the first template, in the slide’s colors', () => {
    expect(defaultTiming(false)).toMatchObject({ theme: 'light', steps: [], cursor: true, stepStart: 1 })
    expect(Object.keys(defaultTiming())).toEqual(TIMING_FIELDS)
    expect(TIMING_FIELDS).not.toContain('scale')
  })

  it('reads its settings defensively', () => {
    expect(timingModel({ theme: 'x', steps: [{ to: 2.3, caption: 7 }, null], stepStart: -1, revealFrom: 'q' })).toMatchObject({
      theme: 'dark', steps: [{ to: 2.5, caption: '' }, { to: 0, caption: '' }], stepStart: 1, revealFrom: 0, cursor: true,
    })
  })

  it('can take a click action, being a picture', () => {
    expect(supportsClickAction({ type: 'timing' })).toBe(true)
  })
})
