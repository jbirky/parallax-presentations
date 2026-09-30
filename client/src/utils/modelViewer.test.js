import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

// Stub browser APIs that generateHTML uses (only window.location.origin for absoluteSrc)
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { modelViewerHtml, isModelFile, modelSnapshotContent } from './modelViewer'
import { generateRevealHTML } from './generateHTML'
import { localizeLibraries } from './libraries'

const require = createRequire(import.meta.url)
const { packages } = require('../../../server/vendor-libraries.js')

const model = { id: 'm1', type: 'model', x: 0, y: 0, width: 480, height: 360, zIndex: 2, src: '/uploads/p1/part.stl' }
const deck = elements => ({ title: 'Talk', slideWidth: 960, slideHeight: 540, slides: [{ id: 's1', elements }] })

// The options the page was written with
function options(html) {
  return JSON.parse(html.match(/const O = (.*);/)[1])
}

// Its module script, less the imports, as a function body: throws when the
// page wouldn't parse
function compileScript(html) {
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
  return new Function(script.replace(/^import .*$/gm, ''))
}

describe('3D model viewer', () => {
  it('reads STL and GLB files', () => {
    expect(isModelFile('bracket.STL')).toBe(true)
    expect(isModelFile('assembly.glb')).toBe(true)
    expect(isModelFile('assembly.gltf')).toBe(false)
    expect(isModelFile('part.step')).toBe(false)
    expect(isModelFile('')).toBe(false)
  })

  it('writes a page whose script parses', () => {
    expect(() => compileScript(modelViewerHtml(model))).not.toThrow()
    expect(() => compileScript(modelViewerHtml({ ...model, edges: true, autoRotate: true, upAxis: 'y' }))).not.toThrow()
  })

  it('writes the element’s settings into the page, with defaults', () => {
    expect(options(modelViewerHtml(model))).toEqual({
      src: '/uploads/p1/part.stl', color: '#b8c2cc', background: 'transparent', view: 'iso',
      up: 'auto', autoRotate: false, edges: false, snapshotKey: null, print: false,
    })
    const o = options(modelViewerHtml({ ...model, color: '#ff0000', background: '#000000', view: 'top', upAxis: 'y', edges: true },
      { src: 'http://localhost:3000/uploads/p1/part.stl', snapshotKey: 'm1:abc' }))
    expect(o).toMatchObject({ src: 'http://localhost:3000/uploads/p1/part.stl', color: '#ff0000', background: '#000000', view: 'top', up: 'y', edges: true, snapshotKey: 'm1:abc' })
    expect(options(modelViewerHtml({ ...model, upAxis: 'sideways' })).up).toBe('auto')
  })

  it('keeps a file name from ending its script', () => {
    const html = modelViewerHtml({ ...model, src: '/uploads/p1/</script><script>alert(1)</script>.stl' })
    expect(html).not.toContain('</script><script>alert(1)')
    expect(options(html).src).toBe('/uploads/p1/</script><script>alert(1)</script>.stl')
  })

  it('loads only library files there are bundled copies of', () => {
    const html = localizeLibraries(modelViewerHtml(model), 'http://localhost:3000')
    expect(html).not.toContain('cdn.jsdelivr.net')
    // GLTFLoader imports this relative to itself, so it must sit beside it
    expect(packages.three.files).toContain('examples/jsm/utils/BufferGeometryUtils.js')
  })

  it('draws a new thumbnail after a setting changes', () => {
    expect(modelSnapshotContent(model)).not.toBe(modelSnapshotContent({ ...model, color: '#000000' }))
    expect(modelSnapshotContent(model)).toBe(modelSnapshotContent({ ...model, x: 50 }))
  })

  it('is presented in an iframe that loads the upload from this site', () => {
    const html = generateRevealHTML(deck([model]))
    const srcdoc = html.match(/<iframe srcdoc="([^"]*)"[^>]*title="3D model"/)[1]
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    expect(options(srcdoc).src).toBe('http://localhost:3000/uploads/p1/part.stl')
    // No thumbnail messages from presented decks
    expect(options(srcdoc).snapshotKey).toBe(null)
    // Told the deck's scale, to draw sharp when it's enlarged
    expect(html).toMatch(/<iframe srcdoc="[^"]*" data-deck-scale [^>]*title="3D model"/)
    expect(html).toContain("type: 'scale', scale: s")
  })

  it('takes no click action, since it takes its own clicks', () => {
    const html = generateRevealHTML(deck([{ ...model, clickAction: { type: 'next' } }]))
    expect(html).not.toContain('data-action="next"')
    expect(generateRevealHTML(deck([{ ...model, type: 'image', clickAction: { type: 'next' } }]))).toContain('data-action="next"')
  })
})
