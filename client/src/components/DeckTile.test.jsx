// @vitest-environment happy-dom
// A presentation's first slide on its dashboard card (DeckTile), from what
// the lists send of it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import DeckTile, { tileSlide } from './DeckTile'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const pres = (extra = {}) => ({
  id: 'p1', title: 'Talk', theme: 'white',
  thumbnail: null,
  firstSlide: { id: 's1', elements: [{ id: 'e1', type: 'text', content: '<h2>Hello, cards</h2>', x: 60, y: 150, width: 840, height: 120 }] },
  ...extra,
})

let saved
beforeEach(() => {
  saved = {
    io: globalThis.IntersectionObserver,
    w: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
    h: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
  }
  // The card is 320 × 180, and on the screen
  delete globalThis.IntersectionObserver
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return 320 } })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 180 } })
})
afterEach(() => {
  if (saved.io) globalThis.IntersectionObserver = saved.io
  for (const [k, d] of [['clientWidth', saved.w], ['clientHeight', saved.h]]) {
    if (d) Object.defineProperty(HTMLElement.prototype, k, d)
    else delete HTMLElement.prototype[k]
  }
})

async function mount(p) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => root.render(<DeckTile pres={p} />))
  return { el, unmount: () => act(() => root.unmount()) }
}

describe('tileSlide', () => {
  it('puts the background the list sends apart back on the slide', () => {
    const bg = { type: 'color', color: '#123456' }
    expect(tileSlide(pres({ thumbnail: bg })).background).toEqual(bg)
    expect(tileSlide(pres()).background).toBeUndefined()
    expect(tileSlide({ id: 'old' })).toBeNull()
  })
})

describe('DeckTile', () => {
  it('draws the first slide\'s text, scaled to fit the card', async () => {
    const page = await mount(pres())
    expect(page.el.textContent).toContain('Hello, cards')
    const thumb = page.el.querySelector('.slide-thumb')
    expect(thumb.style.width).toBe('320px')
    expect(thumb.style.height).toBe('180px')
    expect(page.el.querySelector('.slide-thumb-canvas').style.transform).toBe(`scale(${320 / 960})`)
    page.unmount()
  })

  it('fits a 4:3 slide inside the card\'s height', async () => {
    const page = await mount(pres({ slideWidth: 1024, slideHeight: 768 }))
    const thumb = page.el.querySelector('.slide-thumb')
    expect(thumb.style.width).toBe('240px')
    expect(thumb.style.height).toBe('180px')
    page.unmount()
  })

  it('waits until the card is near the screen', async () => {
    const watched = []
    globalThis.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; watched.push(this) }
      observe() {}
      disconnect() {}
    }
    const page = await mount(pres())
    expect(page.el.querySelector('.slide-thumb')).toBeNull()
    await act(async () => watched[0].cb([{ isIntersecting: true }]))
    expect(page.el.textContent).toContain('Hello, cards')
    page.unmount()
  })
})
