// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const example = (slug, extra = {}) => ({
  slug, field: 'Physics', title: slug, description: '', tags: [], builtin: true, card: true, hero: false, sortOrder: 1,
  sourcePresentationId: null, sourceTitle: null, ownDeck: false, hasThumbnail: false, background: null, updatedAt: null, ...extra,
})
const state = { list: [] }
vi.mock('../utils/api', () => ({
  api: {
    getAdminExamples: vi.fn(async () => ({ examples: state.list, thumbnails: true })),
    getPresentations: vi.fn(async () => [{ id: 'p1', title: 'Cell division' }, { id: 'p2', title: 'Shared with me', role: 'editor' }]),
    addExample: vi.fn(async data => {
      const added = example('cell-division', { title: data.title, builtin: false, sourcePresentationId: data.presentationId, sourceTitle: 'Cell division' })
      state.list = [...state.list, added]
      return { example: added, thumbnailError: 'This server has no Chromium to draw thumbnails with' }
    }),
    saveExample: vi.fn(async (slug, data) => ({ example: { ...state.list.find(e => e.slug === slug), ...data } })),
    orderExamples: vi.fn(async slugs => ({ examples: slugs.map(s => state.list.find(e => e.slug === s)) })),
    refreshExample: vi.fn(async () => ({})),
    redrawExampleThumbnail: vi.fn(async () => ({ thumbnailError: null })),
    copyExample: vi.fn(async () => ({ presentation: { id: 'p9', title: 'Venn diagrams' } })),
    deleteExample: vi.fn(async () => ({ ok: true })),
  },
}))
import { api } from '../utils/api'
import { ExamplesPanel } from './AdminPage'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
beforeEach(() => {
  state.list = [
    example('hero', { title: 'Parallax', card: false, hero: true, field: '' }),
    example('venn', { title: 'Venn diagrams', field: 'Mathematics' }),
    example('cells', { title: 'Cells', builtin: false, sourcePresentationId: 'p1', sourceTitle: 'Cell division', ownDeck: true, hasThumbnail: true, updatedAt: '2026-10-06T00:00:00Z' }),
  ]
  vi.clearAllMocks()
})
afterEach(() => { act(() => root.unmount()); el.remove() })

async function mount() {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<ExamplesPanel />))
}
const row = title => [...el.querySelectorAll('strong')].find(s => s.textContent === title).closest('div[style*="grid-template-columns"]')
const button = (scope, text) => [...scope.querySelectorAll('button')].find(b => b.textContent === text)
const type = (input, value) => {
  const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set
  set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('the landing page examples, in /admin', () => {
  it('lists them in order, saying where each one’s slides come from', async () => {
    await mount()
    expect([...el.querySelectorAll('strong')].map(s => s.textContent)).toEqual(['Parallax', 'Venn diagrams', 'Cells'])
    expect(row('Parallax').textContent).toContain('At the top')
    expect(row('Venn diagrams').textContent).toContain('Built in')
    expect(row('Cells').querySelector('a[href="/dashboard/cell-division"]')).not.toBeNull()
    expect(row('Cells').querySelector('img').getAttribute('src')).toBe(`/examples/thumbs/cells.jpg?v=${Date.parse('2026-10-06T00:00:00Z')}`)
    expect(row('Venn diagrams').querySelector('img').getAttribute('src')).toBe('/examples/thumbs/venn.jpg')
    // The top of the page can't be hidden, deleted or moved to itself
    expect(button(row('Parallax'), 'Hide')).toBeUndefined()
    expect(button(row('Parallax'), 'Delete')).toBeUndefined()
    expect(button(row('Venn diagrams'), 'Delete')).toBeUndefined()
    expect(button(row('Cells'), 'Delete')).toBeDefined()
  })

  it('adds one from the admin’s own presentations, and says if the thumbnail wasn’t drawn', async () => {
    await mount()
    await act(async () => button(el, 'Add an example').click())
    const select = el.querySelector('select')
    expect([...select.options].map(o => o.textContent)).toEqual(['Choose one of your presentations…', 'Cell division'])
    await act(async () => type(select, 'p1'))
    expect(el.querySelector('input[maxlength="80"]').value).toBe('Cell division')
    await act(async () => type(el.querySelector('input[list="example-fields"]'), 'Biology'))
    await act(async () => el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.addExample).toHaveBeenCalledWith({ presentationId: 'p1', field: 'Biology', title: 'Cell division', description: '', tags: '' })
    expect(el.textContent).toContain('the thumbnail wasn’t drawn: This server has no Chromium')
  })

  it('hides, moves, puts at the top, updates and deletes', async () => {
    window.confirm = () => true
    await mount()
    await act(async () => button(row('Venn diagrams'), 'Hide').click())
    expect(api.saveExample).toHaveBeenLastCalledWith('venn', { card: false })
    await act(async () => button(row('Venn diagrams'), 'Put at the top').click())
    expect(api.saveExample).toHaveBeenLastCalledWith('venn', { hero: true })
    await act(async () => row('Cells').querySelector('[aria-label="Move Cells up"]').click())
    expect(api.orderExamples).toHaveBeenCalledWith(['hero', 'cells', 'venn'])
    await act(async () => button(row('Cells'), 'Update from presentation').click())
    expect(api.refreshExample).toHaveBeenCalledWith('cells')
    await act(async () => button(row('Cells'), 'Delete').click())
    expect(api.deleteExample).toHaveBeenCalledWith('cells')
    expect(el.textContent).not.toContain('Cells')
  })

  it('makes an editable copy of a built-in one, and links to it', async () => {
    await mount()
    await act(async () => button(row('Venn diagrams'), 'Make an editable copy').click())
    expect(api.copyExample).toHaveBeenCalledWith('venn')
    expect(el.querySelector('[role="status"]').textContent).toContain('Made “Venn diagrams” in your presentations')
    expect(el.querySelector('[role="status"] a').getAttribute('href')).toBe('/dashboard/venn-diagrams')
  })
})
