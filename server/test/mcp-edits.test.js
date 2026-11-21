// What an AI collaborator link's edits do to a deck (mcp/edits.js), and the
// Markdown they're written in (mcp/markdown.js). Needs no database.

const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const markdown = require('../mcp/markdown')
const { runEdits, EditError } = require('../mcp/edits')
const format = require('../mcp/format')

const deck = () => ({
  title: 'Talk',
  theme: 'black',
  slides: [
    { id: 's1', layout: 'title', notes: '', elements: [
      { id: 't1', type: 'text', placeholder: 'title', x: 60, y: 150, width: 840, height: 120, zIndex: 1, content: '<h2 style="text-align:center"></h2>' },
      { id: 'u1', type: 'text', placeholder: 'subtitle', x: 120, y: 282, width: 720, height: 80, zIndex: 2, content: '<p style="text-align:center"></p>' },
    ] },
    { id: 's2', background: { type: 'color', color: '#1e1e2e' }, elements: [
      { id: 'h2', type: 'text', x: 40, y: 30, width: 880, height: 80, zIndex: 1, content: '<h2>Old title</h2>' },
      { id: 'b2', type: 'shape', shape: 'rect', x: 40, y: 140, width: 200, height: 100, zIndex: 2, fill: '#333', text: '' },
    ] },
  ],
  annotationSets: [{ id: 'ink' }],
})
const fails = (edits, pattern) => assert.throws(() => runEdits(deck(), edits), err => err instanceof EditError && pattern.test(err.message))

describe("an AI collaborator's Markdown", () => {
  before(() => markdown.ready())

  it('becomes the HTML text boxes keep, with math and citations', () => {
    assert.equal(markdown.toHtml('- **Ohm**: $V = IR$ [@ohm1827]'),
      '<ul><li><p><strong>Ohm</strong>: <span data-math-latex="V = IR" data-math-display="false" data-math-fontsize="" data-math-color="" class="math-node math-inline"></span> '
      + '<sup data-cite="ohm1827" style="color:#6366f1;cursor:default">[ohm1827]</sup></p></li></ul>')
    assert.match(markdown.toHtml('$$\n\\int f\n$$'), /^<p><span data-math-latex="\\int f" data-math-display="true"/)
    assert.equal(markdown.toHtml('It costs $5 or $10'), '<p>It costs $5 or $10</p>')
    assert.equal(markdown.toHtml('```js\na < b\nc\n```'), '<pre><code class="language-js">a &lt; b\nc</code></pre>')
    assert.equal(markdown.toHtml('one\ntwo'), '<p>one<br>two</p>')
    assert.equal(markdown.toHtml(''), '')
  })

  it('never keeps raw HTML or unsafe links', () => {
    const html = markdown.toHtml('<img src=x onerror=alert(1)> [a](javascript:alert(1)) [b](https://example.com) ![pic](https://x/y.png)')
    assert.doesNotMatch(html, /<img|javascript:/)
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
    assert.match(html, /<a target="_blank" rel="noopener noreferrer nofollow" href="https:\/\/example.com">b<\/a>/)
    assert.match(html, /pic/)
  })

  it('reads back as it was written', () => {
    for (const md of ['- One $x$\n- Two [@k]', '# Head\n\nPara', '| a | b |\n| --- | --- |\n| 1 | 2 |']) {
      assert.equal(format.htmlToMarkdown(markdown.toHtml(md)), md)
    }
  })
})

