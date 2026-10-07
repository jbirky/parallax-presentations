import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./api', () => ({
  api: {
    getPresentationDatasets: vi.fn(),
    getPresentationDatasetData: vi.fn(),
  },
}))
import { api } from './api'
import {
  setGraphDataPresentation, refreshGraphData, loadGraphData, graphDataFor, dataExtent, paddedView,
  deckGraphs, graphDataVersion, subscribeGraphData,
} from './graphData'
import { graphConfig } from './graphPage'

const DATASETS = [
  { id: 'ds1', name: 'exoplanets', alias: null, updatedAt: '2026-10-07', columns: [{ name: 'p' }, { name: 'm' }, { name: 'method' }, { name: 'name' }] },
  { id: 'ds2', name: 'raw_hist', alias: 'hist', columns: [{ name: 'from' }, { name: 'to' }, { name: 'count' }] },
]
const graph = (expressions, extra = {}) => ({ id: 'g', type: 'graph', expressions, ...extra })
const line = (id, data, extra = {}) => ({ id, data, ...extra })

let deckN = 0
beforeEach(() => {
  vi.clearAllMocks()
  api.getPresentationDatasets.mockResolvedValue(DATASETS)
  api.getPresentationDatasetData.mockImplementation(async (pid, id, { columns }) => {
    const all = {
      ds1: { p: [1, 10, 100, -1], m: [5, 50, 500, 2], method: ['Transit', 'RV', 'Transit', 'RV'], name: ['a', 'b', 'c', 'd'] },
      ds2: { from: [0, 1], to: [1, 2], count: [3, 7] },
    }[id]
    return { columns: Object.fromEntries(columns.split(',').map(c => [c, all[c] || null])), totalRows: all[Object.keys(all)[0]].length }
  })
  setGraphDataPresentation(`deck-${++deckN}`)
})

describe('the rows graphs plot', () => {
  it('fetches each dataset’s columns the graphs use once, through the deck, and hands them to a page', async () => {
    const a = graph([line('d', { dataset: 'exoplanets', x: 'p', y: 'm', colorBy: 'method', label: 'name' })])
    const b = graph([line('e', { dataset: 'exoplanets', x: 'p', y: 'm' }), line('h', { dataset: 'hist', x: 'from', x2: 'to', y: 'count', mark: 'bars' })])
    expect(graphDataFor(a)).toEqual({ d: { loading: true } })
    await loadGraphData([a, b])
    expect(api.getPresentationDatasets).toHaveBeenCalledTimes(1)
    expect(api.getPresentationDatasetData).toHaveBeenCalledTimes(2)
    expect(api.getPresentationDatasetData.mock.calls[0]).toEqual([`deck-${deckN}`, 'ds1', { columns: 'p,m,method,name', limit: '200000' }])
    const rows = graphDataFor(a).d
    expect(rows).toMatchObject({ x: [1, 10, 100, -1], y: [5, 50, 500, 2], color: ['Transit', 'RV', 'Transit', 'RV'], label: ['a', 'b', 'c', 'd'], total: 4 })
    expect(graphDataFor(b).h).toMatchObject({ x: [0, 1], x2: [1, 2], y: [3, 7] })
    // The same object while nothing changes; the page gets it
    expect(graphDataFor(a)).toBe(graphDataFor(a))
    expect(graphConfig(a).data).toBe(graphDataFor(a))
    // Nothing new to fetch
    await loadGraphData([a, b])
    expect(api.getPresentationDatasetData).toHaveBeenCalledTimes(2)
  })

  it('fetches only the columns it doesn’t have yet', async () => {
    await loadGraphData([graph([line('d', { dataset: 'exoplanets', x: 'p', y: 'm' })])])
    await loadGraphData([graph([line('d', { dataset: 'exoplanets', x: 'p', y: 'm', colorBy: 'method' })])])
    expect(api.getPresentationDatasetData.mock.calls.map(c => c[2].columns)).toEqual(['p,m', 'method'])
  })

  it('says what’s wrong: no dataset, no column, a failed read, nothing chosen', async () => {
    const read = api.getPresentationDatasetData.getMockImplementation()
    api.getPresentationDatasetData.mockImplementation(async (pid, id, q) => {
      if (id === 'ds2') throw new Error('Step 1 (compute): There’s no column "masss"')
      return read(pid, id, q)
    })
    const g = graph([
      line('a', { dataset: 'gone', x: 'p', y: 'm' }),
      line('b', { dataset: 'exoplanets', x: 'p', y: 'mass' }),
      line('c', { dataset: 'hist', x: 'from', y: 'count' }),
      line('d', { dataset: 'exoplanets' }),
    ])
    await loadGraphData([g])
    const rows = graphDataFor(g)
    expect(rows.a.error).toBe('No dataset “gone” is linked to this deck')
    expect(rows.b.error).toBe('“exoplanets” has no column “mass”')
    expect(rows.c.error).toMatch(/no column "masss"/)
    expect(rows.d.error).toBe('Choose a dataset, and the columns for x and y')
  })

  it('tells the editor when rows come, and starts over when the datasets change', async () => {
    const heard = vi.fn()
    const stop = subscribeGraphData(heard)
    const g = graph([line('d', { dataset: 'exoplanets', x: 'p', y: 'm' })])
    const v = graphDataVersion()
    await loadGraphData([g])
    expect(graphDataVersion()).toBeGreaterThan(v)
    expect(heard).toHaveBeenCalled()
    await refreshGraphData()
    expect(graphDataFor(g).d).toEqual({ loading: true })
    await loadGraphData([g])
    expect(api.getPresentationDatasetData).toHaveBeenCalledTimes(2)
    stop()
  })

  it('finds every graph on a deck', () => {
    const deck = { slides: [{ elements: [{ type: 'graph', id: 'a' }, { type: 'text' }] }, { elements: [{ type: 'graph', id: 'b' }] }] }
    expect(deckGraphs(deck).map(g => g.id)).toEqual(['a', 'b'])
  })
})

describe('fitting a view to the data', () => {
  it('covers the rows, positive ones only on a log axis, and bars from 0', async () => {
    const pts = graph([line('d', { dataset: 'exoplanets', x: 'p', y: 'm' })])
    await loadGraphData([pts])
    expect(dataExtent(pts)).toEqual({ xMin: -1, xMax: 100, yMin: 2, yMax: 500 })
    expect(dataExtent({ ...pts, xScale: 'log' })).toEqual({ xMin: 1, xMax: 100, yMin: 5, yMax: 500 })
    const bars = graph([line('h', { dataset: 'hist', x: 'from', x2: 'to', y: 'count', mark: 'bars' })])
    await loadGraphData([bars])
    expect(dataExtent(bars)).toEqual({ xMin: 0, xMax: 2, yMin: 0, yMax: 7 })
    expect(dataExtent(graph([line('h', { dataset: 'hist', x: 'from', y: 'count' }, { hidden: true })]))).toBeNull()
  })

  it('leaves room around it, in log steps on a log axis', () => {
    expect(paddedView({ xMin: 0, xMax: 20, yMin: 10, yMax: 10 })).toEqual({ xMin: -1, xMax: 21, yMin: 9, yMax: 11 })
    const v = paddedView({ xMin: 1, xMax: 1e4, yMin: 1, yMax: 1 }, { xLog: true, yLog: true })
    expect(v.xMin).toBeCloseTo(10 ** -0.2)
    expect(v.xMax).toBeCloseTo(10 ** 4.2)
    expect(v.yMin).toBeCloseTo(10 ** -0.5)
  })
})
