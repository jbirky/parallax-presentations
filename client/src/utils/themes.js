// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The presentation themes: reveal.js 5's, whose page color, heading color and
// link color show when presenting, and Parallax's own (Bauhaus, Pixel, Mission, Turin,
// Gutter, Lemma, Beamline, Kourou, Ledger, Preprint, Transit, Trace, Prompt), which
// name the reveal.js theme they're drawn on (`reveal`). A theme is its colors;
// Parallax's own can also have a font (`font`), which a deck's text is set in
// until Settings › Font picks one (deckTextFont), text styles (`textStyles`,
// as deck.textStyles has them: sizes, and the headings' font and weight),
// which hold until the Themes panel's Text tab sets its own (deckTextStyles),
// and a stylesheet,
// client/src/themes/<id>.css (utils/themeCss.js).
//
// What a slide shows (slidePalette): a slide without a background of its own
// shows the theme's page, text and headings, in the editor as when
// presenting. A slide with its own background keeps the white text it always
// had on a dark one (dark text on a light one), and the theme's heading
// color when the theme is dark or light as its background is.

export const THEME_LIST = [
  { id: 'black', label: 'Black', background: '#191919', text: '#ffffff', heading: '#ffffff', link: '#42affa', dark: true },
  { id: 'white', label: 'White', background: '#ffffff', text: '#222222', heading: '#222222', link: '#2a76dd', dark: false },
  { id: 'league', label: 'League', background: '#2b2b2b', text: '#eeeeee', heading: '#eeeeee', link: '#13daec', dark: true },
  { id: 'beige', label: 'Beige', background: '#f7f3de', text: '#333333', heading: '#333333', link: '#8b743d', dark: false },
  { id: 'sky', label: 'Sky', background: '#f7fbfc', backgroundCss: 'radial-gradient(circle farthest-corner at center, #f7fbfc 0%, #add9e4 100%)', text: '#333333', heading: '#333333', link: '#3b759e', dark: false },
  { id: 'night', label: 'Night', background: '#111111', text: '#eeeeee', heading: '#eeeeee', link: '#e7ad52', dark: true },
  { id: 'serif', label: 'Serif', background: '#f0f1eb', text: '#000000', heading: '#383d3d', link: '#51483d', dark: false },
  { id: 'simple', label: 'Simple', background: '#ffffff', text: '#000000', heading: '#000000', link: '#00008b', dark: false },
  { id: 'solarized', label: 'Solarized', background: '#fdf6e3', text: '#657b83', heading: '#586e75', link: '#268bd2', dark: false },
  { id: 'moon', label: 'Moon', background: '#002b36', text: '#93a1a1', heading: '#eee8d5', link: '#268bd2', dark: true },
  { id: 'dracula', label: 'Dracula', background: '#282a36', text: '#f8f8f2', heading: '#bd93f9', link: '#ff79c6', dark: true },
  { id: 'bauhaus', label: 'Bauhaus', background: '#f7f6f2', text: '#151515', heading: '#151515', link: '#d52b1e', dark: false, reveal: 'white', font: 'Jost, sans-serif', note: 'Lowercase headings, a red rule under slide titles, square bullets, in Jost' },
  { id: 'pixel', label: 'Pixel', background: '#14112e', text: '#f3eedf', heading: '#ffcc33', link: '#39e5c0', dark: true, reveal: 'black', font: "'Pixelify Sans', sans-serif", textStyles: { bodySize: 32, h1Size: 56, h2Size: 36, h3Size: 26, headingFont: "'Press Start 2P', monospace", headingWeight: 400 }, note: '8-bit: pixel headings with a purple shadow, arrow bullets, code in VT323' },
  { id: 'mission', label: 'Mission', background: '#f4f6f8', backgroundCss: 'linear-gradient(#dde3ea 1px, transparent 1px) 0 0 / 60px 60px, linear-gradient(90deg, #dde3ea 1px, transparent 1px) 0 0 / 60px 60px, linear-gradient(#e9edf2 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(90deg, #e9edf2 1px, transparent 1px) 0 0 / 12px 12px, #f4f6f8', text: '#0d1b2e', heading: '#0d1b2e', link: '#1d6fd1', dark: false, reveal: 'white', font: "'IBM Plex Sans', sans-serif", textStyles: { h1Size: 88, h2Size: 44, h3Size: 30, headingFont: "'Barlow Condensed', sans-serif", headingWeight: 600 }, note: 'Engineering drawing: a drafting grid, capital headings with a rule under slide titles, code in B612 Mono' },
  { id: 'turin', label: 'Turin', background: '#ffffff', text: '#141414', heading: '#3333b3', link: '#3333b3', dark: false, reveal: 'white', font: "'Computer Modern Sans', sans-serif", textStyles: { bodySize: 28, h1Size: 50, h2Size: 34, h3Size: 28, headingWeight: 400 }, note: 'LaTeX Beamer: a blue title band and footline, triangle bullets, quotes as blocks, in Computer Modern Sans' },
  { id: 'gutter', label: 'Gutter', background: '#f6f7f9', text: '#1d2127', heading: '#0e1116', link: '#0f766e', dark: false, reveal: 'white', font: "'IBM Plex Sans', sans-serif", textStyles: { bodySize: 26, h1Size: 54, h2Size: 34, h3Size: 26, headingWeight: 600 }, note: 'A code editor: a gutter and status bar, code in JetBrains Mono on a dark slab, quotes as callouts' },
  { id: 'lemma', label: 'Lemma', background: '#ffffff', text: '#1d2027', heading: '#26426e', link: '#26426e', dark: false, reveal: 'white', font: "'Computer Modern Sans', sans-serif", textStyles: { bodySize: 28, h1Size: 48, h2Size: 32, h3Size: 28, headingWeight: 700 }, note: 'Beamer for mathematics: a slate title bar and footline, theorem, example and alert blocks, numbered balls, in Computer Modern Sans' },
  { id: 'beamline', label: 'Beamline', background: '#0a0e17', backgroundCss: 'radial-gradient(900px 520px at 72% 46%, #0f1828 0%, #0a0e17 62%)', text: '#e6ebf3', heading: '#ffffff', link: '#4fb4ff', dark: true, reveal: 'black', font: 'Inter, sans-serif', textStyles: { h1Size: 64, h2Size: 40, h3Size: 28, headingFont: 'Manrope, sans-serif', headingWeight: 800 }, note: 'Particle physics: a beam under slide titles, a collider ring on the title slide, an event display on section slides, numbers in JetBrains Mono' },
  { id: 'kourou', label: 'Kourou', background: '#ffffff', text: '#003247', heading: '#003247', link: '#003247', accent: '#cf1d39', dark: false, reveal: 'white', font: 'Arial, sans-serif', textStyles: { bodySize: 24, h1Size: 60, h2Size: 40, h3Size: 28, headingFont: "'Titillium Web', sans-serif" }, note: 'Space science: a navy strip with a red rule, red tags, a starfield title slide and a timeline for sections, in Titillium Web and Arial' },
  { id: 'ledger', label: 'Ledger', background: '#ffffff', backgroundCss: 'linear-gradient(#eef1ef 1px, transparent 1px) 0 19px / 80px 30px, linear-gradient(90deg, #eef1ef 1px, transparent 1px) 27px 0 / 80px 30px, #ffffff', text: '#13221b', heading: '#13221b', link: '#2457c5', accent: '#1e6b49', dark: false, reveal: 'white', font: 'Geist, sans-serif', textStyles: { bodySize: 26, h1Size: 72, h2Size: 38, h3Size: 28, headingFont: 'Geist, sans-serif', headingWeight: 700 }, note: 'A spreadsheet, for pitches: gridlines, column letters and row numbers, a formula bar before slide titles, figures in JetBrains Mono' },
  { id: 'preprint', label: 'Preprint', background: '#fffdf8', text: '#161616', heading: '#161616', link: '#1f4e9c', dark: false, reveal: 'white', font: "'Computer Modern Serif', serif", textStyles: { bodySize: 26, h1Size: 46, h2Size: 34, h3Size: 28, headingWeight: 700 }, note: 'A typeset paper: Computer Modern Serif, justified paragraphs, quotes as an abstract, booktabs tables, footnotes and figure captions' },
  { id: 'transit', label: 'Transit', background: '#ffffff', text: '#1b1b1f', heading: '#1b1b1f', link: '#0b62c4', accent: '#e2231a', dark: false, reveal: 'white', font: 'Barlow, sans-serif', textStyles: { bodySize: 28, h1Size: 64, h2Size: 40, h3Size: 30, headingWeight: 700 }, note: 'A transit map: bullets as stops on a line, the footer’s sections as a route, station signs for sections, timetables for tables' },
  { id: 'trace', label: 'Trace', background: '#fcfcfe', backgroundCss: 'radial-gradient(circle, #d6dae6 1.15px, transparent 1.6px) 0 0 / 24px 24px, #fcfcfe', text: '#1c1e2e', heading: '#1c1e2e', link: '#4338ca', accent: '#4338ca', dark: false, reveal: 'white', font: 'Figtree, sans-serif', textStyles: { bodySize: 26, h1Size: 60, h2Size: 36, h3Size: 28, headingFont: 'Figtree, sans-serif', headingWeight: 800 }, note: 'Algorithms: a dot grid, cells and index cells, complexity chips, invariant callouts, code in Fira Code' },
  { id: 'prompt', label: 'Prompt', background: '#101317', text: '#dde2de', heading: '#f5f7f3', link: '#5c9cff', accent: '#7ed67a', dark: true, reveal: 'black', font: "'Fira Code', monospace", textStyles: { bodySize: 22, h1Size: 56, h2Size: 26, h3Size: 22, headingFont: "'Fira Code', monospace", headingWeight: 600 }, note: 'A terminal window: titles typed at a prompt, # comments, man-page sections, a tmux status bar' },
]

