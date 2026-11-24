// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// What a landing page template's own page (/templates/<slug>, built by
// server/services/site-pages.js) says about its deck: its theme, colors,
// fonts and text sizes, and what each slide holds. Bundled for the server
// by scripts/build-deck-html.js, so the page and the editor read a deck's
// theme the same way.

import { THEMES, deckTheme, slidePalette, deckTextStyles, deckTextFont } from './themes'
import { DEFAULT_SIZES } from './textStyles'
import { deckFont } from './deckFont'
import { SLIDE_TEMPLATES } from './slideLayouts'

// An element type's name, one and many
const KINDS = {
  text: ['text box', 'text boxes'], shape: ['shape', 'shapes'], image: ['image', 'images'], graph: ['graph', 'graphs'],
  equation: ['equation', 'equations'], code: ['code block', 'code blocks'], table: ['table', 'tables'], latex: ['LaTeX block', 'LaTeX blocks'],
  tikz: ['TikZ diagram', 'TikZ diagrams'], html: ['HTML embed', 'HTML embeds'], video: ['video', 'videos'], audio: ['audio clip', 'audio clips'],
  molecule: ['molecule', 'molecules'], model: ['3D model', '3D models'], feynman: ['Feynman diagram', 'Feynman diagrams'], circuit: ['circuit', 'circuits'],
  logic: ['logic diagram', 'logic diagrams'], freebody: ['free-body diagram', 'free-body diagrams'], venn: ['Venn diagram', 'Venn diagrams'],
  timing: ['timing diagram', 'timing diagrams'], geometry: ['geometry construction', 'geometry constructions'], periodic: ['periodic table', 'periodic tables'],
  harmonics: ['spherical harmonic', 'spherical harmonics'], timeline: ['timeline', 'timelines'], text3d: ['3D text', '3D text'], textpath: ['text on a path', 'texts on paths'],
  drawing: ['drawing', 'drawings'], icon: ['icon', 'icons'], callout: ['callout', 'callouts'], markdown: ['Markdown block', 'Markdown blocks'], p5: ['p5.js sketch', 'p5.js sketches'],
}
// The kinds a reader looks for first; text boxes and shapes come last
const PLAIN = new Set(['text', 'shape'])

function kindName(type, count) {
  if (typeof type === 'string' && type.startsWith('plugin:')) return count === 1 ? 'plugin' : 'plugins'
  const [one, many] = KINDS[type] || ['element', 'elements']
  return count === 1 ? one : many
}

// "Graph", "2 graphs"
const counted = (type, count) => {
  const name = kindName(type, count)
  return count === 1 ? name.replace(/^./, c => c.toUpperCase()) : `${count} ${name}`
}

