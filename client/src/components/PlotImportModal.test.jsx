// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const PLOT = {
  size: { width: 432, height: 288 },
  producer: 'Matplotlib pdf backend v3.10.6',
  axes: { box: { x0: 54, y0: 31.68, x1: 388.8, y1: 253.44 }, x: { scale: 'linear', range: [-0.5, 10.5], label: 'time (s)' }, y: { scale: 'linear', range: [-0.17, 2.1], label: 'signal (V)' }, grid: false },
  layers: [
    { id: 'l1', name: 'model', kind: 'line', color: '#ff7f0e', width: 1.5, style: 'solid', data: { x: [0, 1, 2], y: [2, 1.4, 1] }, fidelity: 'as drawn', legend: 0 },
    { id: 'l2', name: 'measured', kind: 'points', color: '#1f77b4', shape: 'circle', size: 6, data: { x: [0.5, 1], y: [1.7, 1.4], yErr: [0.05, 0.06] }, fidelity: 'exact', legend: 1 },
  ],
  warnings: ['Some y error bars reach further one way than the other; they’re shown the same both ways.'],
}
const reading = { result: null, error: null }
const splitting = { fn: null } // in place of splitFigure (a PDF's needs pdf.js and a canvas)
// The fonts a changed title is drawn in, from the installed package (the app
// fetches its copy at /vendor/)
async function diskFaces(names) {
  const { readFileSync } = await import('fs')
  const { createRequire } = await import('module')
  const opentype = await import('opentype.js')
  const require = createRequire(import.meta.url)
  return new Map(names.map(name => {
    const buf = readFileSync(require.resolve(`dejavu-fonts-ttf/ttf/${name}.ttf`))
    return [name, opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))]
  }))
}
vi.mock('../utils/plotImport', async importOriginal => {
  const real = await importOriginal()
  return {
    ...real,
    readPlotFile: vi.fn(async () => { if (reading.error) throw reading.error; return reading.result }),
    splitFigure: vi.fn((result, opts = {}) => (splitting.fn ? splitting.fn(result, opts) : real.splitFigure(result, { ...opts, loadFaces: diskFaces }))),
  }
})
vi.mock('../utils/api', () => ({
  api: {
    getDatasets: vi.fn(async () => [{ id: 'd0', name: 'decay data' }]),
    uploadDataset: vi.fn(async (file, name) => ({ id: 'd9', name })),
    linkDataset: vi.fn(async () => ({})),
    uploadFile: vi.fn(async file => ({ url: `/uploads/${file.name}` })),
  },
}))
vi.mock('../utils/graphData', () => ({ refreshGraphData: vi.fn() }))
import { api } from '../utils/api'
import { refreshGraphData } from '../utils/graphData'
import PlotImportModal from './PlotImportModal'
import { readFileSync } from 'fs'
import { readSvgDrawing } from '../utils/plotImport/svgReader'
import { plotFromDrawing } from '../utils/plotImport/plotModel'
import { splitSvg } from '../utils/plotImport/splitSvg'
import { figureElements, partsOf, wholeFigure } from '../utils/plotImport/toFigure'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
beforeEach(() => {
  reading.result = { kind: 'pdf', plot: structuredClone(PLOT), preview: 'data:image/png;base64,AAAA' }
  reading.error = null
  splitting.fn = null
  vi.clearAllMocks()
})
afterEach(() => { act(() => root.unmount()); el.remove() })

async function mount(props = {}) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  const onInsert = vi.fn(), onClose = vi.fn(), onInsertElements = vi.fn()
  const file = new File(['%PDF'], props.name || 'decay.pdf', { type: 'application/pdf' })
  await act(async () => root.render(<PlotImportModal file={file} presentationId="p1" dark={false} onInsert={onInsert} onInsertElements={onInsertElements} onClose={onClose} {...props} />))
  await act(async () => {})
  return { onInsert, onClose, onInsertElements }
}
const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.startsWith(text))
// Long enough for the figure as it will look to be made (it waits for a
// color being dragged to settle)
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 250)) })
const look = () => el.querySelector('[data-look]')
const colorOf = name => items().find(li => li.querySelector('input[aria-label="Layer name"]').value === name).querySelector('input[type="color"]')
const transparentBox = () => [...el.querySelectorAll('label')].find(l => l.textContent === 'Transparent background')?.querySelector('input')
const items = () => [...el.querySelectorAll('[role="listitem"]')]
const set = (input, value) => {
  const proto = Object.getPrototypeOf(input)
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
}

