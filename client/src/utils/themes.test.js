import { describe, it, expect } from 'vitest'
import { THEME_LIST, themeOf, revealTheme, slidePalette, newSlideBackground, isDark, ownBackground, themeBackgroundStyle, cssText } from './themes'

describe('themes', () => {
  it('has reveal’s eleven and Bauhaus, light and dark', () => {
    expect(THEME_LIST.map(t => t.id)).toEqual(['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized', 'moon', 'dracula', 'bauhaus'])
    expect(THEME_LIST.filter(t => !t.dark).map(t => t.id)).toEqual(['white', 'beige', 'sky', 'serif', 'simple', 'solarized', 'bauhaus'])
    expect(themeOf('nope').id).toBe('black')
    expect(themeBackgroundStyle('sky').background).toMatch(/^radial-gradient/)
    expect(cssText({ backgroundColor: '#fff' })).toBe('background-color:#fff;')
  })

  it('draws Bauhaus on reveal’s white, and reveal’s themes on their own', () => {
    expect(revealTheme('bauhaus')).toBe('white')
    expect(revealTheme('moon')).toBe('moon')
    expect(slidePalette({}, 'bauhaus')).toMatchObject({ background: { backgroundColor: '#f7f6f2' }, text: '#151515', link: '#d52b1e', dark: false })
  })

  it('tells dark colors from light ones', () => {
    expect(isDark('#1e1e2e')).toBe(true)
    expect(isDark('#fff')).toBe(false)
    expect(isDark('rgb(250, 250, 240)')).toBe(false)
    expect(isDark('papayawhip')).toBe(true) // unknown: as it always was, light text
    expect(ownBackground({ type: 'gradient', gradient: 'linear-gradient(#fafafa, #eee)' }).dark).toBe(false)
    expect(ownBackground({ type: 'image', image: '/a.png' }).dark).toBe(true)
    expect(ownBackground({ type: 'none' })).toBeNull()
    expect(ownBackground({ type: 'color' })).toBeNull()
  })
})

describe('what a slide shows', () => {
  it('is the theme’s page, text and headings without a background of its own', () => {
    expect(slidePalette({}, 'white')).toMatchObject({ background: { backgroundColor: '#ffffff' }, text: '#222222', heading: '#222222', dark: false, own: false })
    expect(slidePalette({ background: { type: 'none' } }, 'moon')).toMatchObject({ text: '#93a1a1', heading: '#eee8d5', dark: true })
  })

  it('keeps white text on a dark background of its own, with a dark theme’s headings', () => {
    const legacy = { background: { type: 'color', color: '#1e1e2e' } }
    expect(slidePalette(legacy, 'black')).toMatchObject({ text: '#ffffff', heading: '#ffffff', own: true })
    expect(slidePalette(legacy, 'dracula')).toMatchObject({ text: '#ffffff', heading: '#bd93f9' })
    // A light theme's dark headings would vanish on it
    expect(slidePalette(legacy, 'white')).toMatchObject({ text: '#ffffff', heading: '#ffffff' })
  })

  it('gives a light background of its own dark text', () => {
    const light = { background: { type: 'color', color: '#fdfdfd' } }
    expect(slidePalette(light, 'black')).toMatchObject({ text: '#222222', heading: '#222222', dark: false })
    expect(slidePalette(light, 'solarized')).toMatchObject({ text: '#657b83', heading: '#586e75' })
  })

  it('starts a new slide on the theme’s page, unless the one before has the old default', () => {
    expect(newSlideBackground({ background: { type: 'color', color: '#1E1E2E' } })).toEqual({ type: 'color', color: '#1e1e2e' })
    expect(newSlideBackground({ background: { type: 'color', color: '#ff0000' } })).toBeUndefined()
    expect(newSlideBackground({})).toBeUndefined()
    expect(newSlideBackground(undefined)).toBeUndefined()
  })
})
