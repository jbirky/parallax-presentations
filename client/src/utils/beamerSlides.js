// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Frames read from LaTeX Beamer (utils/beamer.js), laid out as slides of
// ordinary elements, so they're edited like any other: text boxes (with
// KaTeX math and citations), images, tables, code, and LaTeX elements for
// TikZ. Sizes follow Beamer's: a frame's millimeters scaled onto the slide,
// so text is the size it was relative to the frame, and a crowded frame is
// shrunk until it fits.
//
// Overlays become fragments where everything shows from some step on (\pause,
// <+->, <2->); a frame whose parts also disappear (\only, \alt, <1-2>) becomes
// a slide per step, as Beamer makes pages.
//
// Text heights come from `measure(html, width)`; the editor passes one that
// measures in the page (BeamerImportModal), and estimateTextHeight stands in
// elsewhere.

import { visibleAt, firstStep, plainText, parseLength } from './beamer'
import { CITATION_STYLE } from './citationIndex'
import { splitDuplicates } from './bibDuplicates'

const PT_MM = 0.35146
const PAD_X = 12, PAD_Y = 8   // a text box's padding (SlideCanvas, generateHTML)
const MIN_FIT = 0.55
const MONO = "'Fira Code', 'JetBrains Mono', 'Courier New', monospace"

// standout: the slide behind a frame that stands out (metropolis' [standout])
export const LOOKS = {
  light: { background: '#ffffff', text: '#1a1a1a', structure: '#3333b2', alert: '#e00000', example: '#007f00', muted: '#8a8a99', standout: '#23373b' },
  dark: { background: '#1e1e2e', text: '#ececf4', structure: '#a5b4fc', alert: '#ff7a7a', example: '#6ee7a0', muted: '#8d8da3', standout: '#3b3b6d' },
}

