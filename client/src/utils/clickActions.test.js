import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'
import { Window } from 'happy-dom'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import * as client from './clickActions'
import { generateRevealHTML, exportPDF } from './generateHTML'

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

describe('showing and hiding', () => {
  const slide = { elements: [
    text('tabA', { clickAction: { type: 'visibility', show: ['panelA'], hide: ['panelB', 'bad id', 7] } }),
    text('tabB', { clickAction: { type: 'visibility', show: ['panelB'], hide: ['panelA'], toggle: ['note'] }, hoverEffect: 'lift' }),
    text('panelA'),
    text('panelB', { startHidden: true }),
    { id: 'note', type: 'html', x: 0, y: 0, width: 10, height: 10, content: '' },
    text('loose', { startHidden: true }),
    text('plain'),
  ] }

  it('finds what a slide’s clicks show or hide', () => {
    expect([...client.visibilityTargets(slide)].sort()).toEqual(['note', 'panelA', 'panelB'])
    expect(client.visibilityTargets({}).size).toBe(0)
  })

  it('marks the clickers, the elements they change, and what starts hidden', () => {
    const targets = client.visibilityTargets(slide)
    const attrs = id => client.clickActionAttrs(slide.elements.find(e => e.id === id), targets)
    expect(attrs('tabA')).toBe(' data-action="visibility" data-action-show="panelA" data-action-hide="panelB" role="button" tabindex="0"')
    expect(attrs('tabB')).toBe(' data-action="visibility" data-action-show="panelB" data-action-hide="panelA" data-action-toggle="note" data-hover="lift" role="button" tabindex="0"')
    expect(attrs('panelA')).toBe(' data-el="panelA"')
    expect(attrs('panelB')).toBe(' data-el="panelB" data-start-hidden data-hidden')
    expect(attrs('note')).toBe(' data-el="note"') // an embed can't be clicked, but can be shown
    expect(attrs('loose')).toBe(' data-el="loose" data-start-hidden data-hidden')
    expect(attrs('plain')).toBe('')
    expect(client.clickActionAttrs(text('x', { clickAction: { type: 'visibility', show: [] } }))).toBe('')
  })

  it('writes hover styles other than the default', () => {
    for (const [hoverEffect, attr] of [['lift', ' data-hover="lift"'], ['grow', ' data-hover="grow"'], ['none', ' data-hover="none"'], ['brighten', ''], ['spin', ''], [undefined, '']]) {
      const attrs = client.clickActionAttrs(text('x', { clickAction: { type: 'next' }, hoverEffect }))
      expect(attrs).toBe(` data-action="next"${attr} role="button" tabindex="0"`)
    }
  })

  it('keeps show/hide pointing at the right elements when they get new ids', () => {
    let n = 0
    const renewed = client.renewElementIds(slide.elements, () => `new${++n}`)
    expect(renewed.map(e => e.id)).toEqual(['new1', 'new2', 'new3', 'new4', 'new5', 'new6', 'new7'])
    expect(renewed[0].clickAction).toEqual({ type: 'visibility', show: ['new3'], hide: ['new4', 'bad id', 7] })
    expect(renewed[1].clickAction.toggle).toEqual(['new5'])
    expect(slide.elements[0].clickAction.show).toEqual(['panelA']) // the originals are left alone
    expect(client.remapElementRefs([text('a', { clickAction: { type: 'next' } })], { a: 'b' })[0].clickAction).toEqual({ type: 'next' })
  })

  it('names elements for the show/hide list', () => {
    const labels = client.elementLabels(slide.elements.concat([{ id: 's1', type: 'shape' }, { id: 's2', type: 'shape' }, { id: 'p', type: 'plugin:linear-algebra' }]))
    expect(labels.get('tabA')).toBe('Go')
    expect(labels.get('note')).toBe('Html 1')
    expect([labels.get('s1'), labels.get('s2'), labels.get('p')]).toEqual(['Shape 1', 'Shape 2', 'Linear-algebra 1'])
    expect(client.elementLabels([{ id: 'b', type: 'shape', text: ' Tab 2 ' }]).get('b')).toBe('Tab 2')
  })
})

