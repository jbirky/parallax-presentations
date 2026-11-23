// @vitest-environment node
// A figure of several panels, kept as it is: every panel read with its
// layers and legend (plotModel.js), each a part of its own that comes and
// goes whole with its layers inside it (toFigure.js), cut the same way from
// its SVG and its PDF (splitSvg.js, splitPdf.js)
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import { Window } from 'happy-dom'
import { readPdfDrawing } from './pdfReader'
import { readSvgDrawing } from './svgReader'
import { plotFromDrawing, panelPlot } from './plotModel'
import { splitSvg } from './splitSvg'
import { planPdf } from './splitPdf'
import { partsOf, partSteps, figureElements, readFigure, figureLayers } from './toFigure'
import { defaultChoices } from './toGraph'

const require = createRequire(import.meta.url)
const fixture = name => new URL(`./fixtures/${name}`, import.meta.url)
const { DOMParser, XMLSerializer } = new Window()
let pdfjs
beforeAll(async () => {
  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href
})
const read = async (name, ext) => ext === 'pdf'
  ? plotFromDrawing(await readPdfDrawing(new Uint8Array(readFileSync(fixture(`${name}.pdf`))), pdfjs))
  : plotFromDrawing(readSvgDrawing(readFileSync(fixture(`${name}.svg`), 'utf8'), DOMParser))
async function operators(name) {
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(fixture(`${name}.pdf`))), verbosity: 0 })
  try { return await (await (await task.promise).getPage(1)).getOperatorList() } finally { task.destroy() }
}
const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const ASIDE = new Set(['defs', 'clipPath', 'marker', 'symbol', 'pattern', 'mask'])
function* ancestors(e) { for (let a = e.parentNode; a && a.nodeType === 1; a = a.parentNode) yield a }
const drawnIn = doc => [...doc.getElementsByTagName('*')].filter(e =>
  ['path', 'use', 'text', 'image', 'rect'].includes(e.localName) && ![...ancestors(e)].some(a => ASIDE.has(a.localName))).length
const without = (plan, part) => plan.split(' ').map(r => r.split(':')[0]).filter(p => p !== part).join(' ')

