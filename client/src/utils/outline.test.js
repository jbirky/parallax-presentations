// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  outlineLines, slideParts, slideOrder, sectionStarts, timing, describe as describeElement,
  setTitle, setPoint, setNote, setSectionName, setMinutes, setTarget,
  enter, indent, outdent, backspace, cleanInline, atomize, lineHtml, normalizeInline,
} from './outline'

let n = 0
const text = (content, extra = {}) => ({ id: 'e' + ++n, type: 'text', x: 60, y: 40, width: 840, height: 400, zIndex: 1, content, ...extra })
const slide = (id, elements, extra = {}) => ({ id, elements, notes: '', background: { type: 'color', color: '#1e1e2e' }, ...extra })
const deckOf = (...slides) => ({ title: 'Talk', slides })
const kinds = d => outlineLines(d).map(L => L.kind + (L.kind === 'point' ? L.level : '') + ':' + (L.html ?? L.text ?? L.label ?? ''))
const lineOf = (d, key) => outlineLines(d).find(L => L.key === key)

describe('reading a slide', () => {
  it('takes the heading and the text after it from Parallax’s own new slide', () => {
    const d = deckOf(slide('a', [text('<h2 style="text-align: center">New Slide</h2><p style="text-align: center">Double-click to edit</p>')]))
    expect(kinds(d)).toEqual(['slide:New Slide', 'point0:Double-click to edit'])
  })

  it('takes the topmost heading box as the title, and the largest list as the points', () => {
    const d = deckOf(slide('a', [
      text('<ul><li><p>Stars orbit fast</p><ul><li><p>21 cm data</p></li></ul></li><li><p>Kepler predicts a fall</p></li></ul>', { y: 140, height: 340 }),
      text('<h2>Rotation curves</h2>', { y: 30, height: 80 }),
      text('<p>Caption</p>', { y: 480, height: 40, width: 200 }),
      { id: 'g', type: 'graph', x: 500, y: 140, width: 400, height: 300 },
    ], { notes: 'Point at the flat part\nThen the fall' }))
    expect(kinds(d)).toEqual([
      'slide:Rotation curves', 'point0:Stars orbit fast', 'point1:21 cm data', 'point0:Kepler predicts a fall',
      'item:Text · Caption', 'item:Graph', 'note:Point at the flat part', 'note:Then the fall',
    ])
  })

  it('reads lists written without paragraphs, quotes, and boxes of paragraphs', () => {
    const d = deckOf(
      slide('a', [text('<h1>Why Galaxies Spin</h1>', { y: 150 }), text('<p>A seminar</p><p>12 minutes</p>', { y: 300, height: 100 })]),
      slide('b', [text('<h2>Q</h2><ul><li>bare item<ul><li>under it</li></ul></li></ul><blockquote><p>A quote</p></blockquote>')]),
    )
    expect(kinds(d)).toEqual(['slide:Why Galaxies Spin', 'point0:A seminar', 'point0:12 minutes', 'slide:Q', 'point0:bare item', 'point1:under it', 'point0:A quote'])
  })

  it('lists a slide with no heading as untitled, and a slide made of other things as just those', () => {
    const d = deckOf(slide('a', [text('<p>Only text</p>')]), slide('b', [{ id: 'i', type: 'image', alt: 'M33 in H-alpha' }]))
    expect(kinds(d)).toEqual(['slide:', 'point0:Only text', 'slide:', 'item:Image · M33 in H-alpha'])
  })

  it('follows boxes marked for the outline over its guesses', () => {
    const s = slide('a', [text('<h2>Guess</h2>', { y: 0 }), text('<p>Chosen</p>', { y: 300, outline: 'title' })])
    expect(slideParts(s).title.content).toBe('<p>Chosen</p>')
  })

  it('names the things it lists', () => {
    expect(describeElement({ type: 'molecule', name: 'Caffeine' })).toBe('Molecule · Caffeine')
    expect(describeElement({ type: 'text', content: '<p>' + 'word '.repeat(20) + '</p>' })).toMatch(/…$/)
    expect(describeElement({ type: 'newthing' })).toBe('Newthing')
  })

  it('keeps math and citations in a line’s HTML', () => {
    const math = '<span data-math-latex="v^2" data-math-display="false" data-math-fontsize="" data-math-color="" class="math-node math-inline"></span>'
    const d = deckOf(slide('a', [text('<h2>Fit ' + math + '</h2><ul><li><p>As shown<sup data-cite="rubin80" style="font-size:0.6em">1</sup></p></li></ul>')]))
    const lines = outlineLines(d)
    expect(lines[0].html).toContain('data-math-latex="v^2"')
    expect(lines[1].html).toContain('data-cite="rubin80"')
  })
})