describe('previewing clicks on the canvas', () => {
  let n = 0
  const els = client.buildTabs(3, { makeId: () => `t${++n}` })
  const [, tab1, tab2, tab3, bar1, bar2, bar3, panel1, panel2, panel3] = els
  const ids = list => list.map(e => e.id).sort()

  it('shows the slide as it opens, so tab panels don’t overlap', () => {
    const p = client.canvasClickPreview(els, undefined)
    expect(p.canPreview).toBe(true)
    expect(p.mode).toBe('start')
    expect(ids(p.clickers)).toEqual(ids([tab1, tab2, tab3]))
    expect(p.elements.map(e => e.id)).not.toContain(panel2.id)
    expect(p.elements.map(e => e.id)).toContain(panel1.id)
    expect(p.fadedIds.size).toBe(0)
  })

  it('shows the slide after a tab’s click', () => {
    const p = client.canvasClickPreview(els, tab3.id)
    expect(p.mode).toBe(tab3.id)
    const shown = p.elements.map(e => e.id)
    expect(shown).toEqual(expect.arrayContaining([panel3.id, bar3.id, tab1.id]))
    expect(shown).not.toEqual(expect.arrayContaining([panel1.id]))
    expect(shown).not.toContain(panel2.id)
  })

  it('keeps what’s selected, faded, and shows everything when asked', () => {
    expect([...client.canvasClickPreview(els, tab3.id, [panel1.id]).fadedIds]).toEqual([panel1.id])
    const all = client.canvasClickPreview(els, 'all', [panel2.id])
    expect(all.elements).toBe(els)
    expect([...all.fadedIds].sort()).toEqual(ids([bar2, bar3, panel3])) // hidden at start, not selected
    expect(client.canvasClickPreview(els, 'gone').mode).toBe('start')
    const plain = [text('a')]
    expect(client.canvasClickPreview(plain, tab1.id)).toMatchObject({ canPreview: false, mode: 'all', elements: plain })
  })

  it('switches to a tab’s click when it’s selected, or to one that shows what’s selected', () => {
    expect(client.previewForSelection(els, tab2.id, 'start')).toBe(tab2.id)
    expect(client.previewForSelection(els, tab2.id, tab2.id)).toBeNull()
    expect(client.previewForSelection(els, panel3.id, 'start')).toBe(tab3.id)
    expect(client.previewForSelection(els, panel1.id, 'start')).toBeNull() // already shown
    expect(client.previewForSelection(els, panel2.id, 'all')).toBeNull()
    expect(client.previewForSelection(els, 'nope', 'start')).toBeNull()
    const grouped = [text('g1', { groupId: 'g', clickAction: { type: 'visibility', show: ['x'] } }), text('g2', { groupId: 'g', clickAction: { type: 'visibility', show: ['x'] } }), text('x', { startHidden: true })]
    expect(client.visibilityClickers(grouped).map(e => e.id)).toEqual(['g1'])
    expect(client.previewForSelection(grouped, 'g2', 'start')).toBe('g1')
  })

  it('works out what a click leaves hidden', () => {
    const slide = [
      text('s', { startHidden: true }), text('v'),
      text('c', { clickAction: { type: 'visibility', show: ['s'], hide: ['v'], toggle: ['t', 'u'] } }),
      text('t', { startHidden: true }), text('u'),
    ]
    expect([...client.hiddenAfterClick(slide)].sort()).toEqual(['s', 't'])
    expect([...client.hiddenAfterClick(slide, 'c')].sort()).toEqual(['u', 'v'])
  })
})

