// @vitest-environment node
// Reading matplotlib figures (fixtures/, made by scripts/make-plot-fixtures.py
// with the data each plots in truth.json), as PDF through pdf.js and as SVG,
// and checking every layer's data against what was plotted.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import { Window } from 'happy-dom'
import { readPdfDrawing } from './pdfReader'
import { readSvgDrawing, parsePathData, transformOf } from './svgReader'
import { plotFromDrawing, PlotError } from './plotModel'
import { parseTickLabel, parseAxisOffset, markerShape } from './drawing'
import { plotToGraph, defaultChoices } from './toGraph'
import { planPdf } from './splitPdf'
import { splitSvg } from './splitSvg'
import { partsOf } from './toFigure'

const require = createRequire(import.meta.url)
const fixture = name => new URL(`./fixtures/${name}`, import.meta.url)
const truth = JSON.parse(readFileSync(fixture('truth.json'), 'utf8'))
const { DOMParser, XMLSerializer } = new Window()
let pdfjs

beforeAll(async () => {
  pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href
})

const readPdf = async name => plotFromDrawing(await readPdfDrawing(new Uint8Array(readFileSync(fixture(`${name}.pdf`))), pdfjs))
const readSvg = name => plotFromDrawing(readSvgDrawing(readFileSync(fixture(`${name}.svg`), 'utf8'), DOMParser))

// The largest gap between two lists of numbers, as a share of an axis's span
// (in decades on a log axis)
function worst(got, want, span, log) {
  expect(got.length).toBe(want.length)
  let w = 0
  for (let i = 0; i < want.length; i++) {
    const d = log ? Math.abs(Math.log10(got[i] / want[i])) : Math.abs(got[i] - want[i])
    w = Math.max(w, d / span)
  }
  return w
}

function check(plot, name) {
  const t = truth[name]
  const span = (lim, scale) => (scale === 'log' ? Math.log10(lim[1] / lim[0]) : lim[1] - lim[0])
  const xs = span(t.xlim, t.xscale), ys = span(t.ylim, t.yscale)
  expect(plot.axes.x.scale).toBe(t.xscale)
  expect(plot.axes.y.scale).toBe(t.yscale)
  for (const [k, lim, sp, scale] of [['x', t.xlim, xs, t.xscale], ['y', t.ylim, ys, t.yscale]]) {
    expect(worst(plot.axes[k].range, lim, sp, scale === 'log')).toBeLessThan(1e-6)
  }
  expect(plot.axes.x.label).toBe(t.xlabel)
  expect(plot.axes.y.label).toBe(t.ylabel)
  const want = Object.entries(t.layers)
  expect(plot.layers.map(l => l.kind).sort()).toEqual(want.map(([, l]) => l.kind).sort())
  for (const [layerName, w] of want) {
    // Named from the legend when it has one; else matched by kind and size
    const layer = t.legend.length ? plot.layers.find(l => l.name === layerName)
      : plot.layers.find(l => l.kind === w.kind && (l.kind === 'line' || l.data.x.length === w.x.length))
    expect(layer, `${name}: ${layerName}`).toBeTruthy()
    if (w.kind === 'line') {
      // The points the line is drawn through are points it was given
      for (let i = 0; i < layer.data.x.length; i++) {
        const j = w.x.findIndex(x => Math.abs(x - layer.data.x[i]) / xs < 1e-6)
        expect(j, `${name} ${layerName} vertex ${i}`).toBeGreaterThanOrEqual(0)
        expect(Math.abs(w.y[j] - layer.data.y[i]) / ys).toBeLessThan(1e-6)
      }
      expect(layer.fidelity).toBe('as drawn')
      continue
    }
    expect(worst(layer.data.x, w.x, xs, t.xscale === 'log'), `${name} ${layerName} x`).toBeLessThan(1e-6)
    expect(worst(layer.data.y, w.y, ys, t.yscale === 'log'), `${name} ${layerName} y`).toBeLessThan(1e-6)
    if (w.yErr) expect(worst(layer.data.yErr, w.yErr, ys, false), `${name} ${layerName} yErr`).toBeLessThan(1e-6)
    if (w.x2) expect(worst(layer.data.x2, w.x2, xs, false)).toBeLessThan(1e-6)
    expect(layer.fidelity).toBe('exact')
  }
}

