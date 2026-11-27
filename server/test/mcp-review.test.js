// check_deck's review (server/mcp/review.js): what it finds on slides and in
// the deck, without drawing them

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { checkDeck, citedKeys } = require('../mcp/review')

const text = (id, content, more = {}) => ({ id, type: 'text', x: 60, y: 140, width: 840, height: 300, zIndex: 2, content, ...more })
const title = (words, id = 't') => text(id, `<h2>${words}</h2>`, { y: 30, height: 90, placeholder: 'title' })
const slide = (id, elements, more = {}) => ({ id, layout: 'title-content', elements, notes: 'Say it.', ...more })

describe('check_deck', () => {
  it('finds nothing wrong with a tidy deck, and says it did not look', () => {
    const deck = { title: 'Tidy', slides: [slide('a', [title('Hello')], { layout: 'title', notes: '' }), slide('b', [title('A claim'), text('b1', '<ul><li><p>One point</p></li></ul>')])] }
    assert.match(checkDeck(deck), /^No problems found on 2 slides\. These checks don't look at the slides: render_deck shows how they look\.$/)
    assert.equal(checkDeck({ slides: [] }), 'The presentation has no slides yet.')
  })

  it('finds problems on slides', () => {
    const many = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')
    const deck = {
      slides: [
        slide('s1', [title('Fine')], { layout: 'title', notes: '' }),
        slide('s2', [text('body', `<p>${many}</p>`)]),
        slide('s3', [title('Small'), text('tiny', '<p><span style="font-size: 11px">fine print</span></p>'), { id: 'img', type: 'image', x: 0, y: 0, width: 100, height: 100, src: '/uploads/a.png' }]),
        slide('s4', [title('Cited'), text('c', '<p>As shown<sup data-cite="smith2020, jones2021">[1]</sup></p>'), text('off', '<p>Off</p>', { x: 900, width: 200 })]),
      ],
      bibliography: [{ key: 'smith2020' }],
    }
    const out = checkDeck(deck)
    assert.match(out, /^\d+ problems found on 4 slides/)
    assert.match(out, /## Slide 2\n- It has no title/)
    assert.match(out, /- 80 words: more than people read while listening/)
    assert.match(out, /## Slide 3: Small\n- `tiny` has text set at 11 px, too small to read/)
    assert.match(out, /- Image `img` has no alt text\./)
    assert.match(out, /## Slide 4: Cited\n[\s\S]*runs past the slide's right edge by 140 px/)
    assert.match(out, /It cites \[@jones2021\], which the bibliography doesn't have/)
    assert.doesNotMatch(out, /smith2020/)
  })

  it('checks speaker notes and minutes across the deck', () => {
    const deck = {
      talkMinutes: 15,
      slides: [
        slide('a', [title('Open')], { layout: 'title', notes: '', minutes: 1 }),
        slide('b', [title('One')], { notes: '', minutes: 2 }),
        slide('c', [title('Two')], { notes: '', minutes: 2 }),
        slide('d', [title('Part two')], { layout: 'section-header', notes: '' }),
        slide('e', [title('Three')], { minutes: 3 }),
      ],
    }
    const out = checkDeck(deck)
    assert.match(out, /## The whole deck\n- No speaker notes on 2 slides: 2, 3\./)
    assert.match(out, /- The slides' minutes add up to 8, against a 15-minute talk: there is room to spare\./)
    assert.match(out, /- No minutes on 1 slide: 4\./)
    const none = checkDeck({ talkMinutes: 10, slides: [slide('a', [title('X')])] })
    assert.match(none, /no slide has minutes: set them with update_outline/)
  })

  it('reads the keys a text box cites', () => {
    assert.deepEqual(citedKeys('<sup data-cite="a2020">[1]</sup> and <sup data-cite="b, c;d">[2]</sup>'), ['a2020', 'b', 'c', 'd'])
  })
})