describe('the tabs insert', () => {
  let n = 0
  const makeId = () => `id${++n}`

  it('makes tabs that each show their own panel and bar', () => {
    const els = client.buildTabs(3, { slideW: 960, slideH: 540, zIndex: 5, makeId })
    const [background, ...rest] = els
    const tabs = rest.slice(0, 3), bars = rest.slice(3, 6), panels = rest.slice(6)
    expect(els).toHaveLength(10)
    expect(background).toMatchObject({ type: 'shape', zIndex: 5 })
    expect(tabs.map(t => t.text)).toEqual(['Tab 1', 'Tab 2', 'Tab 3'])
    tabs.forEach((tab, i) => {
      const own = [bars[i].id, panels[i].id]
      expect(tab.clickAction.show).toEqual(own)
      expect(tab.clickAction.hide.sort()).toEqual([...bars, ...panels].map(e => e.id).filter(id => !own.includes(id)).sort())
      expect(!!bars[i].startHidden).toBe(i > 0)
      expect(!!panels[i].startHidden).toBe(i > 0)
      expect(bars[i].x).toBe(tab.x) // under its tab
    })
    expect(Math.max(...els.map(e => e.x + e.width))).toBeLessThanOrEqual(960)
    expect(Math.max(...els.map(e => e.y + e.height))).toBeLessThanOrEqual(540)
    expect(new Set(els.map(e => e.id)).size).toBe(10)
    expect(client.buildTabs(9, { makeId }).filter(e => e.clickAction)).toHaveLength(6)
  })

  it('switches panels when presented', () => {
    const els = client.buildTabs(2, { makeId })
    const html = generateRevealHTML({ id: 'p', slides: [{ id: 'tabs', elements: els }] })
    const section = html.match(/<section data-slide-id="tabs"[\s\S]*?<\/section>/)[0]
    const win = new Window({ url: 'http://localhost/deck.html' })
    win.document.body.innerHTML = `<div class="reveal"><div class="slides">${section}</div></div>`
    new Function('window', 'document', 'Reveal', client.CLICK_ACTION_SCRIPT)(win, win.document, { on() {} })
    const doc = win.document
    const shown = el => !doc.querySelector(`[data-el="${el.id}"]`).hasAttribute('data-hidden')
    const [, tab1, tab2, bar1, bar2, panel1, panel2] = els
    const click = tab => doc.querySelector(`[data-action-show~="${tab.clickAction.show[0]}"]`).dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    expect([shown(bar1), shown(panel1), shown(bar2), shown(panel2)]).toEqual([true, true, false, false])
    click(tab2)
    expect([shown(bar1), shown(panel1), shown(bar2), shown(panel2)]).toEqual([false, false, true, true])
    click(tab1)
    expect([shown(bar1), shown(panel1), shown(bar2), shown(panel2)]).toEqual([true, true, false, false])
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
    const tabs = { elements: [
      text('a', { clickAction: { type: 'visibility', show: ['b'], toggle: ['c'] }, hoverEffect: 'grow' }),
      text('b', { startHidden: true }), { id: 'c', type: 'video' },
    ] }
    const targets = client.visibilityTargets(tabs)
    expect([...server.visibilityTargets(tabs)]).toEqual([...targets])
    for (const el of tabs.elements) expect(server.clickActionAttrs(el, targets)).toBe(client.clickActionAttrs(el, targets))
    let a = 0, b = 0
    expect(server.renewElementIds(tabs.elements, () => `n${++a}`)).toEqual(client.renewElementIds(tabs.elements, () => `n${++b}`))
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

  it('marks what a click shows or hides', () => {
    const html = generateRevealHTML({ id: 'p', slides: [{ id: 's1', elements: [
      text('tab', { clickAction: { type: 'visibility', show: ['panel'] } }), text('panel', { startHidden: true }),
    ] }] })
    expect(html).toContain('data-action="visibility" data-action-show="panel"')
    expect(html).toContain('data-el="panel" data-start-hidden data-hidden')
  })

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
    const handlers = {}
    const Reveal = {
      slide: vi.fn(), next: vi.fn(), prev: vi.fn(), getIndices: vi.fn(() => ({ h: 1, v: 2 })),
      on: (name, fn) => { handlers[name] = fn }, emit: (name, e) => handlers[name]?.(e),
    }
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

  it('shows, hides and toggles elements on the clicked slide, and resets them when the slide opens again', () => {
    const { doc, Reveal, click } = page(`
      <section id="one">
        <div id="tabA" data-action="visibility" data-action-show="a" data-action-hide="b"></div>
        <div id="tabB" data-action="visibility" data-action-show="b" data-action-hide="a" data-action-toggle="note"></div>
        <div data-el="a"></div><div data-el="b" data-start-hidden data-hidden></div><div data-el="note" data-start-hidden data-hidden></div>
      </section>
      <section id="two"><div data-el="b"></div></section>`)
    const hidden = (slide, id) => doc.querySelector(`#${slide} [data-el="${id}"]`).hasAttribute('data-hidden')
    click(doc.getElementById('tabB'))
    expect([hidden('one', 'a'), hidden('one', 'b'), hidden('one', 'note')]).toEqual([true, false, false])
    expect(hidden('two', 'b')).toBe(false) // only the clicked slide changes
    click(doc.getElementById('tabB'))
    expect(hidden('one', 'note')).toBe(true) // toggled back
    click(doc.getElementById('tabA'))
    expect([hidden('one', 'a'), hidden('one', 'b')]).toEqual([false, true])
    click(doc.getElementById('tabB'))
    Reveal.emit('slidechanged', { currentSlide: doc.getElementById('one') })
    expect([hidden('one', 'a'), hidden('one', 'b'), hidden('one', 'note')]).toEqual([false, true, true])
  })
})

describe('PDF export', () => {
  it('links clickable elements and slide links to the slides’ pages, and leaves out what starts hidden', async () => {
    let blob = null
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF({ id: 'p', slides: [
        { id: 's1', elements: [
          text('go', { x: 10, y: 20, width: 30, height: 40, clickAction: { type: 'slide', slideId: 's2' } }),
          text('link', { content: '<p><a href="#/s-s2" target="_blank">two</a></p>' }),
          text('web', { clickAction: { type: 'url', url: 'https://x.org' } }),
          text('bad', { clickAction: { type: 'url', url: 'javascript:alert(1)' } }),
          text('back', { clickAction: { type: 'prev' } }),
          text('secret', { content: '<p>SECRET</p>', startHidden: true }),
        ] },
        { id: 's2', elements: [text('later', { fragment: true, fragmentIndex: 1, clickAction: { type: 'prev' } })] },
      ] })
      const html = await blob.text()
      expect(html).toContain('<div class="slide-page" id="s-s1"')
      expect(html.match(/id="s-s2"/g)).toHaveLength(1) // only the slide's first page
      expect(html).toContain('<a href="#s-s2" style="position:absolute;left:10px;top:20px;width:30px;height:40px;')
      expect(html).toContain('<a href="#s-s2" target="_blank">two</a>')
      expect(html).toContain('<a href="https://x.org"')
      expect(html).not.toContain('javascript:')
      expect(html.match(/<a href="#s-s1"/g)).toHaveLength(1) // "later" links back only once it's shown
      expect(html).toMatch(/visibility:hidden;[^>]*>\s*<p>SECRET/)
    } finally {
      vi.useRealTimers()
      createObjectURL.mockRestore()
      vi.restoreAllMocks()
    }
  })
})