export const THEMES = Object.fromEntries(THEME_LIST.map(t => [t.id, t]))

export function themeOf(id) {
  return THEMES[id] || THEMES.black
}

// The reveal.js theme stylesheet (dist/theme/<name>.css) a theme is drawn on:
// its own for reveal's themes, the one it names for Parallax's
export function revealTheme(id) {
  return THEMES[id]?.reveal || id
}

// The font a deck's text is set in: the deck's own (Settings › Font), or its
// theme's, or '' for the default (deckFont.js)
export function deckTextFont(globalFont, themeId) {
  return (typeof globalFont === 'string' && globalFont.trim()) || THEMES[themeId]?.font || ''
}

// A deck's text styles (deck.textStyles, utils/textStyles.js), with its
// theme's where it has none of its own
export function deckTextStyles(textStyles, themeId) {
  const theirs = THEMES[themeId]?.textStyles
  if (!theirs) return textStyles || null
  const own = textStyles && typeof textStyles === 'object' ? textStyles : {}
  const out = { ...theirs }
  for (const [key, value] of Object.entries(own)) if (value != null && value !== '') out[key] = value
  return out
}

// The background every slide had before themes showed in the editor; a new
// slide after one of these keeps it, so older decks stay as they are
export const LEGACY_BACKGROUND = { type: 'color', color: '#1e1e2e' }

