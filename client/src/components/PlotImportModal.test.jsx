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
vi.mock('../utils/plotImport', async importOriginal => {
  const real = await importOriginal()
  return { ...real, readPlotFile: vi.fn(async () => { if (reading.error) throw reading.error; return reading.result }) }
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

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
beforeEach(() => {
  reading.result = { kind: 'pdf', plot: structuredClone(PLOT), preview: 'data:image/png;base64,AAAA' }
  reading.error = null
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

  it('makes a graph of a PDF’s data: a PDF can’t be kept as it is', async () => {
    await mount()
    const radios = [...el.querySelectorAll('input[type="radio"]')]
    expect(radios.map(r => [r.checked, r.disabled])).toEqual([[false, true], [true, false]])
    expect(el.textContent).toContain('Only for a figure saved as SVG')
  })

  it('keeps an SVG figure as it is: its base and each layer as images, stacked, each at its steps', async () => {
    const text = readFileSync(`${process.cwd()}/src/utils/plotImport/fixtures/decay.svg`, 'utf8')
    reading.result = { kind: 'svg', text, plot: plotFromDrawing(readSvgDrawing(text)), preview: 'blob:x' }
    const { onInsertElements, onInsert } = await mount({ name: 'decay.svg' })
    expect(el.querySelector('input[type="radio"]').checked).toBe(true)
    expect(el.textContent).not.toContain('As drawn')
    // Points leave at step 3
    const points = items().find(li => li.querySelector('input[aria-label="Layer name"]').value === 'measured')
    await act(async () => set(points.querySelectorAll('select')[1], '3'))
    await act(async () => button('Insert figure with 2 layers').click())
    expect(api.uploadFile.mock.calls.map(([f]) => f.name)).toEqual(['decay-base.svg', 'decay-l1.svg', 'decay-l2.svg'])
    expect(api.uploadFile.mock.calls[0][0].type).toBe('image/svg+xml')
    expect(api.uploadDataset).not.toHaveBeenCalled()
    expect(onInsert).not.toHaveBeenCalled()
    const [els] = onInsertElements.mock.calls[0]
    expect(els.map(e => e.src)).toEqual(['/uploads/decay-base.svg', '/uploads/decay-l1.svg', '/uploads/decay-l2.svg'])
    expect(new Set(els.map(e => e.groupId)).size).toBe(1)
    const measured = els.find(e => e.name === 'measured')
    expect(measured).toMatchObject({ initialState: 'hidden', stateSteps: { 2: null, 3: 'hidden' } })
    expect(els.find(e => e.name === 'model')).toMatchObject({ initialState: 'hidden', stateSteps: { 1: null } })
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
