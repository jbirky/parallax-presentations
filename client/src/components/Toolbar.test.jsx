// @vitest-environment happy-dom
// The toolbar: the insert tools, or while text is being edited, its
// formatting tools in their place
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Toolbar from './Toolbar'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// A stand-in for the text editor: records the commands chained on it
function fakeEditor(active = []) {
  const calls = []
  const chain = new Proxy({}, {
    get: (_, name) => (name === 'run' ? () => true : () => { calls.push(name); return chain }),
  })
  return {
    calls,
    chain: () => chain,
    can: () => ({ undo: () => true, redo: () => true }),
    isActive: name => active.includes(name),
    getAttributes: () => ({}),
  }
}

let root, el
async function render(props) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<Toolbar onAddText={() => {}} onAddImage={() => {}} onAddShape={() => {}} {...props} />))
}
afterEach(() => {
  act(() => root.unmount())
  el.remove()
})

const titled = title => [...el.querySelectorAll('button')].filter(b => b.title === title)
const click = async b => act(async () => b.click())

describe('Toolbar', () => {
  it('shows the insert tools when no text is being edited', async () => {
    const onUndo = vi.fn()
    await render({ editor: null, canUndo: true, onUndo })
    expect(titled('Text tools')).toHaveLength(1)
    expect(titled('Shape tools')).toHaveLength(1)
    expect(el.textContent).toContain('Double-click a text box to edit')
    expect(titled('Bold')).toHaveLength(0)
    await click(titled('Undo (Ctrl+Z)')[0])
    expect(onUndo).toHaveBeenCalled()
  })

  it('puts the formatting tools in their place while editing, with one Undo', async () => {
    const editor = fakeEditor()
    const onUndo = vi.fn()
    await render({ editor, editingElementId: 'e1', canUndo: true, onUndo })
    expect(titled('Text tools')).toHaveLength(0)
    expect(titled('Shape tools')).toHaveLength(0)
    expect(titled('Bold')).toHaveLength(1)
    expect([...el.querySelectorAll('button')].filter(b => /^Undo/.test(b.title))).toHaveLength(1)
    // Undo undoes the typing, as Ctrl+Z does while editing
    await click(titled('Undo (Ctrl+Z)')[0])
    expect(editor.calls).toContain('undo')
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('keeps the less-used formatting under More', async () => {
    const editor = fakeEditor(['strike'])
    await render({ editor, editingElementId: 'e1' })
    expect(titled('Strikethrough')).toHaveLength(0)
    await click(titled('More formatting')[0])
    const menu = el.querySelector('[role="menu"]')
    const items = [...menu.querySelectorAll('button')].map(b => b.textContent.trim())
    expect(items).toEqual(['Strikethrough', 'Inline code', 'Code block', 'Quote', 'Image in text'])
    expect(menu.textContent).toContain('Weight')
    expect(menu.textContent).toContain('Line spacing')
    // What's on is marked
    expect(menu.querySelector('button [aria-label="on"]')).toBeTruthy()
    await click([...menu.querySelectorAll('button')].find(b => b.textContent.trim() === 'Code block'))
    expect(editor.calls).toContain('toggleCodeBlock')
    expect(el.querySelector('[role="menu"]')).toBeNull()
  })

  it('formats a whole selected box: no inserting into the text, and the presentation\u2019s Undo', async () => {
    const box = { ...fakeEditor(), wholeBox: true }
    const onUndo = vi.fn()
    await render({ editor: box, wholeBox: true, canUndo: true, onUndo })
    expect(titled('Bold')).toHaveLength(1)
    expect(titled('Table')).toHaveLength(0)
    expect(titled('Add link')).toHaveLength(0)
    expect(titled('Insert inline math ($\u2026$)')).toHaveLength(0)
    expect(el.textContent).not.toContain('Double-click a text box to edit')
    await click(titled('Undo (Ctrl+Z)')[0])
    expect(onUndo).toHaveBeenCalled()
    await click(titled('More formatting')[0])
    const items = [...el.querySelectorAll('[role="menu"] button')].map(b => b.textContent.trim())
    expect(items).not.toContain('Image in text')
  })

  it('opens the background popup when a menu asks', async () => {
    const slide = { id: 's1', elements: [], background: { type: 'color', color: '#1e1e2e' } }
    await render({ editor: null, slide, onUpdateSlide: () => {}, bgRequest: 0 })
    expect(el.querySelector('.bg-type-tab')).toBeNull()
    await act(async () => root.render(<Toolbar onAddText={() => {}} onAddImage={() => {}} onAddShape={() => {}} editor={null} slide={slide} onUpdateSlide={() => {}} bgRequest={1} />))
    expect(el.querySelector('.bg-type-tab')).toBeTruthy()
  })
})
