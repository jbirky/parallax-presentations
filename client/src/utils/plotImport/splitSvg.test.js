// @vitest-environment node
// Keeping a figure as it is: a matplotlib SVG cut into pieces in the order
// it draws them (splitSvg.js), and the stacked image elements they become,
// read back when the figure's opened again (toFigure.js)
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { Window } from 'happy-dom'
import { readSvgDrawing } from './svgReader'
import { plotFromDrawing } from './plotModel'
import { splitSvg, SplitError } from './splitSvg'
import { figureElements, readFigure, runsOf, planOf } from './toFigure'

const { DOMParser, XMLSerializer } = new Window()
const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
const opts = { Parser: DOMParser, Serializer: XMLSerializer }
const read = name => { const text = fixture(`${name}.svg`); return { text, plot: plotFromDrawing(readSvgDrawing(text, DOMParser)) } }
const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml')
const ids = doc => new Set([...doc.getElementsByTagName('*')].map(e => e.getAttribute('id')).filter(Boolean))
const ASIDE = new Set(['defs', 'clipPath', 'marker', 'symbol', 'pattern', 'mask'])
// How many things a document draws (not counting definitions)
const drawnIn = doc => [...doc.getElementsByTagName('*')].filter(e =>
  ['path', 'use', 'text', 'image', 'rect'].includes(e.localName) && ![...ancestors(e)].some(a => ASIDE.has(a.localName))).length
function* ancestors(e) { for (let a = e.parentNode; a && a.nodeType === 1; a = a.parentNode) yield a }
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

  it('cuts the figure, in the order it’s drawn, into runs of one layer or of the rest', () => {
    const { text, plot } = read('decay')
    const out = splitSvg(text, plot.layers, opts)
    expect(out).toMatchObject({ width: 432, height: 288, type: 'image/svg+xml', ext: 'svg' })
    // The model line is drawn between the measured points' error bars and
    // their markers; the spines and the legend over everything
    expect(out.pieces.map(p => `${p.part}${p.run}`)).toEqual(['base0', 'l20', 'l10', 'l21', 'base1'])
    expect(out.plan).toBe('base:53 l2:57 l1:1 l2:19 base:23')
    const docs = out.pieces.map(p => parse(p.svg))
    const has = docs.map(ids)
    expect(has[0].has('patch_2') && has[0].has('xtick_1')).toBe(true)
    expect(has[0].has('legend_1')).toBe(false)
    expect(has[4].has('legend_1')).toBe(true)
    expect(['LineCollection_1', 'line2d_12', 'line2d_13'].every(g => has[1].has(g))).toBe(true)
    expect(has[1].has('line2d_15')).toBe(false)
    expect(has[2].has('line2d_14')).toBe(true)
    expect(has[3].has('line2d_15')).toBe(true)
    for (const i of [1, 2, 3]) {
      // A layer's piece draws nothing else: no background, ticks or legend
      for (const g of ['patch_1', 'patch_2', 'legend_1', 'xtick_1', 'line2d_1']) expect(has[i].has(g), `piece ${i} drops ${g}`).toBe(false)
      expect(out.pieces[i].svg.length).toBeLessThan(text.length / 2)
    }
    for (const doc of docs) {
      expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 432 288')
      expect(dangling(doc)).toEqual([])
    }
    // One over another, they draw what the figure does, each thing once
    expect(docs.reduce((n, d) => n + drawnIn(d), 0)).toBe(drawnIn(parse(text)))
  })

  it('keeps a marker defined in a group that goes, for the legend that reuses it', () => {
    // The legend's sample marker reuses the data markers' definition, which
    // lives inside their group: the legend's piece still has it
    const { text, plot } = read('decay')
    const legend = parse(splitSvg(text, plot.layers, opts).pieces.at(-1).svg)
    expect(dangling(legend)).toEqual([])
    expect([...legend.getElementsByTagName('use')].length).toBeGreaterThan(0)
  })

  it('splits bars, log axes and grids too', () => {
    for (const name of ['bars', 'loglog', 'negative', 'seaborn-darkgrid']) {
      const { text, plot } = read(name)
      const out = splitSvg(text, plot.layers, opts)
      for (const layer of plot.layers) expect(out.pieces.some(p => p.part === layer.id), `${name} ${layer.id}`).toBe(true)
      for (const p of out.pieces) expect(dangling(parse(p.svg)), name).toEqual([])
      expect(out.pieces.reduce((n, p) => n + drawnIn(parse(p.svg)), 0), name).toBe(drawnIn(parse(text)))
    }
  })

  it('refuses what it can’t split', () => {
    expect(() => splitSvg('<html/>', [], opts)).toThrow(SplitError)
    expect(() => splitSvg(fixture('decay.svg'), [{ id: 'l1', groups: [] }], opts)).toThrow(/saved by matplotlib/)
  })

  it('runs: what one part draws, until another takes over', () => {
    const runs = runsOf(['base', 'base', 'l2', 'l1', 'l2', 'l2', 'base'])
    expect(runs.map(r => [r.part, r.run, r.from, r.to])).toEqual([['base', 0, 0, 1], ['l2', 0, 2, 2], ['l1', 0, 3, 3], ['l2', 1, 4, 5], ['base', 1, 6, 6]])
    expect(planOf(runs)).toBe('base:2 l2:1 l1:1 l2:2 base:1')
  })
})

