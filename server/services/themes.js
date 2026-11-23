// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/copy-click-actions.js from client/src/utils/themes.js;
// edit that, then run the script.

// The presentation themes: reveal.js 5's, whose page color, heading color and
// link color show when presenting. Parallax sets its own fonts (the deck's
// font), so a theme here is its colors.
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
]

const THEMES = Object.fromEntries(THEME_LIST.map(t => [t.id, t]))

function themeOf(id) {
  return THEMES[id] || THEMES.black
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

// A slide's own background as CSS (camelCase), with whether it's dark; null
// when it has none and shows the theme's
function ownBackground(bg) {
  if (!bg) return null
  if (bg.type === 'color' && bg.color) return { style: { backgroundColor: bg.color }, dark: isDark(bg.color) }
  if (bg.type === 'gradient' && bg.gradient) return { style: { background: bg.gradient }, dark: isDark(firstColor(bg.gradient)) }
  if (bg.type === 'image' && bg.image) return { style: { backgroundImage: `url(${bg.image})`, backgroundSize: bg.size || 'cover', backgroundPosition: bg.position || 'center' }, dark: true }
  return null
}

// The theme's page as CSS (camelCase)
function themeBackgroundStyle(themeId) {
  const t = themeOf(themeId)
  return t.backgroundCss ? { background: t.backgroundCss } : { backgroundColor: t.background }
}

// What a slide shows: its background (CSS, camelCase), text, heading and link
// colors, and whether it's dark
function slidePalette(slide, themeId) {
  const t = themeOf(themeId)
  const own = ownBackground(slide?.background)
  if (!own) return { background: themeBackgroundStyle(themeId), text: t.text, heading: t.heading, link: t.link, dark: t.dark, own: false }
  const match = own.dark === t.dark
  const plain = own.dark ? '#ffffff' : '#222222'
  return {
    background: own.style,
    text: own.dark ? '#ffffff' : (match ? t.text : plain),
    heading: match ? t.heading : plain,
    link: match ? t.link : (own.dark ? '#42affa' : '#2a76dd'),
    dark: own.dark,
    own: true,
  }
}

// camelCase CSS as a style attribute's text
function cssText(style) {
  return Object.entries(style).map(([k, v]) => `${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}:${v};`).join('')
}

module.exports = { THEME_LIST, THEMES, themeOf, LEGACY_BACKGROUND, isLegacyBackground, newSlideBackground, parseColor, isDark, ownBackground, themeBackgroundStyle, slidePalette, cssText }
