// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import OutlinePanel, { PanelViewSwitch } from './OutlinePanel'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const deck0 = () => ({
  title: 'Talk', timerDuration: 12,
  slides: [
    { id: 'a', notes: 'Say hello', elements: [{ id: 't', type: 'text', x: 0, y: 0, width: 800, height: 400, content: '<h2>Rotation curves</h2><ul><li><p>Flat</p></li></ul>' }, { id: 'g', type: 'shape', x: 0, y: 0, width: 10, height: 10 }] },
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
  function Harness() {
    const [deck, setDeck] = useState(deck0)
    seen.deck = deck
    return <OutlinePanel deck={deck} setDeck={setDeck} {...props} />
  }
  act(() => root.render(<Harness />))
  return seen
}
const rows = () => [...host.querySelectorAll('.ol-row')].map(r => r.className.split(' ')[1].slice(2) + ':' + (r.querySelector('.ol-text, .ol-item')?.textContent || ''))
const line = key => host.querySelector(`.ol-text[data-key="${key}"]`)

describe('the outline panel', () => {
  it('shows the deck as lines, with the plan of minutes', () => {
    mount()
    expect(rows()).toEqual(['slide:Rotation curves', 'point:Flat', 'item:Shape', 'note:Say hello', 'section:Data', 'slide:The sample'])
    expect(host.querySelector('.ol-plan-row').textContent).toMatch(/^2 min planned of.*min10 to spare$/)
  })

  it('writes what’s typed into a line to the deck', () => {
    const seen = mount()
    const el = line('a:p0')
    act(() => { el.innerHTML = 'Flat <strong>out</strong>'; el.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(seen.deck.slides[0].elements[0].content).toBe('<h2>Rotation curves</h2><ul><li><p>Flat <strong>out</strong></p></li></ul>')
    const note = line('a:n0')
    act(() => { note.textContent = 'Say hi'; note.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(seen.deck.slides[0].notes).toBe('Say hi')
  })

  it('folds a slide with nothing else on it into the one above, as one undo step', () => {
    const onNotice = vi.fn(), stopCapturing = vi.fn()
    const seen = mount({ onNotice, stopCapturing })
    act(() => { line('b').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })) })
    expect(seen.deck.slides.map(s => s.id)).toEqual(['a'])
    expect(stopCapturing).toHaveBeenCalledTimes(2)
    expect(onNotice).not.toHaveBeenCalled()
  })

  it('says why the first slide won’t fold into a point', () => {
    const onNotice = vi.fn()
    const seen = mount({ onNotice })
    act(() => { line('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })) })
    expect(onNotice).toHaveBeenCalledWith(expect.stringMatching(/first slide/))
    expect(seen.deck.slides).toHaveLength(2)
  })

  it('goes to a line’s slide, leaving the canvas, and selects what’s listed', () => {
    const onSelectSlide = vi.fn(), onLeaveCanvas = vi.fn(), onSelectElement = vi.fn()
    mount({ onSelectSlide, onLeaveCanvas, onSelectElement, currentIndex: 0 })
    act(() => { line('b').dispatchEvent(new FocusEvent('focus', { bubbles: false })); line('b').focus() })
    expect(onLeaveCanvas).toHaveBeenCalled()
    expect(onSelectSlide).toHaveBeenCalledWith(1)
    act(() => { host.querySelector('.ol-item').click() })
    expect(onSelectElement).toHaveBeenCalledWith(0, 'g')
  })

  it('locks a line someone else is editing on the slide', () => {
    mount({ peers: [{ userId: 'u2', name: 'Ada', color: '#f97316', editing: 't' }] })
    expect(line('a').getAttribute('contenteditable')).toBe('false')
    expect(line('b').getAttribute('contenteditable')).toBe('true')
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
