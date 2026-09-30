import { describe, it, expect } from 'vitest'
import { TEXT3D_DEFAULTS, TEXT3D_PRESETS, TEXT3D_LIMITS, text3dHtml, text3dLayers, text3dExtrusion, text3dShadowFilter, text3dTilt, darken } from './text3d'

const el = (extra = {}) => ({ id: 't', type: 'text3d', x: 0, y: 0, width: 600, height: 200, ...TEXT3D_DEFAULTS, ...extra })

describe('3D text layers', () => {
  it('stack one copy per pixel of depth, back to front, ending just behind the face', () => {
    const layers = text3dLayers(el({ depth: 24 }))
    expect(layers).toHaveLength(24)
    expect(layers[0].z).toBe(-24)
    expect(layers[23].z).toBe(-1)
    expect(layers.every((l, i) => i === 0 || l.z > layers[i - 1].z)).toBe(true)
  })

  it('space out the copies of deep text rather than add more', () => {
    const layers = text3dLayers(el({ depth: 150 }))
    expect(layers).toHaveLength(60)
    expect(layers[0].z).toBe(-150)
    expect(layers[59].z).toBe(-2.5)
  })

  it('darken from the side color just behind the face to the darkest at the back', () => {
    const layers = text3dLayers(el({ depth: 10, sideColor: '#ff8000', sideShade: 0.5 }))
    expect(layers[9].color).toBe('#ff8000')
    expect(layers[0].color).toBe('#804000')
    expect(text3dLayers(el({ depth: 10, sideColor: '#ff8000', sideShade: 0 })).every(l => l.color === '#ff8000')).toBe(true)
  })

  it('leave flat text with no depth', () => {
    expect(text3dLayers(el({ depth: 0 }))).toEqual([])
    expect(text3dHtml(el({ depth: 0 }))).not.toContain('translateZ')
  })
})

