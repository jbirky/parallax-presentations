import { describe, it, expect } from 'vitest'
import { themeCss, deckThemeClass } from './themeCss'
import { THEME_LIST } from './themes'

describe('the themes’ stylesheets', () => {
  it('scopes each one to its theme’s class', () => {
    expect(deckThemeClass('bauhaus')).toBe('deck-theme-bauhaus')
    expect(deckThemeClass('x" onload="y')).toBe('')
    expect(deckThemeClass(undefined)).toBe('')
    const css = themeCss('bauhaus')
    expect(css).toContain('.deck-theme-bauhaus :is(h1, h2, h3, h4, h5, h6)')
    expect(css).toContain('text-transform: lowercase')
    // every rule is inside the theme's class, so the editor can load it for every deck
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g).map(s => s.trim())
    expect(selectors.length).toBeGreaterThan(4)
    for (const sel of selectors) for (const part of sel.split(/,(?![^(]*\))/)) expect(part.trim()).toMatch(/^\.deck-theme-bauhaus\b/)
  })

  it('is empty for themes without one', () => {
    expect(themeCss('black')).toBe('')
    expect(themeCss('constructor')).toBe('')
    expect(THEME_LIST.filter(t => themeCss(t.id)).map(t => t.id)).toEqual(['bauhaus'])
  })
})
