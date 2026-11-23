// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Theme documents for the theme library, .json export and import
// (customTheme.js)

import { describe, it, expect } from 'vitest'
import { cleanThemeDoc, themeDocFromDeck, applyThemeDoc, themeDiffers, themeFileText, readThemeFile, themeFileName, ThemeDocError } from './customTheme'

const deck = {
  title: 'Talk', theme: 'white', globalFont: 'Jost, sans-serif',
  themeColors: { heading: '#d62828', accent: '#1d3557' },
  textStyles: { h2Size: 48 }, themeCss: 'h2 { color: red }', slides: [{ id: 's1', elements: [] }],
}

describe('a theme document', () => {
  it('needs a name and a built-in base, and refuses what it can’t use', () => {
    expect(cleanThemeDoc({ name: '  Lab   talks ', base: 'night' })).toEqual({ name: 'Lab talks', base: 'night' })
    const refuse = (input, pattern) => expect(() => cleanThemeDoc(input)).toThrow(pattern)
    refuse(null, /must be an object/)
    refuse({ base: 'white' }, /needs a name/)
    refuse({ name: 'x'.repeat(81), base: 'white' }, /up to 80 characters/)
    refuse({ name: 'x', base: 'neon' }, /base must be one of: black, white/)
    refuse({ name: 'x', base: 'white', colors: { heading: 'red' } }, /colors must be/)
    refuse({ name: 'x', base: 'white', font: 'x;} body{' }, /font family list/)
    refuse({ name: 'x', base: 'white', textStyles: { h2Size: 2 } }, /text styles must be/)
    refuse({ name: 'x', base: 'white', css: 'h1{}'.repeat(12501) }, /up to 50000 characters/)
    expect(() => cleanThemeDoc({})).toThrow(ThemeDocError)
  })

  it('is what a deck has, and applying it gives a deck the same theme', () => {
    const doc = themeDocFromDeck(deck, 'Lab talks')
    expect(doc).toEqual({ name: 'Lab talks', base: 'white', colors: { heading: '#d62828', accent: '#1d3557' }, font: 'Jost, sans-serif', textStyles: { h2Size: 48 }, css: 'h2 { color: red }' })
    const plain = { title: 'Other', theme: 'black', slides: [] }
    const applied = applyThemeDoc(plain, doc, { id: 't1', version: 3 })
    expect(applied).toMatchObject({ theme: 'white', themeColors: doc.colors, globalFont: doc.font, textStyles: doc.textStyles, themeCss: doc.css, themeSource: { id: 't1', name: 'Lab talks', version: 3 } })
    expect(themeDiffers(applied, doc)).toBe(false)
    expect(themeDiffers({ ...applied, themeColors: { heading: '#000000' } }, doc)).toBe(true)
  })

  it("replaces a deck's theme fields, leaving out what the theme doesn't have", () => {
    const applied = applyThemeDoc(deck, { name: 'Night', base: 'night' })
    expect(applied.theme).toBe('night')
    for (const key of ['themeColors', 'globalFont', 'textStyles', 'themeCss', 'themeSource']) expect(key in applied).toBe(false)
    expect(applied.slides).toBe(deck.slides)
  })

  it('goes to and from a .json file', () => {
    const doc = themeDocFromDeck(deck, 'Lab talks')
    const text = themeFileText({ ...doc, id: 'x', version: 4 })
    expect(JSON.parse(text)).toEqual({ parallaxTheme: 1, ...doc })
    expect(readThemeFile(text)).toEqual(doc)
    expect(() => readThemeFile('nope')).toThrow(/isn't JSON/)
    expect(() => readThemeFile('{"parallaxTheme": 9, "name": "x", "base": "white"}')).toThrow(/isn't a Parallax theme/)
    expect(themeFileName('Lab talks!')).toBe('lab-talks.parallax-theme.json')
  })
})
