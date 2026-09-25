import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'
import { Window } from 'happy-dom'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import * as client from './scrollingSlides'
import { generateRevealHTML, exportPDF } from './generateHTML'
import { inkedPresentation } from './annotations'
import { diffPresentations } from './presentationDiff'

const require = createRequire(import.meta.url)
const server = require('../../../server/services/scrolling-slides.js')

const text = (id, extra = {}) => ({ id, type: 'text', x: 40, y: 40, width: 300, height: 60, zIndex: 1, content: `<p>${id}</p>`, ...extra })

// A 3-screen slide: an element on each screen, a pinned title, a drawing
function scrollingDeck(extra = {}) {
  return {
    id: 'p', title: 'Deck', slideWidth: 960, slideHeight: 540,
    slides: [
      { id: 'before', elements: [text('intro')] },
      { id: 'tall', scrollHeight: 1620, elements: [
        text('top', { y: 100 }),
        text('middle', { y: 700 }),
        text('bottom', { y: 1400 }),
        text('title', { y: 10, zIndex: 5, scrollBehavior: 'pin' }),
        { id: 'ink', type: 'drawing', x: 0, y: 0, width: 960, height: 1620, zIndex: 3, paths: [{ points: [{ x: 10, y: 10 }, { x: 20, y: 1500 }] }] },
      ] },
      { id: 'after', elements: [text('outro')] },
    ],
    ...extra,
  }
}

function parse(html) {
  const win = new Window({ url: 'http://localhost/deck.html' })
  win.document.write(html)
  return win.document
}

describe('canvas geometry', () => {
  it('is the deck height unless the slide is taller', () => {
    expect(client.getCanvasHeight({}, 540)).toBe(540)
    expect(client.getCanvasHeight(null, 540)).toBe(540)
    expect(client.getCanvasHeight({ scrollHeight: 400 }, 540)).toBe(540)
    expect(client.getCanvasHeight({ scrollHeight: 540 }, 540)).toBe(540)
    expect(client.getCanvasHeight({ scrollHeight: 810.4 }, 540)).toBe(810)
    expect(client.getCanvasHeight({ scrollHeight: '1080' }, 540)).toBe(1080)
    expect(client.getCanvasHeight({ scrollHeight: 'tall' }, 540)).toBe(540)
    expect(client.getCanvasHeight({ scrollHeight: 100000 }, 540)).toBe(540 * client.MAX_SCREENS)
  })

  it('counts a part screen as a screen', () => {
    expect(client.getScreenCount({}, 540)).toBe(1)
    expect(client.getScreenCount({ scrollHeight: 810 }, 540)).toBe(2)
    expect(client.getScreenCount({ scrollHeight: 1620 }, 540)).toBe(3)
  })

  it('knows a deck with a scrolling slide', () => {
    expect(client.hasScrollingSlides(scrollingDeck())).toBe(true)
    expect(client.hasScrollingSlides({ slides: [{ scrollHeight: 540 }] })).toBe(false)
    expect(client.hasScrollingSlides({ slideHeight: 720, slides: [{ scrollHeight: 700 }] })).toBe(false)
    expect(client.hasScrollingSlides({})).toBe(false)
    expect(client.isPinned({ scrollBehavior: 'pin' })).toBe(true)
    expect(client.isPinned({})).toBe(false)
    expect(client.isPinned(undefined)).toBe(false)
  })
})

