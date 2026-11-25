// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { describe, it, expect } from 'vitest'
import { cleanTextStyles, textSizes, headingEms, textStyleVars, bodySizeStyle, textStyleCss, withTextStyles, DEFAULT_SIZES } from './textStyles'
import { generateRevealHTML } from './generateHTML'

describe('text styles', () => {
  it('a deck without them has none, and the default sizes', () => {
    expect(cleanTextStyles(undefined)).toBe(null)
    expect(cleanTextStyles({})).toBe(null)
    expect(textSizes(null)).toEqual({ bodySize: 42, h1Size: 105, h2Size: 67.2, h3Size: 54.6 })
    expect(textStyleVars(null)).toEqual({})
    expect(bodySizeStyle(null)).toBe('')
    expect(textStyleCss(null, '.slide-page')).toBe('')
  })

  it('keeps only sizes in range, a font list, and a weight from the list', () => {
    expect(cleanTextStyles({ bodySize: 2, h1Size: 'big', h2Size: 54, h3Size: 999, headingFont: "Georgia; } body { color: red", headingWeight: 650 }))
      .toEqual({ h2Size: 54 })
    expect(cleanTextStyles({ headingFont: " 'Computer Modern Serif', serif ", headingWeight: '600' }))
      .toEqual({ headingFont: "'Computer Modern Serif', serif", headingWeight: 600 })
  })

  it('sizes headings in em of body text, so a heading keeps its size when only body text changes', () => {
    expect(headingEms(null)).toEqual({ h1: 2.5, h2: 1.6, h3: 1.3 })
    const em = headingEms({ bodySize: 28 })
    expect(em.h2 * 28).toBeCloseTo(67.2, 2)
    expect(headingEms({ bodySize: 30, h2Size: 60 }).h2).toBe(2)
  })

  it('gives the editor variables and pages rules', () => {
    expect(textStyleVars({ bodySize: 30, h2Size: 60, headingFont: 'Georgia, serif', headingWeight: 600 })).toEqual({
      '--ts-body': '30px', '--ts-h1': '3.5em', '--ts-h2': '2em', '--ts-h3': '1.82em',
      '--ts-heading-font': 'Georgia, serif', '--ts-heading-weight': '600',
    })
    expect(bodySizeStyle({ bodySize: 30 })).toBe('font-size:30px;')
    expect(bodySizeStyle({ h2Size: 60 })).toBe('')
    const css = textStyleCss({ h2Size: 84, headingFont: 'Georgia, serif' }, '.slide-page')
    expect(css).toContain('.slide-page h2 { font-size: 2em; }')
    expect(css).toContain('.slide-page :is(h1, h2, h3, h4, h5, h6) { font-family: Georgia, serif; }')
  })

  it('a change drops what is back at the default, and none are left at the defaults', () => {
    expect(withTextStyles(null, { h2Size: 54 })).toEqual({ h2Size: 54 })
    expect(withTextStyles({ h2Size: 54 }, { h2Size: null })).toBe(null)
    expect(withTextStyles({ h2Size: 54 }, { h2Size: DEFAULT_SIZES.h2Size })).toBe(null)
    expect(withTextStyles({ bodySize: 30 }, { headingWeight: 700 })).toEqual({ bodySize: 30 })
    expect(withTextStyles({ bodySize: 30 }, { headingFont: '' })).toEqual({ bodySize: 30 })
  })

  it('the presented deck sizes its text boxes and headings by them', () => {
    const deck = { title: 'T', slides: [{ id: 's', elements: [{ id: 'e', type: 'text', x: 0, y: 0, width: 400, height: 100, content: '<h2>Title</h2>' }] }] }
    const plain = generateRevealHTML(deck)
    expect(plain).not.toContain('.reveal .slides section h2 {')
    const styled = generateRevealHTML({ ...deck, textStyles: { bodySize: 30, h2Size: 60, headingFont: 'Georgia, serif' } })
    expect(styled).toContain('font-size:30px;line-height:')
    expect(styled).toContain('.reveal .slides section h2 { font-size: 2em; }')
    expect(styled).toContain('.reveal .slides section :is(h1, h2, h3, h4, h5, h6) { font-family: Georgia, serif; }')
  })
})
