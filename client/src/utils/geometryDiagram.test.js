import { describe, it, expect, vi } from 'vitest'
import { Window } from 'happy-dom'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import {
  GEOMETRY_TEMPLATES, GEOMETRY_FIELDS, geometryModel, geometryPlan, geometrySvg, geometrySteps, geometryStepAt, geometryStepMarkers,
  geometryDeckHtml, geometryDeckScript, geometryTikz, GEOMETRY_CSS, geometryFromTemplate, defaultGeometry, hasGeometry, stepsPerLine, fitView,
} from './geometryDiagram'
import { GEO, geometryRuntime } from './geometryEngine'
import { generateRevealHTML, exportPDF } from './generateHTML'
import { supportsClickAction } from './clickActions'

const el = (over = {}) => ({ id: 'gm-1', type: 'geometry', x: 10, y: 20, width: 640, height: 400, ...defaultGeometry(true), ...over })
const tpl = key => geometryFromTemplate(key)

describe('the element', () => {
  it('starts as Euclid’s first proposition, a line a step, in the slide’s colors', () => {
    const d = defaultGeometry(false)
    expect(Object.keys(d).sort()).toEqual([...GEOMETRY_FIELDS].sort())
    expect(d.theme).toBe('light')
    expect(d.axes || d.grid).toBe(false)
    // Two points to start, then a step for each of the other six lines
    expect(d.steps.map(s => s.to)).toEqual([3, 4, 5, 6, 7, 8])
  })

  it('checks what it’s given', () => {
    const m = geometryModel({ view: { x: 'a', w: -3 }, theme: 'neon', steps: [{ to: 'x', caption: 5 }], stepStart: 5000, width: 'wide' })
    expect(m.view).toEqual({ x: 0, y: 0, w: 0.01 })
    expect(m.theme).toBe('dark')
    expect(m.steps).toEqual([{ to: 0, caption: '' }])
    expect(m.stepStart).toBe(1)
    expect(m.W).toBe(640)
    expect(m.captions).toBe(true)
  })

  it('frames its figure', () => {
    const p = GEO.parse('A = Point(10, 10)\nB = Point(14, 10)\nc = Circle(A, B)')
    const v = fitView(p.objs, GEO.compute(p.objs), 640, 400)
    expect(v.x).toBeCloseTo(10)
    // The circle's 8 across, and the box's height, both fit
    expect(v.w).toBeGreaterThan(8)
    expect(v.w * 400 / 640).toBeGreaterThan(8)
  })

  it('is draggable when presented, so it takes no click action', () => {
    expect(supportsClickAction({ type: 'geometry' })).toBe(false)
  })
})

describe('drawing', () => {
  it('draws every template in both colors and every label form', () => {
    for (const t of GEOMETRY_TEMPLATES) {
      for (const theme of ['dark', 'light']) {
        const e = el({ ...tpl(t.key), theme, axes: true, grid: true })
        for (const labels of ['deck', 'text', tex => `<b>${tex}</b>`]) {
          const svg = geometrySvg(e, { labels })
          expect(svg).toMatch(/^<svg /)
          expect(svg).not.toMatch(/NaN|undefined|Infinity/)
          // Nothing the editor's cleaning drops
          expect(svg).not.toMatch(/<use|<style|xlink:href/)
        }
      }
    }
  })

  it('labels a point in TeX: for the deck to fill in, or as text for PowerPoint', () => {
    const e = el({ script: 'P1 = Point(0, 0)' })
    expect(geometrySvg(e, { labels: 'deck' })).toContain('data-math-latex="P_{1}"')
    const text = geometrySvg(e, { labels: 'text', standalone: true })
    expect(text).toMatch(/<svg [^>]*width="640" height="400"/)
    expect(text).not.toContain('foreignObject')
  })

  it('says which line is wrong instead of drawing', () => {
    const svg = geometrySvg(el({ script: 'A = Point(0, 0)\nc = Circle(A, Z)' }))
    expect(svg).toContain('Line 2: Z isn’t made before this line')
    expect(geometrySteps(el({ script: 'c = Circle(A, Z)' }))).toEqual([])
  })

  it('shows a step’s objects, and its caption', () => {
    const e = el()
    const at0 = geometrySvg(e, { step: 0 }), at3 = geometrySvg(e, { step: 3 })
    expect(at0).toContain('data-name="B"')
    expect(at0).not.toContain('data-name="s"')
    expect(at3).toContain('data-name="d"')
    expect(at3).not.toContain('data-name="C"')
    expect(at3).toContain(GEO.describe(GEO.parse(e.script).objs[4]))
  })
})

