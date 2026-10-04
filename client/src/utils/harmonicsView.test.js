import { describe, it, expect, vi } from 'vitest'
import { Window } from 'happy-dom'

// generateHTML reads window.location.origin
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }
import {
  HV, HARMONICS_FIELDS, HARMONICS_TEMPLATES, defaultHarmonics, applyHarmonicsTemplate, harmonicsSteps, harmonicsStepAt,
  harmonicsStepMarkers, hasHarmonics, harmonicsDeckAttrs, harmonicsDeckScript, harmonicsPrintScript, harmonicsPng,
} from './harmonicsView'
import { generateRevealHTML, exportPDF } from './generateHTML'
import { supportsClickAction } from './clickActions'

const el = {
  id: 'sh-1', type: 'harmonics', x: 100, y: 80, width: 600, height: 400, ...defaultHarmonics(true), stepStart: 2,
  steps: [{ l: 2, m: 2, caption: 'Now m = 2' }, { view: 'sphere', caption: 'On the sphere' }],
}

describe('the element’s fields', () => {
  it('starts as complex Y₂¹, lobes colored by phase, in the slide’s colors', () => {
    expect(defaultHarmonics(true)).toMatchObject({ source: 'single', l: 2, m: 1, form: 'complex', part: 'auto', view: 'lobes', theme: 'dark', cs: true, norm: 'orthonormal', steps: [] })
    expect(defaultHarmonics(false).theme).toBe('light')
    expect(Object.keys(defaultHarmonics())).toEqual(HARMONICS_FIELDS)
    // Not names other elements already own
    expect(HARMONICS_FIELDS).not.toContain('rotation')
    expect(HARMONICS_FIELDS).not.toContain('scale')
  })

  it('keeps values in range and drops what it doesn’t know', () => {
    const s = HV.normalize({ l: 3, m: 7, view: 'hologram', part: 're', cap: { lmax: 500, theta: -4 }, sky: { slope: 'x' }, tilt: 120, label: 'loud', norm: 'metric' })
    expect(s).toMatchObject({ l: 3, m: 3, view: 'lobes', part: 're', tilt: 89, label: 'name', norm: 'orthonormal' })
    expect(s.cap).toMatchObject({ lmax: 60, theta: 0, radius: 25 })
    expect(s.sky.slope).toBe(2)
    expect(HV.normalize({ steps: Array.from({ length: 80 }, () => ({})) }).steps).toHaveLength(60)
  })

  it('fills a step from the picture before it, and keeps conventions the element’s', () => {
    const s = HV.normalize({ ...el, norm: 'schmidt' })
    expect(s.steps[0]).toMatchObject({ l: 2, m: 2, view: 'lobes', caption: 'Now m = 2' })
    expect(s.steps[1]).toMatchObject({ l: 2, m: 2, view: 'sphere' })
    expect(HV.stepState(s, 0)).toMatchObject({ l: 2, m: 1, view: 'lobes', caption: '', norm: 'schmidt' })
    expect(HV.stepState(s, 2)).toMatchObject({ m: 2, view: 'sphere', caption: 'On the sphere', norm: 'schmidt' })
    expect(HV.stepState(s, 9).view).toBe('sphere')
  })

  it('labels each picture in TeX', () => {
    const at = (o, n = 0) => HV.labelTex(HV.stepState(HV.normalize(o), n))
    expect(at(el)).toBe('Y_{2}^{1}')
    expect(at(el, 1)).toBe('Y_{2}^{2}')
    expect(at({ form: 'real', l: 2, m: -2, part: 're' })).toBe('\\operatorname{Re}\\,d_{xy}')
    expect(at({ source: 'sum', expr: 'p_x + p_y', part: 'abs2' })).toBe('|p_y +p_x|^2')
    expect(at({ label: 'formula', l: 1, m: 0 })).toBe('Y_{1}^{0} = \\frac{1}{2}\\,\\sqrt{\\frac{3}{\\pi}}\\,\\cos\\theta')
    expect(at({ label: 'none' })).toBe('')
    expect(at({ view: 'table', form: 'real' })).toBe('Y_{\\ell,m}')
  })

  it('has starting points that all draw', () => {
    for (const t of HARMONICS_TEMPLATES) {
      const fields = applyHarmonicsTemplate({ theme: 'light', norm: 'schmidt' }, t)
      expect(fields).toMatchObject({ theme: 'light', norm: 'schmidt' })
      const s = HV.normalize(fields)
      for (let n = 0; n <= s.steps.length; n++) expect(HV.picture(HV.stepState(s, n)).error).toBeUndefined()
    }
  })

  it('takes no click action, as dragging turns it', () => {
    expect(supportsClickAction(el)).toBe(false)
  })
})

describe('steps', () => {
  it('count from the slide step they start at', () => {
    expect(harmonicsSteps(el)).toEqual([[2, 1], [3, 2]])
    expect([0, 1, 2, 3, 9].map(n => harmonicsStepAt(el, n))).toEqual([0, 0, 1, 2, 2])
    expect(harmonicsSteps({ ...el, type: 'periodic' })).toEqual([])
    const markers = harmonicsStepMarkers({ elements: [el] })
    expect(markers).toContain('data-fragment-index="2" data-sh-step="sh-1" data-sh-step-at="1"')
    expect(markers).toContain('data-fragment-index="3" data-sh-step="sh-1" data-sh-step-at="2"')
  })
})

