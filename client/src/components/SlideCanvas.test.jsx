import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

if (!globalThis.window) globalThis.window = {}

import { ShapeRenderer } from './SlideCanvas'

const shape = (extra = {}) => ({ id: 's', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 50, ...extra })
const opacityOf = el => /opacity:([^;"]+)/.exec(renderToStaticMarkup(<ShapeRenderer element={el} />))?.[1]

describe('shapes on the canvas', () => {
  it('draw at their opacity, as presented decks do, including 0', () => {
    expect(opacityOf(shape({ opacity: 0.4 }))).toBe('0.4')
    expect(opacityOf(shape({ opacity: 0 }))).toBe('0')
    expect(opacityOf(shape())).toBe('1')
  })
})
