// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The deck's text styles (deck.textStyles), from the Themes panel's Text tab:
// how big body text and headings are, and the headings' font and weight.
// Text a person sized or set in a font of its own keeps it. A deck without
// them sets text as it always has: body text in 42px, headings 2.5, 1.6 and
// 1.3 times that (Heading 2 is the layouts' slide titles), bold, in the
// deck's font. The editor's canvas and thumbnails, the presented deck and
// the PDF all read them from here.
//
//   { bodySize, h1Size, h2Size, h3Size }  px on the slide
//   headingFont                            a CSS font family list
//   headingWeight                          400 to 900

export const BODY_SIZE = 42
export const HEADING_SCALE = { h1: 2.5, h2: 1.6, h3: 1.3 }
export const SIZE_KEYS = ['bodySize', 'h1Size', 'h2Size', 'h3Size']
export const MIN_SIZE = 8
export const MAX_SIZE = 300
export const HEADING_WEIGHTS = [400, 500, 600, 700, 800, 900]

// What each size is without a style of its own, in px
export const DEFAULT_SIZES = {
  bodySize: BODY_SIZE,
  h1Size: BODY_SIZE * HEADING_SCALE.h1,
  h2Size: BODY_SIZE * HEADING_SCALE.h2,
  h3Size: BODY_SIZE * HEADING_SCALE.h3,
}

// A font family list that's safe to write into a page's CSS
const FONT = /^[\w\s,'"-]{1,200}$/

// The styles a deck has that can be used, or null when it has none: sizes
// in range, a font that's a font list, a weight from the list
export function cleanTextStyles(styles) {
  if (!styles || typeof styles !== 'object') return null
  const out = {}
  for (const key of SIZE_KEYS) {
    const n = Number(styles[key])
    if (styles[key] != null && styles[key] !== '' && Number.isFinite(n) && n >= MIN_SIZE && n <= MAX_SIZE) out[key] = Math.round(n * 10) / 10
  }
  const font = typeof styles.headingFont === 'string' ? styles.headingFont.trim() : ''
  if (font && FONT.test(font)) out.headingFont = font
  const weight = Number(styles.headingWeight)
  if (HEADING_WEIGHTS.includes(weight)) out.headingWeight = weight
  return Object.keys(out).length ? out : null
}

// Every size in px, a deck's own or the default
export function textSizes(styles) {
  const clean = cleanTextStyles(styles) || {}
  return Object.fromEntries(SIZE_KEYS.map(key => [key, clean[key] ?? DEFAULT_SIZES[key]]))
}

const round = n => Math.round(n * 10000) / 10000

// The headings' sizes as multiples of body text's: headings are sized in em,
// so a heading keeps its size when only body text changes
export function headingEms(styles) {
  const s = textSizes(styles)
  return { h1: round(s.h1Size / s.bodySize), h2: round(s.h2Size / s.bodySize), h3: round(s.h3Size / s.bodySize) }
}

// For the editor's canvas and thumbnails: CSS variables that index.css's
// text box rules read, falling back to the defaults (React style, so
// custom properties as they are). Empty without styles.
export function textStyleVars(styles) {
  const clean = cleanTextStyles(styles)
  if (!clean) return {}
  const em = headingEms(clean)
  const vars = {
    '--ts-body': `${textSizes(clean).bodySize}px`,
    '--ts-h1': `${em.h1}em`,
    '--ts-h2': `${em.h2}em`,
    '--ts-h3': `${em.h3}em`,
  }
  if (clean.headingFont) vars['--ts-heading-font'] = clean.headingFont
  if (clean.headingWeight) vars['--ts-heading-weight'] = String(clean.headingWeight)
  return vars
}

// A text box's body size for a page's inline style ("font-size:36px;"),
// or '' without a size of the deck's own
export function bodySizeStyle(styles) {
  const clean = cleanTextStyles(styles)
  return clean?.bodySize != null ? `font-size:${clean.bodySize}px;` : ''
}

// For presented decks and the PDF: rules after the page's own heading rules,
// for the headings in `scope` (a selector for a slide), or '' without styles
export function textStyleCss(styles, scope) {
  const clean = cleanTextStyles(styles)
  if (!clean) return ''
  const em = headingEms(clean)
  const rules = [
    `${scope} h1 { font-size: ${em.h1}em; }`,
    `${scope} h2 { font-size: ${em.h2}em; }`,
    `${scope} h3 { font-size: ${em.h3}em; }`,
  ]
  const heading = [
    clean.headingFont && `font-family: ${clean.headingFont};`,
    clean.headingWeight && `font-weight: ${clean.headingWeight};`,
  ].filter(Boolean).join(' ')
  if (heading) rules.push(`${scope} :is(h1, h2, h3, h4, h5, h6) { ${heading} }`)
  return rules.join('\n')
}

// A changed copy of `styles`: `patch`'s values set, and null, '' or a
// default size removed, so a deck back at the defaults has none
export function withTextStyles(styles, patch) {
  const next = { ...(styles || {}), ...patch }
  for (const [key, value] of Object.entries(next)) {
    if (value == null || value === '') delete next[key]
    else if (SIZE_KEYS.includes(key) && Math.abs(Number(value) - DEFAULT_SIZES[key]) < 0.05) delete next[key]
    else if (key === 'headingWeight' && Number(value) === 700) delete next[key]
  }
  return cleanTextStyles(next)
}
