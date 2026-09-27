import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { CLOSED_SHAPES, shapeOutline, outlinePath, shapeParts, shapeSvgString } from './shapeGeometry'

const require = createRequire(import.meta.url)
const server = require('../../../server/services/shape-geometry.js')
const shape = (kind, extra = {}) => ({ id: 's', type: 'shape', shape: kind, width: 200, height: 100, strokeWidth: 4, fill: '#123456', ...extra })
const area = pts => pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1] }, 0)

describe('shape outlines', () => {
  it('give each closed shape the same number of points, from the top middle round clockwise', () => {
    for (const kind of CLOSED_SHAPES) {
      const pts = shapeOutline(shape(kind))
      expect(pts).toHaveLength(64)
      expect(pts[0][0]).toBeCloseTo(100, 5)
      expect(area(pts)).toBeGreaterThan(0) // clockwise with y down
    }
    expect(shapeOutline(shape('line'))).toBeNull()
    expect(shapeOutline(shape('rect'), 8)).toHaveLength(8)
  })

  it('space their points evenly', () => {
    const pts = shapeOutline(shape('rect', { strokeWidth: 0 }), 12)
    const steps = pts.map((p, i) => Math.hypot(pts[(i + 1) % 12][0] - p[0], pts[(i + 1) % 12][1] - p[1]))
    for (const s of steps) expect(s).toBeCloseTo(50, 0) // 600 around, 12 points
    expect(pts[0]).toEqual([100, 0])
    expect(pts[3]).toEqual([200, 50]) // the middle of the right side
  })

  it('follow rounded corners and circles', () => {
    const circle = shapeOutline(shape('circle', { width: 100, height: 100, strokeWidth: 0 }))
    for (const [x, y] of circle) expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(50, 0)
    const rounded = shapeOutline(shape('rect', { borderRadius: 30, strokeWidth: 0 }), 256)
    expect(rounded.some(([x, y]) => x < 1 && y < 1)).toBe(false) // no sharp corner
  })

  it('write a path', () => {
    expect(outlinePath([[0, 0], [1, 2.5]])).toBe('M0 0L1 2.5Z')
  })
})

describe('shape SVG', () => {
  it('draws the same parts for the canvas and pages', () => {
    expect(shapeParts(shape('circle'))).toEqual({ group: { fill: '#123456', stroke: 'none', 'stroke-width': 4, 'stroke-dasharray': undefined }, body: { tag: 'ellipse', attrs: { cx: 100, cy: 50, rx: 98, ry: 48 } } })
    expect(shapeParts(shape('line-arrow', { stroke: '#fff', strokeDasharray: 'dashed' })).lines.map(l => l.tag)).toEqual(['line', 'polyline'])
    expect(shapeParts(shape('rect', { borderRadius: 500 })).body.attrs.rx).toBe(48) // as far as SVG rounds it
  })

  it('writes attributes and labels as text', () => {
    const svg = shapeSvgString(shape('rect', { fill: '"/><script>x()</script>', text: '<b>Hi</b> & bye', width: '10" onload="x()' }))
    expect(svg).not.toMatch(/<script|<b>|onload="/)
    expect(svg).toContain('&lt;b&gt;Hi&lt;/b&gt; &amp; bye')
  })

  it('draws a morphing shape as a path in its own pixels, with its label in the middle', () => {
    const svg = shapeSvgString(shape('rect', { text: 'A' }), { d: 'M0 0Z', outlines: ':0,0|st:1,1' })
    expect(svg).toContain('<path d="M0 0Z" data-morph=":0,0|st:1,1" />')
    expect(svg).toContain('<text x="50%" y="50%"')
    expect(svg).not.toContain('viewBox')
  })

  it('is the same on the server', () => {
    for (const kind of [...CLOSED_SHAPES, 'line', 'line-arrow']) {
      const el = shape(kind, { text: 'x < y', stroke: '#fff', strokeDasharray: 'dotted', starCx: 90 })
      expect(server.shapeSvgString(el)).toBe(shapeSvgString(el))
    }
  })
})