// A font list's first family, as a person names it: Jost for "Jost, sans-serif"
const fontName = font => String(font || '').split(',')[0].replace(/['"]/g, '').trim()

// The words of a text box's first line
function firstLine(html) {
  const text = String(html || '')
    .replace(/<\/(p|h[1-6]|li|div|blockquote|pre|tr)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    // Numbered entities, such as the en space after a section's number
    .replace(/&#(x[0-9a-f]{1,6}|[0-9]{1,7});/gi, (m, n) => { const c = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m })
    .replace(/&amp;/g, '&')
  return text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).find(Boolean) || ''
}

const shorten = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

// The first heading (1 to 3) in a text box with words in it, not just a
// number, or ''
function headingIn(html) {
  for (const m of String(html || '').matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    // A heading broken over lines is one name
    const line = firstLine(m[2].replace(/<br\s*\/?>/gi, ' '))
    if (/\p{L}/u.test(line)) return line
  }
  return ''
}

// A slide's name: its own, or its title's heading or first line, or the
// first heading on it, or its highest text box's first line
function slideTitle(slide, index) {
  if (typeof slide?.name === 'string' && slide.name.trim()) return shorten(slide.name.trim(), 60)
  const texts = (slide?.elements || []).filter(el => el.type === 'text' && el.content).sort((a, b) => (a.y || 0) - (b.y || 0))
  const title = texts.find(el => el.placeholder === 'title')?.content
  const line = headingIn(title) || firstLine(title) || texts.map(el => headingIn(el.content)).find(Boolean) || texts.map(el => firstLine(el.content)).find(Boolean)
  return line ? shorten(line, 60) : `Slide ${index + 1}`
}

// How many of each kind of element, the ones a reader looks for first
function kindsOf(elements) {
  const counts = new Map()
  for (const el of elements || []) {
    const type = typeof el?.type === 'string' && el.type.startsWith('plugin:') ? 'plugin:' : el?.type
    if (!type) continue
    counts.set(type, (counts.get(type) || 0) + 1)
  }
  return [...counts].sort((a, b) => (PLAIN.has(a[0]) - PLAIN.has(b[0])) || b[1] - a[1])
}

// What a deck's own stylesheet says it is, from its opening comment: its
// first sentence or two, without the theme's name before them
function stylesheetNote(css) {
  const comment = /^\s*\/\*([\s\S]*?)\*\//.exec(css || '')
  if (!comment) return ''
  const text = comment[1].replace(/\s+/g, ' ').trim().replace(/^[^:.]{1,40}:\s*/, '')
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const note = sentences.slice(0, 2).join('').trim()
  const short = note.length > 240 ? sentences[0].trim() : note
  return short.replace(/^./, c => c.toUpperCase())
}

export function templateFacts(deck) {
  const themeId = typeof deck?.theme === 'string' ? deck.theme : 'black'
  const known = THEMES[themeId]
  const t = deckTheme(themeId, deck?.themeColors)
  const styles = deckTextStyles(deck?.textStyles, themeId) || {}
  const textFont = deckFont(deckTextFont(deck?.globalFont, themeId))
  const css = typeof deck?.themeCss === 'string' ? deck.themeCss.trim() : ''
  // A theme of the deck's own, named where it came from (customTheme.js)
  const named = typeof deck?.themeSource?.name === 'string' ? deck.themeSource.name.trim().slice(0, 80) : ''

  const colors = [['Background', t.background], ['Text', t.text], ['Headings', t.heading], ['Links', t.link], ['Accent', t.accent]]
    .filter(([, value], i, all) => value && all.findIndex(([, v]) => v === value) === i)
    .map(([name, value]) => ({ name, value }))

  const slides = (Array.isArray(deck?.slides) ? deck.slides : []).map((slide, i) => {
    const palette = slidePalette(slide, themeId, deck?.themeColors)
    return {
      title: slideTitle(slide, i),
      // A blank slide's layout says nothing about it
      layout: slide?.layout !== 'blank' ? SLIDE_TEMPLATES[slide?.layout]?.label || '' : '',
      kinds: kindsOf(slide?.elements).filter(([type]) => !PLAIN.has(type)).map(([type, n]) => counted(type, n)),
      background: palette.bg || t.background,
      text: palette.text,
    }
  })
  const all = kindsOf((deck?.slides || []).flatMap(s => s?.elements || []))

  return {
    theme: {
      id: themeId,
      label: named || known?.label || themeId,
      base: known?.label || themeId,
      named: !!named,
      note: named ? stylesheetNote(css) : known?.note || '',
      ownColors: !!deck?.themeColors && Object.keys(deck.themeColors).length > 0,
      stylesheet: css,
    },
    colors,
    fonts: { text: fontName(textFont), heading: fontName(styles.headingFont) || fontName(textFont) },
    sizes: [
      ['Body text', styles.bodySize ?? DEFAULT_SIZES.bodySize],
      ['Heading 1', styles.h1Size ?? DEFAULT_SIZES.h1Size],
      ['Heading 2, slide titles', styles.h2Size ?? DEFAULT_SIZES.h2Size],
      ['Heading 3', styles.h3Size ?? DEFAULT_SIZES.h3Size],
    ].map(([name, px]) => ({ name, px: Math.round(px) })),
    slides,
    contents: all.map(([type, n]) => counted(type, n)),
  }
}
