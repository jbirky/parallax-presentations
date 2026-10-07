// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const DATASETS = [{ id: 'ds1', name: 'exoplanets', columns: [
  { name: 'pl_name', type: 'string' }, { name: 'pl_orbper', type: 'float' }, { name: 'pl_bmasse', type: 'float' }, { name: 'discoverymethod', type: 'string' },
] }]
vi.mock('../utils/graphData', () => ({
  subscribeGraphData: () => () => {},
  graphDataVersion: () => 1,
  linkedDatasets: () => DATASETS,
  listGraphDatasets: vi.fn(async () => DATASETS),
  datasetNamed: name => DATASETS.find(d => d.name === name) || null,
  loadGraphData: vi.fn(async () => {}),
  graphDataFor: vi.fn(el => Object.fromEntries((el.expressions || []).filter(e => e.data).map(e => [e.id, { x: [1, 10, 100], y: [2, 20, 200], total: 3 }]))),
  dataExtent: vi.fn(() => ({ xMin: 1, xMax: 100, yMin: 2, yMax: 200 })),
  paddedView: vi.fn(() => ({ xMin: 0.5, xMax: 200, yMin: 1, yMax: 400 })),
}))
import GraphEditorModal from './GraphEditorModal'
import { defaultGraph } from '../utils/graphPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.ResizeObserver = class { observe() {} disconnect() {} }

function render(initial) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onSave = vi.fn()
  act(() => root.render(<GraphEditorModal initial={initial} size={{ w: 560, h: 400 }} isNew onSave={onSave} onClose={() => {}} />))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text)
  return { el, onSave, button }
}
const click = async b => { await act(async () => { b.click() }) }
async function choose(select, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
  await act(async () => { setter.call(select, value); select.dispatchEvent(new Event('change', { bubbles: true })) })
}

beforeEach(() => vi.clearAllMocks())

describe('a graph’s data lines', () => {
  it('plot a linked dataset’s first two number columns, in place of a new graph’s example, fitted to the rows', async () => {
    const { el, button, onSave } = render(defaultGraph(false))
    await click(button('Data'))
    const dataset = el.querySelector('select[aria-label="Dataset"]')
    expect(dataset.value).toBe('exoplanets')
    expect(el.textContent).toContain('3 rows')
    // the example's three lines gave way
    expect(el.querySelectorAll('select[aria-label="Dataset"]')).toHaveLength(1)
    expect([...el.querySelectorAll('input')].filter(i => i.value === 'y = a sin(bx)')).toHaveLength(0)

    await choose(el.querySelector('select[aria-label="x scale"]'), 'log')
    await click(button('Insert'))
    const saved = onSave.mock.calls[0][0]
    expect(saved.expressions).toHaveLength(1)
    expect(saved.expressions[0].data).toEqual({ dataset: 'exoplanets', x: 'pl_orbper', y: 'pl_bmasse', mark: 'points' })
    expect(saved.xScale).toBe('log')
    expect(saved.equalScale).toBe(false)
    expect(saved.view).toEqual({ xMin: 0.5, xMax: 200, yMin: 1, yMax: 400 })
  })

  it('color and label by columns, chosen in their options', async () => {
    const initial = { ...defaultGraph(false), expressions: [{ id: 'd', text: '', data: { dataset: 'exoplanets', x: 'pl_orbper', y: 'pl_bmasse' } }] }
    const { el, button, onSave } = render(initial)
    await click(el.querySelector('button[title="Options"]'))
    await choose(el.querySelector('select[title^="Categories get colors"]'), 'discoverymethod')
    await choose(el.querySelector('select[title="Shown when pointing at a row"]'), 'pl_name')
    // Only number columns for a position
    expect([...el.querySelectorAll('select[title="Across"] option')].map(o => o.value)).toEqual(['', 'pl_orbper', 'pl_bmasse'])
    await click(button('Insert'))
    expect(onSave.mock.calls[0][0].expressions[0].data).toMatchObject({ colorBy: 'discoverymethod', label: 'pl_name' })
  })
})
