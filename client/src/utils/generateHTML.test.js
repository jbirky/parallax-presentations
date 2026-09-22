import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub browser APIs that generateHTML uses (only window.location.origin for absoluteSrc)
if (!globalThis.window) globalThis.window = {}
if (!globalThis.window.location) globalThis.window.location = { origin: 'http://localhost:3000' }

import { Window } from 'happy-dom'
import { generateRevealHTML, generatePrintHTML, buildReferencesSlide, REFERENCES_SLIDE_ID } from './generateHTML'

function parseHTML(html) {
  const doc = new Window().document
  doc.write(html)
  return doc
}

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
    expect(html).toContain("'fade'")
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
    expect(html).toContain('class="fragment fade-up"')
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

  // ── Laser pointer / spotlight ──────────────────────────────────────

  it('excludes laser pointer elements when laserPointer is off', () => {
    const html = generateRevealHTML(makePresentation({ laserPointer: 'off' }))
    expect(html).toContain('id="laser-dot"')
    expect(html).toContain('id="spotlight-overlay"')
    expect(html).not.toContain("var mode = 'dot'")
    expect(html).not.toContain("var mode = 'spotlight'")
  })

  it('includes laser dot JS when laserPointer is dot', () => {
    const html = generateRevealHTML(makePresentation({ laserPointer: 'dot' }))
    expect(html).toContain("var mode = 'dot'")
    expect(html).toContain('#laser-dot')
    expect(html).toContain("e.key === 'l'")
  })

  it('includes spotlight JS when laserPointer is spotlight', () => {
    const html = generateRevealHTML(makePresentation({ laserPointer: 'spotlight' }))
    expect(html).toContain("var mode = 'spotlight'")
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

  it('sizes the references elements to the slide', () => {
    const pres = makePresentation({
      slideWidth: 960, slideHeight: 540,
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '[1]' }] }],
      bibliography: [{ key: 'a', type: 'article', title: 'Test' }],
    })
    const doc = parseHTML(generateRevealHTML(pres))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    const refs = sections[sections.length - 1]
    // Text elements carry 12px of horizontal padding, so a 904px box starting at
    // x=28 puts the text itself 40px in from either edge, as it always has been.
    const boxes = [...refs.querySelectorAll('div[style*="position:absolute"]')].map(d => d.getAttribute('style'))
    expect(boxes[0]).toContain('left:28px')
    expect(boxes[0]).toContain('width:904px')
    expect(boxes[1]).toContain('height:436px')
    expect(boxes[1]).toContain('overflow-y:auto')
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

// ── The generated references slide as a slide object ──────────────────────

