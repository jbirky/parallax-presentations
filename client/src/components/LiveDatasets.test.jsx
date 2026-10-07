// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

vi.mock('../utils/api', () => ({
  api: {
    testDatasetSource: vi.fn(),
    createLiveDataset: vi.fn(),
    linkDataset: vi.fn(async () => ({ success: true })),
    previewDatasetTransforms: vi.fn(),
    saveDatasetTransforms: vi.fn(),
  },
}))
import { api } from '../utils/api'
import { LiveSourceForm, TransformsTab, relativeTime } from './LiveDatasets'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const sources = {
  enabled: true,
  presets: [{ id: 'exoplanets', name: 'NASA Exoplanet Archive', url: 'https://exoplanetarchive.ipac.caltech.edu/TAP' }],
  schedules: ['daily', 'weekly', 'manual'],
  allowance: { used: 0, limit: 1, plan: 'Free' },
}

function render(element) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(element))
  const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.includes(text))
  return { el, root, button }
}
const click = async b => { await act(async () => { b.click() }) }
// Sets a field as typing does, so React hears it
async function type(field, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set
  await act(async () => {
    setter.call(field, value)
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}

beforeEach(() => vi.clearAllMocks())

describe('making a live dataset', () => {
  it('tests a URL, names the dataset after its file, and saves it to the deck', async () => {
    api.testDatasetSource.mockResolvedValue({
      rowCount: 5994, columns: [{ name: 'pl_name' }, { name: 'pl_orbper' }],
      rows: [{ pl_name: 'HD 2039 b', pl_orbper: 1120 }],
    })
    api.createLiveDataset.mockResolvedValue({ id: 'ds1', name: 'planets' })
    const onDone = vi.fn()
    const { el, button } = render(<LiveSourceForm kind="url" sources={sources} presentationId="p1" onDone={onDone} onCancel={() => {}} />)
    expect(el.textContent).toContain('0 of 1 live dataset used on the Free plan.')

    await type(el.querySelector('input[placeholder="https://example.org/data.csv"]'), 'https://example.org/Planets.csv')
    await click(button('Test'))
    expect(api.testDatasetSource).toHaveBeenCalledWith({
      sourceKind: 'url', source: { url: 'https://example.org/Planets.csv', format: 'auto', rowsPath: '', keyColumn: undefined }, secret: undefined,
    })
    expect(el.textContent).toContain('5,994 rows, 2 columns')
    expect(el.textContent).toContain('HD 2039 b')
    expect(el.querySelector('input[placeholder="exoplanets"]').value).toBe('planets')

    await type([...el.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'pl_name')), 'pl_name')
    await click(button('Save dataset'))
    expect(api.createLiveDataset).toHaveBeenCalledWith(expect.objectContaining({
      name: 'planets', schedule: 'daily', sourceKind: 'url',
      source: expect.objectContaining({ url: 'https://example.org/Planets.csv', keyColumn: 'pl_name' }),
    }))
    expect(api.linkDataset).toHaveBeenCalledWith('p1', 'ds1')
    expect(onDone).toHaveBeenCalledWith({ id: 'ds1', name: 'planets' })
  })

  it('shows the source’s own error, and keeps a full allowance from saving', async () => {
    api.testDatasetSource.mockRejectedValue(new Error('The TAP service refused the query: ORA-00904: \'NOSUCHCOL\': invalid identifier'))
    const full = { ...sources, allowance: { used: 1, limit: 1, plan: 'Free' } }
    const { el, button } = render(<LiveSourceForm kind="tap" sources={full} onDone={() => {}} onCancel={() => {}} />)
    expect(el.querySelector('input[placeholder="https://example.org/tap"]').value).toBe('https://exoplanetarchive.ipac.caltech.edu/TAP')
    await type(el.querySelector('textarea'), 'select nosuchcol from pscomppars')
    await click(button('Test'))
    expect(el.textContent).toContain('ORA-00904')
    await type(el.querySelector('input[placeholder="exoplanets"]'), 'planets')
    expect(button('Save dataset').disabled).toBe(true)
  })
})

describe('a dataset’s steps', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('previews steps as they’re edited, and saves them', async () => {
    api.previewDatasetTransforms.mockResolvedValue({
      preview: { rowCount: 2, columns: [{ name: 'pl_name' }], rows: [{ pl_name: '51 Peg b' }, { pl_name: 'HR 8799 b' }] },
    })
    api.saveDatasetTransforms.mockResolvedValue({ dataset: { id: 'ds1', transforms: [{ op: 'filter', expr: 'mass > 100' }] } })
    const onSaved = vi.fn()
    const ds = { id: 'ds1', name: 'planets', transforms: [], sourceColumns: [{ name: 'pl_name' }, { name: 'mass' }] }
    const { el, button } = render(<TransformsTab ds={ds} datasets={['planets', 'hosts']} onSaved={onSaved} />)
    expect(el.textContent).toContain('No steps')

    await type(el.querySelector('select[aria-label="Add a step"]'), 'filter')
    await type(el.querySelector('input[placeholder="pl_bmasse > 10 and disc_year >= 2000"]'), 'mass > 100')
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(api.previewDatasetTransforms).toHaveBeenLastCalledWith('ds1', [{ op: 'filter', expr: 'mass > 100' }])
    expect(el.textContent).toContain('What slides get: 2 rows, 1 columns')

    await click(button('Save steps'))
    expect(api.saveDatasetTransforms).toHaveBeenCalledWith('ds1', [{ op: 'filter', expr: 'mass > 100' }])
    expect(onSaved).toHaveBeenCalled()
    expect(button('Saved').disabled).toBe(true)
  })

  it('shows which step went wrong', async () => {
    api.previewDatasetTransforms.mockRejectedValue(new Error('Step 1 (compute): There’s no column "masss"'))
    const ds = { id: 'ds1', name: 'planets', transforms: [{ op: 'compute', name: 'x', expr: 'masss * 2' }], sourceColumns: [] }
    const { el } = render(<TransformsTab ds={ds} datasets={[]} onSaved={() => {}} />)
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(el.textContent).toContain('Step 1 (compute): There’s no column "masss"')
  })
})

describe('times', () => {
  it('reads as people say them', () => {
    const now = Date.parse('2026-10-07T12:00:00Z')
    expect(relativeTime('2026-10-07T09:00:00Z', now)).toBe('3 hours ago')
    expect(relativeTime('2026-10-08T12:00:00Z', now)).toBe('in 1 day')
    expect(relativeTime('2026-10-07T11:59:30Z', now)).toBe('just now')
    expect(relativeTime(null, now)).toBe('')
  })
})