describe('what a key does on a scrolling slide', () => {
  const scrollStep = new Function(`${client.SCROLL_STEP_SOURCE}; return scrollStep`)()
  const view = top => ({ top, height: 540, max: 1080 })

  it('scrolls down, then leaves the next slide to reveal.js', () => {
    expect(scrollStep(1, view(0), null)).toBeCloseTo(459)
    expect(scrollStep(1, view(900), null)).toBe(1080)
    expect(scrollStep(1, view(1080), null)).toBe('reveal')
  })

  it('scrolls up, then leaves the previous slide to reveal.js', () => {
    expect(scrollStep(-1, view(1080), null)).toBeCloseTo(621)
    expect(scrollStep(-1, view(100), null)).toBe(0)
    expect(scrollStep(-1, view(0), null)).toBe('reveal')
  })

  it('shows a fragment once it has scrolled into view', () => {
    expect(scrollStep(1, view(0), { top: 300, bottom: 360 })).toBe('reveal')
    expect(scrollStep(1, view(0), { top: 700, bottom: 760 })).toBeCloseTo(459)
    expect(scrollStep(1, view(459), { top: 700, bottom: 760 })).toBe('reveal')
    // Scrolled past by hand: show it, and fragmentshown scrolls back to it
    expect(scrollStep(1, view(1080), { top: 100, bottom: 160 })).toBe('reveal')
    expect(scrollStep(1, view(1080), { pinned: true })).toBe('reveal')
  })

  it('hides a fragment on screen before scrolling up past it', () => {
    expect(scrollStep(-1, view(1080), { top: 1200, bottom: 1300 })).toBe('reveal')
    expect(scrollStep(-1, view(1080), { top: 100, bottom: 160 })).toBeCloseTo(621)
    expect(scrollStep(-1, view(500), { pinned: true })).toBe('reveal')
    // At the top with shown fragments further down: go back past them
    expect(scrollStep(-1, view(0), { top: 1200, bottom: 1300 })).toBe('skip')
  })
})

describe('a scrolling slide when presented', () => {
  const doc = parse(generateRevealHTML(scrollingDeck()))
  const section = doc.querySelector('section[data-slide-id="tall"]')

  it('holds its canvas in a scroller one screen high', () => {
    expect(section.getAttribute('data-scroll-height')).toBe('1620')
    expect(section.getAttribute('style')).toContain('height:540px')
    const scroller = section.querySelector(':scope > .slide-scroller')
    expect(scroller.hasAttribute('data-prevent-swipe')).toBe(true)
    expect(scroller.getAttribute('style')).toContain('height:540px')
    expect(scroller.getAttribute('style')).toContain('overflow-y:auto')
    const inner = scroller.querySelector(':scope > .slide-scroll-inner')
    expect(inner.getAttribute('style')).toContain('height:1620px')
    expect(section.querySelector(':scope > .slide-scroll-track > .slide-scroll-thumb')).toBeTruthy()
  })

  it('puts its elements on the canvas, and pinned ones over it on the screen', () => {
    const inner = section.querySelector('.slide-scroll-inner')
    for (const id of ['top', 'middle', 'bottom']) {
      const el = [...section.querySelectorAll('div')].find(d => d.textContent === id && d.getAttribute('style')?.startsWith('position:absolute'))
      expect(el.parentElement).toBe(inner)
    }
    const title = [...section.querySelectorAll('div')].find(d => d.textContent === 'title' && d.getAttribute('style')?.startsWith('position:absolute'))
    expect(title.parentElement).toBe(section)
    expect(title.getAttribute('style')).toContain('top:10px')
    // A drawing covers the whole canvas
    expect(inner.querySelector('svg').getAttribute('style')).toContain('height:1620px')
  })

  it('paints a gradient or image background on the canvas, so it scrolls with it', () => {
    const deck = scrollingDeck()
    deck.slides[1].background = { type: 'gradient', gradient: 'linear-gradient(#111, #333)' }
    const tall = parse(generateRevealHTML(deck)).querySelector('section[data-slide-id="tall"]')
    expect(tall.hasAttribute('data-background-gradient')).toBe(false)
    expect(tall.querySelector('.slide-scroll-inner').getAttribute('style')).toContain('background:linear-gradient(#111, #333);')
    // A colour looks the same either way, and stays reveal.js's
    deck.slides[1].background = { type: 'color', color: '#123456' }
    const colored = parse(generateRevealHTML(deck)).querySelector('section[data-slide-id="tall"]')
    expect(colored.getAttribute('data-background-color')).toBe('#123456')
    expect(colored.querySelector('.slide-scroll-inner').getAttribute('style')).not.toContain('background')
  })

  it('keeps a background to its own declaration', () => {
    expect(client.canvasBackgroundStyle({ type: 'gradient', gradient: 'red; position:fixed" onload="x' })).toBe('background:red position:fixed onload=x;')
    expect(client.canvasBackgroundStyle({ type: 'image', image: "/a b'c.png?x=1&y=2" }, src => `https://h${src}`))
      .toBe("background-image:url('https://h/a bc.png?x=1&amp;y=2');background-size:cover;background-position:center;")
    expect(client.canvasBackgroundStyle({ type: 'image', image: 'javascript:alert(1)' })).toBe('')
    expect(client.canvasBackgroundStyle({ type: 'color', color: '#fff' })).toBe('')
    expect(client.canvasBackgroundStyle(undefined)).toBe('')
  })

  it('leaves other slides as they were', () => {
    const other = doc.querySelector('section[data-slide-id="before"]')
    expect(other.hasAttribute('data-scroll-height')).toBe(false)
    expect(other.querySelector('.slide-scroller')).toBeNull()
  })

  it('brings its stylesheet and script, which parses', () => {
    const html = generateRevealHTML(scrollingDeck())
    expect(html).toContain(client.SCROLLING_CSS)
    expect(html).toContain(client.SCROLLING_SCRIPT)
    expect(() => new Function(client.SCROLLING_SCRIPT)).not.toThrow()
  })
})

