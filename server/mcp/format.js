// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A deck as Markdown, for AI collaborators (server/mcp): the outline get_deck
// returns, one slide's elements for get_slide, the whole deck as text for the
// link's readable page, and text boxes' HTML as Markdown. A deck's HTML is
// someone else's, so it's only ever read here as text, never run or rendered.
//
// Text boxes come out as Markdown with $…$ for math and [@key] for
// citations, the form the AI will write them in.

const shared = require('./shared')
const { THEMES, deckTheme, cleanThemeColors, deckTextFont } = require('../services/themes')

const SLIDE_W = 960
const SLIDE_H = 540
const MAX_TEXT = 4000      // characters of one text box in get_slide
const MAX_FIELD = 160      // characters of one other field
const MAX_PAGE = 200000    // characters of the readable page's deck text

// ── HTML as a tree ────────────────────────────────────────────────────────

const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'col', 'source', 'wbr', 'area', 'base', 'embed', 'track'])
// Elements whose contents aren't text for a reader
const SKIP = new Set(['script', 'style', 'template', 'iframe', 'object', 'svg', 'math', 'noscript', 'head', 'title', 'textarea', 'select'])
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', ndash: '–', mdash: '—', hellip: '…', times: '×',
  middot: '·', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', deg: '°', plusmn: '±',
  copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', minus: '−', le: '≤', ge: '≥', ne: '≠', rarr: '→', larr: '←',
}

function decodeEntities(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m
  })
}

function parseAttrs(s) {
  const attrs = {}
  const re = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let m
  while ((m = re.exec(s))) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  return attrs
}

// HTML as { tag, attrs, children }, children being nodes and strings. Lenient,
// as a browser is: a stray close tag is dropped, an unclosed one closes with
// its parent.
function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [] }
  const stack = [root]
  const src = String(html || '')
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g
  const top = () => stack[stack.length - 1]
  const text = s => { if (s) top().children.push(decodeEntities(s)) }
  let last = 0
  let m
  while ((m = re.exec(src))) {
    text(src.slice(last, m.index))
    last = re.lastIndex
    if (m[0].startsWith('<!--')) continue
    if (m[1]) {
      const at = stack.map(n => n.tag).lastIndexOf(m[1].toLowerCase())
      if (at > 0) stack.length = at
      continue
    }
    const tag = m[2].toLowerCase()
    const node = { tag, attrs: parseAttrs(m[3] || ''), children: [] }
    top().children.push(node)
    if (SKIP.has(tag)) {
      const end = src.toLowerCase().indexOf(`</${tag}`, last)
      last = re.lastIndex = end < 0 ? src.length : end
      continue
    }
    if (!VOID.has(tag) && !m[4]) stack.push(node)
  }
  text(src.slice(last))
  return root
}

// ── The tree as Markdown ──────────────────────────────────────────────────

const BLOCK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table',
  'thead', 'tbody', 'tfoot', 'tr', 'hr', 'figure', 'figcaption', 'section', 'article', 'header', 'footer', 'aside', 'nav',
  'dl', 'dt', 'dd', 'details', 'summary', 'main', 'address'])
const BREAK = '\u2028' // a <br>, kept through whitespace collapsing
const isBlock = node => typeof node !== 'string' && BLOCK.has(node.tag)
const isMath = node => node.attrs['data-math-latex'] != null
const isCite = node => node.attrs['data-cite'] != null

