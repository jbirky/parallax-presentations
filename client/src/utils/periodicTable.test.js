import { describe, it, expect, vi } from 'vitest'
import { Window } from 'happy-dom'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import { PERIODIC_ROWS, PERIODIC_FIELDS as DATA_FIELDS } from './periodicData'
import {
  PT, PERIODIC_FIELDS, periodicSvg, periodicBox, periodicResize, periodicSteps, periodicStepAt, periodicStepMarkers,
  periodicDeckHtml, periodicDeckScript, defaultPeriodic, hasPeriodic,
} from './periodicTable'
import { generateRevealHTML, exportPDF } from './generateHTML'
import { supportsClickAction } from './clickActions'

const sym = z => PT.EL[z].sym
const electrons = subs => subs.reduce((n, s) => n + s.e, 0)
const config = z => PT.parse(z).subs.map(s => `${s.n}${'spdf'[s.l]}${s.e}`).join(' ')

describe('the data', () => {
  it('has all 118 elements, in the order the runtime reads', () => {
    expect(PERIODIC_ROWS).toHaveLength(118)
    expect(PERIODIC_ROWS.map(r => r[0])).toEqual(Array.from({ length: 118 }, (_, i) => i + 1))
    expect(DATA_FIELDS).toEqual(['z', 'symbol', 'name', 'mass', 'config', 'note', 'en', 'radius', 'ie', 'ea', 'ox', 'state', 'predicted', 'mp', 'bp', 'density', 'category', 'year'])
    expect(PT.EL[26]).toMatchObject({ sym: 'Fe', name: 'Iron', cat: 'Transition metal', en: 1.83, state: 'Solid' })
    // Nothing a page could mistake for markup
    expect(JSON.stringify(PERIODIC_ROWS)).not.toMatch(/[<>&]/)
  })

  it('has configurations whose electrons add up to Z', () => {
    for (let z = 1; z <= 118; z++) expect(electrons(PT.fullSubs(z))).toBe(z)
  })

  it('keeps the irregular configurations from the data', () => {
    expect(config(24)).toBe('4s1 3d5')     // Cr
    expect(config(29)).toBe('4s1 3d10')    // Cu
    expect(config(46)).toBe('4d10')        // Pd
    expect(config(64)).toBe('6s2 4f7 5d1') // Gd
    expect(config(90)).toBe('7s2 6d2')     // Th
  })

  it('has the fixes PubChem needs', () => {
    expect(config(103)).toBe('7s2 5f14 7p1')
    expect(PT.EL[13].year).toBe(1825)
    expect(PT.EL[20].year).toBe(1808)
    expect(PT.EL[6].yearText).toBe('Ancient')
    expect(PT.EL[114].ox).toBe('+6, +4, +2, +1, 0')
    expect(PT.EL[85].ox).toBe('+7, +5, +3, +1, -1')
    for (let z = 110; z <= 118; z++) expect(PT.EL[z].predicted).toBe(true)
    expect(PT.EL[118].state).toBe('Gas')
    expect(PT.EL[109]).toMatchObject({ predicted: false, note: 'calculated' })
  })

  it('counts shells and unpaired electrons', () => {
    expect(PT.shellCounts(26)).toEqual([2, 8, 14, 2])
    expect(PT.shellCounts(118)).toEqual([2, 8, 18, 32, 32, 18, 8])
    expect([1, 8, 10, 24, 26, 29, 64].map(PT.unpaired)).toEqual([1, 2, 0, 6, 4, 1, 8])
  })
})

