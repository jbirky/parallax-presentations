// @vitest-environment happy-dom
// The slide list's right-click menu and keys
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SlidePanel from './SlidePanel'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const slides = [1, 2, 3].map(n => ({ id: `s${n}`, elements: [], background: { type: 'color', color: '#1e1e2e' } }))

let root, el
async function render(props = {}) {
  const handlers = {
    onSelect: vi.fn(), onAdd: vi.fn(), onAddColumn: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn(), onMove: vi.fn(),
    onMoveInColumn: vi.fn(), onMoveToColumn: vi.fn(), onImport: vi.fn(), onNewSlideAfter: vi.fn(), onDeleteMultiple: vi.fn(), onBackground: vi.fn(),
  }
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<SlidePanel slides={slides} currentIndex={0} {...handlers} {...props} />))
  return handlers
}
afterEach(() => {
  act(() => root.unmount())
  el.remove()
})

const items = () => [...document.querySelectorAll('[role=menu] button')]
const item = label => items().find(b => b.textContent.startsWith(label))
const key = async (k, extra = {}) => act(async () => el.querySelector('.slide-list').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra })))

describe('the slide list', () => {
  it('selects a slide right-clicked and offers what to do with it', async () => {
    const h = await render()
    await act(async () => el.querySelectorAll('.slide-item')[1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 30 })))
    expect(h.onSelect).toHaveBeenCalledWith(1)
    expect(items().map(b => b.textContent.replace(/(Ctrl\+|⌘).*$|Delete$/, ''))).toEqual(['New slide', 'Duplicate slide', 'Delete slide', 'Background…', 'Move to start', 'Move to end'])
    await act(async () => item('New slide').click())
    expect(h.onNewSlideAfter).toHaveBeenCalledWith(1)
    await act(async () => el.querySelectorAll('.slide-item')[2].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })))
    expect(item('Move to end').disabled).toBe(true)
    await act(async () => item('Move to start').click())
    expect(h.onMove).toHaveBeenCalledWith(2, 0)
  })

  it('deletes several selected slides together', async () => {
    const h = await render({ selectedIds: ['s1', 's3'] })
    await act(async () => el.querySelectorAll('.slide-item')[2].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })))
    await act(async () => item('Delete 2 slides').click())
    expect(h.onDeleteMultiple).toHaveBeenCalledWith([0, 2])
    await key('Delete')
    expect(h.onDeleteMultiple).toHaveBeenCalledTimes(2)
  })

  it('takes Delete, Ctrl+D and Enter for the selected slide', async () => {
    const h = await render({ currentIndex: 1 })
    await key('Delete')
    expect(h.onDelete).toHaveBeenCalledWith(1)
    await key('d', { ctrlKey: true })
    expect(h.onDuplicate).toHaveBeenCalledWith(1)
    await key('Enter')
    expect(h.onNewSlideAfter).toHaveBeenCalledWith(1)
  })
})
