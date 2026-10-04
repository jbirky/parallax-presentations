import { describe, it, expect } from 'vitest'

// Stub browser APIs that generateHTML uses (only window.location.origin for absoluteSrc)
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { graphPageHtml, graphConfig, graphSteps, graphStepMarkers, defaultGraph, graphSnapshotContent, GRAPH_DECK_SCRIPT } from './graphPage'
import { generateRevealHTML } from './generateHTML'

const graph = (expressions, extra = {}) => ({
  id: 'g1', type: 'graph', x: 0, y: 0, width: 560, height: 400, zIndex: 2,
  ...defaultGraph(false), expressions, ...extra,
})
const deck = elements => ({ title: 'Talk', slideWidth: 960, slideHeight: 540, slides: [{ id: 's1', elements }] })

// The page's one script
function script(html) {
  const scripts = html.match(/<script>([\s\S]*?)<\/script>/g)
  expect(scripts).toHaveLength(1)
  return scripts[0].slice('<script>'.length, -'</script>'.length)
}
// The graph the page was written with
function config(html) {
  const code = script(html)
  return JSON.parse(code.slice(code.lastIndexOf('})(), ') + 5, -2))
}

describe('graph pages', () => {
  it('carry the parser and runtime as a script that parses', () => {
    const html = graphPageHtml(graph([{ id: 'a', text: 'y = x^2' }]))
    expect(() => new Function(script(html))).not.toThrow()
    expect(html).not.toContain('cdn.jsdelivr.net')
  })

  it('can’t be ended early by what an expression says', () => {
    const html = graphPageHtml(graph([{ id: 'a', text: 'y = x </script><script>alert(1)</script> <!--' }]))
    expect(() => new Function(script(html))).not.toThrow()
    expect(config(html).expressions[0].text).toBe('y = x </script><script>alert(1)</script> <!--')
  })

  it('hold the graph, with the finished graph for the editor, thumbnails and PDF', () => {
    const el = graph([{ id: 'a', text: 'y = x', step: 2 }], { view: { xMin: -1, xMax: 1, yMin: 'oops', yMax: 3 } })
    const c = graphConfig(el)
    expect(c.showAll).toBe(false)
    expect(c.view).toEqual({ xMin: -1, xMax: 1, yMin: -7, yMax: 3 }) // an edge that isn't a number is the default's
    expect(c.x).toBeUndefined() // not its place on the slide
    expect(graphConfig(el, { print: true }).showAll).toBe(true)
    expect(graphConfig(el, { editor: true }).showAll).toBe(true)
    expect(graphConfig({ ...el, view: { xMin: 2, xMax: 1, yMin: 0, yMax: 1 } }).view.xMin).toBe(-10)
  })

  it('draw a new thumbnail when the graph changes, not when it moves', () => {
    const el = graph([{ id: 'a', text: 'y = x' }])
    expect(graphSnapshotContent({ ...el, x: 99 })).toBe(graphSnapshotContent(el))
    expect(graphSnapshotContent({ ...el, theme: 'dark' })).not.toBe(graphSnapshotContent(el))
  })
})

describe('graphs in decks', () => {
  it('are presented in an iframe', () => {
    const html = generateRevealHTML(deck([graph([{ id: 'a', text: 'y = sin x' }])]))
    const srcdoc = html.match(/<iframe srcdoc="([^"]*)" data-graph-id="g1"[^>]*title="Graph"/)[1]
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    expect(config(srcdoc).expressions[0].text).toBe('y = sin x')
    expect(config(srcdoc).showAll).toBe(false)
    // No steps, so no markers; the deck's graph script is there for the keys
    expect(html).not.toMatch(/<span class="fragment"[^>]*data-graph-step/)
    expect(html).toContain("type: 'graph-step'")
    expect(generateRevealHTML(deck([]))).not.toContain("type: 'graph-step'")
  })

  it('show expressions at their steps', () => {
    const el = graph([
      { id: 'a', text: 'y = x' },
      { id: 'b', text: 'y = x^2', step: 1 },
      { id: 'c', text: 'y = x^3', step: 3 },
      { id: 'd', text: 'y = x^4', step: 3 },
      { id: 'e', text: 'y = x^5', step: 2, hidden: true },
    ])
    expect(graphSteps(el)).toEqual([1, 3])
    const markers = graphStepMarkers({ elements: [el] })
    expect(markers.match(/data-fragment-index="(\d+)" data-graph-step="g1"/g)).toHaveLength(2)
    const html = generateRevealHTML(deck([el]))
    expect(html).toContain('<span class="fragment" data-fragment-index="3" data-graph-step="g1" data-graph-step-at="3"')
  })

  it('are told how much the deck enlarges them, to draw sharp', () => {
    const html = generateRevealHTML(deck([graph([{ id: 'a', text: 'y = x' }])]))
    expect(html).toMatch(/<iframe srcdoc="[^"]*" data-graph-id="g1" data-deck-scale /)
    expect(html).toContain("type: 'scale', scale: s")
    expect(generateRevealHTML(deck([{ id: 't', type: 'text', x: 0, y: 0, width: 10, height: 10, content: 'Hi' }]))).not.toContain("type: 'scale', scale: s")
  })

  it('take no click action, since they take their own clicks', () => {
    const html = generateRevealHTML(deck([graph([{ id: 'a', text: 'y = x' }], { clickAction: { type: 'next' } })]))
    expect(html).not.toContain('data-action="next"')
  })
})

describe('graphs with fields', () => {
  it('carry the field numerics in the page’s one script', () => {
    const html = graphPageHtml(graph([{ id: 'a', text: "x' = y" }, { id: 'b', text: "y' = -sin x" }]))
    expect(script(html)).toContain('function graphFields')
    expect(() => new Function(script(html))).not.toThrow()
    expect(config(html).expressions[0].text).toBe("x' = y")
  })

  it('step in their overlays at their own steps', () => {
    const el = graph([{ id: 'a', text: "x' = y", step: 1, field: { equilibria: true, separatrices: true, steps: { equilibria: 2, separatrices: 3 } } }, { id: 'b', text: "y' = -x" }])
    expect(graphSteps(el)).toEqual([1, 2, 3])
    expect(graphSteps({ ...el, expressions: [{ ...el.expressions[0], hidden: true }] })).toEqual([])
  })
})