const escapeText = s => s.replace(/([\\`*_[\]$])/g, '\\$1')
function tidy(s) {
  return s.replace(/[ \t\r\n\f\u00a0]+/g, ' ').replace(/ ?\u2028 ?/g, '\n').trim()
}
const plainOf = node => (typeof node === 'string' ? node : isMath(node) ? `$${node.attrs['data-math-latex']}$` : node.tag === 'br' ? ' ' : node.children.map(plainOf).join(''))

// Markdown emphasis around words, keeping the spaces outside it
function wrap(marker, inner) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)
  return m[2] ? `${m[1]}${marker}${m[2]}${marker}${m[3]}` : inner
}
const safeHref = href => (/^(https?:|mailto:|#|\/)/i.test(href) ? href.replace(/[()\s]/g, c => encodeURIComponent(c)) : '')

function inlineOf(node) {
  if (typeof node === 'string') return escapeText(node)
  const inner = () => node.children.map(inlineOf).join('')
  if (isMath(node)) {
    const latex = node.attrs['data-math-latex']
    return node.attrs['data-math-display'] === 'true' ? `$$${latex}$$` : `$${latex}$`
  }
  if (isCite(node)) return `[@${node.attrs['data-cite']}]`
  switch (node.tag) {
    case 'br': return BREAK
    case 'strong': case 'b': return wrap('**', inner())
    case 'em': case 'i': case 'cite': return wrap('*', inner())
    case 's': case 'del': case 'strike': return wrap('~~', inner())
    case 'code': case 'kbd': case 'samp': return '`' + plainOf(node).replace(/`/g, 'ˋ') + '`'
    case 'a': {
      const href = safeHref(node.attrs.href || '')
      const text = inner()
      return href && text.trim() ? `[${text}](${href})` : text
    }
    case 'img': {
      const src = node.attrs.src || ''
      return `![${escapeText(node.attrs.alt || '')}](${src.startsWith('data:') ? 'embedded image' : safeHref(src) || 'image'})`
    }
    case 'input': return node.attrs.type === 'checkbox' ? (node.attrs.checked != null ? '[x] ' : '[ ] ') : ''
    default: return inner()
  }
}

// A node's children as Markdown blocks; inline runs between blocks become
// paragraphs
function blocksOf(node) {
  const out = []
  let line = ''
  const flush = () => {
    const t = tidy(line)
    if (t) out.push(t)
    line = ''
  }
  for (const child of node.children) {
    if (isBlock(child)) {
      flush()
      out.push(...blockOf(child))
    } else {
      line += inlineOf(child)
    }
  }
  flush()
  return out
}

// Everything inside a node on one line (a heading, a table cell)
const oneLine = node => tidy(blocksOf(node).join(' ').replace(/\n/g, ' '))

function listOf(node) {
  const ordered = node.tag === 'ol'
  let n = Number(node.attrs.start) || 1
  const lines = []
  for (const child of node.children) {
    if (typeof child === 'string' && !child.trim()) continue
    const item = typeof child !== 'string' && child.tag === 'li' ? child : { tag: 'li', attrs: {}, children: [child] }
    const marker = ordered ? `${n++}. ` : '- '
    const pad = ' '.repeat(marker.length)
    const parts = blocksOf(item)
    if (!parts.length) { lines.push(marker.trim()); continue }
    parts.forEach((part, k) => {
      part.split('\n').forEach((l, j) => lines.push((k === 0 && j === 0 ? marker : l ? pad : '') + l))
    })
  }
  return lines.join('\n')
}

function rowsOf(node) {
  const rows = []
  const visit = n => {
    for (const c of n.children) {
      if (typeof c === 'string') continue
      if (c.tag === 'tr') rows.push(c.children.filter(x => typeof x !== 'string' && (x.tag === 'td' || x.tag === 'th')).map(cell => oneLine(cell).replace(/\|/g, '\\|')))
      else visit(c)
    }
  }
  visit(node)
  return rows
}

function blockOf(node) {
  const h = /^h([1-6])$/.exec(node.tag)
  if (h) {
    const text = oneLine(node)
    return text ? ['#'.repeat(Number(h[1])) + ' ' + text] : []
  }
  switch (node.tag) {
    case 'ul': case 'ol': {
      const list = listOf(node)
      return list ? [list] : []
    }
    case 'li': return blockOf({ tag: 'ul', attrs: {}, children: [node] })
    case 'blockquote': return blocksOf(node).map(b => b.split('\n').map(l => (l ? '> ' + l : '>')).join('\n'))
    case 'pre': {
      const code = node.children.find(c => typeof c !== 'string' && c.tag === 'code')
      const lang = /language-([\w+-]+)/.exec((code && code.attrs.class) || '')
      return ['```' + (lang ? lang[1] : '') + '\n' + plainOf(node).replace(/\n+$/, '').replace(/```/g, 'ˋˋˋ') + '\n```']
    }
    case 'hr': return ['---']
    case 'table': {
      const rows = rowsOf(node).filter(r => r.length)
      if (!rows.length) return []
      const width = Math.max(...rows.map(r => r.length))
      const line = r => '| ' + Array.from({ length: width }, (_, i) => r[i] || '').join(' | ') + ' |'
      return [[line(rows[0]), '| ' + Array(width).fill('---').join(' | ') + ' |', ...rows.slice(1).map(line)].join('\n')]
    }
    default: return blocksOf(node)
  }
}

// A text box's HTML (TipTap's) as Markdown
function htmlToMarkdown(html) {
  return blocksOf(parseHtml(html)).join('\n\n')
}

// A text box's words, without formatting
function textOf(html) {
  return tidy(plainOf(parseHtml(html)))
}

// ── Slides ────────────────────────────────────────────────────────────────

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
const textBoxes = slide => (slide.elements || []).filter(e => e && e.type === 'text')
const hasText = el => !!textOf(el.content)

// A slide's title, as the outline reads it (client/src/utils/outline.js): the
// first heading (h1–h3) of the topmost text box that starts with one, or of
// the box marked outline: 'title'
function titleOf(slide) {
  const firstChild = el => parseHtml(el.content).children.find(c => typeof c !== 'string' || c.trim())
  const isHeading = el => {
    const first = firstChild(el)
    return !!first && typeof first !== 'string' && /^h[1-3]$/.test(first.tag)
  }
  const texts = textBoxes(slide)
  const box = texts.find(e => e.outline === 'title')
    || texts.filter(isHeading).sort((a, b) => (a.y - b.y) || (a.x - b.x))[0]
  if (!box) return ''
  const first = firstChild(box)
  return first && typeof first !== 'string' ? tidy(plainOf(first)) : ''
}

// Slides in the order they're shown: in a 2D deck, column by column, with
// the slides under a column's first marked vertical (as outline.js)
function slideOrder(slides) {
  if (!slides.some(s => s && s.column !== undefined)) return slides.map((_, index) => ({ index, vertical: false }))
  const cols = new Map()
  slides.forEach((s, i) => {
    const c = (s && s.column) ?? 0
    if (!cols.has(c)) cols.set(c, [])
    cols.get(c).push(i)
  })
  return [...cols.keys()].sort((a, b) => a - b).flatMap(c => cols.get(c).map((index, k) => ({ index, vertical: k > 0 })))
}

// The slides as shown: [{ slide, number, vertical }]
function shownSlides(deck) {
  const slides = Array.isArray(deck && deck.slides) ? deck.slides.filter(Boolean) : []
  return slideOrder(slides).map(({ index, vertical }, k) => ({ slide: slides[index], number: k + 1, vertical }))
}

// A slide by its number as shown (1 is the first) or its id; null when none
function findSlide(deck, ref) {
  const shown = shownSlides(deck)
  if (typeof ref === 'number' || /^\d+$/.test(String(ref))) return shown[Number(ref) - 1] || null
  return shown.find(s => s.slide.id === ref) || null
}

const notesText = notes => {
  const s = String(notes || '')
  return /<[a-z][\s\S]*>/i.test(s) ? htmlToMarkdown(s) : s.trim()
}
const outlineNotes = slide => (Array.isArray(slide.outlineNotes) ? slide.outlineNotes : [])
  .filter(n => n && String(n.text || '').trim())
  .map(n => '  '.repeat(Math.max(0, Math.min(2, Number(n.level) || 0))) + '- ' + String(n.text).replace(/\s+/g, ' ').trim())

function typeCounts(slide) {
  const counts = new Map()
  for (const el of slide.elements || []) {
    if (!el || el.layoutPart) continue
    const t = String(el.type || 'element')
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  return [...counts].map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(', ')
}

// The deck's text styles in short (client/src/utils/textStyles.js): every
// size once it has any, and the headings' font and weight; '' without them
function textStylesFacts(styles) {
  const clean = shared.cleanTextStyles(styles)
  if (!clean) return ''
  const s = shared.textSizes(clean)
  const px = n => `${Math.round(n * 10) / 10}px`
  return [
    `text H1 ${px(s.h1Size)}, H2 (slide titles) ${px(s.h2Size)}, H3 ${px(s.h3Size)}, body ${px(s.bodySize)}`,
    clean.headingFont && `heading font ${clean.headingFont.split(',')[0].replace(/['"]/g, '').trim()}`,
    clean.headingWeight && `heading weight ${clean.headingWeight}`,
  ].filter(Boolean).join(' · ')
}

// The deck's own colors and stylesheet in short; '' without them
function themeFacts(deck) {
  const colors = cleanThemeColors(deck.themeColors)
  const css = typeof deck.themeCss === 'string' && deck.themeCss.trim() ? deck.themeCss.length : 0
  return [
    colors && `own colors ${Object.entries(colors).map(([key, value]) => `${key} ${value}`).join(', ')}`,
    css && `stylesheet ${css < 1000 ? `${css} characters` : `${Math.round(css / 100) / 10} KB`} (get_theme)`,
  ].filter(Boolean).join(' · ')
}

// The theme in full, for get_theme: what slides show, the deck's own colors,
// fonts and text styles, its stylesheet and what was left out of it, and
// what a stylesheet's rules can target. layouts are the layouts' keys.
function themeText(deck, layouts = []) {
  const id = THEMES[deck.theme] ? deck.theme : 'black'
  const base = THEMES[id]
  const own = cleanThemeColors(deck.themeColors)
  const t = deckTheme(id, own)
  const font = deckTextFont(deck.globalFont, id)
  const lines = [
    '# Theme',
    '',
    `Base theme: ${base.label} (${id}), ${t.dark ? 'dark' : 'light'}${base.note ? `. ${base.note}` : ''}.`,
    own ? `The deck's own colors: ${Object.entries(own).map(([key, value]) => `${key} ${value}`).join(', ')}.` : "No colors of the deck's own (themeColors).",
    deck.themeSource?.name ? `Applied from the owner's saved theme "${String(deck.themeSource.name).slice(0, 80)}" (version ${Number(deck.themeSource.version) || 1}); changes here don't change the saved theme.` : null,
    `Slides without a background of their own show: page ${t.background}, text ${t.text}, headings ${t.heading}, links ${t.link}, accent ${t.accent}. A slide with its own background keeps colors that show on it.`,
    `Font: ${font ? font.split(',')[0].replace(/['"]/g, '').trim() : 'Arial (default)'}. ${textStylesFacts(deck.textStyles) || 'Text sizes: the defaults (H1 105px, H2 67.2px, H3 54.6px, body 42px).'}`,
    '',
    '## Stylesheet (themeCss)',
    '',
  ].filter(line => line !== null)
  const source = typeof deck.themeCss === 'string' ? deck.themeCss : ''
  if (source.trim()) {
    lines.push('```css', source.trimEnd(), '```')
    const { dropped } = shared.scopeThemeCss(source)
    if (dropped.length) lines.push('', `Left out when drawn: ${dropped.slice(0, 20).map(d => `${d.line ? `line ${d.line}: ` : ''}${d.reason}`).join('; ')}.`)
  } else {
    lines.push('None yet. update_deck\'s themeCss sets one.')
  }
  lines.push(
    '',
    '## What a stylesheet can target',
    '',
    'Every rule is scoped to a slide, written as if .px-slide were in front of it: `h2 { … }` styles headings on slides only, and :root, html and body mean the slide.',
    '',
    '- `.px-slide`: every slide; `.px-slide[data-layout=…]`: slides in one layout' + (layouts.length ? ` (${layouts.join(', ')})` : ''),
    '- `.px-text`: every text box; `[data-placeholder=title]`, `subtitle`, `body`: a layout\'s placeholders',
    '- Slide titles are h2 in most layouts and h1 in section-header and big-number; body text is p, and lists ul or ol with li',
    '- `var(--px-bg)`, `var(--px-text)`, `var(--px-heading)`, `var(--px-link)`, `var(--px-accent)`: the slide\'s colors, as above',
    '- `var(--ts-body)`, `var(--ts-h1)`…`var(--ts-h3)`, `var(--ts-heading-font)`: the text styles, when set',
    '- `.px-slide[data-own-background]`: slides with a background of their own',
    '- `.px-footer` (with data-footer="sequence" or "basic"), `.px-footer-label`, `.px-footer-page`, `.px-footer-time`: the footer; in a sequence, each `.px-footer-section` has data-state past, current or future for this slide, and its color as var(--px-section-color). The presented deck sets the footer\'s color and font with !important, so a rule that changes them needs !important too',
    '',
    'Allowed: rules, @media, @supports, @font-face, @keyframes, and nested rules written with & (`& h2 { … }`). url() and @import only for uploads, data: URLs and the font hosts decks load (Google Fonts, cdnfonts, jsDelivr). Left out: position: fixed, other at-rules, selectors that reach outside a slide (+ or ~ after .px-slide), and \\ escapes outside strings. Text a person colored or sized by hand keeps it unless a rule uses !important.',
  )
  return lines.join('\n')
}

function deckFacts(deck) {
  const w = Number(deck.slideWidth) || SLIDE_W
  const h = Number(deck.slideHeight) || SLIDE_H
  return [
    `${w}×${h}`,
    `theme ${deck.theme || 'black'}`,
    `font ${deck.globalFont ? String(deck.globalFont).split(',')[0].replace(/['"]/g, '') : 'Arial (default)'}`,
    textStylesFacts(deck.textStyles),
    themeFacts(deck),
    deck.transition && `transition ${deck.transition}`,
  ].filter(Boolean).join(' · ')
}

// The deck's outline, for get_deck: a line per slide with its number, title,
// id, layout, minutes and what's on it, under its section, and each slide's
// outline and speaker notes in short
function deckOutline(deck) {
  const shown = shownSlides(deck)
  const planned = shown.reduce((sum, { slide }) => sum + (Number(slide.minutes) > 0 ? Number(slide.minutes) : 0), 0)
  const target = Number(deck.timerDuration != null ? deck.timerDuration : 20) || 0
  const lines = [
    `# ${deck.title || 'Untitled'}`,
    '',
    `${deckFacts(deck)} · ${shown.length} slide${shown.length === 1 ? '' : 's'}`,
    `Talk length: ${target} minutes${planned ? `; the slides plan ${Math.round(planned * 10) / 10}` : ''}.`,
  ]
  let section = null
  shown.forEach(({ slide, number, vertical }) => {
    const label = slide.section || ''
    if (label !== section || slide.sectionStart) {
      section = label
      lines.push('', label ? `## Section: ${label}` : '## (no section)')
    }
    const title = titleOf(slide)
    const facts = [
      '`' + slide.id + '`',
      slide.layout && `layout ${slide.layout}`,
      Number(slide.minutes) > 0 && `${slide.minutes} min`,
      typeCounts(slide) || 'empty',
    ].filter(Boolean).join(' · ')
    lines.push(`${number}. ${vertical ? '↓ ' : ''}**${title ? escapeText(clip(title, 120)) : '(no title)'}** · ${facts}`)
    const outline = outlineNotes(slide)
    if (outline.length) lines.push(...outline.slice(0, 6).map(l => '   ' + clip(l, 160)), ...(outline.length > 6 ? [`   - … ${outline.length - 6} more`] : []))
    const notes = notesText(slide.notes)
    if (notes) lines.push(`   Speaker notes: ${clip(notes.replace(/\s+/g, ' '), 140)}`)
  })
  return lines.join('\n')
}

// Fields every element has, or that its first line describes, left out of
// its summary
const COMMON = new Set(['id', 'type', 'x', 'y', 'width', 'height', 'zIndex', 'rotation', 'opacity', 'content', 'layoutPart',
  'fragment', 'fragmentIndex', 'placeholder', 'hint', 'outline', 'sizeMode', 'locked', 'editorState',
  'clickAction', 'hoverAction', 'states', 'initialState', 'stateSteps', 'startHidden', 'hoverEffect', 'backfaceHidden'])
// A shape's text styling, left out when it has no text
const TEXT_STYLE = new Set(['fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textColor', 'textAlign', 'verticalAlign', 'lineHeight', 'letterSpacing'])

function fieldValue(value) {
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return `[embedded data, ${Math.round(value.length * 0.75 / 1024)} KB]`
    const plain = /<[a-z][\s\S]*>/i.test(value) ? textOf(value) : value.replace(/\s+/g, ' ').trim()
    return plain ? JSON.stringify(clip(plain, MAX_FIELD)) : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  return null
}

// An element's other fields, short, for get_slide
function fieldsOf(el) {
  const out = []
  const noText = el.type === 'shape' && !String(el.text || '').trim()
  for (const [key, value] of Object.entries(el)) {
    if (COMMON.has(key) || value == null || value === '') continue
    if ((noText && TEXT_STYLE.has(key)) || (key === 'strokeWidth' && (!el.stroke || el.stroke === 'none'))) continue
    const v = fieldValue(value)
    if (v != null) out.push(`${key}: ${v}`)
    if (out.length >= 10) break
  }
  return out
}

// ── Interactions (services/click-actions.js) ──
// What clicking or hovering on an element does, and which elements start
// hidden, so tabs and click-to-reveal read as that, not clutter. Elements
// are named by their number in get_slide's list.

const idList = list => (Array.isArray(list) ? list : []).filter(id => typeof id === 'string')
const showsOf = action => [...idList(action.show), ...idList(action.toggle)]

function refs(list, numberOf) {
  const names = idList(list).map(id => (numberOf.has(id) ? String(numberOf.get(id)) : `\`${id}\` (not on this slide)`))
  return `${names.length === 1 ? 'element' : 'elements'} ${names.join(', ')}`
}

function stateName(el, stateId) {
  if (!stateId) return 'its default look'
  const state = (Array.isArray(el?.states) ? el.states : []).find(s => s && s.id === stateId)
  return state ? `state "${clip(String(state.name || stateId), 40)}"` : 'a state that is gone'
}

function visibilityText(action, numberOf, byId) {
  const parts = []
  if (idList(action.show).length) parts.push(`shows ${refs(action.show, numberOf)}`)
  if (idList(action.hide).length) parts.push(`hides ${refs(action.hide, numberOf)}`)
  if (idList(action.toggle).length) parts.push(`shows or hides ${refs(action.toggle, numberOf)}`)
  for (const s of Array.isArray(action.set) ? action.set : []) {
    if (!s || typeof s.id !== 'string') continue
    const target = refs([s.id], numberOf)
    if (s.mode === 'cycle') parts.push(`moves ${target} to its next state`)
    else if (s.mode === 'toggle') parts.push(`switches ${target} between ${stateName(byId.get(s.id), s.state)} and its default look`)
    else parts.push(`puts ${target} in ${stateName(byId.get(s.id), s.state)}`)
  }
  return parts.join('; ') || 'does nothing yet'
}

function clickText(action, deck, numberOf, byId) {
  if (action.type === 'next') return 'goes to the next slide'
  if (action.type === 'prev') return 'goes to the previous slide'
  if (action.type === 'url') return `opens ${JSON.stringify(clip(String(action.url || ''), MAX_FIELD))}`
  if (action.type === 'slide') {
    const target = shownSlides(deck).find(({ slide }) => slide.id === action.slideId)
    return target ? `goes to slide ${target.number}` : 'goes to a slide that is gone or hidden'
  }
  if (action.type === 'visibility') return visibilityText(action, numberOf, byId)
  return null
}

function interactionFacts(el, deck, numberOf, byId) {
  const out = []
  if (el.startHidden) out.push('starts hidden')
  const click = el.clickAction && typeof el.clickAction === 'object' && clickText(el.clickAction, deck, numberOf, byId)
  if (click) out.push(`click: ${click}`)
  const hover = el.hoverAction && el.hoverAction.type === 'visibility' && visibilityText(el.hoverAction, numberOf, byId)
  if (hover) out.push(`hover: ${hover}, until the pointer leaves`)
  const states = (Array.isArray(el.states) ? el.states : []).filter(Boolean)
  if (states.length) {
    out.push(`${states.length} state${states.length === 1 ? '' : 's'}: ${states.map(s => JSON.stringify(clip(String(s.name || s.id || ''), 40))).join(', ')}`)
    if (el.initialState) out.push(`starts in ${stateName(el, el.initialState)}`)
  }
  const steps = el.stateSteps && typeof el.stateSteps === 'object' ? Object.keys(el.stateSteps) : []
  if (steps.length) out.push(`changes look at step${steps.length === 1 ? '' : 's'} ${steps.join(', ')}`)
  return out
}

// Whether two elements are never seen at once: not both shown when the
// slide opens, and every click or hover that shows one hides the other, as
// a tab's panels are
function neverTogether(a, b, actions) {
  if (!a.startHidden && !b.startHidden) return false
  return actions.every(action => {
    const shows = showsOf(action); const hides = idList(action.hide)
    return (!shows.includes(a.id) || hides.includes(b.id)) && (!shows.includes(b.id) || hides.includes(a.id))
  })
}

// A slide's elements back to front, as get_slide numbers them
function elementsInOrder(slide) {
  return (slide.elements || []).filter(Boolean).map((el, i) => ({ el, i }))
    .sort((a, b) => ((Number(a.el.zIndex) || 0) - (Number(b.el.zIndex) || 0)) || (a.i - b.i))
    .map(({ el }) => el)
}

const round = n => Math.round(Number(n) || 0)
const box = el => ({ x: Number(el.x) || 0, y: Number(el.y) || 0, w: Number(el.width) || 0, h: Number(el.height) || 0 })

function warningsOf(slide, w, h) {
  const out = []
  const els = (slide.elements || []).filter(el => el && !el.layoutPart)
  for (const el of els) {
    const b = box(el)
    const over = [
      b.x < -2 && `left edge by ${round(-b.x)} px`,
      b.y < -2 && `top edge by ${round(-b.y)} px`,
      b.x + b.w > w + 2 && `right edge by ${round(b.x + b.w - w)} px`,
      b.y + b.h > h + 2 && `bottom edge by ${round(b.y + b.h - h)} px`,
    ].filter(Boolean)
    if (over.length) out.push(`\`${el.id}\` (${el.type}) runs past the slide's ${over.join(' and ')}.`)
  }
  const texts = els.filter(el => el.type === 'text' && hasText(el))
  const actions = els.flatMap(el => [el.clickAction, el.hoverAction]).filter(action => action && action.type === 'visibility')
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (neverTogether(texts[i], texts[j], actions)) continue
      const a = box(texts[i]); const b = box(texts[j])
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (ix > 0 && iy > 0 && ix * iy > 0.1 * Math.min(a.w * a.h, b.w * b.h)) out.push(`Text boxes \`${texts[i].id}\` and \`${texts[j].id}\` overlap.`)
    }
  }
  return out
}

// One slide in full, for get_slide: its facts, notes, and each element back
// to front with its position, size and contents
function slideDetail(deck, found) {
  const { slide, number } = found
  const total = shownSlides(deck).length
  const w = Number(deck.slideWidth) || SLIDE_W
  const h = Number(deck.slideHeight) || SLIDE_H
  const title = titleOf(slide)
  const bg = slide.background
  const lines = [
    `## Slide ${number} of ${total}: ${title ? escapeText(title) : '(no title)'}`,
    '',
    [
      '`' + slide.id + '`',
      slide.layout && `layout ${slide.layout}`,
      slide.section && `section "${slide.section}"`,
      Number(slide.minutes) > 0 && `${slide.minutes} min`,
      bg && bg.type === 'color' && bg.color && `background ${bg.color}`,
      bg && bg.type && bg.type !== 'color' && `background ${bg.type}`,
      slide.transition && `transition ${slide.transition}`,
    ].filter(Boolean).join(' · '),
  ]
  const outline = outlineNotes(slide)
  if (outline.length) lines.push('', 'Outline notes:', ...outline)
  const notes = notesText(slide.notes)
  if (notes) lines.push('', 'Speaker notes:', ...clip(notes, MAX_TEXT).split('\n').map(l => '> ' + l))
  const els = elementsInOrder(slide)
  const numberOf = new Map(els.map((el, k) => [el.id, k + 1]))
  const byId = new Map(els.map(el => [el.id, el]))
  lines.push('', `### Elements, back to front (slide is ${w}×${h})`)
  if (!els.length) lines.push('', 'None.')
  els.forEach((el, k) => {
    const b = box(el)
    const facts = [
      el.placeholder && `${el.placeholder} placeholder${hasText(el) ? '' : ', empty (hidden when presenting)'}`,
      el.layoutPart && 'part of the layout',
      el.sizeMode === 'shrink' && 'text shrinks to fit',
      el.fragment && `appears on click${el.fragmentIndex != null ? ` (step ${el.fragmentIndex})` : ''}`,
      Number(el.rotation) && `rotated ${round(el.rotation)}°`,
      ...interactionFacts(el, deck, numberOf, byId),
    ].filter(Boolean)
    lines.push('', `${k + 1}. **${el.type}** \`${el.id}\` at x ${round(b.x)}, y ${round(b.y)}, ${round(b.w)}×${round(b.h)}${facts.length ? ' · ' + facts.join(' · ') : ''}`)
    if (el.type === 'text') {
      const md = hasText(el) && htmlToMarkdown(el.content)
      if (md) lines.push(...clip(md, MAX_TEXT).split('\n').map(l => (l ? '   ' + l : '')))
    } else {
      // Graphs, diagrams and the rest as their guides read them (guides.js),
      // in the form update_element's spec takes
      const read = require('./guides').readElement(el)
      lines.push(...(read || fieldsOf(el).map(f => '   - ' + f)))
    }
  })
  const warnings = warningsOf(slide, w, h)
  if (warnings.length) lines.push('', '### Warnings', ...warnings.map(x => '- ' + x))
  return lines.join('\n')
}

// The whole deck as text, for the readable page: each slide's text boxes top
// to bottom (its title among them), what else is on it, and its speaker notes
function deckMarkdown(deck) {
  const shown = shownSlides(deck)
  const parts = [`# ${deck.title || 'Untitled'}`, `${deckFacts(deck)} · ${shown.length} slide${shown.length === 1 ? '' : 's'}`]
  for (const { slide, number } of shown) {
    parts.push('---', `**Slide ${number} of ${shown.length}**${titleOf(slide) ? '' : ' (no title)'}`)
    const texts = textBoxes(slide).filter(hasText).sort((a, b) => (a.y - b.y) || (a.x - b.x))
    for (const el of texts) parts.push(htmlToMarkdown(el.content))
    const others = typeCounts({ elements: (slide.elements || []).filter(el => el && el.type !== 'text') })
    if (others) parts.push(`(Also on this slide: ${others}.)`)
    const notes = notesText(slide.notes)
    if (notes) parts.push('Speaker notes: ' + notes)
  }
  return clip(parts.join('\n\n'), MAX_PAGE)
}

module.exports = {
  parseHtml, htmlToMarkdown, textOf, titleOf, slideOrder, shownSlides, findSlide, elementsInOrder,
  deckOutline, slideDetail, deckMarkdown, textStylesFacts, themeText,
}
