import { describe, it, expect } from 'vitest'
import { themeCss, deckThemeClass } from './themeCss'
import { THEME_LIST } from './themes'

describe('the themes’ stylesheets', () => {
  it('scopes each one to its theme’s class', () => {
    expect(deckThemeClass('bauhaus')).toBe('deck-theme-bauhaus')
    expect(deckThemeClass('x" onload="y')).toBe('')
    expect(deckThemeClass(undefined)).toBe('')
    expect(themeCss('bauhaus')).toContain('text-transform: lowercase')
    expect(themeCss('pixel')).toContain('text-transform: uppercase')
    // every rule is inside the theme's class, so the editor can load them all for every deck
    for (const id of ['bauhaus', 'pixel', 'mission']) {
      const selectors = themeCss(id).replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g).map(s => s.trim())
      expect(selectors.length).toBeGreaterThan(4)
      for (const sel of selectors) for (const part of sel.split(/,(?![^(]*\))/)) expect(part.trim()).toMatch(new RegExp(`^\\.deck-theme-${id}\\b`))
    }
  })

  it('is empty for themes without one', () => {
    expect(themeCss('black')).toBe('')
    expect(themeCss('constructor')).toBe('')
    expect(THEME_LIST.filter(t => themeCss(t.id)).map(t => t.id)).toEqual(['bauhaus', 'pixel', 'mission'])
  })
})
