// @vitest-environment happy-dom
// Speaker notes under the slide: one line to click without notes, a strip
// that keeps its height with them
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import NotesStrip from './NotesStrip'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root, el
async function render(props) {
  el = document.createElement('div')
  document.body.appendChild(el)
  root = createRoot(el)
  await act(async () => root.render(<NotesStrip slideNumber={2} onChange={() => {}} {...props} />))
}
beforeEach(() => { try { localStorage.removeItem('parallax-notes-height') } catch { /* none */ } })
afterEach(() => {
  act(() => root.unmount())
  el.remove()
})

describe('NotesStrip', () => {
  it('is one line to click when the slide has no notes, and opens to write them', async () => {
    const onChange = vi.fn()
    await render({ notes: '', onChange })
    const line = el.querySelector('button')
    expect(line.textContent).toBe('Click to add speaker notes')
    expect(el.querySelector('textarea')).toBeNull()
    await act(async () => line.click())
    const text = el.querySelector('textarea[aria-label="Speaker notes for slide 2"]')
    expect(document.activeElement).toBe(text)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(text, 'Thank the hosts')
      text.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('Thank the hosts')
  })

  it('shows a slide’s notes, and resizes from its top edge with the arrow keys, remembering the height', async () => {
    await render({ notes: 'Pause here' })
    expect(el.querySelector('textarea').value).toBe('Pause here')
    const strip = el.querySelector('.notes-strip')
    const edge = el.querySelector('[role=separator]')
    expect(strip.style.height).toBe('110px')
    await act(async () => edge.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })))
    expect(strip.style.height).toBe('126px')
    expect(localStorage.getItem('parallax-notes-height')).toBe('126')
    for (let i = 0; i < 10; i++) await act(async () => edge.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(strip.style.height).toBe('56px')
  })
})
