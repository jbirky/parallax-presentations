import { describe, it, expect } from 'vitest'
import { embedPage, htmlEmbedModel, htmlEmbedSteps, htmlEmbedStepMarkers, MAX_EMBED_STEPS } from './embedRuntime'

// The runtime as an embed's page runs it, against a window that keeps what
// it's told and what it says
function run(page) {
  const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
  const code = scripts.find(s => s.includes("'parallax-deck'"))
  const listeners = {}
  const posted = []
  const parent = { postMessage: m => posted.push(m) }
  const errors = []
  const win = {
    parent,
    console: { error: (...a) => errors.push(a) },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn) },
  }
  new Function('window', code)(win)
  const fire = (type, e) => (listeners[type] || []).forEach(fn => fn(e))
  return { win, posted, errors, fire, tell: data => fire('message', { source: parent, data: { source: 'parallax-deck', type: 'embed-state', ...data } }) }
}

describe('HTML embed steps', () => {
  it('takes whole steps up to the most, and a first slide click', () => {
    expect(htmlEmbedModel({ steps: 3, stepStart: 2 })).toEqual({ steps: 3, stepStart: 2 })
    expect(htmlEmbedModel({ steps: 2.6 })).toEqual({ steps: 3, stepStart: 1 })
    expect(htmlEmbedModel({ steps: MAX_EMBED_STEPS + 1, stepStart: 0 })).toEqual({ steps: 0, stepStart: 1 })
    expect(htmlEmbedModel({})).toEqual({ steps: 0, stepStart: 1 })
  })

  it('puts its step k at the slide click stepStart - 1 + k', () => {
    expect(htmlEmbedSteps({ type: 'html', steps: 3, stepStart: 2 })).toEqual([[2, 1], [3, 2], [4, 3]])
    expect(htmlEmbedSteps({ type: 'html' })).toEqual([])
    expect(htmlEmbedSteps({ type: 'graph', steps: 3 })).toEqual([])
  })

  it('marks each step with a hidden fragment naming the element and its own step', () => {
    const html = htmlEmbedStepMarkers({ elements: [{ id: 'e"1', type: 'html', steps: 2, stepStart: 3 }, { id: 't', type: 'text' }] })
    expect(html.match(/class="fragment"/g)).toHaveLength(2)
    expect(html).toContain('data-fragment-index="3" data-html-step="e1" data-html-step-at="1"')
    expect(html).toContain('data-fragment-index="4" data-html-step="e1" data-html-step-at="2"')
  })
})

