import { describe, it, expect } from 'vitest'
import { isEmptyHtml, isEmptyPlaceholder, placeholderHint, withHint, titleOf, changeLayout } from './placeholders'

const text = (id, content, extra = {}) => ({ id, type: 'text', x: 0, y: 0, width: 100, height: 40, zIndex: 1, content, ...extra })
const layouts = {
  title: { elements: [
    { type: 'text', placeholder: 'title', sizeMode: 'shrink', x: 60, y: 150, width: 840, height: 120, zIndex: 1, content: '<h2 style="text-align:center"></h2>' },
    { type: 'text', placeholder: 'subtitle', sizeMode: 'shrink', x: 120, y: 282, width: 720, height: 80, zIndex: 2, content: '<p style="text-align:center"></p>' },
  ] },
  content: { elements: [
    { type: 'text', placeholder: 'title', x: 40, y: 36, width: 880, height: 100, zIndex: 1, content: '<h2></h2>' },
    { type: 'text', placeholder: 'body', x: 40, y: 140, width: 880, height: 360, zIndex: 2, content: '<ul><li><p></p></li></ul>' },
  ] },
  section: { elements: [
    { type: 'text', placeholder: 'title', x: 80, y: 140, width: 800, height: 150, zIndex: 1, content: '<h1 style="text-align:center"></h1>' },
    { type: 'shape', shape: 'rect', x: 280, y: 302, width: 400, height: 4, zIndex: 2, fill: '#6366f1' },
  ] },
  blank: { elements: [] },
}
let n = 0
const newId = () => `new${++n}`

describe('placeholders', () => {
  it('know when there’s nothing to show', () => {
    expect(isEmptyHtml('<h2 style="text-align:center"></h2>')).toBe(true)
    expect(isEmptyHtml('<ul><li><p>&nbsp; </p></li></ul>')).toBe(true)
    expect(isEmptyHtml('<p><br></p>')).toBe(true)
    expect(isEmptyHtml('<p>Hi</p>')).toBe(false)
    expect(isEmptyHtml('<p>&amp;</p>')).toBe(false)
    expect(isEmptyHtml('<p><img src="a.png"></p>')).toBe(false)
    expect(isEmptyHtml('<p><span data-math-latex="x"></span></p>')).toBe(false)
    expect(isEmptyPlaceholder(text('t', '<h2></h2>', { placeholder: 'title' }))).toBe(true)
    expect(isEmptyPlaceholder(text('t', '<h2></h2>'))).toBe(false)
    expect(isEmptyPlaceholder(text('t', '<h2>Done</h2>', { placeholder: 'title' }))).toBe(false)
  })

  it('show their hint in their first empty block, at its size and alignment', () => {
    expect(placeholderHint({ placeholder: 'title' })).toBe('Click to add title')
    expect(placeholderHint({ placeholder: 'body', hint: 'Focus' })).toBe('Focus')
    expect(withHint('<h2 style="text-align:center"></h2>', 'Click to add title')).toBe('<h2 style="text-align:center"><span class="placeholder-hint">Click to add title</span></h2>')
    expect(withHint('<ul><li><p></p></li></ul>', 'Click & add')).toBe('<ul><li><p><span class="placeholder-hint">Click &amp; add</span></p></li></ul>')
    expect(withHint('', 'Hint')).toBe('<p><span class="placeholder-hint">Hint</span></p>')
  })

  it('find a slide’s title: its title placeholder, else its topmost heading', () => {
    const els = [text('b', '<p>Body</p>', { y: 10 }), text('h', '<h2>Topic</h2>', { y: 40 }), text('h2', '<h3>Lower</h3>', { y: 200 })]
    expect(titleOf(els).id).toBe('h')
    expect(titleOf([...els, text('t', '<h2></h2>', { placeholder: 'title', y: 300 })]).id).toBe('t')
    expect(titleOf([text('p', '<p>Only</p>')])).toBeNull()
  })
})

describe('changing a slide’s layout', () => {
  it('moves the title and the subtitle into the next layout’s title and body', () => {
    const slide = { elements: [
      text('t', '<h2 style="text-align:center"><strong>Dark</strong> matter</h2>', { placeholder: 'title', y: 150 }),
      text('s', '<p style="text-align:center">A survey</p>', { placeholder: 'subtitle', y: 282 }),
      { id: 'img', type: 'image', x: 10, y: 10, width: 50, height: 50, zIndex: 3 },
    ] }
    const out = changeLayout(slide, layouts.content, newId)
    const [title, body] = out.filter(el => el.placeholder)
    expect(title).toMatchObject({ placeholder: 'title', x: 40, y: 36, content: '<h2><strong>Dark</strong> matter</h2>' })
    expect(body).toMatchObject({ placeholder: 'body', content: '<p>A survey</p>' })
    expect(out.map(el => el.id)).toContain('img')
    expect(out.map(el => el.id)).not.toContain('t')
    expect(out.map(el => el.id)).not.toContain('s')
  })

  it('puts a list into a title layout’s subtitle as lines, in its alignment', () => {
    const slide = { elements: [
      text('t', '<h2>Plan</h2>', { placeholder: 'title', y: 36 }),
      text('b', '<ul><li><p>One</p></li><li><p>Two</p></li></ul>', { placeholder: 'body', y: 140 }),
    ] }
    const [title, subtitle] = changeLayout(slide, layouts.title, newId).filter(el => el.placeholder)
    expect(title.content).toBe('<h2 style="text-align:center">Plan</h2>')
    expect(subtitle.content).toBe('<p style="text-align:center">One<br>Two</p>')
  })

  it('leaves text with no place where it was, drops empty placeholders, and keeps a title when the layout has none', () => {
    const slide = { elements: [
      text('t', '<h2>Heading</h2>', { y: 20 }),
      text('a', '<p>First</p>', { y: 120 }),
      text('b', '<p>Second</p>', { y: 300 }),
      text('e', '<p></p>', { placeholder: 'body', y: 400 }),
    ] }
    const out = changeLayout(slide, layouts.content, newId)
    expect(out.find(el => el.placeholder === 'body').content).toBe('<p>First</p>')
    expect(out.find(el => el.id === 'b').content).toBe('<p>Second</p>')
    expect(out.find(el => el.id === 'e')).toBeUndefined()
    const blank = changeLayout(slide, layouts.blank, newId)
    expect(blank.map(el => el.id).sort()).toEqual(['a', 'b', 't'])
  })

  it('swaps the old layout’s shapes for the new one’s', () => {
    const slide = { elements: [
      { id: 'line', type: 'shape', shape: 'rect', layoutPart: true, x: 0, y: 0, width: 10, height: 2 },
      { id: 'mine', type: 'shape', shape: 'circle', x: 0, y: 0, width: 10, height: 10 },
      text('t', '<h1>Part two</h1>', { placeholder: 'title' }),
    ] }
    const out = changeLayout(slide, layouts.section, newId)
    expect(out.find(el => el.id === 'line')).toBeUndefined()
    expect(out.find(el => el.id === 'mine')).toBeTruthy()
    expect(out.filter(el => el.layoutPart)).toHaveLength(1)
    expect(out.find(el => el.placeholder === 'title').content).toBe('<h1 style="text-align:center">Part two</h1>')
  })
})
