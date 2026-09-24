import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import * as clientTikz from './tikzDiagram'
import { generateRevealHTML } from './generateHTML'
import { localizeLibraries } from './libraries'

const serverTikz = createRequire(import.meta.url)('../../../server/services/tikz-diagram.js')

const SVG = '<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10"/><text>A</text>'
  + '<foreignObject x="0" y="0" width="50" height="20"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-diagram-math"><span class="katex">x</span></div></foreignObject></svg>'

describe.each([['client', clientTikz], ['server', serverTikz]])('%s TikZ diagram SVG', (_, tikz) => {
  it('keeps the drawing, math included', () => {
    expect(tikz.sanitizeSvg(SVG)).toBe(SVG)
    expect(tikz.sanitizeSvg(`<?xml version="1.0"?>\n${SVG}\n`)).toBe(SVG)
  })

  it('removes what could run', () => {
    const bad = '<svg onload="steal()"><script>steal()</script><script src="x.js"/><iframe src="//evil"></iframe>'
      + '<a href="javascript:steal()"><path onclick=\'steal()\' d="M0 0"/></a><image xlink:href=" javascript:steal()"/></svg>'
    const clean = tikz.sanitizeSvg(bad)
    expect(clean).not.toMatch(/script|iframe|onload|onclick|javascript:/i)
    expect(clean).toContain('<path d="M0 0"/>')
  })

  it('gives nothing for something that isn’t an SVG', () => {
    expect(tikz.sanitizeSvg('<img src=x onerror=steal()>')).toBe('')
    expect(tikz.sanitizeSvg(undefined)).toBe('')
  })

  it('sizes the SVG to its element', () => {
    expect(tikz.tikzDiagramSvg({ svg: SVG })).toMatch(/^<svg style="width:100%;height:100%;display:block;overflow:visible" viewBox="0 0 100 50"/)
  })
})

describe('TikZ diagrams in presentations', () => {
  it('shows the diagram’s SVG on the slide, sanitized', () => {
    const html = generateRevealHTML({
      title: 'T', slides: [{
        id: 's', background: { type: 'color', color: '#000' },
        elements: [{ id: 't', type: 'tikz', x: 10, y: 20, width: 300, height: 150, svg: SVG.replace('<svg', '<svg onload="steal()"'), tikz: '\\begin{tikzpicture}\\end{tikzpicture}' }],
      }],
    })
    expect(html).toContain('<path d="M0 0L10 10"/>')
    expect(html).toContain('class="tikz-diagram-math"')
    expect(html).not.toContain('steal()')
  })
})

describe('the TikZ diagram editor', () => {
  const editor = fs.readFileSync(path.resolve(__dirname, '../tools/tikz-editor.html'), 'utf8')

  it('offers Parallax its API', () => {
    expect(editor).toContain('window.tikzEditorApi = {')
    expect(editor).toMatch(/load\(state, \{ dark = false \} = \{\}\)/)
    expect(editor).toContain('function buildSVG()')
  })

  it('loads KaTeX and svgcanvas from this app once opened in it', () => {
    const opened = localizeLibraries(editor, 'http://localhost:3000')
    expect(opened).not.toMatch(/https:\/\/cdn\.jsdelivr\.net/)
    expect(opened).toMatch(/http:\/\/localhost:3000\/vendor\/katex@[\d.]+\/dist\/katex\.min\.js/)
    expect(opened).toMatch(/http:\/\/localhost:3000\/vendor\/svgcanvas@[\d.]+\/dist\/svgcanvas\.esm\.js/)
  })
})
