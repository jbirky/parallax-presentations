import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { Window } from 'happy-dom'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import * as client from './clickActions'
import { generateRevealHTML, exportPDF } from './generateHTML'

const require = createRequire(import.meta.url)
const server = require('../../../server/services/click-actions.js')
const { serverCopy, COPIES } = require('../../../scripts/copy-click-actions.js')

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

  it('marks what a hover shows or hides, and lets the keyboard reach it', () => {
    const els = [
      text('spot', { hoverAction: { type: 'visibility', show: ['card', 'bad id'], hide: ['plain'] } }),
      text('both', { clickAction: { type: 'next' }, hoverAction: { type: 'visibility', show: ['card'] } }),
      text('card', { startHidden: true }),
      text('plain'),
      { id: 'embed', type: 'html', hoverAction: { type: 'visibility', show: ['card'] } },
    ]
    const targets = client.visibilityTargets({ elements: els })
    expect([...targets].sort()).toEqual(['card', 'plain'])
    const attrs = id => client.clickActionAttrs(els.find(e => e.id === id), targets)
    expect(attrs('spot')).toBe(' data-hover-show="card" data-hover-hide="plain" tabindex="0"')
    expect(attrs('both')).toBe(' data-action="next" role="button" tabindex="0" data-hover-show="card"')
    expect(attrs('card')).toBe(' data-el="card" data-start-hidden data-hidden')
    expect(attrs('plain')).toBe(' data-el="plain"')
    expect(attrs('embed')).toBe('') // takes its own pointer
    expect(client.clickActionAttrs(text('x', { hoverAction: { type: 'visibility', show: [] } }))).toBe('')
    expect(client.clickActionAttrs(text('x', { hoverAction: { type: 'spin', show: ['a'] } }))).toBe('')
  })

  it('keeps hovers pointing at the right elements when they get new ids', () => {
    const els = [text('spot', { hoverAction: { type: 'visibility', show: ['card'], hide: ['spot', 'gone'] } }), text('card')]
    let n = 0
    const renewed = client.renewElementIds(els, () => `new${++n}`)
    expect(renewed[0].hoverAction).toEqual({ type: 'visibility', show: ['new2'], hide: ['new1', 'gone'] })
    expect(client.copyElement(els[0], 'copy').hoverAction.hide).toEqual(['copy', 'gone'])
    expect(els[0].hoverAction.hide).toEqual(['spot', 'gone'])
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

  it('points a copy’s clicks on itself at the copy', () => {
    const dismiss = text('note', { clickAction: { type: 'visibility', hide: ['note', 'other'] } })
    expect(client.copyElement(dismiss, 'copy')).toEqual({ ...dismiss, id: 'copy', clickAction: { type: 'visibility', hide: ['copy', 'other'] } })
    expect(dismiss.clickAction.hide).toEqual(['note', 'other'])
    expect(client.copyElement(text('a', { clickAction: { type: 'next' } }), 'b')).toEqual(text('b', { clickAction: { type: 'next' } }))
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

describe('previewing hovers on the canvas', () => {
  let n = 0
  const [marker, box, words] = client.buildHotspot({ makeId: () => `h${++n}` })
  const tab = text('tab', { clickAction: { type: 'visibility', show: ['words'] }, hoverAction: { type: 'visibility', hide: [marker.id] } })
  const els = [marker, box, words, tab]

  it('lists each hover, after the clicks', () => {
    const preview = client.canvasClickPreview(els, null)
    expect(preview.canPreview).toBe(true)
    expect(preview.hovers.map(h => h.id)).toEqual([marker.id, tab.id])
    expect(preview.mode).toBe('start')
    expect(preview.elements).toEqual([marker, tab]) // the card starts hidden
    expect(client.canvasClickPreview([text('a', { hoverAction: { type: 'visibility', hide: ['b'] } }), text('b')], null).canPreview).toBe(true)
  })

  it('shows the slide while an element is hovered', () => {
    expect(client.canvasClickPreview(els, client.hoverPreview(marker.id)).elements).toEqual(els)
    expect(client.canvasClickPreview(els, client.hoverPreview(tab.id)).elements).toEqual([tab])
    expect(client.canvasClickPreview(els, client.hoverPreview('nope')).mode).toBe('start')
    expect([...client.hiddenInPreview(els, client.hoverPreview(tab.id))].sort()).toEqual([marker.id, box.id, words.id].sort())
    expect([...client.hiddenInPreview(els, 'start')].sort()).toEqual([box.id, words.id].sort())
  })

  it('switches to a hotspot’s hover when it’s selected, or to one that shows what’s selected', () => {
    expect(client.previewForSelection(els, marker.id, 'start')).toBe(client.hoverPreview(marker.id))
    expect(client.previewForSelection(els, marker.id, client.hoverPreview(marker.id))).toBeNull()
    expect(client.previewForSelection(els, words.id, 'start')).toBe(client.hoverPreview(marker.id))
    expect(client.previewForSelection(els, tab.id, 'start')).toBe(tab.id) // its click comes first
  })

  it('makes a marker whose hover shows a grouped card', () => {
    expect(marker).toMatchObject({ type: 'shape', shape: 'circle', hoverAction: { type: 'visibility', show: [box.id, words.id] } })
    expect(box.groupId).toBeTruthy()
    expect(words.groupId).toBe(box.groupId)
    expect([box.startHidden, words.startHidden, marker.startHidden]).toEqual([true, true, undefined])
    for (const el of [marker, box, words]) {
      expect(el.x + el.width).toBeLessThanOrEqual(960)
      expect(el.y + el.height).toBeLessThanOrEqual(540)
    }
    const small = client.buildHotspot({ slideW: 400, slideH: 300, makeId: () => `s${++n}` })
    for (const el of small) expect([el.x >= 0, el.x + el.width <= 400, el.y >= 0, el.y + el.height <= 300]).toEqual([true, true, true, true])
  })
})

describe('element states', () => {
  const card = text('card', {
    states: [
      { id: 'st_big', name: 'Big', x: 10, y: 20, width: 300, height: 200, rotation: 15, scale: 1.5, opacity: 0.5, zIndex: 9000, fill: '#ff0000', stroke: 'rgb(1, 2, 3)', textColor: 'white', duration: 250, easing: 'spring' },
      { id: 'st_flip', name: 'Flipped', flipX: true, duration: 99999, easing: 'bogus' },
    ],
    initialState: 'st_flip', backfaceHidden: true,
  })

  it('marks an element with states, starting in its first one', () => {
    expect(client.clickActionAttrs(card, new Set())).toBe(' data-el="card" data-st-list="st_big st_flip" data-st="st_flip" data-st-start="st_flip"')
    expect(client.clickActionAttrs({ ...card, initialState: 'gone' }, new Set())).toContain(' data-st="" data-st-start=""')
    // Ids that can't go into the page safely leave the states out
    expect(client.clickActionAttrs(text('bad"id', { states: card.states }), new Set())).toBe('')
    expect(client.clickActionAttrs(text('x', { states: [{ id: 'a b' }, { id: 'ok' }] }), new Set())).toContain('data-st-list="ok"')
  })

  it('writes the state changes a click or hover makes', () => {
    const click = text('b', { clickAction: { type: 'visibility', set: [
      { id: 'card', state: 'st_big', mode: 'toggle' }, { id: 'card', mode: 'cycle' }, { id: 'card', state: '' }, { id: 'x"y', state: 'a' }, { id: 'card', state: 'a b' }, { id: 'card', state: 'z', mode: 'explode' },
    ] } })
    expect(client.clickActionAttrs(click)).toBe(' data-action="visibility" data-action-set="card:st_big:toggle card::cycle card::set" role="button" tabindex="0"')
    const hover = text('h', { hoverAction: { type: 'visibility', set: [{ id: 'card', state: 'st_big', mode: 'toggle' }, { id: 'card', state: 'st_flip' }] } })
    expect(client.clickActionAttrs(hover)).toBe(' data-hover-set="card:st_flip" tabindex="0"') // a hover only sets
    expect([...client.visibilityTargets({ elements: [click, hover] })]).toEqual(['card'])
  })

  it('writes CSS from checked values only', () => {
    const css = client.statesCss([{ elements: [card, text('plain')] }])
    const on = id => `[data-el="card"][data-st="${id}"]:not([data-hover-st]), [data-el="card"][data-hover-st="${id}"]`
    expect(css).toContain(`.reveal .slides :where([data-el="card"]) { transform:perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1); backface-visibility:hidden; }`)
    expect(css).toContain(`.reveal .slides :where(${on('st_big')}) { --st-dur:250ms; --st-ease:cubic-bezier(0.34,1.56,0.64,1); left:10px !important; top:20px !important; width:300px !important; height:200px !important; rotate:15deg !important; z-index:9000 !important; transform:perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1.5); }`)
    expect(css).toContain(`:not(.fragment:not(.visible))) { opacity:0.5 !important; }`)
    expect(css).toContain(`> svg > g { fill:#ff0000; stroke:rgb(1, 2, 3); }`)
    expect(css).toContain(`> svg > text { fill:white; }`)
    expect(css).toContain(`.reveal .slides :where(${on('st_flip')}) { --st-dur:10000ms; --st-ease:ease; transform:perspective(1000px) rotateX(0deg) rotateY(180deg) scale(1); }`)
    expect(css).not.toContain('plain')
    const evil = text('e', { states: [{ id: 's', fill: 'red;} body{display:none', stroke: 'url(javascript:x)', textColor: '</style><script>', x: '10px;color:red', width: Infinity }] })
    const evilCss = client.statesCss([{ elements: [evil] }])
    expect(evilCss).not.toMatch(/display:none|javascript|script|color:red|Infinity|fill|stroke|left|width/)
    expect(client.statesCss([{ elements: [text('i', { type: 'image', filterBrightness: 120, states: [{ id: 'g', filterGrayscale: 100 }] })] }]))
      .toContain('img { filter:brightness(120%) contrast(100%) grayscale(100%) !important; }')
    expect(client.statesCss([{ elements: [{ id: 'l', type: 'shape', shape: 'line', states: [{ id: 'c', fill: '#00ff00' }] }] }])).toContain('> svg > :is(line, polyline) { stroke:#00ff00; }')
    expect(client.statesCss([{ elements: [{ id: 'l', type: 'shape', shape: 'line', stroke: '#fff', states: [{ id: 'c', fill: '#00ff00' }] }] }])).not.toContain('stroke')
  })

  it('keeps state changes pointing at the right elements when they get new ids', () => {
    const els = [text('b', { clickAction: { type: 'visibility', set: [{ id: 'card', state: 'st_big', mode: 'set' }] }, hoverAction: { type: 'visibility', set: [{ id: 'b', state: 's' }] } }), card]
    let n = 0
    const renewed = client.renewElementIds(els, () => `n${++n}`)
    expect(renewed[0].clickAction.set).toEqual([{ id: 'n2', state: 'st_big', mode: 'set' }])
    expect(renewed[0].hoverAction.set).toEqual([{ id: 'n1', state: 's' }])
  })

  it('shows an element in a state, and records into one', () => {
    expect(client.withState(card, 'st_big')).toMatchObject({ x: 10, y: 20, width: 300, fill: '#ff0000', scale: 1.5, states: card.states })
    expect(client.withState(card, 'nope')).toBe(card)
    expect(client.withState(card, null)).toBe(card)
    const recorded = client.recordIntoState(card, 'st_flip', { x: 5, content: '<p>new</p>', zIndex: 3 })
    expect(recorded.content).toBe('<p>new</p>')
    expect(recorded.x).toBe(0)
    expect(recorded.states[1]).toMatchObject({ id: 'st_flip', flipX: true, x: 5, zIndex: 3 })
    expect(card.states[1].x).toBeUndefined()
    expect(client.recordIntoState(card, 'nope', { x: 5 }).x).toBe(5)
  })

  it('knows when a state hides an element', () => {
    expect(client.hiddenByState(card, 'st_flip')).toBe(true) // turned over with its back hidden
    expect(client.hiddenByState({ ...card, backfaceHidden: false }, 'st_flip')).toBe(false)
    expect(client.hiddenByState(text('o', { states: [{ id: 'gone', opacity: 0 }] }), 'gone')).toBe(true)
    // An invisible shape can be a button; a state that leaves it invisible doesn't hide it
    expect(client.hiddenByState({ id: 's', type: 'shape', opacity: 0, states: [{ id: 'a', fill: 'red' }] }, 'a')).toBe(false)
  })
})

describe('previewing states on the canvas', () => {
  let n = 0
  const [front, back] = client.buildFlipCard({ makeId: () => `f${++n}` })
  const els = [front, back]

  it('shows elements in their first states as the slide opens, and after a click', () => {
    const start = client.canvasClickPreview(els, null)
    expect(start.canPreview).toBe(true)
    expect(start.elements.map(e => e.id)).toEqual([front.id]) // the back starts turned away
    const clicked = client.canvasClickPreview(els, front.id)
    expect(clicked.elements.map(e => e.id)).toEqual([back.id])
    expect(clicked.states.get(back.id)).toBe('')
    expect(client.canvasClickPreview(els, 'all').elements).toEqual(els)
  })

  it('shows what’s selected as it is, to be edited', () => {
    const preview = client.canvasClickPreview(els, null, [back.id])
    expect(preview.elements.find(e => e.id === back.id)).toBe(back)
  })

  it('previews a hover’s state, and a cycle of states', () => {
    const spot = text('spot', { hoverAction: { type: 'visibility', set: [{ id: 'dot', state: 'b' }] } })
    const dot = text('dot', { states: [{ id: 'a', x: 1 }, { id: 'b', x: 2 }] })
    const next = text('next', { clickAction: { type: 'visibility', set: [{ id: 'dot', mode: 'cycle' }] } })
    expect(client.canvasClickPreview([spot, dot, next], client.hoverPreview('spot')).elements.find(e => e.id === 'dot').x).toBe(2)
    expect(client.canvasClickPreview([spot, dot, next], 'next').elements.find(e => e.id === 'dot').x).toBe(1)
    expect(client.statesInPreview([spot, { ...dot, initialState: 'b' }, next], 'next').get('dot')).toBe('')
  })
})

describe('morphing shapes', () => {
  const blob = { id: 'm', type: 'shape', shape: 'circle', x: 0, y: 0, width: 100, height: 100, fill: '#f00', text: 'Hi',
    states: [{ id: 'star', name: 'Star', shape: 'star' }, { id: 'wide', name: 'Wide', width: 300, borderRadius: 4, duration: 400, easing: 'spring' }, { id: 'red', fill: '#0f0' }] }

  it('draws a shape whose states change its outline as a path, with each state’s outline', () => {
    const svg = client.shapeSvg(blob)
    const outlines = /data-morph="([^"]+)"/.exec(svg)[1].split('|')
    expect(outlines.map(o => o.slice(0, o.indexOf(':')))).toEqual(['', 'star', 'wide', 'red'])
    for (const o of outlines) expect(o.slice(o.indexOf(':') + 1).split(' ')).toHaveLength(64)
    expect(outlines[2]).toMatch(/:150,0 /) // the wide state's top middle
    expect(svg).toMatch(/<path d="M50 0L/) // it starts as its default
    expect(client.shapeSvg({ ...blob, initialState: 'star' })).toMatch(/<path d="M50 0L/)
    expect(client.shapeSvg({ ...blob, initialState: 'wide' })).toMatch(/<path d="M150 0L/)
  })

  it('leaves a shape whose states only recolor it, and lines, as they are drawn', () => {
    expect(client.shapeSvg({ ...blob, states: [blob.states[2]] })).toContain('<ellipse')
    expect(client.shapeSvg({ ...blob, shape: 'line' })).toContain('<line')
    expect(client.shapeSvg({ ...blob, states: [{ id: 'x', shape: 'squiggle' }] })).toContain('<ellipse')
  })

  it('moves the path’s points to the new state’s outline', () => {
    vi.useFakeTimers()
    try {
      const win = new Window({ url: 'http://localhost/deck.html' })
      const svg = client.shapeSvg(blob)
      win.document.body.innerHTML = `<style>${client.statesCss([{ elements: [blob] }])}</style><div class="reveal"><div class="slides"><section>
        <div id="go" data-action="visibility" data-action-set="m:wide:toggle"></div>
        <div id="m" data-el="m" data-st-list="star wide red" data-st="" data-st-start="">${svg}</div></section></div></div>`
      const Reveal = { on: () => {} }
      let reduced = false
      win.matchMedia = () => ({ matches: reduced })
      win.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 16)
      win.cancelAnimationFrame = id => clearTimeout(id)
      new Function('window', 'document', 'Reveal', client.CLICK_ACTION_SCRIPT)(win, win.document, Reveal)
      const path = win.document.querySelector('path')
      const top = () => path.getAttribute('d').match(/^M([\d.]+) /)[1]
      const click = () => win.document.getElementById('go').dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
      click()
      vi.advanceTimersByTime(200)
      expect(+top()).toBeGreaterThan(100) // on its way (a spring goes a little past)
      expect(top()).not.toBe('150.00')
      vi.advanceTimersByTime(400)
      expect(top()).toBe('150.00')
      // With the state's own easing, read from its CSS: a spring overshoots
      expect(win.getComputedStyle(win.document.getElementById('m')).getPropertyValue('--st-ease')).toBe('cubic-bezier(0.34,1.56,0.64,1)')
      const mid = []
      click()
      for (let i = 0; i < 30; i++) { vi.advanceTimersByTime(16); mid.push(+top()) }
      expect(Math.min(...mid)).toBeLessThan(50) // past the default's top middle, then back
      expect(top()).toBe('50.00')
      click()
      vi.advanceTimersByTime(1000)
      reduced = true
      click()
      expect(top()).toBe('50.00') // at once, with reduced motion
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the state presets', () => {
  let n = 0
  const makeId = () => `p${++n}`

  it('makes a flip card whose parts turn over together', () => {
    const [front, back] = client.buildFlipCard({ makeId })
    expect(front.groupId).toBe(back.groupId)
    expect([front.backfaceHidden, back.backfaceHidden]).toEqual([true, true])
    expect(back.initialState).toBe(back.states[0].id)
    expect([front.states[0].flipX, back.states[0].flipX]).toEqual([true, -180]) // both turn the same way
    expect(front.clickAction).toEqual(back.clickAction)
    expect(front.clickAction.set).toEqual([
      { id: front.id, state: front.states[0].id, mode: 'toggle' }, { id: back.id, state: back.states[0].id, mode: 'toggle' },
    ])
  })

  it('makes quiz answers that each set their own state', () => {
    const [question, ...answers] = client.buildQuiz({ makeId })
    expect(question.type).toBe('text')
    expect(answers.map(a => a.states[0].name)).toEqual(['Right', 'Wrong', 'Wrong'])
    for (const a of answers) expect(a.clickAction.set).toEqual([{ id: a.id, state: a.states[0].id, mode: 'set' }])
  })

  it('makes an element zoom to the middle of the slide and back', () => {
    const el = text('z', { x: 0, y: 0, width: 96, height: 54, clickAction: { type: 'visibility', show: ['other'] } })
    const zoomed = client.withClickToZoom(el)
    expect(zoomed.states[0]).toMatchObject({ name: 'Zoomed', x: 432, y: 243, scale: 8.5, zIndex: 9000 })
    expect(zoomed.clickAction).toEqual({ type: 'visibility', show: ['other'], set: [{ id: 'z', state: zoomed.states[0].id, mode: 'toggle' }] })
    expect(client.withClickToZoom(text('n', { clickAction: { type: 'next' } }))).toBeNull()
    expect(client.withClickToZoom({ id: 'h', type: 'html' })).toBeNull()
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

  it('gives slides and their elements new ids, with links and show/hide following them', () => {
    const deck = [...slides, { elements: [text('t', { clickAction: { type: 'visibility', show: ['p'] } }), text('p', { startHidden: true })] }]
    let n = 0
    const [a, b, c] = client.renewSlideIds(deck, () => `n${++n}`)
    expect([a.id, b.id, c.id]).toEqual(['n1', 'n5', 'n7'])
    expect(a.elements.map(e => e.id)).toEqual(['n2', 'n3', 'n4'])
    expect(a.elements[0].content).toBe('<p><a href="#/s-n5">next</a> <a href="#/s-elsewhere">x</a> <a href="#/s-old22">y</a></p>')
    expect(a.elements[1].clickAction).toEqual({ type: 'slide', slideId: 'n5' })
    expect(a.elements[2].content).toBe('[back](#/s-n1)')
    expect(c.elements[0].clickAction).toEqual({ type: 'visibility', show: ['n9'] })
    expect(slides[0].id).toBe('old1') // the originals are left alone
    expect(client.renewSlideIds(undefined, () => 'x')).toEqual([])
    let m = 0
    expect(server.renewSlideIds(deck, () => `n${++m}`)).toEqual(client.renewSlideIds(deck, (() => { let k = 0; return () => `n${++k}` })()))
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
  it('is up to date (if not, run node scripts/copy-click-actions.js)', () => {
    for (const copy of COPIES) expect(readFileSync(copy.TARGET, 'utf8')).toBe(serverCopy(readFileSync(copy.SOURCE, 'utf8'), copy))
  })

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
      text('d', { hoverAction: { type: 'visibility', show: ['b'], hide: ['c'] } }),
    ] }
    const targets = client.visibilityTargets(tabs)
    expect([...server.visibilityTargets(tabs)]).toEqual([...targets])
    for (const el of tabs.elements) expect(server.clickActionAttrs(el, targets)).toBe(client.clickActionAttrs(el, targets))
    let a = 0, b = 0
    expect(server.renewElementIds(tabs.elements, () => `n${++a}`)).toEqual(client.renewElementIds(tabs.elements, () => `n${++b}`))
    const flip = client.buildFlipCard({ makeId: () => `f${++a}` })
    expect(server.statesCss([{ elements: flip }])).toBe(client.statesCss([{ elements: flip }]))
    const morphing = { id: 'm', type: 'shape', shape: 'circle', width: 80, height: 80, states: [{ id: 'star', shape: 'star', width: 120 }] }
    expect(server.shapeSvg(morphing)).toBe(client.shapeSvg(morphing))
    for (const el of flip) expect(server.clickActionAttrs(el, targets)).toBe(client.clickActionAttrs(el, targets))
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

describe('hovering in presented decks', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const later = () => vi.advanceTimersByTime(200)

  function page(body) {
    const win = new Window({ url: 'http://localhost/deck.html' })
    win.document.body.innerHTML = `<div class="reveal"><div class="slides">${body}</div></div>`
    const handlers = {}
    const Reveal = { next: vi.fn(), on: (name, fn) => { handlers[name] = fn }, emit: (name, e) => handlers[name]?.(e) }
    new Function('window', 'document', 'Reveal', client.CLICK_ACTION_SCRIPT)(win, win.document, Reveal)
    const doc = win.document
    const $ = sel => doc.querySelector(sel)
    const pointer = (type, el, extra = {}) => el.dispatchEvent(new win.PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...extra }))
    const over = (el, pointerType = 'mouse') => pointer('pointerover', el, { pointerType })
    const tap = el => { pointer('pointerdown', el, { pointerType: 'touch' }); el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })) }
    // Whether the page's CSS would hide the element: hidden by a click and not shown by a hover, or hidden by a hover
    const hidden = sel => { const el = $(sel); return (el.hasAttribute('data-hidden') && !el.hasAttribute('data-hover-shown')) || el.hasAttribute('data-hover-hidden') }
    return { win, doc, $, Reveal, pointer, over, tap, hidden }
  }
  const slide = `
    <section id="one">
      <div id="spot" data-hover-show="card" data-hover-hide="note" tabindex="0"><p>i</p></div>
      <div id="card" data-el="card" data-start-hidden data-hidden><p id="inside">Card</p></div>
      <div id="note" data-el="note"></div>
      <div id="bg"></div>
      <div id="tab" data-action="visibility" data-action-toggle="note" data-hover-show="card" tabindex="0"></div>
    </section>
    <section id="two"><div data-el="card" data-hidden></div></section>`

  it('shows and hides while the pointer is over the element, then puts them back', () => {
    const { $, over, hidden } = page(slide)
    over($('#spot p'))
    expect([hidden('#card'), hidden('#note'), hidden('#two [data-el]')]).toEqual([false, true, true])
    expect($('#card').hasAttribute('data-hidden')).toBe(true) // what clicks did is left alone underneath
    over($('#bg'))
    expect(hidden('#card')).toBe(false) // for a moment
    later()
    expect([hidden('#card'), hidden('#note')]).toEqual([true, false])
  })

  it('keeps a card shown while the pointer crosses onto it and stays there, and ends when the pointer leaves the page', () => {
    const { $, doc, over, pointer, hidden } = page(slide)
    over($('#spot'))
    over($('#bg')) // a gap between the marker and the card
    over($('#inside'))
    later()
    expect(hidden('#card')).toBe(false)
    pointer('pointerout', $('#inside'), { relatedTarget: null })
    later()
    expect(hidden('#card')).toBe(true)
    over($('#spot'))
    pointer('pointerout', $('#spot'), { relatedTarget: $('#bg') })
    later()
    expect(hidden('#card')).toBe(false) // pointerover on what it moved to decides
    over($('#inside'))
    over($('#bg'))
    later()
    expect(hidden('#card')).toBe(true)
    expect(doc.querySelectorAll('[data-hover-shown], [data-hover-hidden]')).toHaveLength(0)
  })

  it('switches straight to another hover', () => {
    const { $, over, hidden } = page(`<section>
      <div id="a" data-hover-show="x"></div><div id="b" data-hover-show="y"></div>
      <div data-el="x" id="x" data-hidden></div><div data-el="y" id="y" data-hidden></div></section>`)
    over($('#a'))
    over($('#b'))
    expect([hidden('#x'), hidden('#y')]).toEqual([true, false])
  })

  it('lies over a click, which shows through again when the hover ends', () => {
    const { $, over, hidden, win } = page(slide)
    over($('#spot'))
    const click = () => $('#tab').dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }))
    click() // hides the note underneath the hover's hiding it
    expect(hidden('#note')).toBe(true)
    over($('#bg'))
    later()
    expect(hidden('#note')).toBe(true) // the click hid it
    click()
    over($('#spot'))
    expect(hidden('#note')).toBe(true) // the hover hides it over the click's showing it
    over($('#bg'))
    later()
    expect(hidden('#note')).toBe(false)
    over($('#tab'))
    expect(hidden('#card')).toBe(false) // a clickable element can have a hover too
  })

  it('shows on keyboard focus, not on a click’s focus', () => {
    const { $, win, pointer, hidden } = page(slide)
    const focus = (type, el) => el.dispatchEvent(new win.FocusEvent(type, { bubbles: true }))
    win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab' }))
    focus('focusin', $('#spot'))
    expect(hidden('#card')).toBe(false)
    focus('focusout', $('#spot'))
    expect(hidden('#card')).toBe(true)
    pointer('pointerdown', $('#spot'))
    focus('focusin', $('#spot'))
    expect(hidden('#card')).toBe(true)
  })

  it('turns on and off with a tap on a touch screen, unless the element has a click action', () => {
    const { $, over, tap, hidden } = page(slide)
    over($('#spot'), 'touch')
    expect(hidden('#card')).toBe(true) // touch doesn't hover
    tap($('#spot'))
    expect(hidden('#card')).toBe(false)
    tap($('#inside'))
    expect(hidden('#card')).toBe(false) // a tap on the card keeps it
    tap($('#spot p'))
    expect(hidden('#card')).toBe(true)
    tap($('#spot'))
    tap($('#bg'))
    expect(hidden('#card')).toBe(true) // a tap elsewhere ends it
    tap($('#tab'))
    expect([hidden('#card'), hidden('#note')]).toEqual([true, true]) // the click action ran instead
  })

  it('treats a group’s parts as one hover on touch', () => {
    const { $, tap, hidden } = page(`<section>
      <div id="a" data-hover-show="card"></div><div id="b" data-hover-show="card"></div>
      <div id="card" data-el="card" data-hidden></div></section>`)
    tap($('#a'))
    expect(hidden('#card')).toBe(false)
    tap($('#b'))
    expect(hidden('#card')).toBe(true)
  })

  it('puts elements in states on click: set, toggle and cycle, and back as the slide opens again', () => {
    const { $, win, Reveal, doc } = page(`
      <section id="one">
        <div id="set" data-action="visibility" data-action-set="card:big:set"></div>
        <div id="toggle" data-action="visibility" data-action-set="card:big:toggle"></div>
        <div id="cycle" data-action="visibility" data-action-set="card::cycle other:nope:set"></div>
        <div id="card" data-el="card" data-st-list="big small" data-st="small" data-st-start="small"></div>
        <div id="other" data-el="other" data-st-list="a" data-st=""></div>
      </section>`)
    const click = id => $(`#${id}`).dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }))
    const st = () => $('#card').getAttribute('data-st')
    click('set'); expect(st()).toBe('big')
    click('toggle'); expect(st()).toBe('')
    click('toggle'); expect(st()).toBe('big')
    click('cycle'); expect(st()).toBe('small')
    click('cycle'); expect(st()).toBe('')
    click('cycle'); expect(st()).toBe('big')
    expect($('#other').getAttribute('data-st')).toBe('') // a state it doesn't have
    Reveal.emit('slidechanged', { currentSlide: doc.getElementById('one') })
    expect(st()).toBe('small')
  })

  it('lays a hover’s states over a click’s, and takes them off when it ends', () => {
    const { $, over, hidden } = page(`
      <section>
        <div id="spot" data-hover-set="card:big other:" tabindex="0"></div>
        <div id="card" data-el="card" data-st-list="big" data-st=""></div>
        <div id="other" data-el="other" data-st-list="a" data-st="a"></div>
        <div id="bg"></div>
      </section>`)
    over($('#spot'))
    expect([$('#card').getAttribute('data-hover-st'), $('#other').getAttribute('data-hover-st'), $('#card').getAttribute('data-st')]).toEqual(['big', '', ''])
    over($('#bg')); later()
    expect([$('#card').hasAttribute('data-hover-st'), $('#other').hasAttribute('data-hover-st'), $('#other').getAttribute('data-st')]).toEqual([false, false, 'a'])
    expect(hidden('#card')).toBe(false)
  })

  it('ends when the slide changes', () => {
    const { $, doc, over, Reveal, hidden } = page(slide)
    over($('#spot'))
    Reveal.emit('slidechanged', { currentSlide: doc.getElementById('two') })
    expect(hidden('#card')).toBe(true)
    expect(doc.querySelectorAll('[data-hover-shown], [data-hover-hidden]')).toHaveLength(0)
  })

  it('writes the page CSS so a hover wins over a click', () => {
    expect(client.CLICK_ACTION_CSS).toContain('[data-el][data-hidden]:not([data-hover-shown]), .reveal .slides [data-el][data-hover-hidden] { opacity:0 !important')
    const html = generateRevealHTML({ id: 'p', slides: [{ id: 's1', elements: [
      text('spot', { hoverAction: { type: 'visibility', show: ['card'] } }), text('card', { startHidden: true }),
    ] }] })
    expect(html).toContain('data-hover-show="card" tabindex="0"')
    expect(html).toContain('data-el="card" data-start-hidden data-hidden')
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
  it('prints elements in their first states', async () => {
    let blob = null
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      const [front, back] = client.buildFlipCard({ makeId: (() => { let n = 0; return () => `k${++n}` })() })
      exportPDF({ id: 'p', slides: [{ id: 's1', elements: [
        { ...front, text: 'FRONT' }, { ...back, text: 'BACK' },
        text('moved', { content: '<p>MOVED</p>', x: 5, states: [{ id: 'm', x: 400 }], initialState: 'm' }),
      ] }] })
      const html = await blob.text()
      expect(html).toMatch(/left:400px;[^>]*>\s*<p>MOVED/)
      // The back starts turned away, with its back hidden
      const faceOf = word => new RegExp(`<div style="([^"]*)">(?:(?!<div)[\\s\\S])*${word}`).exec(html)?.[1]
      expect(faceOf('BACK')).toContain('visibility:hidden;')
      expect(faceOf('FRONT')).not.toContain('visibility:hidden;')
    } finally {
      vi.useRealTimers()
      createObjectURL.mockRestore()
      vi.restoreAllMocks()
    }
  })
})