export function isLegacyBackground(bg) {
  return bg?.type === 'color' && String(bg.color || '').toLowerCase() === '#1e1e2e'
}

// A new slide's background, after `slide`: none of its own (the theme's),
// unless the slide before has the old default
export function newSlideBackground(slide) {
  return isLegacyBackground(slide?.background) ? { ...LEGACY_BACKGROUND } : undefined
}

// "#abc", "#aabbcc" or "rgb(…)/rgba(…)" as [r, g, b], or null
export function parseColor(value) {
  const s = String(value || '').trim()
  let m = /^#([0-9a-f]{3})$/i.exec(s)
  if (m) return m[1].split('').map(c => parseInt(c + c, 16))
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s)
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16))
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s)
  if (m) return [m[1], m[2], m[3]].map(Number)
  if (s.toLowerCase() === 'white') return [255, 255, 255]
  if (s.toLowerCase() === 'black') return [0, 0, 0]
  return null
}

export function isDark(value, fallback = true) {
  const rgb = parseColor(value)
  if (!rgb) return fallback
  const [r, g, b] = rgb
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
}

// The first color in a gradient, for whether it's dark
function firstColor(gradient) {
  const m = /(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/i.exec(String(gradient || ''))
  return m ? m[1] : null
}

// A slide's own background as CSS (camelCase), with whether it's dark and
// a color for it (the first of a gradient's; black for an image); null when
// it has none and shows the theme's
export function ownBackground(bg) {
  if (!bg) return null
  if (bg.type === 'color' && bg.color) return { style: { backgroundColor: bg.color }, dark: isDark(bg.color), color: bg.color }
  if (bg.type === 'gradient' && bg.gradient) {
    const first = firstColor(bg.gradient)
    const dark = isDark(first)
    return { style: { background: bg.gradient }, dark, color: first || (dark ? '#000000' : '#ffffff') }
  }
  if (bg.type === 'image' && bg.image) return { style: { backgroundImage: `url(${bg.image})`, backgroundSize: bg.size || 'cover', backgroundPosition: bg.position || 'center' }, dark: true, color: '#000000' }
  return null
}

// A deck's own colors (deck.themeColors, from the Themes panel's Customize),
// over its theme's: any of these, each a hex or rgb() color
export const THEME_COLOR_KEYS = ['background', 'text', 'heading', 'link', 'accent']
const COLOR_VALUE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\))$/i