describe('embedPage', () => {
  it('injects first thing, after <head>, <html> or the doctype, keeping the doctype first', () => {
    expect(embedPage('<p>x</p>', '<i>before</i>').startsWith('<i>before</i><script>')).toBe(true)
    const doc = embedPage('<!doctype html><html><head><title>t</title></head></html>', '<i>before</i>')
    expect(doc.startsWith('<!doctype html><html><head><i>before</i><script>')).toBe(true)
    expect(doc.endsWith('<title>t</title></head></html>')).toBe(true)
    expect(embedPage('<!DOCTYPE html><body>b</body>', '').startsWith('<!DOCTYPE html><script>')).toBe(true)
  })

  it('never ends its own script early', () => {
    const page = embedPage('<p>x</p>', '')
    const runtime = page.slice(0, page.indexOf('<p>x</p>'))
    expect(runtime.match(/<\/script/gi)).toHaveLength(1)
  })

  it('in a deck, waits at step 0 until the deck says where it is, and asks', () => {
    const { win, posted } = run(embedPage('<p>x</p>', '', { steps: 3, inDeck: true }))
    expect([win.parallax.steps, win.parallax.step, win.parallax.shown]).toEqual([3, 0, false])
    expect(posted).toContainEqual({ source: 'parallax-embed', type: 'hello' })
  })

  it('elsewhere, is shown at its last step', () => {
    const { win } = run(embedPage('<p>x</p>', '', { steps: 3 }))
    expect([win.parallax.step, win.parallax.shown]).toEqual([3, true])
    const seen = []
    win.parallax.onStep((step, from) => seen.push([step, from]))
    win.parallax.onShow(() => seen.push('show'))
    expect(seen).toEqual([[3, 3], 'show'])
  })

  it('tells its listeners what changes, in order, and only that', () => {
    const { win, tell } = run(embedPage('<p>x</p>', '', { steps: 3, inDeck: true }))
    const seen = []
    win.parallax.onStep((step, from) => seen.push(`step ${from}>${step}`))
    win.parallax.onShow(() => seen.push('show'))
    win.parallax.onHide(() => seen.push('hide'))
    tell({ shown: true, step: 0 })
    tell({ shown: true, step: 1 })
    tell({ shown: true, step: 1 })
    tell({ shown: false, step: 3 })
    tell({ shown: true, step: 9 })
    expect(seen).toEqual(['step 0>0', 'show', 'step 0>1', 'step 1>3', 'hide', 'show'])
    expect(win.parallax.step).toBe(3)
  })

  it('hears only its own parent, and stops a listener when asked', () => {
    const { win, fire, tell } = run(embedPage('<p>x</p>', '', { steps: 2, inDeck: true }))
    const seen = []
    const stop = win.parallax.onStep(step => seen.push(step))
    fire('message', { source: {}, data: { source: 'parallax-deck', type: 'embed-state', shown: true, step: 2 } })
    expect(seen).toEqual([0])
    stop()
    tell({ shown: true, step: 2 })
    expect(seen).toEqual([0])
  })

  it('keeps parallax.datasets, and freezes parallax', () => {
    const page = embedPage('<p>x</p>', '<script>window.parallax=Object.freeze({datasets:{list:1}});</script>')
    const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
    const win = { parent: { postMessage() {} }, console: {}, addEventListener() {} }
    for (const s of scripts) new Function('window', s)(win)
    expect(win.parallax.datasets).toEqual({ list: 1 })
    expect(Object.isFrozen(win.parallax)).toBe(true)
  })

  it('reports errors with the line in its own content, failed loads, rejections and console.error', () => {
    const content = '<div></div>\n<script>\nboom()\n</script>'
    const page = embedPage(content, '<script>\nvar a = 1\n</script>\n')
    const { posted, fire, win } = run(page)
    // The page's line of boom(): its own line 3, moved down by the injection
    const pageLine = page.split('\n').findIndex(l => l === 'boom()') + 1
    expect(pageLine).toBeGreaterThan(3)
    fire('error', { message: 'Uncaught ReferenceError: boom is not defined', lineno: pageLine, target: win })
    fire('error', { target: { tagName: 'SCRIPT', src: 'https://cdn.jsdelivr.net/npm/nope@1/x.js' } })
    fire('unhandledrejection', { reason: new Error('no data') })
    win.console.error('WebGL:', new Error('context lost'))
    expect(posted.filter(m => m.type === 'problem').map(m => m.message)).toEqual([
      'Uncaught ReferenceError: boom is not defined (line 3)',
      'Couldn’t load https://cdn.jsdelivr.net/npm/nope@1/x.js',
      'Unhandled promise rejection: no data',
      'WebGL: context lost',
    ])
  })

  it('names the lines of a whole document as they were, before and after the injection', () => {
    const content = '<!doctype html>\n<html>\n<head>\n</head>\n<body>\n<script>boom()</script>\n</body>\n</html>'
    const page = embedPage(content, '<script>\nvar a = 1\n</script>')
    const { posted, fire, win } = run(page)
    const pageLine = page.split('\n').findIndex(l => l === '<script>boom()</script>') + 1
    fire('error', { message: 'x', lineno: pageLine, target: win })
    fire('error', { message: 'y', lineno: 2, target: win })
    expect(posted.filter(m => m.type === 'problem').map(m => m.message)).toEqual(['x (line 6)', 'y (line 2)'])
  })

  it('says at most ten problems', () => {
    const { posted, fire, win } = run(embedPage('<p>x</p>', ''))
    for (let i = 0; i < 15; i++) fire('error', { message: `e${i}`, target: win })
    expect(posted.filter(m => m.type === 'problem')).toHaveLength(10)
  })
})
