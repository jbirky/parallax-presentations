// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// A deck as Markdown, for AI collaborators (server/mcp): the outline get_deck
// returns, one slide's elements for get_slide, the whole deck as text for the
// link's readable page, and text boxes' HTML as Markdown. A deck's HTML is
// someone else's, so it's only ever read here as text, never run or rendered.
//
// Text boxes come out as Markdown with $…$ for math and [@key] for
// citations, the form the AI will write them in.

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

function deckFacts(deck) {
  const w = Number(deck.slideWidth) || SLIDE_W
  const h = Number(deck.slideHeight) || SLIDE_H
  return [
    `${w}×${h}`,
    `theme ${deck.theme || 'black'}`,
    `font ${deck.globalFont ? String(deck.globalFont).split(',')[0].replace(/['"]/g, '') : 'Arial (default)'}`,
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

// Fields every element has, left out of its summary
const COMMON = new Set(['id', 'type', 'x', 'y', 'width', 'height', 'zIndex', 'rotation', 'opacity', 'content', 'layoutPart',
  'fragment', 'fragmentIndex', 'placeholder', 'hint', 'outline', 'sizeMode', 'locked', 'editorState'])

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
  for (const [key, value] of Object.entries(el)) {
    if (COMMON.has(key) || value == null || value === '') continue
    const v = fieldValue(value)
    if (v != null) out.push(`${key}: ${v}`)
    if (out.length >= 10) break
  }
  return out
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
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
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
  const els = (slide.elements || []).filter(Boolean).map((el, i) => ({ el, i }))
    .sort((a, b) => ((Number(a.el.zIndex) || 0) - (Number(b.el.zIndex) || 0)) || (a.i - b.i))
    .map(({ el }) => el)
  lines.push('', `### Elements, back to front (slide is ${w}×${h})`)
  if (!els.length) lines.push('', 'None.')
  els.forEach((el, k) => {
    const b = box(el)
    const facts = [
      el.placeholder && `${el.placeholder} placeholder${hasText(el) ? '' : ', empty'}`,
      el.layoutPart && 'part of the layout',
      el.sizeMode === 'shrink' && 'text shrinks to fit',
      el.fragment && `appears on click${el.fragmentIndex != null ? ` (step ${el.fragmentIndex})` : ''}`,
      Number(el.rotation) && `rotated ${round(el.rotation)}°`,
    ].filter(Boolean)
    lines.push('', `${k + 1}. **${el.type}** \`${el.id}\` at x ${round(b.x)}, y ${round(b.y)}, ${round(b.w)}×${round(b.h)}${facts.length ? ' · ' + facts.join(' · ') : ''}`)
    if (el.type === 'text') {
      const md = htmlToMarkdown(el.content)
      if (md) lines.push(...clip(md, MAX_TEXT).split('\n').map(l => (l ? '   ' + l : '')))
    } else {
      lines.push(...fieldsOf(el).map(f => '   - ' + f))
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
  parseHtml, htmlToMarkdown, textOf, titleOf, slideOrder, shownSlides, findSlide,
  deckOutline, slideDetail, deckMarkdown,
}