describe('the deck’s order and sections', () => {
  it('shows a 2D deck column by column, with the slides under each column’s first marked', () => {
    const slides = [slide('a', [], { column: 1 }), slide('b', [], { column: 0 }), slide('c', [], { column: 1 })]
    expect(slideOrder(slides)).toEqual([{ index: 1, vertical: false }, { index: 0, vertical: false }, { index: 2, vertical: true }])
  })

  it('starts a section where the label changes, or where one was started on purpose', () => {
    const slides = [slide('a', []), slide('b', [], { section: 'Data' }), slide('c', [], { section: 'Data' }), slide('d', [], { section: 'Data', sectionStart: true }), slide('e', [])]
    expect([...sectionStarts(slides)]).toEqual([1, 3, 4])
    expect(kinds(deckOf(...slides)).filter(k => k.startsWith('section'))).toEqual(['section:Data', 'section:Data', 'section:'])
  })

  it('adds up the minutes planned, by section, against the timer’s length', () => {
    const d = { ...deckOf(slide('a', [], { minutes: 0.5 }), slide('b', [], { section: 'Data', minutes: 2 }), slide('c', [], { section: 'Data', minutes: 1.5 })), timerDuration: 12 }
    expect(timing(d)).toEqual({ total: 4, target: 12, sections: [{ label: '', minutes: 0.5, slideId: 'a' }, { label: 'Data', minutes: 3.5, slideId: 'b' }] })
    expect(timing(deckOf(slide('a', []))).target).toBe(20)
  })

  it('shows the references slide last', () => {
    expect(outlineLines(deckOf(slide('a', [])), { referencesCount: 3 }).pop()).toMatchObject({ kind: 'references', n: 2, count: 3 })
  })
})

describe('typing into a line', () => {
  it('changes a title or point in its box, and nothing else there', () => {
    const d0 = deckOf(slide('a', [text('<h2 style="text-align: center">Old</h2><ul><li><p>one</p></li><li><p>two <strong>bold</strong></p></li></ul>')]))
    let d = setTitle(d0, 'a', 'New <em>title</em>')
    d = setPoint(d, 'a', 1, 'two <strong>bolder</strong>')
    expect(d.slides[0].elements[0].content).toBe('<h2 style="text-align: center">New <em>title</em></h2><ul><li><p>one</p></li><li><p>two <strong>bolder</strong></p></li></ul>')
    expect(d0.slides[0].elements[0].content).toContain('Old')
  })

  it('gives an untitled slide a title box when one is typed', () => {
    const d = setTitle(deckOf(slide('a', [text('<ul><li><p>p</p></li></ul>', { y: 150 })])), 'a', 'Named', { slideW: 1920, slideH: 1080 })
    const t = d.slides[0].elements[1]
    expect(t).toMatchObject({ outline: 'title', content: '<h2>Named</h2>', x: 120, width: 1680 })
    expect(setTitle(deckOf(slide('a', [])), 'a', '')).toEqual(deckOf(slide('a', [])))
  })

  it('writes notes, section names (to the whole section), minutes and the talk’s length', () => {
    let d = deckOf(slide('a', [], { notes: 'one\ntwo' }), slide('b', [], { section: 'Data' }), slide('c', [], { section: 'Data' }), slide('e', [], { section: 'Results' }))
    d = setNote(d, 'a', 1, 'TWO')
    d = setSectionName(d, 'b', 'Methods')
    d = setMinutes(setMinutes(d, 'a', 1.25), 'b', null)
    expect(d.slides.map(s => [s.section, s.sectionStart, s.minutes])).toEqual([[undefined, undefined, 1.25], ['Methods', true, undefined], ['Methods', undefined, undefined], ['Results', undefined, undefined]])
    expect(d.slides[0].notes).toBe('one\nTWO')
    // Renamed to match the section above, it stays a section of its own
    d = setSectionName(d, 'e', 'Methods')
    expect([...sectionStarts(d.slides)]).toEqual([1, 3])
    expect(setTarget(d, '15').timerDuration).toBe(15)
  })
})

