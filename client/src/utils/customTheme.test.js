// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A deck's own theme: its colors over its theme's (deck.themeColors), the
// hooks theme stylesheets target (slideHooks.js) and its stylesheet
// (deck.themeCss) in the presented deck.

import { describe, it, expect } from 'vitest'
import { cleanThemeColors, deckTheme, slidePalette, paletteVars } from './themes'
import { generateRevealHTML } from './generateHTML'

describe("a deck's own colors", () => {
  it('keeps only colors it can use', () => {
    expect(cleanThemeColors(null)).toBe(null)
    expect(cleanThemeColors({ background: 'url(x)', text: 'red', heading: '#123', accent: 'rgb(1, 2, 3)', other: '#fff' }))
      .toEqual({ heading: '#123', accent: 'rgb(1, 2, 3)' })
  })

  it("lays them over the theme's, with an accent and whether it's dark", () => {
    expect(deckTheme('white', null).accent).toBe('#2a76dd')
    expect(deckTheme('white', { link: '#ff0000' }).accent).toBe('#ff0000')
    const night = deckTheme('white', { background: '#101020', accent: '#ffcc00' })
    expect([night.background, night.dark, night.accent, night.text]).toEqual(['#101020', true, '#ffcc00', '#222222'])
    // A page of its own replaces a theme's gradient
    expect(deckTheme('sky', { background: '#ffffff' }).backgroundCss).toBe(undefined)
  })

  it("show on slides without a background of their own, and as the slide's variables", () => {
    const colors = { heading: '#d62828', accent: '#d62828' }
    const p = slidePalette({}, 'white', colors)
    expect([p.heading, p.accent, p.bg]).toEqual(['#d62828', '#d62828', '#ffffff'])
    expect(paletteVars(p)).toEqual({ '--px-bg': '#ffffff', '--px-text': '#222222', '--px-heading': '#d62828', '--px-link': '#2a76dd', '--px-accent': '#d62828' })
    // A dark slide of its own on a light theme keeps colors that show on it
    const dark = slidePalette({ background: { type: 'color', color: '#000000' } }, 'white', colors)
    expect([dark.heading, dark.bg, dark.text]).toEqual(['#ffffff', '#000000', '#ffffff'])
  })
})

describe('the presented deck', () => {
  const deck = extra => ({
    title: 'T', theme: 'white', ...extra,
    slides: [{ id: 's1', layout: 'title-content', elements: [
      { id: 't1', type: 'text', placeholder: 'title', sizeMode: 'shrink', x: 40, y: 36, width: 880, height: 100, content: '<h2>Title</h2>' },
      { id: 'b1', type: 'text', x: 40, y: 140, width: 880, height: 300, content: '<p>Body</p>', fragment: true },
    ] }],
  })

  it("marks slides and text boxes for themes' stylesheets", () => {
    const html = generateRevealHTML(deck())
    expect(html).toMatch(/<section data-slide-id="s1"[^>]* class="px-slide" data-layout="title-content"/)
    expect(html).toMatch(/--px-bg:#ffffff;--px-text:#222222;--px-heading:#222222;--px-link:#2a76dd;--px-accent:#2a76dd;/)
    expect(html).toContain('class="px-text" data-placeholder="title" data-fit="shrink"')
    expect(html).toContain('class="fragment fade-in px-text"')
  })

  it('paints the deck its own colors', () => {
    const html = generateRevealHTML(deck({ themeColors: { background: '#101020', accent: '#ffcc00' } }))
    expect(html).toContain(':root { --r-background-color: #101020;')
    expect(html).toContain('.reveal-viewport { background: #101020; }')
    expect(html).toContain('--px-accent:#ffcc00;')
    expect(generateRevealHTML(deck())).not.toContain('.reveal-viewport { background:')
  })

  it('writes its stylesheet, scoped and checked, after the theme and before custom CSS', () => {
    const html = generateRevealHTML(deck({ themeCss: '[data-placeholder=title] h2 { color: red } @import url(https://evil.example/x.css);', customCSS: '.reveal h1 { color: blue }' }))
    expect(html).toContain('<style data-theme-css>\n.px-slide [data-placeholder=title] h2{color:red}\n  </style>')
    expect(html).not.toContain('evil.example')
    expect(html.indexOf('data-theme-css')).toBeLessThan(html.indexOf('.reveal h1 { color: blue }'))
    expect(generateRevealHTML(deck())).not.toContain('data-theme-css')
  })
})