describe('the figure on the slide', () => {
  const { plot } = read('decay')
  const [model, measured] = plot.layers
  const pieces = [['base', 0], [measured.id, 0], [model.id, 0], [measured.id, 1], ['base', 1]].map(([part, run]) => ({ part, run, url: `/u/${part}-${run}.svg` }))
  const meta = { src: '/u/decay.svg', file: 'decay.svg', plan: 'base:53 l2:57 l1:1 l2:19 base:23' }
  const make = (choices, more = {}) => { let n = 0; return figureElements(plot, pieces, { choices, meta, newId: () => `id${n++}`, ...more }) }

  it('stacks the pieces in drawing order, a layer’s pieces coming and going together', () => {
    const els = make({ [model.id]: { step: 0, until: 0 }, [measured.id]: { step: 1, until: 3, name: 'Raw data' } })
    expect(els.map(e => e.name)).toEqual(['Figure', 'Raw data', 'model', 'Raw data, part 2', 'Figure, part 2'])
    expect(els.map(e => e.src)).toEqual(pieces.map(p => p.url))
    for (const el of els) expect(el).toMatchObject({ type: 'image', x: 0, y: 0, width: 560, height: 373, objectFit: 'contain', groupId: 'id0' })
    expect(els.map(e => e.zIndex)).toEqual([2, 3, 4, 5, 6])
    for (const el of [els[1], els[3]]) {
      expect(el).toMatchObject({ initialState: 'hidden', stateSteps: { 1: null, 3: 'hidden' } })
      expect(el.states).toEqual([{ id: 'hidden', name: 'Hidden', opacity: 0, duration: 300, easing: 'ease' }])
    }
    expect(els[0].states).toBeUndefined()
    expect(els[2].states).toBeUndefined()
    // What it came from, to open it again
    expect(els[3].figure).toEqual({ ...meta, id: 'id1', part: measured.id, run: 1, sig: `points|${measured.color}` })
    expect(els[4].figure).toEqual({ ...meta, id: 'id1', part: 'base', run: 1 })
  })

  it('opened again, reads the layers’ names and steps back from the elements', () => {
    const els = make({ [model.id]: { step: 2, until: 0 }, [measured.id]: { step: 0, until: 3, name: 'Raw data' } })
      .map(e => ({ ...e, x: 120, y: 40 }))
    const back = readFigure(els, plot)
    expect(back.choices).toEqual({
      [model.id]: { include: true, name: 'model', step: 2, until: 0 },
      [measured.id]: { include: true, name: 'Raw data', step: 0, until: 3 },
    })
    expect(back).toMatchObject({ plan: meta.plan, meta: { id: 'id1', src: meta.src, file: 'decay.svg' }, box: { x: 120, y: 40, width: 560, height: 373 }, groupId: 'id0', z: 2 })
    expect(back.ids).toEqual(els.map(e => e.id))
    expect([...back.reuse.keys()]).toEqual(['base:0', `${measured.id}:0`, `${model.id}:0`, `${measured.id}:1`, 'base:1'])
    // A layer left out is still left out
    const without = readFigure(els.filter(e => e.figure.part !== model.id), plot)
    expect(without.choices[model.id]).toEqual({ include: false, name: 'model', step: 0, until: 0 })
    expect(readFigure([{ id: 'x', type: 'image' }], plot)).toBeNull()
  })

  it('knows a layer again by its look when the file reads into layers in another order', () => {
    const els = make({ [model.id]: { step: 1 }, [measured.id]: { step: 2 } })
    const swapped = { ...plot, layers: [{ ...measured, id: 'l1' }, { ...model, id: 'l2' }] }
    const back = readFigure(els, swapped)
    expect(back.choices.l1).toMatchObject({ name: 'measured', step: 2 })
    expect(back.choices.l2).toMatchObject({ name: 'model', step: 1 })
    expect(back.reuse.get('l1:1').figure.part).toBe(measured.id)
  })

  it('made again, keeps its elements’ ids, place and group, and sets only the layers’ states', () => {
    const els = make({ [model.id]: { step: 1 }, [measured.id]: { step: 2 } })
      .map(e => ({ ...e, x: 300, y: 90, width: 420, height: 280, zIndex: e.zIndex + 10 }))
    els[0].states = [{ id: 'dim', opacity: 0.4 }]
    const back = readFigure(els, plot)
    const again = figureElements(plot, pieces.filter(p => p.part !== model.id), {
      choices: { ...back.choices, [model.id]: { include: false }, [measured.id]: { step: 0, until: 0, name: 'Raw' } },
      meta: { ...back.meta, plan: back.plan }, reuse: back.reuse, box: back.box, groupId: back.groupId, z: back.z, newId: () => 'new',
    })
    expect(again.map(e => e.id)).toEqual([els[0].id, els[1].id, els[3].id, els[4].id])
    for (const el of again) expect(el).toMatchObject({ x: 300, y: 90, width: 420, height: 280, groupId: 'id0', figure: { id: 'id1' } })
    expect(again.map(e => e.zIndex)).toEqual([12, 13, 14, 15])
    expect(again[1]).toMatchObject({ name: 'Raw' })
    expect(again[1].states).toBeUndefined()
    expect(again[1].stateSteps).toBeUndefined()
    // A state of the user's own, on the base, stays
    expect(again[0].states).toEqual([{ id: 'dim', opacity: 0.4 }])
  })
})