describe('Enter', () => {
  const base = () => deckOf(slide('a', [text('<h2>Title</h2><ul><li><p>first</p><ul><li><p>sub</p></li></ul></li><li><p>second</p></li></ul>')], { section: 'S', column: 2 }))

  it('splits a point at the cursor, the new one under it', () => {
    const d = base(), r = enter(d, lineOf(d, 'a:p2'), 'sec', 'ond')
    expect(kinds(r.deck)).toEqual(['section:S', 'slide:Title', 'point0:first', 'point1:sub', 'point0:sec', 'point0:ond'])
    expect(r.focus).toEqual(['a:p3', 0])
    // A point with sub-points gets its new one as the first of them
    expect(kinds(enter(d, lineOf(d, 'a:p0'), 'first', '').deck).slice(2, 5)).toEqual(['point0:first', 'point1:', 'point1:sub'])
  })

  it('makes a new slide after this one, in its column, section and background', () => {
    const d = base(), r = enter(d, lineOf(d, 'a'), 'Ti', 'tle')
    const s = r.deck.slides[1]
    expect(r.deck.slides[0].elements[0].content).toMatch(/^<h2>Ti<\/h2>/)
    expect(s).toMatchObject({ column: 2, section: 'S', background: { type: 'color', color: '#1e1e2e' } })
    expect(s.elements[0].content).toBe('<h2>tle</h2>')
    expect(r.focus).toEqual([s.id, 0])
  })

  it('at the start of a title, puts a new slide before it, which takes over starting its section', () => {
    const d = deckOf(slide('z', []), slide('a', [text('<h2>Title</h2>')], { section: 'S', sectionStart: true }))
    const r = enter(d, lineOf(d, 'a'), '', 'Title')
    expect(r.deck.slides.map(s => [s.id === 'a' ? 'a' : s.id === 'z' ? 'z' : 'new', !!s.sectionStart, s.section])).toEqual([['z', false, undefined], ['new', true, 'S'], ['a', false, 'S']])
    expect(r.focus).toEqual(['a', 0])
  })

  it('on an empty point, moves it up a level, then makes it a slide', () => {
    const d = deckOf(slide('a', [text('<h2>T</h2><ul><li><p>one</p><ul><li><p></p></li></ul></li></ul>')]))
    const r1 = enter(d, lineOf(d, 'a:p1'), '', '')
    expect(kinds(r1.deck)).toEqual(['slide:T', 'point0:one', 'point0:'])
    const r2 = enter(r1.deck, lineOf(r1.deck, 'a:p1'), '', '')
    expect(kinds(r2.deck)).toEqual(['slide:T', 'point0:one', 'slide:'])
  })

  it('splits a speaker note', () => {
    const d = deckOf(slide('a', [], { notes: 'one two\nthree' }))
    expect(enter(d, lineOf(d, 'a:n0'), 'one', ' two').deck.slides[0].notes).toBe('one\n two\nthree')
  })
})