describe('importing a plot', () => {
  it('shows the figure, its axes and its layers, each a step in the legend’s order', async () => {
    await mount()
    expect(el.querySelector('img').getAttribute('src')).toBe('data:image/png;base64,AAAA')
    expect(el.textContent).toContain('x: linear, −0.5 to 10.5 · time (s)')
    expect(items().map(li => li.querySelector('input[aria-label="Layer name"]').value)).toEqual(['model', 'measured'])
    expect(items()[0].textContent).toContain('Line through 3 points')
    expect(items()[0].textContent).toContain('As drawn')
    expect(items()[1].textContent).toContain('2 points, with y error bars')
    expect(items()[1].textContent).toContain('Exact')
    expect(items().map(li => li.querySelector('select').value)).toEqual(['1', '2'])
    expect(el.textContent).toContain('shown the same both ways')
    expect(button('Insert graph with 2 layers')).toBeDefined()
  })

  it('makes a dataset under a name not taken, links it, and inserts the graph as chosen', async () => {
    const { onInsert } = await mount()
    const [line, points] = items()
    await act(async () => set(points.querySelector('input[aria-label="Layer name"]'), 'Raw data'))
    // Points leave at step 3, after the line comes in
    await act(async () => set(points.querySelectorAll('select')[1], '3'))
    await act(async () => button('Insert graph').click())
    expect(api.uploadDataset).toHaveBeenCalledTimes(1)
    const [file, name] = api.uploadDataset.mock.calls[0]
    expect(name).toBe('decay data 2')
    expect(file.name).toBe('decay data 2.csv')
    expect((await file.text()).split('\n')[0]).toBe('model_x,model_y,raw_data_x,raw_data_y,raw_data_yerr')
    expect(api.linkDataset).toHaveBeenCalledWith('p1', 'd9')
    expect(refreshGraphData).toHaveBeenCalled()
    const [graph, size] = onInsert.mock.calls[0]
    expect(graph.expressions.map(e => [e.data.y, e.step, e.until])).toEqual([['model_y', 1, undefined], ['raw_data_y', 2, 3]])
    expect(graph.expressions[1].data.dataset).toBe('decay data 2')
    expect(size.w).toBe(560)
    void line
  })

  it('leaves a layer out, or shows them all at once', async () => {
    const { onInsert } = await mount()
    await act(async () => button('All at once').click())
    expect(items().map(li => li.querySelector('select').value)).toEqual(['0', '0'])
    await act(async () => items()[0].querySelector('input[type="checkbox"]').click())
    expect(button('Insert graph with 1 layer')).toBeDefined()
    await act(async () => button('Insert graph').click())
    const [graph] = onInsert.mock.calls[0]
    expect(graph.expressions).toHaveLength(1)
    expect(graph.expressions[0].step).toBeUndefined()
  })

  it('makes only a graph of a figure whose layers weren’t all found in the file', async () => {
    await mount()
    const radios = [...el.querySelectorAll('input[type="radio"]')]
    expect(radios.map(r => [r.checked, r.disabled])).toEqual([[false, true], [true, false]])
    expect(el.textContent).toContain('Only for a figure whose every layer could be found in the file')
  })

  it('keeps an SVG figure as it is: the file, and its pieces as images, stacked, each layer’s at its steps', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/decay.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    const { onInsertElements, onInsert } = await mount({ name: 'decay.svg' })
    expect(el.querySelector('input[type="radio"]').checked).toBe(true)
    expect(el.textContent).not.toContain('As drawn')
    // Points leave at step 3
    const points = items().find(li => li.querySelector('input[aria-label="Layer name"]').value === 'measured')
    await act(async () => set(points.querySelectorAll('select')[1], '3'))
    await act(async () => button('Insert figure with 2 layers').click())
    // The file first, to open the figure again; then the pieces in drawing
    // order: the model line comes between the points' error bars and markers
    // order: the model line comes between the points' error bars and
    // markers; the legend's frame, then each entry, last
    expect(api.uploadFile.mock.calls.map(([f]) => f.name)).toEqual(['decay.svg', ...['base', 'l2', 'l1', 'l2-2', 'base-2', 'legend', 'l1-2', 'l2-3'].map(p => `decay-${p}.svg`)])
    expect(api.uploadFile.mock.calls[1][0].type).toBe('image/svg+xml')
    expect(api.uploadDataset).not.toHaveBeenCalled()
    expect(onInsert).not.toHaveBeenCalled()
    const [els, how] = onInsertElements.mock.calls[0]
    expect(how).toBeUndefined()
    expect(els.map(e => e.src)).toEqual(['base', 'l2', 'l1', 'l2-2', 'base-2', 'legend', 'l1-2', 'l2-3'].map(p => `/uploads/decay-${p}.svg`))
    expect(new Set(els.map(e => e.groupId)).size).toBe(1)
    for (const e of els) expect(e.figure).toMatchObject({ src: '/uploads/decay.svg', file: 'decay.svg', plan: 'base:53 l2:57 l1:1 l2:19 base:4 legend:1 l1:6 l2:12' })
    for (const e of els.filter(e => e.figure.part === 'l2')) expect(e).toMatchObject({ initialState: 'hidden', stateSteps: { 2: null, 3: 'hidden' } })
    for (const e of els.filter(e => e.figure.part === 'l1')) expect(e).toMatchObject({ initialState: 'hidden', stateSteps: { 1: null } })
    // The legend's frame comes with its first entry
    expect(els.find(e => e.name === 'Legend')).toMatchObject({ initialState: 'hidden', stateSteps: { 1: null } })
  })

  it('keeps a PDF figure as it is, its pieces as PNG images', async () => {
    const plot = structuredClone(PLOT)
    plot.layers[0].ops = [[40, 40]]
    plot.layers[1].ops = [[20, 30], [50, 60]]
    reading.result = { kind: 'pdf', bytes: new Uint8Array([37, 80, 68, 70]), plot, preview: 'data:image/png;base64,AAAA' }
    const png = new Blob(['png'], { type: 'image/png' })
    splitting.fn = vi.fn(async () => ({
      pieces: [['base', 0], ['l2', 0], ['l1', 0], ['l2', 1], ['base', 1], ['legend', 0]].map(([part, run]) => ({ part, run, blob: png })),
      plan: 'base:9 l2:11 l1:1 l2:11 base:30', width: 432, height: 288, type: 'image/png', ext: 'png',
    }))
    const { onInsertElements } = await mount()
    expect(el.querySelector('input[type="radio"]').checked).toBe(true)
    expect(el.textContent).toContain('cut into PNG images')
    // No background was found to leave out
    expect(transparentBox().disabled).toBe(true)
    await act(async () => button('Insert figure with 2 layers').click())
    expect(splitting.fn.mock.calls[0][0]).toBe(reading.result)
    expect(api.uploadFile.mock.calls.map(([f]) => [f.name, f.type])).toEqual([
      ['decay.pdf', 'application/pdf'], ['decay-base.png', 'image/png'], ['decay-l2.png', 'image/png'],
      ['decay-l1.png', 'image/png'], ['decay-l2-2.png', 'image/png'], ['decay-base-2.png', 'image/png'], ['decay-legend.png', 'image/png'],
    ])
    const [els] = onInsertElements.mock.calls[0]
    expect(els.map(e => e.name)).toEqual(['Figure', 'measured', 'model', 'measured, part 2', 'Figure, part 2', 'Legend'])
    expect(els[0].figure).toMatchObject({ src: '/uploads/decay.pdf', file: 'decay.pdf', part: 'base', run: 0 })
  })

  it('keeps a figure with a transparent background: its background and the axes’ left out, and said so', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/decay.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    const { onInsertElements } = await mount({ name: 'decay.svg' })
    const img = () => el.querySelector('[role="dialog"] img')
    expect(transparentBox().checked).toBe(false)
    expect(img().getAttribute('src')).toBe('blob:x')
    expect(look()).toBeNull()
    await act(async () => transparentBox().click())
    await settle()
    // Shown as it will look, its pieces stacked over a checkerboard
    expect(el.querySelector('[data-transparent]')).not.toBeNull()
    expect(look().getAttribute('aria-label')).toBe('decay.svg, as it will look, with a transparent background')
    expect(look().querySelectorAll('img')).toHaveLength(8)
    expect(img().style.visibility).toBe('hidden')
    await act(async () => button('Insert figure with 2 layers').click())
    expect(api.uploadFile.mock.calls.map(([f]) => f.name)).toEqual(['decay.svg', ...['base', 'l2', 'l1', 'l2-2', 'base-2', 'legend', 'l1-2', 'l2-3'].map(p => `decay-${p}.svg`)])
    const base = await api.uploadFile.mock.calls[1][0].text()
    expect(base).not.toContain('id="patch_1"')
    expect(base).not.toContain('id="patch_2"')
    expect(base).toContain('id="xtick_1"')
    const [els] = onInsertElements.mock.calls[0]
    for (const e of els) expect(e.figure).toMatchObject({ clear: true, plan: 'base:53 l2:57 l1:1 l2:19 base:4 legend:1 l1:6 l2:12' })
  })

  it('draws a layer of a figure kept as it is in another color, shown as it will look, and puts its own back', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/decay.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    const { onInsertElements } = await mount({ name: 'decay.svg' })
    const putBack = () => el.querySelector('button[aria-label="Put back measured’s own color"]')
    expect(colorOf('measured').value).toBe('#1f77b4')
    expect(putBack()).toBeNull()
    await act(async () => set(colorOf('measured'), '#d62728'))
    await settle()
    expect(look().getAttribute('aria-label')).toBe('decay.svg, as it will look, in the colors chosen')
    // Its own color back: as saved
    await act(async () => putBack().click())
    expect(colorOf('measured').value).toBe('#1f77b4')
    expect(look()).toBeNull()
    await act(async () => set(colorOf('measured'), '#d62728'))
    await act(async () => button('Insert figure with 2 layers').click())
    const files = Object.fromEntries(await Promise.all(api.uploadFile.mock.calls.map(async ([f]) => [f.name, await f.text()])))
    for (const name of ['decay-l2.svg', 'decay-l2-2.svg', 'decay-l2-3.svg']) {
      expect(files[name]).toContain('#d62728')
      expect(files[name]).not.toContain('#1f77b4')
    }
    expect(files['decay-l1.svg']).toContain('#ff7f0e')
    const [els] = onInsertElements.mock.calls[0]
    expect(els.filter(e => e.figure.part === 'l2').map(e => e.figure.color)).toEqual(['#d62728', '#d62728', '#d62728'])
    expect(els.filter(e => e.figure.part !== 'l2').some(e => 'color' in e.figure)).toBe(false)
  })

  it('makes a figure kept as it is for a dark slide: its text and lines white, the layers in their colors', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/decay.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    const { onInsertElements } = await mount({ name: 'decay.svg' })
    expect(button('Light').getAttribute('aria-pressed')).toBe('true')
    await act(async () => button('Dark').click())
    await settle()
    expect(button('Dark').getAttribute('aria-pressed')).toBe('true')
    expect(el.querySelector('[data-dark]')).not.toBeNull()
    expect(look().getAttribute('aria-label')).toBe('decay.svg, as it will look, for a dark slide')
    await act(async () => button('Insert figure with 2 layers').click())
    const files = Object.fromEntries(await Promise.all(api.uploadFile.mock.calls.map(async ([f]) => [f.name, await f.text()])))
    expect(files['decay-base.svg']).toContain('fill: #000000')
    expect(files['decay-base.svg']).toMatch(/stroke: #ffffff/)
    expect(files['decay-l1.svg']).toContain('stroke: #ff7f0e')
    const [els] = onInsertElements.mock.calls[0]
    for (const e of els) expect(e.figure.dark).toBe(true)
  })

  it('changes a title’s or axis label’s words in a figure kept as it is, shown as it will look', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/decay.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    const { onInsertElements } = await mount({ name: 'decay.svg' })
    const field = name => el.querySelector(`[role="group"][aria-label="Titles and labels"] input[aria-label="${name}"]`)
    expect(field('x-axis label').value).toBe('time (s)')
    expect(field('y-axis label').value).toBe('signal (V)')
    await act(async () => set(field('x-axis label'), 'elapsed time (s)'))
    for (let i = 0; i < 40 && !look(); i++) await settle()
    expect(look().getAttribute('aria-label')).toBe('decay.svg, as it will look, with its words changed')
    // Put back, and changed again
    const putBack = () => el.querySelector('button[aria-label="Put back the x-axis label’s own words"]')
    await act(async () => putBack().click())
    expect(field('x-axis label').value).toBe('time (s)')
    expect(look()).toBeNull()
    await act(async () => set(field('x-axis label'), 'elapsed time (s)'))
    await act(async () => button('Insert figure with 2 layers').click())
    // (once the font's loaded)
    await act(async () => { await vi.waitFor(() => expect(onInsertElements).toHaveBeenCalled(), { timeout: 5000 }) })
    const base = await api.uploadFile.mock.calls[1][0].text()
    expect(base).toContain('<!-- elapsed time (s) -->')
    expect(base).not.toContain('<!-- time (s) -->')
    expect(base).toContain('<!-- signal (V) -->')
    const [els] = onInsertElements.mock.calls[0]
    for (const e of els) expect(e.figure.labels).toEqual({ xlabel: 'elapsed time (s)' })
  })

  it('makes a graph in the colors chosen', async () => {
    const { onInsert } = await mount()
    await act(async () => set(colorOf('model'), '#2ca02c'))
    // A graph's preview is the figure as saved; its words are the graph's own
    await settle()
    expect(look()).toBeNull()
    expect(el.querySelector('[aria-label="Titles and labels"]')).toBeNull()
    await act(async () => button('Insert graph').click())
    const [graph] = onInsert.mock.calls[0]
    expect(graph.expressions.map(e => e.color)).toEqual(['#2ca02c', '#1f77b4'])
  })

  it('keeps a figure of several panels: each panel comes and goes whole, its layers inside it', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/pair.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    const { onInsertElements } = await mount({ name: 'pair.svg' })
    const groups = [...el.querySelectorAll('[aria-label="Panels"] [role="group"]')]
    expect(groups.map(g => g.getAttribute('aria-label'))).toEqual(['(a) decay', '(b) scaling'])
    expect(groups.map(g => [...g.querySelectorAll('[data-panel] select')].map(s => s.value))).toEqual([['0', '0'], ['3', '0']])
    expect(items().map(li => li.querySelector('select').value)).toEqual(['1', '2', '4', '5'])
    // The second panel left out: its layers with it
    await act(async () => groups[1].querySelector('[data-panel] input[type="checkbox"]').click())
    expect([...groups[1].querySelectorAll('[role="listitem"] select')].every(s => s.disabled)).toBe(true)
    await act(async () => button('Insert figure with 2 layers in 1 panel').click())
    const names = api.uploadFile.mock.calls.map(([f]) => f.name)
    expect(names[0]).toBe('pair.svg')
    expect(names.some(n => /-(p2|l3|l4)/.test(n))).toBe(false)
    expect(names).toContain('pair-p1.svg')
    const [els] = onInsertElements.mock.calls[0]
    expect(new Set(els.map(e => e.figure.part))).toEqual(new Set(['base', 'p1', 'l1', 'l2', 'p1-legend']))
    expect(els.find(e => e.figure.part === 'l2')).toMatchObject({ name: 'measured · (a) decay', initialState: 'hidden', stateSteps: { 2: null } })
    expect(els.find(e => e.figure.part === 'p1').states).toBeUndefined()
  })

  it('leaves out a figure legend’s entry when every layer it names is left out', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/grid.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    const { onInsertElements } = await mount({ name: 'grid.svg' })
    for (const li of items().filter(li => li.querySelector('input[aria-label="Layer name"]').value === 'samples')) {
      await act(async () => li.querySelector('input[type="checkbox"]').click())
    }
    await act(async () => button('Insert figure with 4 layers').click())
    const [els] = onInsertElements.mock.calls[0]
    const parts = els.map(e => e.figure.part)
    expect(parts).toContain('figure-legend')
    expect(parts).toContain('figure-legend-1')
    expect(parts).not.toContain('figure-legend-2')
    expect(els.find(e => e.figure.part === 'figure-legend-1')).toMatchObject({ name: 'Figure legend: signal', initialState: 'hidden', stateSteps: { 1: null } })
  })

  it('makes a graph of the panel chosen, of several', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/pair.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    const { onInsert } = await mount({ name: 'pair.svg' })
    await act(async () => el.querySelectorAll('input[type="radio"]')[1].click())
    expect(el.querySelectorAll('[role="group"]')).toHaveLength(0)
    const row = () => items().map(li => [li.querySelector('input[aria-label="Layer name"]').value, li.querySelector('select').value])
    // The first, to begin with
    const pick = el.querySelector('select[aria-label="Panel to graph"]')
    expect(pick.value).toBe('p1')
    expect(row()).toEqual([['model', '1'], ['measured', '2']])
    expect(el.textContent).toContain('a graph is made of one of them: “(a) decay”, unless you choose another')
    expect(el.textContent).toContain('x: linear')
    // The other: its layers, its log scales, its notes, its dataset
    await act(async () => set(pick, 'p2'))
    expect(row()).toEqual([['stars', '1'], ['gas', '2']])
    expect(el.textContent).toContain('x: log')
    expect(el.textContent).toContain('A graph of “(b) scaling”, one of this figure’s 2 panels.')
    expect(el.textContent).toContain('“pair (b) scaling data”')
    await act(async () => button('Insert graph with 2 layers').click())
    const [file, name] = api.uploadDataset.mock.calls[0]
    expect(name).toBe('pair (b) scaling data')
    expect((await file.text()).split('\n')[0]).toBe('stars_x,stars_y,gas_x,gas_y')
    const [graph] = onInsert.mock.calls[0]
    expect(graph.expressions.map(e => [e.data.y, e.step])).toEqual([['stars_y', 1], ['gas_y', 2]])
  })

  it('offers a graph only of panels whose numbers read', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/grid.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    await mount({ name: 'grid.svg' })
    await act(async () => el.querySelectorAll('input[type="radio"]')[1].click())
    const options = [...el.querySelector('select[aria-label="Panel to graph"]').options]
    expect(options.map(o => [o.value, o.disabled])).toEqual([['p1', true], ['p2', true], ['p3', false], ['p4', true]])
    expect(options[0].textContent).toBe('1. Top left panel (its numbers can’t be read)')
    expect(el.querySelector('select[aria-label="Panel to graph"]').value).toBe('p3')
    expect(el.textContent).toContain('“grid bottom left panel data”')
  })

  describe('a figure opened again', () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/decay.svg`, 'utf8')
    const plot = plotFromDrawing(readSvgDrawing(text))
    const { plan, pieces } = splitSvg(text, partsOf(plot, 'svg'))
    const source = { url: '/uploads/decay.svg', name: 'decay.svg' }
    // The figure as it was inserted: the model at step 1, the points at 2 until 3
    const inserted = () => figureElements(plot, pieces.map(p => ({ part: p.part, run: p.run, url: `/uploads/old-${p.part}-${p.run}.svg` })), {
      choices: { l1: { step: 1 }, l2: { step: 2, until: 3, name: 'Raw data' } },
      meta: { src: source.url, file: 'decay.svg', plan },
    }).map(e => ({ ...e, x: 210, y: 64 }))
    let realFetch
    beforeEach(() => {
      reading.result = { kind: 'svg', text, plot: structuredClone(plot), preview: 'blob:x' }
      realFetch = globalThis.fetch
      globalThis.fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob([text], { type: 'image/svg+xml' }) }))
    })
    afterEach(() => { globalThis.fetch = realFetch })

    it('fetches its file and shows its layers as they are, to change and update in place', async () => {
      const els = inserted()
      const { onInsertElements } = await mount({ file: undefined, source, figure: els })
      expect(globalThis.fetch).toHaveBeenCalledWith('/uploads/decay.svg')
      expect(el.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Edit the figure’s layers')
      expect(el.querySelectorAll('input[type="radio"]')).toHaveLength(0)
      expect(button('Choose another figure')).toBeUndefined()
      const row = name => items().find(li => li.querySelector('input[aria-label="Layer name"]').value === name)
      expect([...row('Raw data').querySelectorAll('select')].map(s => s.value)).toEqual(['2', '3'])
      expect([...row('model').querySelectorAll('select')].map(s => s.value)).toEqual(['1', '0'])
      // The model now leaves at step 4
      await act(async () => set(row('model').querySelectorAll('select')[1], '4'))
      await act(async () => button('Update figure').click())
      // Cut the same way: its images stand, nothing's uploaded
      expect(api.uploadFile).not.toHaveBeenCalled()
      const [again, how] = onInsertElements.mock.calls[0]
      expect(how).toEqual({ replace: els.map(e => e.id) })
      expect(again.map(e => e.id)).toEqual(els.map(e => e.id))
      expect(again.map(e => e.src)).toEqual(els.map(e => e.src))
      for (const e of again) expect(e).toMatchObject({ x: 210, y: 64, groupId: els[0].groupId })
      expect(again.find(e => e.figure.part === 'l1')).toMatchObject({ initialState: 'hidden', stateSteps: { 1: null, 4: 'hidden' } })
      expect(again.filter(e => e.figure.part === 'l2').map(e => e.name)).toEqual(['Raw data', 'Raw data, part 2', 'Raw data, part 3'])
    })

    it('puts back a layer left out, uploading only its pieces', async () => {
      const els = inserted().filter(e => e.figure.part !== 'l2')
      const { onInsertElements } = await mount({ file: undefined, source, figure: els })
      const row = items().find(li => li.querySelector('input[aria-label="Layer name"]').value === 'measured')
      expect(row.querySelector('input[type="checkbox"]').checked).toBe(false)
      await act(async () => row.querySelector('input[type="checkbox"]').click())
      await act(async () => button('Update figure').click())
      expect(api.uploadFile.mock.calls.map(([f]) => f.name)).toEqual(['decay-l2.svg', 'decay-l2-2.svg', 'decay-l2-3.svg'])
      const [again] = onInsertElements.mock.calls[0]
      expect(again.map(e => e.src)).toEqual(['old-base-0', 'decay-l2', 'old-l1-0', 'decay-l2-2', 'old-base-1', 'old-legend-0', 'old-l1-1', 'decay-l2-3'].map(p => `/uploads/${p}.svg`))
    })

    it('cuts a figure dropped on the slide when it’s opened, uploading its pieces but not its file', async () => {
      const whole = wholeFigure(plot, { url: '/uploads/decay.svg', meta: { src: source.url, file: 'decay.svg' }, x: 30, y: 20 })
      const { onInsertElements } = await mount({ file: undefined, source, figure: [whole] })
      expect(el.textContent).toContain('the figure is then cut into a piece for each')
      // Nothing chosen yet: one a step
      const row = name => items().find(li => li.querySelector('input[aria-label="Layer name"]').value === name)
      expect([...row('model').querySelectorAll('select')].map(s => s.value)).toEqual(['1', '0'])
      expect([...row('measured').querySelectorAll('select')].map(s => s.value)).toEqual(['2', '0'])
      await act(async () => button('Update figure').click())
      expect(api.uploadFile.mock.calls.map(([f]) => f.name)).toEqual(['base', 'l2', 'l1', 'l2-2', 'base-2', 'legend', 'l1-2', 'l2-3'].map(p => `decay-${p}.svg`))
      const [pieces, how] = onInsertElements.mock.calls[0]
      expect(how).toEqual({ replace: [whole.id] })
      for (const e of pieces) expect(e).toMatchObject({ x: 30, y: 20, width: 560, figure: { id: whole.figure.id, src: source.url, file: 'decay.svg' } })
      expect(pieces.find(e => e.figure.part === 'l2')).toMatchObject({ initialState: 'hidden', stateSteps: { 2: null } })
    })

    it('opened again with a transparent background, shows it so; made opaque, cuts again only the pieces with a background in them', async () => {
      const clear = splitSvg(text, partsOf(plot, 'svg'), { backdrop: plot.backdrop.groups, clear: true })
      const els = figureElements(plot, clear.pieces.map(p => ({ part: p.part, run: p.run, url: `/uploads/old-${p.part}-${p.run}.svg` })), {
        choices: { l1: { step: 1 }, l2: { step: 2 } }, meta: { src: source.url, file: 'decay.svg', plan: clear.plan, clear: true },
      })
      const { onInsertElements } = await mount({ file: undefined, source, figure: els })
      expect(transparentBox().checked).toBe(true)
      await settle()
      expect(look()).not.toBeNull()
      // Changing nothing changes nothing
      await act(async () => button('Update figure').click())
      expect(api.uploadFile).not.toHaveBeenCalled()
      expect(onInsertElements.mock.calls[0][0].every(e => e.figure.clear === true)).toBe(true)
      act(() => root.unmount()); el.remove()
      const second = await mount({ file: undefined, source, figure: els })
      await settle()
      await act(async () => transparentBox().click())
      expect(el.querySelector('[data-transparent]')).toBeNull()
      expect(look()).toBeNull()
      expect(el.querySelector('[role="dialog"] img').style.visibility).toBe('visible')
      await act(async () => button('Update figure').click())
      // The first piece has both backgrounds in it, the legend's its box;
      // the rest stand
      expect(api.uploadFile.mock.calls.map(([f]) => f.name)).toEqual(['decay-base.svg', 'decay-legend.svg'])
      expect(await api.uploadFile.mock.calls[0][0].text()).toContain('id="patch_2"')
      expect(await api.uploadFile.mock.calls[1][0].text()).toMatch(/fill: #ffffff/)
      const [again] = second.onInsertElements.mock.calls[0]
      expect(again.map(e => e.src)).toEqual(els.map(e => (['base', 'legend'].includes(e.figure.part) && e.figure.run === 0 ? `/uploads/decay-${e.figure.part}.svg` : e.src)))
      expect(again.some(e => 'clear' in e.figure)).toBe(false)
    })

    it('opened again, shows a layer’s color of its own; a new one cuts again only that layer’s pieces', async () => {
      const els = figureElements(plot, pieces.map(p => ({ part: p.part, run: p.run, url: `/uploads/old-${p.part}-${p.run}.svg` })), {
        choices: { l1: { step: 1 }, l2: { step: 2, color: '#d62728' } }, meta: { src: source.url, file: 'decay.svg', plan },
      })
      const { onInsertElements } = await mount({ file: undefined, source, figure: els })
      expect(colorOf('measured').value).toBe('#d62728')
      expect(colorOf('model').value).toBe('#ff7f0e')
      await act(async () => set(colorOf('measured'), '#9467bd'))
      await act(async () => button('Update figure').click())
      expect(api.uploadFile.mock.calls.map(([f]) => f.name)).toEqual(['decay-l2.svg', 'decay-l2-2.svg', 'decay-l2-3.svg'])
      expect(await api.uploadFile.mock.calls[0][0].text()).toContain('#9467bd')
      const [again] = onInsertElements.mock.calls[0]
      expect(again.filter(e => e.figure.part === 'l2').map(e => e.figure.color)).toEqual(['#9467bd', '#9467bd', '#9467bd'])
      expect(again.filter(e => e.figure.part !== 'l2').map(e => e.src)).toEqual(els.filter(e => e.figure.part !== 'l2').map(e => e.src))
    })

    it('opened again for a dark slide, shows it so; made for a light one, cuts again only what a dark slide changes', async () => {
      const dark = splitSvg(text, partsOf(plot, 'svg'), { dark: true, dataParts: new Set(['l1', 'l2']) })
      const els = figureElements(plot, dark.pieces.map(p => ({ part: p.part, run: p.run, url: `/uploads/old-${p.part}-${p.run}.svg` })), {
        choices: { l1: { step: 1 }, l2: { step: 2 } }, meta: { src: source.url, file: 'decay.svg', plan: dark.plan, dark: true },
      })
      const { onInsertElements } = await mount({ file: undefined, source, figure: els })
      expect(button('Dark').getAttribute('aria-pressed')).toBe('true')
      await act(async () => button('Light').click())
      await act(async () => button('Update figure').click())
      // The base, the legend's box, and the layers' legend entries (their words)
      expect(api.uploadFile.mock.calls.map(([f]) => f.name)).toEqual(['decay-base.svg', 'decay-base-2.svg', 'decay-legend.svg', 'decay-l1-2.svg', 'decay-l2-3.svg'])
      const [again] = onInsertElements.mock.calls[0]
      expect(again.filter(e => ['l2:0', 'l1:0', 'l2:1'].includes(`${e.figure.part}:${e.figure.run}`)).map(e => e.src)).toEqual(['/uploads/old-l2-0.svg', '/uploads/old-l1-0.svg', '/uploads/old-l2-1.svg'])
      expect(again.some(e => 'dark' in e.figure)).toBe(false)
    })

    it('opened again, shows the words changed; put back, cuts again only the piece they’re in', async () => {
      const els = figureElements(plot, pieces.map(p => ({ part: p.part, run: p.run, url: `/uploads/old-${p.part}-${p.run}.svg` })), {
        choices: { l1: { step: 1 }, l2: { step: 2 } }, meta: { src: source.url, file: 'decay.svg', plan, labels: { ylabel: 'voltage (mV)' } },
      })
      const { onInsertElements } = await mount({ file: undefined, source, figure: els })
      const field = el.querySelector('[role="group"][aria-label="Titles and labels"] input[aria-label="y-axis label"]')
      expect(field.value).toBe('voltage (mV)')
      await act(async () => el.querySelector('button[aria-label="Put back the y-axis label’s own words"]').click())
      await act(async () => button('Update figure').click())
      expect(api.uploadFile.mock.calls.map(([f]) => f.name)).toEqual(['decay-base.svg'])
      expect(await api.uploadFile.mock.calls[0][0].text()).toContain('<!-- signal (V) -->')
      const [again] = onInsertElements.mock.calls[0]
      expect(again.some(e => 'labels' in e.figure)).toBe(false)
      expect(again.slice(1).map(e => e.src)).toEqual(els.slice(1).map(e => e.src))
    })

    it('says when its file can’t be fetched', async () => {
      globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 }))
      await mount({ file: undefined, source, figure: inserted() })
      expect(el.querySelector('[role="alert"]').textContent).toContain('The figure’s file couldn’t be fetched.')
      expect(button('Update figure').disabled).toBe(true)
    })
  })

  it('says why a figure couldn’t be read', async () => {
    reading.error = new Error('No axes were found in this figure.')
    await mount()
    expect(el.querySelector('[role="alert"]').textContent).toContain('No axes were found in this figure.')
    expect(button('Insert graph').disabled).toBe(true)
  })

  it('says why the graph couldn’t be added, and lets them try again', async () => {
    api.uploadDataset.mockRejectedValueOnce(new Error('Storage limit reached'))
    const { onInsert } = await mount()
    await act(async () => button('Insert graph').click())
    expect(el.querySelector('[role="alert"]').textContent).toBe('Storage limit reached')
    expect(onInsert).not.toHaveBeenCalled()
    expect(button('Insert graph').disabled).toBe(false)
  })
})