// ── Colors ──────────────────────────────────────────────────────────────────
const rgbOf = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); return m ? [0, 2, 4].map(k => parseInt(m[1].slice(k, k + 2), 16)) : null }
const toHex = c => '#' + c.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
function luminance(c) {
  const [r, g, b] = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
// Whether text on this background should be light; a color that isn't
// #rrggbb counts as dark, as the editor's slides start
export const isDarkColor = color => { const c = rgbOf(color); return !c || luminance(c) < 0.4 }
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

// A color that reads on the background: dark navy on a dark slide is lifted
// toward white, pale yellow on white pushed toward black
export function legible(color, background, min = 3) {
  const c = rgbOf(color), bg = rgbOf(background)
  if (!c || !bg) return color
  const toward = luminance(bg) < 0.4 ? [255, 255, 255] : [0, 0, 0]
  let out = c
  for (let k = 1; k <= 10 && contrast(out, bg) < min; k++) out = c.map((x, i) => x + (toward[i] - x) * k / 10)
  return toHex(out)
}

const tint = (color, alpha) => { const c = rgbOf(color); return c ? `rgba(${c.join(',')},${alpha})` : color }

// The look's colors, with the source's own Beamer colors where they read
export function palette(look, doc) {
  const base = LOOKS[look] || LOOKS.light
  const own = (doc && doc.beamerColors) || {}
  const pal = { ...base }
  for (const role of ['structure', 'alert', 'example']) if (own[role]) pal[role] = legible(own[role], pal.background)
  pal.title = own.title ? legible(own.title, pal.background) : pal.structure
  pal.blockTitle = own.blockTitle ? legible(own.blockTitle, pal.background) : null
  return pal
}

// ── HTML ────────────────────────────────────────────────────────────────────
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = s => esc(s).replace(/"/g, '&quot;')

// A math node as the text editor writes one (extensions/MathExtension.js)
const mathNode = (tex, display) =>
  `<span data-math-latex="${escAttr(tex)}" data-math-display="${display}" data-math-fontsize="" data-math-color="" class="math-node ${display ? 'math-display' : 'math-inline'}"></span>`

function runColor(m, cx) {
  if (!m || !m.color) return cx.color
  if (m.color.startsWith('@')) return cx.pal[m.color.slice(1)] || cx.color
  return legible(m.color, cx.pal.background, 2.2)
}

// Runs as inline HTML, in the styles the text editor keeps (textStyle spans,
// strong, em, u, s, links, highlights). Spaces run together, as TeX's do,
// and none start or end a line.
function runsHtml(runs, cx) {
  const toks = []
  for (const r of runs || []) {
    if (r.t === 'br') { toks.push({ br: true }); continue }
    const m = r.m || {}
    let hidden = cx.hidden
    if (m.vis && cx.page != null && !visibleAt(m.vis, cx.page)) {
      if (!m.vis.reserve) continue
      hidden = true
    }
    const tok = { m, hidden, color: hidden ? 'transparent' : runColor(m, cx), size: Math.round(cx.size * (m.size || 1)) }
    if (r.t === 'text' && !m.sup && !m.sub) tok.text = r.text.replace(/[ \t\n\r]+/g, ' ')
    else if (r.t === 'text') tok.inner = mathNode((m.sup ? '^' : '_') + '{\\text{' + r.text.trim().replace(/[{}\\$&#%_^~]/g, '') + '}}', false)
    else if (r.t === 'math') tok.inner = mathNode(r.tex, !!r.display)
    else if (r.t === 'cite') {
      tok.inner = r.keys.map(key => {
        const c = cx.cite ? cx.cite(key) : null
        return c ? `<sup data-cite="${escAttr(c.key)}" style="${CITATION_STYLE}">${esc(c.label)}</sup>` : esc(`[${key}]`)
      }).join('')
    } else continue
    toks.push(tok)
  }
  let atStart = true, lastText = null
  const endLine = () => { if (lastText) lastText.text = lastText.text.replace(/ $/, ''); lastText = null; atStart = true }
  for (const t of toks) {
    if (t.br) { endLine(); continue }
    if (t.text == null) { atStart = false; lastText = null; continue }
    if (atStart || (lastText && lastText.text.endsWith(' '))) t.text = t.text.replace(/^ /, '')
    if (t.text) { atStart = false; lastText = t }
  }
  endLine()
  while (toks.length && toks[toks.length - 1].br) toks.pop()
  // Neighbors styled alike in one span
  const styleKey = t => JSON.stringify([t.color, t.size, t.hidden, ...['tt', 'hl', 's', 'u', 'i', 'b', 'href'].map(k => t.m[k] || null)])
  const merged = []
  for (const t of toks) {
    if (!t.br && t.text === '') continue
    const last = merged[merged.length - 1]
    if (last && !last.br && !t.br && last.text != null && t.text != null && styleKey(last) === styleKey(t)) last.text += t.text
    else merged.push(t.br ? t : { ...t })
  }
  return merged.map(t => {
    if (t.br) return '<br>'
    const m = t.m
    let html = `<span style="color: ${t.color}; font-size: ${t.size}px${m.tt ? `; font-family: ${MONO}` : ''}">${t.text != null ? esc(t.text) : t.inner}</span>`
    if (m.hl && !t.hidden) html = `<mark data-color="${escAttr(m.hl)}" style="background-color: ${escAttr(m.hl)}; color: inherit">${html}</mark>`
    if (m.s) html = `<s>${html}</s>`
    if (m.u) html = `<u>${html}</u>`
    if (m.i) html = `<em>${html}</em>`
    if (m.b) html = `<strong>${html}</strong>`
    if (m.href && /^(https?:|mailto:)/i.test(m.href)) html = `<a target="_blank" rel="noopener noreferrer nofollow" href="${escAttr(m.href)}">${html}</a>`
    return html
  }).join('')
}

// A paragraph's or list's own size and line height: a text box sits in the
// slide's 42px type, which would otherwise set the spacing of smaller text
// (extensions/BlockStyle.js and LineHeight.js keep them through editing)
const pitch = size => Math.round(size * 1.3)
const sized = (size, align) => `${align && align !== 'left' ? `text-align: ${align}; ` : ''}font-size: ${Math.round(size)}px; line-height: ${pitch(size)}px`
const para = (inner, size, align) => inner ? `<p style="${sized(size, align)}">${inner}</p>` : ''
const paraHtml = (runs, cx, align) => para(runsHtml(runs, cx), cx.size, align)
const displayHtml = (tex, cx) => para(`<span style="color: ${cx.hidden ? 'transparent' : cx.color}; font-size: ${Math.round(cx.size)}px">${mathNode(tex, true)}</span>`, cx.size)

// ── Estimating text ─────────────────────────────────────────────────────────
// How tall a text box holding html is at a width: a rough count of lines at
// an average glyph width, for tests and anywhere the page can't measure
export function estimateTextHeight(html, width) {
  let h = 2 * PAD_Y
  const blocks = String(html).split(/<\/(?:p|li)>/)
  for (const block of blocks) {
    const sizes = [...block.matchAll(/font-size: ([\d.]+)px/g)].map(m => +m[1])
    if (!sizes.length) continue
    const fs = Math.max(...sizes)
    const depth = (block.match(/<(ul|ol)/g) || []).length
    const text = block.replace(/<span data-math-latex="([^"]*)"[^>]*><\/span>/g, (m, t) => 'x'.repeat(Math.ceil(t.length / 2))).replace(/<[^>]+>/g, '')
    const avail = Math.max(40, width - 2 * PAD_X - depth * 1.5 * fs)
    const lines = Math.max(1, Math.ceil(text.length * fs * 0.5 / avail)) + (block.match(/<br>/g) || []).length
    const lh = [...block.matchAll(/line-height: ([\d.]+)px/g)].map(m => +m[1]).pop() || fs * 1.5
    if (/data-math-display="true"/.test(block)) h += fs * 2.6 + 16
    else h += lines * lh + fs * (/<li/.test(block) ? 0.2 : 0.4)
  }
  return Math.ceil(h)
}

// ── Laying out ──────────────────────────────────────────────────────────────
// A frame's blocks as items to stack: text that shows at the same step goes
// in one box, and a list is cut where its items start showing at a later step
function stackItems(blocks, cx) {
  const items = []
  let group = null
  const text = (html, from, opts = {}) => {
    if (!html) return
    const indent = opts.indent || 0
    if (group && group.from === from && group.indent === indent && !opts.alone) { group.html += html; return }
    group = { kind: 'text', html, from, indent }
    items.push(group)
    if (opts.alone) group = null
  }
  const other = item => { group = null; items.push(item) }
  for (const b of blocks || []) {
    const shown = cx.shows(b.vis)
    if (!shown && !(b.vis && b.vis.reserve)) continue
    const bx = shown ? cx : { ...cx, hidden: true }
    const from = cx.from(b.vis)
    const marks = b.marks || {}
    switch (b.kind) {
      case 'para': text(paraHtml(b.runs, bx, b.align), from); break
      case 'math': text(displayHtml(b.tex, { ...bx, size: bx.size * (marks.size || 1) }), from); break
      case 'list': listItems(b, bx, text, other); break
      case 'quote': {
        const inner = stackItems(b.blocks, { ...bx, size: bx.size * 0.95 }).filter(x => x.kind === 'text').map(x => x.html).join('')
        text(inner ? `<blockquote>${inner}</blockquote>` : '', from)
        break
      }
      case 'toc': text(tocHtml(b, bx), from); break
      case 'images': other({ kind: 'images', b, from, hidden: !shown }); break
      case 'table': other({ kind: 'table', b, from, hidden: !shown }); break
      case 'tikz': other({ kind: 'tikz', b, from, hidden: !shown }); break
      case 'code': other({ kind: 'code', b, from, hidden: !shown }); break
      case 'box': other({ kind: 'box', b, from, hidden: !shown, children: stackItems(b.blocks, bx) }); break
      case 'columns': other({ kind: 'columns', b, from, cols: b.cols.map(c => ({ width: c.width, valign: c.valign, items: stackItems(c.blocks, bx) })) }); break
      case 'titlepage': other({ kind: 'titlepage', from }); break
      default: break
    }
  }
  return items
}

// A list as lines, an item each, with its nesting
function listLines(list, depth, cx, out) {
  let number = 0
  for (const item of list.items) {
    const shown = cx.shows(item.vis)
    if (!shown && !(item.vis && item.vis.reserve)) continue
    number++
    const text = [], nested = [], extra = []
    for (const b of item.blocks) {
      if (b.kind === 'list') nested.push(b)
      else if (b.kind === 'para' || b.kind === 'math') text.push(b)
      else extra.push(b)
    }
    out.push({ depth, type: list.type, number, label: item.label, blocks: text, vis: item.vis, hidden: !shown, extra, marks: list.marks })
    for (const n of nested) listLines(n, depth + 1, cx, out)
  }
}

function listItems(list, cx, text, other) {
  const lines = []
  listLines(list, 0, cx, lines)
  const frags = []
  for (const line of lines) {
    const from = cx.from(line.vis)
    const last = frags[frags.length - 1]
    if (last && last.from === from && line.depth >= last.depth) last.lines.push(line)
    else frags.push({ from, depth: line.depth, lines: [line] })
  }
  const indent = cx.size * 1.5
  frags.forEach(fr => text(linesHtml(fr.lines, cx), fr.from, { indent: Math.round(fr.depth * indent) }))
  for (const line of lines) for (const b of line.extra) {
    const items = stackItems([b], cx)
    items.forEach(it => other(it))
  }
}

// An item's paragraphs; own: sized as paragraphs of their own, not a list's
function itemHtml(line, cx, own = false) {
  const lx = { ...cx, hidden: cx.hidden || line.hidden, size: cx.size * ((line.marks && line.marks.size) || 1) }
  const label = line.label ? runsHtml(line.label, { ...lx, color: line.type === 'description' ? cx.pal.structure : lx.color }) : ''
  const p = (inner, align) => own ? para(inner, lx.size, align) : `<p${align && align !== 'left' ? ` style="text-align: ${align}"` : ''}>${inner}</p>`
  let html = ''
  line.blocks.forEach((b, k) => {
    if (b.kind === 'math') { html += displayHtml(b.tex, lx); return }
    const inner = runsHtml(b.runs, { ...lx, hidden: lx.hidden || !cx.shows(b.vis) })
    html += p(`${k === 0 && label ? `<strong>${label}</strong> ` : ''}${inner}`, b.align)
  })
  return html || p(label ? `<strong>${label}</strong>` : '') || `<p></p>`
}

// Lines as nested lists; description lists at the top as paragraphs. Items
// hidden on this slide (they keep their room) go in lists of their own, with
// no bullets to see.
function linesHtml(lines, cx) {
  let html = ''
  const open = []
  const base = lines[0].depth
  const openList = (tag, line) => {
    const size = cx.size * ((line.marks && line.marks.size) || 1)
    const bullet = cx.hidden || line.hidden ? 'transparent' : cx.pal.structure
    const style = ` style="color: ${bullet}; ${sized(size)}"`
    return tag === 'ol' ? `<ol${line.number > 1 ? ` start="${line.number}"` : ''}${style}>` : `<ul${style}>`
  }
  const close = () => { html += `</li></${open.pop().tag}>` }
  for (const line of lines) {
    const d = line.depth - base
    if (line.type === 'description' && d === 0) {
      while (open.length) close()
      html += itemHtml(line, cx, true)
      continue
    }
    const tag = line.type === 'enumerate' ? 'ol' : 'ul'
    const hidden = !!line.hidden
    while (open.length > d + 1) close()
    if (open.length === d + 1) {
      if (open[d].tag !== tag || open[d].hidden !== hidden) { close(); html += openList(tag, line); open.push({ tag, hidden }) } else html += '</li>'
    } else while (open.length < d + 1) { html += openList(tag, line); open.push({ tag, hidden }) }
    html += `<li>${itemHtml(line, { ...cx, hidden: cx.hidden || line.hidden })}`
  }
  while (open.length) close()
  return html
}

function tocHtml(b, cx) {
  const sections = cx.doc.sections || []
  if (!sections.length) return ''
  const current = b.options && (b.options.currentsection || b.options.currentsubsection) ? cx.sectionIndex : -1
  const color = cx.hidden ? 'transparent' : cx.pal.structure
  const list = size => `<ul style="color: ${color}; ${sized(size)}">`
  let html = list(cx.size)
  sections.forEach((s, k) => {
    const dim = current >= 0 && k !== current
    const sx = { ...cx, color: dim ? cx.pal.muted : cx.color }
    html += `<li><p>${runsHtml([{ t: 'text', text: s.name, m: {} }], sx)}</p>`
    if (s.subsections.length && (current < 0 || k === current) && !b.options.hideallsubsections) {
      html += list(cx.size * 0.85) + s.subsections.map(n => `<li><p>${runsHtml([{ t: 'text', text: n, m: { size: 0.85 } }], sx)}</p></li>`).join('') + '</ul>'
    }
    html += '</li>'
  })
  return html + '</ul>'
}

// A length on the slide, in pixels: relative to the box it's in (w), the
// frame's text height, the slide, or millimeters
function lengthPx(L, w, cx) {
  if (!L) return null
  switch (L.unit) {
    case 'tw': return L.v * w
    case 'pw': return L.v * cx.slideW
    case 'th': return L.v * cx.bodyH
    case 'ph': return L.v * cx.slideH
    default: return L.v * cx.ppm
  }
}

// Each picture's box, before rows are fitted to the width
function imageBox(item, w, cx) {
  const found = cx.image(item.path)
  const ratio = found && found.width > 0 ? found.height / found.width : 0.75
  const o = item.opts || {}
  let iw = lengthPx(parseLength(o.width), w, cx)
  let ih = lengthPx(parseLength(o.height), w, cx)
  if (item.boxWidth) { const bw = lengthPx(parseLength(item.boxWidth), w, cx); if (bw) { iw = bw; ih = null } }
  if (iw && ih && o.keepaspectratio) { if (ih / iw > ratio) ih = iw * ratio; else iw = ih / ratio }
  else if (iw && !ih) ih = iw * ratio
  else if (ih && !iw) iw = ih / ratio
  else if (!iw && !ih) {
    const s = parseFloat(o.scale) || 1
    iw = found && found.width ? found.width * PT_MM * cx.ppm * s : w * 0.6
    ih = iw * ratio
  }
  const s = (item.scale || 1) * cx.f
  return { item, found, w: iw * s, h: ih * s }
}

function placeImages(it, x, w, cx) {
  const gap = Math.round(cx.size * 0.4)
  const boxes = it.b.items.filter(item => cx.shows(item.vis) || (item.vis && item.vis.reserve)).map(item => imageBox(item, w, cx))
  if (!boxes.length) return { els: [], h: 0 }
  const total = boxes.reduce((a, b) => a + b.w, 0) + gap * (boxes.length - 1)
  const maxH = cx.bodyH * 0.92
  let s = Math.min(1, w / total, ...boxes.map(b => maxH / b.h))
  const rowH = Math.max(...boxes.map(b => b.h * s))
  const rowW = boxes.reduce((a, b) => a + b.w * s, 0) + gap * (boxes.length - 1)
  let cx0 = x + (it.b.align === 'center' ? (w - rowW) / 2 : it.b.align === 'right' ? w - rowW : 0)
  const els = []
  for (const b of boxes) {
    const bw = Math.round(b.w * s), bh = Math.round(b.h * s)
    const y = Math.round((rowH - bh) / 2)
    const from = Math.max(it.from, cx.from(b.item.vis))
    const hidden = it.hidden || !cx.shows(b.item.vis)
    if (!hidden) {
      if (b.found) els.push({ type: 'image', x: Math.round(cx0), y, width: bw, height: bh, zIndex: 2, src: b.found.src, objectFit: 'contain', alt: b.item.path.split('/').pop(), from })
      else {
        els.push({ type: 'shape', shape: 'rect', x: Math.round(cx0), y, width: bw, height: bh, zIndex: 1, fill: 'transparent', stroke: cx.pal.muted, strokeWidth: 1.5, strokeDasharray: 'dashed', borderRadius: 0, opacity: 1, text: '', fontSize: 14, textColor: cx.pal.muted, from })
        els.push({ type: 'text', x: Math.round(cx0), y: y + Math.max(0, Math.round(bh / 2 - cx.size)), width: bw, height: Math.min(bh, Math.round(cx.size * 2.2)), zIndex: 2, content: para(`<span style="color: ${cx.pal.muted}; font-size: ${Math.round(cx.size * 0.7)}px">${esc(b.item.path)}</span>`, cx.size * 0.7, 'center'), from })
        cx.missing.add(b.item.path)
      }
    }
    cx0 += b.w * s + gap
  }
  return { els, h: Math.round(rowH) }
}

// A table: a table element where its cells are plain text, and LaTeX (drawn
// by LaTeX.js) where they hold math
function placeTable(it, x, w, cx) {
  const b = it.b
  if (!b.rows.length) return { els: [], h: 0 }
  const fs = Math.round(cx.size * 0.85)
  const pad = Math.round(fs * 0.4)
  const cols = Math.max(1, ...b.rows.map(r => r.reduce((a, c) => a + c.span, 0)))
  // Columns as wide as the longest cell, narrowed to fit; rows as tall as
  // their most wrapped cell. Generous: a table element clips.
  const glyph = fs * 0.62
  const chars = Array(cols).fill(1)
  b.rows.forEach(r => { let k = 0; r.forEach(c => { if (c.span === 1) chars[k] = Math.max(chars[k], plainText(c.runs).length); k += c.span }) })
  // The editor lays a table element's columns out alike
  const colW = Math.min(w / cols, Math.max(...chars) * glyph + 2 * pad + 2)
  const widths = chars.map(() => colW)
  const tw = Math.round(colW * cols)
  const tx = Math.round(x + (b.align === 'center' ? (w - tw) / 2 : b.align === 'right' ? w - tw : 0))
  const th = Math.round(b.rows.reduce((sum, r) => {
    let k = 0, lines = 1
    for (const c of r) {
      const cw = widths.slice(k, k + c.span).reduce((a, v) => a + v, 0) - 2 * pad
      lines = Math.max(lines, Math.ceil(plainText(c.runs).length * glyph / Math.max(glyph, cw)))
      k += c.span
    }
    return sum + lines * fs * 1.45 + 2 * pad + 2
  }, 4))
  if (it.hidden) return { els: [], h: th }
  const hasMath = b.rows.some(r => r.some(c => c.runs.some(x => x.t === 'math')))
  if (hasMath) return { els: [{ type: 'latex', x: tx, y: 0, width: tw, height: th + 8, zIndex: 2, content: b.raw, textColor: cx.pal.text, fontSize: Math.round(20 * fs / 16), from: it.from }], h: th + 8 }
  const data = b.rows.map(r => {
    const cells = []
    r.forEach(c => { cells.push(plainText(c.runs)); for (let n = 1; n < c.span; n++) cells.push('') })
    while (cells.length < cols) cells.push('')
    return cells
  })
  return {
    els: [{
      type: 'table', x: tx, y: 0, width: tw, height: th, zIndex: 2, data, headerRow: !!b.header, cellPadding: pad,
      borderColor: tint(cx.pal.text, 0.25), borderWidth: 1, headerBgColor: tint(cx.pal.structure, 0.18), cellBgColor: 'transparent',
      textColor: cx.pal.text, fontSize: fs, from: it.from,
    }],
    h: th,
  }
}

function placeItems(items, x, w, cx) {
  const els = []
  let y = 0, prev = null
  const gap = Math.round(cx.size * 0.35)
  for (const it of items) {
    let placed
    if (it.kind === 'text') {
      const iw = w - it.indent
      const h = cx.measure(it.html, iw)
      placed = { els: [{ type: 'text', x: x + it.indent, y: 0, width: iw, height: h + Math.max(4, Math.round(h * 0.04)), zIndex: 2, content: it.html, from: it.from }], h }
    } else if (it.kind === 'images') placed = placeImages(it, x + PAD_X, w - 2 * PAD_X, cx)
    else if (it.kind === 'table') placed = placeTable(it, x + PAD_X, w - 2 * PAD_X, cx)
    else if (it.kind === 'tikz') {
      const h = Math.round(Math.min(cx.bodyH * 0.75, w * 0.55))
      const content = (cx.doc.tikzPreamble ? cx.doc.tikzPreamble + '\n' : '') + (cx.dark ? '\\color{white}\n' : '') + it.b.tex
      // TeX's points as the frame has them: the element's fontSize / 20 scales
      // TikZJax's drawing, which is in CSS points
      const fontSize = Math.round(20 * cx.ppm * PT_MM * 0.75 * cx.f)
      placed = { els: it.hidden ? [] : [{ type: 'latex', x: x + PAD_X, y: 0, width: w - 2 * PAD_X, height: h, zIndex: 2, content, textColor: cx.pal.text, fontSize, from: it.from }], h }
    } else if (it.kind === 'code') {
      const fs = Math.round(cx.size * 0.72)
      const h = Math.round(it.b.text.split('\n').length * fs * 1.5 + 22)
      placed = { els: it.hidden ? [] : [{ type: 'code', x: x + PAD_X, y: 0, width: w - 2 * PAD_X, height: h, zIndex: 2, content: it.b.text, language: it.b.language || 'plaintext', fontSize: fs, from: it.from }], h }
    } else if (it.kind === 'box') placed = placeBox(it, x, w, cx)
    else if (it.kind === 'columns') placed = placeColumns(it, x, w, cx)
    else continue
    if (!placed.h && !placed.els.length) continue
    // Text boxes in a row read as one: their paddings overlap (a list cut at
    // a step reads on as one list)
    const space = !prev ? 0 : prev.kind === 'text' && it.kind === 'text' ? -2 * PAD_Y : gap
    y += space
    for (const e of placed.els) els.push({ ...e, y: e.y + y })
    y += placed.h
    prev = it
  }
  return { els, h: Math.max(0, y) }
}

function placeBox(it, x, w, cx) {
  const b = it.b
  const color = b.variant === 'alert' ? cx.pal.alert : b.variant === 'example' ? cx.pal.example : (cx.pal.blockTitle || cx.pal.structure)
  const els = []
  let h = 0
  const titleText = b.title && plainText(b.title)
  if (titleText) {
    const html = para(`<strong>${runsHtml(b.title, { ...cx, color, hidden: it.hidden })}</strong>`, cx.size)
    const th = cx.measure(html, w)
    els.push({ type: 'text', x, y: 0, width: w, height: th + 4, zIndex: 2, content: html, from: it.from })
    h = th - PAD_Y
  }
  const inner = placeItems(it.children, x, w, cx)
  for (const e of inner.els) els.push({ ...e, y: e.y + h - (titleText ? PAD_Y : 0) })
  h += inner.h - (titleText ? PAD_Y : 0) + Math.round(cx.size * 0.3)
  if (!it.hidden) els.unshift({ type: 'shape', shape: 'rounded-rect', x: x + 2, y: 0, width: w - 4, height: Math.round(h), zIndex: 1, fill: tint(color, 0.09), stroke: 'none', strokeWidth: 0, borderRadius: Math.round(cx.size * 0.35), opacity: 1, text: '', fontSize: 16, textColor: '#ffffff', from: it.from })
  return { els, h: Math.round(h) }
}

function placeColumns(it, x, w, cx) {
  const cols = it.cols
  if (!cols.length) return { els: [], h: 0 }
  let widths = cols.map(c => lengthPx(c.width, w, cx))
  const known = widths.filter(Boolean).reduce((a, b) => a + b, 0)
  const unknown = widths.filter(v => !v).length
  widths = widths.map(v => v || Math.max(w * 0.2, (w - known) / Math.max(1, unknown)))
  const sum = widths.reduce((a, b) => a + b, 0)
  if (sum > w) widths = widths.map(v => v * w / sum)
  const free = Math.max(0, w - widths.reduce((a, b) => a + b, 0))
  const gap = cols.length > 1 ? free / (cols.length - 1) : 0
  let cxp = x + (cols.length > 1 ? 0 : free / 2)
  const placed = cols.map((c, k) => {
    const p = placeItems(c.items, Math.round(cxp), Math.round(widths[k]), cx)
    cxp += widths[k] + gap
    return { ...p, valign: c.valign || it.b.valign }
  })
  const h = Math.max(...placed.map(p => p.h))
  const els = []
  for (const p of placed) {
    const dy = p.valign === 'top' ? 0 : p.valign === 'bottom' ? h - p.h : (h - p.h) / 2
    for (const e of p.els) els.push({ ...e, y: Math.round(e.y + dy) })
  }
  return { els, h }
}

// ── Slides ──────────────────────────────────────────────────────────────────
function titlePage(doc, cx) {
  const m = doc.meta || {}
  const line = (runs, size, color) => runs ? para(runsHtml(runs, { ...cx, size: cx.size * size, color }), cx.size * size, 'center') : ''
  return line(m.title, 1.6, cx.pal.title) + line(m.subtitle, 1.05, cx.pal.structure) +
    line(m.author, 1, cx.pal.text) + line(m.institute, 0.8, cx.pal.text) + line(m.date, 0.8, cx.pal.text)
}

// A frame that stands out: its text large, centered and light on a dark slide
function standingOut(frame, cx) {
  const pal = { ...cx.pal, background: cx.pal.standout, text: '#ffffff', structure: '#ffffff', title: '#ffffff', muted: '#c8c8d0', alert: legible(cx.pal.alert, cx.pal.standout) }
  const blocks = frame.blocks.map(b => b.kind === 'para' || b.kind === 'math' ? { ...b, align: 'center' } : b)
  return [{ ...frame, blocks }, { ...cx, pal, color: '#ffffff', base: cx.base * 1.44, size: cx.base * 1.44 }]
}

function frameSlide(frame, page, cx) {
  if (frame.options.standout) [frame, cx] = standingOut(frame, cx)
  const fx = {
    ...cx,
    page,
    sectionIndex: frame.sectionIndex,
    shows: v => page == null || visibleAt(v, page),
    from: v => page == null ? Math.max(1, firstStep(v)) : 1,
    missing: cx.missing,
  }
  const { slideW, slideH, ppm } = cx
  const M = Math.round(ppm * 10)
  const left = Math.max(4, M - PAD_X), width = slideW - 2 * left
  const els = []

  // The frame's title
  let top = Math.round(ppm * 4)
  const titleRuns = frame.title && plainText(frame.title) ? frame.title : null
  if (titleRuns) {
    let html = para(runsHtml(titleRuns, { ...fx, size: cx.base * 1.44, color: cx.pal.title }), cx.base * 1.44)
    if (frame.subtitle && plainText(frame.subtitle)) html += para(runsHtml(frame.subtitle, { ...fx, size: cx.base * 0.9, color: cx.pal.structure }), cx.base * 0.9)
    const y = Math.max(4, Math.round(ppm * 2.5) - PAD_Y)
    const h = cx.measure(html, width)
    els.push({ type: 'text', x: left, y, width, height: h + 4, zIndex: 3, content: html, outline: 'title', from: 1 })
    top = y + h - PAD_Y + Math.round(ppm * 1.5)
  }
  let bottom = slideH - Math.round(ppm * 5)

  // Footnotes, at the foot
  if (frame.footnotes.length) {
    const html = frame.footnotes.map((n, k) => para(runsHtml([{ t: 'text', text: String(k + 1), m: { sup: true, size: 0.7 } }, { t: 'text', text: ' ', m: { size: 0.7 } }, ...n.map(r => r.m ? { ...r, m: { ...r.m, size: 0.7 } } : r)], fx), cx.base * 0.7)).join('')
    const h = cx.measure(html, width)
    bottom -= h - PAD_Y
    els.push({ type: 'text', x: left, y: bottom, width, height: h + 4, zIndex: 2, content: html, from: 1 })
  }

  const bodyH = Math.max(40, bottom - top)
  if (frame.blocks.some(b => b.kind === 'titlepage')) {
    const html = titlePage(cx.doc, fx)
    const graphic = (cx.doc.meta.graphic || [])[0]
    const gh = graphic ? Math.round(bodyH * 0.25) : 0
    const h = cx.measure(html, width)
    const y = Math.max(top, Math.round((slideH - h - gh) / 2))
    if (html) els.push({ type: 'text', x: left, y, width, height: h + 6, zIndex: 2, content: html, outline: 'title', from: 1 })
    if (graphic) {
      const g = placeImages({ b: { ...graphic, align: 'center' }, from: 1, hidden: false }, left + PAD_X, width - 2 * PAD_X, { ...fx, f: 1, bodyH: gh / 0.92 })
      for (const e of g.els) els.push({ ...e, y: e.y + y + h })
    }
  } else {
    // The body, shrunk until it fits
    let f = 1, placed
    for (let k = 0; k < 5; k++) {
      const bx = { ...fx, f, size: cx.base * f, bodyH }
      placed = placeItems(stackItems(frame.blocks, bx), left, width, bx)
      if (placed.h <= bodyH || f <= MIN_FIT) break
      f = Math.max(MIN_FIT, f * Math.min(0.97, bodyH / placed.h))
    }
    if (placed.h > bodyH * 1.02) cx.crowded.add(frame.number)
    const valign = frame.options.t || (cx.doc.size.top && !frame.options.c) ? 'top' : frame.options.b ? 'bottom' : 'center'
    const dy = top + (valign === 'top' ? 0 : valign === 'bottom' ? Math.max(0, bodyH - placed.h) : Math.max(0, (bodyH - placed.h) / 2))
    for (const e of placed.els) els.push({ ...e, y: Math.round(e.y + dy) })
  }

  // Steps as fragments, numbered 1, 2, … in the order they come
  const steps = [...new Set(els.map(e => e.from).filter(n => n > 1 && n < Infinity))].sort((a, b) => a - b)
  const elements = els.map(({ from, ...e }) => {
    const out = { id: cx.newId(), ...e, x: Math.round(e.x), y: Math.round(e.y), width: Math.max(8, Math.round(e.width)), height: Math.max(8, Math.round(e.height)) }
    if (from > 1 && from < Infinity) Object.assign(out, { fragment: true, fragmentIndex: steps.indexOf(from) + 1, fragmentAnimation: 'fade-in' })
    return out
  })
  return { elements }
}

// Slides for each frame: { slides: [{ frame (its number), page, slide }],
// missing (figures not found), crowded (frames that didn't fit) }.
// overlays: 'steps' (fragments where they do), 'slides' (a slide per step),
// or 'none' (the frame as its last step shows it). image(path): a figure's
// { src, width, height } in points, or null. cite(key): the citation's
// { key, label } in the deck, or null to show the key as text.
export function beamerSlides(doc, opts = {}) {
  const {
    slideW = 960, slideH = 540, look = 'light', overlays = 'steps', measure = estimateTextHeight, image = () => null,
    cite = null, newId = () => globalThis.crypto.randomUUID(), frames = null,
  } = opts
  const pal = palette(look, doc)
  const ppm = Math.min(slideW / doc.size.width, slideH / doc.size.height)
  const base = doc.size.pt * PT_MM * ppm
  const cx = {
    doc, pal, ppm, base, size: base, color: pal.text, slideW, slideH, bodyH: slideH * 0.7, f: 1, dark: look === 'dark',
    measure, image, cite, newId, hidden: false, missing: new Set(), crowded: new Set(),
  }
  const out = []
  for (const frame of doc.frames) {
    if (frames && !frames.has(frame.number)) continue
    const n = Math.max(1, frame.steps || 1)
    const pages = overlays === 'none' ? [n] : overlays === 'slides' || !frame.cumulative ? Array.from({ length: n }, (_, k) => k + 1) : [null]
    let prev = null
    for (const page of pages) {
      const { elements } = frameSlide(frame, page, cx)
      const sig = JSON.stringify(elements.map(({ id, ...e }) => e))
      if (sig === prev) continue
      prev = sig
      const again = out.length > 0 && out[out.length - 1].frame === frame.number
      const slide = { id: newId(), elements, notes: again ? '' : frame.notes.join('\n\n'), background: { type: 'color', color: frame.options.standout ? pal.standout : pal.background } }
      // The next step of the same frame, in place, as Beamer's next page
      if (again) slide.transition = 'none'
      if (doc.sections.length && frame.section) slide.section = frame.section
      out.push({ frame: frame.number, page, slide })
    }
  }
  return { slides: out, missing: [...cx.missing], crowded: [...cx.crowded] }
}

// The keys slides cite, from their text boxes' markers
export function citedKeys(slides) {
  const keys = new Set()
  for (const slide of slides) for (const el of slide.elements || []) {
    if (typeof el.content === 'string') for (const m of el.content.matchAll(/data-cite="([^"]*)"/g)) keys.add(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
  }
  return keys
}

// A talk's references joined to a deck's library: a key the library has, or
// a work it holds under another key, cites what's there. keyMap: each
// incoming key to the key it cites in the deck.
export function mergeBibliography(library = [], incoming = []) {
  const have = new Set(library.map(e => e.key))
  const keyMap = new Map()
  const fresh = []
  for (const e of incoming) {
    if (!e || !e.key || keyMap.has(e.key)) continue
    if (have.has(e.key)) keyMap.set(e.key, e.key)
    else fresh.push(e)
  }
  const { kept, skipped } = splitDuplicates(fresh, library)
  for (const { entry, of } of skipped) keyMap.set(entry.key, of.key)
  for (const e of kept) keyMap.set(e.key, e.key)
  return { added: kept, keyMap }
}

// The deck's key for a key the talk cites: from its references, or the
// deck's library; in any case, as BibTeX matches them
export function citeKeyFinder(keyMap, library = []) {
  const keys = new Map(library.map(e => [e.key, e.key]))
  for (const [k, v] of keyMap) keys.set(k, v)
  const lower = new Map([...keys].map(([k, v]) => [k.toLowerCase(), v]))
  return key => keys.get(key) ?? lower.get(String(key).toLowerCase()) ?? null
}