describe('Tab and Shift+Tab', () => {
  it('moves a point under the one above it and back, as a word processor does', () => {
    const d = deckOf(slide('a', [text('<h2>T</h2><ul><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ul>')]))
    const r = indent(d, lineOf(d, 'a:p1'))
    expect(r.deck.slides[0].elements[0].content).toBe('<h2>T</h2><ul><li><p>a</p><ul><li><p>b</p></li></ul></li><li><p>c</p></li></ul>')
    expect(indent(d, lineOf(d, 'a:p0')).refused).toMatch(/nothing above/)
    // Shifted back out, the points after it in its list come along under it
    const d2 = deckOf(slide('a', [text('<h2>T</h2><ul><li><p>a</p><ul><li><p>b</p></li><li><p>c</p></li></ul></li></ul>')]))
    expect(outdent(d2, lineOf(d2, 'a:p1')).deck.slides[0].elements[0].content).toBe('<h2>T</h2><ul><li><p>a</p></li><li><p>b</p><ul><li><p>c</p></li></ul></li></ul>')
  })

  it('makes a point a slide of its own, taking its sub-points and the points after it', () => {
    const d = deckOf(slide('a', [text('<h2>T</h2><ul><li><p>keep</p></li><li><p>New slide</p><ul><li><p>its sub</p></li></ul></li><li><p>after</p></li></ul>')], { notes: 'stays' }))
    const r = outdent(d, lineOf(d, 'a:p1'))
    expect(kinds(r.deck)).toEqual(['slide:T', 'point0:keep', 'note:stays', 'slide:New slide', 'point0:its sub', 'point0:after'])
    expect(r.focus).toEqual([r.deck.slides[1].id, 'start'])
  })

  it('folds a slide into the one above as a point, its points under it', () => {
    const d = deckOf(slide('a', [text('<h2>A</h2><ul><li><p>a1</p></li></ul>')]), slide('b', [text('<h2>B</h2><ul><li><p>b1</p></li></ul>')], { section: 'S', sectionStart: true }), slide('c', [], { section: 'S' }))
    const r = indent(d, lineOf(d, 'b'))
    expect(kinds(r.deck)).toEqual(['slide:A', 'point0:a1', 'point0:B', 'point1:b1', 'section:S', 'slide:'])
    expect(r.deck.slides[1]).toMatchObject({ id: 'c', sectionStart: true })
    expect(r.focus).toEqual(['a:p1', 'start'])
  })

  it('won’t fold a slide away with things the outline can’t hold, and says why', () => {
    const d = deckOf(slide('a', [text('<h2>A</h2>')]), slide('b', [text('<h2>B</h2>'), { id: 'g', type: 'graph' }], { notes: 'n' }))
    expect(indent(d, lineOf(d, 'b')).refused).toBe('Slide 2 has Graph and speaker notes, which would be lost as a point. Move them to another slide first.')
    expect(indent(d, lineOf(d, 'a')).refused).toMatch(/first slide/)
  })

  it('starts a section at a slide, and takes one away', () => {
    const d = deckOf(slide('a', [], { section: 'S' }), slide('b', [], { section: 'S' }), slide('c', [], { section: 'S' }))
    const r = outdent(d, lineOf(d, 'b'))
    expect(r.deck.slides.map(s => s.section)).toEqual(['S', 'New section', 'New section'])
    expect(r.focus).toEqual(['sec:b', 'all'])
    const back = indent(r.deck, lineOf(r.deck, 'sec:b'))
    expect(back.deck.slides.map(s => [s.section, !!s.sectionStart])).toEqual([['S', false], ['S', false], ['S', false]])
  })
})

