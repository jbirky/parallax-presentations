// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/copy-click-actions.js from client/src/utils/themes.js;
// edit that, then run the script.

// The presentation themes: reveal.js 5's, whose page color, heading color and
// link color show when presenting, and Parallax's own (Bauhaus, Pixel), which
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

const THEME_LIST = [
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
]

const THEMES = Object.fromEntries(THEME_LIST.map(t => [t.id, t]))

function themeOf(id) {
  return THEMES[id] || THEMES.black
}

// The reveal.js theme stylesheet (dist/theme/<name>.css) a theme is drawn on:
// its own for reveal's themes, the one it names for Parallax's
function revealTheme(id) {
  return THEMES[id]?.reveal || id
}

// The font a deck's text is set in: the deck's own (Settings › Font), or its
// theme's, or '' for the default (deckFont.js)
function deckTextFont(globalFont, themeId) {
  return (typeof globalFont === 'string' && globalFont.trim()) || THEMES[themeId]?.font || ''
}

// A deck's text styles (deck.textStyles, utils/textStyles.js), with its
// theme's where it has none of its own
function deckTextStyles(textStyles, themeId) {
  const theirs = THEMES[themeId]?.textStyles
  if (!theirs) return textStyles || null
  const own = textStyles && typeof textStyles === 'object' ? textStyles : {}
  const out = { ...theirs }
  for (const [key, value] of Object.entries(own)) if (value != null && value !== '') out[key] = value
  return out
}

// The background every slide had before themes showed in the editor; a new
// slide after one of these keeps it, so older decks stay as they are
const LEGACY_BACKGROUND = { type: 'color', color: '#1e1e2e' }

function isLegacyBackground(bg) {
  return bg?.type === 'color' && String(bg.color || '').toLowerCase() === '#1e1e2e'
}

// A new slide's background, after `slide`: none of its own (the theme's),
// unless the slide before has the old default
function newSlideBackground(slide) {
  return isLegacyBackground(slide?.background) ? { ...LEGACY_BACKGROUND } : undefined
}

// "#abc", "#aabbcc" or "rgb(…)/rgba(…)" as [r, g, b], or null
function parseColor(value) {
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

function isDark(value, fallback = true) {
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
function ownBackground(bg) {
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
const THEME_COLOR_KEYS = ['background', 'text', 'heading', 'link', 'accent']
const COLOR_VALUE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\))$/i

// The colors a deck has that can be used, or null when it has none
function cleanThemeColors(colors) {
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
function deckTheme(themeId, colors) {
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
function themeBackgroundStyle(themeId, colors = null) {
  const t = deckTheme(themeId, colors)
  return t.backgroundCss ? { background: t.backgroundCss } : { backgroundColor: t.background }
}

// What a slide shows: its background (CSS, camelCase) and a color for it
// (bg), its text, heading, link and accent colors, and whether it's dark.
// colors are the deck's own (deck.themeColors).
function slidePalette(slide, themeId, colors = null) {
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
function paletteVars(palette) {
  return { '--px-bg': palette.bg, '--px-text': palette.text, '--px-heading': palette.heading, '--px-link': palette.link, '--px-accent': palette.accent }
}

// camelCase CSS as a style attribute's text
function cssText(style) {
  return Object.entries(style).map(([k, v]) => `${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}:${v};`).join('')
}

module.exports = { THEME_LIST, THEMES, themeOf, revealTheme, deckTextFont, deckTextStyles, LEGACY_BACKGROUND, isLegacyBackground, newSlideBackground, parseColor, isDark, ownBackground, THEME_COLOR_KEYS, cleanThemeColors, deckTheme, themeBackgroundStyle, slidePalette, paletteVars, cssText }
