// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ContextMenu, { menuItems } from './ContextMenu'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
async function render(props) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<ContextMenu x={10} y={10} {...props} />))
}
afterEach(() => {
  if (root) { act(() => root.unmount()); el.remove(); root = null }
})

describe('menuItems', () => {
  it('drops what’s left out, and lines at the ends or twice', () => {
    const a = { label: 'A' }, b = { label: 'B' }
    expect(menuItems(['-', a, false, '-', '-', null, b, '-'])).toEqual([a, '-', b])
    expect(menuItems([false, '-'])).toEqual([])
  })
})

describe('ContextMenu', () => {
  it('runs the item picked and closes', async () => {
    const onClose = vi.fn()
    const cut = vi.fn()
    await render({ onClose, items: [{ label: 'Cut', shortcut: 'Mod+X', action: cut }, '-', { label: 'Grid', checked: true, action: () => {} }] })
    const buttons = [...document.querySelectorAll('[role=menu] button')]
    expect(buttons.map(b => b.getAttribute('role'))).toEqual(['menuitem', 'menuitemcheckbox'])
    expect(buttons[0].textContent).toMatch(/^Cut(Ctrl\+X|⌘X)$/)
    expect(buttons[1].getAttribute('aria-checked')).toBe('true')
    await act(async () => buttons[0].click())
    expect(cut).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape, without the key going further', async () => {
    const onClose = vi.fn()
    const later = vi.fn()
    document.addEventListener('keydown', later)
    await render({ onClose, items: [{ label: 'Copy', action: () => {} }] })
    await act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalled()
    expect(later).not.toHaveBeenCalled()
    document.removeEventListener('keydown', later)
  })

  it('closes on a click elsewhere, not on itself', async () => {
    const onClose = vi.fn()
    await render({ onClose, items: [{ label: 'Paste', disabled: true, action: () => {} }] })
    await act(async () => document.querySelector('[role=menu]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(onClose).toHaveBeenCalled()
  })
})
