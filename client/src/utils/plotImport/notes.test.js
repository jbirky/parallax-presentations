// @vitest-environment node
// Annotations on a kept figure (notes.js): pinned to points in its data
// through its panels' axes, made of the slide's own elements in its group,
// read back from them when it's opened again, kept as the slide has them
// unless they're changed
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { Window } from 'happy-dom'
import { readSvgDrawing } from './svgReader'
import { plotFromDrawing } from './plotModel'
import { readFigure } from './toFigure'
import { toPage, toData, axesFor, placeOf, snapTo, pageOf, pointOf, noteElements, notesOnFigure, readNotes, arrowEnds } from './notes'

const { DOMParser } = new Window()
const read = name => plotFromDrawing(readSvgDrawing(readFileSync(new URL(`./fixtures/${name}.svg`, import.meta.url), 'utf8'), DOMParser))
const box = { x: 200, y: 80, width: 560, height: 373 }
let n = 0
const newId = () => `e${n++}`
// Where a line arrow's head is, on the slide
const tipOf = a => {
  const t = (a.rotation || 0) * Math.PI / 180
  return [a.x + a.width / 2 + Math.cos(t) * (a.width / 2 - a.strokeWidth), a.y + a.height / 2 + Math.sin(t) * (a.width / 2 - a.strokeWidth)]
}