describe('the layout', () => {
  const shows = ['all', 'periods-1-4', 'main-group', 'periods-1-3']
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  const box = t => ({ x: t.x, y: t.y, w: 60, h: 60 })

  it('puts no two tiles in one place, and the card over none, in any form', () => {
    for (const show of shows) for (const group3 of ['gap', 'la', 'lu']) for (const card of ['gap', 'side']) for (const arrow of ['', 'en']) {
      const L = PT.layout(PT.normalize({ show, group3, card, arrow }))
      const seen = new Set(L.tiles.map(t => `${t.x},${t.y}`))
      expect(seen.size).toBe(L.tiles.length)
      for (const t of L.tiles) {
        expect(overlap(box(t), L.card)).toBe(false)
        expect(t.x).toBeGreaterThanOrEqual(L.vb.x)
        expect(t.y + 60).toBeLessThanOrEqual(L.vb.y + L.vb.h)
        if (L.legend) expect(t.y + 60).toBeLessThan(L.legend.y)
      }
      for (const p of L.ph) for (const t of L.tiles) expect(overlap(box(p), box(t))).toBe(false)
    }
  })

  it('shows the elements each form asks for', () => {
    const zs = show => PT.layout(PT.normalize({ show })).tiles.map(t => t.z)
    expect(zs('all')).toHaveLength(118)
    expect(zs('periods-1-4')).toEqual(Array.from({ length: 36 }, (_, i) => i + 1))
    expect(zs('periods-1-3')).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
    expect(zs('main-group')).toHaveLength(50)
    expect(zs('main-group')).not.toContain(26)
    expect(PT.layout(PT.normalize({ show: 'element' })).tiles).toEqual([])
  })

  it('puts group 3 three ways', () => {
    expect(PT.pos(57, 'gap')).toEqual({ r: 9, c: 3 })
    expect(PT.pos(71, 'gap')).toEqual({ r: 9, c: 17 })
    expect(PT.pos(57, 'la')).toEqual({ r: 6, c: 3 })
    expect(PT.pos(71, 'lu')).toEqual({ r: 6, c: 3 })
    expect(PT.pos(103, 'lu')).toEqual({ r: 7, c: 3 })
    expect(PT.pos(72, 'gap')).toEqual({ r: 6, c: 4 })
    expect(PT.groupOf(57, 'gap')).toBe(null)
    expect(PT.groupOf(57, 'la')).toBe(3)
    expect(PT.blockOf(2)).toBe('s')
    expect(PT.blockOf(71, 'lu')).toBe('d')
    expect(PT.blockOf(71, 'gap')).toBe('f')
    expect(PT.periodOf(92)).toBe(7)
  })

  it('keeps its shape across steps, and the card in the gap only where there is one', () => {
    const a = periodicBox({ show: 'all' })
    expect(periodicBox({ show: 'all', steps: [{ colorBy: 'en' }, { colorBy: 'block' }] })).toEqual(a)
    expect(periodicBox({ show: 'all', steps: [{ arrow: 'en' }] }).w).toBeGreaterThan(a.w)
    expect(PT.layout(PT.normalize({ show: 'main-group', card: 'gap' })).card.mode).toBe('tall')
    expect(PT.layout(PT.normalize({ show: 'periods-1-3' })).card.mode).toBe('wide')
  })

  it('resizes the element when a change reshapes the table, keeping its width', () => {
    const el = { type: 'periodic', width: 900, height: 500, ...defaultPeriodic() }
    expect(periodicResize(el, { colorBy: 'en' })).toEqual({ colorBy: 'en' })
    const r = periodicResize(el, { show: 'element' })
    const b = periodicBox({ ...el, show: 'element' })
    expect(r.height).toBe(Math.round(900 * b.h / b.w))
  })
})

describe('settings', () => {
  it('reads anything, keeping only what it knows', () => {
    const s = PT.normalize({ colorBy: 'evil', orbitalView: 7, show: '<x>', restingElement: 'xx', stepStart: -3, theme: 'light', steps: 'no', labels: false })
    expect(s).toMatchObject({ colorBy: 'category', orbitalView: 'boxes', show: 'all', restingElement: 26, stepStart: 1, theme: 'light', steps: [], labels: false, legend: true })
    expect(PT.normalize({ restingElement: null }).restingElement).toBe(null)
    expect(PT.normalize({ restingElement: 'au' }).restingElement).toBe(79)
    expect(PT.normalize({ steps: Array(100).fill({}) }).steps).toHaveLength(60)
  })

  it('cleans highlights', () => {
    expect(PT.cleanHighlight('group:1, 99;category:halogen;z:C, N,999;bad:1;period:')).toBe('group:1;category:Halogen;z:6,7')
    expect(PT.cleanHighlight('block:p;state:gas')).toBe('block:p;state:Gas')
    expect(PT.cleanHighlight('<script>')).toBe('')
    expect(PT.highlighted('group:1', 1, 'gap')).toBe(true)
    expect(PT.highlighted('group:17', 117, 'gap')).toBe(true)
    expect(PT.highlighted('block:f', 57, 'gap')).toBe(true)
    expect(PT.highlighted('block:f', 57, 'la')).toBe(false)
    expect(PT.highlighted('z:6,7,8', 9, 'gap')).toBe(false)
  })

  it('has no field the canvas would apply as a transform', () => {
    expect(PERIODIC_FIELDS).not.toContain('scale')
    expect(PERIODIC_FIELDS).not.toContain('rotation')
    expect(Object.keys(defaultPeriodic())).toEqual(PERIODIC_FIELDS)
  })

  it('takes no click action, since it takes its own clicks', () => {
    expect(supportsClickAction({ type: 'periodic' })).toBe(false)
  })
})

