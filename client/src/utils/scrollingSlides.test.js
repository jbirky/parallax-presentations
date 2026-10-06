import { describe, it, expect, vi } from 'vitest'
import { Window } from 'happy-dom'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import * as client from './scrollingSlides'
import { generateRevealHTML, exportPDF } from './generateHTML'
import { inkedPresentation } from './annotations'
import { diffPresentations } from './presentationDiff'

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
    expect(client.getScreenCount({}, 960, 540)).toBe(1)
    expect(client.getScreenCount({ scrollHeight: 810 }, 960, 540)).toBe(2)
    expect(client.getScreenCount({ scrollHeight: 1620 }, 960, 540)).toBe(3)
    expect(client.getScreenCount({ scrollWidth: 1440 }, 960, 540)).toBe(2)
    expect(client.getScreenCount({ scrollWidth: 2880 }, 960, 540)).toBe(3)
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
    const press = (key, extra = {}) => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key, keyCode: { ArrowDown: 40, ArrowUp: 38, ' ': 32, PageDown: 34, ArrowRight: 39 }[key], bubbles: true, cancelable: true, ...extra }))
    const show = id => { const el = [...inner.children].find(c => c.textContent === id); el.classList.add('visible'); el.setAttribute('data-fragment-index', el.getAttribute('data-fragment-index') || '0') }
    const fragmentShown = id => { const el = [...inner.children].find(c => c.textContent === id); for (const fn of handlers.fragmentshown || []) fn({ fragment: el, fragments: [el] }) }
    return { Reveal, handlers, go, press, revealKeys, scroller, top: () => top, setTop: v => { top = v; scroller._to = null }, fragmentShown, inner }
  }

  it('leaves every key to reveal.js, which changes slides', () => {
    const deck = present()
    for (const key of ['ArrowDown', ' ', 'PageDown', 'ArrowUp', 'ArrowRight']) deck.press(key)
    deck.press(' ', { shiftKey: true })
    expect(deck.revealKeys).toHaveBeenCalledTimes(6)
    expect(deck.revealKeys.mock.calls.every(([e]) => !e.defaultPrevented)).toBe(true)
    expect(deck.top()).toBe(0)
    expect(deck.scroller.scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls a fragment that appears off screen into view', () => {
    const deck = present({ fragments: [['near', 200, 1], ['far', 900, 2]] })
    deck.fragmentShown('near')
    expect(deck.top()).toBe(0)
    deck.fragmentShown('far')
    expect(deck.top()).toBe(444) // its foot, and a margin, at the foot of the screen
  })

  it('arrives at the top going forwards, and where it was left stepping back', () => {
    const deck = present({ startAt: 0 })
    deck.go(1)
    expect(deck.top()).toBe(0)
    deck.setTop(700)
    deck.go(2)
    deck.setTop(0) // as when the browser forgets a hidden slide's place
    deck.go(1)
    expect(deck.top()).toBe(700)
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

// The page a deck's window runs in its sandboxed frame (openDeckWindow)
const deckIn = html => JSON.parse(html.match(/frame\.srcdoc = (".*");/)[1])

describe('PDF export of a scrolling slide', () => {
  async function printed(deck) {
    let blob = null
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF(deck)
      return deckIn(await blob.text())
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

// ── Slides that scroll sideways ────────────────────────────────────────────

// A slide 3 screens wide: an element on each screen, a pinned title, a drawing
function sidewaysDeck(extra = {}) {
  return {
    id: 'p', title: 'Deck', slideWidth: 960, slideHeight: 540,
    slides: [
      { id: 'before', elements: [text('intro')] },
      { id: 'wide', scrollWidth: 2880, elements: [
        text('first', { x: 100 }),
        text('second', { x: 1100 }),
        text('third', { x: 2100 }),
        text('title', { x: 10, y: 10, zIndex: 5, scrollBehavior: 'pin' }),
        { id: 'ink', type: 'drawing', x: 0, y: 0, width: 2880, height: 540, zIndex: 3, paths: [{ points: [{ x: 10, y: 10 }, { x: 2800, y: 20 }] }] },
      ] },
      { id: 'after', elements: [text('outro')] },
    ],
    ...extra,
  }
}

describe('sideways canvas geometry', () => {
  it('is the deck width unless the slide is wider', () => {
    expect(client.getCanvasWidth({}, 960, 540)).toBe(960)
    expect(client.getCanvasWidth({ scrollWidth: 900 }, 960, 540)).toBe(960)
    expect(client.getCanvasWidth({ scrollWidth: 1440.4 }, 960, 540)).toBe(1440)
    expect(client.getCanvasWidth({ scrollWidth: 100000 }, 960, 540)).toBe(960 * client.MAX_SCREENS)
    expect(client.getCanvasHeight({ scrollWidth: 1920 }, 540)).toBe(540)
  })

  it('scrolls one way, down if a slide has both', () => {
    expect(client.scrollAxis({}, 960, 540)).toBeNull()
    expect(client.scrollAxis({ scrollHeight: 1080 }, 960, 540)).toBe('y')
    expect(client.scrollAxis({ scrollWidth: 1920 }, 960, 540)).toBe('x')
    const both = { scrollHeight: 1080, scrollWidth: 1920 }
    expect(client.scrollAxis(both, 960, 540)).toBe('y')
    expect(client.getCanvasWidth(both, 960, 540)).toBe(960)
    expect(client.getScreenCount(both, 960, 540)).toBe(2)
  })

  it('knows a deck with a sideways slide', () => {
    expect(client.hasScrollingSlides(sidewaysDeck())).toBe(true)
    expect(client.hasScrollingSlides({ slideWidth: 1280, slides: [{ scrollWidth: 1200 }] })).toBe(false)
    expect(client.isScrolling({ scrollWidth: 1920 }, 960, 540)).toBe(true)
  })
})

describe('a sideways slide when presented', () => {
  const doc = parse(generateRevealHTML(sidewaysDeck()))
  const section = doc.querySelector('section[data-slide-id="wide"]')

  it('holds its canvas in a scroller one screen wide, with its track along the bottom', () => {
    expect(section.getAttribute('data-scroll-width')).toBe('2880')
    expect(section.hasAttribute('data-scroll-height')).toBe(false)
    expect(section.getAttribute('style')).toContain('width:960px')
    const scroller = section.querySelector(':scope > .slide-scroller')
    expect(scroller.getAttribute('data-scroll')).toBe('x')
    expect(scroller.getAttribute('style')).toContain('width:960px;height:540px;overflow-x:auto;overflow-y:hidden;')
    const inner = scroller.querySelector(':scope > .slide-scroll-inner')
    expect(inner.getAttribute('style')).toContain('width:2880px;height:540px;')
    expect(section.querySelector(':scope > .slide-scroll-track').getAttribute('data-scroll')).toBe('x')
  })

  it('puts its elements on the canvas, pinned ones on the screen, and a drawing across the canvas', () => {
    const inner = section.querySelector('.slide-scroll-inner')
    for (const id of ['first', 'second', 'third']) {
      const el = [...section.querySelectorAll('div')].find(d => d.textContent === id && d.getAttribute('style')?.startsWith('position:absolute'))
      expect(el.parentElement).toBe(inner)
    }
    const title = [...section.querySelectorAll('div')].find(d => d.textContent === 'title' && d.getAttribute('style')?.startsWith('position:absolute'))
    expect(title.parentElement).toBe(section)
    expect(inner.querySelector('svg').getAttribute('style')).toContain('width:2880px;height:540px;')
  })

  it('writes a slide that scrolls down as it did before', () => {
    const tall = parse(generateRevealHTML(scrollingDeck())).querySelector('section[data-slide-id="tall"]')
    expect(tall.querySelector('.slide-scroller').hasAttribute('data-scroll')).toBe(false)
    expect(tall.querySelector('.slide-scroll-track').hasAttribute('data-scroll')).toBe(false)
  })
})

describe('the scrolling script on a sideways slide', () => {
  // As present() above, with the layout faked across instead of down
  function present({ fragments = [], startAt = 1 } = {}) {
    const deck = sidewaysDeck()
    deck.slides[1].elements.push(...fragments.map(([id, x, fragmentIndex]) => text(id, { x, fragment: true, fragmentIndex })))
    const win = new Window({ url: 'http://localhost/deck.html' })
    const doc = win.document
    const sections = generateRevealHTML(deck).match(/<section data-slide-id=[\s\S]*?<\/section>/g)
    doc.body.innerHTML = `<div class="reveal"><div class="slides">${sections.join('')}</div></div>`
    const slides = [...doc.querySelectorAll('section')]
    const wide = slides[1], scroller = wide.querySelector('.slide-scroller'), inner = scroller.firstElementChild
    Object.defineProperty(scroller, 'clientWidth', { value: 960 })
    Object.defineProperty(scroller, 'scrollWidth', { value: 2880 })
    let left = 0
    Object.defineProperty(scroller, 'scrollLeft', { get: () => left, set: v => { left = Math.max(0, Math.min(1920, v)) } })
    scroller.scrollTo = vi.fn(({ left: to }) => { left = to })
    for (const el of inner.children) {
      Object.defineProperty(el, 'offsetLeft', { value: parseFloat(el.style.left) || 0 })
      Object.defineProperty(el, 'offsetWidth', { value: parseFloat(el.style.width) || 0 })
      Object.defineProperty(el, 'offsetParent', { value: inner })
    }
    const handlers = {}
    let current = startAt
    const config = {}
    const Reveal = {
      on: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn) },
      getConfig: () => config,
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
    const revealKeys = vi.fn()
    new Function('window', 'document', 'Reveal', 'Date', client.SCROLLING_SCRIPT)(win, doc, Reveal, Date)
    doc.addEventListener('keydown', revealKeys)
    for (const fn of handlers.ready || []) fn({ currentSlide: slides[current] })
    const codes = { ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40, ArrowUp: 38, ' ': 32, l: 76, h: 72 }
    const press = (key, extra = {}) => doc.body.dispatchEvent(new win.KeyboardEvent('keydown', { key, keyCode: codes[key], bubbles: true, cancelable: true, ...extra }))
    const wheel = (deltaY, deltaX = 0) => {
      const e = new win.WheelEvent('wheel', { deltaY, deltaX, bubbles: true, cancelable: true })
      scroller.dispatchEvent(e)
      return e.defaultPrevented
    }
    const swipe = dx => {
      const touch = (x) => ({ clientX: x, clientY: 200, target: inner })
      const start = new win.Event('touchstart', { bubbles: true })
      Object.defineProperty(start, 'touches', { value: [touch(500)] })
      inner.dispatchEvent(start)
      const end = new win.Event('touchend', { bubbles: true })
      Object.defineProperty(end, 'changedTouches', { value: [touch(500 + dx)] })
      inner.dispatchEvent(end)
    }
    const fragmentShown = id => { const el = [...inner.children].find(c => c.textContent === id); for (const fn of handlers.fragmentshown || []) fn({ fragment: el, fragments: [el] }) }
    return { Reveal, go, press, wheel, swipe, revealKeys, scroller, left: () => left, setLeft: v => { left = v; scroller._to = null }, fragmentShown, inner }
  }

  it('leaves every key to reveal.js, which changes slides', () => {
    const deck = present()
    for (const key of ['ArrowRight', 'l', ' ', 'ArrowLeft', 'h', 'ArrowDown']) deck.press(key)
    expect(deck.revealKeys).toHaveBeenCalledTimes(6)
    expect(deck.revealKeys.mock.calls.every(([e]) => !e.defaultPrevented)).toBe(true)
    expect(deck.left()).toBe(0)
  })

  it('scrolls a fragment that appears off screen into view', () => {
    const deck = present({ fragments: [['far', 1500, 1]] })
    deck.fragmentShown('far')
    expect(deck.left()).toBe(864)
  })

  it('arrives at the start going forwards, and where it was left stepping back', () => {
    const deck = present({ startAt: 0 })
    deck.go(1)
    expect(deck.left()).toBe(0)
    deck.setLeft(1200)
    deck.go(2)
    deck.setLeft(0)
    deck.go(1)
    expect(deck.left()).toBe(1200)
  })

  it('turns an up-and-down wheel into scrolling across, until the end', () => {
    const deck = present()
    expect(deck.wheel(100)).toBe(true)
    expect(deck.left()).toBe(100)
    expect(deck.wheel(-40)).toBe(true)
    expect(deck.left()).toBe(60)
    expect(deck.wheel(0, 50)).toBe(false) // a sideways wheel scrolls natively
    deck.setLeft(1920)
    expect(deck.wheel(100)).toBe(false)
    deck.setLeft(0)
    expect(deck.wheel(-100)).toBe(false)
  })

  it('changes slides with a swipe only from the end it goes towards', () => {
    const deck = present()
    deck.swipe(-200) // from the start, a swipe to the left scrolls the canvas
    expect(deck.Reveal.right).not.toHaveBeenCalled()
    deck.swipe(200) // but one to the right goes back
    expect(deck.Reveal.left).toHaveBeenCalledTimes(1)
    deck.setLeft(1920)
    deck.swipe(-200)
    expect(deck.Reveal.right).toHaveBeenCalledTimes(1)
    deck.setLeft(900)
    deck.swipe(200)
    deck.swipe(-200)
    expect(deck.Reveal.left).toHaveBeenCalledTimes(1)
    expect(deck.Reveal.right).toHaveBeenCalledTimes(1)
  })
})

describe('PDF export of a sideways slide', () => {
  it('gives a page per screen, the canvas moved left a screen a page', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try { exportPDF(sidewaysDeck()) } finally { vi.useRealTimers(); vi.restoreAllMocks() }
    const pages = [...parse(deckIn(await blob.text())).querySelectorAll('.slide-page')]
    expect(pages).toHaveLength(5)
    pages.slice(1, 4).forEach((page, i) => {
      const canvas = [...page.children].find(c => c.getAttribute('style')?.includes('width:2880px'))
      expect(canvas.getAttribute('style')).toContain(`left:${-i * 960}px;top:0px;`)
      expect([...page.children].some(c => c.textContent === 'title')).toBe(true)
    })
  })
})

describe('present-mode ink and history on a sideways slide', () => {
  it('turns ink into a drawing as wide as the canvas', () => {
    const set = { id: 'set', slides: { wide: { paths: [{ points: [[2500, 100], [2510, 110]], color: '#f00', strokeWidth: 3 }] } }, boards: [] }
    const ink = inkedPresentation(sidewaysDeck(), set).slides[1].elements.find(el => el.id === 'ink-wide')
    expect(ink.width).toBe(2880)
    expect(ink.height).toBe(540)
  })

  it('reports a slide starting to scroll sideways', () => {
    const deck = slide => ({ slides: [{ id: 's', ...slide, elements: [] }] })
    expect(diffPresentations(deck({}), deck({ scrollWidth: 1920 })).slides[0].otherChanges).toContain('Canvas width: one screen → 1920px')
  })
})