describe('in a deck', () => {
  it('goes in with its settings and the runtime, once', () => {
    const html = generateRevealHTML({ title: 'T', slides: [{ id: 's1', elements: [el, { ...el, id: 'sh-2' }] }] })
    expect(html).toContain('data-sh="sh-1" data-sh-config="{&quot;source&quot;:&quot;single&quot;')
    expect(html).toContain('data-sh-step="sh-2" data-sh-step-at="2"')
    expect(html.split('function harmonicsRuntime').length).toBe(2)
    expect(hasHarmonics({ slides: [{ elements: [el] }] })).toBe(true)
    expect(generateRevealHTML({ title: 'T', slides: [{ id: 's1', elements: [] }] })).not.toContain('harmonicsRuntime')
    // A sum's text can't end the deck's script or attribute early
    const sneaky = { ...el, source: 'sum', expr: '</script><b x="1">' }
    expect(harmonicsDeckAttrs(sneaky)).not.toMatch(/<\/script>|"1"/)
  })

  function deck(element = el, { inert = false } = {}) {
    const win = new Window({ url: 'http://localhost/deck.html' })
    win.document.body.innerHTML = `<div class="reveal"><div class="slides"><section class="present"${inert ? ' inert' : ''}>
      <div id="h" ${harmonicsDeckAttrs(element)} style="position:absolute;width:600px;height:400px"></div>${harmonicsStepMarkers({ elements: [element] })}</section></div></div>`
    const handlers = {}
    const Reveal = { on: (name, fn) => { (handlers[name] = handlers[name] || []).push(fn) } }
    win.requestAnimationFrame = () => 0
    win.cancelAnimationFrame = () => {}
    new Function('window', 'document', 'Reveal', harmonicsDeckScript())(win, win.document, Reveal)
    const root = win.document.getElementById('h')
    const step = n => {
      win.document.querySelectorAll('.fragment[data-sh-step]').forEach(m => m.classList.toggle('visible', +m.getAttribute('data-sh-step-at') <= n))
      handlers.fragmentshown.forEach(fn => fn({ type: 'fragmentshown' }))
    }
    return { win, root, step, handlers }
  }

  it('draws into its box and follows the slide’s steps', () => {
    const { root, step } = deck()
    const [canvas, label, caption] = root.children
    expect(canvas.tagName).toBe('CANVAS')
    // No KaTeX here: the label falls back to plain text
    expect(label.textContent).toBe('Y21')
    expect(caption.textContent).toBe('')
    step(1)
    expect(label.textContent).toBe('Y22')
    expect(caption.textContent).toBe('Now m = 2')
    step(2)
    expect(caption.textContent).toBe('On the sphere')
    step(0)
    expect(caption.textContent).toBe('')
  })

  it('turns when dragged, without the deck seeing the drag, and turns back on another slide', () => {
    const { win, root, handlers } = deck()
    const canvas = root.querySelector('canvas')
    let seen = 0
    win.document.addEventListener('mousedown', () => { seen++ })
    canvas.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 100, clientY: 100, button: 0 }))
    canvas.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    canvas.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, clientX: 140, clientY: 120 }))
    canvas.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, clientX: 140, clientY: 120 }))
    expect(seen).toBe(0)
    handlers.slidechanged.forEach(fn => fn({ type: 'slidechanged' }))
  })

  it('leaves the overview’s copies of slides still', () => {
    const { root, handlers } = deck(el, { inert: true })
    expect(root.querySelector('canvas')).toBe(null)
    vi.useFakeTimers()
    try {
      handlers.ready.forEach(fn => fn({ type: 'ready' }))
      vi.runAllTimers()
    } finally { vi.useRealTimers() }
    expect(root.querySelector('canvas')).not.toBe(null)
  })
})

describe('on the canvas', () => {
  it('reports the angle it was dragged to', () => {
    const win = new Window({ url: 'http://localhost/editor' })
    const root = win.document.createElement('div')
    win.document.body.appendChild(root)
    const turns = []
    const doc = globalThis.document
    globalThis.document = win.document
    try {
      const api = HV.attach(root, el, { mode: 'canvas', onTurn: v => turns.push(v) })
      const canvas = root.querySelector('canvas')
      let moved = 0
      root.addEventListener('mousedown', () => { moved++ })
      canvas.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 0, clientY: 0, button: 0 }))
      canvas.dispatchEvent(new win.MouseEvent('mousedown', { bubbles: true }))
      canvas.dispatchEvent(new win.PointerEvent('pointermove', { bubbles: true, clientX: -100, clientY: 20 }))
      canvas.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, clientX: -100, clientY: 20 }))
      expect(moved).toBe(0)
      expect(turns).toEqual([{ turn: 97, tilt: 27 }])
      api.update({ ...el, l: 3, m: -3 }, 1, true)
      expect(api.state().step).toBe(1)
      api.destroy()
    } finally { globalThis.document = doc }
  })
})

describe('printing and export', () => {
  it('prints a page per step, drawn still', async () => {
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation(b => { blob = b; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    globalThis.window.open = vi.fn()
    vi.useFakeTimers()
    try {
      exportPDF({ id: 'p', title: 'T', slides: [{ id: 's1', elements: [el] }] })
      const html = JSON.parse((await blob.text()).match(/frame\.srcdoc = (".*");/)[1])
      expect([...html.matchAll(/data-sh-at="([^"]+)"/g)].map(m => m[1])).toEqual(['0', '1', '2'])
      expect(html).toContain('function harmonicsRuntime')
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })

  it('has a print script that parses, and gives PowerPoint nothing without WebGL', () => {
    expect(() => new Function('window', 'document', harmonicsPrintScript())).not.toThrow()
    expect(harmonicsPng(el)).toBe(null)
  })
})
