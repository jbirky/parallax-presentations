// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import OutlinePanel, { PanelViewSwitch } from './OutlinePanel'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const deck0 = () => ({
  title: 'Talk', timerDuration: 12,
  slides: [
    { id: 'a', notes: 'Say hello', outlineNotes: [{ text: 'Open with the curve', level: 0 }], elements: [{ id: 't', type: 'text', x: 0, y: 0, width: 800, height: 400, content: '<h2>Rotation curves</h2><ul><li><p>Flat</p></li></ul>' }, { id: 'g', type: 'shape', x: 0, y: 0, width: 10, height: 10 }] },
    { id: 'b', section: 'Data', minutes: 2, elements: [{ id: 'u', type: 'text', x: 0, y: 0, width: 800, height: 400, content: '<h2>The sample</h2>' }] },
  ],
})

let root, host
afterEach(() => { act(() => root.unmount()); host.remove() })

function mount(props = {}) {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  const seen = { deck: null }
  // Runs an updater at once, as the editor's deck store does (useDeckDoc)
  let current = deck0()
  function Harness() {
    const [deck, setState] = useState(current)
    seen.deck = deck
    const setDeck = update => { current = typeof update === 'function' ? update(current) : update; setState(current) }
    return <OutlinePanel deck={deck} setDeck={setDeck} {...props} />
  }
  act(() => root.render(<Harness />))
  return seen
}
const rows = () => [...host.querySelectorAll('.ol-row')].map(r => r.className.split(' ')[1].slice(2) + ':' + (r.querySelector('.ol-text, .ol-item')?.textContent || ''))
const line = key => host.querySelector(`.ol-text[data-key="${key}"]`)
const key = (el, k, extra = {}) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra })) })

describe('the outline panel', () => {
  it('shows each slide’s title and its outline notes, with the plan of minutes', () => {
    mount()
    expect(rows()).toEqual(['slide:Rotation curves', 'note:Open with the curve', 'section:Data', 'slide:The sample', 'note:'])
    expect(line('b:o0').dataset.ph).toBe('Add a note')
    expect(host.querySelector('.ol-plan-row').textContent).toMatch(/^2 min planned of.*min10 to spare$/)
  })

  it('keeps what’s typed in the outline, leaving the slide as it was', () => {
    const seen = mount()
    const before = seen.deck.slides[1]
    const el = line('b:o0')
    act(() => { el.textContent = 'Show the selection cuts'; el.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(seen.deck.slides[1].outlineNotes).toEqual([{ text: 'Show the selection cuts', level: 0 }])
    expect(seen.deck.slides[1].elements).toBe(before.elements)
  })

  it('shows titles that can’t be typed into', () => {
    mount()
    expect(line('a').getAttribute('contenteditable')).toBeNull()
    expect(line('a').tabIndex).toBe(0)
    expect(line('a:o0').getAttribute('contenteditable')).toBe('true')
  })

  it('adds a blank slide with Enter on a title, as one undo step, and takes it away with Backspace', () => {
    const stopCapturing = vi.fn(), onNotice = vi.fn()
    const seen = mount({ stopCapturing, onNotice })
    key(line('a'), 'Enter')
    expect(seen.deck.slides).toHaveLength(3)
    const added = seen.deck.slides[1]
    expect(added.elements).toEqual([])
    expect(stopCapturing).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(line(added.id + ':o0'))
    key(line(added.id), 'Backspace')
    expect(seen.deck.slides.map(s => s.id)).toEqual(['a', 'b'])
    key(line('a'), 'Backspace')
    expect(seen.deck.slides).toHaveLength(2)
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/has things on it/))
  })

  it('keeps a title’s keys from the editor’s shortcuts', () => {
    const onUndo = vi.fn(), outside = vi.fn()
    mount({ onUndo })
    document.addEventListener('keydown', outside)
    try {
      key(line('a'), 'z', { ctrlKey: true })
      key(line('a'), 'v', { ctrlKey: true })
    } finally { document.removeEventListener('keydown', outside) }
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(outside).not.toHaveBeenCalled()
  })

  it('goes to a line’s slide, leaving the canvas', () => {
    const onSelectSlide = vi.fn(), onLeaveCanvas = vi.fn()
    mount({ onSelectSlide, onLeaveCanvas, currentIndex: 0 })
    act(() => { line('b').focus() })
    expect(onLeaveCanvas).toHaveBeenCalled()
    expect(onSelectSlide).toHaveBeenCalledWith(1)
  })

  it('switches the left panel', () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    const onChange = vi.fn()
    act(() => root.render(<PanelViewSwitch view="slides" onChange={onChange} />))
    act(() => { [...host.querySelectorAll('button')].find(b => b.textContent === 'Outline').click() })
    expect(onChange).toHaveBeenCalledWith('outline')
  })
})
