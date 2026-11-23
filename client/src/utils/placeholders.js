// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Placeholders: a layout's text boxes that wait for their text, as in
// PowerPoint, Keynote and Google Slides. A text element with `placeholder`
// ('title', 'subtitle' or 'body') shows its hint in gray while it's empty,
// starts typing on one click, and is left out when presenting and in
// exports, so a forgotten one never shows. Decks without the field are as
// they were.

export const PLACEHOLDER_HINTS = {
  title: 'Click to add title',
  subtitle: 'Click to add subtitle',
  body: 'Click to add text',
}

export function placeholderHint(el) {
  return el?.hint || PLACEHOLDER_HINTS[el?.placeholder] || PLACEHOLDER_HINTS.body
}

// Whether text HTML has nothing to show: no words, images, math or tables
export function isEmptyHtml(html) {
  const s = String(html || '')
  if (/<(img|table|hr|iframe|svg|video)\b/i.test(s) || /data-math-latex|data-cite/.test(s)) return false
  const text = s.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;| /g, ' ').replace(/&[a-z]+;|&#\d+;/gi, 'x')
  return text.trim() === ''
}

export function isEmptyPlaceholder(el) {
  return !!el && el.type === 'text' && !!el.placeholder && isEmptyHtml(el.content)
}

const escapeText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// An empty placeholder's HTML with its hint in its first empty block, so the
// hint takes that block's size and alignment (display only, never saved)
export function withHint(html, hint) {
  const span = `<span class="placeholder-hint">${escapeText(hint)}</span>`
  const s = String(html || '')
  const block = /(<(h[1-6]|p)\b[^>]*>)(\s|<br\s*\/?>)*(<\/\2>)/i
  if (block.test(s)) return s.replace(block, (_, open, tag, _space, close) => `${open}${span}${close}`)
  return `<p>${span}</p>${s}`
}

// ── Change layout ──────────────────────────────────────────────────────────

const byPosition = (a, b) => (a.y - b.y) || (a.x - b.x)
const isText = el => el?.type === 'text'
const isHeading = el => /^\s*<h[1-3]\b/i.test(el?.content || '')

// A slide's title text box: its title placeholder, else its topmost text
// that starts with a heading
export function titleOf(elements) {
  const texts = elements.filter(isText)
  return texts.find(el => el.placeholder === 'title')
    || texts.filter(el => !el.placeholder && isHeading(el) && !isEmptyHtml(el.content)).sort(byPosition)[0]
    || null
}

// The inline HTML inside a text box's blocks, joined by line breaks: a title's
// words, to go into another layout's title
function inlineHtml(html) {
  const grab = re => [...String(html || '').matchAll(re)].map(m => m[2]).filter(s => !isEmptyHtml(s))
  // Paragraphs and headings (a list's items hold paragraphs), else list items
  let blocks = grab(/<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)
  if (!blocks.length) blocks = grab(/<(li)\b[^>]*>([\s\S]*?)<\/\1>/gi)
  return blocks.length ? blocks.join('<br>') : String(html || '').replace(/<\/?(h[1-6]|p|ul|ol|li|div|blockquote)\b[^>]*>/gi, ' ').trim()
}

// `content` laid out as `template` (a layout's placeholder HTML): a title's
// words go into the layout's heading; body text keeps its paragraphs and
// lists, taking the layout's alignment
export function fillPlaceholder(template, content, role) {
  const open = /<(h[1-6]|p)\b[^>]*>/i.exec(template || '')
  if (role === 'title' || role === 'subtitle') {
    if (open) return template.replace(/(<(h[1-6]|p)\b[^>]*>)(\s|<br\s*\/?>)*(<\/\2>)/i, (_, o, tag, _s, c) => `${o}${inlineHtml(content)}${c}`)
    return content
  }
  const align = /text-align:\s*(left|center|right|justify)/i.exec(open?.[0] || '')?.[1]
  const stripped = String(content || '').replace(/\s*text-align:\s*(left|center|right|justify);?/gi, '').replace(/ style=""/g, '')
  if (!align || align === 'left') return stripped
  return stripped.replace(/<(h[1-6]|p)\b([^>]*)>/gi, (m, tag, attrs) => (/style="/i.test(attrs)
    ? `<${tag}${attrs.replace(/style="/i, `style="text-align:${align}; `)}>`
    : `<${tag}${attrs} style="text-align:${align}">`))
}

// A slide's elements in `layout` (a SLIDE_TEMPLATES entry): its title and body
// text move into the layout's placeholders, in reading order; text left over
// stays where it was, and empty placeholders go. The old layout's own shapes
// (marked layoutPart) give way to the new one's; everything else stays.
// `newId` names the new elements.
export function changeLayout(slide, layout, newId) {
  const elements = slide.elements || []
  const title = titleOf(elements)
  const bodies = elements.filter(el => isText(el) && el !== title && !isEmptyHtml(el.content) && (el.placeholder || !isHeading(el) || el.y > (title?.y ?? -1)))
    .filter(el => el.placeholder !== 'title')
    .sort(byPosition)
  const used = new Set()
  const maxZ = elements.reduce((m, el) => Math.max(m, el.zIndex || 0), 0)
  let z = maxZ
  const placed = []
  let nextBody = 0
  for (const part of layout.elements) {
    if (part.type !== 'text' || !part.placeholder) continue
    let from = null
    if (part.placeholder === 'title' && title && !isEmptyHtml(title.content)) from = title
    else if (part.placeholder !== 'title') {
      while (nextBody < bodies.length && used.has(bodies[nextBody].id)) nextBody++
      from = bodies[nextBody] || null
      if (from) nextBody++
    }
    if (from) used.add(from.id)
    placed.push({
      ...part,
      id: newId(),
      zIndex: ++z,
      content: from ? fillPlaceholder(part.content, from.content, part.placeholder) : part.content,
    })
  }
  if (title) used.add(title.id)
  const kept = elements.filter(el => !el.layoutPart && !(isText(el) && (used.has(el.id) || isEmptyPlaceholder(el))))
  // A title with no place in the layout (Blank) stays
  const keptTitle = title && !placed.some(p => p.placeholder === 'title') && !isEmptyHtml(title.content) ? [title] : []
  const parts = layout.elements.filter(p => !(p.type === 'text' && p.placeholder)).map(p => ({ ...p, id: newId(), layoutPart: true }))
  return [...parts, ...kept, ...keptTitle, ...placed]
}

// The hint the text editor shows while the placeholder being typed in is empty
export const editingHint = { current: '' }
