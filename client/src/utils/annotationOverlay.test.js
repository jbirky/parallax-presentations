// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { installAnnotations } from './annotationOverlay'

const KEY = 'parallax-annotations:p1:set1'

// A presented deck of two slides shown at half size at (100, 50), with enough
// of reveal.js for the overlay
function present(set = { id: 'set1', name: 'S', createdAt: '2026-09-24T10:00:00.000Z', slides: {}, boards: [] }) {
  document.head.innerHTML = ''
  document.body.innerHTML = '<div class="reveal"><div class="slides"><section data-slide-id="s1"></section><section data-slide-id="s2"></section></div></div>'
  const pages = () => [...document.querySelectorAll('.slides > section')]
  for (const s of pages()) s.getBoundingClientRect = () => ({ left: 100, top: 50, width: 480, height: 270, right: 580, bottom: 320 })
  let current = pages()[0]
  const handlers = {}
  globalThis.Reveal = {
    getCurrentSlide: () => current,
    on: (event, fn) => { (handlers[event] = handlers[event] || []).push(fn) },
    sync: vi.fn(() => { for (const s of pages()) s.getBoundingClientRect = pages()[0].getBoundingClientRect }),
    isOverview: () => false,
    isReady: () => true,
    getIndices: s => ({ h: pages().indexOf(s), v: 0 }),
    slide: h => { current = pages()[h]; (handlers.slidechanged || []).forEach(f => f()) },
    prev: () => { current = pages()[Math.max(0, pages().indexOf(current) - 1)] },
  }
  const opener = { closed: false, postMessage: vi.fn() }
  Object.defineProperty(window, 'opener', { value: opener, configurable: true })
  window.confirm = () => true
  localStorage.clear()
  const api = installAnnotations({ presentationId: 'p1', set, slideW: 960, slideH: 540, backupKey: KEY, message: 'parallax-annotations' })
  return { api, set, opener, pages, shield: document.querySelector('.pp-shield'), goTo: i => { current = pages()[i] } }
}

let nextPointer = 1
function stroke(shield, points, pointerType = 'mouse') {
  const pointerId = nextPointer++
  const fire = (type, [x, y]) => shield.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId, pointerType, button: 0 }))
  fire('pointerdown', points[0])
  for (const p of points.slice(1)) fire('pointermove', p)
  fire('pointerup', points[points.length - 1])
}
const press = (key, init = {}) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  window.dispatchEvent(e)
  return e
}
const click = label => document.querySelector(`.pp-bar button[aria-label="${label}"]`).click()
const across = [[100, 50], [220, 117.5], [340, 185], [460, 252.5], [580, 320]] // corner to corner, in a straight line

describe('drawing while presenting', () => {
  it('D turns drawing on, and strokes are kept in slide coordinates', () => {
    const { set, shield, pages } = present()
    press('d')
    expect(document.documentElement.classList.contains('pp-on')).toBe(true)
    stroke(shield, across)
    const [path] = set.slides.s1.paths
    expect(path.points[0]).toEqual([0, 0])
    expect(path.points[path.points.length - 1]).toEqual([960, 540])
    expect(path.points.length).toBe(2) // a straight line simplifies to its ends
    expect(path).toMatchObject({ color: '#ef4444', strokeWidth: 3, opacity: 1 })
    expect(pages()[0].querySelectorAll('svg.pp-ink path')).toHaveLength(1)
  })

  it('does nothing until drawing is on', () => {
    const { set, shield } = present()
    stroke(shield, across)
    expect(set.slides.s1).toBeUndefined()
  })

  it('saves to the editor and keeps a copy on this device', () => {
    const { api, opener, shield } = present()
    press('d')
    stroke(shield, across)
    api.flush()
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'parallax-annotations', presentationId: 'p1', set: expect.objectContaining({ id: 'set1' }) }),
      window.location.origin)
    const copy = JSON.parse(localStorage.getItem(KEY))
    expect(copy.slides.s1.paths).toHaveLength(1)
    expect(copy.updatedAt).toBeTruthy()
  })

  it('keeps the ink on this device when the editor is closed', () => {
    const { api, opener, shield } = present()
    opener.closed = true
    press('d')
    stroke(shield, across)
    api.flush()
    expect(opener.postMessage).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(KEY)).slides.s1.paths).toHaveLength(1)
    expect(document.querySelector('.pp-status').textContent).toMatch(/Kept on this device/)
  })

  it('doesn’t save a session with no ink', () => {
    const { api, opener } = present()
    api.flush()
    expect(opener.postMessage).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('lets fingers change slides once a stylus has drawn', () => {
    const { set, shield } = present()
    press('d')
    stroke(shield, across, 'touch') // before any stylus, a finger draws
    stroke(shield, across, 'pen')
    stroke(shield, across, 'touch')
    expect(set.slides.s1.paths).toHaveLength(2)
  })

  it('erases a stroke, and undo brings it back', () => {
    const { set, shield } = present()
    press('d')
    stroke(shield, across)
    press('e')
    stroke(shield, [[340, 185]])
    expect(set.slides.s1.paths).toHaveLength(0)
    press('z', { ctrlKey: true })
    expect(set.slides.s1.paths).toHaveLength(1)
  })

  it('keeps highlighter strokes wide and translucent, and laser strokes not at all', () => {
    const { set, shield } = present()
    click('Highlighter')
    stroke(shield, across)
    expect(set.slides.s1.paths[0]).toMatchObject({ strokeWidth: 12, opacity: 0.35 })
    click('Laser pointer')
    stroke(shield, across)
    expect(set.slides.s1.paths).toHaveLength(1)
  })

  it('Esc stops drawing without reaching reveal.js', () => {
    present()
    press('d')
    const esc = press('Escape')
    expect(esc.defaultPrevented).toBe(true)
    expect(document.documentElement.classList.contains('pp-on')).toBe(false)
  })
})

describe('whiteboard pages', () => {
  it('adds a board after the current slide, draws on it, and deletes it', () => {
    const { set, shield, pages } = present()
    press('d')
    click('New board after this slide')
    expect(pages().map(s => s.getAttribute('data-slide-id') || 'board')).toEqual(['s1', 'board', 's2'])
    expect(set.boards).toEqual([expect.objectContaining({ afterId: 's1', paths: [] })])
    expect(Reveal.sync).toHaveBeenCalled()
    stroke(shield, across) // Reveal.slide moved to the board
    expect(set.boards[0].paths).toHaveLength(1)
    expect(set.slides.s1).toBeUndefined()
    click('Delete this board')
    expect(pages().map(s => s.getAttribute('data-slide-id'))).toEqual(['s1', 's2'])
    expect(set.boards).toEqual([])
  })
})

describe('continuing a saved session', () => {
  it('shows its ink and puts its boards back', () => {
    const path = { points: [[0, 0], [960, 540]], color: '#22c55e', strokeWidth: 6, opacity: 1 }
    const { pages } = present({
      id: 'set1', name: 'S', createdAt: '2026-09-24T10:00:00.000Z',
      slides: { s2: { paths: [path] } },
      boards: [{ id: 'b1', afterId: 's2', paths: [path] }],
    })
    expect(pages().map(s => s.getAttribute('data-slide-id') || s.getAttribute('data-board-id'))).toEqual(['s1', 's2', 'b1'])
    expect(pages()[0].querySelector('svg.pp-ink')).toBeNull()
    expect(pages()[1].querySelector('svg.pp-ink path').getAttribute('stroke')).toBe('#22c55e')
    expect(pages()[2].querySelectorAll('svg.pp-ink path')).toHaveLength(1)
  })
})