describe('reading a matplotlib figure', () => {
  for (const name of ['decay', 'loglog', 'bars', 'negative']) {
    it(`reads ${name}.pdf exactly`, async () => check(await readPdf(name), name))
    it(`reads ${name}.svg exactly`, () => check(readSvg(name), name))
  }

  it('keeps the look: colors, markers, line styles, and the grid', async () => {
    for (const plot of [await readPdf('decay'), readSvg('decay')]) {
      const measured = plot.layers.find(l => l.name === 'measured')
      expect(measured).toMatchObject({ kind: 'points', color: '#1f77b4', shape: 'circle' })
      expect(measured.size).toBeCloseTo(6, 1)
      expect(plot.layers.find(l => l.name === 'model')).toMatchObject({ kind: 'line', color: '#ff7f0e', style: 'solid' })
      expect(plot.axes.grid).toBe(false)
      expect(plot.layers.map(l => l.name)).toEqual(['model', 'measured'])
    }
    for (const plot of [await readPdf('loglog'), readSvg('loglog')]) {
      expect(plot.layers.find(l => l.name === 'clusters').shape).toBe('square')
    }
    for (const plot of [await readPdf('negative'), readSvg('negative')]) {
      expect(plot.layers.find(l => l.kind === 'line')).toMatchObject({ color: '#d62728', style: 'dashed' })
      expect(plot.axes.grid).toBe(true)
    }
    expect((await readPdf('bars')).layers[0].color).toBe('#2ca02c')
  })

  it('says a figure is from matplotlib, and warns about one that isn’t', async () => {
    expect((await readPdf('decay')).producer).toMatch(/^Matplotlib/)
    expect(readSvg('decay').producer).toMatch(/^Matplotlib/)
    expect((await readPdf('decay')).warnings).toEqual([])
    const svg = readFileSync(fixture('decay.svg'), 'utf8').replace(/Matplotlib v[\d.]+/g, 'Plotter 2').replace(/matplotlib/gi, 'plotter')
    const other = plotFromDrawing(readSvgDrawing(svg, DOMParser))
    expect(other.warnings.join(' ')).toMatch(/not matplotlib/)
  })

  it('refuses a drawing with no axes, or with axes it can’t number', () => {
    expect(() => plotFromDrawing({ width: 100, height: 100, paths: [], marks: [], texts: [] })).toThrow(PlotError)
    const blank = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="5" cy="5" r="2"/></svg>'
    expect(() => plotFromDrawing(readSvgDrawing(blank, DOMParser))).toThrow(/No axes/)
    expect(() => readSvgDrawing('<html>not svg</html>', DOMParser)).toThrow()
  })
})

describe('styles and setups that move or leave out the ticks', () => {
  // [figure, how close the points must be (share of the axis), what the notes must say]
  const SETUPS = [
    ['seaborn-darkgrid', 1e-6], // no tick marks: the grid lines say where the ticks are
    ['seaborn-white', 1e-4, /no tick marks or grid lines/], // neither: the numbers' places
    ['frameless-legend', 1e-6],
    ['classic', 1e-6],
    ['tick-right', 1e-6],
    ['ticks-in', 1e-6],
    ['despine-offset', 1e-6],
    ['commas', 1e-6],
    ['log-short', 1e-6],
    ['twinx', 1e-6, /second/],
    ['usetex', 1e-6],
  ].filter(([name]) => truth[name])
  for (const [name, tol, note] of SETUPS) {
    for (const ext of ['pdf', 'svg']) {
      it(`reads ${name}.${ext}`, async () => {
        const plot = ext === 'pdf' ? await readPdf(name) : readSvg(name)
        const t = truth[name]
        const data = plot.layers.find(l => l.name === 'data')
        expect(data, plot.layers.map(l => `${l.name}:${l.kind}:${l.data.x.length}`).join(' ')).toBeTruthy()
        expect(plot.axes.y.scale).toBe(t.yscale)
        const span = t.yscale === 'log' ? Math.log10(t.ylim[1] / t.ylim[0]) : t.ylim[1] - t.ylim[0]
        expect(worst(data.data.x, t.layers.data.x, t.xlim[1] - t.xlim[0], false)).toBeLessThan(tol)
        expect(worst(data.data.y, t.layers.data.y, span, t.yscale === 'log')).toBeLessThan(tol)
        if (note) expect(plot.warnings.join(' ')).toMatch(note)
        // The legend's sample, tick marks and a twin's line aren't layers
        expect(plot.layers.filter(l => l.kind === 'points')).toHaveLength(1)
      })
    }
  }
})