describe('steps', () => {
  const objs = GEO.parse(tpl('euclid').script).objs

  it('start after the points a figure starts with, unless told otherwise', () => {
    const m = geometryModel(el())
    expect(geometryPlan(m, objs).to).toEqual([2, 3, 4, 5, 6, 7, 8])
    expect(geometryPlan({ ...m, start: 4 }, objs).to.slice(0, 2)).toEqual([4, 4])
    expect(geometryPlan({ ...m, steps: [] }, objs)).toEqual({ to: [8], captions: [''], tidyAt: null, rest: false })
  })

  it('caption themselves, or not at all', () => {
    const m = geometryModel(el())
    const plan = geometryPlan({ ...m, steps: [{ to: 3, caption: 'The base' }, { to: 6, caption: '' }] }, objs)
    expect(plan.captions.slice(0, 3)).toEqual(['', 'The base', GEO.describe(objs[5])])
    expect(geometryPlan({ ...m, captions: false }, objs).captions.every(c => c === '')).toBe(true)
  })

  it('end, if asked, with a step that hides the working', () => {
    const m = geometryModel(el({ tidy: true }))
    const plan = geometryPlan(m, objs)
    expect(plan.tidyAt).toBe(plan.to.length - 1)
    const last = geometrySvg(el({ tidy: true }), { step: plan.tidyAt })
    expect(last).not.toContain('data-name="c"')
    expect(last).toContain('data-name="C"')
    expect(geometrySvg(el({ tidy: true }), { step: plan.tidyAt - 1 })).toContain('data-name="c"')
  })

  it('never go back', () => {
    expect(geometryPlan(geometryModel(el({ steps: [{ to: 5 }, { to: 3 }] })), objs).to).toEqual([2, 5, 5, 8])
  })

  it('leave nothing out: a last step shows what they don’t reach', () => {
    const plan = geometryPlan(geometryModel(el({ steps: [{ to: 3 }, { to: 6 }] })), objs)
    expect(plan.to).toEqual([2, 3, 6, 8])
    expect(plan.rest).toBe(true)
    expect(plan.captions[3]).toBe(GEO.describe(objs[7]))
    expect(geometryPlan(geometryModel(el()), objs).rest).toBe(false)
  })

  it('are a line each, from the first object after the points', () => {
    expect(stepsPerLine(objs, null).map(s => s.to)).toEqual([3, 4, 5, 6, 7, 8])
    expect(stepsPerLine(objs, 6).map(s => s.to)).toEqual([7, 8])
  })

  it('fall on the slide’s steps from the one chosen', () => {
    const e = el({ stepStart: 3 })
    expect(geometrySteps(e).slice(0, 2)).toEqual([[3, 1], [4, 2]])
    expect(geometryStepAt(e, 2)).toBe(0)
    expect(geometryStepAt(e, 4)).toBe(2)
    expect(geometrySteps({ ...e, type: 'venn' })).toEqual([])
    expect(geometryStepMarkers({ elements: [e] })).toContain('data-fragment-index="3" data-gm-step="gm-1" data-gm-step-at="1"')
  })
})

