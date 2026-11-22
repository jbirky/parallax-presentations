// @vitest-environment node
// Keeping a figure as it is: a matplotlib SVG cut into its base and its
// layers (splitSvg.js), and the stacked image elements they become (toFigure.js)
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { Window } from 'happy-dom'
import { readSvgDrawing } from './svgReader'
import { plotFromDrawing } from './plotModel'
import { splitSvg, SplitError } from './splitSvg'
import { figureElements } from './toFigure'

const { DOMParser, XMLSerializer } = new Window()
const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const opts = { Parser: DOMParser, Serializer: XMLSerializer }
const read = name => { const text = fixture(`${name}.svg`); return { text, plot: plotFromDrawing(readSvgDrawing(text, DOMParser)) } }
const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const ids = doc => new Set([...doc.getElementsByTagName('*')].map(e => e.getAttribute('id')).filter(Boolean))
// Every href="#…" and url(#…) in a document points at something in it
function dangling(doc) {
  const have = ids(doc)
  const out = []
  for (const e of doc.getElementsByTagName('*')) for (const a of e.attributes) {
    if ((a.name === 'href' || a.name === 'xlink:href') && a.value.startsWith('#') && !have.has(a.value.slice(1))) out.push(a.value)
    for (const m of a.value.matchAll(/url\(#([^)]+)\)/g)) if (!have.has(m[1])) out.push(m[1])
  }
  return out
}

describe('keeping a figure as it is', () => {
  it('knows the SVG groups that draw each layer', () => {
    const { plot } = read('decay')
    const measured = plot.layers.find(l => l.name === 'measured')
    // The markers, the error bars and their two rows of caps
    expect(measured.groups.sort()).toEqual(['LineCollection_1', 'line2d_12', 'line2d_13', 'line2d_15'])
    expect(plot.layers.find(l => l.name === 'model').groups).toEqual(['line2d_14'])
  })

  it('cuts the figure into its base and its layers, on one canvas', () => {
    const { text, plot } = read('decay')
    const out = splitSvg(text, plot.layers, opts)
    expect(out.width).toBe(432)
    expect(out.height).toBe(288)
    const base = parse(out.base)
    const baseIds = ids(base)
    for (const g of ['line2d_14', 'line2d_15', 'LineCollection_1', 'line2d_12', 'line2d_13']) expect(baseIds.has(g)).toBe(false)
    for (const g of ['axes_1', 'patch_2', 'legend_1', 'xtick_1', 'text_7']) expect(baseIds.has(g)).toBe(true)
    expect(dangling(base)).toEqual([])
    for (const layer of out.layers) {
      const doc = parse(layer.svg)
      const want = plot.layers.find(l => l.id === layer.id).groups
      const have = ids(doc)
      for (const g of want) expect(have.has(g), `${layer.id} keeps ${g}`).toBe(true)
      // Nothing else draws: no background, axes, ticks or legend
      for (const g of ['patch_1', 'patch_2', 'legend_1', 'xtick_1', 'line2d_1']) expect(have.has(g), `${layer.id} drops ${g}`).toBe(false)
      expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 432 288')
      expect(dangling(doc)).toEqual([])
      // Smaller than the figure: only the definitions it uses
      expect(layer.svg.length).toBeLessThan(text.length / 2)
    }
  })

  it('keeps a marker defined in a group that goes, for the legend that reuses it', () => {
    // The legend's sample marker reuses the data markers' definition, which
    // lives inside their group: the base still has it
    const { text, plot } = read('decay')
    const base = parse(splitSvg(text, plot.layers, opts).base)
    expect(dangling(base)).toEqual([])
    expect([...base.getElementsByTagName('use')].length).toBeGreaterThan(0)
  })

  it('splits bars, log axes and grids too', () => {
    for (const name of ['bars', 'loglog', 'negative', 'seaborn-darkgrid']) {
      const { text, plot } = read(name)
      const out = splitSvg(text, plot.layers, opts)
      expect(out.layers).toHaveLength(plot.layers.length)
      for (const svg of [out.base, ...out.layers.map(l => l.svg)]) expect(dangling(parse(svg)), name).toEqual([])
    }
  })

  it('refuses what it can’t split', () => {
    expect(() => splitSvg('<html/>', [], opts)).toThrow(SplitError)
    expect(() => splitSvg(fixture('decay.svg'), [{ id: 'l1', groups: [] }], opts)).toThrow(/saved as SVG by matplotlib/)
  })

  it('stacks the layers over the base, each hidden until its step and after it leaves', () => {
    const { plot } = read('decay')
    const [model, measured] = plot.layers
    let n = 0
    const els = figureElements(plot, { base: '/u/base.svg', [model.id]: '/u/model.svg', [measured.id]: '/u/measured.svg' }, {
      x: 200, y: 80, newId: () => `id${n++}`,
      choices: { [model.id]: { step: 0, until: 0 }, [measured.id]: { step: 1, until: 3, name: 'Raw data' } },
    })
    expect(els).toHaveLength(3)
    const [base, line, points] = els
    for (const el of els) expect(el).toMatchObject({ type: 'image', x: 200, y: 80, width: 560, height: 373, objectFit: 'contain', groupId: 'id0' })
    expect(base.src).toBe('/u/base.svg')
    expect(line.states).toBeUndefined()
    expect(points).toMatchObject({ src: '/u/measured.svg', name: 'Raw data', initialState: 'hidden', stateSteps: { 1: null, 3: 'hidden' } })
    expect(points.states).toEqual([{ id: 'hidden', name: 'Hidden', opacity: 0, duration: 300, easing: 'ease' }])
    expect(points.zIndex).toBeGreaterThan(line.zIndex)
    // A layer left out isn't there at all
    expect(figureElements(plot, { base: 'b', [model.id]: 'm', [measured.id]: 'p' }, { choices: { [model.id]: { include: false } } })).toHaveLength(2)
  })
})
