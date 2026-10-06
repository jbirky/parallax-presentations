// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  outlineLines, titleBox, notesOf, slideOrder, sectionStarts, timing,
  setNote, setSectionName, setMinutes, setTarget,
  enter, indent, outdent, backspace, cleanInline,
} from './outline'

let n = 0
const text = (content, extra = {}) => ({ id: 'e' + ++n, type: 'text', x: 60, y: 40, width: 840, height: 400, zIndex: 1, content, ...extra })
const slide = (id, elements, extra = {}) => ({ id, elements, notes: '', background: { type: 'color', color: '#1e1e2e' }, ...extra })
const deckOf = (...slides) => ({ title: 'Talk', slides })
const notes = (...xs) => xs.map(x => (typeof x === 'string' ? { text: x, level: 0 } : { text: x[0], level: x[1] }))
const kinds = d => outlineLines(d).map(L => L.kind + (L.kind === 'note' ? L.level : '') + ':' + (L.html ?? L.text ?? ''))
const lineOf = (d, key) => outlineLines(d).find(L => L.key === key)
const levels = s => (s.outlineNotes || []).map(x => x.text + ':' + x.level)

describe('reading a slide', () => {
  it('shows each slide’s title from the slide, and its outline notes, and nothing else on it', () => {
    const d = deckOf(slide('a', [
      text('<ul><li><p>Stars orbit fast</p></li></ul>', { y: 140, height: 340 }),
      text('<h2>Rotation curves</h2>', { y: 30, height: 80 }),
      { id: 'g', type: 'graph', x: 500, y: 140, width: 400, height: 300 },
    ], { notes: 'Point at the flat part', outlineNotes: notes('Open with the curve', ['21 cm data', 1]) }))
    expect(kinds(d)).toEqual(['slide:Rotation curves', 'note0:Open with the curve', 'note1:21 cm data'])
  })

  it('gives a slide with no notes an empty line for its first', () => {
    const d = deckOf(slide('a', [text('<p>Only text</p>')]))
    expect(kinds(d)).toEqual(['slide:', 'note0:'])
    expect(outlineLines(d)[1]).toMatchObject({ key: 'a:o0', n: 0, blank: true })
  })

  it('takes the title from the topmost heading box, or the box marked for it', () => {
    const top = text('<h2>Top</h2>', { y: 10 })
    expect(titleBox(slide('a', [text('<h2>Lower</h2>', { y: 300 }), top, text('<p>No heading</p>', { y: 0 })]))).toBe(top)
    const marked = text('<p>Chosen</p>', { y: 300, outline: 'title' })
    expect(titleBox(slide('a', [text('<h2>Guess</h2>', { y: 0 }), marked]))).toBe(marked)
  })

  it('keeps math and citations in a title’s HTML', () => {
    const math = '<span data-math-latex="v^2" data-math-display="false" class="math-node math-inline"></span>'
    const d = deckOf(slide('a', [text('<h2>Fit ' + math + '<sup data-cite="rubin80" style="font-size:0.6em">1</sup></h2>')]))
    expect(outlineLines(d)[0].html).toContain('data-math-latex="v^2"')
    expect(outlineLines(d)[0].html).toContain('data-cite="rubin80"')
  })

  it('reads notes however they were stored', () => {
    expect(notesOf({ outlineNotes: 'text' })).toEqual([])
    expect(notesOf({ outlineNotes: [null, { text: 'a\nb', level: 7 }, { level: -1 }, { text: 3 }] }))
      .toEqual([{ text: 'a b', level: 2 }, { text: '', level: 0 }, { text: '3', level: 0 }])
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
  it('writes a note, the first one into a slide’s empty line', () => {
    const d = deckOf(slide('a', [text('<h2>T</h2>')], { notes: 'Say hi' }))
    const d1 = setNote(d, 'a', 0, 'Open with\nthe curve')
    expect(d1.slides[0].outlineNotes).toEqual([{ text: 'Open with the curve', level: 0 }])
    expect(setNote(d1, 'a', 0, 'Open').slides[0].outlineNotes).toEqual([{ text: 'Open', level: 0 }])
  })

  it('writes section names (to the whole section), minutes and the talk’s length', () => {
    let d = deckOf(slide('a', []), slide('b', [], { section: 'Data' }), slide('c', [], { section: 'Data' }), slide('e', [], { section: 'Results' }))
    d = setSectionName(d, 'b', 'Methods')
    d = setMinutes(setMinutes(d, 'a', 1.25), 'b', null)
    expect(d.slides.map(s => [s.section, s.sectionStart, s.minutes])).toEqual([[undefined, undefined, 1.25], ['Methods', true, undefined], ['Methods', undefined, undefined], ['Results', undefined, undefined]])
    // Renamed to match the section above, it stays a section of its own
    d = setSectionName(d, 'e', 'Methods')
    expect([...sectionStarts(d.slides)]).toEqual([1, 3])
    expect(setTarget(d, '15').timerDuration).toBe(15)
  })
})

describe('Enter', () => {
  const base = () => deckOf(slide('a', [text('<h2>Title</h2>')], { section: 'S', column: 2, background: { type: 'color', color: '#123' }, outlineNotes: notes('first', ['sub', 1]) }), slide('z', []))

  it('on a title, adds a blank slide after it, in its column, section and background', () => {
    const r = enter(base(), lineOf(base(), 'a'))
    const s = r.deck.slides[1]
    expect(r.deck.slides.map(x => x.id)).toEqual(['a', s.id, 'z'])
    expect(s).toMatchObject({ elements: [], notes: '', column: 2, section: 'S', background: { type: 'color', color: '#123' } })
    expect(s.outlineNotes).toBeUndefined()
    expect(r.focus).toEqual([s.id + ':o0', 0])
  })

  it('splits a note at the cursor, the new one at its level', () => {
    const r = enter(base(), lineOf(base(), 'a:o1'), 's', 'ub')
    expect(levels(r.deck.slides[0])).toEqual(['first:0', 's:1', 'ub:1'])
    expect(r.focus).toEqual(['a:o2', 0])
  })

  it('on an empty sub-note moves it up a level, and on an empty last note makes a blank slide in its place', () => {
    const d = setNote(base(), 'a', 1, '')
    const up = enter(d, lineOf(d, 'a:o1'), '', '')
    expect(levels(up.deck.slides[0])).toEqual(['first:0', ':0'])
    const r = enter(up.deck, lineOf(up.deck, 'a:o1'), '', '')
    expect(levels(r.deck.slides[0])).toEqual(['first:0'])
    expect(r.deck.slides).toHaveLength(3)
    expect(r.focus).toEqual([r.deck.slides[1].id + ':o0', 0])
    // A slide's empty line too
    const z = enter(base(), lineOf(base(), 'z:o0'), '', '')
    expect(z.deck.slides.map(x => x.id).slice(0, 2)).toEqual(['a', 'z'])
    expect(z.deck.slides).toHaveLength(3)
  })

  it('on an empty note with notes after it, adds another', () => {
    const d = deckOf(slide('a', [], { outlineNotes: notes('', 'after') }))
    expect(levels(enter(d, lineOf(d, 'a:o0'), '', '').deck.slides[0])).toEqual([':0', ':0', 'after:0'])
  })
})

describe('Tab and Shift+Tab', () => {
  const d = deckOf(slide('a', [], { outlineNotes: notes('one', 'two', ['under two', 1], 'three') }))

  it('puts a note under the one above it, with its own, and back', () => {
    const r = indent(d, lineOf(d, 'a:o1'))
    expect(levels(r.deck.slides[0])).toEqual(['one:0', 'two:1', 'under two:2', 'three:0'])
    expect(r.focus).toBeUndefined()
    const back = outdent(r.deck, lineOf(r.deck, 'a:o1'))
    expect(levels(back.deck.slides[0])).toEqual(levels(d.slides[0]))
  })

  it('goes no deeper than one under the note above, nor past the deepest level', () => {
    expect(indent(d, lineOf(d, 'a:o0')).deck).toBe(d)
    expect(indent(d, lineOf(d, 'a:o2')).deck).toBe(d)
    const deep = deckOf(slide('a', [], { outlineNotes: notes('a', ['b', 1], ['c', 2], ['d', 2]) }))
    expect(indent(deep, lineOf(deep, 'a:o3')).deck).toBe(deep)
    expect(outdent(d, lineOf(d, 'a:o0')).deck).toBe(d)
  })

  it('leaves slides where they are', () => {
    const two = deckOf(slide('a', []), slide('b', [text('<h2>B</h2>')]))
    expect(indent(two, lineOf(two, 'b')).deck).toBe(two)
  })

  it('starts a section at a slide, and takes one away', () => {
    const s = deckOf(slide('a', [], { section: 'S' }), slide('b', [], { section: 'S' }), slide('c', [], { section: 'S' }))
    const r = outdent(s, lineOf(s, 'b'))
    expect(r.deck.slides.map(x => x.section)).toEqual(['S', 'New section', 'New section'])
    expect(r.focus).toEqual(['sec:b', 'all'])
    const back = indent(r.deck, lineOf(r.deck, 'sec:b'))
    expect(back.deck.slides.map(x => [x.section, !!x.sectionStart])).toEqual([['S', false], ['S', false], ['S', false]])
  })
})

describe('Backspace at the start of a line', () => {
  it('removes an empty note, and joins a note to the one above, the cursor where they meet', () => {
    const d = deckOf(slide('a', [], { outlineNotes: notes('one', '', 'two') }))
    const r = backspace(d, lineOf(d, 'a:o1'), true, 'a:o0')
    expect(levels(r.deck.slides[0])).toEqual(['one:0', 'two:0'])
    expect(r.focus).toEqual(['a:o0', 'end'])
    const j = backspace(r.deck, lineOf(r.deck, 'a:o1'), false, 'a:o0')
    expect(levels(j.deck.slides[0])).toEqual(['onetwo:0'])
    expect(j.focus).toEqual(['a:o0', 3])
    // The last one going takes the field with it
    const one = deckOf(slide('a', [], { outlineNotes: notes('') }))
    expect('outlineNotes' in backspace(one, lineOf(one, 'a:o0'), true, 'a').deck.slides[0]).toBe(false)
  })

  it('brings a sub-note up a level, and leaves a note with notes under it', () => {
    const d = deckOf(slide('a', [], { outlineNotes: notes('one', 'two', ['under', 1]) }))
    expect(levels(backspace(d, lineOf(d, 'a:o2'), false, 'a:o1').deck.slides[0])).toEqual(['one:0', 'two:0', 'under:0'])
    expect(backspace(d, lineOf(d, 'a:o1'), false, 'a:o0')).toBeNull()
    expect(backspace(d, lineOf(d, 'a:o0'), false, 'a')).toBeNull()
  })

  it('removes a blank slide, from its title or its empty line, but keeps one with anything on it', () => {
    const d = deckOf(slide('a', [text('<h2>A</h2>')], { outlineNotes: notes('x') }), slide('b', [], { section: 'S', sectionStart: true }), slide('c', [], { section: 'S' }))
    for (const key of ['b', 'b:o0']) {
      const r = backspace(d, lineOf(d, key), true, null)
      expect(r.deck.slides.map(s => s.id)).toEqual(['a', 'c'])
      expect(r.deck.slides[1].sectionStart).toBe(true)
      expect(r.focus).toEqual(['a:o0', 'end'])
    }
    expect(backspace(d, lineOf(d, 'a'), true, null).refused).toMatch(/has things on it/)
    const spoken = deckOf(slide('a', []), slide('b', [], { notes: 'Say this' }))
    expect(backspace(spoken, lineOf(spoken, 'b'), true, null).refused).toMatch(/has things on it/)
    expect(backspace(spoken, lineOf(spoken, 'b:o0'), true, null)).toBeNull()
    expect(backspace(deckOf(slide('a', [])), lineOf(deckOf(slide('a', [])), 'a'), true, null).refused).toMatch(/at least one/)
  })

  it('removes an empty section break', () => {
    const s = deckOf(slide('a', [], { section: 'A' }), slide('b', [], { sectionStart: true }))
    expect(backspace(s, lineOf(s, 'sec:b'), true, 'a').deck.slides.map(x => x.section || '')).toEqual(['A', 'A'])
  })
})

describe('the slides’ content', () => {
  it('never changes, whatever is done in the outline', () => {
    const d = { ...deckOf(
      slide('a', [text('<h2>Rotation curves</h2><ul><li><p>Flat</p></li></ul>'), { id: 'g', type: 'graph', x: 0, y: 0, width: 10, height: 10 }], { notes: 'Say hello', section: 'Intro' }),
      slide('b', [text('<h2>The sample</h2>')], { outlineNotes: notes('one', ['two', 1]) }),
    ), timerDuration: 10 }
    const before = d.slides.map(s => [s.id, s.elements, s.notes])
    let x = d
    const run = (op, key, ...args) => { const L = lineOf(x, key); const r = op(x, L, ...args); if (r && r.deck) x = r.deck }
    x = setNote(x, 'a', 0, 'Open with the curve')
    run(enter, 'a:o0', 'Open with', ' the curve')
    run(indent, 'a:o1')
    run(indent, 'a')
    run(outdent, 'b')
    run(indent, 'b:o1')
    run(backspace, 'b:o1', false, 'b:o0')
    run(enter, 'b')
    x = setSectionName(setMinutes(setTarget(x, 20), 'a', 2), 'a', 'Opening')
    for (const [id, elements, spoken] of before) {
      const s = x.slides.find(y => y.id === id)
      expect(s.elements).toBe(elements)
      expect(s.notes).toBe(spoken)
    }
    expect(x.slides).toHaveLength(3)
    expect(x.slides[2].elements).toEqual([])
  })
})

describe('a title’s inline HTML', () => {
  it('keeps marks, links, math and citations, and nothing that runs', () => {
    expect(cleanInline('<b>b</b> <a href="https://x.org" onclick="evil()">l</a> <a href="javascript:alert(1)">j</a> <img src=x onerror="evil()"><script>evil()</script><div>d</div><br>'))
      .toBe('<b>b</b> <a href="https://x.org">l</a> <a>j</a> d')
    const math = '<span data-math-latex="x^2" data-math-display="false" class="math-node math-inline"></span>'
    expect(cleanInline(math)).toBe(math)
  })
})