describe('drawing', () => {
  it('draws every form, coloring, view and theme, with no NaN', () => {
    for (const show of ['all', 'periods-1-4', 'main-group', 'periods-1-3', 'element']) {
      for (const colorBy of PT.COLOR_BY) {
        for (const orbitalView of PT.VIEWS) {
          const theme = colorBy.length % 2 ? 'light' : 'dark'
          const svg = periodicSvg({ show, colorBy, orbitalView, theme, tileLabel: show === 'all' ? 'valence' : 'auto', restingElement: 1 + (colorBy.length * 13) % 118, arrow: 'en' })
          expect(svg).toMatch(/^<svg /)
          expect(svg).not.toMatch(/NaN|undefined|Infinity|null/)
        }
      }
    }
  })

  it('draws every element’s card in every view', () => {
    for (let z = 1; z <= 118; z++) for (const orbitalView of ['boxes', 'shells']) {
      expect(periodicSvg({ show: 'element', restingElement: z, orbitalView, showCore: z % 2 === 0 })).not.toMatch(/NaN|undefined|Infinity/)
    }
    for (const z of [1, 6, 26, 29, 58, 92, 103, 118]) expect(periodicSvg({ show: 'element', restingElement: z, orbitalView: 'clouds' })).not.toMatch(/NaN|undefined|Infinity/)
  })

  it('shows the right subshell’s clouds', () => {
    const cloud = z => periodicSvg({ show: 'element', restingElement: z, orbitalView: 'clouds' }).match(/data-pt-cloud data-n="(\d)" data-l="(\d)"/).slice(1).join('')
    expect(cloud(26)).toBe('32')  // 3d
    expect(cloud(92)).toBe('53')  // 5f, not U's lone 6d electron
    expect(cloud(29)).toBe('40')  // Cu's open 4s
    expect(cloud(10)).toBe('21')  // Ne's full 2p
    expect(cloud(1)).toBe('10')
  })

  it('samples a cloud the same way every time', () => {
    const a = PT.samples(3, 2, 1)
    expect(a.pts.length).toBe(1100 * 4)
    expect(Array.from(a.pts.slice(0, 8)).every(Number.isFinite)).toBe(true)
    expect(a.r90).toBeGreaterThan(0)
  })

  it('dims what a highlight leaves out', () => {
    const svg = periodicSvg({ highlight: 'group:17' })
    expect(svg).toMatch(/data-pt-z="9" transform="translate\([\d.]+ [\d.]+\)">/)
    expect(svg).toMatch(/data-pt-z="11" transform="translate\([\d.]+ [\d.]+\)" opacity="0.22"/)
  })

  it('makes tiles reachable by keyboard only in a deck', () => {
    expect(periodicSvg({}, { mode: 'deck' })).toContain('tabindex="0"')
    expect(periodicSvg({})).not.toContain('tabindex')
    expect(periodicSvg({}, { standalone: true })).toMatch(/^<svg [^>]*width="[\d.]+" height="[\d.]+"/)
  })
})