describe('buildReferencesSlide', () => {
  const cite = text => ({
    id: 's1',
    elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 400, height: 60, zIndex: 1, content: text }],
  })
  const entry = (over = {}) => ({
    key: 'smith2020', type: 'article', author: 'Smith, John', title: 'A Paper',
    year: '2020', journal: 'Nature', volume: '42', pages: '100-110', ...over,
  })

  it('is nothing when there is no bibliography', () => {
    expect(buildReferencesSlide({ slides: [cite('<p>text</p>')] })).toBeNull()
    expect(buildReferencesSlide({ slides: [cite('<p>text</p>')], bibliography: [] })).toBeNull()
    expect(buildReferencesSlide(undefined)).toBeNull()
  })

  it('is nothing when the bibliography is never cited', () => {
    expect(buildReferencesSlide({ slides: [cite('<p>nothing cited</p>')], bibliography: [entry()] })).toBeNull()
  })

  it('builds a title and a list element spanning the slide', () => {
    const slide = buildReferencesSlide({
      slideWidth: 1280, slideHeight: 720, slides: [cite('<p>[1]</p>')], bibliography: [entry()],
    })
    expect(slide.id).toBe(REFERENCES_SLIDE_ID)
    expect(slide.generated).toBe(true)
    expect(slide.elements).toHaveLength(2)
    const [title, list] = slide.elements
    expect(title.content).toContain('>References<')
    expect(title.width).toBe(1280 - 56)
    expect(list.height).toBe(720 - 104)
    expect(list.scrollable).toBe(true)
  })

  it('carries neither a page number nor a footer', () => {
    const slide = buildReferencesSlide({ slides: [cite('<p>[1]</p>')], bibliography: [entry()] })
    expect(slide.showPageNumber).toBe(false)
    expect(slide.hideFooter).toBe(true)
  })

  it('lists only cited entries, renumbered from one', () => {
    const slide = buildReferencesSlide({
      slides: [cite('<p>[2]</p>')],
      bibliography: [entry({ key: 'first', title: 'First' }), entry({ key: 'second', title: 'Second' })],
    })
    const list = slide.elements[1].content
    expect(list).toContain('Second')
    expect(list).not.toContain('First')
    // Numbering runs over the cited entries, not over the whole library, which is
    // how the exported slide has always numbered them.
    expect(list).toContain('[1]')
  })

  it('formats an entry the way the citation list reads', () => {
    const slide = buildReferencesSlide({
      slides: [cite('<p>[1]</p>')], bibliography: [entry({ doi: '10.1234/x' })],
    })
    const list = slide.elements[1].content
    expect(list).toContain('Smith, John (2020). A Paper.')
    expect(list).toContain('<em>Nature</em>, 42, 100-110.')
    expect(list).toContain('href="https://doi.org/10.1234/x"')
  })

  it('escapes entry fields', () => {
    const slide = buildReferencesSlide({
      slides: [cite('<p>[1]</p>')],
      bibliography: [entry({ title: 'Tags <b>here</b>', journal: 'A & B' })],
    })
    const list = slide.elements[1].content
    expect(list).toContain('Tags &lt;b&gt;here&lt;/b&gt;')
    expect(list).toContain('A &amp; B')
  })

  it('takes the entry marker colour from the footer colour', () => {
    const slide = buildReferencesSlide({
      slides: [cite('<p>[1]</p>')], bibliography: [entry()], footerColor: '#ff8800',
    })
    expect(slide.elements[1].content).toContain('color:#ff8800')
  })

  it('switches to two columns past eight entries', () => {
    const many = Array.from({ length: 9 }, (_, i) => entry({ key: `k${i}`, title: `T${i}` }))
    const cited = cite(many.map((_, i) => `[${i + 1}]`).join(' '))
    expect(buildReferencesSlide({ slides: [cited], bibliography: many }).elements[1].content).toContain('columns:2')
    expect(buildReferencesSlide({ slides: [cite('<p>[1]</p>')], bibliography: [entry()] }).elements[1].content).toContain('columns:1')
  })
})

describe('generated references slide — in the deck', () => {
  const pres = (over = {}) => ({
    title: 'Deck', slideWidth: 960, slideHeight: 540,
    slides: [{ id: 's1', section: 'Intro', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 400, height: 60, zIndex: 1, content: '<p>See [1]</p>' }] }],
    bibliography: [{ key: 'a', type: 'article', author: 'Smith, John', title: 'A Paper', year: '2020' }],
    ...over,
  })

  it('closes the deck', () => {
    const doc = parseHTML(generateRevealHTML(pres()))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    expect(sections).toHaveLength(2)
    expect(sections[1].innerHTML).toContain('>References<')
  })

  it('shows no footer or page number of its own', () => {
    const doc = parseHTML(generateRevealHTML(pres({ showFooter: true, showPageNumbers: true })))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    expect(sections[0].innerHTML).toContain('reveal-footer')
    expect(sections[1].innerHTML).not.toContain('reveal-footer')
  })

  it('is left out of the deck page count', () => {
    const doc = parseHTML(generateRevealHTML(pres({ showPageNumbers: true })))
    const sections = doc.querySelectorAll('.reveal .slides > section')
    expect(sections[0].innerHTML).toContain('1 / 1')
  })

  it('prints as the last page', () => {
    const html = generatePrintHTML(pres())
    expect((html.match(/class="slide-page"/g) || []).length).toBe(2)
    expect(html.lastIndexOf('>References<')).toBeGreaterThan(html.lastIndexOf('See [1]'))
  })

  it('is absent from the print pages when nothing is cited', () => {
    const html = generatePrintHTML(pres({ bibliography: [] }))
    expect((html.match(/class="slide-page"/g) || []).length).toBe(1)
    expect(html).not.toContain('>References<')
  })
})