describe('3D text markup', () => {
  it('puts the face in front of its copies, under the perspective and the turn', () => {
    const html = text3dHtml(el({ content: 'Hi', depth: 3, rotateX: 10, rotateY: -20, perspective: 800 }))
    expect(html).toContain('perspective:800px')
    expect(html).toContain('transform-style:preserve-3d;transform:rotateX(10deg) rotateY(-20deg)')
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(3)
    expect(html).toMatch(/translateZ\(-1px\)">Hi<\/div><div style="position:relative;color:#ffffff">Hi<\/div>/)
  })

  it('uses the deck font when the element has none of its own', () => {
    expect(text3dHtml(el({ fontFamily: null }), { fontFamily: "'Inter', sans-serif" })).toContain("font-family:'Inter', sans-serif;")
    expect(text3dHtml(el({ fontFamily: 'Georgia, serif' }), { fontFamily: 'Inter' })).toContain('font-family:Georgia, serif;')
    expect(text3dHtml(el({ fontFamily: null }))).toContain('font-family:sans-serif;')
  })

  it('lines the text up with the side of the box it is aligned to', () => {
    expect(text3dHtml(el({ textAlign: 'left' }))).toContain('justify-content:flex-start')
    expect(text3dHtml(el({ textAlign: 'right' }))).toContain('text-align:right')
    expect(text3dHtml(el({ textAlign: 'sideways' }))).toContain('justify-content:center')
  })

  it("escapes the text and can't be broken out of by a collaborator's settings", () => {
    const html = text3dHtml(el({
      content: '<img src=x onerror=alert(1)>&',
      color: 'red;background:url(x)', sideColor: '#12"><script>', fontFamily: 'x"><script>alert(1)</script>',
      fontWeight: '800;position:fixed', fontStyle: 'evil', depth: '1e9', rotateX: 'NaN', perspective: -5,
    }))
    expect(html).not.toMatch(/<img|<script/)
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;&amp;')
    expect(html).toContain('color:#ffffff">')
    expect(html).toContain('font-weight:800;font-style:normal;')
    expect(html).toContain(`rotateX(${TEXT3D_DEFAULTS.rotateX}deg)`)
    expect(html).toContain('perspective:150px')
    expect(html.match(/aria-hidden/g)).toHaveLength(60)
    expect(html).not.toMatch(/style="[^"]*"[^ >]/)
  })
})

describe('3D text extrusion', () => {
  it('shows to the right when the text turns left, and below when it leans back', () => {
    const left = text3dExtrusion(el({ depth: 20, rotateX: 0, rotateY: -30 }))
    expect(left.dx).toBeCloseTo(10, 5)
    expect(left.dy).toBeCloseTo(0, 5)
    const back = text3dExtrusion(el({ depth: 20, rotateX: 30, rotateY: 0 }))
    expect(back.dx).toBeCloseTo(0, 5)
    expect(back.dy).toBeCloseTo(10, 5)
    expect(text3dExtrusion(el({ rotateX: 0, rotateY: 0 }))).toEqual({ dx: 0, dy: 0 })
  })

  it('has presets that change only its angle, so flat text stays flat', () => {
    for (const p of TEXT3D_PRESETS) expect(Object.keys(p).sort()).toEqual(['id', 'label', 'perspective', 'rotateX', 'rotateY'])
  })
})

describe('new 3D text', () => {
  it('is flat, on a tilted plane', () => {
    expect(TEXT3D_DEFAULTS.depth).toBe(0)
    expect(TEXT3D_DEFAULTS.rotateX).not.toBe(0)
    expect(TEXT3D_DEFAULTS.rotateY).not.toBe(0)
    const html = text3dHtml(el({ content: 'Flat' }))
    expect(html).not.toContain('aria-hidden')
    expect(html).toContain(`rotateX(${TEXT3D_DEFAULTS.rotateX}deg) rotateY(${TEXT3D_DEFAULTS.rotateY}deg)`)
  })
})

describe('dragging to tilt', () => {
  it('turns the text the way the pointer goes', () => {
    expect(text3dTilt({ rotateX: 0, rotateY: 0 }, 50, 0)).toEqual({ rotateX: 0, rotateY: 20 })
    expect(text3dTilt({ rotateX: 0, rotateY: 0 }, -50, 0)).toEqual({ rotateX: 0, rotateY: -20 })
    // Down brings the top toward you: a negative lean
    expect(text3dTilt({ rotateX: 10, rotateY: 5 }, 0, 25)).toEqual({ rotateX: 0, rotateY: 5 })
    expect(text3dTilt({ rotateX: 10, rotateY: 5 }, 0, -25)).toEqual({ rotateX: 20, rotateY: 5 })
  })

  it('stops at the limits, in whole degrees, from the defaults when unset', () => {
    expect(text3dTilt({ rotateX: 0, rotateY: 0 }, 5000, -5000)).toEqual({ rotateX: TEXT3D_LIMITS.rotateX[1], rotateY: TEXT3D_LIMITS.rotateY[1] })
    expect(text3dTilt({ rotateX: 0, rotateY: 0 }, 3, 1)).toEqual({ rotateX: 0, rotateY: 1 })
    expect(text3dTilt({}, 0, 0)).toEqual({ rotateX: TEXT3D_DEFAULTS.rotateX, rotateY: TEXT3D_DEFAULTS.rotateY })
    expect(text3dTilt({ rotateX: null, rotateY: 'x' }, 0, 0)).toEqual({ rotateX: TEXT3D_DEFAULTS.rotateX, rotateY: TEXT3D_DEFAULTS.rotateY })
  })
})

describe('3D text shadow', () => {
  it('follows the letters rather than the box', () => {
    expect(text3dShadowFilter(el())).toBe('')
    expect(text3dShadowFilter(el({ shadowX: 4, shadowY: 6, shadowBlur: 8, shadowColor: '#000000' }))).toBe('drop-shadow(4px 6px 8px #000000)')
    expect(text3dShadowFilter(el({ shadowY: 2 }))).toBe('drop-shadow(0px 2px 0px rgba(0,0,0,0.5))')
  })
})

describe('darken', () => {
  it('scales each channel toward black', () => {
    expect(darken('#ffffff', 0.5)).toBe('#808080')
    expect(darken('#abc', 0)).toBe('#aabbcc')
    expect(darken('#123456', 1)).toBe('#000000')
  })
})