describe('steps', () => {
  const el = { id: 'pt-1', type: 'periodic', x: 10, y: 20, width: 900, height: 500, ...defaultPeriodic(), stepStart: 2,
    steps: [{ highlight: 'group:17', pin: 'F' }, { highlight: 'category:Noble gas', colorBy: 'ie', arrow: 'ie', pin: 10 }] }

  it('counts its steps from the slide step it starts at', () => {
    expect(periodicSteps(el)).toEqual([[2, 1], [3, 2]])
    expect([0, 1, 2, 3, 9].map(n => periodicStepAt(el, n))).toEqual([0, 0, 1, 2, 2])
    expect(periodicSteps({ ...el, type: 'freebody' })).toEqual([])
    const markers = periodicStepMarkers({ elements: [el] })
    expect(markers).toContain('data-fragment-index="2" data-pt-step="pt-1" data-pt-step-at="1"')
    expect(markers).toContain('data-fragment-index="3" data-pt-step="pt-1" data-pt-step-at="2"')
  })

  it('shows each step as set, its color the table’s unless it sets one', () => {
    const s = PT.normalize(el)
    expect(PT.viewAt(s, 0)).toEqual({ colorBy: 'category', highlight: '', arrow: '', pin: null })
    expect(PT.viewAt(s, 1)).toEqual({ colorBy: 'category', highlight: 'group:17', arrow: '', pin: 9 })
    expect(PT.viewAt(s, 2)).toEqual({ colorBy: 'ie', highlight: 'category:Noble gas', arrow: 'ie', pin: 10 })
    const at2 = periodicSvg(el, { step: 2 })
    expect(at2).toContain('Ionization energy increases')
    expect(at2).toContain('>Neon<')
  })

  it('goes in a deck with its settings and the script, once', () => {
    const html = generateRevealHTML({ title: 'T', slides: [{ id: 's1', elements: [el, { ...el, id: 'pt-2' }] }] })
    expect(html).toContain('data-pt="pt-1" data-pt-config="{&quot;colorBy&quot;')
    expect(html).toContain('data-pt-step="pt-2" data-pt-step-at="2"')
    expect(html.split('function periodicRuntime').length).toBe(2)
    expect(hasPeriodic({ slides: [{ elements: [el] }] })).toBe(true)
    expect(generateRevealHTML({ title: 'T', slides: [{ id: 's1', elements: [] }] })).not.toContain('periodicRuntime')
  })

  it('prints a page per step', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [el] }] })
      const html = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
      expect([...html.matchAll(/data-pt-at-page="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '1', '2'])
      expect(html).not.toContain('tabindex')
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})

describe('in a deck', () => {
  const el = { id: 'p1', type: 'periodic', width: 900, height: 500, ...defaultPeriodic(), orbitalView: 'clouds',
    steps: [{ highlight: 'group:17', pin: 9 }] }

  function deck(element = el) {
    const win = new Window({ url: 'http://localhost/deck.html' })
    const pt = periodicDeckHtml(element)
    win.document.body.innerHTML = `<div class="reveal"><div class="slides"><section class="present">
      <div id="t" ${pt.attrs} style="position:absolute;width:900px;height:500px">${pt.svg}</div>${periodicStepMarkers({ elements: [element] })}</section></div></div>`
    const handlers = {}
    const Reveal = { on: (name, fn) => { (handlers[name] = handlers[name] || []).push(fn) } }
    win.requestAnimationFrame = () => 0
    win.cancelAnimationFrame = () => {}
    new Function('window', 'document', 'Reveal', periodicDeckScript())(win, win.document, Reveal)
    const root = win.document.getElementById('t')
    const tile = z => root.querySelector(`[data-pt-z="${z}"]`)
    const card = () => root.querySelector('[data-pt-card]').textContent
    const fire = (target, type, init = {}) => target.dispatchEvent(new win.MouseEvent(type, { bubbles: true, ...init }))
    const step = n => {
      win.document.querySelectorAll('.fragment[data-pt-step]').forEach(m => m.classList.toggle('visible', +m.getAttribute('data-pt-step-at') <= n))
      handlers.fragmentshown.forEach(fn => fn({ type: 'fragmentshown' }))
    }
    return { win, root, tile, card, fire, step, handlers }
  }

  it('shows the element pointed at, pins one clicked, and lets go on Esc', () => {
    const { win, root, tile, card, fire } = deck()
    expect(card()).toContain('Iron')
    fire(tile(79), 'mouseover')
    expect(card()).toContain('Gold')
    fire(tile(8), 'click')
    fire(tile(1), 'mouseover')
    expect(card()).toContain('Oxygen')
    expect(card()).toContain('Pinned')
    const esc = new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    win.document.body.dispatchEvent(esc)
    expect(esc.defaultPrevented).toBe(true)
    fire(root, 'mouseleave', { bubbles: false })
    expect(card()).toContain('Iron')
    // With nothing pinned, Esc is the deck's
    const esc2 = new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    win.document.body.dispatchEvent(esc2)
    expect(esc2.defaultPrevented).toBe(false)
  })

  it('follows the slide’s steps', () => {
    const { tile, card, step } = deck()
    step(1)
    expect(card()).toContain('Fluorine')
    expect(tile(11).getAttribute('opacity')).toBe('0.22')
    expect(tile(17).getAttribute('opacity')).toBe(null)
    step(0)
    expect(card()).toContain('Iron')
    expect(tile(11).getAttribute('opacity')).toBe(null)
  })

  it('lets go of a pin when the slide changes', () => {
    const { tile, card, fire, handlers } = deck()
    fire(tile(8), 'click')
    expect(card()).toContain('Oxygen')
    handlers.slidechanged.forEach(fn => fn({ type: 'slidechanged' }))
    expect(card()).toContain('Iron')
  })

  it('switches a cloud’s subshell from its chips', () => {
    const { root, fire } = deck()
    const sub = () => root.querySelector('[data-pt-cloud]').getAttribute('data-l')
    expect(sub()).toBe('2')
    fire(root.querySelector('[data-pt-sub="4s"]'), 'click')
    expect(sub()).toBe('0')
  })

  it('moves between tiles with the arrow keys, keeping them from the deck', () => {
    const { win, tile, card } = deck()
    tile(26).focus()
    const key = new win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    let reached = false
    win.document.addEventListener('keydown', () => { reached = true })
    tile(26).dispatchEvent(key)
    expect(win.document.activeElement).toBe(tile(27))
    expect(reached).toBe(false)
    expect(card()).toContain('Cobalt')
  })

  it('leaves the overview’s copies of slides alone', () => {
    const win = new Window({ url: 'http://localhost/deck.html' })
    const pt = periodicDeckHtml(el)
    win.document.body.innerHTML = `<section inert><div id="t" ${pt.attrs}>${pt.svg}</div></section>`
    new Function('window', 'document', 'Reveal', periodicDeckScript())(win, win.document, { on() {} })
    win.document.querySelector('[data-pt-z="79"]').dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }))
    expect(win.document.querySelector('[data-pt-card]').textContent).toContain('Iron')
  })
})

describe('on the canvas', () => {
  it('shows the element pointed at, and a double-click picks it', () => {
    const win = new Window({ url: 'http://localhost/editor' })
    const root = win.document.createElement('div')
    root.innerHTML = periodicSvg({}, { mode: 'canvas' })
    win.document.body.appendChild(root)
    const picked = []
    const api = PT.attach(root, {}, { mode: 'canvas', onPick: z => picked.push(z) })
    const tile = root.querySelector('[data-pt-z="6"]')
    tile.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }))
    expect(root.querySelector('[data-pt-card]').textContent).toContain('Carbon')
    // A click doesn't pin here: it selects and drags the element
    tile.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
    root.querySelector('[data-pt-z="7"]').dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }))
    expect(root.querySelector('[data-pt-card]').textContent).toContain('Nitrogen')
    tile.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }))
    expect(picked).toEqual([6])
    api.destroy()
  })
})

describe('the toolbar’s new one', () => {
  it('is the whole table showing iron, in the slide’s colors', () => {
    expect(defaultPeriodic(true)).toMatchObject({ show: 'all', restingElement: 26, theme: 'dark', steps: [] })
    expect(defaultPeriodic(false).theme).toBe('light')
    expect(sym(26)).toBe('Fe')
  })
})
