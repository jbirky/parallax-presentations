import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Window } from 'happy-dom'

// Stub browser APIs that generateHTML uses (only window.location.origin for absoluteSrc)
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { generateRevealHTML } from './generateHTML'

function makePresentation(overrides = {}) {
  return {
    title: 'Test Deck',
    theme: 'black',
    transition: 'slide',
    slideWidth: 960,
    slideHeight: 540,
    slides: [
      {
        id: 's1',
        elements: [
          { id: 'e1', type: 'text', x: 80, y: 80, width: 400, height: 60, zIndex: 1, content: '<h1>Title</h1>' },
        ],
        background: { type: 'color', color: '#1e1e2e' },
      },
    ],
    ...overrides,
  }
}

describe('generateRevealHTML', () => {
  it('returns a complete HTML document', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html>')
    expect(html).toContain('</html>')
    expect(html).toContain('Reveal.initialize')
  })

  it('includes the presentation title', () => {
    const html = generateRevealHTML(makePresentation({ title: 'My Talk' }))
    expect(html).toContain('<title>My Talk</title>')
  })

  it('escapes HTML in the title', () => {
    const html = generateRevealHTML(makePresentation({ title: '<script>alert(1)</script>' }))
    expect(html).not.toContain('<title><script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('applies the selected theme', () => {
    const html = generateRevealHTML(makePresentation({ theme: 'moon' }))
    expect(html).toContain('/theme/moon.css')
  })

  it('sets the correct slide dimensions in Reveal.initialize', () => {
    const html = generateRevealHTML(makePresentation({ slideWidth: 1280, slideHeight: 720 }))
    expect(html).toContain('width: 1280')
    expect(html).toContain('height: 720')
  })

  it('renders text elements', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('<h1>Title</h1>')
  })

  it('renders image elements with absolute src', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 150, zIndex: 1, src: '/uploads/photo.png' }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('http://localhost:3000/uploads/photo.png')
  })

  it('preserves absolute image urls', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 150, zIndex: 1, src: 'https://example.com/img.png' }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('https://example.com/img.png')
  })

  it('applies the global transition', () => {
    const html = generateRevealHTML(makePresentation({ transition: 'fade' }))
    expect(html).toContain('_globalTransition = "fade"')
  })

  it('renders footer when showFooter is true', () => {
    const pres = makePresentation({
      showFooter: true,
      slides: [{ id: 's1', elements: [], section: 'Intro' }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('reveal-footer')
    expect(html).toContain('Intro')
  })

  it('renders page numbers when enabled', () => {
    const pres = makePresentation({
      showPageNumbers: true,
      pageNumberFormat: 'c/t',
      slides: [
        { id: 's1', elements: [] },
        { id: 's2', elements: [] },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('1 / 2')
  })

  it('includes speaker notes', () => {
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [], notes: 'Remember to pause here' }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('<aside class="notes">Remember to pause here</aside>')
  })

  it('applies per-slide background color', () => {
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [], background: { type: 'color', color: '#ff0000' } }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('data-background-color="#ff0000"')
  })

  it('applies per-slide background image', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1', elements: [],
        background: { type: 'image', image: 'https://example.com/bg.jpg', size: 'contain' },
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('data-background-image="https://example.com/bg.jpg"')
    expect(html).toContain('data-background-size="contain"')
  })

  it('applies auto-animate attributes', () => {
    const pres = makePresentation({
      slides: [
        { id: 's1', autoAnimate: true, elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'A' }] },
        { id: 's2', autoAnimate: true, elements: [{ id: 'e1', type: 'text', x: 200, y: 0, width: 100, height: 50, zIndex: 1, content: 'A' }] },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('data-auto-animate')
    expect(html).toContain('data-id="e1"')
  })

  it('renders fragment elements', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: 'Hi', fragment: true, fragmentAnimation: 'fade-up', fragmentIndex: 0 }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('class="fragment fade-up px-text"')
    expect(html).toContain('data-fragment-index="0"')
  })

  it('wraps multi-slide columns in nested sections for 2D navigation', () => {
    const pres = makePresentation({
      slides: [
        { id: 's1', column: 0, elements: [] },
        { id: 's2', column: 0, elements: [] },
        { id: 's3', column: 1, elements: [] },
      ],
    })
    const html = generateRevealHTML(pres)
    const outerSections = html.match(/<div class="slides">\n([\s\S]*?)\n    <\/div>/)?.[1] || ''
    const nestedSectionCount = (outerSections.match(/<section>\n\s*<section/g) || []).length
    expect(nestedSectionCount).toBeGreaterThanOrEqual(1)
  })

  it('renders grid overlay when showPresentGrid is true', () => {
    const pres = makePresentation({ showPresentGrid: true, gridSize: 40 })
    const html = generateRevealHTML(pres)
    expect(html).toContain('linear-gradient')
  })

  it('includes overview panel elements', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('id="overview-panel"')
    expect(html).toContain('id="overview-toggle"')
  })

  it('sets overview layout class to linear by default', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toContain('class="ov-body linear"')
  })

  it('sets overview layout class to sections when configured', () => {
    const html = generateRevealHTML(makePresentation({ overviewLayout: 'sections' }))
    expect(html).toContain('class="ov-body sections"')
  })

  it('embeds slide section metadata in the overview JS', () => {
    const pres = makePresentation({
      slides: [
        { id: 's1', elements: [], section: 'Intro' },
        { id: 's2', elements: [], section: 'Methods' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('"section":"Intro"')
    expect(html).toContain('"section":"Methods"')
  })

  it('includes time widget when footerTimeMode is set', () => {
    const html = generateRevealHTML(makePresentation({ footerTimeMode: 'clock12' }))
    expect(html).toContain('reveal-time-widget')
    expect(html).toContain('clock12')
  })

  it('excludes time widget when footerTimeMode is none', () => {
    const html = generateRevealHTML(makePresentation({ footerTimeMode: 'none' }))
    expect(html).not.toContain('reveal-time-widget')
  })

  it('applies custom CSS when provided', () => {
    const html = generateRevealHTML(makePresentation({ customCSS: '.my-class { color: red; }' }))
    expect(html).toContain('.my-class { color: red; }')
  })

  it('applies globalFont to text elements', () => {
    const html = generateRevealHTML(makePresentation({ globalFont: 'Inter, sans-serif' }))
    expect(html).toContain('font-family:Inter, sans-serif')
  })

  it('sets slides in Arial when no font is picked, headings too', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).toMatch(/\.reveal \.slides section \{[^}]*font-family: Arial, sans-serif;/)
    expect(html).not.toMatch(/\.reveal \.slides section \{[^}]*-apple-system/)
    // the reveal.js theme's heading font (League Gothic, …) doesn't win
    expect(html).toContain('.reveal .slides section :is(h1, h2, h3, h4, h5, h6) { font-family: inherit; }')
  })

  it('draws text paths in Arial when neither they nor the deck pick a font', () => {
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'textpath', x: 0, y: 0, width: 400, height: 200, zIndex: 1, content: 'Around', pathType: 'arc' }] }],
    })
    expect(generateRevealHTML(pres)).toContain('font-family="Arial, sans-serif"')
  })

  it('renders code elements', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'code', x: 0, y: 0, width: 400, height: 200, zIndex: 1, language: 'python', content: 'print("hello")' }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('language-python')
    expect(html).toContain('print(&quot;hello&quot;)')
  })

  it('renders shape elements', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'shape', x: 0, y: 0, width: 100, height: 80, zIndex: 1, shape: 'circle', fill: '#ff0000' }],
      }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('<svg')
    expect(html).toContain('<ellipse')
  })

  it('renders 3D text unclipped, with its shadow around the letters', () => {
    const pres = makePresentation({
      globalFont: 'Inter, sans-serif',
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text3d', x: 10, y: 20, width: 600, height: 200, zIndex: 1, content: 'Deep', depth: 4, rotateX: 10, rotateY: -20, shadowY: 6, shadowBlur: 4, shadowColor: '#000000' }],
      }],
    })
    const html = generateRevealHTML(pres)
    const box = html.match(/<div[^>]*style="position:absolute;left:10px;top:20px[^"]*"/)[0]
    expect(box).toContain('overflow:visible;')
    expect(box).not.toContain('box-shadow')
    expect(box).toContain('filter:drop-shadow(0px 6px 4px #000000);')
    expect(html).toContain('transform-style:preserve-3d;transform:rotateX(10deg) rotateY(-20deg)')
    expect(html.match(/aria-hidden="true" style="position:absolute;inset:0;/g)).toHaveLength(4)
    expect(html).toContain('font-family:Inter, sans-serif;font-size:192px;') // drawn at twice the size, scaled down
  })

  // ── Laser pointer / spotlight ──────────────────────────────────────

  it('excludes laser pointer elements when laserPointer is off', () => {
    const html = generateRevealHTML(makePresentation({ laserPointer: 'off' }))
    expect(html).toContain('id="laser-dot"')
    expect(html).toContain('id="spotlight-overlay"')
    expect(html).not.toContain('var mode = "dot"')
    expect(html).not.toContain('var mode = "spotlight"')
  })

  it('includes laser dot JS when laserPointer is dot', () => {
    const html = generateRevealHTML(makePresentation({ laserPointer: 'dot' }))
    expect(html).toContain('var mode = "dot"')
    expect(html).toContain('#laser-dot')
    expect(html).toContain("e.key === 'l'")
  })

  it('includes spotlight JS when laserPointer is spotlight', () => {
    const html = generateRevealHTML(makePresentation({ laserPointer: 'spotlight' }))
    expect(html).toContain('var mode = "spotlight"')
    expect(html).toContain('drawSpotlight')
    expect(html).toContain('destination-out')
  })

  it('includes laser pointer CSS styles', () => {
    const html = generateRevealHTML(makePresentation({ laserPointer: 'dot' }))
    expect(html).toContain('#laser-dot {')
    expect(html).toContain('#spotlight-overlay {')
  })

  // ── Bibliography / references slide ────────────────────────────────

  it('does not add references slide when bibliography is empty', () => {
    const html = generateRevealHTML(makePresentation({ bibliography: [] }))
    expect(html).not.toContain('References')
  })

  it('does not add references slide when bibliography is undefined', () => {
    const html = generateRevealHTML(makePresentation())
    expect(html).not.toContain('>References<')
  })

  it('does not add references slide when no entries are cited', () => {
    const pres = makePresentation({
      bibliography: [
        { key: 'unused', type: 'article', author: 'Nobody', title: 'Uncited', year: '2020' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).not.toContain('>References<')
  })

  it('generates a references slide for entries cited via [N] in text', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 400, height: 60, zIndex: 1, content: '<p>See <sup>[1]</sup></p>' }],
      }],
      bibliography: [
        { key: 'smith2020', type: 'article', author: 'Smith, John', title: 'A Paper', year: '2020', journal: 'Nature', volume: '42', pages: '100-110', doi: '10.1234/test' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('>References<')
    expect(html).toContain('Smith, John')
    expect(html).toContain('A Paper')
    expect(html).toContain('<em>Nature</em>')
  })

  it('generates a references slide for entries cited via image citationText', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 200, height: 150, zIndex: 1, src: 'https://example.com/img.png', citationText: 'Smith (2020)' }],
      }],
      bibliography: [
        { key: 'smith2020', type: 'article', author: 'Smith, John', title: 'A Paper', year: '2020' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('>References<')
    expect(html).toContain('A Paper')
  })

  it('generates a references slide for entries cited via key match', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 400, height: 60, zIndex: 1, content: '<p>As shown in smith2020</p>' }],
      }],
      bibliography: [
        { key: 'smith2020', type: 'article', author: 'Smith, John', title: 'Key Match Paper', year: '2020' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('>References<')
    expect(html).toContain('Key Match Paper')
  })

  it('only includes referenced entries, not all bibliography', () => {
    const pres = makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 400, height: 60, zIndex: 1, content: '<p><sup>[1]</sup></p>' }],
      }],
      bibliography: [
        { key: 'cited', type: 'article', author: 'Cited, A', title: 'Cited Paper', year: '2020' },
        { key: 'uncited', type: 'article', author: 'Uncited, B', title: 'Uncited Paper', year: '2021' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('Cited Paper')
    expect(html).not.toContain('Uncited Paper')
  })

  it('uses 2-column layout for more than 8 referenced entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      key: `e${i}`, type: 'article', author: `Author${i}`, title: `Title ${i}`, year: '2020',
    }))
    const content = entries.map((_, i) => `[${i + 1}]`).join(' ')
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 400, height: 60, zIndex: 1, content: content }] }],
      bibliography: entries,
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('columns:2')
  })

  it('uses 1-column layout for 8 or fewer referenced entries', () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      key: `e${i}`, type: 'article', author: `Author${i}`, title: `Title ${i}`, year: '2020',
    }))
    const content = entries.map((_, i) => `[${i + 1}]`).join(' ')
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 400, height: 60, zIndex: 1, content: content }] }],
      bibliography: entries,
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('columns:1')
  })

  it('uses explicit width and height on references slide container', () => {
    const pres = makePresentation({
      slideWidth: 960, slideHeight: 540,
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '[1]' }] }],
      bibliography: [{ key: 'a', type: 'article', title: 'Test' }],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('width:880px')
    expect(html).toContain('height:480px')
  })

  it('escapes HTML in bibliography entry titles', () => {
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '[1]' }] }],
      bibliography: [
        { key: 'xss', type: 'article', title: '<script>alert(1)</script>', year: '2020' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('generates DOI link in references', () => {
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '[1]' }] }],
      bibliography: [
        { key: 'doi', type: 'article', title: 'Paper', doi: '10.1038/s41586-023-06330-w' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('href="https://doi.org/10.1038/s41586-023-06330-w"')
    expect(html).toContain('>DOI<')
  })

  it('handles entries with booktitle instead of journal', () => {
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '[1]' }] }],
      bibliography: [
        { key: 'conf', type: 'inproceedings', title: 'A Talk', booktitle: 'ICML 2023' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('<em>ICML 2023</em>')
  })

  it('handles entries with missing optional fields', () => {
    const pres = makePresentation({
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '[1]' }] }],
      bibliography: [
        { key: 'minimal', type: 'misc', title: 'Just a Title' },
      ],
    })
    const html = generateRevealHTML(pres)
    expect(html).toContain('Just a Title')
    expect(html).toContain('[1]')
  })
})

