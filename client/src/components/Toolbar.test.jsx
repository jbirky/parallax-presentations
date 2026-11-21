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

// A button by its tooltip, with or without the shortcut it names: "Bold (Ctrl+B)"
const titled = title => [...el.querySelectorAll('button')].filter(b => b.title === title || b.title.startsWith(`${title} (`))
const click = async b => act(async () => b.click())

describe('Toolbar', () => {
  it('shows one row of insert tools when no text is being edited', async () => {
    const onUndo = vi.fn()
    const onAddText = vi.fn()
    await render({ editor: null, canUndo: true, onUndo, onAddText, onNewSlide: () => {}, onNewSlideFromLayout: () => {}, onAddTable: () => {},
      insertGroups: [{ heading: 'Media', items: [{ label: 'Video', action: () => {} }] }], scienceItems: [{ label: 'Graph', action: () => {} }] })
    const labels = [...el.querySelectorAll('.toolbar > button, .toolbar > div > button')].map(b => b.textContent.trim()).filter(Boolean)
    expect(labels).toEqual(['New slide', 'Text box', 'Image', 'Shape', 'Table', 'Insert', 'Science'])
    expect(el.textContent).toContain('Double-click a text box to edit')
    expect(titled('Bold')).toHaveLength(0)
    await click(titled('Text box')[0])
    expect(onAddText).toHaveBeenCalled()
    await click(titled('Undo (Ctrl+Z)')[0])
    expect(onUndo).toHaveBeenCalled()
  })

  it('groups the rest under Insert, with a search, and runs what’s picked', async () => {
    const video = vi.fn(), sketch = vi.fn()
    await render({ editor: null, insertGroups: [
      { heading: 'Media', docs: 'media', items: [{ label: 'Upload video…', keywords: 'movie', action: video }] },
      { heading: 'Embed', items: [{ label: 'p5.js', action: sketch }, { label: 'Lines', items: [{ label: 'Thin line', action: () => {} }] }] },
    ] })
    await click(titled('Everything else that can go on a slide')[0])
    const menu = el.querySelector('.tool-menu')
    expect([...menu.querySelectorAll('.insert-heading span')].map(h => h.textContent)).toEqual(['Media', 'Embed'])
    // A search by a word the item doesn't show
    const search = menu.querySelector('input[aria-label="Search what to insert"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'movie')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect([...menu.querySelectorAll('.insert-item')].map(b => b.textContent.trim())).toEqual(['Upload video…'])
    await click(menu.querySelector('.insert-item'))
    expect(video).toHaveBeenCalled()
    expect(el.querySelector('.tool-menu')).toBeNull()
  })

  it('picks a table’s rows and columns from a grid', async () => {
    const onAddTable = vi.fn()
    await render({ editor: null, onAddTable })
    await click(titled('Table: pick its rows and columns')[0])
    await click(el.querySelector('[role="grid"] button[aria-label="2 × 4"]'))
    expect(onAddTable).toHaveBeenCalledWith(2, 4)
  })

  it('offers what the selection can do: an image’s Crop and Replace, a diagram’s Edit, Align for several', async () => {
    const onSelectionCommand = vi.fn()
    await render({ editor: null, selection: { count: 1, image: true }, onSelectionCommand })
    await click(titled('Crop the image')[0])
    expect(onSelectionCommand).toHaveBeenCalledWith('crop')
    expect(titled('Replace the image with another file')).toHaveLength(1)
    // Nothing selected: no hint once something is
    expect(el.textContent).not.toContain('Double-click a text box to edit')
    await act(async () => root.render(<Toolbar onAddText={() => {}} onAddImage={() => {}} onAddShape={() => {}} editor={null} selection={{ count: 1, editLabel: 'Edit circuit' }} onSelectionCommand={onSelectionCommand} />))
    await click(titled('Edit circuit')[0])
    expect(onSelectionCommand).toHaveBeenCalledWith('edit')
    const onAlignElements = vi.fn()
    await act(async () => root.render(<Toolbar onAddText={() => {}} onAddImage={() => {}} onAddShape={() => {}} editor={null} selection={{ count: 3 }} onSelectionCommand={onSelectionCommand} onAlignElements={onAlignElements} />))
    await click(titled('Align or distribute the 3 selected')[0])
    await click([...el.querySelectorAll('.tool-menu button')].find(b => b.textContent === 'Distribute vertically'))
    expect(onAlignElements).toHaveBeenCalledWith('distribute-v')
  })

  it('puts the formatting tools in their place while editing, with one Undo', async () => {
    const editor = fakeEditor()
    const onUndo = vi.fn()
    await render({ editor, editingElementId: 'e1', canUndo: true, onUndo })
    expect(titled('Text box')).toHaveLength(0)
    expect(titled('Shape')).toHaveLength(0)
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
    const items = [...menu.querySelectorAll('button')].map(b => b.textContent.replace(/(Ctrl\+|⌘).*$/, '').trim())
    expect(items).toEqual(['Strikethrough', 'Inline code', 'Code block', 'Quote', 'Image in text'])
    // with the text editor's shortcuts
    expect(menu.querySelector('button').textContent).toMatch(/Strikethrough(Ctrl\+Shift\+S|⌘⇧S)/)
    expect(menu.textContent).toContain('Weight')
    expect(menu.textContent).toContain('Line spacing')
    // What's on is marked
    expect(menu.querySelector('button [aria-label="on"]')).toBeTruthy()
    await click([...menu.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Code block')))
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
    await render({ editor: null, slide, onUpdateSlide: () => {}, request: null })
    expect(el.querySelector('.bg-type-tab')).toBeNull()
    expect(titled("The slide's background")[0].textContent.trim()).toBe('Background')
    await act(async () => root.render(<Toolbar onAddText={() => {}} onAddImage={() => {}} onAddShape={() => {}} editor={null} slide={slide} onUpdateSlide={() => {}} request={{ name: 'background', n: 1 }} />))
    expect(el.querySelector('.bg-type-tab')).toBeTruthy()
    // Escape closes it
    await act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(el.querySelector('.bg-type-tab')).toBeNull()
  })
})

describe('tooltips', () => {
  it('name the shortcut of each formatting tool', async () => {
    await render({ editor: fakeEditor(), editingElementId: 'e1' })
    const mac = /Mac/.test(navigator.platform)
    const title = name => titled(name)[0].title
    expect(title('Bold')).toBe(mac ? 'Bold (⌘B)' : 'Bold (Ctrl+B)')
    expect(title('Align center')).toBe(mac ? 'Align center (⌘⇧E)' : 'Align center (Ctrl+Shift+E)')
    expect(title('Heading 1')).toBe(mac ? 'Heading 1 (⌘⌥1)' : 'Heading 1 (Ctrl+Alt+1)')
    expect(title('Add link')).toBe(mac ? 'Add link (⌘K)' : 'Add link (Ctrl+K)')
  })
})
