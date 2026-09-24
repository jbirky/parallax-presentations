import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'
import { Window } from 'happy-dom'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import * as client from './clickActions'
import { generateRevealHTML } from './generateHTML'

const require = createRequire(import.meta.url)
const server = require('../../../server/services/click-actions.js')

const text = (id, extra = {}) => ({ id, type: 'text', x: 0, y: 0, width: 100, height: 40, zIndex: 1, content: '<p>Go</p>', ...extra })

describe('click actions', () => {
  it('leaves out elements that take their own clicks', () => {
    for (const type of ['text', 'image', 'shape', 'icon', 'callout', 'latex', 'table', 'code', 'markdown']) {
      expect(client.supportsClickAction({ type })).toBe(true)
    }
    for (const type of ['html', 'p5', 'video', 'audio', 'drawing', 'plugin:linear-algebra']) {
      expect(client.supportsClickAction({ type })).toBe(false)
    }
  })

  it('opens only web and mail addresses', () => {
    expect(client.safeActionUrl(' https://example.com/a?b=1 ')).toBe('https://example.com/a?b=1')
    expect(client.safeActionUrl('http://example.com')).toBe('http://example.com')
    expect(client.safeActionUrl('mailto:a@b.c')).toBe('mailto:a@b.c')
    for (const url of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', '/relative', 'example.com', 'https://', null]) {
      expect(client.safeActionUrl(url)).toBe('')
    }
  })

  it('writes each action as attributes', () => {
    expect(client.clickActionAttrs(text('a', { clickAction: { type: 'slide', slideId: 's2' } })))
      .toBe(' data-action="slide" data-action-slide="s-s2" role="button" tabindex="0"')
    expect(client.clickActionAttrs(text('a', { clickAction: { type: 'next' } }))).toBe(' data-action="next" role="button" tabindex="0"')
    expect(client.clickActionAttrs(text('a', { clickAction: { type: 'url', url: 'https://x.org/?q="<b>"' } })))
      .toBe(' data-action="url" data-action-url="https://x.org/?q=&quot;&lt;b&gt;&quot;" data-action-new-tab role="link" tabindex="0"')
    expect(client.clickActionAttrs(text('a', { clickAction: { type: 'url', url: 'https://x.org', newTab: false } })))
      .not.toContain('new-tab')
  })

  it('writes nothing for unusable actions', () => {
    expect(client.clickActionAttrs(text('a'))).toBe('')
    expect(client.clickActionAttrs(text('a', { clickAction: { type: 'slide' } }))).toBe('')
    expect(client.clickActionAttrs(text('a', { clickAction: { type: 'url', url: 'javascript:alert(1)' } }))).toBe('')
    expect(client.clickActionAttrs(text('a', { clickAction: { type: 'explode' } }))).toBe('')
    expect(client.clickActionAttrs({ type: 'html', clickAction: { type: 'next' } })).toBe('')
  })

  it('gives slide sections an id to link to', () => {
    expect(client.slideIdAttr({ id: 'abc' })).toBe(' id="s-abc"')
    expect(client.slideIdAttr({ id: 'a"b' })).toBe(' id="s-a&quot;b"')
    expect(client.slideIdAttr({})).toBe('')
    expect(client.slideHref('abc')).toBe('#/s-abc')
    expect(client.slideIdFromHref('#/s-abc')).toBe('abc')
    expect(client.slideIdFromHref('#/3')).toBeNull()
    expect(client.slideIdFromHref('https://x.org/#/s-abc')).toBeNull()
  })
})

describe('slide links under new ids', () => {
  const slides = [
    { id: 'old1', elements: [
      text('e1', { content: '<p><a href="#/s-old2">next</a> <a href="#/s-elsewhere">x</a> <a href="#/s-old22">y</a></p>' }),
      text('e2', { clickAction: { type: 'slide', slideId: 'old2' } }),
      { id: 'e3', type: 'markdown', content: '[back](#/s-old1)' },
    ] },
    { id: 'old2', elements: [text('e4', { clickAction: { type: 'slide', slideId: 'gone' } })] },
  ]
  const ids = new Map([['old1', 'new1'], ['old2', 'new2']])

  it('follows the slides they link to', () => {
    const [a, b] = client.remapSlideLinks(slides, ids)
    expect(a.elements[0].content).toBe('<p><a href="#/s-new2">next</a> <a href="#/s-elsewhere">x</a> <a href="#/s-old22">y</a></p>')
    expect(a.elements[1].clickAction).toEqual({ type: 'slide', slideId: 'new2' })
    expect(a.elements[2].content).toBe('[back](#/s-new1)')
    expect(b.elements[0].clickAction.slideId).toBe('gone')
    expect(slides[0].elements[1].clickAction.slideId).toBe('old2') // the originals are left alone
  })

  it('counts the links to a slide', () => {
    expect(client.countLinksTo(slides, 'old2')).toBe(2)
    expect(client.countLinksTo(slides, 'old1')).toBe(1)
    expect(client.countLinksTo(slides, 'old')).toBe(0)
    expect(client.countLinksTo(slides, undefined)).toBe(0)
  })

  it('labels slides for a picker', () => {
    const slide = { elements: [text('b', { y: 200, content: '<p>Later</p>' }), text('a', { y: 10, content: '<h1>Results &amp; discussion</h1><p>more</p>' })] }
    expect(client.slideLabel(slide, 2)).toBe('3 · Results & discussion')
    expect(client.slideLabel({ elements: [] }, 0)).toBe('Slide 1')
    expect(client.slideLabel({ elements: [text('a', { content: 'x'.repeat(60) })] }, 0)).toBe(`1 · ${'x'.repeat(39)}…`)
  })
})

