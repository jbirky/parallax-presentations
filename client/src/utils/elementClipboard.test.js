// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { ELEMENTS_TYPE, clipboardData, writeElements, readElements, elementsFromHtml, textToHtml, sanitizePastedHtml, placePasted } from './elementClipboard'

const text = (id, content, extra = {}) => ({ id, type: 'text', x: 100, y: 50, width: 300, height: 80, content, ...extra })
const shape = { id: 's', type: 'shape', shape: 'rect', x: 10, y: 10, width: 100, height: 100 }

// A copy or paste event's clipboard
function transfer(data = {}) {
  const store = { ...data }
  return { setData: (type, value) => { store[type] = value }, getData: type => store[type] ?? '', store }
}

describe('copying elements', () => {
  it('puts their JSON, their words as HTML, and their words as text on the clipboard', () => {
    const data = clipboardData([text('a', '<h2>Title</h2><p>One &amp; two</p>'), shape], 'slide-1')
    expect(JSON.parse(data[ELEMENTS_TYPE])).toEqual({ version: 1, slideId: 'slide-1', elements: [text('a', '<h2>Title</h2><p>One &amp; two</p>'), shape] })
    expect(data['text/html']).toContain('<h2>Title</h2><p>One &amp; two</p>')
    expect(data['text/plain']).toBe('Title\nOne & two')
  })

  it('reads them back from their own type, or from the HTML when that type is gone', () => {
    const elements = [text('a', '<p>Hi</p>'), shape]
    const clip = transfer()
    writeElements(clip, elements, 's1')
    expect(readElements(clip)).toEqual({ slideId: 's1', elements })
    const htmlOnly = transfer({ 'text/html': clip.store['text/html'] })
    expect(readElements(htmlOnly)).toEqual({ slideId: 's1', elements })
  })

  it('finds no elements in other HTML or in a damaged copy', () => {
    expect(readElements(transfer({ 'text/html': '<p>From a web page</p>', 'text/plain': 'From a web page' }))).toBeNull()
    expect(elementsFromHtml('<div data-parallax-elements="%7Bnot json"></div>')).toBeNull()
    expect(readElements(transfer({ [ELEMENTS_TYPE]: JSON.stringify({ elements: [{ nope: 1 }] }) }))).toBeNull()
  })
})

describe('pasting from other apps', () => {
  it('makes plain text into paragraphs, escaped', () => {
    expect(textToHtml('First\r\n\r\nA < B & C\n')).toBe('<p>First</p><p></p><p>A &lt; B &amp; C</p>')
  })

  it('keeps structure and emphasis but not fonts, colors or scripts', () => {
    const html = '<h1 style="color:red">Heading</h1><p style="font-family:Arial;font-size:11pt">Some <span style="font-weight:700">bold</span> and <span style="font-style:italic">italic</span> <a href="https://example.com" onclick="x()">link</a></p><script>alert(1)</script><img src="x" onerror="y()">'
    const out = sanitizePastedHtml(html)
    expect(out).toBe('<h1>Heading</h1><p>Some <strong>bold</strong> and <em>italic</em> <a href="https://example.com">link</a></p>')
  })

  it('drops the not-bold <b> a word processor wraps around everything', () => {
    const html = '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:400">Plain</span></p></b>'
    expect(sanitizePastedHtml(html)).toBe('<p>Plain</p>')
  })

  it('puts loose words in a paragraph', () => {
    expect(sanitizePastedHtml('Just <b>words</b>')).toBe('<p>Just <b>words</b></p>')
    expect(sanitizePastedHtml('<span></span>')).toBe('')
  })
})

describe('placing pasted elements', () => {
  const els = [{ id: 'a', x: 100, y: 100, width: 200, height: 100 }, { id: 'b', x: 900, y: 500, width: 100, height: 40 }]

  it('leaves them where they were on another slide', () => {
    expect(placePasted(els, { sameSlide: false })).toBe(els)
  })

  it('steps them down and right on their own slide, staying on the canvas', () => {
    const once = placePasted(els, { sameSlide: true, pastes: 1 })
    expect(once.map(el => [el.x, el.y])).toEqual([[120, 120], [860, 500]])
    const twice = placePasted(els, { sameSlide: true, pastes: 2 })
    expect(twice[0]).toMatchObject({ x: 140, y: 140 })
  })
})