describe('a deck with no scrolling slide', () => {
  const deck = {
    id: 'p', slideWidth: 960, slideHeight: 540,
    slides: [{ id: 's1', scrollHeight: 540, elements: [text('a', { scrollBehavior: 'pin', y: 400 }), { id: 'd', type: 'drawing', paths: [] }] }],
  }

  it('is written as it was before scrolling slides', () => {
    const html = generateRevealHTML(deck)
    for (const marker of ['slide-scroller', 'slide-scroll-inner', 'data-scroll-height', 'Scrolling slides']) expect(html).not.toContain(marker)
    // A pin means nothing on a slide that doesn't scroll
    const section = parse(html).querySelector('section[data-slide-id="s1"]')
    expect([...section.children].some(c => c.textContent === 'a')).toBe(true)
    expect(section.querySelector('svg').getAttribute('style')).toContain('height:540px')
  })
})

describe('the scrolling script', () => {
  // A deck with the slide and the stylesheet's layout faked: happy-dom has no layout
  function present({ fragments = [], startAt = 1 } = {}) {
    const deck = scrollingDeck()
    deck.slides[1].elements.push(...fragments.map(([id, y, fragmentIndex]) => text(id, { y, fragment: true, fragmentIndex })))
    const win = new Window({ url: 'http://localhost/deck.html' })
    const doc = win.document
    const sections = generateRevealHTML(deck).match(/<section data-slide-id=[\s\S]*?<\/section>/g)
    doc.body.innerHTML = `<div class="reveal"><div class="slides">${sections.join('')}</div></div>`
    const slides = [...doc.querySelectorAll('section')]
    const tall = slides[1], scroller = tall.querySelector('.slide-scroller'), inner = scroller.firstElementChild
    Object.defineProperty(scroller, 'clientHeight', { value: 540 })
    Object.defineProperty(scroller, 'scrollHeight', { value: 1620 })
    let top = 0
    Object.defineProperty(scroller, 'scrollTop', { get: () => top, set: v => { top = Math.max(0, Math.min(1080, v)) } })
    scroller.scrollTo = vi.fn(({ top: to }) => { top = to })
    for (const el of inner.children) {
      const y = parseFloat(el.style.top) || 0, h = parseFloat(el.style.height) || 0
      Object.defineProperty(el, 'offsetTop', { value: y })
      Object.defineProperty(el, 'offsetHeight', { value: h })
      Object.defineProperty(el, 'offsetParent', { value: inner })
    }
    const handlers = {}
    let current = startAt
    const Reveal = {
      on: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn) },
      getConfig: () => ({}),
      isOverview: () => false,
      isPaused: () => false,
      getCurrentSlide: () => slides[current],
      getSlides: () => slides,
      prev: vi.fn(), next: vi.fn(), left: vi.fn(), right: vi.fn(),
    }
    const go = index => {
      current = index
      for (const fn of handlers.slidechanged || []) fn({ currentSlide: slides[index] })
    }
    // Stands in for reveal.js's own key handler, which comes after the script's
    const revealKeys = vi.fn()
    new Function('window', 'document', 'Reveal', 'Date', client.SCROLLING_SCRIPT)(win, doc, Reveal, Date)
    doc.addEventListener('keydown', revealKeys)
    for (const fn of handlers.ready || []) fn({ currentSlide: slides[current] })
    const press = (key, extra = {}) => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key, keyCode: { ArrowDown: 40, ArrowUp: 38, ' ': 32, PageDown: 34, ArrowRight: 39 }[key], bubbles: true, ...extra }))
    const show = id => { const el = [...inner.children].find(c => c.textContent === id); el.classList.add('visible'); el.setAttribute('data-fragment-index', el.getAttribute('data-fragment-index') || '0') }
    return { Reveal, handlers, go, press, revealKeys, scroller, top: () => top, setTop: v => { top = v; scroller._to = null }, show, inner }
  }

  it('scrolls down a step at a time, then lets reveal.js move on', () => {
    const deck = present()
    deck.press('ArrowDown')
    expect(deck.top()).toBeCloseTo(459)
    expect(deck.revealKeys).not.toHaveBeenCalled()
    deck.press(' ')
    deck.press('PageDown')
    expect(deck.top()).toBe(1080)
    expect(deck.revealKeys).not.toHaveBeenCalled()
    deck.press('ArrowDown')
    expect(deck.revealKeys).toHaveBeenCalledTimes(1)
  })

  it('leaves other keys, and keys with modifiers, to reveal.js', () => {
    const deck = present()
    deck.press('ArrowRight')
    deck.press('ArrowDown', { altKey: true })
    deck.press('ArrowDown', { ctrlKey: true })
    expect(deck.revealKeys).toHaveBeenCalledTimes(3)
    expect(deck.top()).toBe(0)
  })

  it('goes back up with shift+space and the up arrow', () => {
    const deck = present()
    deck.setTop(1080)
    deck.press(' ', { shiftKey: true })
    expect(deck.top()).toBeCloseTo(621)
    deck.press('ArrowUp')
    deck.press('ArrowUp')
    expect(deck.top()).toBe(0)
    expect(deck.revealKeys).not.toHaveBeenCalled()
    deck.press('ArrowUp')
    expect(deck.revealKeys).toHaveBeenCalledTimes(1)
  })

  it('shows a fragment when it comes into view', () => {
    const deck = present({ fragments: [['near', 200, 1], ['far', 900, 2]] })
    for (const el of deck.inner.querySelectorAll('.fragment')) el.setAttribute('data-fragment-index', el.getAttribute('data-fragment-index') || '0')
    deck.press('ArrowDown') // "near" is on screen: reveal.js shows it
    expect(deck.revealKeys).toHaveBeenCalledTimes(1)
    deck.show('near')
    deck.press('ArrowDown') // "far" is below the screen: scroll
    expect(deck.revealKeys).toHaveBeenCalledTimes(1)
    expect(deck.top()).toBeCloseTo(459)
    deck.press('ArrowDown') // now it's in view
    expect(deck.revealKeys).toHaveBeenCalledTimes(2)
  })

  it('arrives at the top going forwards, and at the bottom stepping back', () => {
    const deck = present({ startAt: 0 })
    deck.go(1)
    expect(deck.top()).toBe(0)
    deck.setTop(700)
    deck.go(2)
    deck.go(1)
    expect(deck.top()).toBe(1080)
    deck.go(0)
    deck.setTop(500)
    deck.go(1)
    expect(deck.top()).toBe(0)
  })

  it('does nothing on an ordinary slide', () => {
    const deck = present({ startAt: 0 })
    deck.press('ArrowDown')
    expect(deck.revealKeys).toHaveBeenCalledTimes(1)
  })
})