describe('generateRevealHTML — HTML embeds', () => {
  const JSX_EMBED = `<!DOCTYPE html>
<html>
<head>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jsxgraph/1.11.1/jsxgraphcore.js"></script>
</head>
<body>
<div id="box" class="jxgbox" style="width:600px;height:400px"></div>
<script>
const B = JXG.JSXGraph.initBoard('box', { boundingbox: [-5, 5, 5, -5], axis: true });
const a = B.create('slider', [[-4, 4], [0, 4], [0, 1, 3]]);
B.create('functiongraph', [x => a.Value() * Math.sin(x) & 1]);
</script>
</body>
</html>`

  function embedPresentation(content) {
    return makePresentation({
      slides: [{
        id: 's1',
        elements: [{ id: 'e1', type: 'html', x: 0, y: 0, width: 600, height: 400, zIndex: 1, content }],
      }],
    })
  }

  // Embeds must render through srcdoc, like the editor canvas does. A data: URL
  // gives the embed an opaque origin and a data: base URL, which breaks scripts
  // that JSXGraph-style embeds rely on.
  it('renders html embeds via srcdoc, not a data: URL', () => {
    const html = generateRevealHTML(embedPresentation(JSX_EMBED))
    expect(html).toContain('<iframe srcdoc="')
    expect(html).not.toContain('data:text/html;charset=utf-8,%3C')
  })

  it('escapes ampersands and quotes so the srcdoc attribute stays intact', () => {
    const html = generateRevealHTML(embedPresentation(JSX_EMBED))
    const srcdoc = html.match(/<iframe srcdoc="([\s\S]*?)" style=/)[1]
    expect(srcdoc).not.toMatch(/(^|[^&])"/)
    expect(srcdoc).toContain('&quot;https://cdnjs.cloudflare.com')
    expect(srcdoc).toContain('&amp; 1')
  })

  it('injects the sizing script into the embed head', () => {
    const html = generateRevealHTML(embedPresentation(JSX_EMBED))
    expect(html).toContain('const EMBED_WIDTH=600,EMBED_HEIGHT=400')
  })

  it('never writes a zero-area viewBox onto an unsized svg', () => {
    const html = generateRevealHTML(embedPresentation(JSX_EMBED))
    const srcdoc = html.match(/<iframe srcdoc="([\s\S]*?)" style=/)[1]
    expect(srcdoc).toContain('if(!(w>0&amp;&amp;h>0))return;')
  })
})

describe('generateRevealHTML — Markdown, TikZ and LaTeX tables', () => {
  // Each draws in a frame of its own; parsed as a browser parses the srcdoc,
  // that page's scripts must close, or the first swallows the rest of it
  const framePage = el => {
    const html = generateRevealHTML(makePresentation({ slides: [{ id: 's1', elements: [{ id: 'e1', x: 0, y: 0, width: 400, height: 300, zIndex: 1, ...el }] }] }))
    const attr = html.match(/<iframe srcdoc="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    return new (new Window().DOMParser)().parseFromString(attr, 'text/html')
  }

  it('closes the scripts of each one’s page', () => {
    const tikz = framePage({ type: 'latex', content: '\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}' })
    expect(tikz.querySelector('script[type="text/tikz"]').textContent).toContain('\\draw (0,0)')
    const table = framePage({ type: 'latex', content: '\\begin{tabular}{cc} a & b \\end{tabular}' })
    expect(table.querySelector('#out')).toBeTruthy()
    expect([...table.querySelectorAll('script')].pop().textContent).toContain('new HtmlGenerator')
    const md = framePage({ type: 'markdown', content: '# Hi' })
    expect(md.querySelector('#out')).toBeTruthy()
    expect([...md.querySelectorAll('script')].pop().textContent).toContain('marked.parse')
  })

  it('never scrolls a page it\'s embedded in: the overview scrolls its own panel', () => {
    const html = generateRevealHTML(makePresentation({ slides: [{ id: 's1', elements: [] }, { id: 's2', elements: [] }] }))
    expect(html).toContain("id=\"ov-body\"")
    expect(html).not.toContain('scrollIntoView(')
  })

  it('prints a reference\'s page range with an en dash, as stored before -- was read too', () => {
    const html = generateRevealHTML(makePresentation({
      bibliography: [{ type: 'article', key: 'z33', author: 'Zwicky, F.', title: 'Rotverschiebung', journal: 'Helv. Phys. Acta', year: '1933', volume: '6', pages: '110--127' }],
      slides: [{ id: 's1', elements: [{ id: 'e1', x: 0, y: 0, width: 400, height: 100, zIndex: 1, type: 'text', content: '<p>Coma <sup data-cite="z33">[1]</sup></p>' }] }],
    }))
    expect(html).toContain('6, 110–127.')
    expect(html).not.toContain('110--127')
  })

  it('draws TikZ in the slide\'s ink, or its own text color, since TikZJax draws in black', () => {
    const tikzIn = (slide, el = {}, theme) => {
      const html = generateRevealHTML(makePresentation({ ...(theme ? { theme } : {}), slides: [{ id: 's1', ...slide, elements: [{ id: 'e1', x: 0, y: 0, width: 400, height: 300, zIndex: 1, type: 'latex', content: '\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}', ...el }] }] }))
      const attr = html.match(/<iframe srcdoc="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      return new (new Window().DOMParser)().parseFromString(attr, 'text/html').querySelector('script[type="text/tikz"]').textContent
    }
    expect(tikzIn({}, {}, 'black')).toBe('\\definecolor{parallaxink}{HTML}{FFFFFF}\\color{parallaxink}\n\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}')
    expect(tikzIn({}, {}, 'white')).toMatch(/^\\definecolor\{parallaxink\}\{HTML\}\{222222\}/)
    expect(tikzIn({ background: { type: 'color', color: '#1e1e2e' } }, {}, 'white')).toMatch(/\{HTML\}\{FFFFFF\}/)
    expect(tikzIn({}, { textColor: 'rgb(255, 136, 0)' }, 'white')).toMatch(/\{HTML\}\{FF8800\}/)
  })
})

describe('what a deck writes into its page', () => {
  const box = { x: 0, y: 0, width: 100, height: 50, zIndex: 1 }

  it('loads the deck’s custom fonts', () => {
    const html = generateRevealHTML(makePresentation(), { customFonts: [
      { familyName: 'Lato', source: 'google', url: 'https://fonts.googleapis.com/css2?family=Lato&display=swap' },
      { familyName: "My 'Font'", source: 'upload', url: '/api/fonts/file/a.woff2' },
      { familyName: 'Bad', source: 'upload', url: 'javascript:alert(1)' },
    ] })
    expect(html).toContain('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato&amp;display=swap">')
    expect(html).toContain("@font-face { font-family: 'My Font'; src: url('http://localhost:3000/api/fonts/file/a.woff2'); }")
    expect(html).not.toContain('javascript:alert')
  })

  it('keeps colors like rgba(…) whole', () => {
    const html = generateRevealHTML(makePresentation({
      footerColor: 'rgba(1,2,3,0.5)', showPageNumbers: true,
      slides: [{ id: 's1', elements: [{ id: 'e', type: 'shape', shapeType: 'rect', ...box, shadowBlur: 4, shadowColor: 'hsl(10 20% 30%)' }] }],
    }))
    expect(html).toContain('.reveal-footer { color: rgba(1,2,3,0.5) !important; }')
    expect(html).toContain('0px 0px 4px hsl(10 20% 30%);')
  })

  it('lets no value end its attribute or rule', () => {
    const html = generateRevealHTML(makePresentation({
      footerColor: 'red;}</style><script>x()</script>',
      theme: 'black.css"><script>x()</script>',
      transition: "slide';x();'",
      slides: [{
        id: 's1', transition: 'fade" onclick="x()',
        background: { type: 'image', image: 'javascript:x()' },
        elements: [
          { id: 'i', type: 'image', ...box, src: '/a.png" onerror="x()', alt: '"><b>' },
          { id: 'j', type: 'image', ...box, src: 'data:text/html,<script>x()</script>' },
          { id: 'k', type: 'image', ...box, src: 'data:image/png;base64,AAAA' },
          { id: 'f', type: 'text', ...box, content: 'x', fragment: true, fragmentAnimation: 'fade-in" onclick="x()' },
        ],
      }],
    }))
    expect(html).not.toMatch(/<script>x\(\)<\/script>/)
    expect(html).not.toMatch(/" on(error|click)="x\(\)/)
    expect(html).not.toContain('javascript:x()')
    expect(html).not.toContain('data:text/html,')
    expect(html).toContain('src="data:image/png;base64,AAAA"')
    expect(html).toContain('dist/theme/black.css')
    expect(html).toContain(`var _globalTransition = "slide';x();'";`)
  })

  it('links the reveal.js theme Bauhaus is drawn on, and writes in its stylesheet', () => {
    const html = generateRevealHTML(makePresentation({ theme: 'bauhaus', customCSS: '.mine { color: red }' }))
    expect(html).toContain('dist/theme/white.css')
    expect(html).not.toContain('dist/theme/bauhaus.css')
    expect(html).toContain('<div class="reveal deck-theme-bauhaus">')
    expect(html).toContain(':root { --r-background-color: #f7f6f2; }')
    const sheet = html.indexOf('.deck-theme-bauhaus :is(h1, h2, h3, h4, h5, h6)')
    expect(sheet).toBeGreaterThan(html.indexOf('.reveal h1 { font-size'))
    expect(sheet).toBeLessThan(html.indexOf('.mine { color: red }'))
    expect(html).toContain('family=Jost')
  })

  it('draws Mission on reveal’s white, with its grid on slides that show its page', () => {
    const html = generateRevealHTML(makePresentation({ theme: 'mission' }))
    expect(html).toContain('dist/theme/white.css')
    expect(html).toContain('<div class="reveal deck-theme-mission">')
    expect(html).toContain('.deck-theme-mission .slides > section:not([data-background-color])')
    expect(html).toContain("font-family: 'Barlow Condensed', sans-serif; font-weight: 600;")
    expect(html).toContain('family=B612+Mono')
  })

  it('draws Turin and Gutter on reveal’s white, with their bands on the slides', () => {
    const turin = generateRevealHTML(makePresentation({ theme: 'turin' }))
    expect(turin).toContain('dist/theme/white.css')
    expect(turin).toContain('<div class="reveal deck-theme-turin">')
    expect(turin).toContain('.deck-theme-turin .px-slide::after')
    expect(turin).toMatch(/class="px-slide"/)
    const gutter = generateRevealHTML(makePresentation({ theme: 'gutter' }))
    expect(gutter).toContain('<div class="reveal deck-theme-gutter">')
    expect(gutter).toContain('.deck-theme-gutter .px-slide::before')
    expect(gutter).toContain('@keyframes gutter-caret')
    expect(gutter).toContain('family=JetBrains+Mono')
  })

  it('sets text in the theme’s body size until the deck has its own, as the editor does', () => {
    expect(generateRevealHTML(makePresentation({ theme: 'turin' }))).toContain("font-family:'Computer Modern Sans', sans-serif;font-size:28px;")
    expect(generateRevealHTML(makePresentation({ theme: 'turin', textStyles: { bodySize: 40 } }))).toContain('font-size:40px;')
    expect(generateRevealHTML(makePresentation({ theme: 'pixel' }))).toContain('font-size:32px;')
    // a theme without text styles leaves text boxes at the slide's size
    expect(generateRevealHTML(makePresentation({ theme: 'black' }))).toContain('padding:8px 12px; color:#ffffff;line-height:1.5;')
  })

  it('keeps a quote’s paragraphs blocks, as the editor has them, over reveal.js’s inline ones', () => {
    expect(generateRevealHTML(makePresentation())).toContain('.reveal blockquote p:first-child, .reveal blockquote p:last-child { display: block; }')
  })

  it('sets Pixel’s headings in its heading font, on reveal’s black', () => {
    const html = generateRevealHTML(makePresentation({ theme: 'pixel' }))
    expect(html).toContain('dist/theme/black.css')
    expect(html).toContain(':root { --r-background-color: #14112e; }')
    expect(html).toContain('.reveal .slides section h2 { font-size: 1.125em; }')
    expect(html).toContain("font-family: 'Press Start 2P', monospace; font-weight: 400;")
    expect(html).toContain("font-family:'Pixelify Sans', sans-serif;")
    expect(html).toContain('family=Press+Start+2P')
    const own = generateRevealHTML(makePresentation({ theme: 'pixel', textStyles: { headingFont: 'Georgia, serif' } }))
    expect(own).toContain('font-family: Georgia, serif; font-weight: 400;')
  })

  it('lets embeds and videos fill their boxes, past reveal’s 95% cap', () => {
    expect(generateRevealHTML(makePresentation())).toContain('.reveal iframe, .reveal video { max-width: none !important; max-height: none !important; }')
  })

  it('sets text in the theme’s font until the deck has one of its own', () => {
    expect(generateRevealHTML(makePresentation({ theme: 'bauhaus' }))).toContain('font-family:Jost, sans-serif;')
    const own = generateRevealHTML(makePresentation({ theme: 'bauhaus', globalFont: 'Georgia, serif' }))
    expect(own).toContain('font-family:Georgia, serif;')
    expect(own).not.toContain('font-family:Jost, sans-serif;')
    const plain = generateRevealHTML(makePresentation())
    expect(plain).toContain('<div class="reveal deck-theme-black">')
    expect(plain).not.toContain('.deck-theme-bauhaus')
    expect(plain).not.toContain('--r-background-color: #')
  })

  it('keeps a deck’s own CSS inside its <style>, @import and all', () => {
    const html = generateRevealHTML(makePresentation({ customCSS: "@import url('https://fonts.example/x.css');\n.a{color:red}</style><script>x()</script>" }))
    expect(html).toContain("@import url('https://fonts.example/x.css');")
    expect(html).not.toContain('</style><script>')
  })

  it('grows auto-sized text with what it holds', () => {
    const html = generateRevealHTML(makePresentation({ slides: [{ id: 's1', elements: [{ id: 't', type: 'text', ...box, sizeMode: 'auto', content: '<p>Grows</p>' }] }] }))
    expect(html).toMatch(/style="position:absolute;left:0px;top:0px;width:100px;height:auto;z-index:1;overflow:visible;[^"]*"><p>Grows<\/p>/)
  })

  it('runs the differential rotation transition without GSAP, which decks don’t load', () => {
    const html = generateRevealHTML(makePresentation({ transition: 'differential-rotation' }))
    expect(html).not.toContain('gsap.')
    expect(html).toContain("band.animate([{ transform: 'translateX(0)' }")
  })
})
