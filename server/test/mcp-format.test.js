// How an AI collaborator link's get_slide describes a slide (mcp/format.js):
// what clicking or hovering does, which elements start hidden, and warnings
// that leave out a tab's panels. Needs no database.

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const format = require('../mcp/format')

const text = (id, html, extra) => ({ id, type: 'text', x: 100, y: 180, width: 700, height: 300, content: html, ...extra })
const tab = (id, label, show, hide) => ({
  id, type: 'shape', shape: 'rect', x: 80, y: 110, width: 200, height: 44, text: label, fontSize: 18,
  clickAction: { type: 'visibility', show, hide },
})

function detail(slides, n = 1) {
  const deck = { title: 'Test', slides }
  return format.slideDetail(deck, format.findSlide(deck, n))
}

describe("get_slide's description of a slide", () => {
  it('says what tabs show and hide, and leaves their panels out of the overlap warnings', () => {
    const out = detail([{
      id: 's1',
      elements: [
        tab('t1', 'One', ['p1'], ['p2']),
        tab('t2', 'Two', ['p2'], ['p1']),
        text('p1', '<p>First panel</p>'),
        text('p2', '<p>Second panel</p>', { startHidden: true }),
      ],
    }])
    assert.match(out, /1\. \*\*shape\*\* `t1` .* · click: shows element 3; hides element 4/)
    assert.match(out, /2\. \*\*shape\*\* `t2` .* · click: shows element 4; hides element 3/)
    assert.match(out, /4\. \*\*text\*\* `p2` .* · starts hidden/)
    assert.doesNotMatch(out, /overlap/)
    assert.doesNotMatch(out, /clickAction/)
  })

  it('still warns about text boxes that can show together', () => {
    const out = detail([{
      id: 's1',
      elements: [
        text('a', '<p>Always here</p>'),
        text('b', '<p>Revealed</p>', { startHidden: true }),
        { id: 'btn', type: 'shape', x: 0, y: 0, width: 50, height: 50, clickAction: { type: 'visibility', show: ['b'] } },
      ],
    }])
    assert.match(out, /Text boxes `a` and `b` overlap/)
  })

  it('describes slide links, states and hovers', () => {
    const out = detail([
      {
        id: 's1',
        elements: [
          { id: 'go', type: 'shape', x: 0, y: 0, width: 50, height: 50, clickAction: { type: 'slide', slideId: 's2' } },
          {
            id: 'card', type: 'shape', x: 60, y: 0, width: 50, height: 50,
            states: [{ id: 'st1', name: 'Flipped' }], initialState: 'st1',
            hoverAction: { type: 'visibility', show: ['go'] },
          },
          { id: 'flip', type: 'shape', x: 120, y: 0, width: 50, height: 50, clickAction: { type: 'visibility', set: [{ id: 'card', state: 'st1', mode: 'toggle' }] } },
        ],
      },
      { id: 's2', elements: [] },
    ])
    assert.match(out, /`go` .* · click: goes to slide 2/)
    assert.match(out, /`card` .* · hover: shows element 1, until the pointer leaves · 1 state: "Flipped" · starts in state "Flipped"/)
    assert.match(out, /`flip` .* · click: switches element 2 between state "Flipped" and its default look/)
  })

  it('says an empty placeholder is hidden when presenting, without a stray bullet', () => {
    const out = detail([{ id: 's1', elements: [text('body', '<ul><li><p></p></li></ul>', { placeholder: 'body' })] }])
    assert.match(out, /body placeholder, empty \(hidden when presenting\)/)
    assert.doesNotMatch(out, /^\s+-\s*$/m)
  })

  it("leaves out a textless shape's text styling", () => {
    const out = detail([{ id: 's1', elements: [{ id: 'bar', type: 'shape', shape: 'rect', x: 0, y: 0, width: 10, height: 4, fill: '#6366f1', stroke: 'none', strokeWidth: 0, fontSize: 18, textColor: '#fff' }] }])
    assert.match(out, /fill: "#6366f1"/)
    assert.doesNotMatch(out, /fontSize|textColor|strokeWidth/)
  })
})