describe('PDF export of a scrolling slide', () => {
  async function printed(deck) {
    let blob = null
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF(deck)
      return await blob.text()
    } finally {
      vi.useRealTimers()
      createObjectURL.mockRestore()
    }
  }

  it('gives a page per screen, with its fragments and pinned elements on each', async () => {
    const deck = scrollingDeck({ showPageNumbers: true, pageNumberFormat: 'n' })
    deck.slides[1].elements.push(text('step', { y: 1200, fragment: true, fragmentIndex: 1 }))
    const doc = parse(await printed(deck))
    const pages = [...doc.querySelectorAll('.slide-page')]
    expect(pages).toHaveLength(5) // before, three screens, after
    const screens = pages.slice(1, 4)
    expect(screens.map(p => p.id)).toEqual(['s-tall', '', ''])
    screens.forEach((page, i) => {
      const canvas = [...page.children].find(c => c.getAttribute('style')?.includes('height:1620px'))
      expect(canvas.getAttribute('style')).toContain(`top:${-i * 540}px`)
      expect([...canvas.children].map(c => c.textContent)).toEqual(expect.arrayContaining(['top', 'middle', 'bottom', 'step']))
      expect([...page.children].some(c => c.textContent === 'title')).toBe(true)
      expect(canvas.textContent).not.toContain('title')
      expect(page.textContent).toContain('2') // the slide's page number, on each of its pages
    })
    expect(pages[4].textContent).toContain('3')
  })

  it('moves a gradient background with the canvas', async () => {
    const deck = scrollingDeck()
    deck.slides[1].background = { type: 'gradient', gradient: 'linear-gradient(#111, #333)' }
    const pages = [...parse(await printed(deck)).querySelectorAll('.slide-page')].slice(1, 4)
    for (const page of pages) {
      expect(page.getAttribute('style')).not.toContain('linear-gradient')
      expect([...page.children].find(c => c.getAttribute('style')?.includes('height:1620px')).getAttribute('style')).toContain('background:linear-gradient(#111, #333);')
    }
  })
})