describe('annotations on a kept figure', () => {
  it('goes between the data and the figure through a panel’s axes, log ones too', () => {
    const plot = read('decay')
    const axes = axesFor(plot, null)
    for (const at of [[0, 0], [3.2, 0.71], [10, 2]]) {
      const back = toData(axes, toPage(axes, at))
      expect(back[0]).toBeCloseTo(at[0], 9); expect(back[1]).toBeCloseTo(at[1], 9)
    }
    const log = read('loglog')
    const la = axesFor(log, null)
    expect(la.x.scale).toBe('log')
    const [px] = toPage(la, [10, 100]), [p10] = toPage(la, [100, 100]), [p100] = toPage(la, [1000, 100])
    expect(p10 - px).toBeCloseTo(p100 - p10, 6)
    expect(toData(la, toPage(la, [37, 420]))[0]).toBeCloseTo(37, 6)
  })

  it('finds the panel a point is over, an inset before its parent, and the data point nearest it', () => {
    const inset = read('inset')
    const [outer, inner] = inset.panels
    const mid = b => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]
    expect(placeOf(inset, mid(inner.box)).panel).toBe(inner.id)
    expect(placeOf(inset, [outer.box.x0 + 5, outer.box.y0 + 5]).panel).toBe(outer.id)
    const plot = read('decay')
    const measured = plot.layers.find(l => l.name === 'measured')
    const axes = axesFor(plot, null)
    const [px, py] = toPage(axes, [measured.data.x[4], measured.data.y[4]])
    const near = snapTo(plot, null, axes, [px + 1.5, py - 1], 6)
    expect(near.layer.id).toBe(measured.id)
    expect(near.at).toEqual([measured.data.x[4], measured.data.y[4]])
    expect(snapTo(plot, null, axes, [px + 40, py + 40], 6)).toBeNull()
  })

  it('makes a callout of a text box and an arrow to its point, a ring round a point, a box over a stretch', () => {
    const plot = read('decay')
    const meta = { id: 'fig', src: '/u/decay.svg', file: 'decay.svg' }
    const arrow = { id: 'a', kind: 'arrow', panel: null, at: [1.5, 1.2], text: 'steep start', step: 3, until: 0 }
    const els = noteElements(plot, arrow, { box, groupId: 'g', meta, z: 20, newId })
    expect(els.map(e => [e.type, e.shape || null, e.figure.role])).toEqual([['text', null, 'text'], ['shape', 'line-arrow', 'arrow']])
    for (const e of els) {
      expect(e).toMatchObject({ groupId: 'g', initialState: 'hidden', stateSteps: { 3: null }, figure: { id: 'fig', src: '/u/decay.svg', part: 'note', note: arrow } })
    }
    expect(els.map(e => e.zIndex)).toEqual([20, 21])
    expect(els[0].content).toContain('>steep start</span>')
    // The arrow's head just short of its point
    const at = pointOf(plot, arrow, box)
    const gap = Math.hypot(tipOf(els[1])[0] - at[0], tipOf(els[1])[1] - at[1])
    expect(gap).toBeGreaterThan(1); expect(gap).toBeLessThan(5)
    // A ring round its point; on a dark slide, white
    const ring = noteElements(plot, { id: 'r', kind: 'ring', panel: null, at: [6, 0.3], text: '', step: 0, until: 0 }, { box, groupId: 'g', newId, dark: true })
    expect(ring).toHaveLength(1)
    const rp = pointOf(plot, { kind: 'ring', at: [6, 0.3], panel: null }, box)
    expect(ring[0].x + ring[0].width / 2).toBeCloseTo(rp[0], 0); expect(ring[0].y + ring[0].height / 2).toBeCloseTo(rp[1], 0)
    expect(ring[0]).toMatchObject({ shape: 'circle', fill: 'none', stroke: '#ffffff' })
    expect(ring[0].states).toBeUndefined()
    // A box from one corner to the other, its words over it
    const span = { id: 'b', kind: 'box', panel: null, at: [6, 0.1], to: [8.5, 0.9], text: 'the tail', step: 5, until: 6 }
    const [rect, words] = noteElements(plot, span, { box, groupId: 'g', newId })
    const c0 = pointOf(plot, { ...span, at: [6, 0.9] }, box), c1 = pointOf(plot, { ...span, at: [8.5, 0.1] }, box)
    expect([rect.x, rect.y, rect.x + rect.width, rect.y + rect.height]).toEqual([c0[0], c0[1], c1[0], c1[1]].map(Math.round))
    expect(words.y + words.height).toBeLessThanOrEqual(rect.y + 2)
    expect(rect.stateSteps).toEqual({ 5: null, 6: 'hidden' })
  })

  it('reads a figure’s annotations back as the slide has them, and keeps them so unless they’re changed', () => {
    const plot = read('decay')
    const note = { id: 'a', kind: 'arrow', panel: null, at: [1.5, 1.2], text: 'steep start', step: 3, until: 0 }
    const ring = { id: 'r', kind: 'ring', panel: null, at: [6, 0.3], text: '', step: 4, until: 0 }
    const els = [...noteElements(plot, note, { box, groupId: 'g', newId }), ...noteElements(plot, ring, { box, groupId: 'g', newId })]
    // On the slide: the words moved and restyled, the ring recolored
    const text = els.find(e => e.figure.role === 'text'), circle = els.find(e => e.figure.role === 'ring')
    const moved = [{ ...text, x: text.x - 20, y: text.y - 30, content: text.content.replace('color: #000000', 'color: #dc2626') }, els.find(e => e.figure.role === 'arrow'), { ...circle, stroke: '#2563eb' }]
    const back = readNotes(moved, plot, box)
    expect(back.map(b => b.note.text)).toEqual(['steep start', ''])
    const [dx, dy] = back[0].note.offset
    expect(dx * box.width).toBeCloseTo((text.x - 20 + text.width / 2) - pointOf(plot, note, box)[0], 6)
    expect(dy * box.height).toBeCloseTo((text.y - 30 + text.height / 2) - pointOf(plot, note, box)[1], 6)
    // Kept: their own looks, the arrow from where the words are now, new steps
    const read2 = new Map(back.map(b => [b.note.id, b]))
    const kept = notesOnFigure(plot, back.map(b => ({ ...b.note, step: b.note.id === 'r' ? 2 : b.note.step })), { box, groupId: 'g', z: 30, read: read2, newId })
    expect(new Set(kept.map(e => e.id))).toEqual(new Set(moved.map(e => e.id)))
    const keptText = kept.find(e => e.figure.role === 'text')
    expect(keptText).toMatchObject({ x: text.x - 20, y: text.y - 30 })
    expect(keptText.content).toContain('#dc2626')
    expect(kept.find(e => e.figure.role === 'ring')).toMatchObject({ stroke: '#2563eb', stateSteps: { 2: null } })
    const newArrow = kept.find(e => e.figure.role === 'arrow')
    expect(newArrow.id).toBe(moved[1].id)
    const at = pointOf(plot, note, box)
    expect(Math.hypot(tipOf(newArrow)[0] - at[0], tipOf(newArrow)[1] - at[1])).toBeLessThan(5)
    expect(newArrow.rotation).not.toBe(moved[1].rotation)
    // Changed words: made afresh, the same ids
    const changed = notesOnFigure(plot, [{ ...back[0].note, text: 'fast at first' }], { box, groupId: 'g', read: read2, newId })
    expect(changed.find(e => e.figure.role === 'text')).toMatchObject({ id: text.id })
    expect(changed.find(e => e.figure.role === 'text').content).toContain('fast at first')
    expect(changed.find(e => e.figure.role === 'text').content).not.toContain('#dc2626')
    // A figure's own reading leaves them to readNotes, but replaces them
    const fig = readFigure([{ id: 'p', type: 'image', x: 200, y: 80, width: 560, height: 373, figure: { id: 'f', part: 'base', run: 0, plan: 'base:1' } }, ...moved.map(e => ({ ...e, figure: { ...e.figure, id: 'f' } }))], plot)
    expect([...fig.reuse.keys()]).toEqual(['base:0'])
    expect(fig.ids).toEqual(['p', ...moved.map(e => e.id)])
    // (no words in the way of a point: no arrow)
    expect(arrowEnds({ x: 0, y: 0, width: 100, height: 40 }, [50, 20])).toBeNull()
    expect(pageOf(plot, { at: [0.5, 0.5], frac: true })).toEqual([216, 144])
  })
})
