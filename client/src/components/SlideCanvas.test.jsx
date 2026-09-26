import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'

if (!globalThis.window) globalThis.window = {}

import { ShapeRenderer, CanvasElement } from './SlideCanvas'

const shape = (extra = {}) => ({ id: 's', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 50, ...extra })
const opacityOf = el => /opacity:([^;"]+)/.exec(renderToStaticMarkup(<ShapeRenderer element={el} />))?.[1]

describe('shapes on the canvas', () => {
  it('draw at their opacity, as presented decks do, including 0', () => {
    expect(opacityOf(shape({ opacity: 0.4 }))).toBe('0.4')
    expect(opacityOf(shape({ opacity: 0 }))).toBe('0')
    expect(opacityOf(shape())).toBe('1')
  })
})

describe('elements on the canvas', () => {
  // The element's box, the box its content is clipped to, and what's drawn around it
  function render(element, props = {}) {
    const win = new Window()
    win.document.body.innerHTML = renderToStaticMarkup(<CanvasElement element={element} onPointerDown={() => {}} {...props} />)
    const box = win.document.querySelector('[data-element-id]')
    const [clip, ...around] = box.children
    return { box, clip, around: around.map(el => el.textContent || el.style.cursor) }
  }

  it('draw badges and handles outside the box, where the content is clipped', () => {
    const { box, clip, around } = render(shape({
      clickAction: { type: 'next' }, hoverAction: { type: 'visibility', show: ['t'] }, fragment: true, fragmentIndex: 1, groupId: 'g', startHidden: true,
    }), { isSelected: true })
    expect(box.style.overflow).toBe('')
    expect(clip.style.overflow).toBe('hidden')
    expect(clip.querySelector('svg')).toBeTruthy()
    expect(around).toEqual(expect.arrayContaining(['▶ 1', '→ Next · ◑ Hover', 'Hidden', 'Group', 'nw-resize', 'se-resize', 'grab']))
  })

  it('clip content to its box, unless something is meant to hang outside it', () => {
    const image = extra => ({ id: 'i', type: 'image', x: 0, y: 0, width: 100, height: 60, src: 'a.png', ...extra })
    expect(render(image()).clip.style.overflow).toBe('hidden')
    expect(render(image({ citationText: 'Smith 2020' })).clip.style.overflow).toBe('visible') // its caption
  })
})