describe('the server’s copy', () => {
  it('writes the same pages', () => {
    const elements = [
      text('a', { clickAction: { type: 'slide', slideId: 's2' } }),
      text('b', { clickAction: { type: 'prev' } }),
      text('c', { clickAction: { type: 'url', url: 'https://x.org/?a=1&b="2"', newTab: false } }),
      text('d', { clickAction: { type: 'url', url: 'javascript:alert(1)' } }),
      { id: 'e', type: 'p5', clickAction: { type: 'next' } },
    ]
    for (const el of elements) expect(server.clickActionAttrs(el)).toBe(client.clickActionAttrs(el))
    for (const url of ['https://a.b', 'javascript:x', ' mailto:a@b ']) expect(server.safeActionUrl(url)).toBe(client.safeActionUrl(url))
    expect(server.slideIdAttr({ id: 'x' })).toBe(client.slideIdAttr({ id: 'x' }))
    expect(server.CLICK_ACTION_CSS).toBe(client.CLICK_ACTION_CSS)
    expect(server.CLICK_ACTION_SCRIPT).toBe(client.CLICK_ACTION_SCRIPT)
    const slides = [{ id: 'o', elements: [text('t', { content: '<a href="#/s-o">x</a>', clickAction: { type: 'slide', slideId: 'o' } })] }]
    expect(server.remapSlideLinks(slides, { o: 'n' })).toEqual(client.remapSlideLinks(slides, { o: 'n' }))
  })
})

describe('presented decks', () => {
  const deck = {
    id: 'p1', title: 'T',
    slides: [
      { id: 's1', elements: [text('menu', { clickAction: { type: 'slide', slideId: 's2' } }), { id: 'em', type: 'html', x: 0, y: 0, width: 10, height: 10, content: '<b>x</b>', clickAction: { type: 'next' } }] },
      { id: 's2', elements: [] },
    ],
  }

  it('addresses slides by id and marks clickable elements', () => {
    const html = generateRevealHTML(deck)
    expect(html).toContain('<section data-slide-id="s1" id="s-s1"')
    expect(html).toContain('data-action="slide" data-action-slide="s-s2"')
    expect(html.match(/data-action="/g)).toHaveLength(1) // not on the embed
    expect(html).toContain(client.CLICK_ACTION_SCRIPT)
  })

  // Runs the page script against a small page with reveal.js stubbed
  function page(body) {
    const win = new Window({ url: 'http://localhost/deck.html' })
    win.document.body.innerHTML = `<div class="reveal"><div class="slides">${body}</div></div>`
    const Reveal = { slide: vi.fn(), next: vi.fn(), prev: vi.fn(), getIndices: vi.fn(() => ({ h: 1, v: 2 })) }
    win.open = vi.fn()
    new Function('window', 'document', 'Reveal', client.CLICK_ACTION_SCRIPT)(win, win.document, Reveal)
    const click = el => { const e = new win.MouseEvent('click', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e }
    return { win, doc: win.document, Reveal, click }
  }

  it('goes to the linked slide on click', () => {
    const { doc, Reveal, click } = page(`
      <section id="s-s1"><div data-action="slide" data-action-slide="s-s2" tabindex="0"><p>Menu</p></div></section>
      <section id="s-s2"></section>`)
    const e = click(doc.querySelector('p'))
    expect(Reveal.getIndices).toHaveBeenCalledWith(doc.getElementById('s-s2'))
    expect(Reveal.slide).toHaveBeenCalledWith(1, 2)
    expect(e.defaultPrevented).toBe(true)
  })

  it('moves to the next or previous slide, and opens web pages', () => {
    const { doc, Reveal, win, click } = page(`<section>
      <div id="n" data-action="next"></div><div id="p" data-action="prev"></div>
      <div id="u" data-action="url" data-action-url="https://x.org" data-action-new-tab></div>
      <div id="bad" data-action="url" data-action-url="javascript:alert(1)" data-action-new-tab></div></section>`)
    click(doc.getElementById('n'))
    click(doc.getElementById('p'))
    click(doc.getElementById('u'))
    click(doc.getElementById('bad'))
    expect(Reveal.next).toHaveBeenCalledTimes(1)
    expect(Reveal.prev).toHaveBeenCalledTimes(1)
    expect(win.open).toHaveBeenCalledTimes(1)
    expect(win.open).toHaveBeenCalledWith('https://x.org', '_blank', 'noopener')
  })

  it('keeps slide links in the page, and leaves other links alone', () => {
    const { doc, win, Reveal, click } = page(`<section><div data-action="next">
      <a id="slide" href="#/s-s2" target="_blank">slide</a> <a id="web" href="https://x.org">web</a></div></section>`)
    const e = click(doc.getElementById('slide'))
    expect(e.defaultPrevented).toBe(true)
    expect(win.location.hash).toBe('#/s-s2')
    expect(click(doc.getElementById('web')).defaultPrevented).toBe(false)
    expect(Reveal.next).not.toHaveBeenCalled() // the links win over the element's action
  })

  it('runs an action from the keyboard', () => {
    const { doc, Reveal } = page('<section><div id="n" data-action="next" tabindex="0"></div></section>')
    const el = doc.getElementById('n')
    const e = new doc.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    el.dispatchEvent(e)
    expect(Reveal.next).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })
})
