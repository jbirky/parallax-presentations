// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { safeHtml, safeSvg } from './safeHtml'
import { shapeSvgString } from './shapeUtils'
import { periodicSvg, defaultPeriodic } from './periodicTable'
import { timingSvg, TIMING_TEMPLATES } from './timingDiagram'
import { geometrySvg, geometryFromTemplate, GEOMETRY_TEMPLATES } from './geometryDiagram'
import { texHtml } from '../components/FeynmanView'

const ATTACKS = [
  '<img src=x onerror="steal()"><img/src=x/onerror=steal()>',
  '<script>steal()</script><a href="javascript:steal()">a</a><a href=" JaVaScRiPt:steal()">b</a>',
  '<iframe src="//evil"></iframe><style>body{display:none}</style>',
  '<form action="//evil"><input name="password"><button>Sign in</button></form>',
  '<svg><a xlink:href="javascript:steal()"><text>t</text></a><animate onbegin="steal()"/></svg>',
].join('')
// What's left of ATTACKS: an image whose address happens to say "onerror"
const LEFT = '<img src="x"><img src="x/onerror=steal()"><a>a</a><a>b</a>Sign in<svg><a><text>t</text></a></svg>'

describe('HTML from a deck, shown in the editor', () => {
  it('keeps what the text editor writes as it is', () => {
    const tiptap = [
      '<h2 style="text-align: center; line-height: 1.2">Title</h2>',
      '<p><span style="color: #f87171; font-size: 28px; font-family: Georgia">red</span> <strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code></p>',
      '<p><mark data-color="#fef08a" style="background-color: #fef08a">hi</mark> <a target="_blank" rel="noopener noreferrer nofollow" href="https://x.org">link</a> <a href="#/s-abc">slide</a></p>',
      '<p><span data-math-latex="e^{i\\pi}" data-math-display="false" data-math-fontsize="">e</span></p>',
      '<ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol><blockquote><p>q</p></blockquote><pre><code>x</code></pre><hr>',
      '<table><tbody><tr><th colspan="1" rowspan="1" colwidth="120"><p>h</p></th></tr><tr><td colspan="1" rowspan="1"><p>d</p></td></tr></tbody></table>',
      '<img src="/uploads/a.png" alt="a">',
    ].join('')
    expect(safeHtml(tiptap)).toBe(tiptap)
  })

  it('drops what could run or reach outside the element', () => {
    expect(safeHtml('<p>ok</p>' + ATTACKS)).toBe('<p>ok</p>' + LEFT)
  })

  it('keeps shapes, and drops script put in their label or colors', () => {
    const shape = { type: 'shape', shape: 'star', width: 100, height: 80, fill: '#f00', text: 'Go' }
    expect(safeHtml(shapeSvgString(shape))).toContain('<text x="50" y="40"')
    const out = safeHtml(shapeSvgString({ ...shape, text: '<image href="x" onerror="steal()"/>', fill: '"/><image href="x" onerror="steal()"/><g x="' }))
    expect(out).toContain('<polygon points=')
    // The label and color are written as text, and stay text
    const page = new DOMParser().parseFromString(out, 'text/html')
    expect(page.querySelectorAll('image, [onerror]')).toHaveLength(0)
    expect(page.querySelector('text').textContent).toBe('<image href="x" onerror="steal()"/>')
  })

  it('keeps a TikZ diagram’s math, and drops what could run in it', () => {
    const svg = '<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10"></path><text>A</text>'
      + '<foreignObject x="0" y="0" width="50" height="20"><div xmlns="http://www.w3.org/1999/xhtml" class="tikz-diagram-math" style="display: flex"><span class="katex">x</span></div></foreignObject></svg>'
    expect(safeSvg(svg)).toBe(svg)
    expect(safeSvg(svg.replace('</svg>', '<style>body{display:none}</style></svg>'))).toBe(svg)
    const bad = svg.replace('<text>A</text>', '<text>A</text><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror="steal()"></div></foreignObject><image href="x" onerror="steal()"/>')
    expect(safeSvg(bad)).not.toMatch(/steal|onerror/)
    expect(safeSvg(ATTACKS)).toBe(LEFT)
    // Text boxes don't take HTML in SVG
    expect(safeHtml(svg)).not.toContain('katex')
  })

  it('keeps a periodic table whole, with what its pointing and pins use', () => {
    const svg = periodicSvg({ ...defaultPeriodic(), highlight: 'block:p', orbitalView: 'clouds' }, { mode: 'canvas' })
    const clean = safeSvg(svg)
    expect(clean.match(/data-pt-z=/g)).toHaveLength(118)
    expect(clean).toContain('data-pt-card')
    expect(clean).toContain('data-pt-sub')
    expect(clean).toContain('opacity="0.22"')
    expect(clean).toContain('pointer-events:none')
    expect(clean.length).toBeGreaterThan(svg.length * 0.95)
  })

  it('keeps a timing diagram whole: its shapes, arrowheads and text', () => {
    for (const t of TIMING_TEMPLATES) {
      const svg = timingSvg({ id: 't', source: t.source, theme: 'dark' })
      const clean = safeSvg(svg)
      const count = (s, re) => (s.match(re) || []).length
      expect(count(clean, /<path/g)).toBe(count(svg, /<path/g))
      expect(count(clean, /<text/g)).toBe(count(svg, /<text/g))
      expect(count(clean, /<marker/g)).toBe(count(svg, /<marker/g))
      expect(clean).not.toMatch(/xml:space/)
    }
  })

  it('keeps a geometry figure whole, with its KaTeX labels', () => {
    for (const t of GEOMETRY_TEMPLATES) {
      const svg = geometrySvg({ ...geometryFromTemplate(t.key), axes: true, grid: true, width: 640, height: 400 }, { labels: texHtml })
      const clean = safeSvg(svg)
      const count = (s, re) => (s.match(re) || []).length
      for (const re of [/<path/g, /<circle/g, /<text/g, /<foreignObject/g, /class="katex"/g, /data-name=/g]) expect(count(clean, re)).toBe(count(svg, re))
      expect(clean).toContain('pointer-events:none')
    }
  })

  it('returns nothing for nothing', () => {
    for (const f of [safeHtml, safeSvg]) {
      expect(f(undefined)).toBe('')
      expect(f(7)).toBe('')
    }
  })
})