describe("an AI collaborator's edits", () => {
  before(() => markdown.ready())

  it('fill a new slide through its layout', () => {
    const d = deck()
    const { lines, slideId, elementIds } = runEdits(d, [{ op: 'add_slide', layout: 'two-column', after: 2, title: 'Compare', body: ['- left', '- right'], notes: 'Pause', minutes: 2 }])
    assert.match(lines[0], /^Added slide 3 \(`[0-9a-f-]{36}`\), layout two-column\.$/)
    const slide = d.slides[2]
    assert.equal(slide.id, slideId)
    assert.equal(slide.layout, 'two-column')
    assert.deepEqual(slide.elements.map(el => el.placeholder), ['title', 'body', 'body'])
    assert.equal(slide.elements[0].content, '<h2>Compare</h2>')
    assert.equal(slide.elements[2].content, '<ul><li><p>right</p></li></ul>')
    assert.equal(slide.notes, 'Pause')
    assert.equal(slide.minutes, 2)
    assert.deepEqual(elementIds, slide.elements.map(el => el.id))
    // after a slide with the old dark default, it has it too, as the editor's new slides do
    assert.deepEqual(slide.background, { type: 'color', color: '#1e1e2e' })
    runEdits(d, [{ op: 'add_slide', after: 0 }])
    assert.equal(d.slides[0].background, undefined)
  })

  it("keep a placeholder's alignment, and a title box's heading", () => {
    const d = deck()
    runEdits(d, [
      { op: 'update_slide', slide: 1, title: '# Big *idea*', subtitle: 'By me' },
      { op: 'update_slide', slide: 's2', title: 'New title' },
    ])
    assert.equal(d.slides[0].elements[0].content, '<h2 style="text-align:center">Big <em>idea</em></h2>')
    assert.equal(d.slides[0].elements[1].content, '<p style="text-align:center">By me</p>')
    assert.equal(d.slides[1].elements[0].content, '<h2>New title</h2>')
  })

  it('change elements, the deck and the outline, and leave ink alone', () => {
    const d = deck()
    runEdits(d, [
      { op: 'update_element', slide: 2, element: 'b2', x: 100, fill: 'tomato', text: 'Label' },
      { op: 'add_element', slide: 2, type: 'text', x: 40, y: 300, width: 400, height: 100, text: 'A note' },
      { op: 'update_deck', theme: 'white', font: 'Georgia, serif' },
      { op: 'update_outline', slide: 1, outline: '- Hook\n  - A story\n    - Its end\n      - Too deep', section: 'Opening', minutes: 3 },
      { op: 'move_slide', slide: 2, after: 0 },
    ])
    assert.equal(d.slides[0].id, 's2')
    const shape = d.slides[0].elements.find(el => el.id === 'b2')
    assert.deepEqual([shape.x, shape.fill, shape.text], [100, 'tomato', 'Label'])
    const note = d.slides[0].elements[2]
    assert.deepEqual([note.type, note.content, note.sizeMode, note.zIndex], ['text', '<p>A note</p>', 'shrink', 3])
    assert.deepEqual([d.theme, d.globalFont], ['white', 'Georgia, serif'])
    // A theme replaces the old dark default, as the theme gallery does
    assert.equal(d.slides[0].background, undefined)
    assert.deepEqual(d.slides[1].outlineNotes.map(n => n.level), [0, 1, 2, 2])
    assert.deepEqual([d.slides[1].section, d.slides[1].minutes], ['Opening', 3])
    assert.deepEqual(d.annotationSets, [{ id: 'ink' }])
  })

  it('turn Beamer into slides, with the references they cite', () => {
    const d = deck()
    d.bibliography = [{ type: 'article', key: 'old2019', title: 'Older' }]
    const source = String.raw`\documentclass{beamer}
\newcommand{\RC}{\ensuremath{RC}}
\begin{document}
\section{Filters}
\begin{frame}{Cutoff}
\begin{itemize}
\item<1-> $f_c = 1/2\pi\RC$ \cite{smith2020}
\item<2-> Also \cite{nobody}
\end{itemize}
\note{Say it slowly}
\end{frame}
\begin{frame}{A figure}
\includegraphics{plot.png}
\end{frame}
\end{document}`
    const { lines, slideId } = runEdits(d, [{ op: 'import_beamer', after: 1, source, bibtex: '@article{smith2020, title={On filters}, author={Smith, A.}, year={2020}}' }])
    const added = d.slides.slice(1, 3)
    assert.equal(d.slides.length, 4)
    assert.equal(slideId, added[0].id)
    assert.match(lines[0], /^Added 2 slides from 2 frames, as slides 2 to 3\./)
    assert.match(lines[0], /1 reference joined the bibliography: smith2020\./)
    assert.match(lines[0], /show as \[key\]: nobody\./)
    assert.match(lines[0], /empty boxes, since Parallax has no copy of them: plot\.png\./)
    const texts = added[0].elements.map(el => el.content || '').join('\n')
    assert.match(texts, /Cutoff/)
    // The source's own macros, expanded
    assert.match(texts, /data-math-latex="f_c = 1\/2\\pi\\ensuremath\{RC\}"/)
    assert.match(texts, /<sup data-cite="smith2020"[^>]*>\[1\]<\/sup>/)
    assert.equal(added[0].notes, 'Say it slowly')
    assert.equal(added[0].section, 'Filters')
    assert.deepEqual(d.bibliography.map(e => e.key), ['old2019', 'smith2020'])
    // Steps are fragments on the slide, as the editor's import makes them
    assert.ok(added[0].elements.some(el => el.fragment), 'the second item comes in at a step')
  })

  it('add graphs, tables and diagrams from their guides, checked as their editors check them', () => {
    const d = { ...deck(), theme: 'white' }
    const datasets = [{ name: 'planets', columns: [{ name: 'period' }, { name: 'mass' }] }]
    const { lines } = runEdits(d, [
      { op: 'add_element', slide: 1, type: 'graph', spec: { expressions: [{ text: 'y = a x^2' }, { text: 'a = 1', slider: { min: 0, max: 3, step: 0.1 } }, { data: { dataset: 'planets', x: 'period', y: 'mass' } }], yScale: 'log' } },
      { op: 'add_element', slide: 1, type: 'circuit', template: 'rc', x: 40, y: 40, width: 300 },
      { op: 'add_element', slide: 2, type: 'venn', spec: { sets: [{ id: 'A', label: 'Cats' }, { id: 'B', label: 'Dogs' }], expr: "A ∩ B'", buildUp: 'every' } },
      { op: 'add_element', slide: 2, type: 'table', spec: { data: [['Planet', 'Mass'], ['Mars', 0.107]] } },
    ], { datasets })
    const [graph, circuit] = d.slides[0].elements.slice(2)
    // Centered at its editor's size, over what's there, with the next colors on a light slide
    assert.deepEqual([graph.x, graph.y, graph.width, graph.height, graph.zIndex], [200, 70, 560, 400, 3])
    assert.equal(graph.theme, 'light')
    assert.deepEqual(graph.expressions.map(e => e.color), ['#c74440', undefined, '#2d70b3'])
    assert.equal(graph.yScale, 'log')
    assert.match(lines[0], /^Added a graph `[0-9a-f-]{36}` to slide 1 at x 200, y 70, 560×400\.$/)
    // A template's diagram, its height following its shape
    assert.deepEqual([circuit.type, circuit.x, circuit.width], ['circuit', 40, 300])
    assert.ok(circuit.edges.some(e => e.part === 'capacitor'))
    assert.equal(circuit.color, '#1a1a1a')
    assert.match(lines[1], /from the rc template\./)
    const venn = d.slides[1].elements[2]
    assert.equal(venn.expr, "A ∩ B'")
    assert.ok(venn.layers.length > 0, 'built up in steps')
    // The second slide's own dark background gives light ink
    assert.equal(venn.color, '#ffffff')
    assert.deepEqual(d.slides[1].elements[3].data, [['Planet', 'Mass'], ['Mars', '0.107']])

    // get_slide reads them back as spec
    const detail = format.slideDetail(d, format.findSlide(d, 1))
    assert.match(detail, /Graph: x -10 to 10, y -7 to 7, log y/)
    assert.match(detail, /- `[a-z0-9]+` "y = a x\^2" \(color #c74440\)/)
    assert.match(detail, /data: \{"dataset":"planets","x":"period","y":"mass"\}/)
    assert.match(detail, /- `C1` capacitor|capacitor/)

    // update_element's spec replaces only the fields it gives
    runEdits(d, [{ op: 'update_element', slide: 1, element: graph.id, spec: { view: { xMin: 0, xMax: 5, yMin: 0.1, yMax: 100 }, equalScale: false } }], { datasets })
    const changed = d.slides[0].elements.find(el => el.id === graph.id)
    assert.equal(changed.expressions.length, 3)
    assert.deepEqual(changed.view, { xMin: 0, xMax: 5, yMin: 0.1, yMax: 100 })
    assert.equal(changed.yScale, 'log')

    const bad = (edit, pattern) => assert.throws(() => runEdits(deck(), [edit], { datasets }), err => err instanceof EditError && pattern.test(err.message), pattern.source)
    bad({ op: 'add_element', slide: 1, type: 'graph', spec: { expressions: [{ text: 'y = kx' }] } }, /uses k, which no line defines\. Add a slider line such as "k = 1"/)
    bad({ op: 'add_element', slide: 1, type: 'graph', spec: { expressions: [{ text: 'y = 2x +' }] } }, /expressions\[0\] \("y = 2x \+"\): Something’s missing at the end/)
    bad({ op: 'add_element', slide: 1, type: 'graph', spec: { expressions: [{ data: { dataset: 'planets', x: 'period', y: 'radius' } }] } }, /has no column "radius" \(for y\)\. Its columns: period, mass/)
    bad({ op: 'add_element', slide: 1, type: 'graph', spec: { expressions: [{ data: { dataset: 'stars', x: 'a', y: 'b' } }] } }, /no dataset "stars" linked to the presentation\. It has: planets/)
    bad({ op: 'add_element', slide: 1, type: 'venn', spec: { sets: [{ id: 'A' }, { id: 'B' }], expr: 'A ∩ (B' } }, /This bracket is never closed/)
    bad({ op: 'add_element', slide: 1, type: 'timing', spec: { source: '{ signal: [ { name: 1, wave: 42 } ] }' } }, /wave must be a string/)
    bad({ op: 'add_element', slide: 1, type: 'geometry', spec: { script: 'A = Point(0, 0)\nX = Bogus(A)' } }, /line 2: Bogus isn’t a command/)
    bad({ op: 'add_element', slide: 1, type: 'circuit', template: 'nope' }, /circuit has no template "nope"\. Its templates: lamp, parallel/)
    bad({ op: 'add_element', slide: 1, type: 'circuit', spec: { vertices: [{ id: 'a', x: 0, y: 0 }], edges: [{ id: 'e', from: 'a', to: 'zz', part: 'resistor' }] } }, /1 of the edges couldn't be used/)
    bad({ op: 'add_element', slide: 1, type: 'table', spec: { data: [['a']] }, fill: 'red' }, /fill is for text boxes and shapes/)
    bad({ op: 'add_element', slide: 1, type: 'graph', spec: { expressions: [{ text: 'y = x' }], hue: 'red' } }, /spec has "hue", which it doesn't take/)
    bad({ op: 'update_element', slide: 2, element: 'h2', spec: { data: [['a']] } }, /spec and template are for graphs, diagrams/)
    bad({ op: 'add_element', slide: 1, type: 'image' }, /type must be one of: text, shape, graph/)
  })

  it('say what to fix', () => {
    fails([{ op: 'nope' }], /must be one of: update_deck, add_slide/)
    fails([{ op: 'update_slide', slide: 7, title: 'x' }], /There's no slide 7\. The presentation has 2 slides/)
    fails([{ op: 'update_slide', slide: 2, body: 'x' }], /no body placeholder/)
    fails([{ op: 'update_slide', slide: 1, subtitle: ['a', 'b'] }], /1 subtitle placeholder, and subtitle has 2 parts/)
    fails([{ op: 'update_slide', slide: 1 }], /needs at least one of/)
    fails([{ op: 'update_slide', slide: 1, shade: 'red' }], /has "shade", which update_slide doesn't take/)
    fails([{ op: 'add_element', slide: 1, type: 'text', fill: 'red' }], /fill is for shapes/)
    fails([{ op: 'update_element', slide: 2, element: 'zz' }], /Slide 2 has no element "zz"/)
    fails([{ op: 'update_element', slide: 2, element: 'b2', fill: 'url(x)' }], /fill must be a color/)
    fails([{ op: 'update_deck', font: 'x;} body{display:none' }], /font must be a CSS font family list/)
    fails([{ op: 'update_deck', theme: 'neon' }], /theme must be one of: black, white/)
    fails([{ op: 'move_slide', slide: 1, after: 1 }], /can't go after itself/)
    fails([{ op: 'add_slide' }, { op: 'delete_slide', slide: 9 }], /^Edit 2 \(delete_slide\): There's no slide 9/)
    fails([{ op: 'import_beamer', source: 'just words' }], /no frames/)
    fails([{ op: 'import_beamer', source: '\\begin{frame}x\\end{frame}', bibtex: 42 }], /bibtex must be text/)
    const one = { title: 'x', slides: [{ id: 'only', elements: [] }] }
    assert.throws(() => runEdits(one, [{ op: 'delete_slide', slide: 1 }]), /only slide/)
  })
})