describe('the pieces', () => {
  it('reads tick labels as matplotlib writes them', () => {
    expect(parseTickLabel('0.5')).toEqual({ value: 0.5 })
    expect(parseTickLabel('−1.0')).toEqual({ value: -1 })
    expect(parseTickLabel('$\\mathdefault{10^{3}}$')).toEqual({ value: 1000, power: 3 })
    expect(parseTickLabel('$\\mathdefault{10^{−2}}$')).toEqual({ value: 0.01, power: -2 })
    expect(parseTickLabel('10^{3}')).toEqual({ value: 1000, power: 3 })
    expect(parseTickLabel('$\\mathdefault{2\\times10^{3}}$')).toEqual({ value: 2000 })
    expect(parseTickLabel('time (s)')).toBeNull()
    expect(parseAxisOffset('1e6')).toEqual({ scale: 1e6 })
    expect(parseAxisOffset('$\\times\\mathdefault{10^{−3}}\\mathdefault{}$')).toEqual({ scale: 1e-3 })
    expect(parseAxisOffset('+1.5e3')).toEqual({ shift: 1500 })
  })

  it('tells markers apart by their outline', () => {
    expect(markerShape([[[-3, -3], [3, -3], [3, 3], [-3, 3]]]).shape).toBe('square')
    expect(markerShape([[[0, -3], [3, 0], [0, 3], [-3, 0]]]).shape).toBe('diamond')
    expect(markerShape([[[0, 3], [-3, -3], [3, -3]]]).shape).toBe('triangle')
    expect(markerShape([[[3, 0], [-3, 0]]]).shape).toBe('hline')
    expect(markerShape([[[0, -3], [0, 3]], [[-3, 0], [3, 0]]]).shape).toBe('plus')
    expect(markerShape([[[3, 0], [0, 3]]], 4)).toMatchObject({ shape: 'circle', size: 3 })
  })

  it('reads SVG path data and transforms', () => {
    expect(parsePathData('M 1 2 L 3 4 l 1 1 H 10 V 0 z').segs).toEqual([[[1, 2], [3, 4], [4, 5], [10, 5], [10, 0]]])
    expect(parsePathData('M0 0 C 1 1 2 2 3 3').curves).toBe(1)
    expect(transformOf('translate(10 20) scale(2)')).toEqual([2, 0, 0, 2, 10, 20])
  })
})