describe('in a deck', () => {
  const thales = el({ id: 'g1', ...tpl('thales') })

  function deck(element = thales) {
    const win = new Window({ url: 'http://localhost/deck.html' })
    const gm = geometryDeckHtml(element)
    win.document.body.innerHTML = `<div class="reveal"><div class="slides"><section class="present">
      <div id="g" ${gm.attrs} style="position:absolute;width:640px;height:400px">${gm.svg}</div>${geometryStepMarkers({ elements: [element] })}</section></div></div>`
    // The pointer, in the figure's own px
    win.SVGSVGElement.prototype.getScreenCTM = function () { return { inverse() { return this } } }
    win.SVGSVGElement.prototype.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y } } })
    const handlers = {}
    const Reveal = { on: (name, fn) => { (handlers[name] = handlers[name] || []).push(fn) } }
    new Function('window', 'document', 'Reveal', geometryDeckScript())(win, win.document, Reveal)
    const root = win.document.getElementById('g')
    const F = GEO.frame({ W: 640, H: 400, view: element.view })
    const screen = p => GEO.toScreen(F, p)
    const fire = (type, p) => root.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: 1 }))
    const step = n => {
      win.document.querySelectorAll('.fragment[data-gm-step]').forEach(m => m.classList.toggle('visible', +m.getAttribute('data-gm-step-at') <= n))
      handlers.fragmentshown.forEach(fn => fn({ type: 'fragmentshown' }))
    }
    const angle = () => root.querySelector('[data-name="γ"]')?.nextElementSibling?.textContent
    return { win, root, fire, step, screen, handlers, angle }
  }

  it('goes in a deck with its settings and the engine, once', () => {
    const html = generateRevealHTML({ title: 'T', slides: [{ id: 's1', elements: [thales, { ...thales, id: 'g2' }] }] })
    expect(html).toContain('data-gm="g1" data-gm-config="{&quot;script&quot;')
    expect(html).toContain('data-gm-step="g2" data-gm-step-at="1"')
    expect(html.split('function geometryRuntime').length).toBe(2)
    expect(hasGeometry({ slides: [{ elements: [thales] }] })).toBe(true)
    expect(generateRevealHTML({ title: 'T', slides: [{ id: 's1', elements: [] }] })).not.toContain('geometryRuntime')
    // What's typed in its template literal has no backslash, which would be lost
    expect(geometryDeckScript().replace(geometryRuntime.toString(), '').replace(JSON.stringify(GEOMETRY_CSS), '')).not.toContain('\\')
  })

  it('draws each step in as the slide reaches it, and takes it away going back', () => {
    const { root, step } = deck()
    step(1)
    expect(root.querySelector('[data-name="O"]').getAttribute('class')).toBe('pxgm-new')
    expect(root.querySelector('[data-name="c"]')).toBe(null)
    step(2)
    expect(root.querySelector('[data-name="O"]').getAttribute('class')).toBe(null)
    const c = root.querySelector('[data-name="c"]')
    expect(c.getAttribute('class')).toBe('pxgm-new')
    expect(c.getAttribute('pathLength')).toBe('1')
    step(0)
    expect(root.querySelector('[data-name="c"]')).toBe(null)
  })

  it('drags a point along its circle, keeps the theorem, and is back as saved on the next visit', () => {
    const { root, fire, step, screen, handlers, angle } = deck()
    step(99)
    const p0 = GEO.parse(thales.script).objs.find(o => o.name === 'C')
    const before = GEO.compute(GEO.parse(thales.script).objs)
    expect(root.style.touchAction).toBe('none')
    expect(root.hasAttribute('data-prevent-swipe')).toBe(true)
    fire('pointerdown', screen(before.C))
    fire('pointermove', screen({ x: before.O.x - 1, y: before.O.y + 5 }))
    fire('pointerup', screen({ x: 0, y: 0 }))
    const moved = root.querySelector('[data-name="C"] circle:last-child')
    const at = screen(before.C)
    expect(Math.hypot(+moved.getAttribute('cx') - at.x, +moved.getAttribute('cy') - at.y)).toBeGreaterThan(20)
    expect(angle()).toMatch(/90/)
    // A point that isn't free stays put
    fire('pointerdown', screen(before.O))
    fire('pointermove', screen({ x: 3, y: 3 }))
    fire('pointerup', screen({ x: 3, y: 3 }))
    const O = root.querySelector('[data-name="O"] circle')
    expect(+O.getAttribute('cx')).toBeCloseTo(screen(before.O).x, 0)
    // Back, and the slide's shown as it was saved
    handlers.slidechanged.forEach(fn => fn({ type: 'slidechanged' }))
    const back = root.querySelector('[data-name="C"] circle:last-child')
    expect(+back.getAttribute('cx')).toBeCloseTo(at.x, 0)
    expect(p0.cmd).toBe('PointOn')
  })

  it('snaps a dragged point to the grid, when there is one', () => {
    const e = el({ id: 'g1', script: 'A = Point(0, 0)\nB = Point(2, 0)\ns = Segment(A, B)', view: { x: 0, y: 0, w: 12 }, steps: [], grid: true })
    const { root, fire, screen } = deck(e)
    fire('pointerdown', screen({ x: 0, y: 0 }))
    fire('pointermove', screen({ x: 1.13, y: 0.94 }))
    fire('pointerup', screen({ x: 1.13, y: 0.94 }))
    const A = root.querySelector('[data-name="A"] circle')
    expect(+A.getAttribute('cx')).toBeCloseTo(screen({ x: 1, y: 1 }).x, 1)
    expect(+A.getAttribute('cy')).toBeCloseTo(screen({ x: 1, y: 1 }).y, 1)
  })

  it('leaves the overview’s copies of slides alone', () => {
    const win = new Window({ url: 'http://localhost/deck.html' })
    const gm = geometryDeckHtml(thales)
    win.document.body.innerHTML = `<section inert><div id="g" ${gm.attrs}>${gm.svg}</div></section>`
    new Function('window', 'document', 'Reveal', geometryDeckScript())(win, win.document, { on() {} })
    expect(win.document.getElementById('g').hasAttribute('data-prevent-swipe')).toBe(false)
  })

  it('prints a page per step', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [el({ steps: [{ to: 3 }, { to: 8 }] })] }] })
      const html = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
      expect([...html.matchAll(/data-gm-at-page="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '1', '2'])
      expect(html).not.toContain('pxgm-new')
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})

describe('tkz-euclide', () => {
  it('writes each template as its construction, clipped to the view', () => {
    for (const t of GEOMETRY_TEMPLATES) {
      const tex = geometryTikz(el(tpl(t.key)))
      expect(tex).toMatch(/^% \\usepackage\{tkz-euclide\}\n\\begin\{tikzpicture\}/)
      expect(tex).toMatch(/\\tkzInit\[xmin=[-\d.]+,xmax=[-\d.]+,ymin=[-\d.]+,ymax=[-\d.]+\] \\tkzClip/)
      expect(tex).toMatch(/\\end\{tikzpicture\}$/)
      expect(tex).not.toMatch(/NaN|undefined|Infinity/)
    }
  })

  it('keeps the construction, not just where things are', () => {
    const tex = geometryTikz(el(tpl('euclid')))
    expect(tex).toContain('\\tkzDefPoint(-2,-1.5){A}')
    expect(tex).toContain('\\tkzDrawCircle[gray, thin, dashed](A,B)')
    // The first crossing of c and d, as both find it
    expect(tex).toContain('\\tkzInterCC(A,B)(B,A) \\tkzGetFirstPoint{C}')
    expect(tex).toContain('\\tkzFillPolygon[fill=yellow!40](A,B,C)')
    expect(tex).toContain('\\tkzDrawPoints(A,B,C)')
    const bis = geometryTikz(el(tpl('bisector')))
    expect(bis).toContain('\\tkzGetSecondPoint{Q}')
    expect(bis).toContain('\\tkzMarkRightAngle(')
  })

  it('leaves hidden objects undrawn, but defined', () => {
    const tex = geometryTikz(el({ script: 'A = Point(0, 0)\nB = Point(1, 0)\nc = Circle(A, B) {hidden}\nP = PointOn(c, 1)' }))
    expect(tex).not.toContain('\\tkzDrawCircle')
    expect(tex).toContain('{P} % on c')
  })

  it('says which line is wrong', () => {
    expect(geometryTikz(el({ script: 'c = Circle(A, B)' }))).toBe('% Line 1: A isn’t made before this line')
  })
})
