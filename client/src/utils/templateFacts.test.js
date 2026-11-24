// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { describe, it, expect } from 'vitest'
import { templateFacts } from './templateFacts'

const deck = {
  theme: 'bauhaus',
  textStyles: { h2Size: 48 },
  slides: [
    { layout: 'title', elements: [
      { type: 'text', placeholder: 'title', y: 150, content: '<h4>Week 3</h4><h2>Forces &amp; <em>motion</em></h2>' },
      { type: 'text', placeholder: 'subtitle', y: 282, content: '<p>Week 3</p>' },
    ] },
    { name: 'Newton’s second law', layout: 'title-content', elements: [
      { type: 'graph' }, { type: 'graph' }, { type: 'equation' }, { type: 'shape' }, { type: 'text', content: '<p>x</p>' },
    ] },
    { background: { type: 'color', color: '#101010' }, elements: [{ type: 'plugin:pendulum' }, { type: 'html' }] },
    { layout: 'blank', elements: [
      { type: 'text', y: 20, content: '<p>PART 1 OF 4</p><h1>01</h1>' },
      { type: 'text', y: 90, content: '<h2>The <em>idea</em>,<br>at last</h2><p>More</p>' },
    ] },
    { elements: [] },
  ],
}

describe('what a template’s page says about its deck', () => {
  it('names its theme, colors, fonts and text sizes, with the theme’s where the deck has none', () => {
    const f = templateFacts(deck)
    expect(f.theme).toMatchObject({ id: 'bauhaus', label: 'Bauhaus', ownColors: false, stylesheet: '' })
    expect(f.theme.note).toMatch(/Jost/)
    expect(f.fonts).toEqual({ text: 'Jost', heading: 'Jost' })
    expect(f.sizes.find(s => s.name.startsWith('Heading 2')).px).toBe(48)
    expect(f.colors[0]).toEqual({ name: 'Background', value: '#f7f6f2' })
    // Each color once
    expect(new Set(f.colors.map(c => c.value)).size).toBe(f.colors.length)
  })

  it('names each slide, says what it holds, and gives its colors', () => {
    const f = templateFacts(deck)
    expect(f.slides.map(s => s.title)).toEqual(['Forces & motion', 'Newton’s second law', 'Slide 3', 'The idea, at last', 'Slide 5'])
    expect(f.slides[3].layout).toBe('')
    expect(f.slides[0].layout).toBe('Title Slide')
    expect(f.slides[1].kinds).toEqual(['2 graphs', 'Equation'])
    expect(f.slides[2]).toMatchObject({ kinds: ['Plugin', 'HTML embed'], background: '#101010', text: '#ffffff' })
    expect(f.contents).toEqual(['2 graphs', 'Equation', 'Plugin', 'HTML embed', '5 text boxes', 'Shape'])
  })

  it('tells of a deck’s own colors and stylesheet, and copes with a deck of nothing', () => {
    const f = templateFacts({ theme: 'white', themeColors: { accent: '#ff0000' }, themeCss: ' h2 { color: red } ', globalFont: "'IBM Plex Sans', sans-serif", slides: [] })
    expect(f.theme).toMatchObject({ label: 'White', ownColors: true, stylesheet: 'h2 { color: red }' })
    expect(f.fonts.text).toBe('IBM Plex Sans')
    expect(f.colors.find(c => c.name === 'Accent').value).toBe('#ff0000')
    expect(f.theme).toMatchObject({ named: false, base: 'White' })
    // A theme of its own, named where it came from, described by its stylesheet
    const own = templateFacts({ theme: 'white', themeSource: { name: 'DNA', version: 1 }, themeCss: '/* DNA: a theme for bioinformatics talks. Red Hat type; nucleotide colors.\n   The title page has a helix. */\nh2 { color: red }', slides: [] })
    expect(own.theme).toMatchObject({ label: 'DNA', base: 'White', named: true, note: 'A theme for bioinformatics talks. Red Hat type; nucleotide colors.' })
    const none = templateFacts(null)
    expect(none.slides).toEqual([])
    expect(none.theme.label).toBe('Black')
  })
})
