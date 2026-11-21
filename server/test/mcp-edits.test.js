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

  it('say what to fix', () => {
    fails([{ op: 'nope' }], /must be one of: update_deck, add_slide/)
    fails([{ op: 'update_slide', slide: 7, title: 'x' }], /There's no slide 7\. The presentation has 2 slides/)
    fails([{ op: 'update_slide', slide: 2, body: 'x' }], /no body placeholder/)
    fails([{ op: 'update_slide', slide: 1, subtitle: ['a', 'b'] }], /1 subtitle placeholder, and subtitle has 2 parts/)
    fails([{ op: 'update_slide', slide: 1 }], /needs at least one of/)
    fails([{ op: 'update_slide', slide: 1, shade: 'red' }], /has "shade", which update_slide doesn't take/)
    fails([{ op: 'add_element', slide: 1, type: 'image' }], /text or shape for now/)
    fails([{ op: 'add_element', slide: 1, type: 'text', fill: 'red' }], /fill is for shapes/)
    fails([{ op: 'update_element', slide: 2, element: 'zz' }], /Slide 2 has no element "zz"/)
    fails([{ op: 'update_element', slide: 2, element: 'b2', fill: 'url(x)' }], /fill must be a color/)
    fails([{ op: 'update_deck', font: 'x;} body{display:none' }], /font must be a CSS font family list/)
    fails([{ op: 'update_deck', theme: 'neon' }], /theme must be one of: black, white/)
    fails([{ op: 'move_slide', slide: 1, after: 1 }], /can't go after itself/)
    fails([{ op: 'add_slide' }, { op: 'delete_slide', slide: 9 }], /^Edit 2 \(delete_slide\): There's no slide 9/)
    const one = { title: 'x', slides: [{ id: 'only', elements: [] }] }
    assert.throws(() => runEdits(one, [{ op: 'delete_slide', slide: 1 }]), /only slide/)
  })
})
