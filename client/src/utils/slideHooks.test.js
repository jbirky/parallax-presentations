import { describe, it, expect } from 'vitest'
import { slideLayoutAttr, placeholderAttr, ownBackgroundAttr, footerSectionState } from './slideHooks'

describe('the hooks themes target', () => {
  it('names a slide’s layout and a text box’s placeholder, when they are names', () => {
    expect(slideLayoutAttr({ layout: 'title' })).toBe(' data-layout="title"')
    expect(slideLayoutAttr({ layout: 'x"y' })).toBe('')
    expect(placeholderAttr({ type: 'text', placeholder: 'body' })).toBe(' data-placeholder="body"')
    expect(placeholderAttr({ type: 'shape', placeholder: 'body' })).toBe('')
  })

  it('marks a slide with a background of its own', () => {
    expect(ownBackgroundAttr({ own: true })).toBe(' data-own-background')
    expect(ownBackgroundAttr({ own: false })).toBe('')
    expect(ownBackgroundAttr(null)).toBe('')
  })

  it('places each of the footer’s sections before, at or after the slide’s', () => {
    expect([0, 1, 2].map(i => footerSectionState(i, 1))).toEqual(['past', 'current', 'future'])
    expect(footerSectionState(0, 0)).toBe('current')
    expect(footerSectionState(0, null)).toBe('future')
    expect(footerSectionState(0, undefined)).toBe('future')
  })
})