// ── Citation index driving the deck ───────────────────────────────────────

describe('citation numbering in the deck', () => {
  const smith = { key: 'smith2020', type: 'article', author: 'Smith, John', title: 'Alpha', year: '2020' }
  const ames = { key: 'ames2021', type: 'article', author: 'Ames, Ada', title: 'Gamma', year: '2021' }
  const marker = (key, label) => `<sup data-cite="${key}" style="color:#6366f1">${label}</sup>`

  // Smith is cited first, Ames second — the stored labels say the opposite.
  const deck = (over = {}) => ({
    slideWidth: 960, slideHeight: 540, bibliography: [smith, ames],
    slides: [
      { id: 's1', elements: [{ id: 'e1', type: 'text', x: 0, y: 0, width: 400, height: 60, zIndex: 1, content: `A ${marker('smith2020', '[9]')}` }] },
      { id: 's2', elements: [{ id: 'e2', type: 'text', x: 0, y: 0, width: 400, height: 60, zIndex: 1, content: `B ${marker('ames2021', '[9]')}` }] },
    ],
    ...over,
  })

  it('numbers in-text markers from the index, not from what is stored', () => {
    const html = generateRevealHTML(deck())
    expect(html).toContain('data-cite="smith2020" style="color:#6366f1">[1]</sup>')
    expect(html).toContain('data-cite="ames2021" style="color:#6366f1">[2]</sup>')
    expect(html).not.toContain('>[9]</sup>')
  })

  it('orders the references slide by first appearance', () => {
    const slide = buildReferencesSlide(deck())
    const list = slide.elements[1].content
    expect(list.indexOf('Alpha')).toBeLessThan(list.indexOf('Gamma'))
    expect(list).toContain('>[1]</span>Smith, John')
  })

  it('orders the references slide alphabetically when asked', () => {
    const slide = buildReferencesSlide(deck({ citationOrder: 'alphabetical' }))
    const list = slide.elements[1].content
    expect(list.indexOf('Gamma')).toBeLessThan(list.indexOf('Alpha'))
    expect(list).toContain('>[1]</span>Ames, Ada')
  })

  it('keeps markers and the references list on the same numbers', () => {
    const html = generateRevealHTML(deck({ citationOrder: 'alphabetical' }))
    expect(html).toContain('data-cite="ames2021" style="color:#6366f1">[1]</sup>')
    expect(html).toContain('>[1]</span>Ames, Ada')
    expect(html).toContain('data-cite="smith2020" style="color:#6366f1">[2]</sup>')
    expect(html).toContain('>[2]</span>Smith, John')
  })

  it('leaves an uncited library entry out of the index and the slide', () => {
    const unused = { key: 'nobody1999', type: 'article', author: 'Nobody, N', title: 'Uncited', year: '1999' }
    const html = generateRevealHTML(deck({ bibliography: [smith, unused, ames] }))
    expect(html).not.toContain('Uncited')
    expect(html).toContain('data-cite="ames2021" style="color:#6366f1">[2]</sup>')
  })

  it('resolves markers in author-year style too', () => {
    const html = generateRevealHTML(deck({ citationStyle: 'author-year' }))
    expect(html).toContain('data-cite="smith2020" style="color:#6366f1">(Smith, 2020)</sup>')
  })

  it('resolves markers on printed pages as well', () => {
    const html = generatePrintHTML(deck())
    expect(html).toContain('data-cite="smith2020" style="color:#6366f1">[1]</sup>')
  })
})
