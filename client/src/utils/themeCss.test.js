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
    // a slide's own rules name it both with the class (editor, PDF) and inside it (presented decks)
    expect(themeCss('turin')).toContain('.deck-theme-turin.px-slide::after,\n.deck-theme-turin .px-slide::after {')
    expect(themeCss('gutter')).toContain('@keyframes gutter-caret')
    expect(themeCss('beamline')).toContain('@keyframes beamline-bunch')
    // a picture drawn over the theme's page leaves a slide's own background showing
    expect(themeCss('kourou')).toContain('.deck-theme-kourou .px-slide[data-layout=title]:not([data-own-background])::before {')
    expect(themeCss('ledger')).toContain('content: "fx"')
    expect(themeCss('lemma')).toContain('counter(list-item)')
    expect(themeCss('preprint')).toContain('.deck-theme-preprint table tr:first-child')
    // Transit's footer is the route, from the footer's hooks
    expect(themeCss('transit')).toContain('.deck-theme-transit .px-slide .px-footer .px-footer-section[data-state=current]::before')
    expect(themeCss('trace')).toContain('counter-reset: trace-index -1')
    expect(themeCss('prompt')).toContain('@keyframes prompt-cursor')
    expect(themeCss('zenith')).toContain('[data-own-background]::before')
    expect(themeCss('quincunx')).toContain('.deck-theme-quincunx .px-slide .px-footer .px-footer-section[data-state=past]::after')
    expect(themeCss('partition')).toContain('.deck-theme-partition .px-slide[data-layout=two-column]::after')
    expect(themeCss('holdout')).toContain('repeating-linear-gradient(135deg')
    expect(themeCss('separatrix')).toContain('mask: var(--sx-frame)')
    expect(themeCss('runlevel')).toContain('.deck-theme-runlevel .px-slide .px-footer .px-footer-section[data-state=current]::before { content: "[  *** ] "')
    expect(themeCss('runlevel')).toContain('.deck-theme-runlevel .px-slide[data-layout=title]:not([data-own-background])::before')
    expect(themeCss('fanout')).toContain('.deck-theme-fanout .px-slide .px-footer .px-footer-section[data-state=past]:not(:last-child)::after')
    expect(themeCss('fanout')).toContain('content: "ADR"')
    expect(themeCss('cell')).toContain('.deck-theme-cell .px-slide[data-layout=section-header]:not([data-own-background])::before')
    expect(themeCss('cell')).toContain('content: "10 \\00B5m"')
    expect(themeCss('graticule')).toContain('.deck-theme-graticule .px-slide .px-footer .px-footer-section[data-state=current]::after')
    expect(themeCss('graticule')).toContain('.deck-theme-graticule .px-slide:not([data-own-background])::before')
    expect(themeCss('eigenstate')).toContain('.deck-theme-eigenstate .px-slide[data-layout=section-header]:not([data-own-background])::before')
    expect(themeCss('eigenstate')).toContain('content: "|" counter(list-item) "\\27E9\\00A0"')
    expect(themeCss('mise')).toContain('.deck-theme-mise .px-slide[data-layout=section-header]:not([data-own-background])::before')
    expect(themeCss('mise')).toContain('content: "From the kitchen of"')
    expect(themeCss('valence')).toContain('.deck-theme-valence .px-slide .px-footer .px-footer-section[data-state=current]::after')
    expect(themeCss('valence')).toContain('.deck-theme-valence .px-slide[data-layout=section-header]:not([data-own-background])::before')
    expect(themeCss('quadrille')).toContain('.deck-theme-quadrille .px-slide[data-layout=section-header]:not([data-own-background])::before')
    expect(themeCss('quadrille')).toContain('table :is(td, th) + :is(td, th)')
    // every rule is inside the theme's class, so the editor can load them all for every deck
    // (at-rules and keyframe steps aside)
    for (const id of ['bauhaus', 'pixel', 'mission', 'turin', 'gutter', 'lemma', 'beamline', 'kourou', 'ledger', 'preprint', 'transit', 'trace', 'prompt', 'zenith', 'quincunx', 'partition', 'holdout', 'separatrix', 'runlevel', 'fanout', 'cell', 'graticule', 'eigenstate', 'mise', 'valence', 'quadrille']) {
      const selectors = themeCss(id).replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g).map(s => s.trim()).filter(s => !/^(@|from$|to$|[\d.]+%)/.test(s))
      expect(selectors.length).toBeGreaterThan(4)
      for (const sel of selectors) for (const part of sel.split(/,(?![^(]*\))/)) expect(part.trim()).toMatch(new RegExp(`^\\.deck-theme-${id}\\b`))
    }
  })

  it('is empty for themes without one', () => {
    expect(themeCss('black')).toBe('')
    expect(themeCss('constructor')).toBe('')
    expect(THEME_LIST.filter(t => themeCss(t.id)).map(t => t.id)).toEqual(['bauhaus', 'pixel', 'mission', 'turin', 'gutter', 'lemma', 'beamline', 'kourou', 'ledger', 'preprint', 'transit', 'trace', 'prompt', 'zenith', 'quincunx', 'partition', 'holdout', 'separatrix', 'runlevel', 'fanout', 'cell', 'graticule', 'eigenstate', 'mise', 'valence', 'quadrille'])
  })
})