describe('Backspace at the start of a line', () => {
  it('removes an empty point, its sub-points moving up', () => {
    const d = deckOf(slide('a', [text('<h2>T</h2><ul><li><p></p><ul><li><p>sub</p></li></ul></li><li><p>b</p></li></ul>')]))
    const r = backspace(d, lineOf(d, 'a:p0'), true, 'a')
    expect(r.deck.slides[0].elements[0].content).toBe('<h2>T</h2><ul><li><p>sub</p></li><li><p>b</p></li></ul>')
    expect(r.focus).toEqual(['a', 'end'])
  })

  it('joins a point to the one above, the cursor where they meet', () => {
    const d = deckOf(slide('a', [text('<h2>T</h2><ul><li><p>one</p></li><li><p><em>two</em></p></li></ul>')]))
    const r = backspace(d, lineOf(d, 'a:p1'), false, 'a:p0')
    expect(r.deck.slides[0].elements[0].content).toBe('<h2>T</h2><ul><li><p>one<em>two</em></p></li></ul>')
    expect(r.focus).toEqual(['a:p0', 3])
  })

  it('removes an empty slide, but keeps one with things on it', () => {
    const d = deckOf(slide('a', [text('<h2>A</h2>')]), slide('b', [text('<h2></h2>')], { section: 'S', sectionStart: true }), slide('c', [], { section: 'S' }))
    const r = backspace(d, lineOf(d, 'b'), true, 'a')
    expect(r.deck.slides.map(s => s.id)).toEqual(['a', 'c'])
    expect(r.deck.slides[1].sectionStart).toBe(true)
    const kept = deckOf(slide('a', []), slide('b', [text('<h2></h2><ul><li><p>x</p></li></ul>')]))
    expect(backspace(kept, lineOf(kept, 'b'), true, 'a').refused).toMatch(/still has things/)
  })

  it('removes an empty note line and an empty section break', () => {
    const d = deckOf(slide('a', [], { notes: 'one\n\nthree' }))
    expect(backspace(d, lineOf(d, 'a:n1'), true, 'a:n0').deck.slides[0].notes).toBe('one\nthree')
    const s = deckOf(slide('a', [], { section: 'A' }), slide('b', [], { sectionStart: true }))
    expect(backspace(s, lineOf(s, 'sec:b'), true, 'a').deck.slides.map(x => x.section || '')).toEqual(['A', 'A'])
  })
})

describe('a line’s inline HTML', () => {
  it('keeps marks, links, math and citations, and nothing that runs', () => {
    expect(cleanInline('<b>b</b> <a href="https://x.org" onclick="evil()">l</a> <a href="javascript:alert(1)">j</a> <img src=x onerror="evil()"><script>evil()</script><div>d</div><br>'))
      .toBe('<b>b</b> <a href="https://x.org">l</a> <a>j</a> d')
    const math = '<span data-math-latex="x^2" data-math-display="false" class="math-node math-inline"></span>'
    expect(cleanInline(math)).toBe(math)
  })

  it('shows math and citations as pieces, and writes them back as they were', () => {
    const html = 'v<sup data-cite="k" style="font-size:0.6em">1</sup> and <span data-math-latex="x^2" data-math-display="false" class="math-node math-inline"></span>'
    const el = document.createElement('div')
    el.innerHTML = atomize(html)
    expect(el.querySelectorAll('[contenteditable="false"]').length).toBe(2)
    // Drawn into (as KaTeX would) and typed around, it still writes back the same
    el.querySelector('[data-math-latex]').innerHTML = '<span class="katex">x²</span>'
    el.insertBefore(document.createTextNode('So '), el.firstChild)
    expect(lineHtml(el)).toBe(normalizeInline('So ' + html))
  })
})

describe('the cursor’s place beside math', () => {
  it('is never written back', async () => {
    const { CARET_SLOT } = await import('./outline')
    const el = document.createElement('div')
    el.innerHTML = atomize('a <span data-math-latex="x" class="math-node math-inline"></span>')
    el.appendChild(document.createTextNode(CARET_SLOT + 'b'))
    expect(lineHtml(el)).toBe('a <span data-math-latex="x" class="math-node math-inline"></span>b')
  })
})