// The colors a deck has that can be used, or null when it has none
export function cleanThemeColors(colors) {
  if (!colors || typeof colors !== 'object') return null
  const out = {}
  for (const key of THEME_COLOR_KEYS) {
    const value = typeof colors[key] === 'string' ? colors[key].trim() : ''
    if (value && COLOR_VALUE.test(value)) out[key] = value
  }
  return Object.keys(out).length ? out : null
}

// A deck's theme with its own colors: its page, text, heading and link
// colors, its accent (the link color unless the theme or deck has one), and
// whether it's dark, from the page color when the deck gave it one
export function deckTheme(themeId, colors) {
  const t = themeOf(themeId)
  const own = cleanThemeColors(colors)
  const out = { ...t, accent: t.accent || t.link }
  if (!own) return out
  Object.assign(out, own)
  if (own.link && !own.accent && !t.accent) out.accent = own.link
  if (own.background) {
    delete out.backgroundCss
    out.dark = isDark(own.background, t.dark)
  }
  return out
}

// The theme's page as CSS (camelCase), with the deck's own colors
export function themeBackgroundStyle(themeId, colors = null) {
  const t = deckTheme(themeId, colors)
  return t.backgroundCss ? { background: t.backgroundCss } : { backgroundColor: t.background }
}

// What a slide shows: its background (CSS, camelCase) and a color for it
// (bg), its text, heading, link and accent colors, and whether it's dark.
// colors are the deck's own (deck.themeColors).
export function slidePalette(slide, themeId, colors = null) {
  const t = deckTheme(themeId, colors)
  const own = ownBackground(slide?.background)
  if (!own) return { background: themeBackgroundStyle(themeId, colors), bg: t.background, text: t.text, heading: t.heading, link: t.link, accent: t.accent, dark: t.dark, own: false }
  const match = own.dark === t.dark
  const plain = own.dark ? '#ffffff' : '#222222'
  const link = match ? t.link : (own.dark ? '#42affa' : '#2a76dd')
  return {
    background: own.style,
    bg: own.color,
    text: own.dark ? '#ffffff' : (match ? t.text : plain),
    heading: match ? t.heading : plain,
    link,
    accent: match ? t.accent : link,
    dark: own.dark,
    own: true,
  }
}

// A slide's colors as the CSS variables theme stylesheets read, which every
// slide's root (.px-slide, utils/slideHooks.js) carries in the editor, its
// thumbnails, the presented deck and the PDF
export function paletteVars(palette) {
  return { '--px-bg': palette.bg, '--px-text': palette.text, '--px-heading': palette.heading, '--px-link': palette.link, '--px-accent': palette.accent }
}

// camelCase CSS as a style attribute's text
export function cssText(style) {
  return Object.entries(style).map(([k, v]) => `${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}:${v};`).join('')
}