describe('present-mode ink on a scrolling slide', () => {
  it('becomes a drawing as tall as the canvas', () => {
    const deck = scrollingDeck()
    const set = { id: 'set', slides: { tall: { paths: [{ points: [[10, 1500], [20, 1510]], color: '#f00', strokeWidth: 3 }] } }, boards: [] }
    const inked = inkedPresentation(deck, set)
    const ink = inked.slides[1].elements.find(el => el.id === 'ink-tall')
    expect(ink.height).toBe(1620)
    expect(ink.paths[0].points[0]).toEqual({ x: 10, y: 1500 })
  })
})

describe('version history', () => {
  const deck = (slide, el = {}) => ({ slides: [{ id: 's', ...slide, elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 1, height: 1, ...el }] }] })

  it('reports a slide starting to scroll, and an element being pinned', () => {
    const tall = diffPresentations(deck({}), deck({ scrollHeight: 1080 }))
    expect(tall.slides[0].otherChanges).toContain('Canvas height: one screen → 1080px')
    const pinned = diffPresentations(deck({}), deck({}, { scrollBehavior: 'pin' }))
    expect(pinned.slides[0].elements[0].status).toBe('style-changed')
    expect(pinned.slides[0].elements[0].changes).toContain('scrollBehavior: (none) → pin')
  })
})

describe('the server’s copy', () => {
  it('writes the same pages', () => {
    expect(Object.keys(server).sort()).toEqual(Object.keys(client).sort())
    for (const key of ['MAX_SCREENS', 'SCROLLING_CSS', 'SCROLL_STEP_SOURCE', 'SCROLLING_SCRIPT']) expect(server[key]).toBe(client[key])
    for (const slide of [{}, null, { scrollHeight: 810 }, { scrollHeight: 'x' }, { scrollHeight: 99999 }]) {
      expect(server.getCanvasHeight(slide, 540)).toBe(client.getCanvasHeight(slide, 540))
      expect(server.getScreenCount(slide, 540)).toBe(client.getScreenCount(slide, 540))
      expect(server.isScrolling(slide, 540)).toBe(client.isScrolling(slide, 540))
    }
    for (const el of [{ scrollBehavior: 'pin' }, {}, null]) expect(server.isPinned(el)).toBe(client.isPinned(el))
    for (const bg of [{ type: 'gradient', gradient: 'a;"b' }, { type: 'image', image: "/x'.png", size: 'contain' }, { type: 'image', image: 'data:x' }, { type: 'color', color: 'red' }, null]) {
      expect(server.canvasBackgroundStyle(bg)).toBe(client.canvasBackgroundStyle(bg))
    }
    const deck = scrollingDeck()
    expect(server.hasScrollingSlides(deck)).toBe(client.hasScrollingSlides(deck))
    const parts = { slideW: 960, slideH: 540, canvasH: 1620, screen: 2, elementsHtml: '<div>a</div>', pinnedHtml: '<div>b</div>', background: 'background:red;' }
    expect(server.scrollingSlideBody(parts)).toBe(client.scrollingSlideBody(parts))
    expect(server.scrollingSlideBody({ ...parts, pinnedHtml: '' })).toBe(client.scrollingSlideBody({ ...parts, pinnedHtml: '' }))
    expect(server.printScreenBody(parts)).toBe(client.printScreenBody(parts))
  })
})
