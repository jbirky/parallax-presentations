// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A theme as one document, for the theme library (/api/themes), .json export
// and import: a built-in theme to start from, the deck's own colors, font,
// text styles and stylesheet.
//
//   { name, base, colors?, font?, textStyles?, css? }
//
// In a deck it isn't one object: applying a theme writes the deck fields
// each panel already reads (theme, themeColors, globalFont, textStyles,
// themeCss) and remembers where it came from (themeSource: { id, name,
// version }), so the Themes panel can offer the library's newer version.
// The server checks what's saved with cleanThemeDoc (bundled into
// server/mcp/shared.js).

import { THEMES, cleanThemeColors } from './themes'
import { cleanTextStyles } from './textStyles'
import { MAX_THEME_CSS } from './scopeCss'

export const MAX_THEME_NAME = 80
export const MAX_LIBRARY_THEMES = 100
export const THEME_FILE_FORMAT = 1

const FONT = /^[\w\s,'"-]{1,200}$/

export class ThemeDocError extends Error {}
const fail = message => { throw new ThemeDocError(message) }

// A theme document from what was given (a request body, a file), checked:
// a name and a built-in base are needed; colors, text styles and a font that
// can't be used are refused rather than dropped, so nobody saves less than
// they think
export function cleanThemeDoc(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('A theme must be an object.')
  const name = typeof input.name === 'string' ? input.name.replace(/\s+/g, ' ').trim() : ''
  if (!name) fail('A theme needs a name.')
  if (name.length > MAX_THEME_NAME) fail(`A theme's name can be up to ${MAX_THEME_NAME} characters.`)
  const base = typeof input.base === 'string' && Object.prototype.hasOwnProperty.call(THEMES, input.base) ? input.base : null
  if (!base) fail(`A theme's base must be one of: ${Object.keys(THEMES).join(', ')}.`)
  const doc = { name, base }
  if (input.colors != null) {
    const colors = cleanThemeColors(input.colors)
    const given = typeof input.colors === 'object' ? Object.keys(input.colors).filter(k => input.colors[k] != null && input.colors[k] !== '') : []
    if (given.length && (!colors || Object.keys(colors).length !== given.length)) fail('A theme\'s colors must be background, text, heading, link and accent, each a hex or rgb() color.')
    if (colors) doc.colors = colors
  }
  if (input.font != null && input.font !== '') {
    if (typeof input.font !== 'string' || !FONT.test(input.font.trim())) fail('A theme\'s font must be a CSS font family list, such as "Georgia, serif".')
    doc.font = input.font.trim()
  }
  if (input.textStyles != null) {
    const styles = cleanTextStyles(input.textStyles)
    const given = typeof input.textStyles === 'object' ? Object.keys(input.textStyles).filter(k => input.textStyles[k] != null && input.textStyles[k] !== '') : []
    if (given.length && (!styles || Object.keys(styles).length !== given.length)) fail('A theme\'s text styles must be sizes from 8 to 300 px, a heading font and a weight from 400 to 900.')
    if (styles) doc.textStyles = styles
  }
  if (input.css != null && input.css !== '') {
    if (typeof input.css !== 'string') fail('A theme\'s css must be text.')
    if (input.css.length > MAX_THEME_CSS) fail(`A theme's stylesheet can be up to ${MAX_THEME_CSS} characters.`)
    if (input.css.trim()) doc.css = input.css
  }
  return doc
}

// The theme a deck has, as a document named `name`
export function themeDocFromDeck(deck, name) {
  return cleanThemeDoc({
    name,
    base: Object.prototype.hasOwnProperty.call(THEMES, deck?.theme) ? deck.theme : 'black',
    colors: cleanThemeColors(deck?.themeColors),
    font: typeof deck?.globalFont === 'string' ? deck.globalFont : null,
    textStyles: cleanTextStyles(deck?.textStyles),
    css: typeof deck?.themeCss === 'string' ? deck.themeCss : null,
  })
}

// A deck with `doc` applied: its theme fields replaced by the document's
// (what it doesn't have, gone), and `source` ({ id, version } of a library
// theme) remembered, or forgotten without one
export function applyThemeDoc(deck, doc, source = null) {
  const { themeColors, globalFont, textStyles, themeCss, themeSource, ...rest } = deck
  const next = { ...rest, theme: doc.base }
  if (doc.colors) next.themeColors = doc.colors
  if (doc.font) next.globalFont = doc.font
  if (doc.textStyles) next.textStyles = doc.textStyles
  if (doc.css) next.themeCss = doc.css
  if (source?.id) next.themeSource = { id: String(source.id), name: doc.name, version: Number(source.version) || 1 }
  return next
}

// Whether a deck's theme fields differ from a document's (its name aside)
export function themeDiffers(deck, doc) {
  const mine = themeDocFromDeck(deck, doc.name)
  return JSON.stringify(sorted(mine)) !== JSON.stringify(sorted({ ...doc, name: doc.name }))
}

function sorted(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.keys(value).sort().filter(k => !['id', 'version', 'createdAt', 'updatedAt'].includes(k)).map(k => [k, sorted(value[k])]))
}

// A document as a .json file's text
export function themeFileText(doc) {
  const { name, base, colors, font, textStyles, css } = doc
  return JSON.stringify({ parallaxTheme: THEME_FILE_FORMAT, name, base, colors, font, textStyles, css }, null, 2) + '\n'
}

// A .json file's text as a document; throws ThemeDocError saying what's wrong
export function readThemeFile(text) {
  let parsed
  try { parsed = JSON.parse(text) } catch { fail('That file isn\'t a theme: it isn\'t JSON.') }
  if (!parsed || typeof parsed !== 'object' || (parsed.parallaxTheme !== undefined && parsed.parallaxTheme !== THEME_FILE_FORMAT)) fail('That file isn\'t a Parallax theme.')
  return cleanThemeDoc(parsed)
}

// A file name for a theme
export function themeFileName(name) {
  return `${String(name || 'theme').toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '') || 'theme'}.parallax-theme.json`
}