describe('a figure of several panels', () => {
  it('reads every panel, with its layers and legend, and knows which a graph is made of', async () => {
    for (const ext of ['svg', 'pdf']) {
      const pair = await read('pair', ext)
      expect(pair.panels.map(p => [p.id, p.name, p.main, p.parent]), ext).toEqual([['p1', '(a) decay', true, null], ['p2', '(b) scaling', false, null]])
      expect(pair.panels.map(p => p.layers.map(l => l.name))).toEqual([['model', 'measured'], ['stars', 'gas']])
      expect(pair.panels.every(p => p.legend)).toBe(true)
      // A graph is made of the first: its layers are the plot's
      expect(pair.layers.map(l => l.name)).toEqual(['model', 'measured'])
      expect(figureLayers(pair).map(l => [l.id, l.panel])).toEqual([['l1', 'p1'], ['l2', 'p1'], ['l3', 'p2'], ['l4', 'p2']])
      expect(pair.warnings.join(' ')).toContain('This figure has 2 panels')

      // Shared axes: only the bottom left panel has numbers on both axes,
      // so a graph is made of it; the rest still have their layers
      const grid = await read('grid', ext)
      expect(grid.panels.map(p => [p.name, p.main, p.calibrated, p.layers.length]), ext).toEqual([
        ['Top left panel', false, false, 2], ['Top right panel', false, false, 2], ['Bottom left panel', true, true, 2], ['Bottom right panel', false, false, 2],
      ])
      expect(grid.layers).toBe(grid.panels[2].layers)
      // Named from the figure's own legend (fig.legend), in every panel
      expect(grid.panels.map(p => p.layers.map(l => l.name).join(' '))).toEqual(Array(4).fill('signal samples'))
      expect(grid.warnings.join(' ')).toContain('a graph is made of one of them: the bottom left panel, unless you choose another')

      const inset = await read('inset', ext)
      expect(inset.panels.map(p => [p.id, p.name, p.main, p.parent]), ext).toEqual([['p1', 'Main panel', true, null], ['p2', 'Inset', false, 'p1']])
      // The inset's line, numbers and their minus signs aren't the panel's
      expect(inset.panels.map(p => p.layers.map(l => l.kind))).toEqual([['line'], ['line']])
      expect(inset.warnings.join(' ')).not.toMatch(/twinx/)
    }
  })

  it('makes a graph of any panel whose numbers read, exactly', async () => {
    for (const ext of ['svg', 'pdf']) {
      const pair = await read('pair', ext)
      expect(panelPlot(pair, 'p1')).toBe(pair)
      const b = panelPlot(pair, 'p2')
      expect(b.axes.x.scale, ext).toBe('log')
      expect(b.axes.y.scale).toBe('log')
      expect(b.layers.map(l => l.name)).toEqual(['stars', 'gas'])
      // The script plots stars at y = x^1.5 and gas at y = 2x
      const [stars, gas] = b.layers
      expect(Math.max(...stars.data.x.map((x, i) => Math.abs(Math.log10(stars.data.y[i]) - 1.5 * Math.log10(x))))).toBeLessThan(1e-6)
      expect(Math.max(...gas.data.x.map((x, i) => Math.abs(gas.data.y[i] / (2 * x) - 1)))).toBeLessThan(1e-6)
      expect(b.warnings.at(-1)).toBe('A graph of “(b) scaling”, one of this figure’s 2 panels.')
      expect(b.warnings.join(' ')).not.toMatch(/error bars/)
      // No graph of a panel whose numbers don't read
      const grid = await read('grid', ext)
      expect(['p1', 'p2', 'p4'].map(id => panelPlot(grid, id))).toEqual([null, null, null])
      expect(panelPlot(grid, 'p3')).toBe(grid)
    }
  })

  it('draws each PDF panel in one run of operators, the next where it ends', async () => {
    for (const name of ['pair', 'grid']) {
      const plot = await read(name, 'pdf')
      const runs = plot.panels.map(p => p.ops)
      for (const r of runs) expect(r).toHaveLength(1)
      for (let k = 1; k < runs.length; k++) expect(runs[k][0][0]).toBe(runs[k - 1][0][1] + 1)
    }
    // An inset's run is inside its panel's
    const [main, inset] = (await read('inset', 'pdf')).panels.map(p => p.ops[0])
    expect(inset[0]).toBeGreaterThan(main[0])
    expect(inset[1]).toBeLessThanOrEqual(main[1])
  })

  it('cuts each panel whole, its layers and legend inside it, the same from the SVG as from the PDF', async () => {
    const plans = {
      pair: 'p1 l2 l1 l2 p1 p1-legend l1 l2 p2 l3 l4 p2 p2-legend l3 l4',
      // The figure's own legend, last: its frame, then each entry
      grid: 'p1 l1 l2 p1 p2 l3 l4 p2 p3 l5 l6 p3 p4 l7 l8 p4 figure-legend figure-legend-1 figure-legend-2',
      inset: 'p1 l1 p1 p2 l2 p2 p1-legend l1',
    }
    for (const [name, want] of Object.entries(plans)) {
      const text = readFileSync(fixture(`${name}.svg`), 'utf8')
      const svg = splitSvg(text, partsOf(await read(name, 'svg'), 'svg'), { Parser: DOMParser, Serializer: XMLSerializer })
      expect(without(svg.plan, 'base'), name).toBe(want)
      // The figure's own title, last: in the base
      expect(svg.plan.split(' ').at(-1).split(':')[0], name).toBe({ inset: 'l1', grid: 'figure-legend-2' }[name] || 'base')
      expect(svg.pieces.reduce((n, p) => n + drawnIn(parse(p.svg)), 0), name).toBe(drawnIn(parse(text)))
      const pdf = planPdf(await operators(name), partsOf(await read(name, 'pdf'), 'pdf'), pdfjs.OPS)
      expect(without(pdf.plan, 'base'), name).toBe(want)
    }
  })

  it('brings each entry of the figure’s own legend in with the first layer it names, in any panel', async () => {
    for (const ext of ['svg', 'pdf']) {
      const grid = await read('grid', ext)
      const fl = grid.figureLegend
      expect(fl.entries.map(e => [e.label, e.layers]), ext).toEqual([['signal', ['l1', 'l3', 'l5', 'l7']], ['samples', ['l2', 'l4', 'l6', 'l8']]])
      expect(fl.entries.every(e => (ext === 'svg' ? e.groups : e.ops).length)).toBe(true)
      const st = partSteps(grid, defaultChoices(grid, true, { figure: true }))
      expect(['figure-legend', 'figure-legend-1', 'figure-legend-2'].map(id => st.get(id))).toEqual([{ step: 1, until: 0 }, { step: 1, until: 0 }, { step: 2, until: 0 }])
    }
    const grid = await read('grid', 'svg')
    // The first panels left out: from the next panel's layers on
    const later = partSteps(grid, { ...defaultChoices(grid, true, { figure: true }), p1: { include: false }, p2: { include: false } })
    expect(later.get('figure-legend-1')).toEqual({ step: 7, until: 0 })
    // Every samples layer left out: its entry never shows; while they all
    // leave, it leaves with the last
    const none = Object.fromEntries(['l2', 'l4', 'l6', 'l8'].map(id => [id, { include: false }]))
    expect(partSteps(grid, { ...defaultChoices(grid, true, { figure: true }), ...none }).get('figure-legend-2')).toMatchObject({ never: true })
    const leaving = Object.fromEntries(['l2', 'l4', 'l6', 'l8'].map((id, i) => [id, { step: 1, until: 3 + i }]))
    expect(partSteps(grid, leaving).get('figure-legend-2')).toEqual({ step: 1, until: 6 })
  })

  it('starts with the first panel, then its layers a step each, then the next panel', async () => {
    const pair = await read('pair', 'svg')
    const steps = c => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.step]))
    expect(steps(defaultChoices(pair, true, { figure: true }))).toEqual({ p1: 0, l1: 1, l2: 2, p2: 3, l3: 4, l4: 5 })
    expect(Object.values(steps(defaultChoices(pair, false, { figure: true }))).every(s => s === 0)).toBe(true)
    // For a graph, only its panel's layers
    expect(steps(defaultChoices(pair, true))).toEqual({ l1: 1, l2: 2 })
  })

  it('shows a layer only while its panel does, an inset while its panel does, a legend while its entries and panel do', async () => {
    const pair = await read('pair', 'svg')
    const st = partSteps(pair, {
      p1: { step: 0, until: 5 }, l1: { step: 1 }, l2: { step: 0, until: 9 },
      p2: { step: 3 }, l3: { step: 1 }, l4: { step: 6, until: 8 },
    })
    expect(st.get('l1')).toEqual({ step: 1, until: 5 })
    expect(st.get('l2')).toEqual({ step: 0, until: 5 })
    expect(st.get('l3')).toEqual({ step: 3, until: 0 })
    expect(st.get('l4')).toEqual({ step: 6, until: 8 })
    // From its first entry, within its panel
    expect(st.get('p1-legend')).toEqual({ step: 0, until: 5 })
    expect(st.get('p2-legend')).toEqual({ step: 3, until: 0 })
    // A layer that would come after its panel has gone never shows
    expect(partSteps(pair, { p1: { step: 0, until: 2 }, l1: { step: 3 } }).get('l1')).toMatchObject({ never: true })
    const inset = await read('inset', 'svg')
    expect(partSteps(inset, { p1: { step: 2, until: 6 }, p2: { step: 1 } }).get('p2')).toEqual({ step: 2, until: 6 })
  })

  it('names each layer’s pieces with its panel, and reads back what was chosen when opened again', async () => {
    const pair = await read('pair', 'svg')
    const text = readFileSync(fixture('pair.svg'), 'utf8')
    const { pieces, plan } = splitSvg(text, partsOf(pair, 'svg'), { Parser: DOMParser, Serializer: XMLSerializer })
    const choices = { p1: { step: 0, until: 4 }, l1: { step: 1 }, l2: { step: 2, until: 6, name: 'Raw' }, p2: { step: 3, name: 'Scaling' }, l3: { step: 0 }, l4: { step: 5 } }
    let n = 0
    const els = figureElements(pair, pieces.map(p => ({ ...p, url: `/u/${p.part}-${p.run}.svg` })), { choices, meta: { src: '/u/pair.svg', file: 'pair.svg', plan }, newId: () => `id${n++}` })
    const named = part => els.filter(e => e.figure.part === part).map(e => e.name)
    expect(named('p1')).toEqual(['(a) decay', '(a) decay, part 2'])
    expect(named('l2')).toEqual(['Raw · (a) decay', 'Raw, part 2 · (a) decay', 'Raw, part 3 · (a) decay'])
    expect(named('p2-legend')).toEqual(['Legend · Scaling'])
    expect(named('base')).toEqual(['Figure', 'Figure, part 2'])
    // The points leave with their panel, at 4, not at 6
    expect(els.find(e => e.figure.part === 'l2')).toMatchObject({ initialState: 'hidden', stateSteps: { 2: null, 4: 'hidden' } })
    // Opened again: as chosen, not as shown
    const back = readFigure(els, pair)
    expect(back.choices.l2).toEqual({ include: true, name: 'Raw', step: 2, until: 6 })
    expect(back.choices.p2).toEqual({ include: true, name: 'Scaling', step: 3, until: 0 })
    expect(back.choices.l3).toEqual({ include: true, name: 'stars', step: 0, until: 0 })
    // Changed on the slide since: as shown
    const changed = els.map(e => (e.figure.part === 'l2' ? { ...e, stateSteps: { 3: null, 4: 'hidden' }, name: 'Points' } : e))
    expect(readFigure(changed, pair).choices.l2).toEqual({ include: true, name: 'Points', step: 3, until: 4 })
    // A panel left out
    expect(readFigure(els.filter(e => e.figure.part !== 'p2'), pair).choices.p2).toMatchObject({ include: false })
  })
})
