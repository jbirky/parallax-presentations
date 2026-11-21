// @vitest-environment happy-dom
// The menu bar: menus that open on a press, follow the pointer and the arrow
// keys, keep the focus where it was, and a search across them
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import MenuBar, { MenuSearch, menuCommands, searchCommands } from './MenuBar'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
async function render(ui) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(ui))
}
afterEach(() => {
  if (root) { act(() => root.unmount()); el.remove(); root = null }
})

const title = name => [...el.querySelectorAll('.menu-title')].find(b => b.textContent === name)
const press = async name => act(async () => title(name).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })))
const key = async (k, extra = {}) => act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra })))
const rows = () => [...el.querySelectorAll('.menu-dropdown [role^=menuitem]')]
const label = b => b.querySelector('.menu-label').textContent.replace(/^[✓•]/, '').trim()
const active = () => rows().filter(b => b.classList.contains('active')).map(label)

function menus(spy = {}) {
  return [
    { key: 'file', label: 'File', items: [
      { label: 'Export', items: [{ label: 'PDF', action: spy.pdf || (() => {}) }, { label: 'HTML', action: () => {} }] },
      '-',
      { label: 'Deck settings…', action: spy.settings || (() => {}) },
    ] },
    { key: 'edit', label: 'Edit', items: [
      { label: 'Undo', shortcut: 'Mod+Z', action: () => {}, disabled: true },
      { label: 'Paste', shortcut: 'Mod+V', action: spy.paste || (() => {}) },
      false,
      { label: 'Grid', checked: true, action: () => {} },
    ] },
  ]
}

describe('MenuBar', () => {
  it('opens a menu on a press without taking the focus, and runs what is picked', async () => {
    const settings = vi.fn()
    await render(<MenuBar menus={menus({ settings })} />)
    expect(el.querySelector('[role=menubar]')).toBeTruthy()
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    await act(async () => title('File').dispatchEvent(down))
    // The focus stays where it was (as in text being edited)
    expect(down.defaultPrevented).toBe(true)
    expect(title('File').getAttribute('aria-expanded')).toBe('true')
    expect(rows().map(label)).toEqual(['Export', 'Deck settings…'])
    expect(el.querySelector('.menu-separator')).toBeTruthy()
    await act(async () => rows()[1].click())
    expect(settings).toHaveBeenCalled()
    expect(el.querySelector('.menu-dropdown')).toBeNull()
  })

  it('shows shortcuts, checks and what can’t be picked, and leaves out what’s left out', async () => {
    await render(<MenuBar menus={menus()} />)
    await press('Edit')
    const [undo, paste, grid] = rows()
    expect(rows()).toHaveLength(3)
    expect(undo.disabled).toBe(true)
    expect(paste.textContent).toMatch(/Paste(Ctrl\+V|⌘V)/)
    expect(grid.getAttribute('role')).toBe('menuitemcheckbox')
    expect(grid.getAttribute('aria-checked')).toBe('true')
  })

  it('follows the pointer to another menu while one is open', async () => {
    await render(<MenuBar menus={menus()} />)
    await press('File')
    await act(async () => title('Edit').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
    expect(title('Edit').getAttribute('aria-expanded')).toBe('true')
    expect(title('File').getAttribute('aria-expanded')).toBe('false')
  })

  it('moves with the arrow keys into submenus and across menus, skipping what can’t be picked', async () => {
    const pdf = vi.fn()
    const paste = vi.fn()
    await render(<MenuBar menus={menus({ pdf, paste })} />)
    await press('File')
    await key('ArrowDown')
    expect(active()).toEqual(['Export'])
    await key('ArrowRight')
    expect(rows().map(label)).toEqual(['Export', 'PDF', 'HTML', 'Deck settings…'])
    expect(active()).toEqual(['Export', 'PDF'])
    // The keys go no further than the menu
    const later = vi.fn()
    document.addEventListener('keydown', later)
    await key('Enter')
    document.removeEventListener('keydown', later)
    expect(later).not.toHaveBeenCalled()
    expect(pdf).toHaveBeenCalled()

    await press('File')
    await key('ArrowLeft')
    expect(title('Edit').getAttribute('aria-expanded')).toBe('true')
    // Undo can't be picked, so Paste is first
    expect(active()).toEqual(['Paste'])
    await key(' ')
    expect(paste).toHaveBeenCalled()
  })

  it('closes a submenu, then the menu, on Escape, and the menu on a press elsewhere', async () => {
    await render(<MenuBar menus={menus()} />)
    await press('File')
    await act(async () => rows()[0].click())
    expect(rows().map(label)).toContain('PDF')
    await key('Escape')
    expect(rows().map(label)).toEqual(['Export', 'Deck settings…'])
    await key('Escape')
    expect(el.querySelector('.menu-dropdown')).toBeNull()
    await press('Edit')
    await act(async () => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(el.querySelector('.menu-dropdown')).toBeNull()
  })
})

describe('searching the menus', () => {
  it('lists every command with the menus it’s in, and finds them by any words', () => {
    const commands = menuCommands([...menus(), { key: 'insert', label: 'Insert', items: [{ label: 'Science', items: [{ label: 'Molecule', keywords: 'chemistry', action: () => {} }] }] }])
    expect(commands.map(c => [...c.trail, c.label].join(' › '))).toEqual([
      'File › Export › PDF', 'File › Export › HTML', 'File › Deck settings…', 'Edit › Undo', 'Edit › Paste', 'Edit › Grid', 'Insert › Science › Molecule',
    ])
    expect(searchCommands(commands, 'export pdf').map(c => c.label)).toEqual(['PDF'])
    expect(searchCommands(commands, 'chem').map(c => c.label)).toEqual(['Molecule'])
    expect(searchCommands(commands, '  ')).toEqual([])
  })

  it('runs the command found with Enter, and closes on Escape', async () => {
    const pdf = vi.fn()
    const onClose = vi.fn()
    await render(<MenuSearch menus={menus({ pdf })} onClose={onClose} />)
    const input = document.querySelector('input[aria-label="Search the menus"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'pdf')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const options = [...document.querySelectorAll('[role=option]')]
    expect(options.map(o => o.textContent)).toEqual(['PDFFile › Export'])
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(pdf).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    onClose.mockClear()
    await act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalled()
  })
})
