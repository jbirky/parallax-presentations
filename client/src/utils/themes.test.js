import { describe, it, expect } from 'vitest'
import { THEME_LIST, themeOf, revealTheme, deckTextFont, deckTextStyles, slidePalette, newSlideBackground, isDark, ownBackground, themeBackgroundStyle, cssText } from './themes'

describe('themes', () => {
  it('has reveal’s eleven and Parallax’s own, light and dark', () => {
    expect(THEME_LIST.map(t => t.id)).toEqual(['black', 'white', 'league', 'beige', 'sky', 'night', 'serif', 'simple', 'solarized', 'moon', 'dracula', 'bauhaus', 'pixel', 'mission', 'turin', 'gutter', 'lemma', 'beamline', 'kourou', 'ledger', 'preprint', 'transit', 'trace', 'prompt', 'zenith', 'quincunx', 'partition', 'holdout', 'separatrix', 'runlevel', 'fanout', 'cell', 'graticule', 'eigenstate', 'mise', 'valence', 'quadrille', 'inspiral', 'parti', 'downforce'])
    expect(THEME_LIST.filter(t => !t.dark).map(t => t.id)).toEqual(['white', 'beige', 'sky', 'serif', 'simple', 'solarized', 'bauhaus', 'mission', 'turin', 'gutter', 'lemma', 'kourou', 'ledger', 'preprint', 'transit', 'trace', 'quincunx', 'partition', 'holdout', 'separatrix', 'runlevel', 'fanout', 'cell', 'graticule', 'eigenstate', 'mise', 'valence', 'quadrille', 'inspiral', 'parti'])
    expect(themeOf('nope').id).toBe('black')
    expect(themeBackgroundStyle('sky').background).toMatch(/^radial-gradient/)
    expect(cssText({ backgroundColor: '#fff' })).toBe('background-color:#fff;')
  })

  it('draws Bauhaus on reveal’s white, and reveal’s themes on their own', () => {
    expect(revealTheme('bauhaus')).toBe('white')
    expect(revealTheme('moon')).toBe('moon')
    expect(slidePalette({}, 'bauhaus')).toMatchObject({ background: { backgroundColor: '#f7f6f2' }, text: '#151515', link: '#d52b1e', dark: false })
  })

  it('sets text in the deck’s font, or else the theme’s', () => {
    expect(deckTextFont('', 'bauhaus')).toBe('Jost, sans-serif')
    expect(deckTextFont(null, 'bauhaus')).toBe('Jost, sans-serif')
    expect(deckTextFont('Georgia, serif', 'bauhaus')).toBe('Georgia, serif')
    expect(deckTextFont('', 'black')).toBe('')
    expect(deckTextFont('  ', 'nope')).toBe('')
    expect(deckTextFont('', 'pixel')).toBe("'Pixelify Sans', sans-serif")
  })

  it('gives headings the theme’s font and weight until the deck sets its own', () => {
    expect(deckTextStyles(null, 'pixel')).toEqual({ bodySize: 32, h1Size: 56, h2Size: 36, h3Size: 26, headingFont: "'Press Start 2P', monospace", headingWeight: 400 })
    expect(deckTextStyles({ bodySize: 36, headingFont: 'Georgia, serif', h1Size: null }, 'pixel')).toMatchObject({ bodySize: 36, h1Size: 56, headingFont: 'Georgia, serif', headingWeight: 400 })
    expect(deckTextStyles({ headingWeight: 800 }, 'pixel').headingWeight).toBe(800)
    expect(deckTextStyles(null, 'black')).toBeNull()
    const own = { bodySize: 30 }
    expect(deckTextStyles(own, 'bauhaus')).toBe(own)
    expect(revealTheme('pixel')).toBe('black')
    expect(revealTheme('mission')).toBe('white')
    expect(themeBackgroundStyle('mission').background).toMatch(/^linear-gradient.*#f4f6f8$/)
    expect(deckTextStyles(null, 'mission')).toMatchObject({ headingFont: "'Barlow Condensed', sans-serif", headingWeight: 600, h2Size: 44 })
    expect(revealTheme('turin')).toBe('white')
    expect(deckTextFont('', 'turin')).toBe("'Computer Modern Sans', sans-serif")
    expect(deckTextStyles(null, 'turin')).toEqual({ bodySize: 28, h1Size: 50, h2Size: 34, h3Size: 28, headingWeight: 400 })
    expect(deckTextStyles(null, 'gutter')).toMatchObject({ bodySize: 26, h2Size: 34, headingWeight: 600 })
    expect(slidePalette({}, 'gutter').accent).toBe('#0f766e')
    expect(revealTheme('beamline')).toBe('black')
    expect(themeBackgroundStyle('beamline').background).toMatch(/^radial-gradient.*#0a0e17 62%\)$/)
    expect(deckTextStyles(null, 'beamline')).toMatchObject({ headingFont: 'Manrope, sans-serif', headingWeight: 800 })
    expect(deckTextFont('', 'lemma')).toBe("'Computer Modern Sans', sans-serif")
    // Kourou's accent is its red, apart from its navy links
    expect(slidePalette({}, 'kourou')).toMatchObject({ link: '#003247', accent: '#cf1d39' })
    expect(deckTextStyles(null, 'kourou')).toMatchObject({ bodySize: 24, headingFont: "'Titillium Web', sans-serif" })
    expect(themeBackgroundStyle('ledger').background).toMatch(/^linear-gradient.*#ffffff$/)
    expect(slidePalette({}, 'ledger').accent).toBe('#1e6b49')
    expect(deckTextFont('', 'preprint')).toBe("'Computer Modern Serif', serif")
    expect(slidePalette({}, 'transit')).toMatchObject({ link: '#0b62c4', accent: '#e2231a' })
    expect(deckTextStyles(null, 'transit')).toMatchObject({ bodySize: 28, headingWeight: 700 })
    expect(themeBackgroundStyle('trace').background).toMatch(/^radial-gradient.*#fcfcfe$/)
    expect(deckTextStyles(null, 'trace')).toMatchObject({ headingFont: 'Figtree, sans-serif', headingWeight: 800 })
    expect(revealTheme('prompt')).toBe('black')
    expect(deckTextFont('', 'prompt')).toBe("'Fira Code', monospace")
    expect(slidePalette({}, 'prompt').accent).toBe('#7ed67a')
    expect(revealTheme('zenith')).toBe('black')
    expect(deckTextFont('', 'zenith')).toBe("'Public Sans', sans-serif")
    expect(deckTextStyles(null, 'zenith')).toMatchObject({ headingFont: 'Inter, sans-serif', headingWeight: 800, h1Size: 72 })
    expect(slidePalette({}, 'zenith').accent).toBe('#f64137')
    expect(revealTheme('quincunx')).toBe('white')
    expect(deckTextFont('', 'quincunx')).toBe('Rubik, sans-serif')
    expect(slidePalette({}, 'quincunx')).toMatchObject({ link: '#1f5a86', accent: '#e2a23a' })
    expect(deckTextStyles(null, 'partition')).toMatchObject({ headingFont: 'Manrope, sans-serif', headingWeight: 800, h1Size: 72 })
    expect(deckTextFont('', 'partition')).toBe("'Source Sans 3', sans-serif")
    expect(deckTextStyles(null, 'holdout')).toMatchObject({ bodySize: 28, headingFont: 'Rubik, sans-serif', headingWeight: 600 })
    expect(deckTextFont('', 'separatrix')).toBe("'Fira Sans', sans-serif")
    expect(slidePalette({}, 'separatrix')).toMatchObject({ link: '#1d5fa8', accent: '#cf4f1b' })
    expect(revealTheme('runlevel')).toBe('white')
    expect(deckTextFont('', 'runlevel')).toBe("'PT Sans', sans-serif")
    expect(deckTextStyles(null, 'runlevel')).toMatchObject({ bodySize: 24, h2Size: 30, headingFont: "'Roboto Mono', monospace", headingWeight: 600 })
    // Runlevel's dialog and shadow are its page, in proportion, so they fit a thumbnail too
    expect(themeBackgroundStyle('runlevel').background).toMatch(/^linear-gradient\(#e3e7e8, #e3e7e8\) 33\.333% 60\.227% \/ 96\.25% 83\.704% no-repeat, .*#0f4c5c$/)
    expect(deckTextFont('', 'fanout')).toBe("'Asap Condensed', sans-serif")
    expect(slidePalette({}, 'fanout')).toMatchObject({ link: '#c0237a', accent: '#c0237a', dark: false })
    expect(deckTextFont('', 'cell')).toBe("'Nunito Sans', sans-serif")
    expect(deckTextStyles(null, 'cell')).toMatchObject({ headingFont: 'Merriweather, serif', headingWeight: 700, h2Size: 38 })
    expect(slidePalette({}, 'cell')).toMatchObject({ text: '#2e1c45', heading: '#3b1f5e', link: '#b8325f', dark: false })
    expect(deckTextFont('', 'graticule')).toBe("'Open Sans', sans-serif")
    expect(deckTextStyles(null, 'graticule')).toMatchObject({ headingFont: "'Roboto Condensed', sans-serif", headingWeight: 700 })
    expect(slidePalette({}, 'graticule')).toMatchObject({ link: '#1d5f96', accent: '#b54d00', dark: false })
    // Graticule's grid is its page, in proportion, so it fits a thumbnail too
    expect(themeBackgroundStyle('graticule').background).toMatch(/12\.5% 22\.222%.*#f3f5f2$/)
    expect(deckTextFont('', 'eigenstate')).toBe("'Libre Franklin', sans-serif")
    expect(deckTextStyles(null, 'eigenstate')).toMatchObject({ headingFont: "'STIX Two Text', serif", headingWeight: 600, h2Size: 38 })
    expect(slidePalette({}, 'eigenstate')).toMatchObject({ text: '#22233a', heading: '#1d1f4f', link: '#5a35b5', dark: false })
    expect(deckTextFont('', 'mise')).toBe("'Bricolage Grotesque', sans-serif")
    expect(deckTextStyles(null, 'mise')).toMatchObject({ headingWeight: 800, h2Size: 40 })
    expect(slidePalette({}, 'mise')).toMatchObject({ text: '#2a2723', link: '#c0392b', dark: false })
    // Mise's ruled card is its page, in proportion, so it fits a thumbnail too
    expect(themeBackgroundStyle('mise').background).toMatch(/100% 6\.6667%, #fdfdfb$/)
    expect(deckTextFont('', 'valence')).toBe("'Didact Gothic', sans-serif")
    expect(deckTextStyles(null, 'valence')).toMatchObject({ headingFont: "'M PLUS Rounded 1c', sans-serif", headingWeight: 700, h1Size: 60 })
    expect(slidePalette({}, 'valence')).toMatchObject({ text: '#1f262e', link: '#2a5bd7', accent: '#c8362b', dark: false })
    // Valence's hexagonal paper is its page, in proportion, so it fits a thumbnail too;
    // no double quotes, since the PDF writes it into style=""
    expect(themeBackgroundStyle('valence').background).toMatch(/^url\('data:image\/svg\+xml,[^"]*'\) 0 0 \/ 3\.6084% 11\.1111%, #f7f9fb$/)
    expect(deckTextFont('', 'quadrille')).toBe('Lexend, sans-serif')
    expect(slidePalette({}, 'quadrille')).toMatchObject({ text: '#262b35', link: '#1f62c4', accent: '#cc2f24', dark: false })
    // Quadrille's graph paper is its page, in proportion, so it fits a thumbnail too
    expect(themeBackgroundStyle('quadrille').background).toMatch(/12\.5% 22\.2222%.*2\.5% 4\.4444%, #fcfdfe$/)
    expect(deckTextFont('', 'inspiral')).toBe("'IBM Plex Sans', sans-serif")
    expect(deckTextStyles(null, 'inspiral')).toMatchObject({ headingFont: 'Questrial, sans-serif', headingWeight: 400, h1Size: 64 })
    expect(slidePalette({}, 'inspiral')).toMatchObject({ text: '#1d2433', heading: '#101828', link: '#0072b2', accent: '#b14d00', dark: false })
    expect(deckTextFont('', 'parti')).toBe('Archivo, sans-serif')
    expect(deckTextStyles(null, 'parti')).toMatchObject({ headingFont: 'Archivo, sans-serif', headingWeight: 700 })
    expect(slidePalette({}, 'parti')).toMatchObject({ text: '#1f1f1e', link: '#c92a2a', dark: false })
    expect(deckTextFont('', 'downforce')).toBe('Saira, sans-serif')
    expect(deckTextStyles(null, 'downforce')).toMatchObject({ headingFont: 'Saira, sans-serif', headingWeight: 700, h1Size: 64 })
    expect(slidePalette({}, 'downforce')).toMatchObject({ text: '#e8ebf0', heading: '#ffffff', link: '#ff5a4f', accent: '#b98cff', dark: true })
    // Colors of stability: Separatrix's, kept on a light background of a slide's own, and no other theme's
    expect(slidePalette({}, 'separatrix')).toMatchObject({ stable: '#1d5fa8', unstable: '#cf4f1b' })
    expect(slidePalette({ background: { type: 'color', color: '#f0f0e8' } }, 'separatrix')).toMatchObject({ stable: '#1d5fa8', unstable: '#cf4f1b' })
    expect(slidePalette({ background: { type: 'color', color: '#202020' } }, 'separatrix').stable).toBeUndefined()
    expect(THEME_LIST.filter(t => t.stable || t.unstable).map(t => t.id)).toEqual(['separatrix'])
    expect(Object.keys(slidePalette({}, 'white'))).not.toContain('stable')
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
