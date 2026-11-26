// @vitest-environment happy-dom
// Dragging on the canvas always ends: a selected embed's frame (which takes
// the mouse) lets it through while something is dragged, so letting go is
// heard; a move with no button down ends a drag whose letting go wasn't heard;
// and Escape puts what was dragged back.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SlideCanvas from './SlideCanvas'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const embed = { id: 'emb', type: 'html', x: 100, y: 100, width: 300, height: 200, zIndex: 1, content: '<p>embed</p>' }

async function mount() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const onUpdateElement = vi.fn()
  await act(async () => root.render(
    <SlideCanvas slide={{ id: 's1', elements: [embed] }} selectedElementIds={[]} editingElementId={null}
      onToggleSelectElement={() => {}} onStartEdit={() => {}} onStopEdit={() => {}}
      onUpdateElement={onUpdateElement} onUpdateElements={() => {}} />
  ))
  const box = el.querySelector('[data-element-id="emb"]')
  const mouse = (type, x, y, buttons) => act(async () => {
    (type === 'mousedown' ? box : document).dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, buttons, button: 0 }))
  })
  return { el, root, onUpdateElement, mouse }
}

const held = () => document.documentElement.classList.contains('px-frames-held')

afterEach(() => document.documentElement.classList.remove('px-frames-held'))

describe('dragging on the canvas', () => {
  it('lets embeds\' frames pass the mouse through while the button is down', async () => {
    const page = await mount()
    await page.mouse('mousedown', 10, 10, 1)
    expect(held()).toBe(true)
    await page.mouse('mouseup', 10, 10, 0)
    expect(held()).toBe(false)
    act(() => page.root.unmount())
  })

  it('ends a drag when the mouse moves with no button down', async () => {
    const page = await mount()
    await page.mouse('mousedown', 10, 10, 1)
    await page.mouse('mousemove', 30, 20, 1)
    await page.mouse('mousemove', 40, 30, 1)
    expect(page.onUpdateElement).toHaveBeenCalled()
    // Let go over the embed's frame: this page never hears the mouseup
    page.onUpdateElement.mockClear()
    await page.mouse('mousemove', 60, 50, 0)
    await page.mouse('mousemove', 90, 70, 0)
    expect(page.onUpdateElement).not.toHaveBeenCalled()
    expect(held()).toBe(false)
    act(() => page.root.unmount())
  })

  it('puts what was dragged back on Escape', async () => {
    const page = await mount()
    await page.mouse('mousedown', 10, 10, 1)
    await page.mouse('mousemove', 30, 20, 1)
    await page.mouse('mousemove', 40, 30, 1)
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(page.onUpdateElement).toHaveBeenLastCalledWith('emb', { x: 100, y: 100, width: 300, height: 200 })
    page.onUpdateElement.mockClear()
    await page.mouse('mousemove', 80, 60, 1)
    expect(page.onUpdateElement).not.toHaveBeenCalled()
    act(() => page.root.unmount())
  })
})
