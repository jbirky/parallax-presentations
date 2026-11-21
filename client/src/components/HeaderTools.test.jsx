// @vitest-environment happy-dom
// The editor's top-bar buttons: the ones that don't fit go into More
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import HeaderTools, { wrappedKeys } from './HeaderTools'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Which tools the layout put on the row's hidden second line
let wrapped = new Set()
const offsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')
beforeEach(() => {
  wrapped = new Set()
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get() { return wrapped.has(this.dataset?.key) ? 40 : 0 },
  })
})

let root, el
async function render(tools) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<HeaderTools tools={tools} />))
}
afterEach(() => {
  if (root) {
    act(() => root.unmount())
    el.remove()
    root = null
  }
  if (offsetTop) Object.defineProperty(HTMLElement.prototype, 'offsetTop', offsetTop)
  else delete HTMLElement.prototype.offsetTop
})

const button = text => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const more = () => el.querySelector('button[aria-label="More"]')
const click = async b => act(async () => b.click())

function tools() {
  return [
    { key: 'settings', label: 'Settings', title: 'Settings', onClick: vi.fn() },
    { key: 'export', label: 'Export', items: [{ label: 'Export PDF', action: vi.fn() }, { label: 'Export HTML', action: vi.fn() }] },
    { key: 'data', label: 'Data', onClick: vi.fn() },
    { key: 'sync', label: 'Sync', chevron: true, items: [{ label: 'GitHub', action: vi.fn() }, { divider: true }, { label: 'Git History', action: vi.fn() }] },
  ]
}

describe('wrappedKeys', () => {
  it('names the items below the first line', () => {
    const row = { children: [
      { offsetTop: 4, dataset: { key: 'a' } },
      { offsetTop: 4, dataset: { key: 'b' } },
      { offsetTop: 44, dataset: { key: 'c' } },
      { offsetTop: 44, dataset: { key: 'd' } },
    ] }
    expect(wrappedKeys(row)).toEqual(['c', 'd'])
    expect(wrappedKeys({ children: [] })).toEqual([])
  })
})

describe('HeaderTools', () => {
  it('shows every tool, and no More, when they all fit', async () => {
    await render(tools())
    expect(['Settings', 'Export', 'Data', 'Sync'].every(label => button(label))).toBe(true)
    expect(more()).toBeNull()
  })

  it('opens a dropdown and runs the item picked', async () => {
    const list = tools()
    await render(list)
    await click(button('Export'))
    expect(button('Export PDF')).toBeTruthy()
    await click(button('Export PDF'))
    expect(list[1].items[0].action).toHaveBeenCalled()
    expect(button('Export PDF')).toBeUndefined()
  })

  it('moves the tools that don’t fit into More', async () => {
    wrapped = new Set(['data', 'sync'])
    const list = tools()
    await render(list)
    // Out of sight and out of the tab order
    const data = el.querySelector('[data-key="data"]')
    expect(data.style.visibility).toBe('hidden')
    expect(data.getAttribute('aria-hidden')).toBe('true')
    expect(data.querySelector('button').tabIndex).toBe(-1)
    expect(el.querySelector('[data-key="settings"]').style.visibility).toBe('')

    await click(more())
    const menu = el.querySelector('[role="menu"]')
    const labels = [...menu.querySelectorAll('button')].map(b => b.textContent.trim())
    expect(labels).toEqual(['Data', 'GitHub', 'Git History'])
    // A dropdown's items come under its name
    expect(menu.textContent).toContain('Sync')
    await click([...menu.querySelectorAll('button')].find(b => b.textContent.trim() === 'Data'))
    expect(list[2].onClick).toHaveBeenCalled()
    expect(el.querySelector('[role="menu"]')).toBeNull()
  })

  it('closes an open dropdown on Escape', async () => {
    await render(tools())
    await click(button('Export'))
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(button('Export PDF')).toBeUndefined()
  })
})
