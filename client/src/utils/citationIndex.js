// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

import { parseAuthors, formatAuthorsShort, formatCitation } from './bibtexParser'

// Only entries the deck actually cites get an index, and the index decides both
// the in-text marker and the position on the references slide. Two orders are
// offered: the order citations first appear while presenting, or alphabetical by
// first author. Library order is for organising the library, not for numbering.

// A marker carries the entry key, so a citation survives renumbering:
//   <sup data-cite="smith2020">[2]</sup>
// The label inside it is a cache — buildCitationIndex is what is true — which is
// why the canvas and the exports resolve it again when they draw.
//
// A deck's text is its owner's to fill, and the server builds share and live
// pages from it, so markers are found in one pass over the text rather than by
// regular expressions that backtrack: ones that did took over a minute on 36 KB
// of `<sup data-cite="a"` without a closing `>`.
const BARE_NUMBER_RE = /\[(\d{1,3})\]/g
const OPEN_TAG_RE = /^<(sup|span)(?=[\s/>])/i
const CITE_ATTR_RE = /(?:^|[\s"'])data-cite="([^"]*)"/i
const LEGACY_LABEL_RE = /^\s*\[(\d{1,3})\]\s*$/

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const escapeText = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = text => escapeText(text).replace(/"/g, '&quot;')
const unescapeAttr = text => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

function allIndexesOf(haystack, needle) {
  if (!needle) return []
  const found = []
  const re = new RegExp(escapeRegExp(needle), 'g')
  let m
  while ((m = re.exec(haystack)) !== null) found.push(m.index)
  return found
}

// The tags in html, in order: each runs from a < to the next >, and starts at
// the last < before that > (so "<<sup>" holds a <sup>). from is the first <,
// where markup that is blanked out starts.
function scanTags(html) {
  const tags = []
  let lt = html.indexOf('<')
  while (lt !== -1) {
    const gt = html.indexOf('>', lt)
    if (gt === -1) break
    const start = html.lastIndexOf('<', gt)
    tags.push({ from: lt, start, end: gt + 1, text: html.slice(start, gt + 1) })
    lt = html.indexOf('<', gt + 1)
  }
  return tags
}

// <sup …> or <span …>: its name in lower case, and its data-cite if it has one
function openTag(tag) {
  const m = OPEN_TAG_RE.exec(tag.text)
  if (!m) return null
  const cite = CITE_ATTR_RE.exec(tag.text)
  return { name: m[1].toLowerCase(), key: cite ? unescapeAttr(cite[1]) : null }
}
const isClose = (tag, name) => tag.text.toLowerCase() === `</${name}>`

// For each tag, the index of the first </sup> and </span> at or after it
function nextCloses(tags) {
  const next = { sup: new Array(tags.length), span: new Array(tags.length) }
  let sup = -1, span = -1
  for (let i = tags.length - 1; i >= 0; i--) {
    if (isClose(tags[i], 'sup')) sup = i
    if (isClose(tags[i], 'span')) span = i
    next.sup[i] = sup
    next.span[i] = span
  }
  return next
}

// Markers that carry a key: { start, end, key, inner: [from, to] }, each from
// its opening tag to the first closing tag of the same name
function keyedMarkers(html) {
  if (!html || html.indexOf('data-cite') === -1) return []
  const tags = scanTags(html), closes = nextCloses(tags), found = []
  for (let i = 0; i < tags.length; i++) {
    const open = openTag(tags[i])
    if (!open || open.key === null) continue
    const c = closes[open.name][i + 1] ?? -1
    if (c === -1) continue
    found.push({ start: tags[i].start, end: tags[c].end, key: open.key, inner: [tags[i].end, tags[c].start] })
    i = c
  }
  return found
}

// Markers from before keys were stored, which is exactly the shape the Cite
// button used to produce: <sup …>[3]</sup>, with no data-cite
function legacyMarkers(html) {
  if (!html || !/<sup/i.test(html)) return []
  const tags = scanTags(html), found = []
  for (let i = 0; i + 1 < tags.length; i++) {
    const open = openTag(tags[i])
    if (!open || open.name !== 'sup' || /data-cite/i.test(tags[i].text) || !isClose(tags[i + 1], 'sup')) continue
    const label = LEGACY_LABEL_RE.exec(html.slice(tags[i].end, tags[i + 1].start))
    if (!label) continue
    found.push({ start: tags[i].start, end: tags[i + 1].end, number: parseInt(label[1], 10), attrs: tags[i].text.slice(4, -1) })
    i++
  }
  return found
}

// html with each of ranges ([{ start, end }], in order and apart) replaced
function replaceRanges(html, ranges, replace) {
  if (!ranges.length) return html
  let out = '', at = 0
  for (const r of ranges) {
    out += html.slice(at, r.start) + replace(r)
    at = r.end
  }
  return out + html.slice(at)
}

// Every citation in a piece of text, as { pos, key }, earliest first. Keyed
// markers are exact; beyond those it is the same loose matching the references
// slide has always used, so nothing a deck already cites drops off the list.
// Markup is blanked out before the loose pass — without that, the [1] inside a
// marker, or a key sitting in an attribute, would be read as a second citation.
const ENTITIES = { '&amp;': '&', '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

function blank(length) {
  return ' '.repeat(length)
}

// Visible text with markup and entities replaced by equal-length filler, so that
// every position still lines up with the original string.
function visibleText(html, onMarker) {
  let out = replaceRanges(html, keyedMarkers(html), m => {
    onMarker(m.key, m.start)
    return blank(m.end - m.start)
  })
  out = replaceRanges(out, scanTags(out).map(t => ({ start: t.from, end: t.end })), r => blank(r.end - r.start))
  out = out.replace(/&[a-z#0-9]+;/gi, match => {
    const decoded = ENTITIES[match.toLowerCase()]
    return decoded ? decoded + blank(match.length - decoded.length) : blank(match.length)
  })
  return out
}

export function findCitations(text, bibliography = []) {
  if (!text) return []
  const byKey = new Map(bibliography.map(e => [e.key, e]))
  const hits = []

  const visible = visibleText(text, (key, pos) => {
    if (byKey.has(key)) hits.push({ pos, key })
  })

  let m
  BARE_NUMBER_RE.lastIndex = 0
  while ((m = BARE_NUMBER_RE.exec(visible)) !== null) {
    const entry = bibliography[parseInt(m[1], 10) - 1]
    if (entry) hits.push({ pos: m.index, key: entry.key })
  }

  for (const entry of bibliography) {
    for (const pos of allIndexesOf(visible, entry.key)) hits.push({ pos, key: entry.key })
    const short = formatAuthorsShort(parseAuthors(entry.author))
    for (const pos of allIndexesOf(visible, short)) hits.push({ pos, key: entry.key })
  }

  return hits.sort((a, b) => a.pos - b.pos)
}

// Reading order: slide by slide, and within a slide top to bottom, left to right.
// A caption cites what its text names, and the entry it was made from
// (citationKey), whatever its text says: "PubChem CID 2519" names no author.
function citedKeysInPresentationOrder(bibliography, slides) {
  const known = new Set(bibliography.map(e => e.key))
  const seen = new Set()
  const keys = []
  const cite = key => { if (!seen.has(key)) { seen.add(key); keys.push(key) } }
  for (const slide of slides || []) {
    const elements = [...(slide.elements || [])]
      .sort((a, b) => ((a.y || 0) - (b.y || 0)) || ((a.x || 0) - (b.x || 0)))
    for (const el of elements) {
      const text = [el.content, el.citationText].filter(Boolean).join('\n')
      for (const { key } of findCitations(text, bibliography)) cite(key)
      if ((el.citationText || el.citationLink) && known.has(el.citationKey)) cite(el.citationKey)
    }
  }
  return keys
}

function alphabeticalSortKey(entry) {
  const authors = parseAuthors(entry.author)
  const lead = authors[0]?.last || entry.author || entry.title || ''
  return [lead.toLowerCase(), entry.year || '', (entry.title || '').toLowerCase()]
}

export function buildCitationIndex(presentation) {
  const bibliography = presentation?.bibliography || []
  const order = presentation?.citationOrder === 'alphabetical' ? 'alphabetical' : 'presentation'
  const style = presentation?.citationStyle || 'numbered'

  const citedKeys = citedKeysInPresentationOrder(bibliography, presentation?.slides || [])
  const byKey = new Map(bibliography.map(e => [e.key, e]))
  let entries = citedKeys.map(k => byKey.get(k)).filter(Boolean)

  if (order === 'alphabetical') {
    entries = [...entries].sort((a, b) => {
      const ka = alphabeticalSortKey(a), kb = alphabeticalSortKey(b)
      for (let i = 0; i < ka.length; i++) {
        const cmp = String(ka[i]).localeCompare(String(kb[i]))
        if (cmp !== 0) return cmp
      }
      return 0
    })
  }

  const numberByKey = {}
  const labelByKey = {}
  entries.forEach((entry, i) => {
    numberByKey[entry.key] = i + 1
    labelByKey[entry.key] = formatCitation(entry, style, i)
  })

  return { entries, numberByKey, labelByKey, order, style, citedCount: entries.length }
}

// What a marker for this entry should read right now, including one that is about
// to be inserted and so is not in the index yet.
export function nextCitationLabel(presentation, entry) {
  const { labelByKey, citedCount, style } = buildCitationIndex(presentation)
  if (labelByKey[entry.key]) return labelByKey[entry.key]
  return formatCitation(entry, style, citedCount)
}

// A marker's own style is its colour: made bold inline, the text editor would
// read the weight as a bold mark around it. CITATION_CSS makes it bold.
export const CITATION_STYLE = 'color:#6366f1;cursor:default'
export const CITATION_CSS = `
    sup[data-cite] { font-weight:700; }`

export function citationMarkerHtml(entry, label) {
  return `<sup data-cite="${escapeAttr(entry.key)}" style="${CITATION_STYLE}">${escapeText(label)}</sup>`
}

// Refresh the label inside every keyed marker. Content is never the authority, so
// this is safe to run at render time as well as over stored slides.
export function resolveCitationsInHtml(html, labelByKey) {
  if (!html || typeof html !== 'string' || html.indexOf('data-cite') === -1) return html
  const markers = keyedMarkers(html).filter(m => labelByKey?.[m.key])
  return replaceRanges(html, markers, m =>
    html.slice(m.start, m.inner[0]) + escapeText(labelByKey[m.key]) + html.slice(m.inner[1], m.end))
}

// Citations that are only a number, [3], outside any keyed marker: how Cite
// wrote them before markers carried their entry (the text editor kept just the
// text), or typed by hand. Each is read as a position in the library, which is
// how it was assigned. Where the number sits in a <sup>[3]</sup>, it counts once.
function bareNumbers(html, bibliography) {
  if (!html || html.indexOf('[') === -1) return []
  const visible = visibleText(html, () => {})
  const found = []
  let m
  BARE_NUMBER_RE.lastIndex = 0
  while ((m = BARE_NUMBER_RE.exec(visible)) !== null) {
    const entry = bibliography[parseInt(m[1], 10) - 1]
    if (entry) found.push({ start: m.index, end: m.index + m[0].length, number: parseInt(m[1], 10), entry })
  }
  return found
}

// Attach keys to citations written before they carried one: a <sup>[3]</sup>
// gains the key of the library's third entry, and a bare [3] becomes a marker
function linkLegacyMarkers(html, bibliography) {
  const supMarkers = legacyMarkers(html).filter(m => bibliography[m.number - 1])
  const linked = replaceRanges(html, supMarkers, m =>
    `<sup${m.attrs} data-cite="${escapeAttr(bibliography[m.number - 1].key)}">[${m.number}]</sup>`)
  return replaceRanges(linked, bareNumbers(linked, bibliography), m => citationMarkerHtml(m.entry, `[${m.number}]`))
}

// Rewrite the stored markers across a deck: used when the index changes under
// them, so that anything reading the slides directly still sees live numbers.
export function applyCitationNumbering(presentation, { linkLegacy = false } = {}) {
  const bibliography = presentation?.bibliography || []
  if (!presentation || !bibliography.length) return presentation

  const { labelByKey } = buildCitationIndex(presentation)
  let changed = false

  const slides = (presentation.slides || []).map(slide => {
    let slideChanged = false
    const elements = (slide.elements || []).map(el => {
      if (typeof el.content !== 'string' || !el.content) return el
      const linked = linkLegacy ? linkLegacyMarkers(el.content, bibliography) : el.content
      const resolved = resolveCitationsInHtml(linked, labelByKey)
      if (resolved === el.content) return el
      slideChanged = true
      return { ...el, content: resolved }
    })
    if (!slideChanged) return slide
    changed = true
    return { ...slide, elements }
  })

  return changed ? { ...presentation, slides } : presentation
}

// How many stored markers disagree with the index, so the settings tab can say so.
export function countStaleMarkers(presentation) {
  const bibliography = presentation?.bibliography || []
  if (!bibliography.length) return { stale: 0, unlinked: 0 }
  const { labelByKey } = buildCitationIndex(presentation)
  let stale = 0, unlinked = 0

  for (const slide of presentation?.slides || []) {
    for (const el of slide.elements || []) {
      if (typeof el.content !== 'string' || !el.content) continue
      for (const m of keyedMarkers(el.content)) {
        const label = labelByKey[m.key]
        if (label && el.content.slice(m.inner[0], m.inner[1]) !== escapeText(label)) stale++
      }
      unlinked += bareNumbers(el.content, bibliography).length
    }
  }
  return { stale, unlinked }
}