describe('the graph an imported plot becomes', () => {
  const parseCsv = csv => {
    const [head, ...rows] = csv.trim().split('\n').map(l => l.split(','))
    return Object.fromEntries(head.map((h, k) => [h, rows.map(r => (r[k] === '' ? null : Number(r[k])))]))
  }

  it('plots a dataset of every layer, numbers kept exactly', async () => {
    const plot = await readPdf('decay')
    const choices = defaultChoices(plot)
    // In the legend's order (matplotlib lists lines before error bars), one a step
    expect(Object.fromEntries(plot.layers.map(l => [l.name, choices[l.id].step]))).toEqual({ model: 1, measured: 2 })
    const { csv, columns, graph, size } = plotToGraph(plot, { datasetName: 'decay data', choices })
    expect(columns).toEqual(['model_x', 'model_y', 'measured_x', 'measured_y', 'measured_yerr'])
    const table = parseCsv(csv)
    const measured = plot.layers.find(l => l.name === 'measured')
    expect(table.measured_y.slice(0, 19)).toEqual(measured.data.y)
    expect(table.measured_yerr.slice(0, 19)).toEqual(measured.data.yErr)
    expect(table.measured_x.slice(19).every(v => v === null)).toBe(true)
    const [model, points] = graph.expressions
    expect(points).toMatchObject({ color: '#1f77b4', step: 2, data: { dataset: 'decay data', x: 'measured_x', y: 'measured_y', yErr: 'measured_yerr', mark: 'points', size: 4.5, opacity: 1 } })
    expect(model).toMatchObject({ color: '#ff7f0e', step: 1, width: 2, data: { mark: 'line' } })
    expect(model.style).toBeUndefined()
    expect(graph).toMatchObject({ xLabel: 'time (s)', yLabel: 'signal (V)', equalScale: false, grid: false, showSliders: false })
    expect(graph.view.xMin).toBeCloseTo(-0.5, 5)
    expect(graph.view.xMax).toBeCloseTo(10.5, 5)
    expect(size).toEqual({ w: 560, h: 373 })
  })

  it('takes the names, steps and layers chosen', async () => {
    const plot = await readPdf('negative')
    const [first, second] = plot.layers
    const { graph, columns } = plotToGraph(plot, { datasetName: 'neg', choices: {
      [first.id]: { include: true, name: 'Raw data', step: 1, until: 3 },
      [second.id]: { include: false },
    } })
    expect(graph.expressions).toHaveLength(1)
    expect(graph.expressions[0]).toMatchObject({ step: 1, until: 3 })
    expect(columns[0]).toBe('raw_data_x')
    expect(graph.grid).toBe(true)
    // A step it leaves at that isn't after the one it appears at is dropped
    const odd = plotToGraph(plot, { datasetName: 'neg', choices: { [first.id]: { step: 3, until: 2 } } })
    expect(odd.graph.expressions[0].until).toBeUndefined()
  })

  it('keeps log axes, bars and dashed lines', async () => {
    const log = plotToGraph(await readPdf('loglog'), { datasetName: 'll', choices: {} })
    expect(log.graph).toMatchObject({ xScale: 'log', yScale: 'log' })
    const bars = plotToGraph(await readPdf('bars'), { datasetName: 'b', choices: {} })
    expect(bars.graph.expressions[0].data).toMatchObject({ mark: 'bars', x: 'bars_1_x', x2: 'bars_1_x2', y: 'bars_1_y' })
    const neg = plotToGraph(readSvg('negative'), { datasetName: 'n', choices: {} })
    expect(neg.graph.expressions.find(e => e.data.mark === 'line').style).toBe('dashed')
  })
})

describe('keeping a PDF figure as it is', () => {
  // The page's drawing operators, as pdf.js lists them
  async function operators(name) {
    const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(fixture(`${name}.pdf`))), verbosity: 0 })
    try { return await (await (await task.promise).getPage(1)).getOperatorList() } finally { task.destroy() }
  }

  it('cuts the page’s painting operators into runs in the order they paint, as the SVG of the figure is cut', async () => {
    for (const name of ['decay', 'bars', 'loglog', 'negative', 'seaborn-darkgrid', 'classic']) {
      const plot = await readPdf(name)
      for (const l of plot.layers) expect(l.ops.length, `${name} ${l.id}`).toBeGreaterThan(0)
      const { runs, paints, plan } = planPdf(await operators(name), partsOf(plot, 'pdf'), pdfjs.OPS)
      // Each painting operator in one run, in order
      const all = runs.flatMap(r => [...r.ops])
      expect(all, name).toEqual([...paints].sort((a, b) => a - b))
      // A layer's runs: the operators that paint it, and only those
      for (const l of plot.layers) {
        const own = []
        for (const [a, b] of l.ops) for (let i = a; i <= b; i++) if (paints.has(i)) own.push(i)
        expect(runs.filter(r => r.part === l.id).flatMap(r => [...r.ops]).sort((a, b) => a - b), `${name} ${l.id}`).toEqual([...new Set(own)].sort((a, b) => a - b))
      }
      // The SVG of the same figure is cut into the same runs of layers and
      // legend (what's between, the PDF doesn't always draw: an SVG keeps
      // spines with no line)
      const svg = readFileSync(fixture(`${name}.svg`), 'utf8')
      const parts = p => p.split(' ').map(r => r.split(':')[0]).filter(p => p !== 'base').join(' ')
      expect(parts(plan), name).toBe(parts(splitSvg(svg, partsOf(readSvg(name), 'svg'), { Parser: DOMParser, Serializer: XMLSerializer }).plan))
    }
  })

  it('cuts the decay figure around its interleaved layers, each legend entry with its layer', async () => {
    const plot = await readPdf('decay')
    // The model's entry: its sample line and its words; the points': their
    // marker, error bar, two caps and words
    expect(planPdf(await operators('decay'), partsOf(plot, 'pdf'), pdfjs.OPS).plan).toBe('base:26 l2:57 l1:1 l2:19 base:4 legend:1 l1:2 l2:5')
  })
})
